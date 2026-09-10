// ========================================
// NEXUS — Firebase Authentication Service
// ========================================

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

import { auth } from "./firebase.js";


// ========================================
// CREATE ACCOUNT
// ========================================

export async function createAccount(
  email,
  password
) {

  const userCredential =
    await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

  return userCredential.user;

}


// ========================================
// LOGIN
// ========================================

export async function login(
  email,
  password
) {

  const userCredential =
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  return userCredential.user;

}


// ========================================
// AUTH STATE
// ========================================

export function observeAuthState(
  callback
) {

  return onAuthStateChanged(
    auth,
    callback
  );

}


// ========================================
// SIGN OUT
// ========================================

export async function logout() {

  await signOut(
    auth
  );

}