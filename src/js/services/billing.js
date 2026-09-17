// ========================================
// NEXUS — Billing Service
// ========================================

import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PERIOD,
  isSubscriptionActive,
  hasEffectiveSubscriptionAccess,
  isWithinGracePeriod,
  isSubscriptionExpired,
  getSubscriptionPlanId
} from "./subscription.js";

import {
  PAYMENT_STATUS,
  isPaymentPending,
  isPaymentApproved,
  isPaymentRejected,
  isPaymentExpired,
  getPaymentAmount
} from "./payment.js";


// ========================================
// BILLING STATUS
// ========================================

export const BILLING_STATUS = {

  CURRENT:
    "current",

  PAYMENT_PENDING:
    "payment_pending",

  PAYMENT_UNDER_REVIEW:
    "payment_under_review",

  PAYMENT_REJECTED:
    "payment_rejected",

  PAST_DUE:
    "past_due",

  GRACE_PERIOD:
    "grace_period",

  EXPIRED:
    "expired",

  SUSPENDED:
    "suspended",

  CANCELLED:
    "cancelled"

};


// ========================================
// GET BILLING STATUS
// ========================================
//
// Determina el estado efectivo de Billing
// utilizando la suscripción y, cuando existe,
// el pago asociado.
//
// Este servicio NO modifica datos.
//


export function getBillingStatus(
  subscription,
  payment = null,
  now = new Date()
) {

  // ----------------------------------------
  // PAYMENT UNDER REVIEW
  // ----------------------------------------

  if (
    payment &&
    payment.status === PAYMENT_STATUS.UNDER_REVIEW
  ) {

    return BILLING_STATUS.PAYMENT_UNDER_REVIEW;

  }


  // ----------------------------------------
  // PAYMENT REJECTED
  // ----------------------------------------

  if (
    payment &&
    payment.status === PAYMENT_STATUS.REJECTED
  ) {

    return BILLING_STATUS.PAYMENT_REJECTED;

  }


  // ----------------------------------------
  // PAYMENT PENDING
  // ----------------------------------------

  if (
    payment &&
    payment.status === PAYMENT_STATUS.PENDING
  ) {

    return BILLING_STATUS.PAYMENT_PENDING;

  }


  // ----------------------------------------
  // NO SUBSCRIPTION
  // ----------------------------------------

  if (!subscription) {

    return BILLING_STATUS.EXPIRED;

  }


  // ----------------------------------------
  // CANCELLED
  // ----------------------------------------

  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.CANCELLED
  ) {

    return BILLING_STATUS.CANCELLED;

  }


  // ----------------------------------------
  // SUSPENDED
  // ----------------------------------------

  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.SUSPENDED
  ) {

    return BILLING_STATUS.SUSPENDED;

  }


  // ----------------------------------------
  // ACTIVE SUBSCRIPTION
  // ----------------------------------------

  if (
    isSubscriptionActive(
      subscription,
      now
    )
  ) {

    return hasEffectiveSubscriptionAccess(
      subscription,
      now
    )
      ? BILLING_STATUS.CURRENT
      : BILLING_STATUS.EXPIRED;

  }


  // ----------------------------------------
  // PAST DUE
  // ----------------------------------------

  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.PAST_DUE
  ) {

    if (
      isWithinGracePeriod(
        subscription,
        now
      )
    ) {

      return BILLING_STATUS.GRACE_PERIOD;

    }

    return BILLING_STATUS.PAST_DUE;

  }


  // ----------------------------------------
  // EXPIRED
  // ----------------------------------------

  if (
    subscription.status ===
      SUBSCRIPTION_STATUS.EXPIRED ||
    isSubscriptionExpired(
      subscription,
      now
    )
  ) {

    return BILLING_STATUS.EXPIRED;

  }


  // ----------------------------------------
  // DEFAULT
  // ----------------------------------------

  return BILLING_STATUS.EXPIRED;

}


// ========================================
// CHECK BILLING ACCESS
// ========================================
//
// Determina si la suscripción tiene acceso
// efectivo según su estado y fechas.
//


export function hasBillingAccess(
  subscription,
  now = new Date()
) {

  if (!subscription) {

    return false;

  }

  return hasEffectiveSubscriptionAccess(
    subscription,
    now
  );

}


// ========================================
// CHECK IF PAYMENT IS REQUIRED
// ========================================

export function requiresPayment(
  subscription,
  payment = null,
  now = new Date()
) {

  if (!subscription) {

    return true;

  }


  const billingStatus =
    getBillingStatus(
      subscription,
      payment,
      now
    );


  return (
    billingStatus ===
      BILLING_STATUS.PAST_DUE ||

    billingStatus ===
      BILLING_STATUS.EXPIRED ||

    billingStatus ===
      BILLING_STATUS.PAYMENT_PENDING ||

    billingStatus ===
      BILLING_STATUS.PAYMENT_UNDER_REVIEW ||

    billingStatus ===
      BILLING_STATUS.PAYMENT_REJECTED
  );

}


// ========================================
// CHECK IF PAYMENT IS BEING PROCESSED
// ========================================

export function isPaymentBeingProcessed(
  payment
) {

  if (!payment) {

    return false;

  }

  return (
    isPaymentPending(
      payment
    ) ||

    payment.status ===
      PAYMENT_STATUS.UNDER_REVIEW
  );

}


// ========================================
// CHECK IF PAYMENT CAN ACTIVATE
// ========================================

export function canPaymentActivateSubscription(
  payment
) {

  if (!payment) {

    return false;

  }

  return isPaymentApproved(
    payment
  );

}


// ========================================
// CHECK IF PAYMENT FAILED
// ========================================

export function hasPaymentFailed(
  payment
) {

  if (!payment) {

    return false;

  }

  return (
    isPaymentRejected(
      payment
    ) ||

    isPaymentExpired(
      payment
    )
  );

}


// ========================================
// GET BILLING PLAN
// ========================================

export function getBillingPlanId(
  subscription
) {

  if (!subscription) {

    return null;

  }

  return getSubscriptionPlanId(
    subscription
  );

}


// ========================================
// GET BILLING PERIOD
// ========================================

export function getBillingPeriod(
  subscription
) {

  if (!subscription) {

    return null;

  }

  return (
    subscription.period ||
    SUBSCRIPTION_PERIOD.MONTHLY
  );

}


// ========================================
// GET NEXT BILLING DATE
// ========================================

export function getNextBillingDate(
  subscription
) {

  if (!subscription) {

    return null;

  }

  return (
    subscription.nextBillingAt ||
    subscription.currentPeriodEnd ||
    null
  );

}


// ========================================
// GET PAYMENT AMOUNT
// ========================================

export function getBillingPaymentAmount(
  payment
) {

  if (!payment) {

    return null;

  }

  return getPaymentAmount(
    payment
  );

}


// ========================================
// CHECK IF RENEWAL IS NEEDED
// ========================================

export function isRenewalNeeded(
  subscription,
  now = new Date()
) {

  if (!subscription) {

    return true;

  }


  // ----------------------------------------
  // CANCELLED
  // ----------------------------------------

  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.CANCELLED
  ) {

    return false;

  }


  // ----------------------------------------
  // SUSPENDED
  // ----------------------------------------

  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.SUSPENDED
  ) {

    return false;

  }


  // ----------------------------------------
  // EXPIRED
  // ----------------------------------------

  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.EXPIRED
  ) {

    return true;

  }


  // ----------------------------------------
  // PAST DUE
  // ----------------------------------------

  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.PAST_DUE
  ) {

    return true;

  }


  // ----------------------------------------
  // NO PERIOD END
  // ----------------------------------------

  if (
    !subscription.currentPeriodEnd
  ) {

    return false;

  }


  const periodEnd =
    toDate(
      subscription.currentPeriodEnd
    );


  if (!periodEnd) {

    return false;

  }


  return (
    now.getTime() >=
    periodEnd.getTime()
  );

}


// ========================================
// GET BILLING SUMMARY
// ========================================
//
// Devuelve un objeto normalizado para que
// Dashboard / Billing UI puedan consumirlo.
//
// NO modifica Firestore.
//


export function getBillingSummary(
  subscription,
  payment = null,
  now = new Date()
) {

  const status =
    getBillingStatus(
      subscription,
      payment,
      now
    );


  return {

    status,

    planId:
      getBillingPlanId(
        subscription
      ),

    period:
      getBillingPeriod(
        subscription
      ),

    hasAccess:
      hasBillingAccess(
        subscription,
        now
      ),

    requiresPayment:
      requiresPayment(
        subscription,
        payment,
        now
      ),

    paymentPending:
      isPaymentBeingProcessed(
        payment
      ),

    paymentApproved:
      isPaymentApproved(
        payment
      ),

    paymentFailed:
      hasPaymentFailed(
        payment
      ),

    renewalNeeded:
      isRenewalNeeded(
        subscription,
        now
      ),

    nextBillingAt:
      getNextBillingDate(
        subscription
      ),

    paymentAmount:
      getBillingPaymentAmount(
        payment
      ),

    paymentId:
      payment?.id ||
      null,

    paymentStatus:
      payment?.status ||
      null,

    rejectionReason:
      payment?.rejectionReason ||
      null

  };

}


// ========================================
// DATE NORMALIZER
// ========================================

function toDate(
  value
) {

  if (!value) {

    return null;

  }


  // ----------------------------------------
  // DATE
  // ----------------------------------------

  if (
    value instanceof Date
  ) {

    return value;

  }


  // ----------------------------------------
  // FIRESTORE TIMESTAMP
  // ----------------------------------------

  if (
    typeof value.toDate ===
    "function"
  ) {

    const date =
      value.toDate();

    return (
      date instanceof Date &&
      !Number.isNaN(
        date.getTime()
      )
    )
      ? date
      : null;

  }


  // ----------------------------------------
  // NUMBER
  // ----------------------------------------

  if (
    typeof value ===
    "number"
  ) {

    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;

  }


  // ----------------------------------------
  // STRING
  // ----------------------------------------

  if (
    typeof value ===
    "string"
  ) {

    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;

  }


  return null;

}