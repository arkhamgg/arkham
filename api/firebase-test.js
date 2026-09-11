// ========================================
// NEXUS — Firebase Admin Test
// ========================================

import { firebaseAdminApp } from "./_lib/firebaseAdmin.js";


// ========================================
// API HANDLER
// ========================================

export async function GET() {

  try {

    // ========================================
    // VERIFY FIREBASE ADMIN
    // ========================================

    const projectId =
      firebaseAdminApp.options.projectId;


    if (!projectId) {

      return Response.json(
        {
          error:
            "Firebase Admin no tiene projectId configurado."
        },
        {
          status: 500
        }
      );

    }


    // ========================================
    // RESPONSE
    // ========================================

    return Response.json(
      {
        success: true,
        message:
          "Firebase Admin inicializado correctamente.",
        projectId
      }
    );

  } catch (error) {

    console.error(
      "NEXUS — Error inicializando Firebase Admin:",
      error
    );


    return Response.json(
      {
        error:
          "No fue posible inicializar Firebase Admin."
      },
      {
        status: 500
      }
    );

  }

}