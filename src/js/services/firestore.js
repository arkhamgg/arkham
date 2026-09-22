// ========================================
// ARKHAM — Firestore Service
// ========================================

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteField,
  serverTimestamp,
  query,
  orderBy,
  limit,
  startAfter
} from "firebase/firestore";

import { db } from "./firebase.js";


// ========================================
// CREATE ENTITY
// ========================================

export async function createEntity(
  collectionName,
  entityData,
  entityId = null
) {

  const entityRef =
    entityId
      ? doc(
          db,
          collectionName,
          entityId
        )
      : doc(
          collection(
            db,
            collectionName
          )
        );


  await setDoc(
    entityRef,
    {
      ...entityData,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()
    }
  );


  return entityRef.id;

}


// ========================================
// GET ENTITY
// ========================================

export async function getEntity(
  collectionName,
  entityId
) {

  const entityRef =
    doc(
      db,
      collectionName,
      entityId
    );


  const entitySnapshot =
    await getDoc(
      entityRef
    );


  if (!entitySnapshot.exists()) {

    return null;

  }


  return {
    id:
      entitySnapshot.id,

    ...entitySnapshot.data()

  };

}


// ========================================
// GET ENTITIES
// ========================================

// ========================================
// GET ENTITY PAGE
// ========================================
//
// Real Firestore cursor pagination.
// The cursor is the last DocumentSnapshot returned by the previous page.
// ========================================

export async function getEntityPage(
  collectionName,
  { pageSize = 24, cursor = null } = {}
) {

  const collectionRef =
    collection(
      db,
      collectionName
    );

  const constraints = [
    orderBy("createdAt", "desc"),
    limit(pageSize)
  ];

  if (cursor) {
    constraints.splice(1, 0, startAfter(cursor));
  }

  const snapshot =
    await getDocs(
      query(
        collectionRef,
        ...constraints
      )
    );

  return {
    items: snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    })),
    cursor: snapshot.docs.at(-1) || null,
    hasMore: snapshot.docs.length === pageSize
  };

}


export async function getEntities(
  collectionName
) {

  const collectionRef =
    collection(
      db,
      collectionName
    );


  const collectionSnapshot =
    await getDocs(
      collectionRef
    );


  return collectionSnapshot.docs.map(
    (document) => {

      return {
        id:
          document.id,

        ...document.data()

      };

    }
  );

}


// ========================================
// UPDATE ENTITY
// ========================================

export async function updateEntity(
  collectionName,
  entityId,
  entityData
) {

  const entityRef =
    doc(
      db,
      collectionName,
      entityId
    );


  await updateDoc(
    entityRef,
    {
      ...entityData,

      updatedAt:
        serverTimestamp()
    }
  );

}


// ========================================
// CREATE MAP ENTITY
// ========================================
//
// Ejemplo:
//
// tournaments/{tournamentId}
//
// events: {
//   {eventId}: {
//     game: "...",
//     format: "..."
//   }
// }
//
// El evento NO es un documento/subcolección.
// Es una entrada dentro del campo "events".
//
// ========================================

export async function createMapEntity(
  collectionName,
  parentId,
  mapField,
  entityData,
  entityId = null
) {

  const parentRef =
    doc(
      db,
      collectionName,
      parentId
    );


  const generatedEntityId =
    entityId ||
    doc(
      collection(
        db,
        collectionName
      )
    ).id;


  await updateDoc(
    parentRef,
    {
      [`${mapField}.${generatedEntityId}`]: {
        ...entityData,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      },

      updatedAt:
        serverTimestamp()
    }
  );


  return generatedEntityId;

}


// ========================================
// GET MAP ENTITY
// ========================================
//
// Ejemplo:
//
// getMapEntity(
//   "tournaments",
//   tournamentId,
//   "events",
//   eventId
// );
//
// ========================================

export async function getMapEntity(
  collectionName,
  parentId,
  mapField,
  entityId
) {

  const parentRef =
    doc(
      db,
      collectionName,
      parentId
    );


  const parentSnapshot =
    await getDoc(
      parentRef
    );


  if (!parentSnapshot.exists()) {

    return null;

  }


  const data =
    parentSnapshot.data();


  const map =
    data[mapField];


  if (
    !map ||
    typeof map !== "object" ||
    Array.isArray(map)
  ) {

    return null;

  }


  const entity =
    map[entityId];


  if (!entity) {

    return null;

  }


  return {
    id:
      entityId,

    ...entity

  };

}


// ========================================
// GET MAP ENTITIES
// ========================================
//
// Devuelve todas las entradas de un mapa.
//
// Ejemplo:
//
// tournaments/{tournamentId}
//     events: {
//       event1: {...},
//       event2: {...}
//     }
//
// ========================================

export async function getMapEntities(
  collectionName,
  parentId,
  mapField
) {

  const parentRef =
    doc(
      db,
      collectionName,
      parentId
    );


  const parentSnapshot =
    await getDoc(
      parentRef
    );


  if (!parentSnapshot.exists()) {

    return [];

  }


  const data =
    parentSnapshot.data();


  const map =
    data[mapField];


  if (
    !map ||
    typeof map !== "object" ||
    Array.isArray(map)
  ) {

    return [];

  }


  return Object.entries(
    map
  ).map(
    ([id, entity]) => {

      return {
        id,
        ...entity
      };

    }
  );

}




// ========================================
// SUBSCRIBE MAP ENTITY
// ========================================
//
// Escucha en tiempo real una entrada dentro
// de un map field del documento padre.
// Esto permite que las public landings reflejen
// cambios operativos del torneo sin exponer
// cuentas ni suscripciones privadas.
//
// ========================================

export function subscribeMapEntity(
  collectionName,
  parentId,
  mapField,
  entityId,
  onChange,
  onError = null
) {
  const parentRef = doc(
    db,
    collectionName,
    parentId
  );

  return onSnapshot(
    parentRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }

      const map = snapshot.data()?.[mapField] || {};
      onChange(map?.[entityId] || null);
    },
    (error) => {
      console.error(
        "ARKHAM — Error en suscripción de entidad map:",
        error
      );

      if (typeof onError === "function") {
        onError(error);
      }
    }
  );
}


// ========================================
// UPDATE MAP ENTITY
// ========================================
//
// Actualiza únicamente una entrada
// dentro del mapa.
//
// No sobrescribe los demás eventos.
//
// ========================================

export async function updateMapEntity(
  collectionName,
  parentId,
  mapField,
  entityId,
  entityData
) {

  const parentRef =
    doc(
      db,
      collectionName,
      parentId
    );


  const updates = {};


  Object.entries(
    entityData
  ).forEach(
    ([field, value]) => {

      updates[
        `${mapField}.${entityId}.${field}`
      ] = value;

    }
  );


  updates[
    `${mapField}.${entityId}.updatedAt`
  ] =
    serverTimestamp();


  updates.updatedAt =
    serverTimestamp();


  await updateDoc(
    parentRef,
    updates
  );

}

// ========================================
// DELETE MAP ENTITY
// ========================================
//
// Elimina únicamente una entrada dentro
// de un mapa, sin borrar el documento padre.
//
// Ejemplo:
// tournaments/{tournamentId}.events.{eventId}
//
// ========================================

export async function deleteMapEntity(
  collectionName,
  parentId,
  mapField,
  entityId
) {

  const parentRef =
    doc(
      db,
      collectionName,
      parentId
    );


  await updateDoc(
    parentRef,
    {
      [`${mapField}.${entityId}`]:
        deleteField(),

      updatedAt:
        serverTimestamp()
    }
  );

}

