import {
  getMatchGameFormat
} from "./competitionGames.js";

export const MATCH_RESULT_STATUS = Object.freeze({
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  INVALID: "invalid"
});

function getGames(match = {}) {
  return Array.isArray(match.games)
    ? match.games
    : [];
}

function normalizeWinnerSide(game = {}) {
  if (game.winner?.side === "A" || game.winner?.side === "B") {
    return game.winner.side;
  }

  if (game.winner === "A" || game.winner === "B") {
    return game.winner;
  }

  return null;
}

function isCompletedGame(game = {}) {
  return game.status === "completed";
}

function countGameWins(games = []) {
  let winsA = 0;
  let winsB = 0;

  games.forEach((game) => {
    if (!isCompletedGame(game)) {
      return;
    }

    const winnerSide = normalizeWinnerSide(game);

    if (winnerSide === "A") {
      winsA += 1;
    }

    if (winnerSide === "B") {
      winsB += 1;
    }
  });

  return {
    A: winsA,
    B: winsB
  };
}

function getCompletedGames(games = []) {
  return games.filter(isCompletedGame);
}

function getPendingGames(games = []) {
  return games.filter(
    (game) => !isCompletedGame(game)
  );
}

export function getMatchGameWins(match = {}) {
  return countGameWins(
    getGames(match)
  );
}

export function getMatchWinsNeeded(match = {}) {
  const format = getMatchGameFormat(match);

  if (!format) {
    return null;
  }

  return format.winsNeeded;
}

export function getMatchResultStatus(match = {}) {
  const format = getMatchGameFormat(match);

  if (!format) {
    return MATCH_RESULT_STATUS.INVALID;
  }

  const games = getGames(match);
  const wins = countGameWins(games);
  const winsNeeded = format.winsNeeded;

  if (
    wins.A >= winsNeeded ||
    wins.B >= winsNeeded
  ) {
    return MATCH_RESULT_STATUS.COMPLETED;
  }

  return MATCH_RESULT_STATUS.IN_PROGRESS;
}

export function getMatchWinnerSide(match = {}) {
  const format = getMatchGameFormat(match);

  if (!format) {
    return null;
  }

  const wins = countGameWins(
    getGames(match)
  );

  if (wins.A >= format.winsNeeded) {
    return "A";
  }

  if (wins.B >= format.winsNeeded) {
    return "B";
  }

  return null;
}

export function getMatchResult(match = {}) {
  const format = getMatchGameFormat(match);

  if (!format) {
    return {
      status: MATCH_RESULT_STATUS.INVALID,
      winnerSide: null,
      score: {
        A: 0,
        B: 0
      },
      winsNeeded: null,
      completedGames: 0,
      pendingGames: 0
    };
  }

  const games = getGames(match);
  const completedGames = getCompletedGames(games);
  const pendingGames = getPendingGames(games);

  const wins = countGameWins(games);

  const winnerSide =
    wins.A >= format.winsNeeded
      ? "A"
      : wins.B >= format.winsNeeded
        ? "B"
        : null;

  const status =
    winnerSide
      ? MATCH_RESULT_STATUS.COMPLETED
      : MATCH_RESULT_STATUS.IN_PROGRESS;

  return {
    matchId: match.id ?? null,

    status,

    winnerSide,

    score: {
      A: wins.A,
      B: wins.B
    },

    winsNeeded: format.winsNeeded,

    completedGames: completedGames.length,

    pendingGames: pendingGames.length,

    games: completedGames.map((game) => ({
      gameId: game.id ?? null,
      number: game.number ?? null,
      winnerSide: normalizeWinnerSide(game),
      score: {
        A: game.score?.A ?? null,
        B: game.score?.B ?? null
      }
    }))
  };
}

export function canCompleteMatch(match = {}) {
  const result = getMatchResult(match);

  if (result.status === MATCH_RESULT_STATUS.INVALID) {
    return {
      allowed: false,
      reason: "MATCH_FORMAT_UNSUPPORTED",
      result
    };
  }

  if (result.status !== MATCH_RESULT_STATUS.COMPLETED) {
    return {
      allowed: false,
      reason: "MATCH_NOT_DECIDED",
      result
    };
  }

  if (!result.winnerSide) {
    return {
      allowed: false,
      reason: "MATCH_WINNER_REQUIRED",
      result
    };
  }

  return {
    allowed: true,
    result
  };
}

export function createMatchResult(match = {}) {
  const validation = canCompleteMatch(match);

  if (!validation.allowed) {
    throw new Error(
      `Cannot create match result: ${validation.reason}`
    );
  }

  const result = validation.result;

  const winnerParticipant =
    result.winnerSide === "A"
      ? match.participants?.A ?? null
      : match.participants?.B ?? null;

  return {
    matchId: result.matchId,

    status: MATCH_RESULT_STATUS.COMPLETED,

    winnerSide: result.winnerSide,

    winnerEntryId:
      winnerParticipant?.entryId ?? null,

    winnerParticipantId:
      winnerParticipant?.participantId ?? null,

    score: {
      A: result.score.A,
      B: result.score.B
    },

    winsNeeded: result.winsNeeded,

    completedGames: result.completedGames,

    games: result.games
  };
}