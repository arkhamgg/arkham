// ========================================
// NEXUS — Admin Audit Service
// ========================================

import { auth } from "./firebase.js";
import { requireAdminPermission } from "./adminAccess.js";

const API = "/api/admin?resource=audit";

export async function getAdminAuditLogs() {
  await requireAdminPermission("audit.view");
  const user = auth.currentUser;
  if (!user) throw new Error("No hay un usuario autenticado.");
  const token = await user.getIdToken();
  const response = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) throw new Error(data?.error || "No fue posible cargar la auditoría.");
  return data;
}

export function getAuditActionLabel(action) {
  const labels = {
    payment_approved: "Pago aprobado",
    payment_rejected: "Pago rechazado",
    staff_role_updated: "Rol de staff actualizado",
    staff_status_updated: "Estado de staff actualizado",
    account_status_updated: "Estado de cuenta actualizado"
  };
  return labels[action] || action || "Acción administrativa";
}
