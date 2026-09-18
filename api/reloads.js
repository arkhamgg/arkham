// ========================================
// ARKHAM — Reloads API
// ========================================
//
// Core API for the Reloads module.
//
// Resources:
//   GET  /api/reloads?resource=games
//   GET  /api/reloads?resource=products&gameId=freefire
//   GET  /api/reloads?resource=orders
//   POST /api/reloads?resource=orders
//
// Administrative operations are intentionally kept
// outside this core layer and will be added to the
// dedicated Reloads Admin module.
// ========================================

import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_lib/firebaseAdmin.js";

const firebaseAdminApp = getFirebaseAdminApp();
const adminAuth = getAuth(firebaseAdminApp);
const adminDb = getFirestore(firebaseAdminApp);

const COLLECTIONS = {
  games: "reloadGames",
  products: "reloadProducts",
  orders: "reloadOrders"
};

const ORDER_STATUS = {
  PENDING: "pending"
};

function response(res, success, data = {}, status = 200) {
  return res.status(status).json({ success, ...data });
}

function errorResponse(res, message, status = 400) {
  return response(res, false, { error: message }, status);
}

function getBearerToken(req) {
  const authorization =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    "";

  if (!authorization.startsWith("Bearer ")) return null;

  return authorization.substring(7).trim() || null;
}

async function authenticate(req) {
  const token = getBearerToken(req);

  if (!token) {
    const error = new Error("Debes iniciar sesión para realizar esta operación.");
    error.status = 401;
    throw error;
  }

  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    const error = new Error("El token de autenticación no es válido.");
    error.status = 401;
    throw error;
  }
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toISOString();
  }
  if (typeof value._seconds === "number") {
    return new Date(value._seconds * 1000).toISOString();
  }
  return null;
}

function normalizeGame(document) {
  const data = document.data() || {};

  return {
    id: document.id,
    name: data.name || document.id,
    slug: data.slug || document.id,
    active: data.active !== false,
    description: data.description || "",
    imageUrl: data.imageUrl || null,
    fields: Array.isArray(data.fields) ? data.fields : [],
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt)
  };
}

function normalizeProduct(document) {
  const data = document.data() || {};

  return {
    id: document.id,
    gameId: data.gameId || null,
    name: data.name || document.id,
    description: data.description || "",
    amount: Number(data.amount || 0),
    price: Number(data.price || 0),
    currency: data.currency || "GTQ",
    active: data.active !== false,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt)
  };
}

function normalizeOrder(document) {
  const data = document.data() || {};

  return {
    id: document.id,
    orderNumber: data.orderNumber || document.id,
    userId: data.userId || null,
    gameId: data.gameId || null,
    productId: data.productId || null,
    gameData: data.gameData || {},
    amount: Number(data.amount || 0),
    currency: data.currency || "GTQ",
    whatsapp: data.whatsapp || null,
    status: data.status || ORDER_STATUS.PENDING,
    payment: {
      status: data.payment?.status || "pending",
      method: data.payment?.method || null
    },
    reload: {
      status: data.reload?.status || "not_started"
    },
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt)
  };
}

async function getGames(req, res) {
  const snapshot = await adminDb
    .collection(COLLECTIONS.games)
    .where("active", "==", true)
    .get();

  const games = snapshot.docs
    .map(normalizeGame)
    .sort((a, b) => a.name.localeCompare(b.name));

  return response(res, true, { games });
}

async function getProducts(req, res) {
  const gameId = String(req.query?.gameId || "").trim();

  if (!gameId) {
    return errorResponse(res, "gameId es obligatorio.");
  }

  const snapshot = await adminDb
    .collection(COLLECTIONS.products)
    .where("gameId", "==", gameId)
    .where("active", "==", true)
    .get();

  const products = snapshot.docs
    .map(normalizeProduct)
    .filter((product) => product.price > 0)
    .sort((a, b) => a.price - b.price);

  return response(res, true, { products });
}

async function getOrders(req, res, decodedToken) {
  const snapshot = await adminDb
    .collection(COLLECTIONS.orders)
    .where("userId", "==", decodedToken.uid)
    .limit(50)
    .get();

  const orders = snapshot.docs
    .map(normalizeOrder)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return response(res, true, { orders });
}

function getRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  return null;
}

function validateGameData(game, gameData) {
  if (!gameData || typeof gameData !== "object" || Array.isArray(gameData)) {
    return "Debes proporcionar los datos requeridos del juego.";
  }

  const fields = Array.isArray(game.fields) ? game.fields : [];

  for (const field of fields) {
    if (!field?.id || field.required !== true) continue;

    const value = gameData[field.id];

    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {
      return `El campo ${field.label || field.id} es obligatorio.`;
    }
  }

  return null;
}

function normalizeWhatsapp(value) {
  if (value === undefined || value === null) return null;

  const whatsapp = String(value).trim();

  if (!whatsapp) return null;

  if (!/^\+?[0-9\s()-]{8,20}$/.test(whatsapp)) {
    return "INVALID";
  }

  return whatsapp;
}

async function createOrder(req, res, decodedToken) {
  const body = getRequestBody(req);

  if (!body) {
    return errorResponse(res, "El cuerpo de la solicitud no es válido.");
  }

  const gameId = String(body.gameId || "").trim();
  const productId = String(body.productId || "").trim();
  const gameData = body.gameData;
  const whatsapp = normalizeWhatsapp(body.whatsapp);

  if (!gameId) return errorResponse(res, "gameId es obligatorio.");
  if (!productId) return errorResponse(res, "productId es obligatorio.");

  if (whatsapp === "INVALID") {
    return errorResponse(res, "El número de WhatsApp no es válido.");
  }

  const [gameSnapshot, productSnapshot] = await Promise.all([
    adminDb.collection(COLLECTIONS.games).doc(gameId).get(),
    adminDb.collection(COLLECTIONS.products).doc(productId).get()
  ]);

  if (!gameSnapshot.exists || gameSnapshot.data()?.active === false) {
    return errorResponse(res, "El juego seleccionado no está disponible.", 404);
  }

  if (!productSnapshot.exists || productSnapshot.data()?.active === false) {
    return errorResponse(res, "El producto seleccionado no está disponible.", 404);
  }

  const game = normalizeGame(gameSnapshot);
  const product = normalizeProduct(productSnapshot);

  if (product.gameId !== game.id) {
    return errorResponse(res, "El producto no pertenece al juego seleccionado.", 400);
  }

  if (!Number.isFinite(product.price) || product.price <= 0) {
    return errorResponse(res, "El producto no tiene un precio válido.", 400);
  }

  const gameDataError = validateGameData(game, gameData);

  if (gameDataError) {
    return errorResponse(res, gameDataError, 400);
  }

  const orderRef = adminDb.collection(COLLECTIONS.orders).doc();
  const orderNumber = `AR-REL-${orderRef.id.slice(0, 8).toUpperCase()}`;

  const order = {
    orderNumber,
    userId: decodedToken.uid,
    gameId: game.id,
    productId: product.id,
    gameData,
    amount: product.price,
    currency: product.currency,
    whatsapp,
    status: ORDER_STATUS.PENDING,
    payment: {
      status: "pending",
      method: null,
      proof: null,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null
    },
    reload: {
      status: "not_started",
      processedBy: null,
      processedAt: null,
      failureReason: null
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  await orderRef.set(order);

  return response(
    res,
    true,
    {
      order: {
        id: orderRef.id,
        orderNumber,
        gameId: game.id,
        productId: product.id,
        amount: product.price,
        currency: product.currency,
        whatsapp,
        status: ORDER_STATUS.PENDING,
        payment: { status: "pending", method: null },
        reload: { status: "not_started" }
      }
    },
    201
  );
}

export default async function handler(req, res) {
  try {
    const resource = String(req.query?.resource || "").trim().toLowerCase();

    if (resource === "games" && req.method === "GET") {
      return await getGames(req, res);
    }

    if (resource === "products" && req.method === "GET") {
      return await getProducts(req, res);
    }

    const decodedToken = await authenticate(req);

    if (resource === "orders" && req.method === "GET") {
      return await getOrders(req, res, decodedToken);
    }

    if (resource === "orders" && req.method === "POST") {
      return await createOrder(req, res, decodedToken);
    }

    return errorResponse(res, "Recurso de Reloads no válido.", 404);
  } catch (error) {
    console.error("ARKHAM — Reloads API:", error);

    return errorResponse(
      res,
      error?.message || "No fue posible procesar la solicitud de Reloads.",
      error?.status || 500
    );
  }
}
