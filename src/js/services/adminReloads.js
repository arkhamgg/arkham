// ========================================
// NEXUS — Admin Reloads Service
// ========================================

import { auth } from "./firebase.js";
import { requireAdminPermission } from "./adminAccess.js";

const API = "/api/admin?resource=reloads";

async function request(options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("No hay un usuario autenticado.");
  const token = await user.getIdToken();
  const response = await fetch(API, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) throw new Error(data?.error || "No fue posible procesar Reloads.");
  return data;
}

export async function getAdminReloads() {
  await requireAdminPermission("reloads.view");
  return request();
}

export async function createReloadGame(payload) {
  await requireAdminPermission("reloads.manage");
  return request({ method: "POST", body: JSON.stringify({ action: "create-game", ...payload }) });
}

export async function updateReloadGame(payload) {
  await requireAdminPermission("reloads.manage");
  return request({ method: "POST", body: JSON.stringify({ action: "update-game", ...payload }) });
}

export async function createReloadProduct(payload) {
  await requireAdminPermission("reloads.manage");
  return request({ method: "POST", body: JSON.stringify({ action: "create-product", ...payload }) });
}

export async function updateReloadProduct(payload) {
  await requireAdminPermission("reloads.manage");
  return request({ method: "POST", body: JSON.stringify({ action: "update-product", ...payload }) });
}
