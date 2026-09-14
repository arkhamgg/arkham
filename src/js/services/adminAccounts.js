// ========================================
// NEXUS — Admin Accounts Service
// ========================================
//
// Gestión administrativa de cuentas.
//
// Frontend
//    ↓
// adminAccounts.js
//    ↓
// /api/admin-accounts
//    ↓
// Firebase Admin SDK
//
// ========================================

import { auth } from "./firebase.js";
import { requireAdminPermission } from "./adminAccess.js";

const ADMIN_ACCOUNTS_API = "/api/admin-accounts";

async function getAuthToken() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No hay un usuario autenticado.");
  }

  const token = await user.getIdToken();

  if (!token) {
    throw new Error(
      "No fue posible obtener el token de autenticación."
    );
  }

  return token;
}

async function adminApiRequest(method = "GET", body = null) {
  const token = await getAuthToken();

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(
    ADMIN_ACCOUNTS_API,
    options
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "El servidor devolvió una respuesta inválida."
    );
  }

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.error ||
      `Error administrativo (${response.status}).`
    );
  }

  return data;
}

export async function getAdminAccounts() {
  await requireAdminPermission("accounts.view");

  const response = await adminApiRequest("GET");

  return Array.isArray(response.accounts)
    ? response.accounts
    : [];
}

export async function suspendAccount(uid) {
  if (!uid) {
    throw new Error("El UID de la cuenta es obligatorio.");
  }

  await requireAdminPermission("accounts.manage");

  const response = await adminApiRequest(
    "PATCH",
    {
      uid,
      action: "suspend"
    }
  );

  return response.account || null;
}

export async function activateAccount(uid) {
  if (!uid) {
    throw new Error("El UID de la cuenta es obligatorio.");
  }

  await requireAdminPermission("accounts.manage");

  const response = await adminApiRequest(
    "PATCH",
    {
      uid,
      action: "activate"
    }
  );

  return response.account || null;
}

export function getAccountStatusLabel(status) {
  switch (status) {
    case "active":
      return "Activo";
    case "suspended":
      return "Suspendido";
    default:
      return "Sin estado";
  }
}

export function getAccountPlanLabel(planId) {
  switch (planId) {
    case "free":
      return "Free";
    case "pro":
      return "Pro";
    case "circuit":
      return "Circuit";
    case "enterprise":
      return "Enterprise";
    default:
      return planId || "Sin plan";
  }
}

export function getSubscriptionStatusLabel(status) {
  switch (status) {
    case "active":
      return "Activa";
    case "pending":
      return "Pendiente";
    case "past_due":
      return "Pago vencido";
    case "suspended":
      return "Suspendida";
    case "cancelled":
      return "Cancelada";
    case "expired":
      return "Expirada";
    default:
      return "Sin suscripción";
  }
}
