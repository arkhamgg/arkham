// ========================================
// NEXUS — Firebase Admin Test
// ========================================

import {
  getFirestore
} from "firebase-admin/firestore";

import {
  getFirebaseAdminApp
} from "./_lib/firebaseAdmin.js";


// ========================================
// API HANDLER
// ========================================

export async function GET() {

  try {

    const firebaseAdminApp =
      getFirebaseAdminApp();

    const firestore =
      getFirestore(firebaseAdminApp);


    await firestore
      .collection("_nexus_connection_test")
      .limit(1)
      .get();


    return Response.json({
      success: true,
      message:
        "Firebase Admin conectado correctamente."
    });

  } catch (error) {

    console.error(
      "NEXUS — Error probando Firebase Admin:",
      error
    );


    return Response.json(
      {
        success: false,
        error:
          "Firebase Admin no pudo conectarse correctamente.",
        code:
          error?.code || null,
        message:
          error?.message || null
      },
      {
        status: 500
      }
    );

  }

}
