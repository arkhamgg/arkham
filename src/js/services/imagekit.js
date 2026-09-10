// ========================================
// NEXUS — ImageKit Service
// ========================================

import {
  upload
} from "@imagekit/javascript";


// ========================================
// CONFIGURATION
// ========================================

const IMAGEKIT_PUBLIC_KEY =
  import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;

const IMAGEKIT_URL_ENDPOINT =
  import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;


// ========================================
// GET AUTHENTICATION PARAMETERS
// ========================================

async function getAuthenticationParameters() {

  const response =
    await fetch(
      "/api/imagekit-auth"
    );


  if (!response.ok) {

    throw new Error(
      "No fue posible obtener la autenticación de ImageKit."
    );

  }


  return response.json();

}


// ========================================
// UPLOAD FILE
// ========================================

export async function uploadImage(
  file,
  options = {}
) {

  // ========================================
  // VALIDATE FILE
  // ========================================

  if (!file) {

    throw new Error(
      "No se proporcionó ningún archivo."
    );

  }


  // ========================================
  // VALIDATE CONFIGURATION
  // ========================================

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


  // ========================================
  // GET AUTHENTICATION
  // ========================================

  const authenticationParameters =
    await getAuthenticationParameters();


  // ========================================
  // UPLOAD
  // ========================================

  const result =
    await upload({
      file,

      fileName:
        options.fileName ||
        file.name,

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

      folder:
        options.folder ||
        "/nexus",

      useUniqueFileName:
        true
    });


  // ========================================
  // RESULT
  // ========================================

  return result;

}