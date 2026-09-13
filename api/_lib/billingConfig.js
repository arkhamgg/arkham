// ========================================
// NEXUS — Billing Configuration
// ========================================

const PRO_MONTHLY_PRICE =
  Number(
    process.env.NEXUS_PRO_MONTHLY_PRICE_GTQ
  );


// ========================================
// VALIDATE PRICE
// ========================================

if (
  !Number.isFinite(
    PRO_MONTHLY_PRICE
  ) ||
  PRO_MONTHLY_PRICE <= 0
) {

  throw new Error(
    "NEXUS_PRO_MONTHLY_PRICE_GTQ debe existir y ser mayor que cero."
  );

}


// ========================================
// BILLING CONFIGURATION
// ========================================

export const BILLING_CONFIG = {

  currency:
    "GTQ",

  paymentMethods: {

    bankTransfer:
      "bank_transfer",

    bankDeposit:
      "bank_deposit"

  },

  plans: {

    pro: {

      id:
        "pro",

      monthly: {

        amount:
          PRO_MONTHLY_PRICE,

        currency:
          "GTQ"

      }

    }

  }

};


// ========================================
// PLAN PRICE
// ========================================

export function getPlanPrice(
  planId,
  period = "monthly"
) {

  const plan =
    BILLING_CONFIG
      .plans?.[planId];


  if (!plan) {

    return null;

  }


  const pricing =
    plan?.[period];


  if (!pricing) {

    return null;

  }


  return pricing;

}


// ========================================
// PLAN AVAILABILITY
// ========================================

export function isBillablePlan(
  planId,
  period = "monthly"
) {

  return Boolean(
    getPlanPrice(
      planId,
      period
    )
  );

}