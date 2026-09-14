// ========================================
// NEXUS — ImageKit Service
// ========================================

import {
  upload
} from "@imagekit/javascript";

import {
  getAuth
} from "firebase/auth";


// ========================================
// CONFIGURATION
// ========================================

const IMAGEKIT_PUBLIC_KEY =
  import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;

const IMAGEKIT_URL_ENDPOINT =
  import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;


// ========================================
// FIREBASE AUTH
// ========================================

const firebaseAuth =
  getAuth();


// ========================================
// GET AUTHENTICATION PARAMETERS
// ========================================

async function getAuthenticationParameters() {

  // ======================================
  // CURRENT USER
  // ======================================

  const user =
    firebaseAuth.currentUser;

  if (!user) {

    throw new Error(
      "Debes iniciar sesión para utilizar ImageKit."
    );

  }


  // ======================================
  // FIREBASE ID TOKEN
  // ======================================

  const idToken =
    await user.getIdToken();


  // ======================================
  // REQUEST
  // ======================================

  const response =
    await fetch(
      "/api/imagekit-auth",
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${idToken}`
        }
      }
    );


  // ======================================
  // RESPONSE VALIDATION
  // ======================================

  if (!response.ok) {

    let message =
      "No fue posible obtener la autenticación de ImageKit.";

    try {

      const data =
        await response.json();

      if (
        data?.error
      ) {

        message =
          data.error;

      }

    } catch {

      // Mantener mensaje genérico.

    }


    throw new Error(
      message
    );

  }


  const authenticationParameters =
    await response.json();


  if (
    !authenticationParameters?.success
  ) {

    throw new Error(
      "La autenticación de ImageKit no fue válida."
    );

  }


  return authenticationParameters;

}


// ========================================
// UPLOAD FILE
// ========================================

export async function uploadImage(
  file,
  options = {}
) {

  // ======================================
  // VALIDATE FILE
  // ======================================

  if (!file) {

    throw new Error(
      "No se proporcionó ningún archivo."
    );

  }


  // ======================================
  // VALIDATE CONFIGURATION
  // ======================================

  if (!IMAGEKIT_PUBLIC_KEY) {

    throw new Error(
      "VITE_IMAGEKIT_PUBLIC_KEY no está configurada."
    );

  }


  if (!IMAGEKIT_URL_ENDPOINT) {

    throw new Error(
      "VITE_IMAGEKIT_URL_ENDPOINT no está configurada."
    );

  }


  // ======================================
  // GET AUTHENTICATION
  // ======================================

  const authenticationParameters =
    await getAuthenticationParameters();


  // ======================================
  // UPLOAD OPTIONS
  // ======================================

  const fileName =
    options.fileName ||
    file.name;

  const folder =
    options.folder ||
    "/nexus";


  // ======================================
  // UPLOAD
  // ======================================

  const result =
    await upload({

      file,

      fileName,

      publicKey:
        IMAGEKIT_PUBLIC_KEY,

      urlEndpoint:
        IMAGEKIT_URL_ENDPOINT,

      token:
        authenticationParameters.token,

      expire:
        authenticationParameters.expire,

      signature:
        authenticationParameters.signature,

      folder,

      useUniqueFileName:
        true

    });


  // ======================================
  // RESULT
  // ======================================

  return result;

}


// ========================================
// UPLOAD PAYMENT PROOF
// ========================================
//
// Sube un comprobante directamente a
// ImageKit utilizando una ruta asociada
// al usuario y al pago.
//
// Ruta:
//
// /nexus/payment-proofs/{uid}/{paymentId}/
//

export async function uploadPaymentProof(
  file,
  uid,
  paymentId
) {

  // ======================================
  // VALIDATE USER
  // ======================================

  if (!uid) {

    throw new Error(
      "uid es obligatorio para subir el comprobante."
    );

  }


  // ======================================
  // VALIDATE PAYMENT
  // ======================================

  if (!paymentId) {

    throw new Error(
      "paymentId es obligatorio para subir el comprobante."
    );

  }


  // ======================================
  // VALIDATE FILE
  // ======================================

  if (!file) {

    throw new Error(
      "No se proporcionó ningún comprobante."
    );

  }


  // ======================================
  // PAYMENT PROOF FOLDER
  // ======================================

  const folder =
    `/nexus/payment-proofs/${uid}/${paymentId}`;


  // ======================================
  // UPLOAD
  // ======================================

  const result =
    await uploadImage(
      file,
      {
        folder
      }
    );


  // ======================================
  // RETURN NORMALIZED DATA
  // ========================================

  return {

    provider:
      "imagekit",

    fileId:
      result.fileId ||
      null,

    filePath:
      result.filePath ||
      null,

    url:
      result.url ||
      null,

    fileName:
      result.name ||
      file.name,

    // ====================================
    // IMPORTANT:
    // Use the browser MIME type.
    //
    // ImageKit's `fileType` is not guaranteed
    // to be the MIME type expected by the
    // billing-payment-proof API.
    // ====================================

    contentType:
      file.type ||
      null,

    size:
      result.size ||
      file.size ||
      null

  };

}