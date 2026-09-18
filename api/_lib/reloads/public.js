// ========================================
// ARKHAM — Public Reloads API
// ========================================

import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../firebaseAdmin.js";

const GAMES_COLLECTION = "reloadGames";
const PRODUCTS_COLLECTION = "reloadProducts";
const ORDERS_COLLECTION = "reloadOrders";

const PAYMENT_PENDING = "PENDING";
const RELOAD_NOT_STARTED = "NOT_STARTED";

function errorResponse(res, message, status = 400) {
  return res.status(status).json({
    success: false,
    error: message
  });
}

function successResponse(res, data = {}, status = 200) {
  return res.status(status).json({
    success: true,
    ...data
  });
}

function cleanString(value, maxLength = 200) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function serialize(doc) {
  return {
    id: doc.id,
    ...doc.data()
  };
}

function normalizeFieldValue(field, value) {
  if (field.type === "number") {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      throw Object.assign(
        new Error(`El campo "${field.label}" debe contener un número válido.`),
        { status: 400 }
      );
    }

    return number;
  }

  return cleanString(value, 200);
}

function validateGameData(game, gameData) {
  if (!gameData || typeof gameData !== "object" || Array.isArray(gameData)) {
    throw Object.assign(
      new Error("Debes indicar los datos necesarios para la recarga."),
      { status: 400 }
    );
  }

  const fields = Array.isArray(game.fields) ? game.fields : [];
  const normalized = {};

  for (const field of fields) {
    const id = cleanString(field?.id, 80);
    const label = cleanString(field?.label, 120);
    const type = field?.type === "number" ? "number" : "text";
    const required = field?.required !== false;

    if (!id || !label) continue;

    const value = gameData[id];
    const empty = value === undefined || value === null || cleanString(value) === "";

    if (required && empty) {
      throw Object.assign(
        new Error(`Debes completar el campo "${label}".`),
        { status: 400 }
      );
    }

    if (empty) continue;

    normalized[id] = normalizeFieldValue(
      { id, label, type, required },
      value
    );
  }

  return normalized;
}

async function getOptionalUserId(req, app) {
  const authorization =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = await getAuth(app).verifyIdToken(token);
    return decoded.uid || null;
  } catch {
    throw Object.assign(
      new Error("El token de autenticación no es válido."),
      { status: 401 }
    );
  }
}

function createOrderNumber(orderId) {
  return `ARK-RLD-${orderId.slice(0, 8).toUpperCase()}`;
}

export async function handle(req, res) {
  const method = String(req.method || "GET").toUpperCase();

  if (!["GET", "POST"].includes(method)) {
    return errorResponse(res, "Método no permitido.", 405);
  }

  const action = cleanString(
    req.body?.action || req.query?.action || "",
    50
  ).toLowerCase();

  try {
    const app = getFirebaseAdminApp();
    const db = getFirestore(app);

    // ========================================
    // GET — PUBLIC CATALOG
    // ========================================

    if (method === "GET") {
      const resource = cleanString(
        req.query?.action || "",
        50
      ).toLowerCase();

      if (resource === "games") {
        const snapshot = await db
          .collection(GAMES_COLLECTION)
          .orderBy("name")
          .get();

        const games = snapshot.docs
          .map(serialize)
          .filter((game) => game.active === true);

        return successResponse(res, { games });
      }

      if (resource === "products") {
        const gameId = cleanString(req.query?.gameId, 100);

        if (!gameId) {
          return errorResponse(res, "Debes indicar el juego.", 400);
        }

        const gameSnapshot = await db
          .collection(GAMES_COLLECTION)
          .doc(gameId)
          .get();

        if (!gameSnapshot.exists || gameSnapshot.data()?.active !== true) {
          return errorResponse(res, "El juego seleccionado no está disponible.", 404);
        }

        const snapshot = await db
          .collection(PRODUCTS_COLLECTION)
          .orderBy("name")
          .get();

        const products = snapshot.docs
          .map(serialize)
          .filter(
            (product) =>
              product.active === true &&
              product.gameId === gameId
          );

        return successResponse(res, { products });
      }

      return errorResponse(res, "Recurso público de Reloads no válido.", 404);
    }

    // ========================================
    // POST — CREATE ORDER
    // ========================================

    if (action !== "create-order") {
      return errorResponse(res, "Acción pública de Reloads no válida.", 400);
    }

    const gameId = cleanString(req.body?.gameId, 100);
    const productId = cleanString(req.body?.productId, 100);
    const whatsapp = cleanString(req.body?.whatsapp, 30);

    if (!gameId) {
      return errorResponse(res, "Debes indicar el juego.", 400);
    }

    if (!productId) {
      return errorResponse(res, "Debes indicar el producto.", 400);
    }

    if (!whatsapp) {
      return errorResponse(res, "Debes indicar un número de WhatsApp.", 400);
    }

    const [gameSnapshot, productSnapshot] = await Promise.all([
      db.collection(GAMES_COLLECTION).doc(gameId).get(),
      db.collection(PRODUCTS_COLLECTION).doc(productId).get()
    ]);

    if (!gameSnapshot.exists) {
      return errorResponse(res, "El juego seleccionado no existe.", 404);
    }

    if (!productSnapshot.exists) {
      return errorResponse(res, "El producto seleccionado no existe.", 404);
    }

    const game = gameSnapshot.data() || {};
    const product = productSnapshot.data() || {};

    if (game.active !== true) {
      return errorResponse(res, "El juego seleccionado no está disponible.", 400);
    }

    if (
      product.active !== true ||
      product.gameId !== gameId
    ) {
      return errorResponse(res, "El producto seleccionado no está disponible.", 400);
    }

    const gameData = validateGameData(
      game,
      req.body?.gameData
    );

    const customerId = await getOptionalUserId(req, app);

    const orderRef = db
      .collection(ORDERS_COLLECTION)
      .doc();

    const order = {
      orderNumber: createOrderNumber(orderRef.id),

      customerId: customerId || null,

      game: {
        id: gameId,
        name: cleanString(game.name, 120)
      },

      product: {
        id: productId,
        name: cleanString(product.name, 120),
        amount: Number(product.amount),
        price: Number(product.price),
        currency: cleanString(product.currency || "GTQ", 10)
      },

      gameData,
      whatsapp,

      payment: {
        status: PAYMENT_PENDING
      },

      reload: {
        status: RELOAD_NOT_STARTED
      },

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await orderRef.set(order);

    return successResponse(
      res,
      {
        order: {
          id: orderRef.id,
          orderNumber: order.orderNumber,
          game: order.game,
          product: order.product,
          gameData: order.gameData,
          whatsapp: order.whatsapp,
          payment: order.payment,
          reload: order.reload
        }
      },
      201
    );
  } catch (error) {
    console.error("ARKHAM — Public Reloads API:", error);

    return errorResponse(
      res,
      error?.message || "No fue posible procesar Reloads.",
      error?.status || 500
    );
  }
}
