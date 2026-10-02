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

  if (!Number.isInteger(number) || number < 1) {
    return null;
  }

  return number;
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

  const hasA =
    Boolean(participants.A.entryId) ||
    Boolean(participants.A.participantId);

  const hasB =
    Boolean(participants.B.entryId) ||
    Boolean(participants.B.participantId);

  return hasA && hasB;
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

  if (!format) {
    return null;
  }

  if (format.type !== "BEST_OF") {
    return null;
  }

  return format.value;
}

export function getNextGameNumber(match = {}) {
  const games = getExistingGames(match);

  if (games.length === 0) {
    return 1;
  }

  const gameNumbers = games
    .map((game) => normalizeGameNumber(game?.number))
    .filter(Boolean);

  if (gameNumbers.length === 0) {
    return 1;
  }

  return Math.max(...gameNumbers) + 1;
}

export function canCreateMatchGame(match = {}, gameNumber = null) {
  if (!match || !match.id) {
    return {
      allowed: false,
      reason: "MATCH_REQUIRED"
    };
  }

  if (!hasBothMatchParticipants(match)) {
    return {
      allowed: false,
      reason: "MATCH_PARTICIPANTS_REQUIRED"
    };
  }

  const format = getMatchGameFormat(match);

  if (!format) {
    return {
      allowed: false,
      reason: "MATCH_FORMAT_UNSUPPORTED"
    };
  }

  const normalizedGameNumber =
    gameNumber === null
      ? getNextGameNumber(match)
      : normalizeGameNumber(gameNumber);

  if (!normalizedGameNumber) {
    return {
      allowed: false,
      reason: "INVALID_GAME_NUMBER"
    };
  }

  if (normalizedGameNumber > format.value) {
    return {
      allowed: false,
      reason: "GAME_LIMIT_REACHED",
      maximumGames: format.value
    };
  }

  const games = getExistingGames(match);

  const alreadyExists = games.some(
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
    throw new Error(
      `Cannot create match game: ${validation.reason}`
    );
  }

  const number = validation.gameNumber;
  const participants = getMatchParticipants(match);

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

    createdAt: now
  };
}

export function appendMatchGame(
  match = {},
  {
    gameNumber = null,
    now = new Date().toISOString()
  } = {}
) {
  const game = createMatchGame(match, {
    gameNumber,
    now
  });

  const existingGames = getExistingGames(match);

  return {
    match: {
      ...match,
      games: [...existingGames, game]
    },
    game
  };
}

export function createNextMatchGame(
  match = {},
  {
    now = new Date().toISOString()
  } = {}
) {
  return appendMatchGame(match, {
    gameNumber: getNextGameNumber(match),
    now
  });
}

export function createFirstMatchGame(
  match = {},
  {
    now = new Date().toISOString()
  } = {}
) {
  const existingGames = getExistingGames(match);

  if (existingGames.length > 0) {
    throw new Error("Cannot create first match game: GAMES_ALREADY_EXIST");
  }

  return appendMatchGame(match, {
    gameNumber: 1,
    now
  });
}