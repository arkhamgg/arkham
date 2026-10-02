import {
  normalizeCompetitionMatchFormat,
  COMPETITION_CONFIGURATION_STATUS
} from "./competitionConfiguration.js";

export const GAME_STATUS = Object.freeze({
  PENDING: "pending",
  LIVE: "live",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
});

function normalizeGameNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : null;
}

function getExistingGames(match = {}) {
  return Array.isArray(match.games) ? match.games : [];
}

function getMatchParticipant(match = {}, side) {
  const normalizedSide = side === "A" ? "A" : "B";
  const normalizedParticipant = match.participants?.[normalizedSide];

  if (normalizedParticipant) {
    return {
      side: normalizedSide,
      entryId: normalizedParticipant.entryId ?? null,
      participantId: normalizedParticipant.participantId ?? null,
      displayName: normalizedParticipant.displayName ?? null
    };
  }

  if (normalizedSide === "A") {
    return {
      side: "A",
      entryId: match.entryAId ?? null,
      participantId: match.participantAId ?? null,
      displayName: match.participantADisplayName ?? null
    };
  }

  return {
    side: "B",
    entryId: match.entryBId ?? null,
    participantId: match.participantBId ?? null,
    displayName: match.participantBDisplayName ?? null
  };
}

function getMatchParticipants(match = {}) {
  return {
    A: getMatchParticipant(match, "A"),
    B: getMatchParticipant(match, "B")
  };
}

function hasBothMatchParticipants(match = {}) {
  const participants = getMatchParticipants(match);
  return (
    (Boolean(participants.A.entryId) || Boolean(participants.A.participantId)) &&
    (Boolean(participants.B.entryId) || Boolean(participants.B.participantId))
  );
}

function normalizeTimestamp(value) {
  const timestamp = value ? new Date(value) : new Date();
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

export function getMatchGameFormat(match = {}) {
  if (match.matchFormat?.type && match.matchFormat?.value) {
    const value = Number(match.matchFormat.value);

    if (
      match.matchFormat.type === "BEST_OF" &&
      Number.isInteger(value) &&
      value > 0
    ) {
      return {
        type: "BEST_OF",
        value,
        winsNeeded: Math.ceil(value / 2),
        status: COMPETITION_CONFIGURATION_STATUS.SUPPORTED,
        source: "match.matchFormat"
      };
    }
  }

  const normalizedMatchFormat = normalizeCompetitionMatchFormat(
    match.matchSystem
  );

  if (
    normalizedMatchFormat.status !==
    COMPETITION_CONFIGURATION_STATUS.SUPPORTED
  ) {
    return null;
  }

  return {
    type: normalizedMatchFormat.type,
    value: normalizedMatchFormat.value,
    winsNeeded: normalizedMatchFormat.winsNeeded,
    status: normalizedMatchFormat.status,
    source: normalizedMatchFormat.source
  };
}

export function getMatchMaximumGames(match = {}) {
  const format = getMatchGameFormat(match);
  return format?.type === "BEST_OF" ? format.value : null;
}

export function getNextGameNumber(match = {}) {
  const games = getExistingGames(match);
  if (games.length === 0) return 1;

  const gameNumbers = games
    .map((game) => normalizeGameNumber(game?.number))
    .filter(Boolean);

  return gameNumbers.length > 0 ? Math.max(...gameNumbers) + 1 : 1;
}

export function canCreateMatchGame(match = {}, gameNumber = null) {
  if (!match || !match.id) {
    return { allowed: false, reason: "MATCH_REQUIRED" };
  }

  if (!hasBothMatchParticipants(match)) {
    return { allowed: false, reason: "MATCH_PARTICIPANTS_REQUIRED" };
  }

  const format = getMatchGameFormat(match);

  if (!format) {
    return { allowed: false, reason: "MATCH_FORMAT_UNSUPPORTED" };
  }

  const normalizedGameNumber =
    gameNumber === null
      ? getNextGameNumber(match)
      : normalizeGameNumber(gameNumber);

  if (!normalizedGameNumber) {
    return { allowed: false, reason: "INVALID_GAME_NUMBER" };
  }

  if (normalizedGameNumber > format.value) {
    return {
      allowed: false,
      reason: "GAME_LIMIT_REACHED",
      maximumGames: format.value
    };
  }

  const alreadyExists = getExistingGames(match).some(
    (game) => normalizeGameNumber(game?.number) === normalizedGameNumber
  );

  if (alreadyExists) {
    return {
      allowed: false,
      reason: "GAME_ALREADY_EXISTS",
      gameNumber: normalizedGameNumber
    };
  }

  return {
    allowed: true,
    gameNumber: normalizedGameNumber,
    maximumGames: format.value,
    format
  };
}

export function createMatchGame(
  match = {},
  {
    gameNumber = null,
    now = new Date().toISOString()
  } = {}
) {
  const validation = canCreateMatchGame(match, gameNumber);

  if (!validation.allowed) {
    throw new Error(`Cannot create match game: ${validation.reason}`);
  }

  const createdAt = normalizeTimestamp(now);

  if (!createdAt) {
    throw new Error("Cannot create match game: INVALID_TIMESTAMP");
  }

  const participants = getMatchParticipants(match);
  const number = validation.gameNumber;

  return {
    id: `${match.id}-G${number}`,
    matchId: match.id,
    number,
    status: GAME_STATUS.PENDING,
    participants: {
      A: {
        side: "A",
        entryId: participants.A.entryId,
        participantId: participants.A.participantId,
        displayName: participants.A.displayName
      },
      B: {
        side: "B",
        entryId: participants.B.entryId,
        participantId: participants.B.participantId,
        displayName: participants.B.displayName
      }
    },
    winner: null,
    score: null,
    map: null,
    mode: null,
    metadata: null,
    startedAt: null,
    completedAt: null,
    createdAt
  };
}

export function appendMatchGame(
  match = {},
  {
    gameNumber = null,
    now = new Date().toISOString()
  } = {}
) {
  const game = createMatchGame(match, { gameNumber, now });
  return {
    match: {
      ...match,
      games: [...getExistingGames(match), game]
    },
    game
  };
}

export function createNextMatchGame(
  match = {},
  { now = new Date().toISOString() } = {}
) {
  return appendMatchGame(match, {
    gameNumber: getNextGameNumber(match),
    now
  });
}

export function createFirstMatchGame(
  match = {},
  { now = new Date().toISOString() } = {}
) {
  if (getExistingGames(match).length > 0) {
    throw new Error("Cannot create first match game: GAMES_ALREADY_EXIST");
  }

  return appendMatchGame(match, { gameNumber: 1, now });
}

/**
 * Game lifecycle: PENDING -> LIVE.
 * Returns a new Game and never mutates the input.
 */
export function canStartMatchGame(game = {}) {
  if (!game?.id) return { allowed: false, reason: "GAME_REQUIRED" };
  if (!game.matchId) return { allowed: false, reason: "MATCH_ID_REQUIRED" };
  if (game.status !== GAME_STATUS.PENDING) {
    return { allowed: false, reason: "GAME_NOT_PENDING" };
  }

  if (!game.participants?.A?.entryId && !game.participants?.A?.participantId) {
    return { allowed: false, reason: "GAME_PARTICIPANT_A_REQUIRED" };
  }

  if (!game.participants?.B?.entryId && !game.participants?.B?.participantId) {
    return { allowed: false, reason: "GAME_PARTICIPANT_B_REQUIRED" };
  }

  return { allowed: true };
}

export function startMatchGame(
  game = {},
  { now = new Date().toISOString() } = {}
) {
  const validation = canStartMatchGame(game);

  if (!validation.allowed) {
    throw new Error(`Cannot start match game: ${validation.reason}`);
  }

  const startedAt = normalizeTimestamp(now);

  if (!startedAt) {
    throw new Error("Cannot start match game: INVALID_TIMESTAMP");
  }

  return {
    ...game,
    status: GAME_STATUS.LIVE,
    startedAt
  };
}

/**
 * Game lifecycle: PENDING/LIVE -> CANCELLED.
 */
export function canCancelMatchGame(game = {}) {
  if (!game?.id) return { allowed: false, reason: "GAME_REQUIRED" };

  if (
    game.status !== GAME_STATUS.PENDING &&
    game.status !== GAME_STATUS.LIVE
  ) {
    return { allowed: false, reason: "GAME_NOT_CANCELLABLE" };
  }

  return { allowed: true };
}

export function cancelMatchGame(
  game = {},
  { now = new Date().toISOString() } = {}
) {
  const validation = canCancelMatchGame(game);

  if (!validation.allowed) {
    throw new Error(`Cannot cancel match game: ${validation.reason}`);
  }

  const cancelledAt = normalizeTimestamp(now);

  if (!cancelledAt) {
    throw new Error("Cannot cancel match game: INVALID_TIMESTAMP");
  }

  return {
    ...game,
    status: GAME_STATUS.CANCELLED,
    completedAt: null,
    cancelledAt
  };
}

/**
 * Game Result remains responsible for deciding winner/score.
 * This lifecycle boundary only accepts an already completed result.
 */
export function canCompleteMatchGame(game = {}, { result = null } = {}) {
  if (!game?.id) return { allowed: false, reason: "GAME_REQUIRED" };

  if (game.status !== GAME_STATUS.LIVE) {
    return { allowed: false, reason: "GAME_NOT_LIVE" };
  }

  if (
    result?.status !== "completed" ||
    result?.gameId !== game.id
  ) {
    return {
      allowed: false,
      reason: "COMPLETED_GAME_RESULT_REQUIRED"
    };
  }

  return { allowed: true };
}

export function completeMatchGame(
  game = {},
  {
    result = null,
    now = new Date().toISOString()
  } = {}
) {
  const validation = canCompleteMatchGame(game, { result });

  if (!validation.allowed) {
    throw new Error(`Cannot complete match game: ${validation.reason}`);
  }

  const completedAt = normalizeTimestamp(result.timestamp || now);

  if (!completedAt) {
    throw new Error("Cannot complete match game: INVALID_TIMESTAMP");
  }

  return {
    ...game,
    status: GAME_STATUS.COMPLETED,
    winner: result.winner ?? game.winner ?? null,
    score: result.score ?? game.score ?? null,
    completedAt
  };
}

export function isGamePending(game = {}) {
  return game.status === GAME_STATUS.PENDING;
}

export function isGameLive(game = {}) {
  return game.status === GAME_STATUS.LIVE;
}

export function isGameCompleted(game = {}) {
  return game.status === GAME_STATUS.COMPLETED;
}

export function isGameCancelled(game = {}) {
  return game.status === GAME_STATUS.CANCELLED;
}
