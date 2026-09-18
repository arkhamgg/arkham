// ========================================
// NEXUS — Admin Reloads API
// ========================================

import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../firebaseAdmin.js";
import { writeAdminAudit } from "./auditWriter.js";

const ADMIN_USERS_COLLECTION = "adminUsers";
const GAMES_COLLECTION = "reloadGames";
const PRODUCTS_COLLECTION = "reloadProducts";

const ROLE_PERMISSIONS = {
  administrator: [
    "reloads.view",
    "reloads.manage",
    "reloads.payments.review",
    "reloads.orders.process"
  ],
  agent: [
    "reloads.view",
    "reloads.manage",
    "reloads.payments.review",
    "reloads.orders.process"
  ]
};

function errorResponse(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

function successResponse(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

function getBearerToken(req) {
  const authorization = req.headers?.authorization || req.headers?.Authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
}

async function authenticateAdmin(req) {
  const token = getBearerToken(req);
  if (!token) throw Object.assign(new Error("No se proporcionó un token de autenticación."), { status: 401 });

  const app = getFirebaseAdminApp();
  const adminAuth = getAuth(app);
  const firestore = getFirestore(app);
  const decoded = await adminAuth.verifyIdToken(token);
  const snapshot = await firestore.collection(ADMIN_USERS_COLLECTION).doc(decoded.uid).get();

  if (!snapshot.exists) throw Object.assign(new Error("El usuario no tiene acceso administrativo."), { status: 403 });

  const adminUser = snapshot.data();
  const roleId = adminUser.roleId;
  const status = adminUser.status || "active";
  const permissions = ROLE_PERMISSIONS[roleId] || [];

  if (status !== "active" || !permissions.length) {
    throw Object.assign(new Error("El usuario administrativo no tiene acceso a Reloads."), { status: 403 });
  }

  return { uid: decoded.uid, roleId, permissions, firestore };
}

function requirePermission(access, permission) {
  if (!access.permissions.includes(permission)) {
    throw Object.assign(new Error("No tienes permiso para realizar esta operación."), { status: 403 });
  }
}

function cleanString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .map(field => ({
      id: cleanString(field?.id),
      label: cleanString(field?.label),
      type: ["text", "number"].includes(field?.type) ? field.type : "text",
      required: field?.required !== false,
      placeholder: cleanString(field?.placeholder)
    }))
    .filter(field => field.id && field.label);
}

function normalizeGame(payload, existing = {}) {
  const name = cleanString(payload?.name, existing.name);
  const slug = cleanString(payload?.slug, existing.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!name || !slug) throw Object.assign(new Error("El juego requiere nombre y slug."), { status: 400 });
  return {
    name,
    slug,
    active: payload?.active !== false,
    fields: normalizeFields(payload?.fields ?? existing.fields)
  };
}

function normalizeProduct(payload, existing = {}) {
  const name = cleanString(payload?.name, existing.name);
  const gameId = cleanString(payload?.gameId, existing.gameId);
  const amount = Number(payload?.amount ?? existing.amount);
  const price = Number(payload?.price ?? existing.price);
  if (!name || !gameId || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(price) || price < 0) {
    throw Object.assign(new Error("El producto requiere juego, nombre, cantidad y precio válidos."), { status: 400 });
  }
  return {
    gameId,
    name,
    amount,
    price,
    currency: "GTQ",
    active: payload?.active !== false
  };
}

function serialize(doc) {
  const data = doc.data() || {};
  return { id: doc.id, ...data };
}

export async function handle(req, res) {
  try {
    const access = await authenticateAdmin(req);
    const method = String(req.method || "GET").toUpperCase();
    const action = cleanString(req.body?.action || req.query?.action).toLowerCase();

    if (method === "GET") {
      requirePermission(access, "reloads.view");
      const gamesSnapshot = await access.firestore.collection(GAMES_COLLECTION).orderBy("name").get();
      const productsSnapshot = await access.firestore.collection(PRODUCTS_COLLECTION).orderBy("name").get();
      return successResponse(res, {
        games: gamesSnapshot.docs.map(serialize),
        products: productsSnapshot.docs.map(serialize)
      });
    }

    requirePermission(access, "reloads.manage");

    if (!["create-game", "update-game", "create-product", "update-product"].includes(action)) {
      return errorResponse(res, "Acción de Reloads no válida.", 400);
    }

    const collection = action.includes("game") ? GAMES_COLLECTION : PRODUCTS_COLLECTION;
    const id = cleanString(req.body?.id);
    const ref = id ? access.firestore.collection(collection).doc(id) : access.firestore.collection(collection).doc();
    const existingSnapshot = await ref.get();
    const existing = existingSnapshot.exists ? existingSnapshot.data() : {};

    if (action.includes("product")) {
      const data = normalizeProduct(req.body, existing);
      const gameSnapshot = await access.firestore.collection(GAMES_COLLECTION).doc(data.gameId).get();
      if (!gameSnapshot.exists) return errorResponse(res, "El juego seleccionado no existe.", 400);
      await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp(), ...(existingSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
    } else {
      const data = normalizeGame(req.body, existing);
      await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp(), ...(existingSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
    }

    await writeAdminAudit({
      firestore: access.firestore,
      actorId: access.uid,
      actorRole: access.roleId,
      action: `reloads.${action}`,
      targetType: collection === GAMES_COLLECTION ? "reloadGame" : "reloadProduct",
      targetId: ref.id,
      metadata: { id: ref.id }
    });

    return successResponse(res, { id: ref.id }, existingSnapshot.exists ? 200 : 201);
  } catch (error) {
    console.error("NEXUS — Admin Reloads API:", error);
    return errorResponse(res, error?.message || "No fue posible procesar Reloads.", error?.status || 500);
  }
}
