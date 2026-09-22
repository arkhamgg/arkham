// ========================================
// ARKHAM — Billing Payment API
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

import {
  getPlanPrice,
  getProductPlanPrice
} from "../billingConfig.js";


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
// El precio continúa siendo controlado
// exclusivamente por billingConfig.js.
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
    productId = null,
    entityType = null,
    entityId = null,
    subscriptionId = null,
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
    !planId
  ) {

    return errorResponse(
      res,
      "planId es obligatorio.",
      400
    );

  }


  // ========================================
  // BILLING PRODUCT CONTEXT
  // ========================================
  //
  // Los pagos históricos omiten productId y
  // conservan el flujo account-level existente.
  // Team utiliza un contexto explícito.
  //

  const isTeamBilling =
    productId === "team";

  if (productId && !isTeamBilling) {

    return errorResponse(
      res,
      "El producto de Billing no es válido.",
      400
    );

  }

  if (isTeamBilling) {

    if (entityType !== "team" || !entityId) {

      return errorResponse(
        res,
        "El pago de Team requiere una entidad Team válida.",
        400
      );

    }

  } else if (entityType || entityId) {

    return errorResponse(
      res,
      "El contexto de entidad no corresponde al Billing actual.",
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
  //
  // - amount
  // - currency
  //
  // El backend obtiene ambos valores
  // desde billingConfig.js.
  //

  const pricing =
    isTeamBilling
      ? getProductPlanPrice(
          productId,
          planId,
          period
        )
      : getPlanPrice(
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
      "ARKHAMS — Billing: precio inválido.",
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
      "ARKHAM — Billing: moneda inválida.",
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
  // BILLING ENTITY
  // ========================================

  let billingEntity = null;

  if (isTeamBilling) {

    const teamRef =
      adminDb
        .collection("teams")
        .doc(entityId);

    const teamSnapshot =
      await teamRef.get();

    if (!teamSnapshot.exists) {
      return errorResponse(res, "El Team no existe.", 404);
    }

    billingEntity = teamSnapshot.data();

    if (billingEntity.ownerId !== uid) {
      return errorResponse(res, "No tienes permisos para gestionar el Billing de este Team.", 403);
    }

  }


  // ========================================
  // ACCOUNT PLAN
  // ========================================

  const accountPlanId =
    account.planId ||
    "free";

  const currentPlanId =
    isTeamBilling
      ? (billingEntity?.planId || "free")
      : accountPlanId;


  // ========================================
  // PAYMENT TRANSITION
  // ========================================
  //
  // Free → Pro
  //
  // No existe todavía una subscription.
  //
  // Pro → Pro
  //
  // Existe una subscription y se renueva.
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
  // FREE → PRO
  // ========================================
  //
  // El usuario todavía NO tiene
  // una subscription.
  //
  // La subscription será creada
  // únicamente cuando el administrador
  // apruebe el pago.
  //

  if (
    isInitialUpgrade
  ) {

    if (
      subscriptionId
    ) {

      return errorResponse(
        res,
        "El pago inicial Free → Pro no debe tener una suscripción asociada.",
        409
      );

    }


    if (
      isTeamBilling
        ? billingEntity?.subscriptionId
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
  // PRO → PRO
  // ========================================
  //
  // Una renovación siempre necesita
  // la subscription existente.
  //

  if (
    isProRenewal
  ) {

    if (
      !subscriptionId
    ) {

      return errorResponse(
        res,
        "La renovación Pro requiere una suscripción asociada.",
        400
      );

    }


    const expectedSubscriptionId =
      isTeamBilling
        ? billingEntity?.subscriptionId
        : account.subscriptionId;

    if (
      expectedSubscriptionId !==
      subscriptionId
    ) {

      return errorResponse(
        res,
        "La suscripción indicada no corresponde a la cuenta.",
        403
      );

    }

  }


  // ========================================
  // SUBSCRIPTION
  // ========================================
  //
  // Solo consultamos una suscripción
  // cuando el flujo realmente la necesita.
  //

  let subscription =
    null;


  if (
    subscriptionId
  ) {

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

    if (isTeamBilling && (
      subscription.productId !== "team" ||
      subscription.entityType !== "team" ||
      subscription.entityId !== entityId
    )) {

      return errorResponse(
        res,
        "La suscripción no corresponde a este Team.",
        403
      );

    }


    // ======================================
    // CURRENT PLAN
    // ======================================

    if (
      !subscription.planId
    ) {

      return errorResponse(
        res,
        "La suscripción no tiene un plan actual.",
        409
      );

    }


    if (
      subscription.planId !==
      currentPlanId
    ) {

      return errorResponse(
        res,
        "La suscripción no coincide con el plan actual de la cuenta.",
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
        "No se puede realizar un pago sobre una suscripción cancelada.",
        409
      );

    }

  }


  // ========================================
  // PAYMENT PERIOD VALIDATION
  // ========================================
  //
  // Para Pro → Pro:
  // el período debe coincidir con
  // el de la suscripción.
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
  // Buscamos pagos activos de la cuenta.
  //
  // No dependemos de subscriptionId porque
  // Free → Pro puede tener subscriptionId null.
  //

  const existingPaymentsSnapshot =
    await adminDb
      .collection("payments")
      .where(
        "accountId",
        "==",
        uid
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
        payment => {

          const isActiveStatus =
            payment.status ===
              PAYMENT_STATUS.PENDING ||
            payment.status ===
              PAYMENT_STATUS.UNDER_REVIEW;


          if (
            !isActiveStatus
          ) {

            return false;

          }

          if (isTeamBilling) {
            if (
              payment.productId !== "team" ||
              payment.entityType !== "team" ||
              payment.entityId !== entityId
            ) {
              return false;
            }
          } else if (payment.productId) {
            return false;
          }


          // ==================================
          // MATCH INITIAL UPGRADE
          // ==================================

          if (
            isInitialUpgrade
          ) {

            return (
              payment.currentPlanId ===
                "free" &&
              payment.planId ===
                "pro"
            );

          }


          // ==================================
          // MATCH PRO RENEWAL
          // ==================================

          if (
            isProRenewal
          ) {

            return (
              payment.subscriptionId ===
                subscriptionId &&
              payment.currentPlanId ===
                "pro" &&
              payment.planId ===
                "pro"
            );

          }


          return false;

        }
      );


  if (
    activePayment
  ) {

    return errorResponse(
      res,
      isInitialUpgrade
        ? "Ya existe un pago pendiente o en revisión para la activación de Pro."
        : "Ya existe un pago pendiente o en revisión para esta suscripción.",
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


  // ========================================
  // PAYMENT DATA
  // ========================================

  const paymentData = {

    // ======================================
    // OWNERSHIP
    // ======================================

    accountId:
      uid,


    // ======================================
    // PRODUCT / ENTITY CONTEXT
    // ======================================

    ...(isTeamBilling
      ? {
          productId,
          entityType,
          entityId
        }
      : {}),


    // ======================================
    // SUBSCRIPTION
    // ======================================
    //
    // Free → Pro:
    // null
    //
    // Pro → Pro:
    // subscription existente
    //

    subscriptionId:
      subscriptionId ||
      null,


    // ======================================
    // PLAN CONTEXT
    // ======================================
    //
    // currentPlanId:
    // plan actual al crear el pago.
    //
    // planId:
    // plan objetivo.
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
    // ======================================

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

        ...(isTeamBilling
          ? { productId, entityType, entityId }
          : {}),

        subscriptionId:
          subscriptionId ||
          null,

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
    req.method !== "POST" &&
    req.method !== "GET"
  ) {

    res.setHeader(
      "Allow",
      "GET, POST"
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
    // GET CURRENT ACCOUNT PAYMENT
    // ======================================

    if (req.method === "GET") {

      const uid = decodedToken.uid;
      const requestedTeamId =
        String(req.query?.teamId || "").trim();

      if (requestedTeamId) {

        const teamRef =
          adminDb
            .collection("teams")
            .doc(requestedTeamId);

        const teamSnapshot =
          await teamRef.get();

        if (!teamSnapshot.exists) {
          return errorResponse(res, "El Team no existe.", 404);
        }

        const team =
          teamSnapshot.data();

        if (team.ownerId !== uid) {
          return errorResponse(res, "No tienes permisos para consultar el Billing de este Team.", 403);
        }

        const snapshot =
          await adminDb
            .collection("payments")
            .where("accountId", "==", uid)
            .get();

        const payments =
          snapshot.docs
            .map((document) => ({
              id: document.id,
              ...document.data()
            }))
            .filter((payment) =>
              payment.productId === "team" &&
              payment.entityType === "team" &&
              payment.entityId === requestedTeamId
            )
            .sort((a, b) => {
              const getTime = (value) => {
                if (!value) return 0;
                if (typeof value.toMillis === "function") return value.toMillis();
                if (typeof value.toDate === "function") return value.toDate().getTime();
                const time = new Date(value).getTime();
                return Number.isNaN(time) ? 0 : time;
              };
              return getTime(b.createdAt) - getTime(a.createdAt);
            });

        let subscription = null;

        if (team.subscriptionId) {
          const subscriptionSnapshot =
            await adminDb
              .collection("subscriptions")
              .doc(team.subscriptionId)
              .get();

          if (subscriptionSnapshot.exists) {
            const candidate = subscriptionSnapshot.data();
            if (
              candidate.accountId === uid &&
              candidate.productId === "team" &&
              candidate.entityType === "team" &&
              candidate.entityId === requestedTeamId
            ) {
              subscription = {
                id: subscriptionSnapshot.id,
                ...candidate
              };
            }
          }
        }

        return successResponse(
          res,
          {
            team: {
              id: requestedTeamId,
              ...team
            },
            subscription,
            payment: payments[0] || null
          }
        );

      }

      const snapshot =
        await adminDb
          .collection("payments")
          .where("accountId", "==", uid)
          .get();

      const payments =
        snapshot.docs
          .map((document) => ({
            id: document.id,
            ...document.data()
          }))
          .sort((a, b) => {

            const getTime = (value) => {

              if (!value) return 0;

              if (typeof value.toMillis === "function") {
                return value.toMillis();
              }

              if (typeof value.toDate === "function") {
                return value.toDate().getTime();
              }

              const time = new Date(value).getTime();

              return Number.isNaN(time) ? 0 : time;

            };

            return getTime(b.createdAt) - getTime(a.createdAt);

          });

      const payment = payments[0] || null;

      return successResponse(
        res,
        { payment }
      );

    }


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
      "ARKHAM — Billing Payment API:",
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
      "Ocurrió un error al crear el pago.",
      500
    );

  }

}