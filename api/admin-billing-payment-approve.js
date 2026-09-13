// ========================================
// NEXUS — Admin Billing Payment Approve API
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


const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  PENDING: "pending",
  PAST_DUE: "past_due",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
  EXPIRED: "expired"
};


const SUPPORTED_PERIOD = "monthly";


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

    const error =
      new Error(
        "ADMIN_NOT_FOUND"
      );

    throw error;

  }


  const adminUser =
    adminSnapshot.data();


  if (
    adminUser.roleId !==
    "administrator"
  ) {

    const error =
      new Error(
        "ADMIN_ROLE_INVALID"
      );

    throw error;

  }


  if (
    adminUser.status !==
    "active"
  ) {

    const error =
      new Error(
        "ADMIN_INACTIVE"
      );

    throw error;

  }


  return adminUser;

}


// ========================================
// DATE HELPERS
// ========================================

function toDate(
  value
) {

  if (!value) {

    return null;

  }


  if (
    value instanceof Date
  ) {

    return value;

  }


  if (
    typeof value.toDate ===
    "function"
  ) {

    return value.toDate();

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  return date;

}


function calculateMonthlyPeriodEnd(
  startDate
) {

  const endDate =
    new Date(startDate);

  endDate.setMonth(
    endDate.getMonth() + 1
  );

  return endDate;

}


// ========================================
// APPROVE PAYMENT
// ========================================

async function approvePayment(
  req,
  res,
  decodedToken
) {

  const adminUid =
    decodedToken.uid;


  // ========================================
  // REQUEST BODY
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
  // ADMIN AUTHORIZATION
  // ========================================

  await requireAdministrator(
    adminUid
  );


  // ========================================
  // REFERENCES
  // ========================================

  const paymentRef =
    adminDb
      .collection("payments")
      .doc(paymentId);


  // ========================================
  // TRANSACTION
  // ========================================
  //
  // Todas las lecturas relacionadas
  // se realizan dentro de la transacción
  // antes de cualquier escritura.
  //

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
        // PAYMENT STATUS
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
        // PAYMENT OWNERSHIP
        // ==================================

        if (
          !payment.accountId
        ) {

          throw new Error(
            "PAYMENT_ACCOUNT_MISSING"
          );

        }


        if (
          !payment.subscriptionId
        ) {

          throw new Error(
            "PAYMENT_SUBSCRIPTION_MISSING"
          );

        }


        if (
          !payment.currentPlanId
        ) {

          throw new Error(
            "PAYMENT_CURRENT_PLAN_MISSING"
          );

        }


        if (
          !payment.planId
        ) {

          throw new Error(
            "PAYMENT_TARGET_PLAN_MISSING"
          );

        }


        // ==================================
        // SUBSCRIPTION
        // ==================================

        const subscriptionRef =
          adminDb
            .collection("subscriptions")
            .doc(
              payment.subscriptionId
            );


        const subscriptionSnapshot =
          await transaction.get(
            subscriptionRef
          );


        if (
          !subscriptionSnapshot.exists
        ) {

          throw new Error(
            "SUBSCRIPTION_NOT_FOUND"
          );

        }


        const subscription =
          subscriptionSnapshot.data();


        // ==================================
        // SUBSCRIPTION OWNERSHIP
        // ==================================

        if (
          subscription.accountId !==
          payment.accountId
        ) {

          throw new Error(
            "SUBSCRIPTION_OWNER_MISMATCH"
          );

        }


        // ==================================
        // CURRENT PLAN VALIDATION
        // ==================================
        //
        // El plan actual debe seguir siendo
        // el mismo que tenía cuando se creó
        // el pago.
        //

        if (
          subscription.planId !==
          payment.currentPlanId
        ) {

          throw new Error(
            "SUBSCRIPTION_PLAN_CHANGED"
          );

        }


        // ==================================
        // SUBSCRIPTION STATUS
        // ==================================

        if (
          subscription.status ===
          SUBSCRIPTION_STATUS.CANCELLED
        ) {

          throw new Error(
            "SUBSCRIPTION_CANCELLED"
          );

        }


        // ==================================
        // PERIOD
        // ==================================

        const period =
          payment.period ||
          SUPPORTED_PERIOD;


        if (
          period !==
          SUPPORTED_PERIOD
        ) {

          throw new Error(
            "PERIOD_NOT_SUPPORTED"
          );

        }


        // ==================================
        // PLAN TRANSITION
        // ========================================
        //
        // MVP:
        //
        // FREE → PRO
        // PRO  → PRO
        //
        // El primer caso es una activación/
        // upgrade.
        //
        // El segundo es una renovación.
        //

        const isInitialUpgrade =
          payment.currentPlanId ===
            "free" &&

          payment.planId ===
            "pro";


        const isProRenewal =
          payment.currentPlanId ===
            "pro" &&

          payment.planId ===
            "pro";


        if (
          !isInitialUpgrade &&
          !isProRenewal
        ) {

          throw new Error(
            "PLAN_TRANSITION_NOT_SUPPORTED"
          );

        }


        // ==================================
        // PERIOD START
        // ==================================

        const now =
          new Date();

        let currentPeriodStart =
          now;


        // ==================================
        // RENEWAL START
        // ==================================
        //
        // Si la suscripción Pro todavía
        // tiene un período vigente, la
        // renovación comienza al terminar
        // el período actual.
        //
        // Si ya terminó, comienza ahora.
        //

        if (
          isProRenewal
        ) {

          const currentPeriodEnd =
            toDate(
              subscription.currentPeriodEnd
            );


          if (
            currentPeriodEnd &&
            currentPeriodEnd > now
          ) {

            currentPeriodStart =
              currentPeriodEnd;

          }

        }


        // ==================================
        // PERIOD END
        // ==================================

        const currentPeriodEnd =
          calculateMonthlyPeriodEnd(
            currentPeriodStart
          );


        // ==================================
        // SUBSCRIPTION UPDATE
        // ==================================
        //
        // Aquí ocurre el cambio real:
        //
        // FREE → PRO
        //
        // El plan de la suscripción se
        // convierte en la fuente de verdad
        // del acceso.
        //

        const subscriptionUpdate = {

          planId:
            payment.planId,

          status:
            SUBSCRIPTION_STATUS.ACTIVE,

          period,

          activatedAt:
            isInitialUpgrade
              ? now
              : (
                  subscription.activatedAt ||
                  now
                ),

          currentPeriodStart,

          currentPeriodEnd,

          nextBillingAt:
            currentPeriodEnd,

          paymentDeadline:
            null,

          suspendedAt:
            null,

          expiredAt:
            null,

          updatedAt:
            FieldValue.serverTimestamp()

        };


        transaction.update(
          subscriptionRef,
          subscriptionUpdate
        );


        // ==================================
        // ACCOUNT
        // ==================================
        //
        // account.planId es solamente
        // metadata/cache.
        //
        // La suscripción continúa siendo
        // la fuente de verdad para Billing.
        //

        const accountRef =
          adminDb
            .collection("accounts")
            .doc(
              payment.accountId
            );


        transaction.update(
          accountRef,
          {

            planId:
              payment.planId,

            updatedAt:
              FieldValue.serverTimestamp()

          }
        );


        // ==================================
        // PAYMENT UPDATE
        // ==================================

        transaction.update(
          paymentRef,
          {

            status:
              PAYMENT_STATUS.APPROVED,

            reviewedBy:
              adminUid,

            reviewedAt:
              now,

            approvedAt:
              now,

            updatedAt:
              FieldValue.serverTimestamp()

          }
        );


        // ==================================
        // RESULT
        // ==================================

        return {

          paymentId,

          accountId:
            payment.accountId,

          subscriptionId:
            payment.subscriptionId,

          previousPlanId:
            payment.currentPlanId,

          planId:
            payment.planId,

          period,

          amount:
            Number(
              payment.amount
            ),

          currency:
            payment.currency ||
            "GTQ",

          paymentStatus:
            PAYMENT_STATUS.APPROVED,

          subscriptionStatus:
            SUBSCRIPTION_STATUS.ACTIVE,

          currentPeriodStart,

          currentPeriodEnd,

          nextBillingAt:
            currentPeriodEnd

        };

      }
    );


  // ========================================
  // RESPONSE
  // ========================================

  return successResponse(
    res,
    {
      message:
        "El pago fue aprobado y la suscripción fue activada correctamente.",

      result

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
    // APPROVE
    // ======================================

    return await approvePayment(
      req,
      res,
      decodedToken
    );

  } catch (
    error
  ) {

    console.error(
      "NEXUS — Admin Billing Payment Approve API:",
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
          "El usuario no está registrado como administrador.",
          403
        );


      case "ADMIN_ROLE_INVALID":

        return errorResponse(
          res,
          "El usuario no tiene permisos de administrador.",
          403
        );


      case "ADMIN_INACTIVE":

        return errorResponse(
          res,
          "La cuenta administrativa está inactiva.",
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
          "El pago no está pendiente de revisión.",
          409
        );


      case "PAYMENT_ACCOUNT_MISSING":

        return errorResponse(
          res,
          "El pago no tiene una cuenta asociada.",
          409
        );


      case "PAYMENT_SUBSCRIPTION_MISSING":

        return errorResponse(
          res,
          "El pago no tiene una suscripción asociada.",
          409
        );


      case "PAYMENT_CURRENT_PLAN_MISSING":

        return errorResponse(
          res,
          "El pago no tiene registrado el plan actual.",
          409
        );


      case "PAYMENT_TARGET_PLAN_MISSING":

        return errorResponse(
          res,
          "El pago no tiene registrado el plan objetivo.",
          409
        );


      // ====================================
      // SUBSCRIPTION ERRORS
      // ====================================

      case "SUBSCRIPTION_NOT_FOUND":

        return errorResponse(
          res,
          "La suscripción asociada al pago no existe.",
          404
        );


      case "SUBSCRIPTION_OWNER_MISMATCH":

        return errorResponse(
          res,
          "La suscripción no corresponde a la cuenta del pago.",
          409
        );


      case "SUBSCRIPTION_PLAN_CHANGED":

        return errorResponse(
          res,
          "La suscripción cambió de plan después de crear el pago. Este pago ya no puede aprobarse.",
          409
        );


      case "SUBSCRIPTION_CANCELLED":

        return errorResponse(
          res,
          "No se puede activar una suscripción cancelada.",
          409
        );


      // ====================================
      // BILLING ERRORS
      // ====================================

      case "PERIOD_NOT_SUPPORTED":

        return errorResponse(
          res,
          "El período de facturación no está soportado.",
          409
        );


      case "PLAN_TRANSITION_NOT_SUPPORTED":

        return errorResponse(
          res,
          "La transición de plan de este pago no está soportada.",
          409
        );


      default:

        return errorResponse(
          res,
          "Ocurrió un error al aprobar el pago.",
          500
        );

    }

  }

}