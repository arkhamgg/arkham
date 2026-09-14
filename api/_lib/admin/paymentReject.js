// ========================================
// NEXUS — Admin Billing Payment Reject API
// ========================================

import {
  getAuth
} from "firebase-admin/auth";

import {
  getFirestore
} from "firebase-admin/firestore";

import {
  getFirebaseAdminApp
} from "../firebaseAdmin.js";

import { writeAdminAudit } from "./auditWriter.js";


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
  UNDER_REVIEW: "under_review",
  REJECTED: "rejected"
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
// ADMIN AUTHORIZATION
// ========================================

async function requireAdministrator(
  uid
) {

  const adminRef =
    adminDb
      .collection("adminUsers")
      .doc(uid);


  const adminSnapshot =
    await adminRef.get();


  if (
    !adminSnapshot.exists
  ) {

    throw new Error(
      "ADMIN_NOT_FOUND"
    );

  }


  const adminUser =
    adminSnapshot.data();


  if (
    adminUser.roleId !==
    "administrator"
  ) {

    throw new Error(
      "ADMIN_ROLE_INVALID"
    );

  }


  if (
    adminUser.status !==
    "active"
  ) {

    throw new Error(
      "ADMIN_INACTIVE"
    );

  }


  return adminUser;

}


// ========================================
// REJECT PAYMENT
// ========================================

async function rejectPayment(
  req,
  res,
  decodedToken
) {

  const adminUid =
    decodedToken.uid;


  // ========================================
  // ADMIN AUTHORIZATION
  // ========================================

  await requireAdministrator(
    adminUid
  );


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

  if (
    !paymentId
  ) {

    return errorResponse(
      res,
      "paymentId es obligatorio.",
      400
    );

  }


  if (
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
      async transaction => {

        // ==================================
        // PAYMENT
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
        // STATUS
        // ==================================

        if (
          payment.status !==
          PAYMENT_STATUS.UNDER_REVIEW
        ) {

          throw new Error(
            "PAYMENT_NOT_UNDER_REVIEW"
          );

        }


        // ==================================
        // REJECT
        // ==================================

        transaction.update(
          paymentRef,
          {

            status:
              PAYMENT_STATUS.REJECTED,

            reviewedBy:
              adminUid,

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
  // AUDIT
  // ========================================

  await writeAdminAudit({
    firestore: adminDb,
    actorId: adminUid,
    actorRole: "administrator",
    action: "payment_rejected",
    targetType: "payment",
    targetId: paymentId,
    previousState: { status: "under_review" },
    newState: { status: "rejected" },
    reason: normalizedReason,
    metadata: { subscriptionId: result.subscriptionId || null }
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
            result.paymentId,

          status:
            PAYMENT_STATUS.REJECTED,

          rejectionReason:
            normalizedReason

        },

      subscription:
        {

          id:
            result.subscriptionId ||
            null,

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

export async function handle(
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
      "AUTH_TOKEN_MISSING"
    ) {

      return errorResponse(
        res,
        "No se proporcionó un token de autenticación.",
        401
      );

    }


    // ======================================
    // ADMIN ERRORS
    // ======================================

    switch (
      error.message
    ) {

      case "ADMIN_NOT_FOUND":

        return errorResponse(
          res,
          "No tienes autorización administrativa.",
          403
        );


      case "ADMIN_ROLE_INVALID":

        return errorResponse(
          res,
          "El usuario administrativo no tiene el rol requerido.",
          403
        );


      case "ADMIN_INACTIVE":

        return errorResponse(
          res,
          "El usuario administrativo está inactivo.",
          403
        );


      // ====================================
      // PAYMENT ERRORS
      // ====================================

      case "PAYMENT_NOT_FOUND":

        return errorResponse(
          res,
          "El pago no existe.",
          404
        );


      case "PAYMENT_NOT_UNDER_REVIEW":

        return errorResponse(
          res,
          "El pago no está en estado under_review.",
          409
        );


      // ====================================
      // DEFAULT
      // ====================================

      default:

        return errorResponse(
          res,
          "Ocurrió un error al rechazar el pago.",
          500
        );

    }

  }

}