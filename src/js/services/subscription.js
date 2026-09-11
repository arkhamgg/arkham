// ========================================
// NEXUS — Subscription Service
// ========================================

import {
  createEntity,
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

  EXPIRED:
    "expired",

  CANCELLED:
    "cancelled",

  SUSPENDED:
    "suspended"

};


// ========================================
// CREATE SUBSCRIPTION DATA
// ========================================

export function createSubscription(
  planId,
  status = SUBSCRIPTION_STATUS.ACTIVE
) {

  return {

    planId,

    status,

    createdAt:
      null,

    activatedAt:
      null,

    expiresAt:
      null

  };

}


// ========================================
// CREATE PERSISTENT SUBSCRIPTION
// ========================================

export async function createPersistentSubscription(
  accountId,
  planId,
  status = SUBSCRIPTION_STATUS.ACTIVE
) {

  if (!accountId) {

    return null;

  }


  if (!planId) {

    return null;

  }


  const subscriptionData =
    createSubscription(
      planId,
      status
    );


  const subscriptionId =
    await createEntity(
      "subscriptions",
      {
        accountId,
        ...subscriptionData
      }
    );


  return await getEntity(
    "subscriptions",
    subscriptionId
  );

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