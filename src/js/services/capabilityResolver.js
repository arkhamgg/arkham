// ========================================
// ARKHAM — Capability Resolver
// ========================================
//
// Resuelve las capacidades efectivamente
// disponibles para un contexto.
//
// El resolver combina:
//
// PLAN CAPABILITIES
//        ∩
// PRODUCT CAPABILITIES
//        ∩
// ACTIVE CAPABILITIES
//
// IMPORTANTE:
//
// - No conoce cuentas.
// - No conoce usuarios.
// - No conoce suscripciones.
// - No conoce componentes.
// - No crea Access Context.
//
// Su única responsabilidad es resolver
// capacidades.
//
// ========================================


import {
  PLAN_CAPABILITIES
} from "./planCapabilities.js";

import {
  PRODUCT_CAPABILITIES
} from "./productCapabilities.js";

import {
  CAPABILITY_GLOBAL_STATUS,
  CAPABILITY_STATUS
} from "./capabilityStatus.js";


// ========================================
// RESOLVE CAPABILITIES
// ========================================
//
// Ejemplo:
//
// resolveCapabilities(
//   "pro",
//   "tournament"
// );
//
// ========================================

export function resolveCapabilities(
  planId,
  productId
) {

  if (
    !planId ||
    !productId
  ) {

    return [];

  }


  // ======================================
  // PLAN
  // ======================================

  const planCapabilities =
    PLAN_CAPABILITIES[planId];


  if (!planCapabilities) {

    return [];

  }


  const productPlanCapabilities =
    planCapabilities[productId];


  if (!productPlanCapabilities) {

    return [];

  }


  // ======================================
  // PRODUCT
  // ======================================

  const productCapabilities =
    PRODUCT_CAPABILITIES[productId];


  if (!productCapabilities) {

    return [];

  }


  const productCapabilitySet =
    new Set(
      productCapabilities
    );


  // ======================================
  // RESOLVE
  // ======================================
  //
  // Una capacidad debe cumplir:
  //
  // 1. El plan la tiene.
  // 2. El producto la soporta.
  // 3. Está globalmente activa.
  //
  // ======================================

  return productPlanCapabilities.filter(
    capability => {

      // ==================================
      // PRODUCT SUPPORT
      // ==================================

      if (
        !productCapabilitySet.has(
          capability
        )
      ) {

        return false;

      }


      // ==================================
      // GLOBAL STATUS
      // ==================================

      const capabilityStatus =
        CAPABILITY_GLOBAL_STATUS[
          capability
        ];


      return (
        capabilityStatus ===
        CAPABILITY_STATUS.ACTIVE
      );

    }
  );

}