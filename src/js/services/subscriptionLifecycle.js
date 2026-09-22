// ========================================
// ARKHAM — Subscription Lifecycle
// ========================================

import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PERIOD
} from "./subscription.js";


// ========================================
// ACTIVATE SUBSCRIPTION DATA
// ========================================

export function buildActivationData(
  subscription,
  now = new Date()
) {

  const currentPeriodStart =
    now;

  const currentPeriodEnd =
    calculatePeriodEnd(
      currentPeriodStart,
      subscription?.period
    );


  return {

    status:
      SUBSCRIPTION_STATUS.ACTIVE,

    activatedAt:
      subscription?.activatedAt ||
      now,

    currentPeriodStart,

    currentPeriodEnd,

    nextBillingAt:
      currentPeriodEnd,

    paymentDeadline:
      null,

    suspendedAt:
      null,

    expiredAt:
      null,

    updatedAt:
      now

  };

}


// ========================================
// RENEW SUBSCRIPTION DATA
// ========================================

export function buildRenewalData(
  subscription,
  now = new Date()
) {

  const periodStart =
    getRenewalStart(
      subscription,
      now
    );


  const periodEnd =
    calculatePeriodEnd(
      periodStart,
      subscription?.period
    );


  return {

    status:
      SUBSCRIPTION_STATUS.ACTIVE,

    currentPeriodStart:
      periodStart,

    currentPeriodEnd:
      periodEnd,

    nextBillingAt:
      periodEnd,

    paymentDeadline:
      null,

    suspendedAt:
      null,

    expiredAt:
      null,

    updatedAt:
      now

  };

}


// ========================================
// DETERMINE ACTIVATION VS RENEWAL
// ========================================

export function getSubscriptionLifecycleAction(
  subscription
) {

  if (!subscription) {

    return null;

  }


  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.PENDING
  ) {

    return "activate";

  }


  if (
    subscription.status ===
      SUBSCRIPTION_STATUS.ACTIVE ||

    subscription.status ===
      SUBSCRIPTION_STATUS.PAST_DUE ||

    subscription.status ===
      SUBSCRIPTION_STATUS.EXPIRED
  ) {

    return "renew";

  }


  return null;

}


// ========================================
// GET RENEWAL START
// ========================================

function getRenewalStart(
  subscription,
  now
) {

  const currentPeriodEnd =
    toDate(
      subscription?.currentPeriodEnd
    );


  // ========================================
  // FUTURE PERIOD
  // ========================================
  //
  // Se todavía existe un período activo,
  // la renovación empieza después del período
  // actual.
  //

  if (
    currentPeriodEnd &&
    currentPeriodEnd.getTime() >
      now.getTime()
  ) {

    return currentPeriodEnd;

  }


  // ========================================
  // EXPIRED / PAST DUE
  // ========================================
  //
  // Si el período ya terminó, no creamos
  // tiempo solapado.
  //

  return now;

}


// ========================================
// CALCULATE PERIOD END
// ========================================

export function calculatePeriodEnd(
  startDate,
  period =
    SUBSCRIPTION_PERIOD.MONTHLY
) {

  const endDate =
    new Date(
      startDate
    );


  if (
    period ===
    SUBSCRIPTION_PERIOD.YEARLY
  ) {

    endDate.setFullYear(
      endDate.getFullYear() + 1
    );

    return endDate;

  }


  // ========================================
  // DEFAULT = MONTHLY
  // ========================================

  endDate.setMonth(
    endDate.getMonth() + 1
  );


  return endDate;

}


// ========================================
// CHECK INITIAL ACTIVATION
// ========================================

export function isInitialActivation(
  subscription
) {

  if (!subscription) {

    return false;

  }


  return (
    subscription.status ===
    SUBSCRIPTION_STATUS.PENDING
  );

}


// ========================================
// CHECK RENEWAL
// ========================================

export function isRenewal(
  subscription
) {

  if (!subscription) {

    return false;

  }


  return (
    subscription.status ===
      SUBSCRIPTION_STATUS.ACTIVE ||

    subscription.status ===
      SUBSCRIPTION_STATUS.PAST_DUE ||

    subscription.status ===
      SUBSCRIPTION_STATUS.EXPIRED
  );

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