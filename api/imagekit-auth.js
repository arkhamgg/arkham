// ========================================
// NEXUS — ImageKit Authentication
// ========================================

import ImageKit from "@imagekit/nodejs";


// ========================================
// API HANDLER
// ========================================

export async function GET() {

  try {

    // ========================================
    // VERIFY PRIVATE KEY
    // ========================================

    if (
      !process.env.IMAGEKIT_PRIVATE_KEY
    ) {

      return Response.json(
        {
          error:
            "IMAGEKIT_PRIVATE_KEY no está configurada."
        },
        {
          status: 500
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


    return Response.json(
      authenticationParameters
    );

  } catch (error) {

    console.error(
      "NEXUS — Error generando autenticación de ImageKit:",
      error
    );


    return Response.json(
      {
        error:
          "No fue posible generar la autenticación de ImageKit."
      },
      {
        status: 500
      }
    );

  }

}
