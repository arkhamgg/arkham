export const GAME_RESULT_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
});

export const GAME_RESULT_REASONS = Object.freeze({
  NORMAL: "normal",
  FORFEIT: "forfeit",
  DISCONNECT: "disconnect",
  DQ: "dq",
  ADMIN: "admin"
});

function normalizeScore(value) {
  const score = Number(value);

  if (!Number.isFinite(score) || score < 0) {
    return null;
  }

  return score;
}

function normalizeSide(value) {
  if (value === "A" || value === "B") {
    return value;
  }

  return null;
}

function getGameParticipant(game = {}, side) {
  const normalizedSide = normalizeSide(side);

  if (!normalizedSide) {
    return null;
  }

  const participant = game.participants?.[normalizedSide];

  if (!participant) {
    return null;
  }

  return {
    side: normalizedSide,
    entryId: participant.entryId ?? null,
    participantId: participant.participantId ?? null,
    displayName: participant.displayName ?? null
  };
}

function hasGameParticipant(game = {}, side) {
  const participant = getGameParticipant(game, side);

  if (!participant) {
    return false;
  }

  return Boolean(
    participant.entryId || participant.participantId
  );
}

function getGameWinner(game = {}, winnerSide) {
  const participant = getGameParticipant(game, winnerSide);

  if (!participant) {
    return null;
  }

  return participant;
}

export function getGameResultScore(game = {}) {
  return {
    A: normalizeScore(game.score?.A),
    B: normalizeScore(game.score?.B)
  };
}

export function getGameWinnerSide(game = {}) {
  const winnerSide = normalizeSide(game.winner?.side);

  if (winnerSide) {
    return winnerSide;
  }

  if (
    game.winner === "A" ||
    game.winner === "B"
  ) {
    return game.winner;
  }

  return null;
}

export function canCompleteGame(
  game = {},
  {
    winnerSide = null,
    scoreA = null,
    scoreB = null
  } = {}
) {
  if (!game || !game.id) {
    return {
      allowed: false,
      reason: "GAME_REQUIRED"
    };
  }

  if (!game.matchId) {
    return {
      allowed: false,
      reason: "MATCH_ID_REQUIRED"
    };
  }

  if (!hasGameParticipant(game, "A")) {
    return {
      allowed: false,
      reason: "GAME_PARTICIPANT_A_REQUIRED"
    };
  }

  if (!hasGameParticipant(game, "B")) {
    return {
      allowed: false,
      reason: "GAME_PARTICIPANT_B_REQUIRED"
    };
  }

  if (game.status === "completed") {
    return {
      allowed: false,
      reason: "GAME_ALREADY_COMPLETED"
    };
  }

  const normalizedWinnerSide = normalizeSide(winnerSide);

  if (!normalizedWinnerSide) {
    return {
      allowed: false,
      reason: "WINNER_REQUIRED"
    };
  }

  const normalizedScoreA = normalizeScore(scoreA);
  const normalizedScoreB = normalizeScore(scoreB);

  if (
    normalizedScoreA === null ||
    normalizedScoreB === null
  ) {
    return {
      allowed: false,
      reason: "VALID_SCORE_REQUIRED"
    };
  }

  if (normalizedScoreA === normalizedScoreB) {
    return {
      allowed: false,
      reason: "DRAW_NOT_ALLOWED"
    };
  }

  const expectedWinnerSide =
    normalizedScoreA > normalizedScoreB
      ? "A"
      : "B";

  if (normalizedWinnerSide !== expectedWinnerSide) {
    return {
      allowed: false,
      reason: "WINNER_SCORE_MISMATCH",
      expectedWinnerSide
    };
  }

  return {
    allowed: true,
    winnerSide: normalizedWinnerSide,
    score: {
      A: normalizedScoreA,
      B: normalizedScoreB
    }
  };
}

export function createGameResult(
  game = {},
  {
    winnerSide = null,
    scoreA = null,
    scoreB = null,
    reason = GAME_RESULT_REASONS.NORMAL,
    reportedBy = null,
    confirmedBy = null,
    timestamp = new Date().toISOString()
  } = {}
) {
  const validation = canCompleteGame(game, {
    winnerSide,
    scoreA,
    scoreB
  });

  if (!validation.allowed) {
    throw new Error(
      `Cannot create game result: ${validation.reason}`
    );
  }

  const winner = getGameWinner(
    game,
    validation.winnerSide
  );

  return {
    gameId: game.id,
    matchId: game.matchId,

    status: GAME_RESULT_STATUS.COMPLETED,

    winner,

    score: {
      A: validation.score.A,
      B: validation.score.B
    },

    reason:
      Object.values(GAME_RESULT_REASONS).includes(reason)
        ? reason
        : GAME_RESULT_REASONS.NORMAL,

    reportedBy,
    confirmedBy,
    timestamp
  };
}

export function applyGameResult(
  game = {},
  {
    winnerSide = null,
    scoreA = null,
    scoreB = null,
    reason = GAME_RESULT_REASONS.NORMAL,
    reportedBy = null,
    confirmedBy = null,
    timestamp = new Date().toISOString()
  } = {}
) {
  const result = createGameResult(game, {
    winnerSide,
    scoreA,
    scoreB,
    reason,
    reportedBy,
    confirmedBy,
    timestamp
  });

  return {
    game: {
      ...game,

      // El dominio de Game Result registra el resultado,
      // pero no es dueño del lifecycle del Game.
      // competitionGames.js es quien proyecta LIVE -> COMPLETED
      // mediante completeMatchGame().
      status: game.status,

      winner: result.winner,

      score: {
        A: result.score.A,
        B: result.score.B
      },

      completedAt: result.timestamp
    },

    result
  };
}

export function isGameCompleted(game = {}) {
  return game.status === GAME_RESULT_STATUS.COMPLETED;
}

export function getCompletedGameWinner(game = {}) {
  if (!isGameCompleted(game)) {
    return null;
  }

  return getGameWinnerSide(game);
}
