// ========================================
// NEXUS — Subscription State Machine
// ========================================

import {
  SUBSCRIPTION_STATUS
} from "./subscription.js";


// ========================================
// VALID SUBSCRIPTION TRANSITIONS
// ========================================
//
// Cada estado define explícitamente hacia
// qué estados puede avanzar.
//
// La transición real deberá ser validada
// posteriormente en backend.
//

export const SUBSCRIPTION_TRANSITIONS = {

  [SUBSCRIPTION_STATUS.PENDING]: [

    SUBSCRIPTION_STATUS.ACTIVE,

    SUBSCRIPTION_STATUS.CANCELLED,

    SUBSCRIPTION_STATUS.EXPIRED

  ],


  [SUBSCRIPTION_STATUS.ACTIVE]: [

    SUBSCRIPTION_STATUS.PAST_DUE,

    SUBSCRIPTION_STATUS.SUSPENDED,

    SUBSCRIPTION_STATUS.CANCELLED,

    SUBSCRIPTION_STATUS.EXPIRED

  ],


  [SUBSCRIPTION_STATUS.PAST_DUE]: [

    SUBSCRIPTION_STATUS.ACTIVE,

    SUBSCRIPTION_STATUS.SUSPENDED,

    SUBSCRIPTION_STATUS.EXPIRED,

    SUBSCRIPTION_STATUS.CANCELLED

  ],


  [SUBSCRIPTION_STATUS.SUSPENDED]: [

    SUBSCRIPTION_STATUS.ACTIVE,

    SUBSCRIPTION_STATUS.CANCELLED,

    SUBSCRIPTION_STATUS.EXPIRED

  ],


  [SUBSCRIPTION_STATUS.CANCELLED]: [

    SUBSCRIPTION_STATUS.PENDING

  ],


  [SUBSCRIPTION_STATUS.EXPIRED]: [

    SUBSCRIPTION_STATUS.PENDING

  ]

};


// ========================================
// CHECK VALID TRANSITION
// ========================================

export function canTransitionSubscription(
  currentStatus,
  nextStatus
) {

  if (
    !currentStatus ||
    !nextStatus
  ) {

    return false;

  }


  if (
    currentStatus ===
    nextStatus
  ) {

    return true;

  }


  const allowedTransitions =
    SUBSCRIPTION_TRANSITIONS[
      currentStatus
    ] || [];


  return allowedTransitions.includes(
    nextStatus
  );

}


// ========================================
// GET AVAILABLE TRANSITIONS
// ========================================

export function getSubscriptionTransitions(
  currentStatus
) {

  if (!currentStatus) {

    return [];

  }


  return [
    ...(SUBSCRIPTION_TRANSITIONS[
      currentStatus
    ] || [])
  ];

}


// ========================================
// CHECK FINAL STATE
// ========================================

export function isFinalSubscriptionState(
  status
) {

  return (
    status ===
      SUBSCRIPTION_STATUS.CANCELLED
  );

}


// ========================================
// CHECK BILLING BLOCKED STATE
// ========================================

export function isSubscriptionBlocked(
  status
) {

  return (
    status ===
      SUBSCRIPTION_STATUS.SUSPENDED ||

    status ===
      SUBSCRIPTION_STATUS.EXPIRED ||

    status ===
      SUBSCRIPTION_STATUS.CANCELLED
  );

}