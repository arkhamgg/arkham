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


          if (accountSnapshot.exists) {

            const accountData =
              accountSnapshot.data();

            const existingSubscriptionId =
              accountData.subscriptionId ||
              null;


            // ========================================
            // EXISTING SUBSCRIPTION
            // ========================================

            if (existingSubscriptionId) {

              const subscriptionRef =
                firestore
                  .collection("subscriptions")
                  .doc(existingSubscriptionId);

              const subscriptionSnapshot =
                await transaction.get(
                  subscriptionRef
                );


              if (
                subscriptionSnapshot.exists &&
                subscriptionSnapshot.data()?.accountId === uid
              ) {

                return {
                  created: false,
                  repaired: false,
                  accountId: uid,
                  subscriptionId:
                    existingSubscriptionId,
                  planId:
                    accountData.planId ||
                    "free"
                };

              }

            }


            // ========================================
            // REPAIR / CREATE SUBSCRIPTION
            // ========================================

            const subscriptionRef =
              firestore
                .collection("subscriptions")
                .doc();

            const planId =
              accountData.planId ||
              "free";


            transaction.create(
              subscriptionRef,
              {
                accountId:
                  uid,

                planId,

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

                accountStatus:
                  accountData.accountStatus ||
                  "active",

                updatedAt:
                  FieldValue.serverTimestamp()
              }
            );


            return {
              created: false,
              repaired: true,
              accountId: uid,
              subscriptionId:
                subscriptionRef.id,
              planId
            };

          }


          // ========================================
          // CREATE ACCOUNT + SUBSCRIPTION
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
            repaired: false,
            accountId: uid,
            subscriptionId:
              subscriptionRef.id,
            planId:
              "free"
          };

        }
      );


    return Response.json({
      success: true,
      ...result
    });

  } catch (error) {

    console.error(
      "NEXUS — Error en Account Provisioning:",
      error
    );


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
