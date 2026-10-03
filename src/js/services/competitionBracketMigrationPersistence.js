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
  doc,
  FieldPath,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase.js";
import { getMapEntity } from "./firestore.js";

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
  EXPECTED_CURRENT_BRACKET_MISSING: "EXPECTED_CURRENT_BRACKET_MISSING",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  COMPETITION_STATE_BLOCKED: "COMPETITION_STATE_BLOCKED",
  CURRENT_BRACKET_CHANGED: "CURRENT_BRACKET_CHANGED",
  BRACKET_ALREADY_EQUAL: "BRACKET_ALREADY_EQUAL",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
  PERSISTED_EVENT_READ_FAILED: "PERSISTED_EVENT_READ_FAILED",
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
  const state = event?.pro?.status || event?.pro?.eventStatus ||
    event?.status || event?.eventStatus || event?.competition?.status || null;
  return state === null ? null : String(state).trim().toUpperCase() || null;
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
  proposedBracket = null,
  expectedCurrentBracket = null
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
  if (expectedCurrentBracket === null) {
    reasonCodes.push(
      BRACKET_MIGRATION_PERSISTENCE_CODES.EXPECTED_CURRENT_BRACKET_MISSING
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

  if (!areBracketsEqual(currentBracket, expectedCurrentBracket)) {
    return buildResult({
      status: BRACKET_MIGRATION_PERSISTENCE_STATUS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_PERSISTENCE_CODES.CURRENT_BRACKET_CHANGED],
      tournamentId, eventId, competitionState, currentBracket, proposedBracket
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
 * Persists only after explicit confirmation. A Firestore transaction rechecks
 * the event state and expected bracket before updating events[eventId].pro.bracket.
 */
export async function persistCompetitionBracketMigration({
  tournamentId = null,
  eventId = null,
  proposedBracket = null,
  expectedCurrentBracket = null,
  confirmPersistence = false
} = {}) {
  if (!confirmPersistence) {
    return buildResult({
      status: BRACKET_MIGRATION_PERSISTENCE_STATUS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_PERSISTENCE_CODES.CONFIRMATION_REQUIRED],
      tournamentId, eventId, proposedBracket
    });
  }
  const preparation = await prepareCompetitionBracketMigrationPersistence({
    tournamentId, eventId, proposedBracket, expectedCurrentBracket
  });
  if (preparation.status === BRACKET_MIGRATION_PERSISTENCE_STATUS.NO_CHANGE) return preparation;
  if (preparation.status !== BRACKET_MIGRATION_PERSISTENCE_STATUS.READY) return preparation;

  let outcome;
  try {
    const tournamentRef = doc(db, "tournaments", tournamentId);
    outcome = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(tournamentRef);
      if (!snapshot.exists()) return { persisted: false, reasonCode: BRACKET_MIGRATION_PERSISTENCE_CODES.CURRENT_EVENT_MISSING };
      const currentEvent = snapshot.data()?.events?.[eventId] || null;
      if (!currentEvent) return { persisted: false, reasonCode: BRACKET_MIGRATION_PERSISTENCE_CODES.CURRENT_EVENT_MISSING };

      const competitionState = normalizeCompetitionState(currentEvent);
      const currentBracket = getCurrentBracket(currentEvent);
      if (BLOCKED_COMPETITION_STATES.has(competitionState)) {
        return { persisted: false, reasonCode: BRACKET_MIGRATION_PERSISTENCE_CODES.COMPETITION_STATE_BLOCKED, competitionState, currentBracket };
      }
      if (!isValidBracketShape(currentBracket)) {
        return { persisted: false, reasonCode: BRACKET_MIGRATION_PERSISTENCE_CODES.CURRENT_BRACKET_MISSING, competitionState, currentBracket };
      }
      if (!areBracketsEqual(currentBracket, expectedCurrentBracket)) {
        return { persisted: false, reasonCode: BRACKET_MIGRATION_PERSISTENCE_CODES.CURRENT_BRACKET_CHANGED, competitionState, currentBracket };
      }

      transaction.update(
        tournamentRef,
        new FieldPath("events", eventId, "pro", "bracket"),
        clone(proposedBracket),
        new FieldPath("events", eventId, "updatedAt"),
        serverTimestamp(),
        "updatedAt",
        serverTimestamp()
      );
      return { persisted: true, competitionState, currentBracket };
    });
  } catch (error) {
    console.error("ARKHAM — Error persistiendo bracket migrado:", error);
    return buildResult({
      status: BRACKET_MIGRATION_PERSISTENCE_STATUS.FAILED,
      reasonCodes: [BRACKET_MIGRATION_PERSISTENCE_CODES.PERSISTENCE_FAILED],
      tournamentId, eventId, competitionState: preparation.competitionState,
      currentBracket: preparation.currentBracket, proposedBracket, error
    });
  }

  if (!outcome?.persisted) {
    return buildResult({
      status: BRACKET_MIGRATION_PERSISTENCE_STATUS.BLOCKED,
      reasonCodes: [outcome?.reasonCode || BRACKET_MIGRATION_PERSISTENCE_CODES.PERSISTENCE_FAILED],
      tournamentId, eventId,
      competitionState: outcome?.competitionState || preparation.competitionState,
      currentBracket: outcome?.currentBracket || preparation.currentBracket,
      proposedBracket
    });
  }

  let persistedEvent;
  try {
    persistedEvent = await getMapEntity("tournaments", tournamentId, "events", eventId);
  } catch (error) {
    return buildResult({
      status: BRACKET_MIGRATION_PERSISTENCE_STATUS.VERIFICATION_FAILED,
      reasonCodes: [BRACKET_MIGRATION_PERSISTENCE_CODES.PERSISTED_EVENT_READ_FAILED],
      tournamentId, eventId, competitionState: outcome.competitionState,
      currentBracket: outcome.currentBracket, proposedBracket,
      persisted: true, changed: true, error
    });
  }
  if (!persistedEvent) {
    return buildResult({
      status: BRACKET_MIGRATION_PERSISTENCE_STATUS.VERIFICATION_FAILED,
      reasonCodes: [BRACKET_MIGRATION_PERSISTENCE_CODES.PERSISTED_EVENT_MISSING],
      tournamentId, eventId, competitionState: outcome.competitionState,
      currentBracket: outcome.currentBracket, proposedBracket,
      persisted: true, changed: true
    });
  }

  const persistedBracket = getCurrentBracket(persistedEvent);
  if (!persistedBracket) {
    return buildResult({
      status: BRACKET_MIGRATION_PERSISTENCE_STATUS.VERIFICATION_FAILED,
      reasonCodes: [BRACKET_MIGRATION_PERSISTENCE_CODES.PERSISTED_BRACKET_MISSING],
      tournamentId, eventId, competitionState: normalizeCompetitionState(persistedEvent),
      currentBracket: outcome.currentBracket, proposedBracket,
      persisted: true, changed: true
    });
  }
  if (!areBracketsEqual(persistedBracket, proposedBracket)) {
    return buildResult({
      status: BRACKET_MIGRATION_PERSISTENCE_STATUS.VERIFICATION_FAILED,
      reasonCodes: [BRACKET_MIGRATION_PERSISTENCE_CODES.PERSISTED_BRACKET_MISMATCH],
      tournamentId, eventId, competitionState: normalizeCompetitionState(persistedEvent),
      currentBracket: outcome.currentBracket, proposedBracket, persistedBracket,
      persisted: true, changed: true
    });
  }

  return buildResult({
    status: BRACKET_MIGRATION_PERSISTENCE_STATUS.READY,
    reasonCodes: [],
    tournamentId, eventId, competitionState: normalizeCompetitionState(persistedEvent),
    currentBracket: outcome.currentBracket, proposedBracket, persistedBracket,
    persisted: true, verified: true, changed: true
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
