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
} from "../firebaseAdmin.js";


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

  const isTeamBilling =
    payment.productId === "team";

  if (isTeamBilling && (
    payment.entityType !== "team" ||
    !payment.entityId
  )) {
    return errorResponse(res, "El pago de Team no tiene un contexto válido.", 409);
  }


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
      "El pago no tiene registrado el plan actual.",
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
  // PAYMENT TRANSITION
  // ========================================

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
  // SUBSCRIPTION CONTEXT
  // ========================================
  //
  // FREE → PRO
  //
  // No necesita subscriptionId.
  //
  // PRO → PRO
  //
  // Debe tener subscriptionId.
  //

  if (
    isInitialUpgrade
  ) {

    if (
      payment.subscriptionId
    ) {

      return errorResponse(
        res,
        "El pago inicial Free → Pro no debe tener una suscripción asociada.",
        409
      );

    }

  }


  if (
    isProRenewal &&
    !payment.subscriptionId
  ) {

    return errorResponse(
      res,
      "La renovación Pro requiere una suscripción asociada.",
      409
    );

  }


  // ========================================
  // EXISTING SUBSCRIPTION
  // ========================================

  let subscriptionRef =
    null;

  let subscriptionSnapshot =
    null;

  let subscription =
    null;


  if (
    payment.subscriptionId
  ) {

    subscriptionRef =
      adminDb
        .collection("subscriptions")
        .doc(
          payment.subscriptionId
        );


    subscriptionSnapshot =
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


    subscription =
      subscriptionSnapshot.data();


    // ======================================
    // SUBSCRIPTION OWNERSHIP
    // ======================================

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


    // ======================================
    // CURRENT PLAN VALIDATION
    // ======================================

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


    // ======================================
    // SUBSCRIPTION STATUS
    // ======================================

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

  let team = null;

  if (isTeamBilling) {
    const teamRef = adminDb.collection("teams").doc(payment.entityId);
    const teamSnapshot = await teamRef.get();
    if (!teamSnapshot.exists) {
      return errorResponse(res, "El Team no existe.", 404);
    }
    team = teamSnapshot.data();
    if (team.ownerId !== uid) {
      return errorResponse(res, "No tienes permisos para este Team.", 403);
    }
  }


  // ========================================
  // INITIAL UPGRADE VALIDATION
  // ========================================
  //
  // Para Free → Pro:
  //
  // - La cuenta debe seguir siendo Free.
  // - No debe tener una suscripción activa
  //   o asociada.
  // - El payment debe seguir sin subscriptionId.
  //
  // Esto evita aprobar un pago viejo después
  // de que la cuenta haya cambiado de estado.
  //

  if (
    isInitialUpgrade
  ) {

    const currentEntityPlanId =
      isTeamBilling
        ? (team?.planId || "free")
        : (account.planId || "free");

    if (currentEntityPlanId !== "free") {

      return errorResponse(
        res,
        isTeamBilling
          ? "El Team ya no se encuentra en el plan Free. Debes actualizar el estado antes de continuar."
          : "La cuenta ya no se encuentra en el plan Free. Debes actualizar el estado antes de continuar.",
        409
      );

    }


    if (
      isTeamBilling
        ? team?.subscriptionId
        : account.subscriptionId
    ) {

      return errorResponse(
        res,
        isTeamBilling
          ? "El Team ya tiene una suscripción asociada. Debes utilizar el flujo de renovación correspondiente."
          : "La cuenta ya tiene una suscripción asociada. Debes utilizar el flujo de renovación correspondiente.",
        409
      );

    }

  }


  // ========================================
  // RENEWAL PLAN VALIDATION
  // ========================================

  if (
    isProRenewal
  ) {

    if (
      !subscription
    ) {

      return errorResponse(
        res,
        "La renovación Pro requiere una suscripción válida.",
        409
      );

    }


    if (
      payment.planId !==
      subscription.planId
    ) {

      return errorResponse(
        res,
        "El plan del pago no coincide con el plan actual de la suscripción.",
        409
      );

    }

  }


  // ========================================
  // TRANSACTION
  // ========================================
  //
  // Volvemos a leer el pago y la cuenta
  // dentro de una transacción.
  //
  // Para Free → Pro también volvemos a
  // validar que la cuenta continúe siendo Free.
  //

  const transactionResult =
    await adminDb.runTransaction(
      async transaction => {

        // ==================================
        // READ PAYMENT
        // ==================================

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
        // READ ACCOUNT
        // ==================================

        const freshAccountSnapshot =
          await transaction.get(
            accountRef
          );


        if (
          !freshAccountSnapshot.exists
        ) {

          throw new Error(
            "ACCOUNT_NOT_FOUND"
          );

        }


        const freshAccount =
          freshAccountSnapshot.data();

        let freshTeam = null;

        if (freshPayment.productId === "team") {
          if (freshPayment.entityType !== "team" || !freshPayment.entityId) {
            throw new Error("TEAM_BILLING_CONTEXT_MISSING");
          }
          const freshTeamRef = adminDb.collection("teams").doc(freshPayment.entityId);
          const freshTeamSnapshot = await transaction.get(freshTeamRef);
          if (!freshTeamSnapshot.exists) {
            throw new Error("TEAM_NOT_FOUND");
          }
          freshTeam = freshTeamSnapshot.data();
          if (freshTeam.ownerId !== uid) {
            throw new Error("TEAM_OWNER_MISMATCH");
          }
        }


        // ==================================
        // PAYMENT OWNERSHIP
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
        // PAYMENT STATUS
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
        // PAYMENT PROOF
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
        // PAYMENT TRANSITION
        // ==================================

        const freshIsInitialUpgrade =
          freshPayment.currentPlanId === "free" &&
          freshPayment.planId === "pro";

        const freshIsProRenewal =
          freshPayment.currentPlanId === "pro" &&
          freshPayment.planId === "pro";


        if (
          !freshIsInitialUpgrade &&
          !freshIsProRenewal
        ) {

          throw new Error(
            "PAYMENT_TRANSITION_INVALID"
          );

        }


        // ==================================
        // FREE → PRO
        // ==================================

        if (
          freshIsInitialUpgrade
        ) {

          // Payment inicial no debe tener
          // subscriptionId.

          if (
            freshPayment.subscriptionId
          ) {

            throw new Error(
              "INITIAL_UPGRADE_HAS_SUBSCRIPTION"
            );

          }


          const freshEntityPlanId =
            freshPayment.productId === "team"
              ? (freshTeam?.planId || "free")
              : (freshAccount.planId || "free");

          if (freshEntityPlanId !== "free") {
            throw new Error("ACCOUNT_PLAN_CHANGED");
          }

          const freshEntitySubscriptionId =
            freshPayment.productId === "team"
              ? freshTeam?.subscriptionId
              : freshAccount.subscriptionId;

          if (freshEntitySubscriptionId) {
            throw new Error("ACCOUNT_ALREADY_HAS_SUBSCRIPTION");
          }

        }


        // ==================================
        // PRO → PRO
        // ==================================

        if (
          freshIsProRenewal
        ) {

          if (
            !freshPayment.subscriptionId
          ) {

            throw new Error(
              "SUBSCRIPTION_REQUIRED"
            );

          }

        }


        // ==================================
        // EXISTING SUBSCRIPTION
        // ==================================

        if (
          freshPayment.subscriptionId
        ) {

          const freshSubscriptionRef =
            adminDb
              .collection("subscriptions")
              .doc(
                freshPayment.subscriptionId
              );


          const freshSubscriptionSnapshot =
            await transaction.get(
              freshSubscriptionRef
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

          if (freshPayment.productId === "team" && (
            freshSubscription.productId !== "team" ||
            freshSubscription.entityType !== "team" ||
            freshSubscription.entityId !== freshPayment.entityId
          )) {
            throw new Error("SUBSCRIPTION_TEAM_MISMATCH");
          }


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


        // ==================================
        // RESPONSE
        // ==================================

        return {

          paymentId,

          accountId:
            freshPayment.accountId,

          subscriptionId:
            freshPayment.subscriptionId ||
            null,

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


      case "ACCOUNT_NOT_FOUND":

        return errorResponse(
          res,
          "La cuenta no existe.",
          404
        );


      case "ACCOUNT_PLAN_CHANGED":

        return errorResponse(
          res,
          "La cuenta ya no se encuentra en el plan Free. Debes generar un nuevo pago.",
          409
        );


      case "ACCOUNT_ALREADY_HAS_SUBSCRIPTION":

        return errorResponse(
          res,
          "La cuenta ya tiene una suscripción asociada. Debes utilizar el flujo de renovación correspondiente.",
          409
        );


      case "INITIAL_UPGRADE_HAS_SUBSCRIPTION":

        return errorResponse(
          res,
          "El pago inicial Free → Pro no debe tener una suscripción asociada.",
          409
        );


      case "SUBSCRIPTION_REQUIRED":

        return errorResponse(
          res,
          "La renovación Pro requiere una suscripción asociada.",
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


      case "PAYMENT_TRANSITION_INVALID":

        return errorResponse(
          res,
          "La transición del pago no está disponible.",
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