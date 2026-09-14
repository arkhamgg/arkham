// ========================================
// NEXUS — Admin Billing API
// ========================================

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../firebaseAdmin.js";
import { getPlanPrice } from "../billingConfig.js";

const ADMIN_USERS = "adminUsers";
const PAYMENTS = "payments";
const SUBSCRIPTIONS = "subscriptions";

const PERMISSIONS = {
  administrator: ["billing.view", "billing.manage"],
  agent: ["billing.view"]
};

function errorResponse(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getToken(req) {
  const value = req.headers?.authorization || req.headers?.Authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : null;
}

async function getAccess(req) {
  const token = getToken(req);
  if (!token) throw Object.assign(new Error("No se proporcionó un token de autenticación."), { status: 401 });

  const app = getFirebaseAdminApp();
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const decoded = await auth.verifyIdToken(token);
  const snapshot = await firestore.collection(ADMIN_USERS).doc(decoded.uid).get();

  if (!snapshot.exists) throw Object.assign(new Error("El usuario no tiene acceso administrativo."), { status: 403 });

  const adminUser = snapshot.data() || {};
  if (adminUser.status === "inactive") throw Object.assign(new Error("El usuario administrativo está inactivo."), { status: 403 });

  const roleId = adminUser.roleId || "";
  if (!PERMISSIONS[roleId]) throw Object.assign(new Error("El rol administrativo no es válido."), { status: 403 });

  return { uid: decoded.uid, roleId, permissions: PERMISSIONS[roleId], firestore };
}

export async function handle(req, res) {
  try {
    if (req.method !== "GET") return errorResponse(res, "Método no permitido.", 405);

    const access = await getAccess(req);
    if (!access.permissions.includes("billing.view")) {
      return errorResponse(res, "No tienes permisos para consultar Billing.", 403);
    }

    const [paymentsSnapshot, subscriptionsSnapshot] = await Promise.all([
      access.firestore.collection(PAYMENTS).get(),
      access.firestore.collection(SUBSCRIPTIONS).get()
    ]);

    const payments = paymentsSnapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        accountId: data.accountId || null,
        subscriptionId: data.subscriptionId || null,
        planId: data.planId || data.targetPlanId || null,
        amount: Number(data.amount) || 0,
        currency: data.currency || "GTQ",
        status: data.status || null,
        method: data.method || data.paymentMethod || null,
        createdAt: toIso(data.createdAt),
        submittedAt: toIso(data.submittedAt),
        approvedAt: toIso(data.approvedAt),
        rejectedAt: toIso(data.rejectedAt)
      };
    });

    const subscriptions = subscriptionsSnapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        accountId: data.accountId || null,
        planId: data.planId || null,
        status: data.status || null,
        period: data.period || "monthly",
        currentPeriodEnd: toIso(data.currentPeriodEnd),
        nextBillingAt: toIso(data.nextBillingAt),
        createdAt: toIso(data.createdAt)
      };
    });

    const approved = payments.filter(item => item.status === "approved");
    const underReview = payments.filter(item => item.status === "under_review");
    const pending = payments.filter(item => item.status === "pending");
    const rejected = payments.filter(item => item.status === "rejected");
    const activeSubscriptions = subscriptions.filter(item => item.status === "active");
    const proPrice = getPlanPrice("pro", "monthly")?.amount || 0;

    const byPlan = {};
    for (const subscription of activeSubscriptions) {
      byPlan[subscription.planId || "unknown"] = (byPlan[subscription.planId || "unknown"] || 0) + 1;
    }

    const byMethod = {};
    for (const payment of payments) {
      const method = payment.method || "unknown";
      byMethod[method] = (byMethod[method] || 0) + 1;
    }

    const recentPayments = [...payments]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10);

    return res.status(200).json({
      success: true,
      currency: "GTQ",
      summary: {
        totalPayments: payments.length,
        approvedPayments: approved.length,
        underReviewPayments: underReview.length,
        pendingPayments: pending.length,
        rejectedPayments: rejected.length,
        approvedRevenue: approved.reduce((sum, item) => sum + item.amount, 0),
        underReviewAmount: underReview.reduce((sum, item) => sum + item.amount, 0),
        activeSubscriptions: activeSubscriptions.length,
        monthlyRecurringRevenue: activeSubscriptions.reduce((sum, item) => {
          if (item.planId === "pro") return sum + proPrice;
          return sum;
        }, 0)
      },
      breakdown: {
        subscriptionsByPlan: byPlan,
        paymentsByMethod: byMethod
      },
      recentPayments
    });
  } catch (error) {
    console.error("NEXUS — Admin Billing API:", error);
    return errorResponse(res, error?.message || "No fue posible cargar Billing.", error?.status || 500);
  }
}
