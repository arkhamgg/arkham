// ========================================
// ARKHAM — Competition Bracket Migration Dry Run
// ========================================
//
// Bracket Migration Dry Run v1.
//
// Simulates the future migration result entirely in memory.
//
// IMPORTANT:
// - No Firebase writes.
// - No Tournament Pro mutation.
// - No Match mutation.
// - No persistence.
// - The returned proposed graph is a clone and must never be treated as live
//   state by callers.
// ========================================

import {
  BRACKET_MIGRATION_POLICY_ACTIONS,
  BRACKET_MIGRATION_POLICY_STATUS,
  evaluateCompetitionBracketMigrationPolicy
} from "./competitionBracketMigrationPolicy.js";

import {
  BRACKET_RECONCILIATION_STATUS,
  isCompetitionBracketReconciliationComplete
} from "./competitionBracketReconciliation.js";

export const BRACKET_MIGRATION_DRY_RUN_STATUS = {
  READY: "READY",
  NO_CHANGE: "NO_CHANGE",
  MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW_REQUIRED",
  BLOCKED: "BLOCKED",
  INVALID: "INVALID"
};

export const BRACKET_MIGRATION_DRY_RUN_CODES = {
  CURRENT_BRACKET_MISSING: "CURRENT_BRACKET_MISSING",
  GENERATED_BRACKET_MISSING: "GENERATED_BRACKET_MISSING",
  POLICY_BLOCKED: "POLICY_BLOCKED",
  POLICY_MANUAL_REVIEW: "POLICY_MANUAL_REVIEW",
  POLICY_INVALID: "POLICY_INVALID",
  POLICY_UNSUPPORTED: "POLICY_UNSUPPORTED",
  RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
  GENERATED_GRAPH_SELECTED: "GENERATED_GRAPH_SELECTED",
  NO_CHANGE_REQUIRED: "NO_CHANGE_REQUIRED",
  MATCH_COUNT_CHANGED: "MATCH_COUNT_CHANGED"
};

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function extractMatches(bracket) {
  if (Array.isArray(bracket)) return bracket;
  if (Array.isArray(bracket?.matches)) return bracket.matches;
  if (Array.isArray(bracket?.bracket?.matches)) return bracket.bracket.matches;
  return [];
}

function buildProposedBracket(currentBracket, generated) {
  const generatedMatches = clone(generated?.matches || []);

  if (Array.isArray(currentBracket)) {
    return generatedMatches;
  }

  const proposed = clone(currentBracket) || {};

  if (Array.isArray(proposed.matches)) {
    proposed.matches = generatedMatches;
  } else if (Array.isArray(proposed?.bracket?.matches)) {
    proposed.bracket.matches = generatedMatches;
  } else {
    proposed.matches = generatedMatches;
  }

  return proposed;
}

/**
 * Runs an in-memory migration simulation.
 *
 * V1 only simulates the explicitly allowed equivalent-graph adoption. Any
 * structural, identity or route difference remains blocked for manual review.
 */
export function runCompetitionBracketMigrationDryRun(
  event = {},
  {
    currentBracket = null,
    readiness = null,
    reconciliation = null,
    allowEquivalentAdoption = true
  } = {}
) {
  if (!currentBracket) {
    return {
      status: BRACKET_MIGRATION_DRY_RUN_STATUS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_DRY_RUN_CODES.CURRENT_BRACKET_MISSING],
      applied: false,
      policy: null,
      proposedBracket: null,
      beforeMatchCount: 0,
      afterMatchCount: 0
    };
  }

  const resolvedReadiness = readiness || null;
  const resolvedReconciliation = reconciliation || null;

  if (!resolvedReadiness || !resolvedReconciliation) {
    return {
      status: BRACKET_MIGRATION_DRY_RUN_STATUS.INVALID,
      reasonCodes: [BRACKET_MIGRATION_DRY_RUN_CODES.POLICY_INVALID],
      applied: false,
      policy: null,
      proposedBracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  const policy = evaluateCompetitionBracketMigrationPolicy(event, {
    readiness: resolvedReadiness,
    reconciliation: resolvedReconciliation,
    allowEquivalentDryRunAdoption: allowEquivalentAdoption
  });

  if (policy.status === BRACKET_MIGRATION_POLICY_STATUS.UNSUPPORTED) {
    return {
      status: BRACKET_MIGRATION_DRY_RUN_STATUS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_DRY_RUN_CODES.POLICY_UNSUPPORTED],
      applied: false,
      policy,
      proposedBracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  if (policy.status === BRACKET_MIGRATION_POLICY_STATUS.INVALID) {
    return {
      status: BRACKET_MIGRATION_DRY_RUN_STATUS.INVALID,
      reasonCodes: [BRACKET_MIGRATION_DRY_RUN_CODES.POLICY_INVALID],
      applied: false,
      policy,
      proposedBracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  if (policy.status === BRACKET_MIGRATION_POLICY_STATUS.BLOCKED) {
    return {
      status: BRACKET_MIGRATION_DRY_RUN_STATUS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_DRY_RUN_CODES.POLICY_BLOCKED],
      applied: false,
      policy,
      proposedBracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  if (policy.status === BRACKET_MIGRATION_POLICY_STATUS.MANUAL_REVIEW_REQUIRED) {
    return {
      status: BRACKET_MIGRATION_DRY_RUN_STATUS.MANUAL_REVIEW_REQUIRED,
      reasonCodes: [
        BRACKET_MIGRATION_DRY_RUN_CODES.POLICY_MANUAL_REVIEW,
        BRACKET_MIGRATION_DRY_RUN_CODES.RECONCILIATION_REQUIRED
      ],
      applied: false,
      policy,
      proposedBracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  if (!isCompetitionBracketReconciliationComplete(resolvedReconciliation)) {
    return {
      status: BRACKET_MIGRATION_DRY_RUN_STATUS.MANUAL_REVIEW_REQUIRED,
      reasonCodes: [BRACKET_MIGRATION_DRY_RUN_CODES.RECONCILIATION_REQUIRED],
      applied: false,
      policy,
      proposedBracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  const generated = resolvedReadiness.generation;

  if (!generated || !Array.isArray(generated.matches)) {
    return {
      status: BRACKET_MIGRATION_DRY_RUN_STATUS.INVALID,
      reasonCodes: [BRACKET_MIGRATION_DRY_RUN_CODES.GENERATED_BRACKET_MISSING],
      applied: false,
      policy,
      proposedBracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  if (policy.action === BRACKET_MIGRATION_POLICY_ACTIONS.NO_OP) {
    return {
      status: BRACKET_MIGRATION_DRY_RUN_STATUS.NO_CHANGE,
      reasonCodes: [BRACKET_MIGRATION_DRY_RUN_CODES.NO_CHANGE_REQUIRED],
      applied: false,
      policy,
      proposedBracket: clone(currentBracket),
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: extractMatches(currentBracket).length
    };
  }

  if (policy.action !== BRACKET_MIGRATION_POLICY_ACTIONS.DRY_RUN_ADOPT_GENERATED) {
    return {
      status: BRACKET_MIGRATION_DRY_RUN_STATUS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_DRY_RUN_CODES.POLICY_BLOCKED],
      applied: false,
      policy,
      proposedBracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  const proposedBracket = buildProposedBracket(currentBracket, generated);
  const beforeMatchCount = extractMatches(currentBracket).length;
  const afterMatchCount = extractMatches(proposedBracket).length;

  return {
    status: BRACKET_MIGRATION_DRY_RUN_STATUS.READY,
    reasonCodes: [BRACKET_MIGRATION_DRY_RUN_CODES.GENERATED_GRAPH_SELECTED],
    applied: false,
    policy,
    proposedBracket,
    beforeMatchCount,
    afterMatchCount,
    matchCountChanged: beforeMatchCount !== afterMatchCount,
    additionalReasonCodes:
      beforeMatchCount !== afterMatchCount
        ? [BRACKET_MIGRATION_DRY_RUN_CODES.MATCH_COUNT_CHANGED]
        : []
  };
}

export function getCompetitionBracketMigrationDryRunSummary(event = {}, options = {}) {
  const result = runCompetitionBracketMigrationDryRun(event, options);

  return {
    status: result.status,
    reasonCodes: [
      ...(Array.isArray(result.reasonCodes) ? result.reasonCodes : []),
      ...(Array.isArray(result.additionalReasonCodes)
        ? result.additionalReasonCodes
        : [])
    ],
    applied: result.applied === true,
    beforeMatchCount: result.beforeMatchCount,
    afterMatchCount: result.afterMatchCount,
    matchCountChanged: result.matchCountChanged === true,
    policyAction: result.policy?.action || null
  };
}
