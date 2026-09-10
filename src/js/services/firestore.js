// ========================================
// NEXUS — Firestore Service
// ========================================

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp
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