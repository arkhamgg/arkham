// ========================================
// ARKHAM — Competition Bracket Migration Persistence
// ========================================
//
// Bracket Migration Persistence Adapter v1.
//
// Persists a previously validated/materialized Competition Core bracket
// into the legacy operational event shape consumed by Tournament Pro.
//
// IMPORTANT:
// - This module is the first persistence-capable migration layer.
// - It does NOT generate, compare, reconcile, or authorize a migration.
// - Callers must provide a proposed legacy bracket that has already passed
//   the migration pipeline.
// - Persistence is disabled by default and requires explicit confirmation.
// - It writes only `event.bracket`; it does not replace the whole event.
// - After writing, it reloads the event and verifies the persisted bracket.
// - It does not modify Tournament Pro UI or operational Match state.
//
// Intended pipeline:
//
// Generation
//   -> Comparison
//   -> Readiness
//   -> Reconciliation
//   -> Policy
//   -> Dry Run
//   -> Dual Validation
//   -> Materializer
//   -> Executor
//   -> Persistence Adapter
//   -> Reload + Verification
//
// ========================================

import {
  getMapEntity,
  updateMapEntity
} from "./firestore.js";

export const BRACKET_MIGRATION_PERSISTENCE_STATUS = {
  READY: "READY",
  NO_CHANGE: "NO_CHANGE",
  BLOCKED: "BLOCKED",
  FAILED: "FAILED",
  VERIFICATION_FAILED: "VERIFICATION_FAILED",
  INVALID: "INVALID"
};

export const BRACKET_MIGRATION_PERSISTENCE_CODES = {
  TOURNAMENT_ID_MISSING: "TOURNAMENT_ID_MISSING",
  EVENT_ID_MISSING: "EVENT_ID_MISSING",
  CURRENT_EVENT_MISSING: "CURRENT_EVENT_MISSING",
  CURRENT_BRACKET_MISSING: "CURRENT_BRACKET_MISSING",
  PROPOSED_BRACKET_MISSING: "PROPOSED_BRACKET_MISSING",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  COMPETITION_STATE_BLOCKED: "COMPETITION_STATE_BLOCKED",
  CURRENT_BRACKET_CHANGED: "CURRENT_BRACKET_CHANGED",
  BRACKET_ALREADY_EQUAL: "BRACKET_ALREADY_EQUAL",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
  PERSISTED_EVENT_MISSING: "PERSISTED_EVENT_MISSING",
  PERSISTED_BRACKET_MISSING: "PERSISTED_BRACKET_MISSING",
  PERSISTED_BRACKET_MISMATCH: "PERSISTED_BRACKET_MISMATCH",
  INVALID_BRACKET_SHAPE: "INVALID_BRACKET_SHAPE"
};

const BLOCKED_COMPETITION_STATES = new Set([
  "LIVE",
  "COMPLETED",
  "ARCHIVED"
]);

function clone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function stableNormalize(value) {
  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableNormalize(value[key]);
        return result;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableNormalize(value));
}

function normalizeCompetitionState(event) {
  return (
    event?.status ||
    event?.pro?.status ||
    event?.competition?.status ||
    null
  );
}

function isValidBracketShape(bracket) {
  return Boolean(
    bracket &&
    typeof bracket === "object" &&
    !Array.isArray(bracket) &&
    Array.isArray(bracket.stages)
  );
}

function getCurrentBracket(event) {
  return event?.pro?.bracket || null;
}

function areBracketsEqual(currentBracket, proposedBracket) {
  return (
    stableStringify(currentBracket) ===
    stableStringify(proposedBracket)
  );
}

function buildResult({
  status,
  reasonCodes = [],
  tournamentId = null,
  eventId = null,
  competitionState = null,
  persisted = false,
  verified = false,
  changed = false,
  currentBracket = null,
  proposedBracket = null,
  persistedBracket = null,
  error = null
}) {
  return {
    status,
    reasonCodes,
    tournamentId,
    eventId,
    competitionState,
    persisted,
    verified,
    changed,
    currentBracket: clone(currentBracket),
    proposedBracket: clone(proposedBracket),
    persistedBracket: clone(persistedBracket),
    error
  };
}

/**
 * Reads the current operational event and performs the final pre-persistence
 * checks without writing anything.
 */
export async function prepareCompetitionBracketMigrationPersistence({
  tournamentId = null,
  eventId = null,
  proposedBracket = null
} = {}) {
  const reasonCodes = [];

  if (!tournamentId) {
    reasonCodes.push(
      BRACKET_MIGRATION_PERSISTENCE_CODES.TOURNAMENT_ID_MISSING
    );
  }

  if (!eventId) {
    reasonCodes.push(
      BRACKET_MIGRATION_PERSISTENCE_CODES.EVENT_ID_MISSING
    );
  }

  if (!proposedBracket) {
    reasonCodes.push(
      BRACKET_MIGRATION_PERSISTENCE_CODES.PROPOSED_BRACKET_MISSING
    );
  }

  if (reasonCodes.length) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.INVALID,
      reasonCodes,
      tournamentId,
      eventId,
      proposedBracket
    });
  }

  if (!isValidBracketShape(proposedBracket)) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.INVALID_BRACKET_SHAPE
      ],
      tournamentId,
      eventId,
      proposedBracket
    });
  }

  const currentEvent = await getMapEntity(
    "tournaments",
    tournamentId,
    "events",
    eventId
  );

  if (!currentEvent) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.CURRENT_EVENT_MISSING
      ],
      tournamentId,
      eventId,
      proposedBracket
    });
  }

  const competitionState =
    normalizeCompetitionState(currentEvent);

  if (BLOCKED_COMPETITION_STATES.has(competitionState)) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.COMPETITION_STATE_BLOCKED
      ],
      tournamentId,
      eventId,
      competitionState,
      currentBracket: getCurrentBracket(currentEvent),
      proposedBracket
    });
  }

  const currentBracket =
    getCurrentBracket(currentEvent);

  if (!isValidBracketShape(currentBracket)) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.CURRENT_BRACKET_MISSING
      ],
      tournamentId,
      eventId,
      competitionState,
      currentBracket,
      proposedBracket
    });
  }

  if (areBracketsEqual(currentBracket, proposedBracket)) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.NO_CHANGE,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.BRACKET_ALREADY_EQUAL
      ],
      tournamentId,
      eventId,
      competitionState,
      currentBracket,
      proposedBracket,
      changed: false
    });
  }

  return buildResult({
    status:
      BRACKET_MIGRATION_PERSISTENCE_STATUS.READY,
    reasonCodes: [],
    tournamentId,
    eventId,
    competitionState,
    currentBracket,
    proposedBracket,
    changed: true
  });
}

/**
 * Persists the proposed legacy bracket after an explicit confirmation.
 *
 * This function deliberately re-reads the event immediately before writing.
 * That protects against using a stale in-memory bracket as the migration
 * source. It is not a database transaction, so a concurrent write can still
 * race between the final read and updateDoc().
 */
export async function persistCompetitionBracketMigration({
  tournamentId = null,
  eventId = null,
  proposedBracket = null,
  confirmPersistence = false
} = {}) {
  if (!confirmPersistence) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.CONFIRMATION_REQUIRED
      ],
      tournamentId,
      eventId,
      proposedBracket
    });
  }

  const preparation =
    await prepareCompetitionBracketMigrationPersistence({
      tournamentId,
      eventId,
      proposedBracket
    });

  if (
    preparation.status ===
    BRACKET_MIGRATION_PERSISTENCE_STATUS.NO_CHANGE
  ) {
    return preparation;
  }

  if (
    preparation.status !==
    BRACKET_MIGRATION_PERSISTENCE_STATUS.READY
  ) {
    return preparation;
  }

  const latestEvent = await getMapEntity(
    "tournaments",
    tournamentId,
    "events",
    eventId
  );

  if (!latestEvent) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.CURRENT_EVENT_MISSING
      ],
      tournamentId,
      eventId,
      competitionState:
        preparation.competitionState,
      currentBracket:
        preparation.currentBracket,
      proposedBracket
    });
  }

  const latestCurrentBracket =
    getCurrentBracket(latestEvent);

  if (!isValidBracketShape(latestCurrentBracket)) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.CURRENT_BRACKET_MISSING
      ],
      tournamentId,
      eventId,
      competitionState:
        normalizeCompetitionState(latestEvent),
      currentBracket: latestCurrentBracket,
      proposedBracket
    });
  }

  if (
    !areBracketsEqual(
      preparation.currentBracket,
      latestCurrentBracket
    )
  ) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.CURRENT_BRACKET_CHANGED
      ],
      tournamentId,
      eventId,
      competitionState:
        normalizeCompetitionState(latestEvent),
      currentBracket: latestCurrentBracket,
      proposedBracket
    });
  }

  try {
    await updateMapEntity(
      "tournaments",
      tournamentId,
      "events",
      eventId,
      {
        bracket: clone(proposedBracket)
      }
    );
  } catch (error) {
    console.error(
      "ARKHAM — Error persistiendo bracket migrado:",
      error
    );

    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.FAILED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.PERSISTENCE_FAILED
      ],
      tournamentId,
      eventId,
      competitionState:
        normalizeCompetitionState(latestEvent),
      currentBracket: latestCurrentBracket,
      proposedBracket,
      changed: true,
      error
    });
  }

  const persistedEvent = await getMapEntity(
    "tournaments",
    tournamentId,
    "events",
    eventId
  );

  if (!persistedEvent) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.VERIFICATION_FAILED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.PERSISTED_EVENT_MISSING
      ],
      tournamentId,
      eventId,
      competitionState:
        normalizeCompetitionState(latestEvent),
      currentBracket: latestCurrentBracket,
      proposedBracket,
      persisted: true,
      changed: true
    });
  }

  const persistedBracket =
    getCurrentBracket(persistedEvent);

  if (!persistedBracket) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.VERIFICATION_FAILED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.PERSISTED_BRACKET_MISSING
      ],
      tournamentId,
      eventId,
      competitionState:
        normalizeCompetitionState(persistedEvent),
      currentBracket: latestCurrentBracket,
      proposedBracket,
      persisted: true,
      changed: true
    });
  }

  if (
    !areBracketsEqual(
      persistedBracket,
      proposedBracket
    )
  ) {
    return buildResult({
      status:
        BRACKET_MIGRATION_PERSISTENCE_STATUS.VERIFICATION_FAILED,
      reasonCodes: [
        BRACKET_MIGRATION_PERSISTENCE_CODES.PERSISTED_BRACKET_MISMATCH
      ],
      tournamentId,
      eventId,
      competitionState:
        normalizeCompetitionState(persistedEvent),
      currentBracket: latestCurrentBracket,
      proposedBracket,
      persistedBracket,
      persisted: true,
      changed: true
    });
  }

  return buildResult({
    status:
      BRACKET_MIGRATION_PERSISTENCE_STATUS.READY,
    reasonCodes: [],
    tournamentId,
    eventId,
    competitionState:
      normalizeCompetitionState(persistedEvent),
    currentBracket: latestCurrentBracket,
    proposedBracket,
    persistedBracket,
    persisted: true,
    verified: true,
    changed: true
  });
}

export function getCompetitionBracketMigrationPersistenceSummary(
  result
) {
  return {
    status: result?.status || null,
    reasonCodes: result?.reasonCodes || [],
    tournamentId: result?.tournamentId || null,
    eventId: result?.eventId || null,
    competitionState:
      result?.competitionState || null,
    persisted: Boolean(result?.persisted),
    verified: Boolean(result?.verified),
    changed: Boolean(result?.changed),
    canProceed:
      result?.status ===
      BRACKET_MIGRATION_PERSISTENCE_STATUS.READY &&
      result?.persisted === true &&
      result?.verified === true
  };
}

export function canProceedWithCompetitionBracketMigrationPersistence(
  result
) {
  return Boolean(
    result &&
    result.status ===
      BRACKET_MIGRATION_PERSISTENCE_STATUS.READY &&
    result.persisted === true &&
    result.verified === true
  );
}
