// ========================================
// NEXUS — Admin Billing Payment Approve API
// ========================================

import {
  getAuth
} from "firebase-admin/auth";

import {
  getFirestore
} from "firebase-admin/firestore";

import {
  getFirebaseAdminApp
} from "./_lib/firebaseAdmin.js";

import {
  buildActivationData,
  buildRenewalData,
  getSubscriptionLifecycleAction
} from "../src/js/services/subscriptionLifecycle.js";


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
// ADMIN AUTHORIZATION
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
// APPROVE PAYMENT
// ========================================

async function approvePayment(
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
      "No tienes autorización para aprobar pagos.",
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
        // PAYMENT STATUS
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
        // REQUIRED PAYMENT DATA
        // ==================================

        if (
          !payment.accountId
        ) {

          throw new Error(
            "ACCOUNT_ID_MISSING"
          );

        }


        if (
          !payment.subscriptionId
        ) {

          throw new Error(
            "SUBSCRIPTION_ID_MISSING"
          );

        }


        if (
          !payment.planId
        ) {

          throw new Error(
            "PLAN_ID_MISSING"
          );

        }


        // ==================================
        // SUBSCRIPTION
        // ==================================

        const subscriptionRef =
          adminDb
            .collection(
              "subscriptions"
            )
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
        // ACCOUNT CONSISTENCY
        // ==================================

        if (
          subscription.accountId !==
          payment.accountId
        ) {

          throw new Error(
            "ACCOUNT_MISMATCH"
          );

        }


        // ==================================
        // CURRENT PLAN CONSISTENCY
        // ==================================
        //
        // payment.planId =
        // TARGET PLAN
        //
        // subscription.planId =
        // CURRENT PLAN
        //
        // Therefore:
        //
        // FREE -> PRO
        // payment.planId = pro
        // subscription.planId = free
        //
        // is valid.
        //
        // For stale payments, currentPlanId
        // allows us to detect that the
        // subscription changed after payment
        // creation.
        //
        // Legacy payments without
        // currentPlanId remain compatible.
        // ==================================

        if (
          payment.currentPlanId &&
          payment.currentPlanId !==
            subscription.planId
        ) {

          throw new Error(
            "CURRENT_PLAN_MISMATCH"
          );

        }


        // ==================================
        // LIFECYCLE ACTION
        // ==================================

        const lifecycleAction =
          getSubscriptionLifecycleAction(
            subscription
          );


        if (!lifecycleAction) {

          throw new Error(
            "INVALID_SUBSCRIPTION_LIFECYCLE"
          );

        }


        // ==================================
        // TARGET PLAN VALIDATION
        // ==================================

        const currentPlanId =
          subscription.planId;

        const targetPlanId =
          payment.planId;


        // ==================================
        // ACTIVATION / UPGRADE
        // ==================================

        if (
          lifecycleAction ===
          "activate"
        ) {

          // Initial activation may change
          // the subscription plan.
          //
          // Example:
          //
          // FREE -> PRO

          if (
            targetPlanId ===
            "free"
          ) {

            throw new Error(
              "INVALID_TARGET_PLAN"
            );

          }

        }


        // ==================================
        // RENEWAL
        // ==================================

        if (
          lifecycleAction ===
          "renew"
        ) {

          // A renewal must be for the
          // currently active plan.

          if (
            targetPlanId !==
            currentPlanId
          ) {

            throw new Error(
              "RENEWAL_PLAN_MISMATCH"
            );

          }

        }


        // ==================================
        // BUILD SUBSCRIPTION UPDATE
        // ==================================

        const now =
          new Date();


        let subscriptionUpdate;


        if (
          lifecycleAction ===
          "activate"
        ) {

          subscriptionUpdate = {

            ...buildActivationData(
              subscription,
              now
            ),

            // The payment plan becomes
            // the new active subscription
            // plan.
            planId:
              targetPlanId

          };

        } else {

          subscriptionUpdate =
            buildRenewalData(
              subscription,
              now
            );

        }


        // ==================================
        // APPROVE PAYMENT
        // ==================================

        transaction.update(
          paymentRef,
          {

            status:
              "approved",

            reviewedBy:
              decodedToken.uid,

            reviewedAt:
              now,

            rejectionReason:
              null,

            updatedAt:
              now

          }
        );


        // ==================================
        // UPDATE SUBSCRIPTION
        // ==================================

        transaction.update(
          subscriptionRef,
          subscriptionUpdate
        );


        // ==================================
        // UPDATE ACCOUNT
        // ==================================
        //
        // account.planId is maintained as
        // a cached/current reference.
        //
        // The subscription remains the
        // authoritative billing state.
        // ==================================

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
              subscriptionUpdate.planId ||
              currentPlanId,

            subscriptionId:
              payment.subscriptionId,

            updatedAt:
              now

          }
        );


        // ==================================
        // RESULT
        // ==================================

        return {

          paymentId,

          subscriptionId:
            payment.subscriptionId,

          planId:
            subscriptionUpdate.planId ||
            currentPlanId,

          previousPlanId:
            currentPlanId,

          lifecycleAction,

          currentPeriodStart:
            subscriptionUpdate.currentPeriodStart,

          currentPeriodEnd:
            subscriptionUpdate.currentPeriodEnd,

          nextBillingAt:
            subscriptionUpdate.nextBillingAt

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
            "approved"

        },


      subscription:
        {

          id:
            result.subscriptionId,

          planId:
            result.planId,

          previousPlanId:
            result.previousPlanId,

          status:
            "active",

          lifecycleAction:
            result.lifecycleAction,

          currentPeriodStart:
            result.currentPeriodStart,

          currentPeriodEnd:
            result.currentPeriodEnd,

          nextBillingAt:
            result.nextBillingAt

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


      case "ACCOUNT_ID_MISSING":

        return errorResponse(
          res,
          "El pago no tiene una cuenta asociada.",
          400
        );


      case "SUBSCRIPTION_ID_MISSING":

        return errorResponse(
          res,
          "El pago no tiene una suscripción asociada.",
          400
        );


      case "PLAN_ID_MISSING":

        return errorResponse(
          res,
          "El pago no tiene un plan objetivo asociado.",
          400
        );


      case "SUBSCRIPTION_NOT_FOUND":

        return errorResponse(
          res,
          "La suscripción asociada no existe.",
          404
        );


      case "ACCOUNT_MISMATCH":

        return errorResponse(
          res,
          "La cuenta del pago y la suscripción no coinciden.",
          409
        );


      case "CURRENT_PLAN_MISMATCH":

        return errorResponse(
          res,
          "La suscripción cambió después de crear el pago. El pago debe revisarse nuevamente.",
          409
        );


      case "RENEWAL_PLAN_MISMATCH":

        return errorResponse(
          res,
          "El pago de renovación no corresponde al plan actual de la suscripción.",
          409
        );


      case "INVALID_TARGET_PLAN":

        return errorResponse(
          res,
          "El plan objetivo no es válido para esta activación.",
          400
        );


      case "INVALID_SUBSCRIPTION_LIFECYCLE":

        return errorResponse(
          res,
          "La suscripción no se encuentra en un estado válido para esta operación.",
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