// ========================================
// NEXUS — Admin Subscriptions API
// ========================================

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_lib/firebaseAdmin.js";

const ADMIN_USERS_COLLECTION = "adminUsers";
const ACCOUNTS_COLLECTION = "accounts";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";

const PERMISSIONS = {
  administrator: ["subscriptions.view", "subscriptions.manage"],
  agent: ["subscriptions.view"]
};

function errorResponse(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return null;
}

function getBearerToken(req) {
  const authorization = req.headers?.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
}

async function getAccess(req) {
  const token = getBearerToken(req);
  if (!token) throw Object.assign(new Error("No se proporcionó un token de autenticación."), { status: 401 });

  const app = getFirebaseAdminApp();
  const adminAuth = getAuth(app);
  const firestore = getFirestore(app);
  const decoded = await adminAuth.verifyIdToken(token);
  const adminSnapshot = await firestore.collection(ADMIN_USERS_COLLECTION).doc(decoded.uid).get();

  if (!adminSnapshot.exists) throw Object.assign(new Error("El usuario no tiene acceso administrativo."), { status: 403 });

  const adminUser = adminSnapshot.data() || {};
  if (adminUser.status === "inactive") throw Object.assign(new Error("El usuario administrativo está inactivo."), { status: 403 });

  const roleId = adminUser.roleId || "";
  if (!PERMISSIONS[roleId]) throw Object.assign(new Error("El rol administrativo no es válido."), { status: 403 });

  return { uid: decoded.uid, permissions: PERMISSIONS[roleId], firestore, adminAuth };
}

export default async function handler(req, res) {
  try {
    const access = await getAccess(req);
    if (!access.permissions.includes("subscriptions.view")) {
      return errorResponse(res, "No tienes permisos para consultar las suscripciones.", 403);
    }

    if (req.method !== "GET") {
      return errorResponse(res, "Método no permitido.", 405);
    }

    const [subscriptionsSnapshot, accountsSnapshot] = await Promise.all([
      access.firestore.collection(SUBSCRIPTIONS_COLLECTION).get(),
      access.firestore.collection(ACCOUNTS_COLLECTION).get()
    ]);

    const accountMap = new Map(
      accountsSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }])
    );

    const subscriptions = subscriptionsSnapshot.docs.map(doc => {
      const data = doc.data() || {};
      const account = accountMap.get(data.accountId) || {};

      return {
        id: doc.id,
        accountId: data.accountId || null,
        planId: data.planId || null,
        status: data.status || null,
        period: data.period || null,
        currency: data.currency || "GTQ",
        billingDate: toIso(data.billingDate),
        paymentDeadline: toIso(data.paymentDeadline),
        currentPeriodStart: toIso(data.currentPeriodStart),
        currentPeriodEnd: toIso(data.currentPeriodEnd),
        nextBillingAt: toIso(data.nextBillingAt),
        gracePeriodDays: data.gracePeriodDays ?? 0,
        createdAt: toIso(data.createdAt),
        activatedAt: toIso(data.activatedAt),
        cancelledAt: toIso(data.cancelledAt),
        suspendedAt: toIso(data.suspendedAt),
        expiredAt: toIso(data.expiredAt),
        account: {
          id: data.accountId || null,
          planId: account.planId || null,
          accountStatus: account.accountStatus || "active"
        }
      };
    });

    subscriptions.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return res.status(200).json({ success: true, subscriptions });
  } catch (error) {
    console.error("NEXUS — Admin Subscriptions API:", error);
    return errorResponse(
      res,
      error?.message || "No fue posible cargar las suscripciones.",
      error?.status || 500
    );
  }
}
