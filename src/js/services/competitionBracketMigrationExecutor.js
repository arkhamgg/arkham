// ========================================
// ARKHAM — Competition Bracket Migration Executor
// ========================================
//
// Bracket Migration Executor Contract v1.
//
// Defines the final in-memory execution gate between migration validation
// and any future persistence/adoption operation.
//
// IMPORTANT:
// - No Firebase writes.
// - No Tournament Pro mutation.
// - No Match mutation.
// - No persistence.
// - No migration is executed.
// - V1 returns a declarative execution plan only.
//
// Pipeline:
//
// Generation
//   -> Comparison
//   -> Migration Readiness
//   -> Reconciliation
//   -> Migration Policy
//   -> Dry Run
//   -> Dual Validation
//   -> Migration Executor Contract
//   -> Persistence/Adoption (future)
//
// V1 is intentionally defensive. Even when upstream results are supplied,
// the executor re-checks the critical gates before declaring a migration
// executable. This prevents callers from treating a stale or incomplete
// upstream result as authorization.
//
// ========================================

import {
  BRACKET_MIGRATION_READINESS_STATUS,
  evaluateCompetitionBracketMigrationReadiness
} from "./competitionBracketMigrationReadiness.js";

import {
  BRACKET_RECONCILIATION_STATUS,
  isCompetitionBracketReconciliationComplete
} from "./competitionBracketReconciliation.js";

import {
  BRACKET_MIGRATION_POLICY_STATUS,
  BRACKET_MIGRATION_POLICY_ACTIONS,
  evaluateCompetitionBracketMigrationPolicy
} from "./competitionBracketMigrationPolicy.js";

import {
  BRACKET_MIGRATION_VALIDATION_STATUS,
  validateCompetitionBracketMigration
} from "./competitionBracketMigrationValidation.js";

export const BRACKET_MIGRATION_EXECUTOR_STATUS = {
  READY: "READY",
  NO_CHANGE: "NO_CHANGE",
  BLOCKED: "BLOCKED",
  MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW_REQUIRED",
  UNSUPPORTED: "UNSUPPORTED",
  INVALID: "INVALID"
};

export const BRACKET_MIGRATION_EXECUTOR_CODES = {
  CURRENT_BRACKET_MISSING: "CURRENT_BRACKET_MISSING",
  PROPOSED_BRACKET_MISSING: "PROPOSED_BRACKET_MISSING",

  READINESS_MISSING: "READINESS_MISSING",
  READINESS_BLOCKED: "READINESS_BLOCKED",
  READINESS_UNSUPPORTED: "READINESS_UNSUPPORTED",
  READINESS_INVALID: "READINESS_INVALID",
  READINESS_RECONCILIATION_REQUIRED: "READINESS_RECONCILIATION_REQUIRED",

  RECONCILIATION_MISSING: "RECONCILIATION_MISSING",
  RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
  RECONCILIATION_BLOCKED: "RECONCILIATION_BLOCKED",
  RECONCILIATION_UNSUPPORTED: "RECONCILIATION_UNSUPPORTED",
  RECONCILIATION_INVALID: "RECONCILIATION_INVALID",

  POLICY_MISSING: "POLICY_MISSING",
  POLICY_BLOCKED: "POLICY_BLOCKED",
  POLICY_MANUAL_REVIEW: "POLICY_MANUAL_REVIEW",
  POLICY_UNSUPPORTED: "POLICY_UNSUPPORTED",
  POLICY_INVALID: "POLICY_INVALID",

  VALIDATION_MISSING: "VALIDATION_MISSING",
  CURRENT_GRAPH_INVALID: "CURRENT_GRAPH_INVALID",
  PROPOSED_GRAPH_INVALID: "PROPOSED_GRAPH_INVALID",
  DUAL_VALIDATION_FAILED: "DUAL_VALIDATION_FAILED",

  LIVE_COMPETITION_BLOCKED: "LIVE_COMPETITION_BLOCKED",
  CLOSED_COMPETITION_BLOCKED: "CLOSED_COMPETITION_BLOCKED",

  PERSISTENCE_NOT_AUTHORIZED: "PERSISTENCE_NOT_AUTHORIZED",
  PERSISTENCE_UNSUPPORTED: "PERSISTENCE_UNSUPPORTED",

  EXECUTION_NOT_AVAILABLE: "EXECUTION_NOT_AVAILABLE",
  NO_CHANGE_REQUIRED: "NO_CHANGE_REQUIRED"
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

function getOperationalStateCode(state) {
  if (state === "LIVE") {
    return BRACKET_MIGRATION_EXECUTOR_CODES.LIVE_COMPETITION_BLOCKED;
  }

  if (["COMPLETED", "ARCHIVED"].includes(state)) {
    return BRACKET_MIGRATION_EXECUTOR_CODES.CLOSED_COMPETITION_BLOCKED;
  }

  return null;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function extractMatches(bracket) {
  if (Array.isArray(bracket)) {
    return bracket;
  }

  if (Array.isArray(bracket?.stages)) {
    return bracket.stages.flatMap((stage) =>
      Array.isArray(stage?.matches) ? stage.matches : []
    );
  }

  if (Array.isArray(bracket?.bracket?.stages)) {
    return bracket.bracket.stages.flatMap((stage) =>
      Array.isArray(stage?.matches) ? stage.matches : []
    );
  }

  if (Array.isArray(bracket?.matches)) {
    return bracket.matches;
  }

  if (Array.isArray(bracket?.bracket?.matches)) {
    return bracket.bracket.matches;
  }

  return [];
}

function getMatchCount(bracket) {
  return extractMatches(bracket).length;
}

function buildBaseResult({
  status,
  reasonCodes = [],
  event = {},
  readiness = null,
  reconciliation = null,
  policy = null,
  validation = null,
  currentBracket = null,
  proposedBracket = null,
  persistenceRequested = false
} = {}) {
  return {
    status,
    reasonCodes: unique(reasonCodes),
    executable: false,
    executed: false,
    persistenceRequested: persistenceRequested === true,
    persistenceAllowed: false,
    event,
    competitionState: getCompetitionState(event),
    readiness,
    reconciliation,
    policy,
    validation,
    currentBracket,
    proposedBracket,
    beforeMatchCount: getMatchCount(currentBracket),
    afterMatchCount: getMatchCount(proposedBracket),
    executionPlan: null
  };
}

function buildExecutionPlan({
  currentBracket,
  proposedBracket
} = {}) {
  return {
    operation: "ADOPT_GENERATED_BRACKET",
    mode: "DECLARATIVE_ONLY",
    source: "COMPETITION_CORE",
    currentMatchCount: getMatchCount(currentBracket),
    proposedMatchCount: getMatchCount(proposedBracket),
    persistenceRequired: true,
    persistenceSupported: false,
    mutationRequired: true,
    executionSteps: [
      "REVALIDATE_CURRENT_GRAPH",
      "REVALIDATE_PROPOSED_GRAPH",
      "CONFIRM_COMPETITION_STATE",
      "CONFIRM_MIGRATION_POLICY",
      "PERSIST_PROPOSED_BRACKET",
      "CONFIRM_PERSISTENCE",
      "RELOAD_COMPETITION_STATE"
    ],
    note:
      "V1 only describes the future operation. No persistence or mutation is performed."
  };
}

/**
 * Builds the final in-memory executor contract.
 *
 * Upstream objects may be supplied by the caller. V1 intentionally
 * re-validates critical gates instead of trusting them blindly.
 *
 * `authorizePersistence` is deliberately ineffective in V1: persistence
 * remains unsupported until a later executor version explicitly implements
 * and tests the write path.
 */
export function executeCompetitionBracketMigration(
  event = {},
  {
    currentBracket = null,
    proposedBracket = null,
    readiness = null,
    reconciliation = null,
    policy = null,
    validation = null,
    authorizePersistence = false
  } = {}
) {
  const persistenceRequested = authorizePersistence === true;
  const competitionState = getCompetitionState(event);
  const stateCode = getOperationalStateCode(competitionState);

  if (!currentBracket) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.CURRENT_BRACKET_MISSING
      ],
      event,
      readiness,
      reconciliation,
      policy,
      validation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (!proposedBracket) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.PROPOSED_BRACKET_MISSING
      ],
      event,
      readiness,
      reconciliation,
      policy,
      validation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (stateCode) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
      reasonCodes: [stateCode],
      event,
      readiness,
      reconciliation,
      policy,
      validation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  const resolvedValidation =
    validation ||
    validateCompetitionBracketMigration(event, {
      currentBracket,
      proposedBracket,
      strictProposed: true
    });

  if (!resolvedValidation || typeof resolvedValidation !== "object") {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.VALIDATION_MISSING
      ],
      event,
      readiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedValidation.status ===
    BRACKET_MIGRATION_VALIDATION_STATUS.CURRENT_INVALID
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.CURRENT_GRAPH_INVALID
      ],
      event,
      readiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedValidation.status ===
    BRACKET_MIGRATION_VALIDATION_STATUS.PROPOSED_INVALID
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.PROPOSED_GRAPH_INVALID
      ],
      event,
      readiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedValidation.status ===
      BRACKET_MIGRATION_VALIDATION_STATUS.BOTH_INVALID ||
    resolvedValidation.status !== BRACKET_MIGRATION_VALIDATION_STATUS.READY ||
    resolvedValidation.valid !== true
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.DUAL_VALIDATION_FAILED
      ],
      event,
      readiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  const resolvedReadiness =
    readiness ||
    evaluateCompetitionBracketMigrationReadiness(event, {
      currentBracket
    });

  if (!resolvedReadiness || typeof resolvedReadiness !== "object") {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.READINESS_MISSING
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedReadiness.status ===
    BRACKET_MIGRATION_READINESS_STATUS.UNSUPPORTED
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.UNSUPPORTED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.READINESS_UNSUPPORTED
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedReadiness.status ===
    BRACKET_MIGRATION_READINESS_STATUS.BLOCKED
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.READINESS_BLOCKED
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedReadiness.status ===
    BRACKET_MIGRATION_READINESS_STATUS.INVALID
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.READINESS_INVALID
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedReadiness.status ===
    BRACKET_MIGRATION_READINESS_STATUS.RECONCILIATION_REQUIRED
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.MANUAL_REVIEW_REQUIRED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.READINESS_RECONCILIATION_REQUIRED
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedReadiness.status !==
    BRACKET_MIGRATION_READINESS_STATUS.READY
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.READINESS_INVALID
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (!reconciliation || typeof reconciliation !== "object") {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.RECONCILIATION_MISSING
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    reconciliation.status ===
    BRACKET_RECONCILIATION_STATUS.BLOCKED
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.RECONCILIATION_BLOCKED
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    reconciliation.status ===
    BRACKET_RECONCILIATION_STATUS.UNSUPPORTED
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.UNSUPPORTED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.RECONCILIATION_UNSUPPORTED
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    reconciliation.status ===
    BRACKET_RECONCILIATION_STATUS.INVALID
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.RECONCILIATION_INVALID
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    reconciliation.status !==
    BRACKET_RECONCILIATION_STATUS.NOT_REQUIRED ||
    !isCompetitionBracketReconciliationComplete(reconciliation)
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.MANUAL_REVIEW_REQUIRED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.RECONCILIATION_REQUIRED
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  const resolvedPolicy =
    policy ||
    evaluateCompetitionBracketMigrationPolicy(event, {
      readiness: resolvedReadiness,
      reconciliation
    });

  if (!resolvedPolicy || typeof resolvedPolicy !== "object") {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.POLICY_MISSING
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy: resolvedPolicy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedPolicy.status ===
    BRACKET_MIGRATION_POLICY_STATUS.UNSUPPORTED
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.UNSUPPORTED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.POLICY_UNSUPPORTED
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy: resolvedPolicy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedPolicy.status ===
    BRACKET_MIGRATION_POLICY_STATUS.INVALID
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.POLICY_INVALID
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy: resolvedPolicy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedPolicy.status ===
    BRACKET_MIGRATION_POLICY_STATUS.BLOCKED
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.POLICY_BLOCKED
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy: resolvedPolicy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedPolicy.status ===
    BRACKET_MIGRATION_POLICY_STATUS.MANUAL_REVIEW_REQUIRED
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.MANUAL_REVIEW_REQUIRED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.POLICY_MANUAL_REVIEW
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy: resolvedPolicy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  if (
    resolvedPolicy.action ===
    BRACKET_MIGRATION_POLICY_ACTIONS.NO_OP
  ) {
    return {
      ...buildBaseResult({
        status: BRACKET_MIGRATION_EXECUTOR_STATUS.NO_CHANGE,
        reasonCodes: [
          BRACKET_MIGRATION_EXECUTOR_CODES.NO_CHANGE_REQUIRED
        ],
        event,
        readiness: resolvedReadiness,
        reconciliation,
        policy: resolvedPolicy,
        validation: resolvedValidation,
        currentBracket,
        proposedBracket,
        persistenceRequested
      }),
      executable: false,
      executionPlan: {
        operation: "NO_OP",
        mode: "DECLARATIVE_ONLY",
        persistenceRequired: false,
        persistenceSupported: false,
        mutationRequired: false
      }
    };
  }

  if (
    resolvedPolicy.action !==
    BRACKET_MIGRATION_POLICY_ACTIONS.DRY_RUN_ADOPT_GENERATED
  ) {
    return buildBaseResult({
      status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_EXECUTOR_CODES.EXECUTION_NOT_AVAILABLE
      ],
      event,
      readiness: resolvedReadiness,
      reconciliation,
      policy: resolvedPolicy,
      validation: resolvedValidation,
      currentBracket,
      proposedBracket,
      persistenceRequested
    });
  }

  // V1 deliberately stops here. Even explicit caller authorization cannot
  // enable persistence until a future executor version implements the write
  // path and its corresponding transaction/rollback verification.
  return buildBaseResult({
    status: BRACKET_MIGRATION_EXECUTOR_STATUS.BLOCKED,
    reasonCodes: [
      BRACKET_MIGRATION_EXECUTOR_CODES.PERSISTENCE_UNSUPPORTED,
      ...(persistenceRequested
        ? []
        : [BRACKET_MIGRATION_EXECUTOR_CODES.PERSISTENCE_NOT_AUTHORIZED])
    ],
    event,
    readiness: resolvedReadiness,
    reconciliation,
    policy: resolvedPolicy,
    validation: resolvedValidation,
    currentBracket,
    proposedBracket,
    persistenceRequested
  });
}

/**
 * Compact executor summary for guards, diagnostics and future migration UI.
 */
export function getCompetitionBracketMigrationExecutorSummary(
  event = {},
  options = {}
) {
  const result = executeCompetitionBracketMigration(event, options);

  return {
    status: result.status,
    reasonCodes: result.reasonCodes,
    executable: result.executable === true,
    executed: result.executed === true,
    persistenceRequested: result.persistenceRequested === true,
    persistenceAllowed: result.persistenceAllowed === true,
    competitionState: result.competitionState || null,
    beforeMatchCount: result.beforeMatchCount,
    afterMatchCount: result.afterMatchCount,
    executionOperation: result.executionPlan?.operation || null,
    executionMode: result.executionPlan?.mode || null
  };
}

/**
 * Returns true only when a future executor implementation could proceed.
 *
 * V1 always returns false for real migration execution because persistence
 * is intentionally unsupported.
 */
export function canProceedWithCompetitionBracketMigrationExecution(
  result = {}
) {
  return Boolean(
    result &&
    result.status === BRACKET_MIGRATION_EXECUTOR_STATUS.READY &&
    result.executable === true &&
    result.persistenceAllowed === true &&
    result.executed !== true
  );
}

/**
 * Returns the declarative plan without executing it.
 *
 * This helper is intentionally separate from the executor guard so callers
 * can inspect the future operation without mistaking the plan for permission
 * to persist.
 */
export function getCompetitionBracketMigrationExecutionPlan(
  currentBracket = null,
  proposedBracket = null
) {
  return buildExecutionPlan({
    currentBracket,
    proposedBracket
  });
}
