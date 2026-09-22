// ========================================
// ARKHAM — Payment Service
// ========================================


// ========================================
// PAYMENT STATUS
// ========================================

export const PAYMENT_STATUS = {

  PENDING:
    "pending",

  UNDER_REVIEW:
    "under_review",

  APPROVED:
    "approved",

  REJECTED:
    "rejected",

  EXPIRED:
    "expired"

};


// ========================================
// PAYMENT METHODS
// ========================================
//
// El sistema queda preparado para agregar
// otros métodos posteriormente.
//
// Inicialmente:
// - Transferencia bancaria
// - Depósito bancario
//

export const PAYMENT_METHOD = {

  BANK_TRANSFER:
    "bank_transfer",

  BANK_DEPOSIT:
    "bank_deposit"

};


// ========================================
// PAYMENT CURRENCY
// ========================================

export const PAYMENT_CURRENCY = {

  GTQ:
    "GTQ"

};


// ========================================
// PAYMENT PERIOD
// ========================================

export const PAYMENT_PERIOD = {

  MONTHLY:
    "monthly"

};


// ========================================
// CREATE PAYMENT DATA
// ========================================

export function createPayment(
  options = {}
) {

  const {

    // ======================================
    // RELATIONSHIPS
    // ======================================

    accountId =
      null,

    subscriptionId =
      null,


    // ======================================
    // PLAN CONTEXT
    // ======================================

    currentPlanId =
      null,

    planId =
      null,


    // ======================================
    // BILLING PERIOD
    // ======================================

    period =
      PAYMENT_PERIOD.MONTHLY,


    // ======================================
    // PAYMENT DATA
    // ======================================

    amount =
      0,

    currency =
      PAYMENT_CURRENCY.GTQ,

    method =
      null,

    status =
      PAYMENT_STATUS.PENDING,


    // ======================================
    // PAYMENT DATE
    // ======================================

    paymentDate =
      null,

    paymentTime =
      null,


    // ======================================
    // BANK / TRANSACTION REFERENCE
    // ======================================

    reference =
      null,


    // ======================================
    // PAYMENT PROOF
    // ======================================
    //
    // El comprobante NO se almacena
    // directamente en ARKHAM.
    //
    // proof contiene únicamente la referencia
    // al archivo almacenado en ImageKit.
    //
    // Ejemplo:
    //
    // proof: {
    //   provider: "imagekit",
    //   fileId: "...",
    //   filePath: "...",
    //   url: "...",
    //   fileName: "...",
    //   contentType: "...",
    //   size: 123456
    // }
    //

    proof =
      null,


    // ======================================
    // NOTES
    // ======================================

    notes =
      null

  } = options;


  return {

    // ======================================
    // RELATIONSHIPS
    // ======================================

    accountId,

    subscriptionId,


    // ======================================
    // PLAN CONTEXT
    // ======================================

    currentPlanId,

    planId,


    // ======================================
    // BILLING PERIOD
    // ======================================

    period,


    // ======================================
    // PAYMENT DATA
    // ======================================

    amount,

    currency,

    method,

    status,


    // ======================================
    // PAYMENT DATE
    // ======================================

    paymentDate,

    paymentTime,


    // ======================================
    // BANK / TRANSACTION REFERENCE
    // ======================================

    reference,


    // ======================================
    // PAYMENT PROOF
    // ======================================

    proof,


    // ======================================
    // NOTES
    // ======================================

    notes,


    // ======================================
    // REVIEW
    // ======================================

    reviewedBy:
      null,

    reviewedAt:
      null,

    rejectionReason:
      null,


    // ======================================
    // LIFECYCLE
    // ======================================

    createdAt:
      null,

    updatedAt:
      null

  };

}


// ========================================
// GET PAYMENT
// ========================================

export async function getPayment(
  paymentId
) {

  if (!paymentId) {

    return null;

  }


  const {
    getEntity
  } = await import(
    "./firestore.js"
  );


  return await getEntity(
    "payments",
    paymentId
  );

}


// ========================================
// GET ACCOUNT PAYMENT
// ========================================

export async function getAccountPayment(
  accountId,
  paymentId
) {

  if (
    !accountId ||
    !paymentId
  ) {

    return null;

  }


  const payment =
    await getPayment(
      paymentId
    );


  if (!payment) {

    return null;

  }


  if (
    payment.accountId !==
    accountId
  ) {

    console.error(
      "ARKHAM — El pago no pertenece a la cuenta."
    );

    return null;

  }


  return payment;

}


// ========================================
// CHECK PAYMENT PENDING / UNDER REVIEW
// ========================================

export function isPaymentPending(
  payment
) {

  if (!payment) {

    return false;

  }


  return (
    payment.status ===
      PAYMENT_STATUS.PENDING ||

    payment.status ===
      PAYMENT_STATUS.UNDER_REVIEW
  );

}


// ========================================
// CHECK APPROVED PAYMENT
// ========================================

export function isPaymentApproved(
  payment
) {

  if (!payment) {

    return false;

  }


  return (
    payment.status ===
    PAYMENT_STATUS.APPROVED
  );

}


// ========================================
// CHECK REJECTED PAYMENT
// ========================================

export function isPaymentRejected(
  payment
) {

  if (!payment) {

    return false;

  }


  return (
    payment.status ===
    PAYMENT_STATUS.REJECTED
  );

}


// ========================================
// CHECK EXPIRED PAYMENT
// ========================================

export function isPaymentExpired(
  payment
) {

  if (!payment) {

    return false;

  }


  return (
    payment.status ===
    PAYMENT_STATUS.EXPIRED
  );

}


// ========================================
// GET PAYMENT STATUS
// ========================================

export function getPaymentStatus(
  payment
) {

  if (!payment) {

    return null;

  }


  return payment.status ||
    null;

}


// ========================================
// GET PAYMENT AMOUNT
// ========================================

export function getPaymentAmount(
  payment
) {

  if (!payment) {

    return 0;

  }


  return Number(
    payment.amount || 0
  );

}


// ========================================
// GET PAYMENT METHOD
// ========================================

export function getPaymentMethod(
  payment
) {

  if (!payment) {

    return null;

  }


  return payment.method ||
    null;

}


// ========================================
// GET PAYMENT PERIOD
// ========================================

export function getPaymentPeriod(
  payment
) {

  if (!payment) {

    return null;

  }


  return payment.period ||
    null;

}


// ========================================
// GET CURRENT PLAN
// ========================================

export function getPaymentCurrentPlan(
  payment
) {

  if (!payment) {

    return null;

  }


  return payment.currentPlanId ||
    null;

}


// ========================================
// GET TARGET PLAN
// ========================================

export function getPaymentTargetPlan(
  payment
) {

  if (!payment) {

    return null;

  }


  return payment.planId ||
    null;

}


// ========================================
// GET PAYMENT PROOF
// ========================================

export function getPaymentProof(
  payment
) {

  if (!payment) {

    return null;

  }


  return payment.proof ||
    null;

}


// ========================================
// CHECK IMAGEKIT PROOF
// ========================================

export function hasImageKitProof(
  payment
) {

  if (!payment?.proof) {

    return false;

  }


  return (
    payment.proof.provider ===
      "imagekit" &&

    Boolean(
      payment.proof.fileId
    ) &&

    Boolean(
      payment.proof.filePath
    ) &&

    Boolean(
      payment.proof.url
    )
  );

}


// ========================================
// CHECK PAYMENT BELONGS TO SUBSCRIPTION
// ========================================

export function paymentBelongsToSubscription(
  payment,
  subscriptionId
) {

  if (
    !payment ||
    !subscriptionId
  ) {

    return false;

  }


  return (
    payment.subscriptionId ===
    subscriptionId
  );

}