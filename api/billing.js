// ========================================
// NEXUS — Billing API Gateway
// ========================================
//
// The resource is selected through ?resource=...
//
// /api/billing?resource=payment
// /api/billing?resource=submit
// /api/billing?resource=proof
//
// Existing billing behavior is delegated to the
// original handlers, moved into internal modules.
// ========================================

import paymentHandler from "./_lib/billing/payment.js";
import submitHandler from "./_lib/billing/submit.js";
import proofHandler from "./_lib/billing/proof.js";

const HANDLERS = {
  payment: paymentHandler,
  submit: submitHandler,
  proof: proofHandler
};

export default async function handler(req, res) {
  const resource = String(req.query?.resource || "").trim().toLowerCase();
  const selectedHandler = HANDLERS[resource];

  if (!selectedHandler) {
    return res.status(400).json({
      success: false,
      error: "Recurso de billing no válido."
    });
  }

  return selectedHandler(req, res);
}
