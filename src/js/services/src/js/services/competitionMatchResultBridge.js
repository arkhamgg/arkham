import {
  getMatchResult,
  canCompleteMatch
} from "./competitionMatchResults.js";

function getMatchSideParticipant(match = {}, side) {
  if (side === "A") {
    return {
      entryId: match.entryAId ?? null,
      participantId: match.participantAId ?? null
    };
  }

  if (side === "B") {
    return {
      entryId: match.entryBId ?? null,
      participantId: match.participantBId ?? null
    };
  }

  return {
    entryId: null,
    participantId: null
  };
}

function getWinnerParticipant(match = {}, winnerSide) {
  return getMatchSideParticipant(match, winnerSide);
}

function getLoserParticipant(match = {}, winnerSide) {
  if (winnerSide === "A") {
    return getMatchSideParticipant(match, "B");
  }

  if (winnerSide === "B") {
    return getMatchSideParticipant(match, "A");
  }

  return {
    entryId: null,
    participantId: null
  };
}

function hasParticipantIdentity(participant = {}) {
  return Boolean(
    participant.entryId ||
    participant.participantId
  );
}

export function canBridgeMatchResult(match = {}) {
  if (!match?.id) {
    return {
      allowed: false,
      reason: "MATCH_REQUIRED"
    };
  }

  const resultValidation = canCompleteMatch(match);

  if (!resultValidation.allowed) {
    return {
      allowed: false,
      reason: resultValidation.reason,
      result: resultValidation.result
    };
  }

  const result = resultValidation.result;

  const winner = getWinnerParticipant(
    match,
    result.winnerSide
  );

  const loser = getLoserParticipant(
    match,
    result.winnerSide
  );

  if (!hasParticipantIdentity(winner)) {
    return {
      allowed: false,
      reason: "WINNER_IDENTITY_REQUIRED",
      result
    };
  }

  if (!hasParticipantIdentity(loser)) {
    return {
      allowed: false,
      reason: "LOSER_IDENTITY_REQUIRED",
      result
    };
  }

  return {
    allowed: true,
    result,
    winner,
    loser
  };
}

export function createLegacyMatchResultCommand(match = {}) {
  const validation = canBridgeMatchResult(match);

  if (!validation.allowed) {
    throw new Error(
      `Cannot bridge match result: ${validation.reason}`
    );
  }

  const {
    result,
    winner,
    loser
  } = validation;

  return {
    matchId: match.id,

    winnerId: winner.participantId,
    winnerEntryId: winner.entryId,

    loserId: loser.participantId,
    loserEntryId: loser.entryId,

    score: {
      A: result.score.A,
      B: result.score.B
    },

    source: {
      type: "GAME_RESULTS",
      status: result.status,
      winsNeeded: result.winsNeeded,
      completedGames: result.completedGames
    }
  };
}

export function getMatchResultBridgePreview(match = {}) {
  const result = getMatchResult(match);

  if (result.status === "invalid") {
    return {
      status: "invalid",
      matchId: match.id ?? null,
      result,
      command: null
    };
  }

  if (result.status !== "completed") {
    return {
      status: "in_progress",
      matchId: match.id ?? null,
      result,
      command: null
    };
  }

  return {
    status: "ready",
    matchId: match.id ?? null,
    result,
    command: createLegacyMatchResultCommand(match)
  };
}