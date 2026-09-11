// ========================================
// NEXUS — Firebase Admin Test
// ========================================

import { firebaseAdminApp } from "./_lib/firebaseAdmin.js";
import { getFirestore } from "firebase-admin/firestore";


// ========================================
// API HANDLER
// ========================================

export async function GET() {

  try {

    // ========================================
    // VERIFY FIREBASE ADMIN
    // ========================================

    const firestore =
      getFirestore(firebaseAdminApp);

    await firestore
      .collection("_nexus_connection_test")
      .limit(1)
      .get();


    // ========================================
    // RESPONSE
    // ========================================

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
        error:
          "Firebase Admin no pudo conectarse correctamente.",
        code:
          error?.code || null
      },
      {
        status: 500
      }
    );

  }

}