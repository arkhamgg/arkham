// ========================================
// NEXUS — Payment Service
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
// CREATE PAYMENT DATA
// ========================================

export function createPayment(
  options = {}
) {

  const {

    accountId =
      null,

    subscriptionId =
      null,

    planId =
      null,

    amount =
      0,

    currency =
      PAYMENT_CURRENCY.GTQ,

    method =
      null,

    status =
      PAYMENT_STATUS.PENDING,

    paymentDate =
      null,

    paymentTime =
      null,

    reference =
      null,

    proof =
      null,

    notes =
      null

  } = options;


  return {

    // ========================================
    // RELATIONSHIPS
    // ========================================

    accountId,

    subscriptionId,

    planId,


    // ========================================
    // PAYMENT DATA
    // ========================================

    amount,

    currency,

    method,

    status,


    // ========================================
    // PAYMENT DATE
    // ========================================

    paymentDate,

    paymentTime,


    // ========================================
    // BANK / TRANSACTION REFERENCE
    // ========================================

    reference,


    // ========================================
    // PAYMENT PROOF
    // ========================================
    //
    // La prueba de pago NO se almacena
    // directamente dentro del documento.
    //
    // proof será una referencia al archivo
    // almacenado posteriormente en Storage.
    //

    proof,


    // ========================================
    // NOTES
    // ========================================

    notes,


    // ========================================
    // REVIEW
    // ========================================

    reviewedBy:
      null,

    reviewedAt:
      null,

    rejectionReason:
      null,


    // ========================================
    // LIFECYCLE
    // ========================================

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
      "NEXUS — El pago no pertenece a la cuenta."
    );

    return null;

  }


  return payment;

}


// ========================================
// CHECK PAYMENT STATUS
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