// ========================================
// NEXUS — Admin Subscriptions Service
// ========================================

import { auth } from "./firebase.js";
import { requireAdminPermission } from "./adminAccess.js";

const API = "/api/admin-subscriptions";

async function request() {
  const user = auth.currentUser;
  if (!user) throw new Error("No hay un usuario autenticado.");

  const token = await user.getIdToken();
  const response = await fetch(API, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "No fue posible cargar las suscripciones.");
  }
  return Array.isArray(data?.subscriptions) ? data.subscriptions : [];
}

export async function getAdminSubscriptions() {
  await requireAdminPermission("subscriptions.view");
  return request();
}

export function getSubscriptionStatusLabel(status) {
  const labels = {
    active: "Activa",
    pending: "Pendiente",
    past_due: "Pago vencido",
    suspended: "Suspendida",
    cancelled: "Cancelada",
    expired: "Expirada"
  };
  return labels[status] || "Sin estado";
}

export function getPlanLabel(planId) {
  const labels = {
    free: "Free",
    pro: "Pro",
    circuit: "Circuit",
    enterprise: "Enterprise"
  };
  return labels[planId] || planId || "Sin plan";
}
