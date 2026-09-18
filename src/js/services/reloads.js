// ========================================
// ARKHAM — Reloads Service
// ========================================

const RELOADS_API = "/api/admin?resource=public-reloads";

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.error ||
      "La solicitud de Reloads no pudo completarse."
    );
  }

  return data;
}

export async function getReloadGames() {
  const data = await request(
    `${RELOADS_API}&action=games`,
    { method: "GET" }
  );

  return data.games || [];
}

export async function getReloadProducts(gameId) {
  const normalizedGameId = String(gameId ?? "").trim();

  if (!normalizedGameId) {
    throw new Error("Debes indicar el juego.");
  }

  const data = await request(
    `${RELOADS_API}&action=products&gameId=${encodeURIComponent(normalizedGameId)}`,
    { method: "GET" }
  );

  return data.products || [];
}

export async function getReloadOrders() {
  throw new Error(
    "La consulta de órdenes está disponible únicamente desde el panel administrativo."
  );
}

export async function createReloadOrder({
  gameId,
  productId,
  gameData,
  whatsapp
} = {}) {
  const normalizedGameId = String(gameId ?? "").trim();
  const normalizedProductId = String(productId ?? "").trim();
  const normalizedWhatsapp = String(whatsapp ?? "").trim();

  if (!normalizedGameId) {
    throw new Error("Debes indicar el juego.");
  }

  if (!normalizedProductId) {
    throw new Error("Debes indicar el producto.");
  }

  if (!gameData || typeof gameData !== "object" || Array.isArray(gameData)) {
    throw new Error("Debes indicar los datos necesarios para la recarga.");
  }

  if (!normalizedWhatsapp) {
    throw new Error("Debes indicar un número de WhatsApp.");
  }

  const data = await request(
    RELOADS_API,
    {
      method: "POST",
      body: JSON.stringify({
        action: "create-order",
        gameId: normalizedGameId,
        productId: normalizedProductId,
        gameData,
        whatsapp: normalizedWhatsapp
      })
    }
  );

  return data.order || null;
}
