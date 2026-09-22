// ========================================
// ARKHAM — ImageKit Authentication
// ========================================

import ImageKit from "@imagekit/nodejs";

import {
  getAuth
} from "firebase-admin/auth";

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


// ========================================
// AUTHORIZATION
// ========================================

function getBearerToken(request) {

  const authorization =
    request.headers.get("authorization") ||
    "";

  if (
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  return authorization
    .substring(7)
    .trim();
}


// ========================================
// API HANDLER
// ========================================

export async function GET(request) {

  try {

    // ========================================
    // VERIFY IMAGEKIT CONFIGURATION
    // ========================================

    if (
      !process.env.IMAGEKIT_PRIVATE_KEY
    ) {

      console.error(
        "ARKHAM — IMAGEKIT_PRIVATE_KEY no está configurada."
      );

      return Response.json(
        {
          success: false,
          reason:
            "imagekit_not_configured"
        },
        {
          status: 500
        }
      );

    }


    // ========================================
    // FIREBASE AUTHENTICATION
    // ========================================

    const idToken =
      getBearerToken(request);


    if (!idToken) {

      return Response.json(
        {
          success: false,
          reason:
            "missing_authentication"
        },
        {
          status: 401
        }
      );

    }


    // ========================================
    // VERIFY FIREBASE TOKEN
    // ========================================

    let decodedToken;

    try {

      decodedToken =
        await adminAuth.verifyIdToken(
          idToken
        );

    } catch (error) {

      console.error(
        "ARKHAM — ImageKit Auth: token Firebase inválido.",
        error
      );

      return Response.json(
        {
          success: false,
          reason:
            "invalid_authentication"
        },
        {
          status: 401
        }
      );

    }


    // ========================================
    // VERIFY USER
    // ========================================

    if (
      !decodedToken?.uid
    ) {

      return Response.json(
        {
          success: false,
          reason:
            "invalid_user"
        },
        {
          status: 401
        }
      );

    }


    // ========================================
    // IMAGEKIT CLIENT
    // ========================================

    const imagekit =
      new ImageKit({
        privateKey:
          process.env.IMAGEKIT_PRIVATE_KEY
      });


    // ========================================
    // GENERATE AUTH PARAMETERS
    // ========================================

    const authenticationParameters =
      imagekit.helper.getAuthenticationParameters();


    // ========================================
    // RESPONSE
    // ========================================

    return Response.json(
      {
        success: true,

        ...authenticationParameters
      }
    );

  } catch (error) {

    console.error(
      "ARKHAM — Error generando autenticación de ImageKit:",
      error
    );


    return Response.json(
      {
        success: false,
        reason:
          "imagekit_auth_generation_failed"
      },
      {
        status: 500
      }
    );

  }

}