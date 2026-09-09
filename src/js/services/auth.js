// ========================================
// NEXUS — Firebase Authentication Service
// ========================================

import {
  createUserWithEmailAndPassword
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