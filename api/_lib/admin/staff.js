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
// /api/admin?resource=staff
//    ↓
// Firebase Admin SDK
//    ↓
// adminUsers/{uid}
//
// Métodos:
// GET   → listar staff
// PATCH → modificar rol / estado
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
} from "../firebaseAdmin.js";
import { writeAdminAudit } from "./auditWriter.js";

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
  res,
  data = {},
  status = 200
) {

  return res
    .status(status)
    .json({

      success:
        true,

      ...data

    });

}


function errorResponse(
  res,
  message,
  status = 400
) {

  return res
    .status(status)
    .json({

      success:
        false,

      error:
        message

    });

}


// ========================================
// AUTHORIZATION HEADER
// ========================================

function getBearerToken(
  req
) {

  const authorization =
    req.headers?.authorization ||
    "";


  if (
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
// FIREBASE ADMIN
// ========================================

function getAdminServices() {

  const firebaseAdminApp =
    getFirebaseAdminApp();


  return {

    adminAuth:
      getAuth(
        firebaseAdminApp
      ),

    firestore:
      getFirestore(
        firebaseAdminApp
      )

  };

}


// ========================================
// AUTHENTICATED ADMIN
// ========================================

async function getAuthenticatedAdmin(
  req
) {

  // --------------------------------------
  // TOKEN
  // --------------------------------------

  const idToken =
    getBearerToken(
      req
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


  // --------------------------------------
  // FIREBASE ADMIN
  // --------------------------------------

  const {
    adminAuth,
    firestore
  } =
    getAdminServices();


  // --------------------------------------
  // VERIFY TOKEN
  // --------------------------------------

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


  // --------------------------------------
  // ADMIN USER
  // --------------------------------------

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


  // --------------------------------------
  // STATUS
  // --------------------------------------

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


  // --------------------------------------
  // ROLE
  // --------------------------------------

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


  // --------------------------------------
  // PERMISSIONS
  // --------------------------------------

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
// GET STAFF
// ========================================

async function handleGet(
  req,
  res
) {

  try {

    console.log(
      "NEXUS — Admin Staff API: GET recibido."
    );


    // ------------------------------------
    // AUTH
    // ------------------------------------

    const access =
      await getAuthenticatedAdmin(
        req
      );


    console.log(
      "NEXUS — Admin Staff API: autenticación OK.",
      {
        uid:
          access.uid,

        role:
          access.roleId
      }
    );


    // ------------------------------------
    // PERMISSION
    // ------------------------------------

    requirePermission(
      access,
      "staff.view"
    );


    // ------------------------------------
    // GET STAFF
    // ------------------------------------

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
      res,
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
      res,

      error.message ||
        "No fue posible cargar el staff administrativo.",

      error.status ||
        500
    );

  }

}


// ========================================
// PATCH STAFF
// ========================================

async function handlePatch(
  req,
  res
) {

  try {

    console.log(
      "NEXUS — Admin Staff API: PATCH recibido."
    );


    // ------------------------------------
    // AUTH
    // ------------------------------------

    const access =
      await getAuthenticatedAdmin(
        req
      );


    // ------------------------------------
    // PERMISSION
    // ------------------------------------

    requirePermission(
      access,
      "staff.manage"
    );


    // ------------------------------------
    // BODY
    // ------------------------------------

    let body =
      req.body || {};


    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return errorResponse(
          res,
          "El cuerpo de la solicitud no contiene JSON válido.",
          400
        );
      }
    }


    const uid =
      body?.uid ||
      null;


    const action =
      body?.action ||
      null;


    if (!uid) {

      return errorResponse(
        res,

        "El UID del usuario administrativo es obligatorio.",

        400
      );

    }


    if (!action) {

      return errorResponse(
        res,

        "La acción administrativa es obligatoria.",

        400
      );

    }


    // ------------------------------------
    // PREVENT SELF MODIFICATION
    // ------------------------------------

    if (
      uid === access.uid
    ) {

      if (
        action === "updateRole" ||
        action === "updateStatus"
      ) {

        return errorResponse(
          res,

          "No puedes modificar tu propio acceso administrativo.",

          403
        );

      }

    }


    // ------------------------------------
    // TARGET
    // ------------------------------------

    let adminRef =
      access.firestore
        .collection(
          ADMIN_USERS_COLLECTION
        )
        .doc(uid);


    let adminSnapshot =
      await adminRef.get();


    // Compatibilidad con documentos cuyo ID no coincide con uid.
    if (!adminSnapshot.exists) {

      const uidSnapshot =
        await access.firestore
          .collection(
            ADMIN_USERS_COLLECTION
          )
          .where(
            "uid",
            "==",
            uid
          )
          .limit(1)
          .get();


      if (!uidSnapshot.empty) {

        adminSnapshot =
          uidSnapshot.docs[0];

        adminRef =
          adminSnapshot.ref;

      }

    }


    if (!adminSnapshot.exists) {

      return errorResponse(
        res,

        "El usuario administrativo no existe.",

        404
      );

    }


    // ------------------------------------
    // UPDATE ROLE
    // ------------------------------------

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
          res,

          "El rol administrativo no es válido.",

          400
        );

      }


      const previousRoleId =
        adminSnapshot.data()?.roleId || null;

      await adminRef.update({

        roleId,

        updatedAt:
          new Date()

      });

      await writeAdminAudit({
        firestore: access.firestore,
        actorId: access.uid,
        actorRole: access.roleId,
        action: "staff_role_updated",
        targetType: "adminUser",
        targetId: uid,
        previousState: { roleId: previousRoleId },
        newState: { roleId },
        metadata: { targetUid: uid }
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


      const updatedSnapshot =
        await adminRef.get();


      return successResponse(
        res,
        {

          user:
            normalizeStaffUser(
              updatedSnapshot
            )

        }
      );

    }


    // ------------------------------------
    // UPDATE STATUS
    // ------------------------------------

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
          res,

          "El estado administrativo no es válido.",

          400
        );

      }


      const previousStatus =
        adminSnapshot.data()?.status || null;

      await adminRef.update({

        status,

        updatedAt:
          new Date()

      });

      await writeAdminAudit({
        firestore: access.firestore,
        actorId: access.uid,
        actorRole: access.roleId,
        action: "staff_status_updated",
        targetType: "adminUser",
        targetId: uid,
        previousState: { status: previousStatus },
        newState: { status },
        metadata: { targetUid: uid }
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


      const updatedSnapshot =
        await adminRef.get();


      return successResponse(
        res,
        {

          user:
            normalizeStaffUser(
              updatedSnapshot
            )

        }
      );

    }


    // ------------------------------------
    // UNKNOWN ACTION
    // ------------------------------------

    return errorResponse(
      res,

      "La acción administrativa no es válida.",

      400
    );

  } catch (error) {

    console.error(
      "NEXUS — Admin Staff API PATCH:",
      error
    );


    return errorResponse(
      res,

      error.message ||
        "No fue posible modificar el usuario administrativo.",

      error.status ||
        500
    );

  }

}


// ========================================
// MAIN VERCEL HANDLER
// ========================================
//
// Un único entrypoint.
// Evita problemas de routing por método HTTP.
//
// ========================================

export async function handle(
  req,
  res
) {

  console.log(
    "NEXUS — Admin Staff API:",
    req.method
  );


  if (
    req.method ===
    "GET"
  ) {

    return handleGet(
      req,
      res
    );

  }


  if (
    req.method ===
    "PATCH"
  ) {

    return handlePatch(
      req,
      res
    );

  }


  res.setHeader(
    "Allow",
    "GET, PATCH"
  );


  return errorResponse(
    res,

    "Método HTTP no permitido.",

    405
  );

}