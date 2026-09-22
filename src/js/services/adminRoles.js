// ========================================
// ARKHAM — Admin Roles & Permissions
// ========================================
//
// Los roles administrativos son agrupaciones
// de permisos. El código de negocio NO debe
// depender directamente del nombre del rol.
//
// Arquitectura:
//
// Firebase Auth
//      ↓
// adminUsers/{uid}
//      ↓
// roleId
//      ↓
// permissions
//
// ========================================


// ========================================
// ADMIN ROLES
// ========================================

export const ADMIN_ROLES = {

  ADMINISTRATOR:
    "administrator",

  AGENT:
    "agent"

};


// ========================================
// ADMIN USER STATUS
// ========================================

export const ADMIN_USER_STATUS = {

  ACTIVE:
    "active",

  INACTIVE:
    "inactive"

};


// ========================================
// ADMIN PERMISSIONS
// ========================================

export const ADMIN_PERMISSIONS = {

  ACCOUNTS_VIEW:
    "accounts.view",

  ACCOUNTS_MANAGE:
    "accounts.manage",

  STAFF_VIEW:
    "staff.view",

  STAFF_MANAGE:
    "staff.manage",

  PRODUCTS_VIEW:
    "products.view",

  PRODUCTS_MANAGE:
    "products.manage",

  PLANS_VIEW:
    "plans.view",

  PLANS_MANAGE:
    "plans.manage",

  CAPABILITIES_VIEW:
    "capabilities.view",

  CAPABILITIES_MANAGE:
    "capabilities.manage",

  SUBSCRIPTIONS_VIEW:
    "subscriptions.view",

  SUBSCRIPTIONS_MANAGE:
    "subscriptions.manage",

  PAYMENTS_VIEW:
    "payments.view",

  PAYMENTS_REVIEW:
    "payments.review",

  PAYMENTS_APPROVE:
    "payments.approve",

  PAYMENTS_REJECT:
    "payments.reject",

  BILLING_VIEW:
    "billing.view",

  BILLING_MANAGE:
    "billing.manage",

  AUDIT_VIEW:
    "audit.view",

  RELOADS_VIEW:
    "reloads.view",

  RELOADS_MANAGE:
    "reloads.manage",

  RELOADS_PAYMENTS_REVIEW:
    "reloads.payments.review",

  RELOADS_ORDERS_PROCESS:
    "reloads.orders.process"

};


// ========================================
// ROLE PERMISSIONS
// ========================================

export const ROLE_PERMISSIONS = {

  [ADMIN_ROLES.ADMINISTRATOR]: Object.values(
    ADMIN_PERMISSIONS
  ),

  [ADMIN_ROLES.AGENT]: [

    ADMIN_PERMISSIONS.ACCOUNTS_VIEW,

    ADMIN_PERMISSIONS.STAFF_VIEW,

    ADMIN_PERMISSIONS.PRODUCTS_VIEW,

    ADMIN_PERMISSIONS.PLANS_VIEW,

    ADMIN_PERMISSIONS.CAPABILITIES_VIEW,

    ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW,

    ADMIN_PERMISSIONS.PAYMENTS_VIEW,

    ADMIN_PERMISSIONS.PAYMENTS_REVIEW,

    ADMIN_PERMISSIONS.BILLING_VIEW,

    ADMIN_PERMISSIONS.AUDIT_VIEW

  ]

};


// ========================================
// ROLE HELPERS
// ========================================

export function isValidAdminRole(
  roleId
) {

  return Object.values(
    ADMIN_ROLES
  ).includes(
    roleId
  );

}


export function getRolePermissions(
  roleId
) {

  if (!isValidAdminRole(roleId)) {

    return [];

  }

  return [
    ...(ROLE_PERMISSIONS[roleId] || [])
  ];

}
