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
// CONSTANTS
// ========================================

const PAYMENT_STATUS = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired"
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
// IMAGEKIT PROOF VALIDATION
// ========================================

function isValidImageKitProof(
  proof
) {

  if (
    !proof ||
    typeof proof !== "object"
  ) {

    return false;

  }


  if (
    proof.provider !==
    "imagekit"
  ) {

    return false;

  }


  if (
    typeof proof.fileId !==
      "string" ||
    !proof.fileId.trim()
  ) {

    return false;

  }


  if (
    typeof proof.filePath !==
      "string" ||
    !proof.filePath.trim()
  ) {

    return false;

  }


  if (
    typeof proof.url !==
      "string" ||
    !proof.url.trim()
  ) {

    return false;

  }


  if (
    typeof proof.fileName !==
      "string" ||
    !proof.fileName.trim()
  ) {

    return false;

  }


  if (
    typeof proof.contentType !==
      "string" ||
    !proof.contentType.trim()
  ) {

    return false;

  }


  if (
    !Number.isFinite(
      Number(proof.size)
    ) ||
    Number(proof.size) <= 0
  ) {

    return false;

  }


  return true;

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


  // ========================================
  // REQUIRED FIELD
  // ========================================

  if (
    !paymentId
  ) {

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
  // PAYMENT OWNERSHIP
  // ========================================

  if (
    payment.accountId !==
    uid
  ) {

    return errorResponse(
      res,
      "El pago no pertenece a esta cuenta.",
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
      "El pago no puede ser enviado a revisión desde su estado actual.",
      409
    );

  }


  // ========================================
  // REQUIRED PAYMENT CONTEXT
  // ========================================

  if (
    !payment.subscriptionId
  ) {

    return errorResponse(
      res,
      "El pago no tiene una suscripción asociada.",
      409
    );

  }


  if (
    !payment.planId
  ) {

    return errorResponse(
      res,
      "El pago no tiene un plan objetivo.",
      409
    );

  }


  if (
    !payment.currentPlanId
  ) {

    return errorResponse(
      res,
      "El pago no tiene registrado el plan actual de la suscripción.",
      409
    );

  }


  if (
    !payment.amount ||
    Number(payment.amount) <= 0
  ) {

    return errorResponse(
      res,
      "El pago no tiene un monto válido.",
      409
    );

  }


  if (
    !payment.method
  ) {

    return errorResponse(
      res,
      "El pago no tiene un método de pago válido.",
      409
    );

  }


  // ========================================
  // PAYMENT PROOF
  // ========================================

  if (
    !isValidImageKitProof(
      payment.proof
    )
  ) {

    return errorResponse(
      res,
      "El comprobante de pago no tiene una referencia válida de ImageKit.",
      409
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
      "La suscripción asociada al pago no existe.",
      404
    );

  }


  const subscription =
    subscriptionSnapshot.data();


  // ========================================
  // SUBSCRIPTION OWNERSHIP
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
  // CURRENT PLAN VALIDATION
  // ========================================
  //
  // payment.currentPlanId representa
  // el plan que tenía la suscripción
  // cuando se creó el pago.
  //
  // subscription.planId representa
  // el plan actual de la suscripción.
  //
  // Si son diferentes, significa que
  // la suscripción cambió después de
  // crear el pago.
  //
  // En ese caso no permitimos continuar.
  //

  if (
    subscription.planId !==
    payment.currentPlanId
  ) {

    return errorResponse(
      res,
      "La suscripción cambió de plan después de crear este pago. Debes generar un nuevo pago.",
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
      "No se puede enviar a revisión un pago asociado a una suscripción cancelada.",
      409
    );

  }


  // ========================================
  // TARGET PLAN VALIDATION
  // ========================================
  //
  // Upgrade:
  //
  // free → pro
  //
  // Renewal:
  //
  // pro → pro
  //

  const isInitialUpgrade =
    payment.currentPlanId === "free" &&
    payment.planId === "pro";


  const isProRenewal =
    payment.currentPlanId === "pro" &&
    payment.planId === "pro";


  if (
    !isInitialUpgrade &&
    !isProRenewal
  ) {

    return errorResponse(
      res,
      `La transición ${payment.currentPlanId} → ${payment.planId} no está disponible.`,
      409
    );

  }


  // ========================================
  // RENEWAL PLAN VALIDATION
  // ========================================
  //
  // En una renovación el plan objetivo
  // debe ser exactamente el plan actual.
  //

  if (
    isProRenewal &&
    payment.planId !==
    subscription.planId
  ) {

    return errorResponse(
      res,
      "El plan del pago no coincide con el plan actual de la suscripción.",
      409
    );

  }


  // ========================================
  // TRANSACTION
  // ========================================
  //
  // Volvemos a leer el pago dentro de
  // una transacción para evitar que dos
  // solicitudes intenten enviarlo a
  // revisión simultáneamente.
  //

  const transactionResult =
    await adminDb.runTransaction(
      async transaction => {

        const freshPaymentSnapshot =
          await transaction.get(
            paymentRef
          );


        if (
          !freshPaymentSnapshot.exists
        ) {

          throw new Error(
            "PAYMENT_NOT_FOUND"
          );

        }


        const freshPayment =
          freshPaymentSnapshot.data();


        // ==================================
        // OWNERSHIP
        // ==================================

        if (
          freshPayment.accountId !==
          uid
        ) {

          throw new Error(
            "PAYMENT_NOT_OWNER"
          );

        }


        // ==================================
        // STATUS
        // ==================================

        if (
          freshPayment.status !==
          PAYMENT_STATUS.PENDING
        ) {

          throw new Error(
            "PAYMENT_NOT_PENDING"
          );

        }


        // ==================================
        // PROOF
        // ==================================

        if (
          !isValidImageKitProof(
            freshPayment.proof
          )
        ) {

          throw new Error(
            "PAYMENT_PROOF_MISSING"
          );

        }


        // ==================================
        // SUBSCRIPTION
        // ==================================

        const freshSubscriptionSnapshot =
          await transaction.get(
            subscriptionRef
          );


        if (
          !freshSubscriptionSnapshot.exists
        ) {

          throw new Error(
            "SUBSCRIPTION_NOT_FOUND"
          );

        }


        const freshSubscription =
          freshSubscriptionSnapshot.data();


        // ==================================
        // SUBSCRIPTION OWNERSHIP
        // ==================================

        if (
          freshSubscription.accountId !==
          uid
        ) {

          throw new Error(
            "SUBSCRIPTION_NOT_OWNER"
          );

        }


        // ==================================
        // STALE PAYMENT PROTECTION
        // ==================================

        if (
          freshSubscription.planId !==
          freshPayment.currentPlanId
        ) {

          throw new Error(
            "SUBSCRIPTION_PLAN_CHANGED"
          );

        }


        // ==================================
        // CANCELLED SUBSCRIPTION
        // ==================================

        if (
          freshSubscription.status ===
          "cancelled"
        ) {

          throw new Error(
            "SUBSCRIPTION_CANCELLED"
          );

        }


        // ==================================
        // UPDATE PAYMENT
        // ==================================

        const now =
          new Date();


        transaction.update(
          paymentRef,
          {

            status:
              PAYMENT_STATUS.UNDER_REVIEW,

            submittedAt:
              now,

            updatedAt:
              FieldValue.serverTimestamp()

          }
        );


        return {

          paymentId,

          accountId:
            freshPayment.accountId,

          subscriptionId:
            freshPayment.subscriptionId,

          currentPlanId:
            freshPayment.currentPlanId,

          planId:
            freshPayment.planId,

          period:
            freshPayment.period ||
            "monthly",

          amount:
            Number(
              freshPayment.amount
            ),

          currency:
            freshPayment.currency ||
            "GTQ",

          method:
            freshPayment.method,

          status:
            PAYMENT_STATUS.UNDER_REVIEW

        };

      }
    );


  // ========================================
  // RESPONSE
  // ========================================

  return successResponse(
    res,
    {
      payment:
        transactionResult
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
    // BUSINESS ERRORS
    // ======================================

    switch (
      error.message
    ) {

      case "PAYMENT_NOT_FOUND":

        return errorResponse(
          res,
          "El pago no existe.",
          404
        );


      case "PAYMENT_NOT_OWNER":

        return errorResponse(
          res,
          "El pago no pertenece a esta cuenta.",
          403
        );


      case "PAYMENT_NOT_PENDING":

        return errorResponse(
          res,
          "El pago ya no está pendiente y no puede enviarse nuevamente a revisión.",
          409
        );


      case "PAYMENT_PROOF_MISSING":

        return errorResponse(
          res,
          "Debes adjuntar un comprobante válido de ImageKit antes de enviar el pago a revisión.",
          409
        );


      case "SUBSCRIPTION_NOT_FOUND":

        return errorResponse(
          res,
          "La suscripción asociada al pago no existe.",
          404
        );


      case "SUBSCRIPTION_NOT_OWNER":

        return errorResponse(
          res,
          "La suscripción no pertenece a esta cuenta.",
          403
        );


      case "SUBSCRIPTION_PLAN_CHANGED":

        return errorResponse(
          res,
          "La suscripción cambió de plan después de crear este pago. Debes generar un nuevo pago.",
          409
        );


      case "SUBSCRIPTION_CANCELLED":

        return errorResponse(
          res,
          "No se puede enviar a revisión un pago asociado a una suscripción cancelada.",
          409
        );


      default:

        return errorResponse(
          res,
          "Ocurrió un error al enviar el pago a revisión.",
          500
        );

    }

  }

}