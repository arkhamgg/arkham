// ========================================
// NEXUS — Plan Service
// ========================================
//
// Gestiona la relación entre:
//
// SUBSCRIPTION
//      ↓
// PLAN
//      ↓
// PRODUCT
//      ↓
// CAPABILITY RESOLVER
//      ↓
// ACCESS CONTEXT
//
// IMPORTANTE:
//
// El Plan Service NO resuelve directamente
// las capacidades.
//
// Esa responsabilidad pertenece a:
//
// capabilityResolver.js
//
// ========================================


import {
  PLANS
} from "./plans.js";

import {
  resolveCapabilities
} from "./capabilityResolver.js";

import {
  createAccessContext
} from "./access.js";

import {
  hasEffectiveSubscriptionAccess
} from "./subscription.js";


// ========================================
// GET PLAN
// ========================================
//
// Devuelve la información del plan.
//
// Ejemplo:
//
// getPlan("pro");
//
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
//
// Devuelve las capacidades efectivamente
// disponibles para un PLAN dentro de un
// PRODUCTO.
//
// La resolución pertenece al
// Capability Resolver.
//
// ========================================

export function getPlanCapabilities(
  planId,
  productId
) {

  return resolveCapabilities(
    planId,
    productId
  );

}


// ========================================
// CHECK PRODUCT AVAILABILITY
// ========================================
//
// Comprueba si un PLAN tiene capacidades
// disponibles dentro de un PRODUCTO.
//
// ========================================

export function hasProductAccess(
  planId,
  productId
) {

  return (
    getPlanCapabilities(
      planId,
      productId
    ).length > 0
  );

}


// ========================================
// CREATE PLAN ACCESS
// ========================================
//
// Crea un Access Context utilizando:
//
// PLAN
// +
// PRODUCT
//
// ========================================

export function createPlanAccess(
  planId,
  productId
) {

  const capabilities =
    getPlanCapabilities(
      planId,
      productId
    );


  return createAccessContext(
    capabilities
  );

}


// ========================================
// CREATE SUBSCRIPTION ACCESS
// ========================================
//
// Crea un Access Context utilizando:
//
// SUBSCRIPTION
// +
// PRODUCT
//
// Solo una suscripción activa puede
// conceder capacidades.
//
// ========================================

export function createSubscriptionAccess(
  subscription,
  productId
) {

  if (
    !hasEffectiveSubscriptionAccess(
      subscription
    )
  ) {

    return createAccessContext([]);

  }


  return createPlanAccess(
    subscription.planId,
    productId
  );

}