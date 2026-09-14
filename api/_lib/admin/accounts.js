// ========================================
// NEXUS — Admin Accounts API
// ========================================
//
// Gestión segura de las cuentas de NEXUS.
//
// Frontend
//    ↓
// Firebase ID Token
//    ↓
// /api/admin?resource=accounts
//    ↓
// Firebase Admin SDK
//    ↓
// accounts/{uid} + Firebase Authentication
//
// Métodos:
// GET   → listar cuentas
// PATCH → activar / suspender cuenta
//
// ========================================

import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../firebaseAdmin.js";

const ADMIN_USERS_COLLECTION = "adminUsers";
const ACCOUNTS_COLLECTION = "accounts";
const SUBSCRIPTIONS_COLLECTION = "subscriptions";

const ADMIN_ROLES = {
  ADMINISTRATOR: "administrator",
  AGENT: "agent"
};

const ACCOUNT_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended"
};

const ROLE_PERMISSIONS = {
  administrator: [
    "accounts.view",
    "accounts.manage"
  ],
  agent: [
    "accounts.view"
  ]
};

function successResponse(res, data = {}, status = 200) {
  return res.status(status).json({
    success: true,
    ...data
  });
}

function errorResponse(res, message, status = 400) {
  return res.status(status).json({
    success: false,
    error: message
  });
}

function getBearerToken(req) {
  const authorization = req.headers?.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

function toIso(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toISOString();
  }

  return null;
}

async function getAuthenticatedAdmin(req) {
  const idToken = getBearerToken(req);

  if (!idToken) {
    const error = new Error(
      "No se proporcionó un token de autenticación."
    );
    error.status = 401;
    throw error;
  }

  const firebaseAdminApp = getFirebaseAdminApp();
  const adminAuth = getAuth(firebaseAdminApp);
  const firestore = getFirestore(firebaseAdminApp);

  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    console.error(
      "NEXUS — Admin Accounts: token inválido.",
      error
    );

    const authError = new Error(
      "El token de autenticación no es válido."
    );
    authError.status = 401;
    throw authError;
  }

  const uid = decodedToken.uid;
  const adminSnapshot = await firestore
    .collection(ADMIN_USERS_COLLECTION)
    .doc(uid)
    .get();

  if (!adminSnapshot.exists) {
    const error = new Error(
      "El usuario no tiene acceso administrativo."
    );
    error.status = 403;
    throw error;
  }

  const adminUser = adminSnapshot.data();
  const status = adminUser.status || "active";
  const roleId = adminUser.roleId || null;

  if (status !== "active") {
    const error = new Error(
      "El usuario administrativo está inactivo."
    );
    error.status = 403;
    throw error;
  }

  if (!Object.values(ADMIN_ROLES).includes(roleId)) {
    const error = new Error(
      "El rol administrativo no es válido."
    );
    error.status = 403;
    throw error;
  }

  return {
    uid,
    roleId,
    permissions: ROLE_PERMISSIONS[roleId] || [],
    adminAuth,
    firestore
  };
}

function requirePermission(access, permission) {
  if (!access.permissions.includes(permission)) {
    const error = new Error(
      "No tienes permisos para realizar esta operación."
    );
    error.status = 403;
    throw error;
  }
}

function normalizeAccount(document, authUser, subscription) {
  const data = document.data() || {};
  const accountStatus =
    data.accountStatus ||
    (authUser?.disabled ? ACCOUNT_STATUS.SUSPENDED : ACCOUNT_STATUS.ACTIVE);

  return {
    id: document.id,
    uid: document.id,
    email: authUser?.email || null,
    displayName: authUser?.displayName || null,
    photoURL: authUser?.photoURL || null,
    emailVerified: Boolean(authUser?.emailVerified),
    authDisabled: Boolean(authUser?.disabled),
    accountStatus,
    planId: data.planId || "free",
    subscriptionId: data.subscriptionId || null,
    subscription: subscription
      ? {
          id: subscription.id,
          planId: subscription.data.planId || null,
          status: subscription.data.status || null,
          period: subscription.data.period || null,
          currentPeriodStart: toIso(subscription.data.currentPeriodStart),
          currentPeriodEnd: toIso(subscription.data.currentPeriodEnd),
          nextBillingAt: toIso(subscription.data.nextBillingAt)
        }
      : null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    lastSignInAt: authUser?.metadata?.lastSignInTime || null,
    creationTime: authUser?.metadata?.creationTime || null
  };
}

async function handleGet(req, res) {
  try {
    const access = await getAuthenticatedAdmin(req);
    requirePermission(access, "accounts.view");

    const [accountsSnapshot, authResult, subscriptionsSnapshot] =
      await Promise.all([
        access.firestore.collection(ACCOUNTS_COLLECTION).get(),
        access.adminAuth.listUsers(1000),
        access.firestore.collection(SUBSCRIPTIONS_COLLECTION).get()
      ]);

    const authUsers = new Map(
      authResult.users.map(user => [user.uid, user])
    );

    const subscriptions = new Map(
      subscriptionsSnapshot.docs.map(doc => [doc.id, doc])
    );

    const accounts = accountsSnapshot.docs
      .map(doc => {
        const data = doc.data() || {};
        const subscriptionId = data.subscriptionId || null;

        return normalizeAccount(
          doc,
          authUsers.get(doc.id) || null,
          subscriptionId
            ? subscriptions.get(subscriptionId) || null
            : null
        );
      })
      .sort((a, b) => {
        const nameA = String(a.displayName || a.email || a.uid || "");
        const nameB = String(b.displayName || b.email || b.uid || "");
        return nameA.localeCompare(nameB);
      });

    return successResponse(res, { accounts });
  } catch (error) {
    console.error("NEXUS — Admin Accounts GET:", error);
    return errorResponse(
      res,
      error.message || "No fue posible cargar las cuentas.",
      error.status || 500
    );
  }
}

async function handlePatch(req, res) {
  try {
    const access = await getAuthenticatedAdmin(req);
    requirePermission(access, "accounts.manage");

    const { uid, action } = req.body || {};

    if (!uid) {
      return errorResponse(res, "El UID de la cuenta es obligatorio.", 400);
    }

    if (!action || !["activate", "suspend"].includes(action)) {
      return errorResponse(res, "La acción de cuenta no es válida.", 400);
    }

    if (uid === access.uid) {
      return errorResponse(
        res,
        "No puedes suspender o modificar el acceso de tu propia cuenta desde este módulo.",
        409
      );
    }

    const accountRef = access.firestore
      .collection(ACCOUNTS_COLLECTION)
      .doc(uid);

    const accountSnapshot = await accountRef.get();

    if (!accountSnapshot.exists) {
      return errorResponse(res, "La cuenta no existe.", 404);
    }

    const suspended = action === "suspend";
    const nextStatus = suspended
      ? ACCOUNT_STATUS.SUSPENDED
      : ACCOUNT_STATUS.ACTIVE;

    await access.adminAuth.updateUser(uid, {
      disabled: suspended
    });

    await accountRef.update({
      accountStatus: nextStatus,
      updatedAt: FieldValue.serverTimestamp()
    });

    return successResponse(res, {
      account: {
        uid,
        accountStatus: nextStatus,
        authDisabled: suspended
      }
    });
  } catch (error) {
    console.error("NEXUS — Admin Accounts PATCH:", error);
    return errorResponse(
      res,
      error.message || "No fue posible actualizar la cuenta.",
      error.status || 500
    );
  }
}

export async function handle(req, res) {
  if (req.method === "GET") {
    return handleGet(req, res);
  }

  if (req.method === "PATCH") {
    return handlePatch(req, res);
  }

  res.setHeader("Allow", "GET, PATCH");
  return errorResponse(res, "Método no permitido.", 405);
}
