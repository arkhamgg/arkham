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
// Determina el estado efectivo del billing
// a partir de la suscripción y, cuando existe,
// del pago pendiente.
//

export function getBillingStatus(
  subscription,
  payment = null,
  now = new Date()
) {

  if (!subscription) {

    return BILLING_STATUS.EXPIRED;

  }


  // ========================================
  // CANCELLED
  // ========================================

  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.CANCELLED
  ) {

    return BILLING_STATUS.CANCELLED;

  }


  // ========================================
  // SUSPENDED
  // ========================================

  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.SUSPENDED
  ) {

    return BILLING_STATUS.SUSPENDED;

  }


  // ========================================
  // PAYMENT UNDER REVIEW
  // ========================================

  if (
    payment &&
    payment.status ===
    PAYMENT_STATUS.UNDER_REVIEW
  ) {

    return BILLING_STATUS.PAYMENT_UNDER_REVIEW;

  }


  // ========================================
  // PAYMENT PENDING
  // ========================================

  if (
    payment &&
    payment.status ===
    PAYMENT_STATUS.PENDING
  ) {

    return BILLING_STATUS.PAYMENT_PENDING;

  }


  // ========================================
  // ACTIVE SUBSCRIPTION
  // ========================================

  if (
    isSubscriptionActive(
      subscription
    )
  ) {

    return BILLING_STATUS.CURRENT;

  }


  // ========================================
  // PAST DUE
  // ========================================

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


  // ========================================
  // EXPIRED
  // ========================================

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


  return BILLING_STATUS.EXPIRED;

}


// ========================================
// CHECK BILLING ACCESS
// ========================================

export function hasBillingAccess(
  subscription,
  now = new Date()
) {

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
      BILLING_STATUS.PAYMENT_UNDER_REVIEW
  );

}


// ========================================
// CHECK IF PAYMENT IS BEING PROCESSED
// ========================================

export function isPaymentBeingProcessed(
  payment
) {

  return isPaymentPending(
    payment
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


  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.CANCELLED
  ) {

    return false;

  }


  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.SUSPENDED
  ) {

    return false;

  }


  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.EXPIRED
  ) {

    return true;

  }


  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.PAST_DUE
  ) {

    return true;

  }


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
    now.getTime() >
    periodEnd.getTime()
  );

}


// ========================================
// GET BILLING SUMMARY
// ========================================
//
// Esta función será especialmente útil
// para Dashboard / Billing UI.
//
// NO modifica datos.
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
      )

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


  if (
    value instanceof Date
  ) {

    return value;

  }


  if (
    typeof value.toDate ===
    "function"
  ) {

    return value.toDate();

  }


  if (
    typeof value ===
    "number"
  ) {

    const date =
      new Date(value);

    return isNaN(
      date.getTime()
    )
      ? null
      : date;

  }


  if (
    typeof value ===
    "string"
  ) {

    const date =
      new Date(value);

    return isNaN(
      date.getTime()
    )
      ? null
      : date;

  }


  return null;

}