// ========================================
// NEXUS — Firebase Admin
// ========================================

import {
  cert,
  getApps,
  initializeApp
} from "firebase-admin/app";


// ========================================
// GET FIREBASE ADMIN APP
// ========================================

export function getFirebaseAdminApp() {

  const requiredEnvironmentVariables = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY"
  ];


  const missingEnvironmentVariables =
    requiredEnvironmentVariables.filter(
      (name) => !process.env[name]
    );


  if (
    missingEnvironmentVariables.length > 0
  ) {

    throw new Error(
      `Faltan variables de Firebase Admin: ${missingEnvironmentVariables.join(", ")}`
    );

  }


  if (getApps().length > 0) {

    return getApps()[0];

  }


  const privateKey =
    process.env.FIREBASE_PRIVATE_KEY.replace(
      /\\n/g,
      "\n"
    );


  return initializeApp({

    credential:
      cert({

        projectId:
          process.env.FIREBASE_PROJECT_ID,

        clientEmail:
          process.env.FIREBASE_CLIENT_EMAIL,

        privateKey

      })

  });

}
