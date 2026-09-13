// ========================================
// NEXUS — Admin Users Service
// ========================================
//
// Gestión del staff administrativo.
//
// Arquitectura:
//
// Admin Staff
//      ↓
// adminUsers.js
//      ↓
// /api/admin-staff
//      ↓
// Firebase Admin SDK
//      ↓
// adminUsers/{uid}
//
// Las operaciones administrativas sensibles
// NO utilizan directamente Firestore Client SDK.
//
// ========================================

import {
  auth
} from "./firebase.js";

import {
  ADMIN_USER_STATUS,
  ADMIN_ROLES,
  getRolePermissions,
  isValidAdminRole
} from "./adminRoles.js";

import {
  requireAdminPermission
} from "./adminAccess.js";


// ========================================
// API
// ========================================

const ADMIN_STAFF_API =
  "/api/admin-staff";


// ========================================
// GET AUTH TOKEN
// ========================================

async function getAuthToken() {

  const user =
    auth.currentUser;


  if (!user) {

    throw new Error(
      "No hay un usuario autenticado."
    );

  }


  const token =
    await user.getIdToken();


  if (!token) {

    throw new Error(
      "No fue posible obtener el token de autenticación."
    );

  }


  return token;

}


// ========================================
// API REQUEST
// ========================================

async function adminApiRequest(
  method = "GET",
  body = null
) {

  const token =
    await getAuthToken();


  const options = {

    method,

    headers: {

      "Authorization":
        `Bearer ${token}`,

      "Content-Type":
        "application/json"

    }

  };


  if (body !== null) {

    options.body =
      JSON.stringify(
        body
      );

  }


  const response =
    await fetch(
      ADMIN_STAFF_API,
      options
    );


  let data = null;


  try {

    data =
      await response.json();

  } catch {

    throw new Error(
      "El servidor devolvió una respuesta inválida."
    );

  }


  if (
    !response.ok ||
    data?.success === false
  ) {

    throw new Error(
      data?.error ||
      `Error administrativo (${response.status}).`
    );

  }


  return data;

}


// ========================================
// GET ALL ADMIN USERS
// ========================================
//
// GET /api/admin-staff
//
// Requiere:
// staff.view
//
// ========================================

export async function getAdminUsers() {

  // --------------------------------------
  // Frontend permission check
  // --------------------------------------

  await requireAdminPermission(
    "staff.view"
  );


  const response =
    await adminApiRequest(
      "GET"
    );


  return Array.isArray(
    response.users
  )
    ? response.users
    : [];

}


// ========================================
// GET ADMIN USER PERMISSIONS
// ========================================

export function getAdminUserPermissions(
  roleId
) {

  return getRolePermissions(
    roleId
  );

}


// ========================================
// VALIDATE ROLE
// ========================================

export function validateAdminRole(
  roleId
) {

  if (
    !isValidAdminRole(
      roleId
    )
  ) {

    throw new Error(
      "El rol administrativo no es válido."
    );

  }


  return true;

}


// ========================================
// UPDATE ADMIN USER ROLE
// ========================================
//
// PATCH /api/admin-staff
//
// ========================================

export async function updateAdminUserRole(
  uid,
  roleId
) {

  if (!uid) {

    throw new Error(
      "El UID del usuario es obligatorio."
    );

  }


  validateAdminRole(
    roleId
  );


  await requireAdminPermission(
    "staff.manage"
  );


  const response =
    await adminApiRequest(
      "PATCH",
      {

        uid,

        action:
          "updateRole",

        roleId

      }
    );


  return response.user ||
    null;

}


// ========================================
// ACTIVATE ADMIN USER
// ========================================
//
// PATCH /api/admin-staff
//
// ========================================

export async function activateAdminUser(
  uid
) {

  if (!uid) {

    throw new Error(
      "El UID del usuario es obligatorio."
    );

  }


  await requireAdminPermission(
    "staff.manage"
  );


  const response =
    await adminApiRequest(
      "PATCH",
      {

        uid,

        action:
          "updateStatus",

        status:
          ADMIN_USER_STATUS.ACTIVE

      }
    );


  return response.user ||
    null;

}


// ========================================
// DEACTIVATE ADMIN USER
// ========================================
//
// PATCH /api/admin-staff
//
// ========================================

export async function deactivateAdminUser(
  uid
) {

  if (!uid) {

    throw new Error(
      "El UID del usuario es obligatorio."
    );

  }


  await requireAdminPermission(
    "staff.manage"
  );


  const response =
    await adminApiRequest(
      "PATCH",
      {

        uid,

        action:
          "updateStatus",

        status:
          ADMIN_USER_STATUS.INACTIVE

      }
    );


  return response.user ||
    null;

}


// ========================================
// ADMIN ROLE LABEL
// ========================================

export function getAdminRoleLabel(
  roleId
) {

  switch (roleId) {

    case ADMIN_ROLES.ADMINISTRATOR:

      return "Administrator";


    case ADMIN_ROLES.AGENT:

      return "Agent";


    default:

      return "Unknown";

  }

}


// ========================================
// ADMIN STATUS LABEL
// ========================================

export function getAdminStatusLabel(
  status
) {

  switch (status) {

    case ADMIN_USER_STATUS.ACTIVE:

      return "Activo";


    case ADMIN_USER_STATUS.INACTIVE:

      return "Inactivo";


    default:

      return "Sin estado";

  }

}