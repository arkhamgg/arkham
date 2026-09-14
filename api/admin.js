// ========================================
// NEXUS — Consolidated Admin API
// ========================================
//
// Single Vercel Serverless Function for Admin Core.
// The resource is selected through ?resource=...
//
// /api/admin?resource=accounts
// /api/admin?resource=staff
// /api/admin?resource=subscriptions
// /api/admin?resource=payments
// /api/admin?resource=payment-approve
// /api/admin?resource=payment-reject
//
// Domain handlers remain isolated in api/_lib/admin/.
// ========================================

import { handle as handleAccounts } from "./_lib/admin/accounts.js";
import { handle as handleStaff } from "./_lib/admin/staff.js";
import { handle as handleSubscriptions } from "./_lib/admin/subscriptions.js";
import { handle as handlePayments } from "./_lib/admin/payments.js";
import { handle as handlePaymentApprove } from "./_lib/admin/paymentApprove.js";
import { handle as handlePaymentReject } from "./_lib/admin/paymentReject.js";
import { handle as handleBilling } from "./_lib/admin/billing.js";
import { handle as handleAudit } from "./_lib/admin/audit.js";

const HANDLERS = {
  accounts: handleAccounts,
  staff: handleStaff,
  subscriptions: handleSubscriptions,
  payments: handlePayments,
  "payment-approve": handlePaymentApprove,
  "payment-reject": handlePaymentReject,
  billing: handleBilling,
  audit: handleAudit
};

function errorResponse(res, message, status = 400) {
  return res.status(status).json({
    success: false,
    error: message
  });
}

export default async function handler(req, res) {
  const resource = String(req.query?.resource || "").trim().toLowerCase();
  const selectedHandler = HANDLERS[resource];

  if (!selectedHandler) {
    return errorResponse(
      res,
      "Recurso administrativo no válido.",
      404
    );
  }

  try {
    return await selectedHandler(req, res);
  } catch (error) {
    console.error("NEXUS — Consolidated Admin API:", error);
    return errorResponse(
      res,
      error?.message || "No fue posible procesar la solicitud administrativa.",
      error?.status || 500
    );
  }
}
