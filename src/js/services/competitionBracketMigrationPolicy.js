// ========================================
// ARKHAM — Competition Bracket Migration Policy
// ========================================
//
// Bracket Migration Policy v1.
//
// Defines what a future migration operation is allowed to do after
// Generation -> Comparison -> Readiness -> Reconciliation.
//
// IMPORTANT:
// - No Firebase writes.
// - No Tournament Pro mutation.
// - No Match mutation.
// - No persistence command is executed.
// - This module only produces a declarative policy decision.
//
// V1 is intentionally conservative: differences never become automatic
// adoption. Equivalent graphs may be explicitly dry-run adopted, while
// reconciliation differences require a later explicit migration policy.
// ========================================

import {
  BRACKET_MIGRATION_READINESS_STATUS
} from "./competitionBracketMigrationReadiness.js";

import {
  BRACKET_RECONCILIATION_STATUS,
  BRACKET_RECONCILIATION_ACTIONS
} from "./competitionBracketReconciliation.js";

export const BRACKET_MIGRATION_POLICY_STATUS = {
  READY: "READY",
  MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW_REQUIRED",
  BLOCKED: "BLOCKED",
  UNSUPPORTED: "UNSUPPORTED",
  INVALID: "INVALID"
};

export const BRACKET_MIGRATION_POLICY_ACTIONS = {
  NO_OP: "NO_OP",
  DRY_RUN_ADOPT_GENERATED: "DRY_RUN_ADOPT_GENERATED",
  REQUIRES_MANUAL_REVIEW: "REQUIRES_MANUAL_REVIEW",
  BLOCKED: "BLOCKED"
};

export const BRACKET_MIGRATION_POLICY_CODES = {
  READINESS_READY: "READINESS_READY",
  RECONCILIATION_NOT_REQUIRED: "RECONCILIATION_NOT_REQUIRED",
  RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
  RECONCILIATION_BLOCKED: "RECONCILIATION_BLOCKED",
  RECONCILIATION_UNSUPPORTED: "RECONCILIATION_UNSUPPORTED",
  RECONCILIATION_INVALID: "RECONCILIATION_INVALID",
  MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW_REQUIRED",
  EQUIVALENT_GRAPH_ONLY: "EQUIVALENT_GRAPH_ONLY",
  LIVE_COMPETITION_BLOCKED: "LIVE_COMPETITION_BLOCKED",
  CLOSED_COMPETITION_BLOCKED: "CLOSED_COMPETITION_BLOCKED"
};

function normalizeState(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toUpperCase();
  return normalized || null;
}

function getCompetitionState(event = {}) {
  return normalizeState(
    event?.pro?.status ||
    event?.pro?.eventStatus ||
    event?.status ||
    event?.eventStatus ||
    event?.competition?.status
  );
}

function isOperationallyBlocked(event = {}) {
  const state = getCompetitionState(event);

  return {
    blocked: ["LIVE", "COMPLETED", "ARCHIVED"].includes(state),
    state
  };
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Evaluates the policy gate for a future migration operation.
 *
 * `allowEquivalentDryRunAdoption` must be explicitly true before V1 will
 * produce DRY_RUN_ADOPT_GENERATED. No real adoption is ever authorized here.
 */
export function evaluateCompetitionBracketMigrationPolicy(
  event = {},
  {
    readiness = null,
    reconciliation = null,
    allowEquivalentDryRunAdoption = false
  } = {}
) {
  const operational = isOperationallyBlocked(event);

  if (!readiness || typeof readiness !== "object") {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.INVALID,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_INVALID],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (operational.blocked) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.BLOCKED,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.BLOCKED,
      reasonCodes: [
        operational.state === "LIVE"
          ? BRACKET_MIGRATION_POLICY_CODES.LIVE_COMPETITION_BLOCKED
          : BRACKET_MIGRATION_POLICY_CODES.CLOSED_COMPETITION_BLOCKED
      ],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (readiness.status === BRACKET_MIGRATION_READINESS_STATUS.UNSUPPORTED) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.UNSUPPORTED,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_UNSUPPORTED],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (readiness.status === BRACKET_MIGRATION_READINESS_STATUS.INVALID) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.INVALID,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_INVALID],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (readiness.status === BRACKET_MIGRATION_READINESS_STATUS.BLOCKED) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.BLOCKED,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_BLOCKED],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (readiness.status === BRACKET_MIGRATION_READINESS_STATUS.RECONCILIATION_REQUIRED) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.MANUAL_REVIEW_REQUIRED,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.REQUIRES_MANUAL_REVIEW,
      reasonCodes: [
        BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_REQUIRED,
        BRACKET_MIGRATION_POLICY_CODES.MANUAL_REVIEW_REQUIRED
      ],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (readiness.status !== BRACKET_MIGRATION_READINESS_STATUS.READY) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.INVALID,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_INVALID],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (
    !reconciliation ||
    reconciliation.status === BRACKET_RECONCILIATION_STATUS.INVALID
  ) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.INVALID,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_INVALID],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (reconciliation.status === BRACKET_RECONCILIATION_STATUS.UNSUPPORTED) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.UNSUPPORTED,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_UNSUPPORTED],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (reconciliation.status === BRACKET_RECONCILIATION_STATUS.BLOCKED) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.BLOCKED,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_BLOCKED],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (reconciliation.status !== BRACKET_RECONCILIATION_STATUS.NOT_REQUIRED) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.MANUAL_REVIEW_REQUIRED,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.REQUIRES_MANUAL_REVIEW,
      reasonCodes: [BRACKET_MIGRATION_POLICY_CODES.MANUAL_REVIEW_REQUIRED],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  const equivalentActions = Array.isArray(reconciliation.matches)
    ? reconciliation.matches.map((match) => match?.action).filter(Boolean)
    : [];

  const hasUnexpectedAction = equivalentActions.some(
    (action) => action !== BRACKET_RECONCILIATION_ACTIONS.KEEP_CURRENT
  );

  if (hasUnexpectedAction) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.MANUAL_REVIEW_REQUIRED,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.REQUIRES_MANUAL_REVIEW,
      reasonCodes: [BRACKET_MIGRATION_POLICY_CODES.MANUAL_REVIEW_REQUIRED],
      competitionState: operational.state,
      dryRunAllowed: false,
      persistenceAllowed: false
    };
  }

  if (!allowEquivalentDryRunAdoption) {
    return {
      status: BRACKET_MIGRATION_POLICY_STATUS.READY,
      action: BRACKET_MIGRATION_POLICY_ACTIONS.NO_OP,
      reasonCodes: [
        BRACKET_MIGRATION_POLICY_CODES.READINESS_READY,
        BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_NOT_REQUIRED,
        BRACKET_MIGRATION_POLICY_CODES.EQUIVALENT_GRAPH_ONLY
      ],
      competitionState: operational.state,
      dryRunAllowed: true,
      persistenceAllowed: false
    };
  }

  return {
    status: BRACKET_MIGRATION_POLICY_STATUS.READY,
    action: BRACKET_MIGRATION_POLICY_ACTIONS.DRY_RUN_ADOPT_GENERATED,
    reasonCodes: [
      BRACKET_MIGRATION_POLICY_CODES.READINESS_READY,
      BRACKET_MIGRATION_POLICY_CODES.RECONCILIATION_NOT_REQUIRED
    ],
    competitionState: operational.state,
    dryRunAllowed: true,
    persistenceAllowed: false
  };
}

export function getCompetitionBracketMigrationPolicySummary(
  event = {},
  options = {}
) {
  const policy = evaluateCompetitionBracketMigrationPolicy(event, options);

  return {
    status: policy.status,
    action: policy.action,
    reasonCodes: unique(policy.reasonCodes),
    competitionState: policy.competitionState,
    dryRunAllowed: policy.dryRunAllowed,
    persistenceAllowed: policy.persistenceAllowed
  };
}
