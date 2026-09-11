// ========================================
// NEXUS — Account Provisioning
// ========================================

import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import { firebaseAdminApp } from "./_lib/firebaseAdmin.js";


// ========================================
// FIREBASE SERVICES
// ========================================

const adminAuth =
  getAuth(firebaseAdminApp);

const firestore =
  getFirestore(firebaseAdminApp);


// ========================================
// API HANDLER
// ========================================

export async function POST(request) {

  try {

    // ========================================
    // VERIFY AUTHORIZATION HEADER
    // ========================================

    const authorization =
      request.headers.get("authorization");


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


    // ========================================
    // EXTRACT ID TOKEN
    // ========================================

    const idToken =
      authorization.substring(7);


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
      await adminAuth.verifyIdToken(idToken);


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
            await transaction.get(accountRef);


          // ========================================
          // ACCOUNT ALREADY EXISTS
          // ========================================

          if (accountSnapshot.exists) {

            const accountData =
              accountSnapshot.data();


            // ----------------------------------------
            // ACCOUNT ALREADY PROVISIONED
            // ----------------------------------------

            if (
              accountData.subscriptionId
            ) {

              return {
                created: false,
                accountId: uid,
                subscriptionId:
                  accountData.subscriptionId,
                planId:
                  accountData.planId || "free"
              };

            }


            // ----------------------------------------
            // ACCOUNT EXISTS WITHOUT SUBSCRIPTION
            // ----------------------------------------

            const subscriptionRef =
              firestore
                .collection("subscriptions")
                .doc();


            transaction.create(
              subscriptionRef,
              {
                accountId:
                  uid,

                planId:
                  accountData.planId || "free",

                status:
                  "active",

                createdAt:
                  FieldValue.serverTimestamp(),

                activatedAt:
                  FieldValue.serverTimestamp(),

                expiresAt:
                  null
              }
            );


            transaction.update(
              accountRef,
              {
                subscriptionId:
                  subscriptionRef.id,

                updatedAt:
                  FieldValue.serverTimestamp()
              }
            );


            return {
              created: false,
              accountId: uid,
              subscriptionId:
                subscriptionRef.id,
              planId:
                accountData.planId || "free"
            };

          }


          // ========================================
          // CREATE NEW ACCOUNT
          // ========================================

          const subscriptionRef =
            firestore
              .collection("subscriptions")
              .doc();


          transaction.create(
            subscriptionRef,
            {
              accountId:
                uid,

              planId:
                "free",

              status:
                "active",

              createdAt:
                FieldValue.serverTimestamp(),

              activatedAt:
                FieldValue.serverTimestamp(),

              expiresAt:
                null
            }
          );


          transaction.create(
            accountRef,
            {
              planId:
                "free",

              subscriptionId:
                subscriptionRef.id,

              accountStatus:
                "active",

              createdAt:
                FieldValue.serverTimestamp(),

              updatedAt:
                FieldValue.serverTimestamp()
            }
          );


          return {
            created: true,
            accountId: uid,
            subscriptionId:
              subscriptionRef.id,
            planId:
              "free"
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
    // INVALID / EXPIRED TOKEN
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
    // SERVER ERROR
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