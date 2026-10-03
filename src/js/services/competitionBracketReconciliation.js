// ========================================
// ARKHAM — Competition Bracket Reconciliation
// ========================================
//
// Bracket Reconciliation v1.
//
// Converts a Bracket Comparison result into a deterministic, read-only
// reconciliation plan.
//
// IMPORTANT:
// - No Firebase writes.
// - No Tournament Pro mutation.
// - No replacement of generateBracket().
// - No Match mutation.
// - No persistence command is produced.
// - This module does not migrate anything.
//
// Pipeline:
//   Generation -> Comparison -> Migration Readiness -> Reconciliation
//   -> Migration (future)
//
// V1 decides WHAT kind of reconciliation is required. It does not decide
// business ownership of live data and never applies a change automatically.
// ========================================

import {
  BRACKET_COMPARISON_STATUS,
  BRACKET_COMPARISON_CODES,
  compareCompetitionBrackets
} from "./competitionBracketComparison.js";

import {
  BRACKET_MIGRATION_READINESS_STATUS,
  evaluateCompetitionBracketMigrationReadiness
} from "./competitionBracketMigrationReadiness.js";

export const BRACKET_RECONCILIATION_STATUS = {
  NOT_REQUIRED: "NOT_REQUIRED",
  PLAN_REQUIRED: "PLAN_REQUIRED",
  BLOCKED: "BLOCKED",
  UNSUPPORTED: "UNSUPPORTED",
  INVALID: "INVALID"
};

export const BRACKET_RECONCILIATION_ACTIONS = {
  KEEP_CURRENT: "KEEP_CURRENT",
  ADOPT_GENERATED: "ADOPT_GENERATED",
  REQUIRES_MANUAL_REVIEW: "REQUIRES_MANUAL_REVIEW",
  BLOCKED: "BLOCKED"
};

export const BRACKET_RECONCILIATION_CODES = {
  BRACKET_EQUIVALENT: "BRACKET_EQUIVALENT",
  CURRENT_ONLY_MATCH: "CURRENT_ONLY_MATCH",
  GENERATED_ONLY_MATCH: "GENERATED_ONLY_MATCH",
  IDENTITY_MISMATCH: "IDENTITY_MISMATCH",
  STRUCTURAL_MISMATCH: "STRUCTURAL_MISMATCH",
  ROUTE_MISMATCH: "ROUTE_MISMATCH",
  LEGACY_REPRESENTATION_ONLY: "LEGACY_REPRESENTATION_ONLY",
  CURRENT_BRACKET_MISSING: "CURRENT_BRACKET_MISSING",
  READINESS_BLOCKED: "READINESS_BLOCKED",
  READINESS_UNSUPPORTED: "READINESS_UNSUPPORTED",
  READINESS_INVALID: "READINESS_INVALID",
  DUPLICATE_OR_INVALID_MATCH_ID: "DUPLICATE_OR_INVALID_MATCH_ID"
};

function normalizeValue(value) {
  if (value === undefined || value === null || value === "") return null;
  return value;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function classifyDifferenceCode(code) {
  if (
    [
      BRACKET_COMPARISON_CODES.ENTRY_ID_MISMATCH,
      BRACKET_COMPARISON_CODES.PARTICIPANT_ID_MISMATCH,
      BRACKET_COMPARISON_CODES.PARTICIPANT_MISMATCH
    ].includes(code)
  ) {
    return {
      category: "IDENTITY",
      reconciliationCode: BRACKET_RECONCILIATION_CODES.IDENTITY_MISMATCH,
      action: BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW
    };
  }

  if (
    [
      BRACKET_COMPARISON_CODES.ROUND_MISMATCH,
      BRACKET_COMPARISON_CODES.PHASE_MISMATCH,
      BRACKET_COMPARISON_CODES.PHASE_GROUP_MISMATCH,
      BRACKET_COMPARISON_CODES.STRUCTURE_MISMATCH,
      BRACKET_COMPARISON_CODES.POSITION_MISMATCH,
      BRACKET_COMPARISON_CODES.BRACKET_MISMATCH
    ].includes(code)
  ) {
    return {
      category: "STRUCTURE",
      reconciliationCode: BRACKET_RECONCILIATION_CODES.STRUCTURAL_MISMATCH,
      action: BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW
    };
  }

  if (
    [
      BRACKET_COMPARISON_CODES.WINNER_ROUTE_MISMATCH,
      BRACKET_COMPARISON_CODES.LOSER_ROUTE_MISMATCH
    ].includes(code)
  ) {
    return {
      category: "ROUTE",
      reconciliationCode: BRACKET_RECONCILIATION_CODES.ROUTE_MISMATCH,
      action: BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW
    };
  }

  if (code === BRACKET_COMPARISON_CODES.LEGACY_REPRESENTATION_ONLY) {
    return {
      category: "LEGACY_REPRESENTATION",
      reconciliationCode: BRACKET_RECONCILIATION_CODES.LEGACY_REPRESENTATION_ONLY,
      action: BRACKET_RECONCILIATION_ACTIONS.KEEP_CURRENT
    };
  }

  return {
    category: "UNKNOWN",
    reconciliationCode: null,
    action: BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW
  };
}

function buildMatchPlan(match, {
  type,
  action,
  reasonCodes = [],
  differences = []
} = {}) {
  return {
    matchId: normalizeValue(match?.id),
    type,
    action,
    reasonCodes: unique(reasonCodes),
    differences: Array.isArray(differences) ? differences : []
  };
}

function buildCurrentOnlyPlans(currentOnly = []) {
  return currentOnly.map((match) =>
    buildMatchPlan(match, {
      type: "CURRENT_ONLY",
      action: BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW,
      reasonCodes: [BRACKET_RECONCILIATION_CODES.CURRENT_ONLY_MATCH]
    })
  );
}

function buildGeneratedOnlyPlans(generatedOnly = []) {
  return generatedOnly.map((match) =>
    buildMatchPlan(match, {
      type: "GENERATED_ONLY",
      action: BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW,
      reasonCodes: [BRACKET_RECONCILIATION_CODES.GENERATED_ONLY_MATCH]
    })
  );
}

function buildComparedMatchPlans(comparisons = []) {
  return comparisons.map((comparison) => {
    const differences = Array.isArray(comparison?.differences)
      ? comparison.differences
      : [];

    if (!differences.length || comparison?.equivalent) {
      return buildMatchPlan(comparison, {
        type: "EQUIVALENT",
        action: BRACKET_RECONCILIATION_ACTIONS.KEEP_CURRENT,
        reasonCodes: [
          comparison?.legacyRepresentationOnly
            ? BRACKET_RECONCILIATION_CODES.LEGACY_REPRESENTATION_ONLY
            : BRACKET_RECONCILIATION_CODES.BRACKET_EQUIVALENT
        ],
        differences
      });
    }

    const classified = differences
      .map((difference) => classifyDifferenceCode(difference?.code))
      .filter((item) => item.reconciliationCode);

    const reasonCodes = unique(
      classified.map((item) => item.reconciliationCode)
    );

    const requiresManualReview = classified.some(
      (item) => item.action === BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW
    );

    return buildMatchPlan(comparison, {
      type: "DIFFERENCE",
      action: requiresManualReview
        ? BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW
        : BRACKET_RECONCILIATION_ACTIONS.KEEP_CURRENT,
      reasonCodes,
      differences
    });
  });
}

function buildRoutePlans(routes = {}) {
  const winnerOnly = Array.isArray(routes?.currentOnly)
    ? routes.currentOnly.filter((route) => route?.type === "WINNER")
    : [];
  const loserOnly = Array.isArray(routes?.currentOnly)
    ? routes.currentOnly.filter((route) => route?.type === "LOSER")
    : [];
  const winnerGenerated = Array.isArray(routes?.generatedOnly)
    ? routes.generatedOnly.filter((route) => route?.type === "WINNER")
    : [];
  const loserGenerated = Array.isArray(routes?.generatedOnly)
    ? routes.generatedOnly.filter((route) => route?.type === "LOSER")
    : [];

  return [
    ...winnerOnly,
    ...loserOnly,
    ...winnerGenerated,
    ...loserGenerated
  ].map((route) => ({
    type: route.type || null,
    sourceMatchId: route.sourceMatchId || null,
    destinationMatchId: route.destinationMatchId || null,
    destinationSlot: route.destinationSlot || null,
    action: BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW,
    reasonCodes: [BRACKET_RECONCILIATION_CODES.ROUTE_MISMATCH]
  }));
}

function buildSummary(matchPlans = [], routePlans = []) {
  return {
    totalMatchPlans: matchPlans.length,
    equivalentMatches: matchPlans.filter(
      (plan) => plan.type === "EQUIVALENT"
    ).length,
    currentOnlyMatches: matchPlans.filter(
      (plan) => plan.type === "CURRENT_ONLY"
    ).length,
    generatedOnlyMatches: matchPlans.filter(
      (plan) => plan.type === "GENERATED_ONLY"
    ).length,
    differenceMatches: matchPlans.filter(
      (plan) => plan.type === "DIFFERENCE"
    ).length,
    manualReviewMatches: matchPlans.filter(
      (plan) =>
        plan.action === BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW
    ).length,
    routePlans: routePlans.length,
    manualReviewRoutes: routePlans.filter(
      (plan) =>
        plan.action === BRACKET_RECONCILIATION_ACTIONS.REQUIRES_MANUAL_REVIEW
    ).length
  };
}

function blockedResult(status, reasonCodes, readiness = null, comparison = null) {
  return {
    status,
    reasonCodes: unique(reasonCodes),
    migrationPlanReady: false,
    readiness,
    comparison,
    matches: [],
    routes: [],
    summary: buildSummary([], [])
  };
}

/**
 * Builds a read-only reconciliation plan from an existing Comparison result.
 *
 * V1 deliberately refuses to automatically adopt the generated bracket when
 * identities, structure or advancement routes differ. Those cases require a
 * later explicit migration policy.
 */
export function buildCompetitionBracketReconciliationPlan(
  event = {},
  options = {}
) {
  const currentBracket = options.currentBracket ?? null;

  if (!currentBracket) {
    return blockedResult(
      BRACKET_RECONCILIATION_STATUS.BLOCKED,
      [BRACKET_RECONCILIATION_CODES.CURRENT_BRACKET_MISSING]
    );
  }

  const readiness = options.readiness ||
    evaluateCompetitionBracketMigrationReadiness(event, {
      ...options,
      currentBracket
    });

  if (!readiness || typeof readiness !== "object") {
    return blockedResult(
      BRACKET_RECONCILIATION_STATUS.INVALID,
      [BRACKET_RECONCILIATION_CODES.READINESS_INVALID]
    );
  }

  if (readiness.status === BRACKET_MIGRATION_READINESS_STATUS.UNSUPPORTED) {
    return blockedResult(
      BRACKET_RECONCILIATION_STATUS.UNSUPPORTED,
      [
        BRACKET_RECONCILIATION_CODES.READINESS_UNSUPPORTED,
        ...(Array.isArray(readiness.reasonCodes) ? readiness.reasonCodes : [])
      ],
      readiness
    );
  }

  if (
    readiness.status === BRACKET_MIGRATION_READINESS_STATUS.BLOCKED
  ) {
    return blockedResult(
      BRACKET_RECONCILIATION_STATUS.BLOCKED,
      [
        BRACKET_RECONCILIATION_CODES.READINESS_BLOCKED,
        ...(Array.isArray(readiness.reasonCodes) ? readiness.reasonCodes : [])
      ],
      readiness
    );
  }

  if (
    readiness.status === BRACKET_MIGRATION_READINESS_STATUS.INVALID
  ) {
    return blockedResult(
      BRACKET_RECONCILIATION_STATUS.INVALID,
      [
        BRACKET_RECONCILIATION_CODES.READINESS_INVALID,
        ...(Array.isArray(readiness.reasonCodes) ? readiness.reasonCodes : [])
      ],
      readiness
    );
  }

  const comparison = options.comparison ||
    readiness.comparison ||
    compareCompetitionBrackets(event, {
      ...options,
      currentBracket
    });

  if (!comparison || typeof comparison !== "object") {
    return blockedResult(
      BRACKET_RECONCILIATION_STATUS.INVALID,
      [BRACKET_RECONCILIATION_CODES.READINESS_INVALID],
      readiness
    );
  }

  if (comparison.status === BRACKET_COMPARISON_STATUS.UNSUPPORTED) {
    return blockedResult(
      BRACKET_RECONCILIATION_STATUS.UNSUPPORTED,
      [BRACKET_RECONCILIATION_CODES.READINESS_UNSUPPORTED],
      readiness,
      comparison
    );
  }

  if (comparison.status === BRACKET_COMPARISON_STATUS.INVALID) {
    return blockedResult(
      BRACKET_RECONCILIATION_STATUS.INVALID,
      [BRACKET_RECONCILIATION_CODES.READINESS_INVALID],
      readiness,
      comparison
    );
  }

  if (comparison.status === BRACKET_COMPARISON_STATUS.MATCH) {
    const matchPlans = buildComparedMatchPlans(comparison.matches || []);
    const routePlans = buildRoutePlans(comparison.routes);

    return {
      status: BRACKET_RECONCILIATION_STATUS.NOT_REQUIRED,
      reasonCodes: comparison.summary?.legacyRepresentationOnly > 0
        ? [BRACKET_RECONCILIATION_CODES.LEGACY_REPRESENTATION_ONLY]
        : [BRACKET_RECONCILIATION_CODES.BRACKET_EQUIVALENT],
      migrationPlanReady: true,
      readiness,
      comparison,
      matches: matchPlans,
      routes: routePlans,
      summary: buildSummary(matchPlans, routePlans)
    };
  }

  const matchPlans = [
    ...buildComparedMatchPlans(comparison.matches || []),
    ...buildCurrentOnlyPlans(comparison.currentOnly || []),
    ...buildGeneratedOnlyPlans(comparison.generatedOnly || [])
  ];

  const routePlans = buildRoutePlans(comparison.routes);

  return {
    status: BRACKET_RECONCILIATION_STATUS.PLAN_REQUIRED,
    reasonCodes: unique(
      matchPlans.flatMap((plan) => plan.reasonCodes).concat(
        routePlans.flatMap((plan) => plan.reasonCodes)
      )
    ),
    migrationPlanReady: false,
    readiness,
    comparison,
    matches: matchPlans,
    routes: routePlans,
    summary: buildSummary(matchPlans, routePlans)
  };
}

/**
 * Compact summary for development tooling and future migration guards.
 */
export function getCompetitionBracketReconciliationSummary(
  event = {},
  options = {}
) {
  const plan = buildCompetitionBracketReconciliationPlan(event, options);

  return {
    status: plan.status,
    reasonCodes: plan.reasonCodes,
    migrationPlanReady: plan.migrationPlanReady,
    ...plan.summary
  };
}

/**
 * Returns true only when reconciliation found no actionable differences.
 *
 * This does not authorize a migration by itself; migration remains a future
 * explicit operation.
 */
export function isCompetitionBracketReconciliationComplete(plan = {}) {
  return Boolean(
    plan &&
    plan.status === BRACKET_RECONCILIATION_STATUS.NOT_REQUIRED &&
    plan.migrationPlanReady === true
  );
}
