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