// ========================================
// NEXUS — Admin Billing Payment Reject API
// ========================================

import {
  adminAuth,
  adminDb
} from "./_lib/firebaseAdmin.js";


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
      "No se proporcionó un token de autenticación."
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
// VERIFY ADMINISTRATOR
// ========================================

async function verifyAdministrator(
  decodedToken
) {

  const uid =
    decodedToken.uid;


  if (!uid) {

    return false;

  }


  const adminRef =
    adminDb
      .collection("adminUsers")
      .doc(uid);


  const adminSnapshot =
    await adminRef.get();


  if (
    !adminSnapshot.exists
  ) {

    return false;

  }


  const adminUser =
    adminSnapshot.data();


  return (
    adminUser.status ===
      "active" &&

    adminUser.roleId ===
      "administrator"
  );

}


// ========================================
// REJECT PAYMENT
// ========================================

async function rejectPayment(
  req,
  res,
  decodedToken
) {

  // ========================================
  // ADMIN AUTHORIZATION
  // ========================================

  const isAdministrator =
    await verifyAdministrator(
      decodedToken
    );


  if (!isAdministrator) {

    return errorResponse(
      res,
      "No tienes autorización para rechazar pagos.",
      403
    );

  }


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

    paymentId,

    reason

  } = body;


  // ========================================
  // REQUIRED FIELDS
  // ========================================

  if (!paymentId) {

    return errorResponse(
      res,
      "paymentId es obligatorio.",
      400
    );

  }


  if (
    !reason ||
    typeof reason !== "string" ||
    !reason.trim()
  ) {

    return errorResponse(
      res,
      "Debes indicar el motivo del rechazo.",
      400
    );

  }


  const normalizedReason =
    reason
      .trim()
      .substring(0, 1000);


  // ========================================
  // PAYMENT REF
  // ========================================

  const paymentRef =
    adminDb
      .collection("payments")
      .doc(paymentId);


  // ========================================
  // TRANSACTION
  // ========================================

  const result =
    await adminDb.runTransaction(
      async (
        transaction
      ) => {

        // ==================================
        // READ PAYMENT
        // ==================================

        const paymentSnapshot =
          await transaction.get(
            paymentRef
          );


        if (
          !paymentSnapshot.exists
        ) {

          throw new Error(
            "PAYMENT_NOT_FOUND"
          );

        }


        const payment =
          paymentSnapshot.data();


        // ==================================
        // VERIFY STATUS
        // ==================================

        if (
          payment.status !==
          "under_review"
        ) {

          throw new Error(
            "INVALID_PAYMENT_STATUS"
          );

        }


        // ==================================
        // REJECT PAYMENT
        // ==================================

        transaction.update(
          paymentRef,
          {

            status:
              "rejected",

            reviewedBy:
              decodedToken.uid,

            reviewedAt:
              new Date(),

            rejectionReason:
              normalizedReason,

            updatedAt:
              new Date()

          }
        );


        return {

          paymentId,

          accountId:
            payment.accountId,

          subscriptionId:
            payment.subscriptionId,

          planId:
            payment.planId

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
        {

          id:
            result.paymentId,

          status:
            "rejected",

          rejectionReason:
            normalizedReason

        },

      subscription:
        {

          id:
            result.subscriptionId,

          status:
            "unchanged"

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
    // REJECT
    // ======================================

    return await rejectPayment(
      req,
      res,
      decodedToken
    );

  } catch (
    error
  ) {

    console.error(
      "NEXUS — Admin Billing Payment Reject API:",
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
      "No se proporcionó un token de autenticación."
    ) {

      return errorResponse(
        res,
        error.message,
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


      case "INVALID_PAYMENT_STATUS":

        return errorResponse(
          res,
          "El pago no está en estado under_review.",
          409
        );


      default:

        return errorResponse(
          res,
          "Ocurrió un error al rechazar el pago.",
          500
        );

    }

  }

}