// ========================================
// NEXUS — Billing Payment Proof API
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

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

const IMAGEKIT_PROOF_ROOT =
  "/nexus/payment-proofs";


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
// VALIDATION HELPERS
// ========================================

function normalizeString(
  value
) {

  if (
    typeof value !== "string"
  ) {

    return "";

  }

  return value.trim();

}


function normalizeSize(
  value
) {

  const size =
    Number(value);

  if (
    !Number.isFinite(size) ||
    size <= 0
  ) {

    return null;

  }

  return size;

}


function isValidHttpsUrl(
  value
) {

  try {

    const url =
      new URL(value);

    return (
      url.protocol === "https:"
    );

  } catch {

    return false;

  }

}


// ========================================
// IMAGEKIT PROOF DATA
// ========================================

function validateImageKitProof(
  proof,
  uid,
  paymentId
) {

  if (
    !proof ||
    typeof proof !== "object"
  ) {

    return {
      valid: false,
      error:
        "La información del comprobante no es válida."
    };

  }


  // ======================================
  // PROVIDER
  // ======================================

  const provider =
    normalizeString(
      proof.provider
    );

  if (
    provider !== "imagekit"
  ) {

    return {
      valid: false,
      error:
        "El comprobante debe estar almacenado en ImageKit."
    };

  }


  // ======================================
  // IMAGEKIT DATA
  // ======================================

  const fileId =
    normalizeString(
      proof.fileId
    );

  const filePath =
    normalizeString(
      proof.filePath
    );

  const url =
    normalizeString(
      proof.url
    );

  const fileName =
    normalizeString(
      proof.fileName
    );

  const contentType =
    normalizeString(
      proof.contentType
    );

  const size =
    normalizeSize(
      proof.size
    );


  // ======================================
  // FILE ID
  // ======================================

  if (!fileId) {

    return {
      valid: false,
      error:
        "El comprobante no contiene un fileId de ImageKit."
    };

  }


  // ======================================
  // FILE PATH
  // ======================================

  if (!filePath) {

    return {
      valid: false,
      error:
        "El comprobante no contiene un filePath de ImageKit."
    };

  }


  // ======================================
  // EXPECTED IMAGEKIT PATH
  // ======================================

  const expectedPrefix =
    `${IMAGEKIT_PROOF_ROOT}/${uid}/${paymentId}/`;

  if (
    !filePath.startsWith(
      expectedPrefix
    )
  ) {

    return {
      valid: false,
      error:
        "La ruta del comprobante no corresponde a este pago."
    };

  }


  // ======================================
  // URL
  // ======================================

  if (!url) {

    return {
      valid: false,
      error:
        "El comprobante no contiene una URL válida."
    };

  }

  if (
    !isValidHttpsUrl(url)
  ) {

    return {
      valid: false,
      error:
        "La URL del comprobante no es válida."
    };

  }


  // ======================================
  // FILE NAME
  // ======================================

  if (!fileName) {

    return {
      valid: false,
      error:
        "El nombre del comprobante es obligatorio."
    };

  }


  // ======================================
  // CONTENT TYPE
  // ======================================

  if (
    !ALLOWED_CONTENT_TYPES.includes(
      contentType
    )
  ) {

    return {
      valid: false,
      error:
        "El tipo de comprobante no está permitido. Usa JPG, PNG, WEBP o PDF."
    };

  }


  // ======================================
  // FILE SIZE
  // ======================================

  if (
    size === null
  ) {

    return {
      valid: false,
      error:
        "El tamaño del comprobante no es válido."
    };

  }


  if (
    size > MAX_FILE_SIZE
  ) {

    return {
      valid: false,
      error:
        "El comprobante no puede superar los 5 MB."
    };

  }


  // ======================================
  // NORMALIZED PROOF
  // ========================================

  return {
    valid: true,
    proof: {
      provider: "imagekit",
      fileId,
      filePath,
      url,
      fileName,
      contentType,
      size
    }
  };

}


// ========================================
// PAYMENT PROOF
// ========================================

async function attachPaymentProof(
  req,
  res,
  decodedToken
) {

  const uid =
    decodedToken.uid;


  // ======================================
  // BODY
  // ======================================

  const body =
    getRequestBody(req);

  if (!body) {

    return errorResponse(
      res,
      "El cuerpo de la solicitud no es válido.",
      400
    );

  }


  // ======================================
  // PAYMENT ID
  // ======================================

  const paymentId =
    normalizeString(
      body.paymentId
    );

  if (!paymentId) {

    return errorResponse(
      res,
      "paymentId es obligatorio.",
      400
    );

  }


  // ======================================
  // PAYMENT
  // ======================================

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


  // ======================================
  // OWNERSHIP
  // ======================================

  if (
    payment.accountId !== uid
  ) {

    return errorResponse(
      res,
      "Este pago no pertenece a tu cuenta.",
      403
    );

  }


  // ======================================
  // PAYMENT STATUS
  // ======================================

  if (
    payment.status !== "pending"
  ) {

    return errorResponse(
      res,
      "Solo se puede adjuntar un comprobante a un pago pendiente.",
      409
    );

  }


  // ======================================
  // PAYMENT CONTEXT
  // ======================================

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
    !payment.planId
  ) {

    return errorResponse(
      res,
      "El pago no tiene un plan objetivo.",
      409
    );

  }


  // ======================================
  // PAYMENT TRANSITION
  // ======================================

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


  // ======================================
  // SUBSCRIPTION CONTEXT
  // ======================================
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
    isInitialUpgrade &&
    payment.subscriptionId
  ) {

    return errorResponse(
      res,
      "El pago inicial Free → Pro no debe tener una suscripción asociada.",
      409
    );

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


  // ======================================
  // EXISTING SUBSCRIPTION
  // ======================================
  //
  // Solo se consulta cuando realmente
  // existe una subscriptionId.
  //

  if (
    payment.subscriptionId
  ) {

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


    // ====================================
    // SUBSCRIPTION OWNERSHIP
    // ====================================

    if (
      subscription.accountId !== uid
    ) {

      return errorResponse(
        res,
        "La suscripción no pertenece a esta cuenta.",
        403
      );

    }


    // ====================================
    // CURRENT PLAN
    // ====================================

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


    // ====================================
    // CANCELLED
    // ====================================

    if (
      subscription.status ===
      "cancelled"
    ) {

      return errorResponse(
        res,
        "No se puede adjuntar un comprobante a un pago asociado a una suscripción cancelada.",
        409
      );

    }

  }


  // ======================================
  // IMAGEKIT PROOF
  // ======================================

  const validation =
    validateImageKitProof(
      body.proof,
      uid,
      paymentId
    );


  if (
    !validation.valid
  ) {

    return errorResponse(
      res,
      validation.error,
      400
    );

  }


  const proof =
    validation.proof;


  // ======================================
  // UPDATE PAYMENT
  // ======================================

  await paymentRef.update({

    proof,

    proofUploadedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp()

  });


  // ======================================
  // RESPONSE
  // ======================================

  return successResponse(
    res,
    {
      payment: {
        id:
          paymentId,

        status:
          payment.status,

        subscriptionId:
          payment.subscriptionId ||
          null,

        currentPlanId:
          payment.currentPlanId,

        planId:
          payment.planId,

        proof
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

  // ======================================
  // METHOD
  // ======================================

  if (
    req.method !== "POST"
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

    // ====================================
    // AUTHENTICATE
    // ====================================

    const decodedToken =
      await authenticateRequest(
        req
      );


    // ====================================
    // ATTACH PROOF
    // ====================================

    return await attachPaymentProof(
      req,
      res,
      decodedToken
    );

  } catch (
    error
  ) {

    console.error(
      "NEXUS — Billing Payment Proof API:",
      error
    );


    // ====================================
    // AUTH ERRORS
    // ====================================

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


    // ====================================
    // SERVER ERROR
    // ====================================

    return errorResponse(
      res,
      "Ocurrió un error al registrar el comprobante.",
      500
    );

  }

}