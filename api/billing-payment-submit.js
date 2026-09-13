// ========================================
// NEXUS — Billing Payment Submit API
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
// PAYMENT STATUS
// ========================================

const PAYMENT_STATUS = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review"
};


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

    throw new Error(
      "AUTH_TOKEN_MISSING"
    );

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
// SUBMIT PAYMENT
// ========================================

async function submitPayment(
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
    paymentId
  } = body;


  if (!paymentId) {

    return errorResponse(
      res,
      "paymentId es obligatorio.",
      400
    );

  }


  // ========================================
  // PAYMENT
  // ========================================

  const paymentRef =
    adminDb
      .collection("payments")
      .doc(paymentId);


  const paymentSnapshot =
    await paymentRef.get();


  if (
    !paymentSnapshot.exists
  ) {

    return errorResponse(
      res,
      "El pago no existe.",
      404
    );

  }


  const payment =
    paymentSnapshot.data();


  // ========================================
  // OWNERSHIP
  // ========================================

  if (
    payment.accountId !==
    uid
  ) {

    return errorResponse(
      res,
      "Este pago no pertenece a tu cuenta.",
      403
    );

  }


  // ========================================
  // PAYMENT STATUS
  // ========================================

  if (
    payment.status !==
    PAYMENT_STATUS.PENDING
  ) {

    return errorResponse(
      res,
      "El pago no está disponible para envío a revisión.",
      409
    );

  }


  // ========================================
  // REQUIRED PAYMENT DATA
  // ========================================

  if (
    !payment.subscriptionId
  ) {

    return errorResponse(
      res,
      "El pago no tiene una suscripción asociada.",
      400
    );

  }


  if (
    !payment.planId
  ) {

    return errorResponse(
      res,
      "El pago no tiene un plan objetivo asociado.",
      400
    );

  }


  // ========================================
  // PROOF
  // ========================================

  if (
    !payment.proof
  ) {

    return errorResponse(
      res,
      "Debes adjuntar el comprobante de pago antes de enviarlo a revisión.",
      400
    );

  }


  if (
    !payment.proof.storagePath
  ) {

    return errorResponse(
      res,
      "El comprobante de pago no tiene una referencia válida.",
      400
    );

  }


  // ========================================
  // SUBSCRIPTION
  // ========================================

  const subscriptionRef =
    adminDb
      .collection("subscriptions")
      .doc(
        payment.subscriptionId
      );


  const subscriptionSnapshot =
    await subscriptionRef.get();


  if (
    !subscriptionSnapshot.exists
  ) {

    return errorResponse(
      res,
      "La suscripción asociada no existe.",
      404
    );

  }


  const subscription =
    subscriptionSnapshot.data();


  // ========================================
  // ACCOUNT CONSISTENCY
  // ========================================

  if (
    subscription.accountId !==
    payment.accountId
  ) {

    return errorResponse(
      res,
      "La cuenta del pago y la suscripción no coinciden.",
      409
    );

  }


  // ========================================
  // CURRENT PLAN CONSISTENCY
  // ========================================
  //
  // payment.currentPlanId =
  // plan que tenía la cuenta al crear
  // el pago.
  //
  // subscription.planId =
  // plan actual de la suscripción.
  //
  // Si cambió entretanto, el pago
  // queda obsoleto y no debe continuar.
  // ========================================

  if (
    payment.currentPlanId &&
    payment.currentPlanId !==
      subscription.planId
  ) {

    return errorResponse(
      res,
      "La suscripción cambió después de crear este pago. Debes crear un nuevo pago.",
      409
    );

  }


  // ========================================
  // TARGET PLAN VALIDATION
  // ========================================

  if (
    payment.planId ===
    "free"
  ) {

    return errorResponse(
      res,
      "No se puede enviar un pago para activar el plan Free.",
      400
    );

  }


  // ========================================
  // TIMESTAMP
  // ========================================

  const now =
    new Date();


  // ========================================
  // SUBMIT FOR REVIEW
  // ========================================

  await paymentRef.update({

    status:
      PAYMENT_STATUS.UNDER_REVIEW,

    submittedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp()

  });


  // ========================================
  // RESPONSE
  // ========================================

  return successResponse(
    res,
    {

      payment:
        {

          id:
            paymentId,

          accountId:
            payment.accountId,

          subscriptionId:
            payment.subscriptionId,

          currentPlanId:
            payment.currentPlanId ||
            subscription.planId,

          planId:
            payment.planId,

          status:
            PAYMENT_STATUS.UNDER_REVIEW,

          submittedAt:
            now

        }

    },
    200
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
    // SUBMIT
    // ======================================

    return await submitPayment(
      req,
      res,
      decodedToken
    );

  } catch (
    error
  ) {

    console.error(
      "NEXUS — Billing Payment Submit API:",
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
    // SERVER ERROR
    // ======================================

    return errorResponse(
      res,
      "Ocurrió un error al enviar el pago a revisión.",
      500
    );

  }

}