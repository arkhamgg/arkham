// ========================================
// ARKHAM — Competition Bracket Migration Readiness
// ========================================
//
// Bracket Migration Readiness v1.
//
// Evaluates whether the current operational bracket and the generated
// Competition Core bracket are in a safe state for the next migration step.
//
// IMPORTANT:
// - No Firebase writes.
// - No Tournament Pro mutation.
// - No replacement of generateBracket().
// - No Match mutation.
// - No persistence command is produced.
// - This module does not migrate anything.
//
// The purpose of V1 is to establish a deterministic gate between:
//   Generation -> Comparison -> Reconciliation -> Migration
//
// It intentionally treats migration as a later operation. A competition may
// be structurally comparable without being safe to migrate while LIVE.
// ========================================

import {
  BRACKET_GENERATION_STATUS,
  generateCompetitionBracket
} from "./competitionBracketGeneration.js";

import {
  BRACKET_COMPARISON_STATUS,
  BRACKET_COMPARISON_CODES,
  compareCompetitionBrackets
} from "./competitionBracketComparison.js";

export const BRACKET_MIGRATION_READINESS_STATUS = {
  READY: "READY",
  RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
  BLOCKED: "BLOCKED",
  UNSUPPORTED: "UNSUPPORTED",
  INVALID: "INVALID"
};

export const BRACKET_MIGRATION_READINESS_CODES = {
  GENERATION_NOT_READY: "GENERATION_NOT_READY",
  CURRENT_BRACKET_MISSING: "CURRENT_BRACKET_MISSING",
  CURRENT_BRACKET_NOT_COMPARABLE: "CURRENT_BRACKET_NOT_COMPARABLE",
  STRUCTURAL_DIFFERENCES: "STRUCTURAL_DIFFERENCES",
  IDENTITY_DIFFERENCES: "IDENTITY_DIFFERENCES",
  ROUTE_DIFFERENCES: "ROUTE_DIFFERENCES",
  CURRENT_ONLY_MATCHES: "CURRENT_ONLY_MATCHES",
  GENERATED_ONLY_MATCHES: "GENERATED_ONLY_MATCHES",
  LEGACY_REPRESENTATION_ONLY: "LEGACY_REPRESENTATION_ONLY",
  COMPETITION_LIVE: "COMPETITION_LIVE",
  COMPETITION_COMPLETED: "COMPETITION_COMPLETED",
  COMPETITION_ARCHIVED: "COMPETITION_ARCHIVED"
};

const ACTIVE_COMPETITION_STATES = new Set([
  "LIVE"
]);

const CLOSED_COMPETITION_STATES = new Set([
  "COMPLETED",
  "ARCHIVED"
]);

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

function classifyOperationalState(event = {}) {
  const state = getCompetitionState(event);

  if (ACTIVE_COMPETITION_STATES.has(state)) {
    return {
      state,
      safeForMigration: false,
      code: BRACKET_MIGRATION_READINESS_CODES.COMPETITION_LIVE
    };
  }

  if (state === "COMPLETED") {
    return {
      state,
      safeForMigration: false,
      code: BRACKET_MIGRATION_READINESS_CODES.COMPETITION_COMPLETED
    };
  }

  if (state === "ARCHIVED") {
    return {
      state,
      safeForMigration: false,
      code: BRACKET_MIGRATION_READINESS_CODES.COMPETITION_ARCHIVED
    };
  }

  return {
    state,
    safeForMigration: true,
    code: null
  };
}

function addUnique(list, values = []) {
  values.forEach((value) => {
    if (value && !list.includes(value)) list.push(value);
  });
  return list;
}

function classifyComparison(comparison = {}) {
  const codes = [];

  if (comparison.status === BRACKET_COMPARISON_STATUS.MATCH) {
    if (comparison.summary?.legacyRepresentationOnly > 0) {
      codes.push(BRACKET_MIGRATION_READINESS_CODES.LEGACY_REPRESENTATION_ONLY);
    }

    return {
      equivalent: true,
      codes,
      blocking: false,
      reconciliationRequired: false
    };
  }

  if (
    comparison.summary?.currentOnly > 0 ||
    Array.isArray(comparison.currentOnly) && comparison.currentOnly.length > 0
  ) {
    codes.push(BRACKET_MIGRATION_READINESS_CODES.CURRENT_ONLY_MATCHES);
  }

  if (
    comparison.summary?.generatedOnly > 0 ||
    Array.isArray(comparison.generatedOnly) && comparison.generatedOnly.length > 0
  ) {
    codes.push(BRACKET_MIGRATION_READINESS_CODES.GENERATED_ONLY_MATCHES);
  }

  if (
    comparison.summary?.identityMismatches > 0 ||
    comparison.summary?.participantMismatches > 0
  ) {
    codes.push(BRACKET_MIGRATION_READINESS_CODES.IDENTITY_DIFFERENCES);
  }

  if (
    comparison.summary?.roundMismatches > 0 ||
    comparison.summary?.structureMismatches > 0 ||
    comparison.summary?.phaseMismatches > 0 ||
    comparison.reasonCodes?.some((code) => [
      BRACKET_COMPARISON_CODES.ROUND_MISMATCH,
      BRACKET_COMPARISON_CODES.STRUCTURE_MISMATCH,
      BRACKET_COMPARISON_CODES.PHASE_MISMATCH,
      BRACKET_COMPARISON_CODES.PHASE_GROUP_MISMATCH,
      BRACKET_COMPARISON_CODES.POSITION_MISMATCH,
      BRACKET_COMPARISON_CODES.BRACKET_MISMATCH
    ].includes(code))
  ) {
    codes.push(BRACKET_MIGRATION_READINESS_CODES.STRUCTURAL_DIFFERENCES);
  }

  if (
    comparison.summary?.winnerRouteMismatches > 0 ||
    comparison.summary?.loserRouteMismatches > 0
  ) {
    codes.push(BRACKET_MIGRATION_READINESS_CODES.ROUTE_DIFFERENCES);
  }

  return {
    equivalent: false,
    codes,
    blocking: true,
    reconciliationRequired: true
  };
}

function buildEmptySummary() {
  return {
    currentMatchCount: 0,
    generatedMatchCount: 0,
    equivalentMatches: 0,
    currentOnly: 0,
    generatedOnly: 0,
    identityMismatches: 0,
    roundMismatches: 0,
    participantMismatches: 0,
    winnerRouteMismatches: 0,
    loserRouteMismatches: 0,
    structureMismatches: 0,
    phaseMismatches: 0,
    legacyRepresentationOnly: 0
  };
}

function buildBlockedResult({
  status,
  reasonCodes,
  generation = null,
  comparison = null,
  operationalState = null
}) {
  return {
    status,
    reasonCodes: [...new Set(reasonCodes)],
    migrationSafe: false,
    reconciliationRequired: false,
    operationalState,
    generation,
    comparison,
    summary: comparison?.summary || buildEmptySummary()
  };
}

/**
 * Evaluates whether a competition bracket is ready for the next migration
 * stage.
 *
 * The caller supplies currentBracket because this V1 layer deliberately does
 * not reach into Tournament Pro state or Firebase.
 *
 * Output semantics:
 * - READY: generated and current brackets are equivalent; no reconciliation
 *   is required before a future migration command is considered.
 * - RECONCILIATION_REQUIRED: generation is valid but structural/identity/
 *   route differences remain between current and generated graphs.
 * - BLOCKED: required input is missing or the competition is not a safe
 *   migration target (for example LIVE, COMPLETED or ARCHIVED).
 * - UNSUPPORTED: Competition Core cannot generate this structure yet.
 * - INVALID: generation/comparison data is malformed or otherwise unusable.
 */
export function evaluateCompetitionBracketMigrationReadiness(event = {}, options = {}) {
  const currentBracket = options.currentBracket ?? null;
  const operationalState = classifyOperationalState(event);

  if (!currentBracket) {
    return buildBlockedResult({
      status: BRACKET_MIGRATION_READINESS_STATUS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_READINESS_CODES.CURRENT_BRACKET_MISSING],
      operationalState
    });
  }

  const generation = options.generated ||
    generateCompetitionBracket(event, options);

  if (!generation || typeof generation !== "object") {
    return buildBlockedResult({
      status: BRACKET_MIGRATION_READINESS_STATUS.INVALID,
      reasonCodes: [BRACKET_MIGRATION_READINESS_CODES.GENERATION_NOT_READY],
      operationalState
    });
  }

  if (generation.status === BRACKET_GENERATION_STATUS.UNSUPPORTED) {
    return buildBlockedResult({
      status: BRACKET_MIGRATION_READINESS_STATUS.UNSUPPORTED,
      reasonCodes: [
        BRACKET_MIGRATION_READINESS_CODES.GENERATION_NOT_READY,
        ...(Array.isArray(generation.reasonCodes) ? generation.reasonCodes : [])
      ],
      generation,
      operationalState
    });
  }

  if (generation.status !== BRACKET_GENERATION_STATUS.READY) {
    return buildBlockedResult({
      status: BRACKET_MIGRATION_READINESS_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_READINESS_CODES.GENERATION_NOT_READY,
        ...(Array.isArray(generation.reasonCodes) ? generation.reasonCodes : [])
      ],
      generation,
      operationalState
    });
  }

  const comparison = options.comparison ||
    compareCompetitionBrackets(event, {
      ...options,
      currentBracket,
      generated: generation
    });

  if (!comparison || typeof comparison !== "object") {
    return buildBlockedResult({
      status: BRACKET_MIGRATION_READINESS_STATUS.INVALID,
      reasonCodes: [BRACKET_MIGRATION_READINESS_CODES.CURRENT_BRACKET_NOT_COMPARABLE],
      generation,
      operationalState
    });
  }

  if (comparison.status === BRACKET_COMPARISON_STATUS.UNSUPPORTED) {
    return buildBlockedResult({
      status: BRACKET_MIGRATION_READINESS_STATUS.UNSUPPORTED,
      reasonCodes: [
        BRACKET_MIGRATION_READINESS_CODES.GENERATION_NOT_READY,
        ...(Array.isArray(comparison.reasonCodes) ? comparison.reasonCodes : [])
      ],
      generation,
      comparison,
      operationalState
    });
  }

  if (comparison.status === BRACKET_COMPARISON_STATUS.INVALID) {
    return buildBlockedResult({
      status: BRACKET_MIGRATION_READINESS_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_READINESS_CODES.CURRENT_BRACKET_NOT_COMPARABLE,
        ...(Array.isArray(comparison.reasonCodes) ? comparison.reasonCodes : [])
      ],
      generation,
      comparison,
      operationalState
    });
  }

  const comparisonClassification = classifyComparison(comparison);
  const reasonCodes = [];
  addUnique(reasonCodes, comparisonClassification.codes);

  if (!operationalState.safeForMigration) {
    if (operationalState.code) reasonCodes.push(operationalState.code);

    return buildBlockedResult({
      status: BRACKET_MIGRATION_READINESS_STATUS.BLOCKED,
      reasonCodes,
      generation,
      comparison,
      operationalState
    });
  }

  if (comparisonClassification.equivalent) {
    return {
      status: BRACKET_MIGRATION_READINESS_STATUS.READY,
      reasonCodes: reasonCodes.length
        ? [...new Set(reasonCodes)]
        : ["BRACKET_EQUIVALENT"],
      migrationSafe: true,
      reconciliationRequired: false,
      operationalState,
      generation,
      comparison,
      summary: comparison.summary || buildEmptySummary()
    };
  }

  return {
    status: BRACKET_MIGRATION_READINESS_STATUS.RECONCILIATION_REQUIRED,
    reasonCodes: [...new Set(reasonCodes)],
    migrationSafe: false,
    reconciliationRequired: true,
    operationalState,
    generation,
    comparison,
    summary: comparison.summary || buildEmptySummary()
  };
}

/**
 * Compact summary for development tooling and future migration guards.
 */
export function getCompetitionBracketMigrationReadinessSummary(event = {}, options = {}) {
  const readiness = evaluateCompetitionBracketMigrationReadiness(event, options);

  return {
    status: readiness.status,
    reasonCodes: readiness.reasonCodes,
    migrationSafe: readiness.migrationSafe,
    reconciliationRequired: readiness.reconciliationRequired,
    competitionState: readiness.operationalState?.state || null,
    ...readiness.summary
  };
}

/**
 * Returns true only when the bracket is structurally equivalent to the
 * generated Competition Core graph and the competition is not in a blocked
 * operational state.
 */
export function canMigrateCompetitionBracket(readiness = {}) {
  return Boolean(
    readiness &&
    readiness.status === BRACKET_MIGRATION_READINESS_STATUS.READY &&
    readiness.migrationSafe === true &&
    readiness.reconciliationRequired === false
  );
}

/**
 * Returns true when generation/comparison are valid but reconciliation work
 * remains before a migration can be considered.
 */
export function requiresCompetitionBracketReconciliation(readiness = {}) {
  return Boolean(
    readiness &&
    readiness.status === BRACKET_MIGRATION_READINESS_STATUS.RECONCILIATION_REQUIRED &&
    readiness.reconciliationRequired === true
  );
}
