// ========================================
// NEXUS — Firestore Service
// ========================================

import {
  collection,
  doc,
  setDoc,
  getDoc,
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