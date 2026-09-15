// ========================================
// NEXUS — Subscription Service
// ========================================

import {
  getEntity
} from "./firestore.js";


// ========================================
// SUBSCRIPTION STATUS
// ========================================

export const SUBSCRIPTION_STATUS = {

  ACTIVE:
    "active",

  PENDING:
    "pending",

  PAST_DUE:
    "past_due",

  SUSPENDED:
    "suspended",

  CANCELLED:
    "cancelled",

  EXPIRED:
    "expired"

};


// ========================================
// SUBSCRIPTION PERIOD
// ========================================

export const SUBSCRIPTION_PERIOD = {

  MONTHLY:
    "monthly",

  YEARLY:
    "yearly"

};


// ========================================
// CREATE SUBSCRIPTION DATA
// ========================================

export function createSubscription(
  planId,
  options = {}
) {

  const {

    accountId = null,

    status =
      SUBSCRIPTION_STATUS.ACTIVE,

    period =
      SUBSCRIPTION_PERIOD.MONTHLY,

    currency =
      "GTQ",

    billingDate =
      null,

    paymentDeadline =
      null,

    currentPeriodStart =
      null,

    currentPeriodEnd =
      null,

    nextBillingAt =
      null,

    gracePeriodDays =
      0

  } = options;


  return {

    // ========================================
    // IDENTITY
    // ========================================

    accountId,

    planId,


    // ========================================
    // STATUS
    // ========================================

    status,


    // ========================================
    // BILLING CONFIGURATION
    // ========================================

    period,

    currency,

    billingDate,

    paymentDeadline,

    gracePeriodDays,


    // ========================================
    // CURRENT BILLING PERIOD
    // ========================================

    currentPeriodStart,

    currentPeriodEnd,

    nextBillingAt,


    // ========================================
    // LIFECYCLE
    // ========================================

    createdAt:
      null,

    activatedAt:
      null,

    cancelledAt:
      null,

    suspendedAt:
      null,

    expiredAt:
      null

  };

}


// ========================================
// GET SUBSCRIPTION
// ========================================

export async function getSubscription(
  subscriptionId
) {

  if (!subscriptionId) {

    return null;

  }


  return await getEntity(
    "subscriptions",
    subscriptionId
  );

}


// ========================================
// GET ACCOUNT SUBSCRIPTION
// ========================================

export async function getAccountSubscription(
  accountId,
  subscriptionId
) {

  if (
    !accountId ||
    !subscriptionId
  ) {

    return null;

  }


  const subscription =
    await getEntity(
      "subscriptions",
      subscriptionId
    );


  if (!subscription) {

    return null;

  }


  if (
    subscription.accountId !==
    accountId
  ) {

    console.error(
      "NEXUS — La suscripción no pertenece a la cuenta."
    );

    return null;

  }


  return subscription;

}


// ========================================
// CHECK ACTIVE SUBSCRIPTION
// ========================================

export function isSubscriptionActive(
  subscription
) {

  if (!subscription) {

    return false;

  }


  return (
    subscription.status ===
    SUBSCRIPTION_STATUS.ACTIVE
  );

}


// ========================================
// CHECK BILLING ACCESS
// ========================================
//
// ACTIVE
// → acceso normal
//
// PAST_DUE
// → puede existir acceso durante
//   grace period
//
// PENDING
// → depende del flujo de activación
//
// SUSPENDED / CANCELLED / EXPIRED
// → sin acceso operativo
//

export function hasSubscriptionAccess(
  subscription
) {

  if (!subscription) {

    return false;

  }


  return (
    subscription.status ===
      SUBSCRIPTION_STATUS.ACTIVE ||

    subscription.status ===
      SUBSCRIPTION_STATUS.PAST_DUE
  );

}


// ========================================
// CHECK GRACE PERIOD
// ========================================

export function isWithinGracePeriod(
  subscription,
  now = new Date()
) {

  if (!subscription) {

    return false;

  }


  if (
    subscription.status !==
    SUBSCRIPTION_STATUS.PAST_DUE
  ) {

    return false;

  }


  if (
    !subscription.paymentDeadline
  ) {

    return false;

  }


  const deadline =
    toDate(
      subscription.paymentDeadline
    );


  if (!deadline) {

    return false;

  }


  return (
    now.getTime() <=
    deadline.getTime()
  );

}


// ========================================
// CHECK SUBSCRIPTION EXPIRED
// ========================================

export function isSubscriptionExpired(
  subscription,
  now = new Date()
) {

  if (!subscription) {

    return true;

  }


  if (
    subscription.status ===
      SUBSCRIPTION_STATUS.EXPIRED ||

    subscription.status ===
      SUBSCRIPTION_STATUS.CANCELLED
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
// CHECK EFFECTIVE ACCESS
// ========================================
//
// Esta función NO modifica Firestore.
// Solamente determina si la suscripción
// puede considerarse vigente para acceso.
//
// La decisión final de capacidades seguirá
// pasando por capabilityResolver.
//

export function hasEffectiveSubscriptionAccess(
  subscription,
  now = new Date()
) {

  if (!subscription) {

    return false;

  }


  // ACTIVE solo concede acceso mientras el período
  // facturado siga vigente. El estado persistido no
  // sustituye la comprobación temporal.
  if (
    isSubscriptionActive(
      subscription
    )
  ) {

    return isPeriodCurrentlyValid(
      subscription,
      now
    );

  }


  if (
    subscription.status ===
    SUBSCRIPTION_STATUS.PAST_DUE
  ) {

    // Nunca extenderemos el entitlement más allá del
    // período originalmente pagado. Si existe una
    // gracia administrativa, debe terminar como máximo
    // al finalizar currentPeriodEnd.
    if (!isPeriodCurrentlyValid(subscription, now)) {
      return false;
    }

    return isWithinGracePeriod(
      subscription,
      now
    );

  }


  return false;

}




// ========================================
// CHECK CURRENT BILLING PERIOD
// ========================================

export function isPeriodCurrentlyValid(
  subscription,
  now = new Date()
) {

  if (!subscription) {
    return false;
  }

  const periodEnd = toDate(
    subscription.currentPeriodEnd
  );

  // Legacy/initial records without an end date
  // preserve the previous behavior. New active
  // subscriptions always receive currentPeriodEnd.
  if (!periodEnd) {
    return true;
  }

  return now.getTime() < periodEnd.getTime();

}

// ========================================
// GET SUBSCRIPTION PLAN
// ========================================

export function getSubscriptionPlanId(
  subscription
) {

  if (!subscription) {

    return null;

  }


  return subscription.planId ||
    null;

}


// ========================================
// GET SUBSCRIPTION STATUS
// ========================================

export function getSubscriptionStatus(
  subscription
) {

  if (!subscription) {

    return null;

  }


  return subscription.status ||
    null;

}


// ========================================
// GET SUBSCRIPTION PERIOD
// ========================================

export function getSubscriptionPeriod(
  subscription
) {

  if (!subscription) {

    return null;

  }


  return subscription.period ||
    null;

}


// ========================================
// DATE NORMALIZER
// ========================================
//
// Firebase puede devolver:
//
// - Date
// - Firestore Timestamp
// - string
// - number
//
// Normalizamos para que los helpers
// trabajen de forma consistente.
//

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