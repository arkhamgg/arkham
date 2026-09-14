// ========================================
// NEXUS — Admin Billing Payment Service
// ========================================

import {
  getAuth
} from "firebase/auth";


// ========================================
// API
// ========================================

const ADMIN_BILLING_PAYMENTS_API =
  "/api/admin-billing-payments";

const ADMIN_BILLING_PAYMENT_APPROVE_API =
  "/api/admin-billing-payment-approve";

const ADMIN_BILLING_PAYMENT_REJECT_API =
  "/api/admin-billing-payment-reject";


// ========================================
// AUTH TOKEN
// ========================================

async function getFirebaseIdToken() {

  const auth =
    getAuth();

  const user =
    auth.currentUser;

  if (!user) {

    throw new Error(
      "Debes iniciar sesión para realizar esta operación."
    );

  }

  return await user.getIdToken();

}


// ========================================
// API REQUEST
// ========================================

async function apiRequest(
  url,
  options = {}
) {

  const token =
    await getFirebaseIdToken();

  const response =
    await fetch(
      url,
      {
        ...options,

        headers: {

          Accept:
            "application/json",

          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`,

          ...(options.headers || {})

        }

      }
    );

  let data =
    null;

  try {

    data =
      await response.json();

  } catch {

    data =
      null;

  }

  if (!response.ok) {

    throw new Error(
      data?.error ||
      "La solicitud administrativa no pudo completarse."
    );

  }

  if (
    data?.success === false
  ) {

    throw new Error(
      data.error ||
      "La solicitud administrativa no pudo completarse."
    );

  }

  return data;

}


// ========================================
// GET PAYMENTS
// ========================================

export async function getAdminBillingPayments() {

  return await apiRequest(
    ADMIN_BILLING_PAYMENTS_API,
    {
      method:
        "GET"
    }
  );

}


// ========================================
// APPROVE PAYMENT
// ========================================

export async function approveAdminBillingPayment(
  paymentId
) {

  if (!paymentId) {

    throw new Error(
      "paymentId es obligatorio."
    );

  }

  return await apiRequest(
    ADMIN_BILLING_PAYMENT_APPROVE_API,
    {
      method:
        "POST",

      body:
        JSON.stringify({
          paymentId
        })

    }
  );

}


// ========================================
// REJECT PAYMENT
// ========================================

export async function rejectAdminBillingPayment(
  paymentId,
  reason
) {

  if (!paymentId) {

    throw new Error(
      "paymentId es obligatorio."
    );

  }

  if (
    !reason ||
    !String(reason).trim()
  ) {

    throw new Error(
      "Debes indicar el motivo del rechazo."
    );

  }

  return await apiRequest(
    ADMIN_BILLING_PAYMENT_REJECT_API,
    {
      method:
        "POST",

      body:
        JSON.stringify({

          paymentId,

          reason:
            String(reason).trim()

        })

    }
  );

}
