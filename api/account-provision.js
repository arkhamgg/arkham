// ========================================
// NEXUS — Account Provisioning
// ========================================

import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore
} from "firebase-admin/firestore";

import {
  getFirebaseAdminApp
} from "./_lib/firebaseAdmin.js";


// ========================================
// API HANDLER
// ========================================

export async function POST(request) {

  try {

    // ========================================
    // FIREBASE ADMIN
    // ========================================

    const firebaseAdminApp =
      getFirebaseAdminApp();

    const adminAuth =
      getAuth(firebaseAdminApp);

    const firestore =
      getFirestore(firebaseAdminApp);


    // ========================================
    // AUTHORIZATION HEADER
    // ========================================

    const authorization =
      request.headers.get(
        "authorization"
      );


    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {

      return Response.json(
        {
          error:
            "No se proporcionó un token de autenticación."
        },
        {
          status: 401
        }
      );

    }


    const idToken =
      authorization
        .slice(7)
        .trim();


    if (!idToken) {

      return Response.json(
        {
          error:
            "El token de autenticación está vacío."
        },
        {
          status: 401
        }
      );

    }


    // ========================================
    // VERIFY FIREBASE ID TOKEN
    // ========================================

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );


    const uid =
      decodedToken.uid;


    // ========================================
    // ACCOUNT REFERENCE
    // ========================================

    const accountRef =
      firestore
        .collection("accounts")
        .doc(uid);


    // ========================================
    // TRANSACTION
    // ========================================

    const result =
      await firestore.runTransaction(
        async (transaction) => {

          const accountSnapshot =
            await transaction.get(
              accountRef
            );


          // ======================================
          // EXISTING ACCOUNT
          // ======================================

          if (accountSnapshot.exists) {

            const accountData =
              accountSnapshot.data();


            return {
              created: false,
              accountId: uid,
              planId:
                accountData.planId ||
                "free",
              accountStatus:
                accountData.accountStatus ||
                "active",
              subscriptionId:
                accountData.subscriptionId ||
                null
            };

          }


          // ======================================
          // CREATE FREE ACCOUNT
          // ======================================

          const accountData = {

            planId:
              "free",

            accountStatus:
              "active",

            createdAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp()

          };


          transaction.create(
            accountRef,
            accountData
          );


          return {
            created: true,
            accountId: uid,
            planId: "free",
            accountStatus: "active",
            subscriptionId: null
          };

        }
      );


    // ========================================
    // RESPONSE
    // ========================================

    return Response.json({
      success: true,
      ...result
    });


  } catch (error) {

    console.error(
      "NEXUS — Error en Account Provisioning:",
      error
    );


    // ========================================
    // AUTH ERRORS
    // ========================================

    if (
      error?.code ===
        "auth/id-token-expired" ||
      error?.code ===
        "auth/argument-error" ||
      error?.code ===
        "auth/invalid-id-token"
    ) {

      return Response.json(
        {
          error:
            "El token de autenticación no es válido."
        },
        {
          status: 401
        }
      );

    }


    // ========================================
    // GENERIC ERROR
    // ========================================

    return Response.json(
      {
        error:
          "No fue posible provisionar la cuenta."
      },
      {
        status: 500
      }
    );

  }

}