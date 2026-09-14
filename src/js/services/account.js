// ========================================
// NEXUS — Account Service
// ========================================

import {
  auth
} from "./firebase.js";

import {
  getCurrentSession,
  refreshSession
} from "./session.js";

import {
  getEntity
} from "./firestore.js";

import {
  getAccountSubscription
} from "./subscription.js";

import {
  getCurrentAccountPayment
} from "./billingPayment.js";


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
// GET CURRENT ACCOUNT CONTEXT
// ========================================

export async function getCurrentAccountContext(
  options = {}
) {

  const account =
    await getCurrentAccountData();


  if (!account) {

    return null;

  }


  let subscription =
    null;


  if (account.subscriptionId) {

    subscription =
      await getAccountSubscription(
        account.uid,
        account.subscriptionId
      );

  }


  let payment =
    null;


  if (options.includePayment) {

    try {

      const paymentResponse =
        await getCurrentAccountPayment();

      payment =
        paymentResponse?.payment ||
        null;

    } catch (error) {

      console.warn(
        "NEXUS — No fue posible obtener el último pago de la cuenta.",
        error
      );

    }

  }


  return {

    account,

    subscription,

    payment

  };

}


// ========================================
// PROVISION CURRENT ACCOUNT
// ========================================

export async function provisionCurrentAccount() {

  const user =
    auth.currentUser;


  if (!user) {

    throw new Error(
      "No hay un usuario autenticado para provisionar la cuenta."
    );

  }


  const idToken =
    await user.getIdToken();


  const response =
    await fetch(
      "/api/account-provision",
      {
        method:
          "POST",

        headers: {

          Authorization:
            `Bearer ${idToken}`,

          "Content-Type":
            "application/json"

        }

      }
    );


  const contentType =
    response.headers.get(
      "content-type"
    ) || "";


  const responseBody =
    contentType.includes("application/json")
      ? await response.json()
      : await response.text();


  if (!response.ok) {

    const message =
      typeof responseBody === "string"
        ? responseBody
        : responseBody?.error;


    throw new Error(
      message ||
      "No fue posible provisionar la cuenta."
    );

  }


  if (
    typeof responseBody !== "object" ||
    responseBody === null
  ) {

    throw new Error(
      "El servidor devolvió una respuesta inesperada."
    );

  }


  return responseBody;

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