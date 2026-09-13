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
  getStorage
} from "firebase-admin/storage";

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

const adminStorage =
  getStorage(firebaseAdminApp);


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
// BASE64 VALIDATION
// ========================================

function getBase64Buffer(
  fileData
) {

  if (
    typeof fileData !==
    "string"
  ) {

    return null;

  }


  let base64 =
    fileData;


  // ======================================
  // REMOVE DATA URL PREFIX
  // ======================================

  if (
    base64.startsWith(
      "data:"
    )
  ) {

    const commaIndex =
      base64.indexOf(",");


    if (
      commaIndex === -1
    ) {

      return null;

    }


    base64 =
      base64.substring(
        commaIndex + 1
      );

  }


  // ======================================
  // REMOVE WHITESPACE
  // ======================================

  base64 =
    base64.replace(
      /\s/g,
      ""
    );


  if (!base64) {

    return null;

  }


  try {

    return Buffer.from(
      base64,
      "base64"
    );

  } catch {

    return null;

  }

}


// ========================================
// SAFE FILE NAME
// ========================================

function sanitizeFileName(
  fileName
) {

  if (
    typeof fileName !==
    "string"
  ) {

    return "proof";

  }


  const sanitized =
    fileName
      .trim()
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );


  if (!sanitized) {

    return "proof";

  }


  return sanitized;

}


// ========================================
// CONTENT TYPE → EXTENSION
// ========================================

function getExtension(
  contentType
) {

  switch (
    contentType
  ) {

    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "application/pdf":
      return "pdf";

    default:
      return null;

  }

}


// ========================================
// UPLOAD PAYMENT PROOF
// ========================================

async function uploadPaymentProof(
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
    paymentId,
    fileName,
    contentType,
    fileData
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


  if (!contentType) {

    return errorResponse(
      res,
      "contentType es obligatorio.",
      400
    );

  }


  if (
    !ALLOWED_CONTENT_TYPES.includes(
      contentType
    )
  ) {

    return errorResponse(
      res,
      "El tipo de archivo no está permitido. Usa JPG, PNG, WEBP o PDF.",
      400
    );

  }


  if (!fileData) {

    return errorResponse(
      res,
      "fileData es obligatorio.",
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
    "pending"
  ) {

    return errorResponse(
      res,
      "Solo se puede adjuntar un comprobante a un pago pendiente.",
      409
    );

  }


  // ========================================
  // PAYMENT SUBSCRIPTION
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


  // ========================================
  // DECODE FILE
  // ========================================

  const fileBuffer =
    getBase64Buffer(
      fileData
    );


  if (!fileBuffer) {

    return errorResponse(
      res,
      "El archivo proporcionado no es válido.",
      400
    );

  }


  // ========================================
  // FILE SIZE
  // ========================================

  if (
    fileBuffer.length >
    MAX_FILE_SIZE
  ) {

    return errorResponse(
      res,
      "El comprobante no puede superar los 5 MB.",
      400
    );

  }


  if (
    fileBuffer.length ===
    0
  ) {

    return errorResponse(
      res,
      "El archivo está vacío.",
      400
    );

  }


  // ========================================
  // FILE NAME
  // ========================================

  const extension =
    getExtension(
      contentType
    );


  const safeFileName =
    sanitizeFileName(
      fileName
    );


  // ========================================
  // ENSURE CORRECT EXTENSION
  // ========================================

  let finalFileName =
    safeFileName;


  if (
    !finalFileName
      .toLowerCase()
      .endsWith(
        `.${extension}`
      )
  ) {

    finalFileName =
      `${finalFileName}.${extension}`;

  }


  // ========================================
  // STORAGE PATH
  // ========================================

  const storagePath =
    `payment-proofs/${uid}/${paymentId}/${finalFileName}`;


  const bucket =
    adminStorage.bucket();


  const file =
    bucket.file(
      storagePath
    );


  // ========================================
  // UPLOAD
  // ========================================

  await file.save(
    fileBuffer,
    {

      metadata:
        {

          contentType,

          metadata:
            {

              paymentId,

              accountId:
                uid,

              uploadedBy:
                uid

            }

        },

      resumable:
        false

    }
  );


  // ========================================
  // UPDATE PAYMENT
  // ========================================

  await paymentRef.update({

    proof:
      {

        storagePath,

        fileName:
          finalFileName,

        contentType,

        size:
          fileBuffer.length

      },

    proofUploadedAt:
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

          status:
            payment.status,

          proof:
            {

              storagePath,

              fileName:
                finalFileName,

              contentType,

              size:
                fileBuffer.length

            }

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
    // UPLOAD
    // ======================================

    return await uploadPaymentProof(
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
      "Ocurrió un error al subir el comprobante.",
      500
    );

  }

}