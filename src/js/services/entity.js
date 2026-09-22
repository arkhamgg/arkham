// ========================================
// ARKHAM — Entity Service
// ========================================

import {
  getCurrentSession
} from "./session.js";

import {
  getEntity
} from "./firestore.js";


// ========================================
// GET CURRENT ENTITY REFERENCE
// ========================================

export function getCurrentEntityReference() {

  const session =
    getCurrentSession();


  if (!session?.profile) {

    return null;

  }


  const {
    entityType,
    entityId
  } =
    session.profile;


  if (!entityType || !entityId) {

    return null;

  }


  return {

    type:
      entityType,

    id:
      entityId

  };

}


// ========================================
// GET CURRENT ENTITY
// ========================================

export async function getCurrentEntity() {

  const reference =
    getCurrentEntityReference();


  if (!reference) {

    return null;

  }


  const collectionMap = {

    player:
      "players",

    team:
      "teams",

    league:
      "leagues",

    tournament:
      "tournaments"

  };


  const collectionName =
    collectionMap[reference.type];


  if (!collectionName) {

    console.error(
      "ARKHAM — Tipo de entidad no soportado:",
      reference.type
    );

    return null;

  }


  const entity =
    await getEntity(
      collectionName,
      reference.id
    );


  if (!entity) {

    console.warn(
      "ARKHAM — Entidad no encontrada:",
      reference
    );

    return null;

  }


  return {

    ...entity,

    type:
      reference.type

  };

}
// ========================================
