// ========================================
// ARKHAM — Competition Match Lifecycle
// ========================================
//
// Match Lifecycle v1.
//
// This module is intentionally isolated from Tournament Pro and Competition
// Core. It provides the lifecycle transition contract for Matches without
// changing the legacy persisted MATCH_STATUS model.
//
// Domain responsibility:
//   - validate Match lifecycle transitions
//   - project lifecycle state onto a Match
//   - remain non-mutating
//
// It does NOT:
//   - calculate Match Results
//   - create or complete Games
//   - apply Advancement
//   - manage Stations
//   - mutate Firebase
//
// Legacy compatibility:
//   PENDING is still the persisted Match status used by the existing engine.
//   The lifecycle domain exposes READY/SCHEDULED as derived operational states.
// ========================================

export const MATCH_LIFECYCLE = Object.freeze({
  SCHEDULED: "scheduled",
  READY: "ready",
  CALLED: "called",
  IN_PROGRESS: "in_progress",
  RESULT_PENDING: "result_pending",
  COMPLETED: "completed",
  BYE: "bye"
});

function hasParticipant(match = {}, side) {
  const participant = side === "A"
    ? match?.participantAId
    : match?.participantBId;

  const entry = side === "A"
    ? match?.entryAId
    : match?.entryBId;

  return Boolean(participant || entry);
}

function hasBothParticipants(match = {}) {
  return hasParticipant(match, "A") && hasParticipant(match, "B");
}

function getPersistedStatus(match = {}) {
  return match?.status || null;
}

/**
 * Derives the lifecycle state of the current Match without mutating it.
 *
 * Legacy PENDING remains the persisted status. Its lifecycle meaning is:
 *   - both sides present -> READY
 *   - one or both sides missing -> SCHEDULED
 */
export function getMatchLifecycle(match = {}) {
  if (!match || typeof match !== "object") {
    throw new Error("Match no encontrado.");
  }

  const status = getPersistedStatus(match);

  if (status === "bye") {
    return MATCH_LIFECYCLE.BYE;
  }

  if (status === "completed") {
    return MATCH_LIFECYCLE.COMPLETED;
  }

  if (status === "live") {
    return match.result?.status === "pending"
      ? MATCH_LIFECYCLE.RESULT_PENDING
      : MATCH_LIFECYCLE.IN_PROGRESS;
  }

  // Recovery bridge for brackets written by the first migration attempt.
  // Competition Core generation writes READY/PENDING as uppercase statuses,
  // while Tournament Pro persists lowercase `pending` and derives readiness
  // from participant assignment. Read both uppercase values only as a
  // recovery bridge so the test event can load and be rematerialized safely.
  if (status === "READY" || status === "PENDING") {
    return hasBothParticipants(match)
      ? MATCH_LIFECYCLE.READY
      : MATCH_LIFECYCLE.SCHEDULED;
  }

  if (status === "pending") {
    if (match.calledAt) {
      return MATCH_LIFECYCLE.CALLED;
    }

    return hasBothParticipants(match)
      ? MATCH_LIFECYCLE.READY
      : MATCH_LIFECYCLE.SCHEDULED;
  }

  throw new Error(`Estado de Match no soportado: ${status}.`);
}

export function canStartMatch(match = {}) {
  if (!match || typeof match !== "object" || !match.id) {
    return {
      allowed: false,
      reason: "MATCH_REQUIRED"
    };
  }

  const lifecycle = getMatchLifecycle(match);

  if (
    lifecycle !== MATCH_LIFECYCLE.READY &&
    lifecycle !== MATCH_LIFECYCLE.CALLED
  ) {
    return {
      allowed: false,
      reason: "MATCH_NOT_READY",
      lifecycle
    };
  }

  if (!hasParticipant(match, "A")) {
    return {
      allowed: false,
      reason: "MATCH_PARTICIPANT_A_REQUIRED"
    };
  }

  if (!hasParticipant(match, "B")) {
    return {
      allowed: false,
      reason: "MATCH_PARTICIPANT_B_REQUIRED"
    };
  }

  return {
    allowed: true,
    lifecycle
  };
}

/**
 * READY -> CALLED.
 *
 * CALLED is an operational lifecycle state. The legacy persisted Match
 * status remains PENDING so the existing engine continues to interpret the
 * Match without requiring a new MATCH_STATUS value.
 */
export function canCallMatch(match = {}) {
  if (!match || typeof match !== "object" || !match.id) {
    return {
      allowed: false,
      reason: "MATCH_REQUIRED"
    };
  }

  const lifecycle = getMatchLifecycle(match);

  if (lifecycle !== MATCH_LIFECYCLE.READY) {
    return {
      allowed: false,
      reason: "MATCH_NOT_READY_TO_CALL",
      lifecycle
    };
  }

  if (!hasParticipant(match, "A")) {
    return {
      allowed: false,
      reason: "MATCH_PARTICIPANT_A_REQUIRED"
    };
  }

  if (!hasParticipant(match, "B")) {
    return {
      allowed: false,
      reason: "MATCH_PARTICIPANT_B_REQUIRED"
    };
  }

  return {
    allowed: true,
    lifecycle
  };
}

export function callMatchLifecycle(match = {}) {
  const validation = canCallMatch(match);

  if (!validation.allowed) {
    throw new Error(
      `Cannot call match lifecycle: ${validation.reason}`
    );
  }

  return {
    ...match,
    calledAt: match.calledAt || new Date().toISOString()
  };
}

export function canUncallMatch(match = {}) {
  if (!match || typeof match !== "object" || !match.id) {
    return {
      allowed: false,
      reason: "MATCH_REQUIRED"
    };
  }

  const lifecycle = getMatchLifecycle(match);

  if (lifecycle !== MATCH_LIFECYCLE.CALLED) {
    return {
      allowed: false,
      reason: "MATCH_NOT_CALLED",
      lifecycle
    };
  }

  return {
    allowed: true,
    lifecycle
  };
}

/**
 * CALLED -> READY.
 *
 * This is only valid before the Match starts. The legacy persisted status
 * remains PENDING and the operational marker is cleared.
 */
export function uncallMatchLifecycle(match = {}) {
  const validation = canUncallMatch(match);

  if (!validation.allowed) {
    throw new Error(
      `Cannot uncall match lifecycle: ${validation.reason}`
    );
  }

  const nextMatch = { ...match };
  delete nextMatch.calledAt;

  return nextMatch;
}

export function startMatchLifecycle(match = {}) {
  const validation = canStartMatch(match);

  if (!validation.allowed) {
    throw new Error(
      `Cannot start match lifecycle: ${validation.reason}`
    );
  }

  return {
    ...match,
    status: "live",
    startedAt: match.startedAt || new Date().toISOString()
  };
}

export function canSetMatchResultPending(match = {}) {
  if (!match || typeof match !== "object" || !match.id) {
    return {
      allowed: false,
      reason: "MATCH_REQUIRED"
    };
  }

  const lifecycle = getMatchLifecycle(match);

  if (lifecycle !== MATCH_LIFECYCLE.IN_PROGRESS) {
    return {
      allowed: false,
      reason: "MATCH_NOT_IN_PROGRESS",
      lifecycle
    };
  }

  return {
    allowed: true,
    lifecycle
  };
}

/**
 * IN_PROGRESS -> RESULT_PENDING.
 *
 * This transition does not decide the Match Result. It only records that the
 * Match has reached the point where its result may be finalized.
 */
export function setMatchResultPending(match = {}, { result = null } = {}) {
  const validation = canSetMatchResultPending(match);

  if (!validation.allowed) {
    throw new Error(
      `Cannot set match result pending: ${validation.reason}`
    );
  }

  return {
    ...match,
    status: "live",
    result: {
      ...(match.result && typeof match.result === "object"
        ? match.result
        : {}),
      ...(result && typeof result === "object" ? result : {}),
      status: "pending"
    }
  };
}

export function canCompleteMatch(match = {}, { result = null } = {}) {
  if (!match || typeof match !== "object" || !match.id) {
    return {
      allowed: false,
      reason: "MATCH_REQUIRED"
    };
  }

  const lifecycle = getMatchLifecycle(match);

  if (
    lifecycle !== MATCH_LIFECYCLE.RESULT_PENDING &&
    lifecycle !== MATCH_LIFECYCLE.IN_PROGRESS
  ) {
    return {
      allowed: false,
      reason: "MATCH_NOT_READY_FOR_COMPLETION",
      lifecycle
    };
  }

  if (!result || typeof result !== "object") {
    return {
      allowed: false,
      reason: "MATCH_RESULT_REQUIRED"
    };
  }

  const winnerId = result.winnerId ?? null;
  const winnerEntryId = result.winnerEntryId ?? null;

  if (!winnerId && !winnerEntryId) {
    return {
      allowed: false,
      reason: "MATCH_WINNER_REQUIRED"
    };
  }

  if (result.status && result.status !== "completed") {
    return {
      allowed: false,
      reason: "MATCH_RESULT_NOT_COMPLETED",
      resultStatus: result.status
    };
  }

  return {
    allowed: true,
    lifecycle
  };
}

/**
 * RESULT_PENDING/IN_PROGRESS -> COMPLETED.
 *
 * The supplied result remains the authority for the competitive outcome.
 * Advancement is intentionally outside this domain.
 */
export function completeMatchLifecycle(
  match = {},
  { result = null, now = null } = {}
) {
  const validation = canCompleteMatch(match, { result });

  if (!validation.allowed) {
    throw new Error(
      `Cannot complete match lifecycle: ${validation.reason}`
    );
  }

  const completedAt =
    result?.timestamp ||
    now ||
    new Date().toISOString();

  return {
    ...match,
    status: "completed",
    winnerId: result.winnerId ?? match.winnerId ?? null,
    winnerEntryId: result.winnerEntryId ?? match.winnerEntryId ?? null,
    loserId: result.loserId ?? match.loserId ?? null,
    loserEntryId: result.loserEntryId ?? match.loserEntryId ?? null,
    score: result.score ?? match.score ?? null,
    result: {
      ...result,
      status: "completed",
      matchId: result.matchId ?? match.id,
      timestamp: completedAt
    },
    completedAt
  };
}

export function isMatchScheduled(match = {}) {
  return getMatchLifecycle(match) === MATCH_LIFECYCLE.SCHEDULED;
}

export function isMatchReady(match = {}) {
  return getMatchLifecycle(match) === MATCH_LIFECYCLE.READY;
}

export function isMatchCalled(match = {}) {
  return getMatchLifecycle(match) === MATCH_LIFECYCLE.CALLED;
}

export function isMatchInProgress(match = {}) {
  return getMatchLifecycle(match) === MATCH_LIFECYCLE.IN_PROGRESS;
}

export function isMatchResultPending(match = {}) {
  return getMatchLifecycle(match) === MATCH_LIFECYCLE.RESULT_PENDING;
}

export function isMatchCompleted(match = {}) {
  return getMatchLifecycle(match) === MATCH_LIFECYCLE.COMPLETED;
}

export function isMatchBye(match = {}) {
  return getMatchLifecycle(match) === MATCH_LIFECYCLE.BYE;
}
