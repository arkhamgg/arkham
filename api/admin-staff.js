// ========================================
// NEXUS — Admin Staff API
// ========================================
//
// Gestión segura del staff administrativo.
//
// Frontend
//    ↓
// Firebase ID Token
//    ↓
// /api/admin-staff
//    ↓
// Firebase Admin SDK
//    ↓
// adminUsers/{uid}
//
// Operaciones:
// GET   → listar staff
// PATCH → modificar rol / estado
//
// IMPORTANTE:
// La autorización se realiza en backend.
// No se confía en permisos enviados por el cliente.
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
// AUTHORIZATION HEADER
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
// REQUIRE AUTHENTICATED ADMIN
// ========================================

async function getAuthenticatedAdmin(
  request
) {

  // ----------------------------------------
  // TOKEN
  // ----------------------------------------

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


  // ----------------------------------------
  // FIREBASE ADMIN
  // ----------------------------------------

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
  // VERIFY TOKEN
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
  // ADMIN USER
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
// NORMALIZE STAFF USER
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
// GET
// ========================================
//
// GET /api/admin-staff
//
// Lista los usuarios administrativos.
//
// Requiere:
// staff.view
//
// ========================================

export async function GET(
  request
) {

  try {

    // --------------------------------------
    // AUTHORIZATION
    // --------------------------------------

    const access =
      await getAuthenticatedAdmin(
        request
      );


    // --------------------------------------
    // PERMISSION
    // --------------------------------------

    requirePermission(
      access,
      "staff.view"
    );


    // --------------------------------------
    // GET STAFF
    // --------------------------------------

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


    return successResponse(
      {
        users
      }
    );

  } catch (error) {

    console.error(
      "NEXUS — Admin Staff API GET:",
      error
    );


    return errorResponse(
      error.message ||
        "No fue posible cargar el staff administrativo.",
      error.status ||
        500
    );

  }

}


// ========================================
// PATCH
// ========================================
//
// PATCH /api/admin-staff
//
// Modifica:
//
// roleId
// status
//
// Requiere:
// staff.manage
//
// Body:
//
// {
//   "uid": "...",
//   "action": "updateRole",
//   "roleId": "agent"
// }
//
// o
//
// {
//   "uid": "...",
//   "action": "updateStatus",
//   "status": "inactive"
// }
//
// ========================================

export async function PATCH(
  request
) {

  try {

    // --------------------------------------
    // AUTHORIZATION
    // --------------------------------------

    const access =
      await getAuthenticatedAdmin(
        request
      );


    // --------------------------------------
    // PERMISSION
    // --------------------------------------

    requirePermission(
      access,
      "staff.manage"
    );


    // --------------------------------------
    // REQUEST BODY
    // --------------------------------------

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


    // --------------------------------------
    // PREVENT SELF MODIFICATION
    // --------------------------------------
    //
    // Evitamos que un administrador pueda
    // bloquearse o quitarse permisos a sí mismo.
    //
    // Esto evita un lockout administrativo
    // accidental.
    //
    // --------------------------------------

    if (
      uid === access.uid
    ) {

      if (
        action === "updateRole" ||
        action === "updateStatus"
      ) {

        return errorResponse(
          "No puedes modificar tu propio acceso administrativo.",
          403
        );

      }

    }


    // --------------------------------------
    // ADMIN TARGET
    // --------------------------------------

    const adminRef =
      access.firestore
        .collection(
          ADMIN_USERS_COLLECTION
        )
        .doc(uid);


    const adminSnapshot =
      await adminRef.get();


    if (
      !adminSnapshot.exists
    ) {

      return errorResponse(
        "El usuario administrativo no existe.",
        404
      );

    }


    // --------------------------------------
    // UPDATE ROLE
    // --------------------------------------

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
            await adminRef.get()
          )

      });

    }


    // --------------------------------------
    // UPDATE STATUS
    // --------------------------------------

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
            await adminRef.get()
          )

      });

    }


    // --------------------------------------
    // UNKNOWN ACTION
    // --------------------------------------

    return errorResponse(
      "La acción administrativa no es válida.",
      400
    );

  } catch (error) {

    console.error(
      "NEXUS — Admin Staff API PATCH:",
      error
    );


    return errorResponse(
      error.message ||
        "No fue posible modificar el usuario administrativo.",
      error.status ||
        500
    );

  }

}