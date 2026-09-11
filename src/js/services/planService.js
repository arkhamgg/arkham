// ========================================
// NEXUS — Plan Service
// ========================================

import {
  PLANS
} from "./plans.js";

import {
  createAccessContext
} from "./access.js";


// ========================================
// GET PLAN
// ========================================

export function getPlan(
  planId
) {

  if (!planId) {

    return null;

  }


  return PLANS[planId] || null;

}


// ========================================
// GET PLAN CAPABILITIES
// ========================================

export function getPlanCapabilities(
  planId
) {

  const plan =
    getPlan(planId);


  if (!plan) {

    return [];

  }


  return [
    ...plan.capabilities
  ];

}


// ========================================
// CREATE PLAN ACCESS
// ========================================

export function createPlanAccess(
  planId
) {

  const capabilities =
    getPlanCapabilities(
      planId
    );


  return createAccessContext(
    capabilities
  );

}


// ========================================
// GET SUBSCRIPTION ACCESS
// ========================================

export function createSubscriptionAccess(
  subscription
) {

  if (
    !subscription ||
    subscription.status !== "active"
  ) {

    return createAccessContext([]);

  }


  return createPlanAccess(
    subscription.planId
  );

}