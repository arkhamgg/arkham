// ========================================
// NEXUS — Admin Billing Payments API
// ========================================
//
// GET /api/admin-billing-payments
//
// Arquitectura:
//
// Admin UI
//    ↓
// Firebase ID Token
//    ↓
// /api/admin-billing-payments
//    ↓
// Firebase Admin SDK
//    ↓
// adminUsers
//    ↓
// payments
//
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


// ========================================
// CONSTANTS
// ========================================

const ADMIN_USERS_COLLECTION =
  "adminUsers";

const PAYMENTS_COLLECTION =
  "payments";

const SUBSCRIPTIONS_COLLECTION =
  "subscriptions";

const ACCOUNTS_COLLECTION =
  "accounts";


// ========================================
// ADMIN ROLES
// ========================================

const ADMIN_ROLES = {

  ADMINISTRATOR:
    "administrator",

  AGENT:
    "agent"

};


// ========================================
// ADMIN STATUS
// ========================================

const ADMIN_USER_STATUS = {

  ACTIVE:
    "active",

  INACTIVE:
    "inactive"

};


// ========================================
// ROLE PERMISSIONS
// ========================================

const ROLE_PERMISSIONS = {

  administrator: [

    "accounts.view",
    "accounts.manage",

    "staff.view",
    "staff.manage",

    "products.view",
    "products.manage",

    "plans.view",
    "plans.manage",

    "capabilities.view",
    "capabilities.manage",

    "subscriptions.view",
    "subscriptions.manage",

    "payments.view",
    "payments.review",
    "payments.approve",
    "payments.reject",

    "billing.view",
    "billing.manage",

    "audit.view"

  ],

  agent: [

    "accounts.view",

    "staff.view",

    "products.view",

    "plans.view",

    "capabilities.view",

    "subscriptions.view",

    "payments.view",
    "payments.review",

    "billing.view"

  ]

};


// ========================================
// RESPONSE HELPERS
// ========================================

function successResponse(
  res,
  data = {},
  status = 200
) {

  return res.status(
    status
  ).json({

    success:
      true,

    ...data

  });

}


function errorResponse(
  res,
  message,
  status = 400
) {

  return res.status(
    status
  ).json({

    success:
      false,

    error:
      message

  });

}


// ========================================
// BEARER TOKEN
// ========================================

function getBearerToken(
  req
) {

  const authorization =
    req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer "
    )
  ) {

    return null;

  }

  const token =
    authorization
      .slice(7)
      .trim();

  return token ||
    null;

}


// ========================================
// AUTHENTICATED ADMIN
// ========================================

async function getAuthenticatedAdmin(
  req
) {

  const idToken =
    getBearerToken(
      req
    );

  if (!idToken) {

    const error =
      new Error(
        "No se proporcionó un token de autenticación."
      );

    error.status =
      401;

    throw error;

  }

  const app =
    getFirebaseAdminApp();

  const adminAuth =
    getAuth(
      app
    );

  const firestore =
    getFirestore(
      app
    );


  // ----------------------------------------
  // VERIFY FIREBASE TOKEN
  // ----------------------------------------

  let decodedToken;

  try {

    decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );

  } catch {

    const error =
      new Error(
        "El token de autenticación no es válido."
      );

    error.status =
      401;

    throw error;

  }


  const uid =
    decodedToken.uid;


  // ----------------------------------------
  // GET ADMIN USER
  // ----------------------------------------

  const adminSnapshot =
    await firestore
      .collection(
        ADMIN_USERS_COLLECTION
      )
      .doc(
        uid
      )
      .get();


  if (
    !adminSnapshot.exists
  ) {

    const error =
      new Error(
        "El usuario no tiene acceso administrativo."
      );

    error.status =
      403;

    throw error;

  }


  const adminUser =
    adminSnapshot.data();


  const roleId =
    adminUser.roleId;


  const status =
    adminUser.status ||
    ADMIN_USER_STATUS.ACTIVE;


  // ----------------------------------------
  // STATUS
  // ----------------------------------------

  if (
    status !==
    ADMIN_USER_STATUS.ACTIVE
  ) {

    const error =
      new Error(
        "El usuario administrativo está inactivo."
      );

    error.status =
      403;

    throw error;

  }


  // ----------------------------------------
  // ROLE
  // ----------------------------------------

  if (
    !ROLE_PERMISSIONS[
      roleId
    ]
  ) {

    const error =
      new Error(
        "El rol administrativo no es válido."
      );

    error.status =
      403;

    throw error;

  }


  const permissions =
    ROLE_PERMISSIONS[
      roleId
    ] || [];


  return {

    uid,

    roleId,

    status,

    permissions,

    adminUser,

    firestore,

    adminAuth

  };

}


// ========================================
// REQUIRE PERMISSION
// ========================================

function requirePermission(
  access,
  permission
) {

  if (
    !access.permissions.includes(
      permission
    )
  ) {

    const error =
      new Error(
        "No tienes permisos para consultar los pagos."
      );

    error.status =
      403;

    throw error;

  }

}


// ========================================
// DATE NORMALIZER
// ========================================

function normalizeDate(
  value
) {

  if (!value) {

    return null;

  }


  if (
    typeof value.toDate ===
    "function"
  ) {

    return value
      .toDate()
      .toISOString();

  }


  if (
    value instanceof Date
  ) {

    return value.toISOString();

  }


  if (
    typeof value ===
    "string"
  ) {

    return value;

  }


  return null;

}


// ========================================
// PAYMENT NORMALIZER
// ========================================

function normalizePayment(
  document
) {

  const data =
    document.data();


  return {

    id:
      document.id,

    accountId:
      data.accountId ||
      null,

    subscriptionId:
      data.subscriptionId ||
      null,

    planId:
      data.planId ||
      null,

    currentPlanId:
      data.currentPlanId ||
      null,

    amount:
      Number(
        data.amount || 0
      ),

    currency:
      data.currency ||
      "GTQ",

    method:
      data.method ||
      null,

    status:
      data.status ||
      null,

    paymentDate:
      data.paymentDate ||
      null,

    paymentTime:
      data.paymentTime ||
      null,

    reference:
      data.reference ||
      null,

    proof:
      data.proof ||
      null,

    notes:
      data.notes ||
      null,

    submittedAt:
      normalizeDate(
        data.submittedAt
      ),

    reviewedBy:
      data.reviewedBy ||
      null,

    reviewedAt:
      normalizeDate(
        data.reviewedAt
      ),

    rejectionReason:
      data.rejectionReason ||
      null,

    createdAt:
      normalizeDate(
        data.createdAt
      ),

    updatedAt:
      normalizeDate(
        data.updatedAt
      )

  };

}


// ========================================
// SORT VALUE
// ========================================

function getTimestampValue(
  value
) {

  if (!value) {

    return 0;

  }


  const timestamp =
    new Date(
      value
    ).getTime();


  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : 0;

}


// ========================================
// GET PAYMENTS
// ========================================

async function handleGet(
  req,
  res
) {

  try {

    console.log(
      "NEXUS — Admin Billing Payments: GET recibido."
    );


    // ------------------------------------
    // AUTH
    // ------------------------------------

    const access =
      await getAuthenticatedAdmin(
        req
      );


    console.log(
      "NEXUS — Admin Billing Payments: autenticación OK.",
      {
        uid:
          access.uid,

        role:
          access.roleId
      }
    );


    // ------------------------------------
    // PERMISSION
    // ------------------------------------

    requirePermission(
      access,
      "payments.view"
    );


    // ------------------------------------
    // PAYMENTS
    // ------------------------------------

    const paymentsSnapshot =
      await access.firestore
        .collection(
          PAYMENTS_COLLECTION
        )
        .get();


    const payments =
      paymentsSnapshot.docs
        .map(
          normalizePayment
        );


    // ------------------------------------
    // RELATED IDS
    // ------------------------------------

    const accountIds =
      [
        ...new Set(
          payments
            .map(
              payment =>
                payment.accountId
            )
            .filter(
              Boolean
            )
        )
      ];


    const subscriptionIds =
      [
        ...new Set(
          payments
            .map(
              payment =>
                payment.subscriptionId
            )
            .filter(
              Boolean
            )
        )
      ];


    // ------------------------------------
    // ACCOUNTS
    // ------------------------------------

    const accounts =
      new Map();


    for (
      const accountId
      of accountIds
    ) {

      const accountSnapshot =
        await access.firestore
          .collection(
            ACCOUNTS_COLLECTION
          )
          .doc(
            accountId
          )
          .get();


      if (
        accountSnapshot.exists
      ) {

        const data =
          accountSnapshot.data();


        accounts.set(
          accountId,
          {

            id:
              accountSnapshot.id,

            name:
              data.name ||
              data.displayName ||
              null,

            email:
              data.email ||
              null,

            planId:
              data.planId ||
              null

          }
        );

      }

    }


    // ------------------------------------
    // SUBSCRIPTIONS
    // ------------------------------------

    const subscriptions =
      new Map();


    for (
      const subscriptionId
      of subscriptionIds
    ) {

      const subscriptionSnapshot =
        await access.firestore
          .collection(
            SUBSCRIPTIONS_COLLECTION
          )
          .doc(
            subscriptionId
          )
          .get();


      if (
        subscriptionSnapshot.exists
      ) {

        const data =
          subscriptionSnapshot.data();


        subscriptions.set(
          subscriptionId,
          {

            id:
              subscriptionSnapshot.id,

            accountId:
              data.accountId ||
              null,

            planId:
              data.planId ||
              null,

            status:
              data.status ||
              null,

            period:
              data.period ||
              null,

            currentPeriodStart:
              normalizeDate(
                data.currentPeriodStart
              ),

            currentPeriodEnd:
              normalizeDate(
                data.currentPeriodEnd
              ),

            nextBillingAt:
              normalizeDate(
                data.nextBillingAt
              )

          }
        );

      }

    }


    // ------------------------------------
    // ENRICH PAYMENTS
    // ------------------------------------

    const enrichedPayments =
      payments.map(
        payment => {

          const account =
            accounts.get(
              payment.accountId
            ) ||
            null;


          const subscription =
            subscriptions.get(
              payment.subscriptionId
            ) ||
            null;


          return {

            ...payment,

            account,

            subscription

          };

        }
      );


    // ------------------------------------
    // SORT
    // ------------------------------------

    enrichedPayments.sort(
      (
        a,
        b
      ) => {

        return (
          getTimestampValue(
            b.createdAt
          ) -
          getTimestampValue(
            a.createdAt
          )
        );

      }
    );


    // ------------------------------------
    // SUMMARY
    // ------------------------------------

    const summary = {

      total:
        enrichedPayments.length,

      pending:
        enrichedPayments.filter(
          payment =>
            payment.status ===
            "pending"
        ).length,

      underReview:
        enrichedPayments.filter(
          payment =>
            payment.status ===
            "under_review"
        ).length,

      approved:
        enrichedPayments.filter(
          payment =>
            payment.status ===
            "approved"
        ).length,

      rejected:
        enrichedPayments.filter(
          payment =>
            payment.status ===
            "rejected"
        ).length,

      expired:
        enrichedPayments.filter(
          payment =>
            payment.status ===
            "expired"
        ).length

    };


    // ------------------------------------
    // RESPONSE
    // ------------------------------------

    console.log(
      "NEXUS — Admin Billing Payments: pagos cargados.",
      {

        actorUid:
          access.uid,

        actorRole:
          access.roleId,

        count:
          enrichedPayments.length

      }
    );


    return successResponse(
      res,
      {

        payments:
          enrichedPayments,

        summary

      }
    );


  } catch (
    error
  ) {

    console.error(
      "NEXUS — Admin Billing Payments GET:",
      error
    );


    return errorResponse(
      res,
      error.message ||
        "No fue posible cargar los pagos.",
      error.status ||
        500
    );

  }

}


// ========================================
// METHOD ROUTER
// ========================================

export default async function handler(
  req,
  res
) {

  if (
    req.method !==
    "GET"
  ) {

    res.setHeader(
      "Allow",
      "GET"
    );

    return errorResponse(
      res,
      "Método no permitido.",
      405
    );

  }


  return handleGet(
    req,
    res
  );

}