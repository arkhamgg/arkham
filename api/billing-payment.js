// ========================================
// NEXUS — Billing Payment API
// ========================================

import {
  getAuth
} from "firebase-admin/auth";

import {
  getFirestore,
  FieldValue
} from "firebase-admin/firestore";

import {
  getFirebaseAdminApp
} from "./_lib/firebaseAdmin.js";

import {
  getPlanPrice
} from "./_lib/billingConfig.js";


// ========================================
// FIREBASE ADMIN
// ========================================

const firebaseAdminApp =
  getFirebaseAdminApp();

const adminAuth =
  getAuth(firebaseAdminApp);

const adminDb =
  getFirestore(firebaseAdminApp);


// ========================================
// CONSTANTS
// ========================================

const PAYMENT_STATUS = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired"
};


const PAYMENT_METHOD = {
  BANK_TRANSFER: "bank_transfer",
  BANK_DEPOSIT: "bank_deposit"
};


const BILLING_CURRENCY =
  "GTQ";


const BILLING_PERIOD = {
  MONTHLY: "monthly"
};


// ========================================
// CURRENT MVP TARGET PLANS
// ========================================
//
// Para el MVP solamente permitimos
// pagos manuales destinados a Pro.
//
// Más adelante esto podrá salir de una
// configuración central de Billing.
//

const ALLOWED_TARGET_PLANS = [
  "pro"
];


// ========================================
// RESPONSE HELPERS
// ========================================

function successResponse(
  res,
  data = {},
  status = 200
) {

  return res
    .status(status)
    .json({
      success: true,
      ...data
    });

}


function errorResponse(
  res,
  message,
  status = 400
) {

  return res
    .status(status)
    .json({
      success: false,
      error: message
    });

}


// ========================================
// AUTHENTICATION
// ========================================

function getBearerToken(
  req
) {

  const authorization =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    "";

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {

    return null;

  }

  return authorization
    .substring(7)
    .trim();

}


async function authenticateRequest(
  req
) {

  const token =
    getBearerToken(req);

  if (!token) {

    const error =
      new Error(
        "AUTH_TOKEN_MISSING"
      );

    throw error;

  }

  return await adminAuth
    .verifyIdToken(token);

}


// ========================================
// REQUEST BODY
// ========================================

function getRequestBody(
  req
) {

  if (
    req.body &&
    typeof req.body === "object"
  ) {

    return req.body;

  }


  if (
    typeof req.body === "string"
  ) {

    try {

      return JSON.parse(
        req.body
      );

    } catch {

      return null;

    }

  }


  return null;

}


// ========================================
// DATE VALIDATION
// ========================================

function isValidDate(
  value
) {

  if (!value) {

    return false;

  }

  const date =
    new Date(value);

  return (
    !Number.isNaN(
      date.getTime()
    )
  );

}


// ========================================
// CREATE PAYMENT
// ========================================

async function createPayment(
  req,
  res,
  decodedToken
) {

  const uid =
    decodedToken.uid;


  // ========================================
  // BODY
  // ========================================

  const body =
    getRequestBody(req);


  if (!body) {

    return errorResponse(
      res,
      "El cuerpo de la solicitud no es válido.",
      400
    );

  }


  const {
    subscriptionId,
    planId,
    period = BILLING_PERIOD.MONTHLY,
    method,
    paymentDate,
    paymentTime,
    reference
  } = body;


  // ========================================
  // REQUIRED FIELDS
  // ========================================

  if (
    !subscriptionId
  ) {

    return errorResponse(
      res,
      "subscriptionId es obligatorio.",
      400
    );

  }


  if (
    !planId
  ) {

    return errorResponse(
      res,
      "planId es obligatorio.",
      400
    );

  }


  // ========================================
  // PERIOD VALIDATION
  // ========================================

  if (
    period !==
    BILLING_PERIOD.MONTHLY
  ) {

    return errorResponse(
      res,
      "El período de facturación no es válido.",
      400
    );

  }


  // ========================================
  // PAYMENT METHOD
  // ========================================

  if (
    !Object.values(
      PAYMENT_METHOD
    ).includes(method)
  ) {

    return errorResponse(
      res,
      "El método de pago no es válido.",
      400
    );

  }


  // ========================================
  // PAYMENT DATE
  // ========================================

  if (
    !paymentDate ||
    !isValidDate(paymentDate)
  ) {

    return errorResponse(
      res,
      "paymentDate no es válido.",
      400
    );

  }


  // ========================================
  // TARGET PLAN VALIDATION
  // ========================================

  if (
    !ALLOWED_TARGET_PLANS.includes(
      planId
    )
  ) {

    return errorResponse(
      res,
      "El plan solicitado no está disponible para pagos manuales.",
      400
    );

  }


  // ========================================
  // BILLING PRICE
  // ========================================
  //
  // El frontend NO puede decidir:
  // - amount
  // - currency
  //
  // El backend obtiene ambos valores
  // desde billingConfig.js.
  //

  const pricing =
    getPlanPrice(
      planId,
      period
    );


  if (!pricing) {

    return errorResponse(
      res,
      "No existe una configuración de precio para el plan solicitado.",
      409
    );

  }


  const amount =
    Number(
      pricing.amount
    );


  const currency =
    pricing.currency;


  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {

    console.error(
      "NEXUS — Billing: precio inválido.",
      {
        planId,
        period,
        amount
      }
    );

    return errorResponse(
      res,
      "La configuración de precio del plan no es válida.",
      500
    );

  }


  if (
    currency !==
    BILLING_CURRENCY
  ) {

    console.error(
      "NEXUS — Billing: moneda inválida.",
      {
        planId,
        period,
        currency
      }
    );

    return errorResponse(
      res,
      "La configuración de moneda del plan no es válida.",
      500
    );

  }


  // ========================================
  // ACCOUNT
  // ========================================

  const accountRef =
    adminDb
      .collection("accounts")
      .doc(uid);


  const accountSnapshot =
    await accountRef.get();


  if (
    !accountSnapshot.exists
  ) {

    return errorResponse(
      res,
      "La cuenta no existe.",
      404
    );

  }


  const account =
    accountSnapshot.data();


  // ========================================
  // SUBSCRIPTION
  // ========================================

  const subscriptionRef =
    adminDb
      .collection("subscriptions")
      .doc(subscriptionId);


  const subscriptionSnapshot =
    await subscriptionRef.get();


  if (
    !subscriptionSnapshot.exists
  ) {

    return errorResponse(
      res,
      "La suscripción no existe.",
      404
    );

  }


  const subscription =
    subscriptionSnapshot.data();


  // ========================================
  // ACCOUNT OWNERSHIP
  // ========================================

  if (
    subscription.accountId !==
    uid
  ) {

    return errorResponse(
      res,
      "La suscripción no pertenece a esta cuenta.",
      403
    );

  }


  // ========================================
  // CURRENT PLAN
  // ========================================

  const currentPlanId =
    subscription.planId;


  if (
    !currentPlanId
  ) {

    return errorResponse(
      res,
      "La suscripción no tiene un plan actual.",
      409
    );

  }


  // ========================================
  // SUBSCRIPTION STATUS
  // ========================================

  if (
    subscription.status ===
    "cancelled"
  ) {

    return errorResponse(
      res,
      "No se puede realizar un pago sobre una suscripción cancelada.",
      409
    );

  }


  // ========================================
  // PLAN TRANSITION
  // ========================================
  //
  // currentPlanId = plan actual
  // planId        = plan objetivo
  //
  // MVP:
  //
  // FREE → PRO
  // PRO  → PRO
  //
  // No permitimos otras transiciones
  // hasta que Billing las soporte.
  //

  const isInitialUpgrade =
    currentPlanId === "free" &&
    planId === "pro";


  const isProRenewal =
    currentPlanId === "pro" &&
    planId === "pro";


  if (
    !isInitialUpgrade &&
    !isProRenewal
  ) {

    return errorResponse(
      res,
      `La transición ${currentPlanId} → ${planId} no está disponible.`,
      409
    );

  }


  // ========================================
  // PAYMENT PERIOD VALIDATION
  // ========================================
  //
  // Para una renovación Pro → Pro:
  // el pago debe corresponder al mismo
  // período de la suscripción.
  //
  // Para Free → Pro:
  // se trata de una activación inicial.
  //

  if (
    isProRenewal &&
    subscription.period &&
    subscription.period !== period
  ) {

    return errorResponse(
      res,
      "El período de pago no coincide con el período actual de la suscripción.",
      409
    );

  }


  // ========================================
  // EXISTING PAYMENT CHECK
  // ========================================
  //
  // Evita que el usuario genere varios
  // pagos pendientes para la misma
  // suscripción.
  //

  const existingPaymentsSnapshot =
    await adminDb
      .collection("payments")
      .where(
        "accountId",
        "==",
        uid
      )
      .where(
        "subscriptionId",
        "==",
        subscriptionId
      )
      .get();


  const activePayment =
    existingPaymentsSnapshot
      .docs
      .map(
        doc => ({
          id: doc.id,
          ...doc.data()
        })
      )
      .find(
        payment =>
          payment.status ===
            PAYMENT_STATUS.PENDING ||

          payment.status ===
            PAYMENT_STATUS.UNDER_REVIEW
      );


  if (
    activePayment
  ) {

    return errorResponse(
      res,
      "Ya existe un pago pendiente o en revisión para esta suscripción.",
      409
    );

  }


  // ========================================
  // CREATE PAYMENT REFERENCE
  // ========================================

  const paymentRef =
    adminDb
      .collection("payments")
      .doc();


  const now =
    new Date();


  // ========================================
  // PAYMENT DATA
  // ========================================

  const paymentData = {

    // ======================================
    // OWNERSHIP
    // ======================================

    accountId:
      uid,

    subscriptionId,


    // ======================================
    // PLAN CONTEXT
    // ======================================
    //
    // currentPlanId:
    // plan actual al momento de crear
    // el pago.
    //
    // planId:
    // plan que el usuario quiere activar.
    //
    // Esto permite representar:
    //
    // free → pro
    //
    // sin modificar todavía la
    // suscripción.
    //

    currentPlanId,

    planId,


    // ======================================
    // BILLING PERIOD
    // ======================================

    period,


    // ======================================
    // PAYMENT
    // ======================================

    amount,

    currency,

    method,

    status:
      PAYMENT_STATUS.PENDING,


    // ======================================
    // PAYMENT DATE
    // ======================================

    paymentDate:
      new Date(paymentDate),

    paymentTime:
      paymentTime ||
      null,


    // ======================================
    // REFERENCE
    // ======================================

    reference:
      reference ||
      null,


    // ======================================
    // PROOF
    // ======================================

    proof:
      null,


    // ======================================
    // REVIEW
    // ========================================

    reviewedBy:
      null,

    reviewedAt:
      null,

    rejectionReason:
      null,


    // ======================================
    // TIMESTAMPS
    // ======================================

    createdAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp()

  };


  // ========================================
  // CREATE PAYMENT
  // ========================================

  await paymentRef.set(
    paymentData
  );


  // ========================================
  // RESPONSE
  // ========================================

  return successResponse(
    res,
    {

      payment: {

        id:
          paymentRef.id,

        accountId:
          uid,

        subscriptionId,

        currentPlanId,

        planId,

        period,

        amount,

        currency,

        method,

        status:
          PAYMENT_STATUS.PENDING

      }

    },
    201
  );

}


// ========================================
// HANDLER
// ========================================

export default async function handler(
  req,
  res
) {

  // ========================================
  // METHOD
  // ========================================

  if (
    req.method !==
    "POST"
  ) {

    res.setHeader(
      "Allow",
      "POST"
    );

    return errorResponse(
      res,
      "Método no permitido.",
      405
    );

  }


  try {

    // ======================================
    // AUTHENTICATE
    // ======================================

    const decodedToken =
      await authenticateRequest(
        req
      );


    // ======================================
    // CREATE PAYMENT
    // ======================================

    return await createPayment(
      req,
      res,
      decodedToken
    );

  } catch (
    error
  ) {

    console.error(
      "NEXUS — Billing Payment API:",
      error
    );


    // ======================================
    // AUTH ERRORS
    // ======================================

    if (
      error.code ===
      "auth/id-token-expired"
    ) {

      return errorResponse(
        res,
        "El token de autenticación ha expirado.",
        401
      );

    }


    if (
      error.code ===
        "auth/argument-error" ||

      error.code ===
        "auth/invalid-id-token"
    ) {

      return errorResponse(
        res,
        "El token de autenticación no es válido.",
        401
      );

    }


    if (
      error.message ===
      "AUTH_TOKEN_MISSING"
    ) {

      return errorResponse(
        res,
        "No se proporcionó un token de autenticación.",
        401
      );

    }


    // ======================================
    // FIRESTORE / SERVER ERRORS
    // ======================================

    return errorResponse(
      res,
      "Ocurrió un error al crear el pago.",
      500
    );

  }

}