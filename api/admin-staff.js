// ========================================
// NEXUS — Admin Staff API
// ========================================
//
// Gestión segura del staff administrativo.
//
// Endpoint:
//
// GET   /api/admin-staff
// PATCH /api/admin-staff
//
// Arquitectura:
//
// Frontend
//    ↓
// Firebase ID Token
//    ↓
// /api/admin-staff
//    ↓
// Firebase Admin SDK
//    ↓
// adminUsers
//
// ========================================

import {
  getAuth
} from "firebase-admin/auth";

import {
  getFirestore
} from "firebase-admin/firestore";

import {
  getFirebaseAdminApp
} from "./_lib/firebaseAdmin.js";


// ========================================
// CONSTANTES
// ========================================

const ADMIN_USERS_COLLECTION =
  "adminUsers";


const ADMIN_ROLES = {

  ADMINISTRATOR:
    "administrator",

  AGENT:
    "agent"

};


const ADMIN_USER_STATUS = {

  ACTIVE:
    "active",

  INACTIVE:
    "inactive"

};


// ========================================
// ROLE PERMISSIONS
// ========================================

const ROLE_PERMISSIONS = {

  administrator: [

    "accounts.view",
    "accounts.manage",

    "staff.view",
    "staff.manage",

    "products.view",
    "products.manage",

    "plans.view",
    "plans.manage",

    "capabilities.view",
    "capabilities.manage",

    "subscriptions.view",
    "subscriptions.manage",

    "payments.view",
    "payments.review",
    "payments.approve",
    "payments.reject",

    "billing.view",
    "billing.manage",

    "audit.view"

  ],

  agent: [

    "accounts.view",

    "staff.view",

    "products.view",

    "plans.view",

    "capabilities.view",

    "subscriptions.view",

    "payments.view",
    "payments.review",

    "billing.view"

  ]

};


// ========================================
// RESPONSE HELPERS
// ========================================

function successResponse(
  data = {},
  status = 200
) {

  return Response.json(
    {
      success:
        true,

      ...data
    },
    {
      status
    }
  );

}


function errorResponse(
  message,
  status = 400
) {

  return Response.json(
    {
      success:
        false,

      error:
        message
    },
    {
      status
    }
  );

}


// ========================================
// BEARER TOKEN
// ========================================

function getBearerToken(
  request
) {

  const authorization =
    request.headers.get(
      "authorization"
    );


  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer "
    )
  ) {

    return null;

  }


  const token =
    authorization
      .slice(7)
      .trim();


  return token || null;

}


// ========================================
// AUTHENTICATED ADMIN
// ========================================

async function getAuthenticatedAdmin(
  request
) {

  const idToken =
    getBearerToken(
      request
    );


  if (!idToken) {

    const error =
      new Error(
        "No se proporcionó un token de autenticación."
      );

    error.status =
      401;

    throw error;

  }


  const firebaseAdminApp =
    getFirebaseAdminApp();


  const adminAuth =
    getAuth(
      firebaseAdminApp
    );


  const firestore =
    getFirestore(
      firebaseAdminApp
    );


  // ----------------------------------------
  // VERIFY FIREBASE TOKEN
  // ----------------------------------------

  let decodedToken;


  try {

    decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );

  } catch (error) {

    console.error(
      "NEXUS — Admin Staff: token inválido.",
      error
    );


    const authError =
      new Error(
        "El token de autenticación no es válido."
      );

    authError.status =
      401;

    throw authError;

  }


  const uid =
    decodedToken.uid;


  // ----------------------------------------
  // GET ADMIN USER
  // ----------------------------------------

  const adminRef =
    firestore
      .collection(
        ADMIN_USERS_COLLECTION
      )
      .doc(uid);


  const adminSnapshot =
    await adminRef.get();


  if (
    !adminSnapshot.exists
  ) {

    const error =
      new Error(
        "El usuario no tiene acceso administrativo."
      );

    error.status =
      403;

    throw error;

  }


  const adminUser =
    adminSnapshot.data();


  // ----------------------------------------
  // STATUS
  // ----------------------------------------

  const status =
    adminUser.status ||
    ADMIN_USER_STATUS.ACTIVE;


  if (
    status !==
    ADMIN_USER_STATUS.ACTIVE
  ) {

    const error =
      new Error(
        "El usuario administrativo está inactivo."
      );

    error.status =
      403;

    throw error;

  }


  // ----------------------------------------
  // ROLE
  // ----------------------------------------

  const roleId =
    adminUser.roleId ||
    null;


  if (
    !Object.values(
      ADMIN_ROLES
    ).includes(
      roleId
    )
  ) {

    const error =
      new Error(
        "El rol administrativo no es válido."
      );

    error.status =
      403;

    throw error;

  }


  // ----------------------------------------
  // PERMISSIONS
  // ----------------------------------------

  const permissions =
    ROLE_PERMISSIONS[
      roleId
    ] || [];


  return {

    uid,

    roleId,

    status,

    permissions,

    adminUser,

    firestore,

    adminAuth

  };

}


// ========================================
// REQUIRE PERMISSION
// ========================================

function requirePermission(
  access,
  permission
) {

  if (
    !access.permissions.includes(
      permission
    )
  ) {

    const error =
      new Error(
        "No tienes permisos para realizar esta operación."
      );

    error.status =
      403;

    throw error;

  }

}


// ========================================
// NORMALIZE USER
// ========================================

function normalizeStaffUser(
  document
) {

  const data =
    document.data();


  return {

    id:
      document.id,

    uid:
      data.uid ||
      document.id,

    displayName:
      data.displayName ||
      null,

    email:
      data.email ||
      null,

    roleId:
      data.roleId ||
      null,

    status:
      data.status ||
      ADMIN_USER_STATUS.ACTIVE,

    createdAt:
      data.createdAt ||
      null,

    updatedAt:
      data.updatedAt ||
      null

  };

}


// ========================================
// GET STAFF
// ========================================

async function handleGet(
  request
) {

  const access =
    await getAuthenticatedAdmin(
      request
    );


  requirePermission(
    access,
    "staff.view"
  );


  const snapshot =
    await access.firestore
      .collection(
        ADMIN_USERS_COLLECTION
      )
      .get();


  const users =
    snapshot.docs
      .map(
        normalizeStaffUser
      )
      .sort(
        (a, b) => {

          const nameA =
            String(
              a.displayName ||
              a.email ||
              ""
            );


          const nameB =
            String(
              b.displayName ||
              b.email ||
              ""
            );


          return nameA.localeCompare(
            nameB
          );

        }
      );


  console.log(
    "NEXUS — Admin Staff API: staff cargado.",
    {
      actorUid:
        access.uid,

      actorRole:
        access.roleId,

      count:
        users.length
    }
  );


  return successResponse({

    users

  });

}


// ========================================
// PATCH STAFF
// ========================================

async function handlePatch(
  request
) {

  const access =
    await getAuthenticatedAdmin(
      request
    );


  requirePermission(
    access,
    "staff.manage"
  );


  let body;


  try {

    body =
      await request.json();

  } catch {

    return errorResponse(
      "El cuerpo de la solicitud no contiene JSON válido.",
      400
    );

  }


  const uid =
    body?.uid ||
    null;


  const action =
    body?.action ||
    null;


  if (!uid) {

    return errorResponse(
      "El UID del usuario administrativo es obligatorio.",
      400
    );

  }


  if (!action) {

    return errorResponse(
      "La acción administrativa es obligatoria.",
      400
    );

  }


  // ----------------------------------------
  // PREVENT SELF MODIFICATION
  // ----------------------------------------

  if (
    uid === access.uid &&
    (
      action === "updateRole" ||
      action === "updateStatus"
    )
  ) {

    return errorResponse(
      "No puedes modificar tu propio acceso administrativo.",
      403
    );

  }


  // ----------------------------------------
  // TARGET USER
  // ----------------------------------------
  // Preferimos el document ID cuando coincide con el UID.
  // Si el documento fue creado con otro ID, buscamos por el
  // campo uid para mantener compatibilidad con registros existentes.

  let adminRef =
    access.firestore
      .collection(
        ADMIN_USERS_COLLECTION
      )
      .doc(uid);


  let adminSnapshot =
    await adminRef.get();


  if (!adminSnapshot.exists) {

    const querySnapshot =
      await access.firestore
        .collection(
          ADMIN_USERS_COLLECTION
        )
        .where("uid", "==", uid)
        .limit(1)
        .get();


    if (querySnapshot.empty) {

      return errorResponse(
        "El usuario administrativo no existe.",
        404
      );

    }


    adminSnapshot =
      querySnapshot.docs[0];


    adminRef =
      adminSnapshot.ref;

  }


  // ----------------------------------------
  // UPDATE ROLE
  // ----------------------------------------

  if (
    action ===
    "updateRole"
  ) {

    const roleId =
      body?.roleId ||
      null;


    if (
      !Object.values(
        ADMIN_ROLES
      ).includes(
        roleId
      )
    ) {

      return errorResponse(
        "El rol administrativo no es válido.",
        400
      );

    }


    await adminRef.update({

      roleId,

      updatedAt:
        new Date()

    });


    const updatedSnapshot =
      await adminRef.get();


    console.log(
      "NEXUS — Admin Staff API: rol actualizado.",
      {
        actorUid:
          access.uid,

        targetUid:
          uid,

        roleId
      }
    );


    return successResponse({

      user:
        normalizeStaffUser(
          updatedSnapshot
        )

    });

  }


  // ----------------------------------------
  // UPDATE STATUS
  // ----------------------------------------

  if (
    action ===
    "updateStatus"
  ) {

    const status =
      body?.status ||
      null;


    if (
      !Object.values(
        ADMIN_USER_STATUS
      ).includes(
        status
      )
    ) {

      return errorResponse(
        "El estado administrativo no es válido.",
        400
      );

    }


    await adminRef.update({

      status,

      updatedAt:
        new Date()

    });


    const updatedSnapshot =
      await adminRef.get();


    console.log(
      "NEXUS — Admin Staff API: estado actualizado.",
      {
        actorUid:
          access.uid,

        targetUid:
          uid,

        status
      }
    );


    return successResponse({

      user:
        normalizeStaffUser(
          updatedSnapshot
        )

    });

  }


  // ----------------------------------------
  // UNKNOWN ACTION
  // ----------------------------------------

  return errorResponse(
    "La acción administrativa no es válida.",
    400
  );

}


// ========================================
// MAIN VERCEL HANDLER
// ========================================
//
// Un único handler para todos los métodos.
//
// Esto evita depender del routing de métodos
// múltiples del deployment actual.
//
// ========================================

export default async function handler(
  request
) {

  try {

    switch (
      request.method
    ) {

      case "GET":

        return await handleGet(
          request
        );


      case "PATCH":

        return await handlePatch(
          request
        );


      default:

        return errorResponse(
          "Método HTTP no permitido.",
          405
        );

    }

  } catch (error) {

    console.error(
      "NEXUS — Admin Staff API:",
      error
    );


    return errorResponse(
      error.message ||
        "No fue posible procesar la solicitud administrativa.",
      error.status ||
        500
    );

  }

}