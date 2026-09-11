// ========================================
// NEXUS — Account Service
// ========================================

import {
  getCurrentSession,
  refreshSession
} from "./session.js";

import {
  getEntity,
  createEntity
} from "./firestore.js";

import {
  getAccountSubscription
} from "./subscription.js";


// ========================================
// GET CURRENT ACCOUNT
// ========================================

export function getCurrentAccount() {

  const session =
    getCurrentSession();


  if (!session) {

    return null;

  }


  return {

    uid:
      session.user?.uid ||
      null,

    email:
      session.user?.email ||
      null,

    profile:
      session.profile ||
      null

  };

}


// ========================================
// GET CURRENT ACCOUNT DATA
// ========================================

export async function getCurrentAccountData() {

  const session =
    getCurrentSession();


  if (
    !session ||
    !session.user ||
    !session.user.uid
  ) {

    return null;

  }


  const account =
    await getEntity(
      "accounts",
      session.user.uid
    );


  if (!account) {

    return null;

  }


  return {

    ...account,

    uid:
      session.user.uid

  };

}


// ========================================
// GET CURRENT ACCOUNT SUBSCRIPTION
// ========================================

export async function getCurrentAccountSubscription() {

  const account =
    await getCurrentAccountData();


  if (!account) {

    return null;

  }


  if (!account.subscriptionId) {

    return null;

  }


  return await getAccountSubscription(
    account.uid,
    account.subscriptionId
  );

}


// ========================================
// CREATE CURRENT ACCOUNT
// ========================================

export async function createCurrentAccount() {

  const session =
    getCurrentSession();


  if (
    !session ||
    !session.user ||
    !session.user.uid
  ) {

    return null;

  }


  const uid =
    session.user.uid;


  const existingAccount =
    await getEntity(
      "accounts",
      uid
    );


  if (existingAccount) {

    return existingAccount;

  }


  const accountData = {

    planId:
      "free",

    accountStatus:
      "active"

  };


  await createEntity(
    "accounts",
    accountData,
    uid
  );


  return await getEntity(
    "accounts",
    uid
  );

}


// ========================================
// REFRESH ACCOUNT SESSION
// ========================================

export async function refreshAccount() {

  const session =
    await refreshSession();


  if (!session) {

    return null;

  }


  return {

    uid:
      session.user?.uid ||
      null,

    email:
      session.user?.email ||
      null,

    profile:
      session.profile ||
      null

  };

}