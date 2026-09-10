// ========================================
// NEXUS — ImageKit Authentication
// ========================================

import ImageKit from "@imagekit/nodejs";


// ========================================
// IMAGEKIT CLIENT
// ========================================

const imagekit =
  new ImageKit({
    privateKey:
      process.env.IMAGEKIT_PRIVATE_KEY
  });


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
    // GENERATE AUTH PARAMETERS
    // ========================================

    const authenticationParameters =
      imagekit.helper.getAuthenticationParameters();


    // ========================================
    // RESPONSE
    // ========================================

    return Response.json(
      authenticationParameters
    );

  } catch (error) {

    console.error(
      "NEXUS — Error generando autenticación ImageKit:",
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