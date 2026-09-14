// ========================================
// NEXUS — Billing Payment Service
// ========================================

import {
  uploadPaymentProof
} from "./imagekit.js";


// ========================================
// API
// ========================================

const BILLING_PAYMENT_API =
  "/api/billing?resource=payment";

const BILLING_PAYMENT_PROOF_API =
  "/api/billing?resource=proof";

const BILLING_PAYMENT_SUBMIT_API =
  "/api/billing?resource=submit";


// ========================================
// FIREBASE AUTH
// ========================================

async function getFirebaseIdToken() {

  const {
    getAuth
  } = await import(
    "firebase/auth"
  );


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
      "La solicitud no pudo completarse."
    );

  }


  if (
    data &&
    data.success === false
  ) {

    throw new Error(
      data.error ||
      "La solicitud no pudo completarse."
    );

  }


  return data;

}


// ========================================
// GET CURRENT ACCOUNT PAYMENT
// ========================================

export async function getCurrentAccountPayment() {

  return await apiRequest(
    BILLING_PAYMENT_API,
    {
      method: "GET"
    }
  );

}


// ========================================
// CREATE BILLING PAYMENT
// ========================================
//
// Crea el registro inicial del pago.
//
// El backend determina:
//
// - amount
// - currency
// - currentPlanId
// - transición permitida
//
// El frontend solamente solicita
// la operación.
//
// Estado inicial:
//
// PENDING
//
// IMPORTANTE:
//
// Free → Pro:
// subscriptionId puede ser null.
//
// Pro → Pro:
// subscriptionId es requerido.
//

export async function createBillingPayment(
  options = {}
) {

  const {

    subscriptionId =
      null,

    planId =
      null,

    period =
      "monthly",

    method =
      null,

    paymentDate =
      null,

    paymentTime =
      null,

    reference =
      null

  } = options;


  // ======================================
  // VALIDATION
  // ======================================

  if (!planId) {

    throw new Error(
      "planId es obligatorio."
    );

  }


  if (!method) {

    throw new Error(
      "El método de pago es obligatorio."
    );

  }


  if (!paymentDate) {

    throw new Error(
      "La fecha de pago es obligatoria."
    );

  }


  // ======================================
  // CREATE PAYMENT
  // ======================================

  return await apiRequest(
    BILLING_PAYMENT_API,
    {
      method:
        "POST",

      body:
        JSON.stringify({

          subscriptionId,

          planId,

          period,

          method,

          paymentDate,

          paymentTime,

          reference

        })

    }
  );

}


// ========================================
// UPLOAD BILLING PAYMENT PROOF
// ========================================
//
// Flujo:
//
// File
// ↓
// ImageKit
// ↓
// /api/billing-payment-proof
// ↓
// Firestore
//
// El pago permanece en PENDING.
//

export async function uploadBillingPaymentProof(
  file,
  paymentId,
  uid = null
) {

  // ======================================
  // VALIDATE FILE
  // ======================================

  if (!file) {

    throw new Error(
      "Debes seleccionar un comprobante de pago."
    );

  }


  // ======================================
  // VALIDATE PAYMENT
  // ======================================

  if (!paymentId) {

    throw new Error(
      "paymentId es obligatorio."
    );

  }


  // ======================================
  // CURRENT USER
  // ======================================

  const {
    getAuth
  } = await import(
    "firebase/auth"
  );


  const auth =
    getAuth();


  const user =
    auth.currentUser;


  if (!user) {

    throw new Error(
      "Debes iniciar sesión para subir el comprobante."
    );

  }


  const authenticatedUid =
    user.uid;


  // ======================================
  // UID
  // ======================================
  //
  // Si se recibe uid, debe coincidir
  // con el usuario autenticado.
  //

  if (
    uid &&
    uid !== authenticatedUid
  ) {

    throw new Error(
      "El usuario del comprobante no coincide con la sesión actual."
    );

  }


  const proofUid =
    authenticatedUid;


  // ======================================
  // UPLOAD TO IMAGEKIT
  // ======================================

  const proof =
    await uploadPaymentProof(
      file,
      proofUid,
      paymentId
    );


  // ======================================
  // ATTACH PROOF TO PAYMENT
  // ======================================

  const response =
    await apiRequest(
      BILLING_PAYMENT_PROOF_API,
      {
        method:
          "POST",

        body:
          JSON.stringify({

            paymentId,

            proof

          })

      }
    );


  // ======================================
  // RESULT
  // ======================================

  return {

    ...response,

    proof

  };

}


// ========================================
// SUBMIT BILLING PAYMENT
// ========================================
//
// Envía un pago con comprobante
// a revisión administrativa.
//
// Flujo:
//
// PENDING
// ↓
// submit
// ↓
// UNDER_REVIEW
//
// Esta función NO aprueba el pago.
//
// La aprobación pertenece exclusivamente
// al backend administrativo.
//

export async function submitBillingPayment(
  paymentId
) {

  // ======================================
  // VALIDATION
  // ======================================

  if (!paymentId) {

    throw new Error(
      "paymentId es obligatorio."
    );

  }


  // ======================================
  // SUBMIT
  // ======================================

  return await apiRequest(
    BILLING_PAYMENT_SUBMIT_API,
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
// COMPLETE PAYMENT CREATION
// ========================================
//
// Crea el pago y, opcionalmente,
// sube el comprobante.
//
// Esta función NO envía el pago
// a revisión.
//
// Flujo:
//
// create
// ↓
// PENDING
// ↓
// proof
//
// Para enviar a revisión se utiliza:
//
// submitBillingPayment()
//

export async function createBillingPaymentWithProof(
  paymentOptions = {},
  proofFile = null
) {

  // ======================================
  // CREATE PAYMENT
  // ======================================

  const paymentResponse =
    await createBillingPayment(
      paymentOptions
    );


  const payment =
    paymentResponse?.payment;


  if (!payment?.id) {

    throw new Error(
      "El pago fue creado pero no se recibió paymentId."
    );

  }


  // ======================================
  // NO PROOF
  // ======================================

  if (!proofFile) {

    return {

      paymentResponse,

      payment,

      proofResponse:
        null

    };

  }


  // ======================================
  // UPLOAD PROOF
  // ======================================

  const proofResponse =
    await uploadBillingPaymentProof(
      proofFile,
      payment.id
    );


  // ======================================
  // RESULT
  // ======================================

  return {

    paymentResponse,

    payment,

    proofResponse

  };

}


// ========================================
// COMPLETE PAYMENT FLOW
// ========================================
//
// Helper opcional para ejecutar:
//
// CREATE
// ↓
// PROOF
// ↓
// SUBMIT
//
// Esta función sí termina enviando
// el pago a revisión.
//
// No aprueba el pago.
//

export async function createAndSubmitBillingPayment(
  paymentOptions = {},
  proofFile = null
) {

  // ======================================
  // CREATE + PROOF
  // ======================================

  const result =
    await createBillingPaymentWithProof(
      paymentOptions,
      proofFile
    );


  // ======================================
  // REQUIRE PAYMENT
  // ======================================

  if (!result?.payment?.id) {

    throw new Error(
      "No se pudo obtener el paymentId."
    );

  }


  // ======================================
  // REQUIRE PROOF
  // ======================================

  if (!result?.proofResponse) {

    throw new Error(
      "Debes adjuntar el comprobante antes de enviar el pago a revisión."
    );

  }


  // ======================================
  // SUBMIT
  // ======================================

  const submitResponse =
    await submitBillingPayment(
      result.payment.id
    );


  // ======================================
  // RESULT
  // ======================================

  return {

    ...result,

    submitResponse

  };

}