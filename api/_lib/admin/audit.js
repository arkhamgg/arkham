// ========================================
// ARKHAMS — Admin Audit API
// ========================================

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../firebaseAdmin.js";

const ADMIN_USERS = "adminUsers";
const AUDIT_LOGS = "auditLogs";
const PERMISSIONS = {
  administrator: ["audit.view"],
  agent: ["audit.view"]
};

function errorResponse(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getToken(req) {
  const value = req.headers?.authorization || req.headers?.Authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : null;
}

async function getAccess(req) {
  const token = getToken(req);
  if (!token) throw Object.assign(new Error("No se proporcionó un token de autenticación."), { status: 401 });
  const app = getFirebaseAdminApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const decoded = await auth.verifyIdToken(token);
  const snapshot = await firestore.collection(ADMIN_USERS).doc(decoded.uid).get();
  if (!snapshot.exists) throw Object.assign(new Error("El usuario no tiene acceso administrativo."), { status: 403 });
  const adminUser = snapshot.data() || {};
  if (adminUser.status === "inactive") throw Object.assign(new Error("El usuario administrativo está inactivo."), { status: 403 });
  const roleId = adminUser.roleId || "";
  if (!PERMISSIONS[roleId]) throw Object.assign(new Error("El rol administrativo no es válido."), { status: 403 });
  return { firestore, permissions: PERMISSIONS[roleId] };
}

export async function handle(req, res) {
  try {
    if (req.method !== "GET") return errorResponse(res, "Método no permitido.", 405);
    const access = await getAccess(req);
    if (!access.permissions.includes("audit.view")) return errorResponse(res, "No tienes permisos para consultar auditoría.", 403);

    const snapshot = await access.firestore.collection(AUDIT_LOGS).get();
    const logs = snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        actorId: data.actorId || null,
        actorRole: data.actorRole || null,
        action: data.action || null,
        targetType: data.targetType || null,
        targetId: data.targetId || null,
        previousState: data.previousState || null,
        newState: data.newState || null,
        reason: data.reason || null,
        metadata: data.metadata || null,
        createdAt: toIso(data.createdAt)
      };
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.status(200).json({
      success: true,
      summary: {
        total: logs.length,
        last24h: logs.filter(log => Date.now() - new Date(log.createdAt || 0).getTime() <= 86400000).length
      },
      logs: logs.slice(0, 500)
    });
  } catch (error) {
    console.error("ARKHAM — Admin Audit API:", error);
    return errorResponse(res, error?.message || "No fue posible cargar la auditoría.", error?.status || 500);
  }
}
