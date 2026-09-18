// ========================================
// ARKHAM — Reloads Service
// ========================================

import { auth } from "./firebase.js";

const RELOADS_API = "/api/reloads";

async function getFirebaseIdToken() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Debes iniciar sesión para realizar esta operación.");
  }

  return await user.getIdToken();
}

async function apiRequest(url, options = {}) {
  const token = await getFirebaseIdToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.error ||
      "La solicitud de Reloads no pudo completarse."
    );
  }

  return data;
}

export async function getReloadGames() {
  const response = await fetch(
    `${RELOADS_API}?resource=games`,
    {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    }
  );

  const data = await response.json();

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.error ||
      "No fue posible cargar los juegos disponibles."
    );
  }

  return data.games || [];
}

export async function getReloadProducts(gameId) {
  if (!gameId) {
    throw new Error("Debes indicar el juego.");
  }

  const response = await fetch(
    `${RELOADS_API}?resource=products&gameId=${encodeURIComponent(gameId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    }
  );

  const data = await response.json();

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.error ||
      "No fue posible cargar los productos de recarga."
    );
  }

  return data.products || [];
}

export async function getReloadOrders() {
  const data = await apiRequest(
    `${RELOADS_API}?resource=orders`,
    { method: "GET" }
  );

  return data.orders || [];
}

export async function createReloadOrder({
  gameId,
  productId,
  gameData,
  whatsapp
} = {}) {
  if (!gameId) {
    throw new Error("Debes indicar el juego.");
  }

  if (!productId) {
    throw new Error("Debes indicar el producto.");
  }

  const data = await apiRequest(
    `${RELOADS_API}?resource=orders`,
    {
      method: "POST",
      body: JSON.stringify({
        gameId,
        productId,
        gameData,
        whatsapp
      })
    }
  );

  return data.order || null;
}
