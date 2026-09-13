// ========================================
// NEXUS — Entity Context Service
// ========================================

import {
  getCurrentSession
} from "./session.js";

import {
  getEntity
} from "./firestore.js";

import {
  PRODUCT_IDS
} from "./products.js";


// ========================================
// ENTITY PRODUCT MAP
// ========================================
//
// Relaciona el tipo de entidad de la sesión
// con el Product correspondiente de NEXUS.
//
// IMPORTANTE:
//
// entityType identifica la entidad actual.
// productId identifica el producto NEXUS.
//
// No define planes.
// No define capacidades.
// No define permisos.
//

const ENTITY_PRODUCTS = {

  player:
    PRODUCT_IDS.PLAYER,

  team:
    PRODUCT_IDS.TEAM,

  league:
    PRODUCT_IDS.LEAGUE,

  tournament:
    PRODUCT_IDS.TOURNAMENT

};


// ========================================
// ENTITY COLLECTION MAP
// ========================================

const ENTITY_COLLECTIONS = {

  player:
    "players",

  team:
    "teams",

  league:
    "leagues",

  tournament:
    "tournaments"

};


// ========================================
// GET CURRENT ENTITY CONTEXT
// ========================================

export async function getCurrentEntityContext() {

  const session =
    getCurrentSession();


  // ======================================
  // NO SESSION
  // ======================================

  if (
    !session ||
    !session.profile
  ) {

    return null;

  }


  const {
    entityType,
    entityId
  } =
    session.profile;


  // ======================================
  // INVALID ENTITY PROFILE
  // ======================================

  if (
    !entityType ||
    !entityId
  ) {

    return null;

  }


  // ======================================
  // GET PRODUCT
  // ======================================

  const productId =
    ENTITY_PRODUCTS[
      entityType
    ];


  if (!productId) {

    console.error(
      "NEXUS — Producto de entidad no soportado:",
      entityType
    );

    return null;

  }


  // ======================================
  // GET COLLECTION
  // ======================================

  const collection =
    ENTITY_COLLECTIONS[
      entityType
    ];


  if (!collection) {

    console.error(
      "NEXUS — Tipo de entidad no soportado:",
      entityType
    );

    return null;

  }


  // ======================================
  // GET ENTITY
  // ======================================

  const entity =
    await getEntity(
      collection,
      entityId
    );


  if (!entity) {

    console.error(
      "NEXUS — Entidad no encontrada:",
      {
        entityType,
        entityId,
        collection
      }
    );

    return null;

  }


  // ======================================
  // RETURN CONTEXT
  // ========================================

  return {

    type:
      entityType,

    productId,

    id:
      entityId,

    collection,

    entity

  };

}