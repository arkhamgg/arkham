// ========================================
// ARKHAM — Payment State Machine
// ========================================

import {
  PAYMENT_STATUS
} from "./payment.js";


// ========================================
// VALID PAYMENT TRANSITIONS
// ========================================

export const PAYMENT_TRANSITIONS = {

  [PAYMENT_STATUS.PENDING]: [

    PAYMENT_STATUS.UNDER_REVIEW,

    PAYMENT_STATUS.EXPIRED,

    PAYMENT_STATUS.REJECTED

  ],


  [PAYMENT_STATUS.UNDER_REVIEW]: [

    PAYMENT_STATUS.APPROVED,

    PAYMENT_STATUS.REJECTED

  ],


  [PAYMENT_STATUS.APPROVED]: [],


  [PAYMENT_STATUS.REJECTED]: [],


  [PAYMENT_STATUS.EXPIRED]: []

};


// ========================================
// CHECK VALID TRANSITION
// ========================================

export function canTransitionPayment(
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
    PAYMENT_TRANSITIONS[
      currentStatus
    ] || [];


  return allowedTransitions.includes(
    nextStatus
  );

}


// ========================================
// GET AVAILABLE TRANSITIONS
// ========================================

export function getPaymentTransitions(
  currentStatus
) {

  if (!currentStatus) {

    return [];

  }


  return [
    ...(PAYMENT_TRANSITIONS[
      currentStatus
    ] || [])
  ];

}


// ========================================
// CHECK FINAL PAYMENT STATE
// ========================================

export function isFinalPaymentState(
  status
) {

  return (
    status ===
      PAYMENT_STATUS.APPROVED ||

    status ===
      PAYMENT_STATUS.REJECTED ||

    status ===
      PAYMENT_STATUS.EXPIRED
  );

}