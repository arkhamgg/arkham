// ========================================
// NEXUS — Admin Billing Service
// ========================================

import { auth } from "./firebase.js";
import { requireAdminPermission } from "./adminAccess.js";

const API = "/api/admin?resource=billing";

export async function getAdminBilling() {
  await requireAdminPermission("billing.view");
  const user = auth.currentUser;
  if (!user) throw new Error("No hay un usuario autenticado.");
  const token = await user.getIdToken();
  const response = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) throw new Error(data?.error || "No fue posible cargar Billing.");
  return data;
}
