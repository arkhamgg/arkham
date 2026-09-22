// ========================================
// ARKHAM — Admin Access Service
// ========================================
//
// Control de acceso administrativo.
//
// Arquitectura:
//
// Firebase Authentication
//        ↓
// adminUsers/{uid}
//        ↓
// roleId + status
//        ↓
// ROLE_PERMISSIONS
//        ↓
// Admin Access
//
// IMPORTANTE:
// Este servicio controla el acceso de la
// interfaz. Las operaciones sensibles
// deberán estar protegidas también mediante
// Firestore Rules / Backend.
// ========================================

import { auth } from "./firebase.js";
import { getEntity } from "./firestore.js";

import {
  ADMIN_USER_STATUS,
  getRolePermissions,
  isValidAdminRole
} from "./adminRoles.js";


// ========================================
// ADMIN USER COLLECTION
// ========================================

const ADMIN_USERS_COLLECTION =
  "adminUsers";


// ========================================
// GET ADMIN USER
// ========================================

export async function getAdminUser(
  uid
) {

  if (!uid) {

    return null;

  }

  try {

    const adminUser =
      await getEntity(
        ADMIN_USERS_COLLECTION,
        uid
      );

    return adminUser || null;

  } catch (error) {

    console.error(
      "ARKHAM — Error leyendo adminUsers:",
      error
    );

    throw error;

  }

}


// ========================================
// GET CURRENT ADMIN ACCESS
// ========================================

export async function getCurrentAdminAccess() {

  // ----------------------------------------
  // AUTHENTICATED USER
  // ----------------------------------------

  const user =
    auth.currentUser;


  if (!user) {

    console.warn(
      "ARKHAM — Admin Access: no hay usuario autenticado."
    );

    return null;

  }


  


  // ----------------------------------------
  // ADMIN USER
  // ----------------------------------------

  let adminUser;

  try {

    adminUser =
      await getAdminUser(
        user.uid
      );

  } catch (error) {

    console.error(
      "ARKHAM — Admin Access: error consultando adminUsers.",
      error
    );

    return null;

  }


  if (!adminUser) {

    console.warn(
      `ARKHAM — Admin Access: no existe adminUsers/${user.uid}`
    );

    return null;

  }


  


  // ----------------------------------------
  // ROLE
  // ----------------------------------------

  const roleId =
    adminUser.roleId ||
    null;




  // ----------------------------------------
  // VALIDATE ROLE
  // ----------------------------------------

  const validRole =
    isValidAdminRole(
      roleId
    );


  


  if (!validRole) {

    console.error(
      "ARKHAM — Admin Access: roleId inválido.",
      {
        roleId,
        expectedRoles: [
          "administrator",
          "agent"
        ]
      }
    );

    return null;

  }


  // ----------------------------------------
  // STATUS
  // ----------------------------------------

  const status =
    adminUser.status ||
    ADMIN_USER_STATUS.ACTIVE;


  


  /*
   * Si el campo status no existe,
   * por compatibilidad asumimos active.
   *
   * Si existe, debe ser exactamente:
   *
   * active
   */

  if (
    status !== ADMIN_USER_STATUS.ACTIVE
  ) {

    console.error(
      "ARKHAM — Admin Access: usuario administrativo inactivo.",
      {
        status,
        expectedStatus:
          ADMIN_USER_STATUS.ACTIVE
      }
    );

    return null;

  }


  // ----------------------------------------
  // PERMISSIONS
  // ----------------------------------------

  const permissions =
    getRolePermissions(
      roleId
    );


  


  // ----------------------------------------
  // ACCESS CONTEXT
  // ----------------------------------------

  const access = {

    uid:
      user.uid,

    email:
      user.email ||
      adminUser.email ||
      null,

    displayName:
      adminUser.displayName ||
      user.displayName ||
      user.email ||
      null,

    roleId,

    status,

    permissions,

    adminUser

  };


  


  return access;

}


// ========================================
// HAS ADMIN PERMISSION
// ========================================

export async function hasAdminPermission(
  permission
) {

  if (!permission) {

    return false;

  }


  const access =
    await getCurrentAdminAccess();


  if (!access) {

    return false;

  }


  return access.permissions.includes(
    permission
  );

}


// ========================================
// REQUIRE ADMIN ACCESS
// ========================================

export async function requireAdminAccess() {

  const access =
    await getCurrentAdminAccess();


  if (!access) {

    throw new Error(
      "Acceso administrativo no autorizado."
    );

  }


  return access;

}


// ========================================
// REQUIRE ADMIN PERMISSION
// ========================================

export async function requireAdminPermission(
  permission
) {

  if (!permission) {

    throw new Error(
      "El permiso administrativo es obligatorio."
    );

  }


  const access =
    await requireAdminAccess();


  if (
    !access.permissions.includes(
      permission
    )
  ) {

    throw new Error(
      `Permiso administrativo insuficiente: ${permission}`
    );

  }


  return access;

}