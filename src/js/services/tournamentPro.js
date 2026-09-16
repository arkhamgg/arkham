// ========================================
// NEXUS — Tournament Pro Domain
// ========================================

export const TOURNAMENT_EVENT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  CHECK_IN: "check_in",
  LIVE: "live",
  FINISHED: "finished",
  ARCHIVED: "archived"
};

export const PARTICIPANT_STATUS = {
  REQUESTED: "requested",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CHECKED_IN: "checked_in",
  COMPETING: "competing",
  ADVANCED: "advanced",
  ELIMINATED: "eliminated",
  NO_SHOW: "no_show",
  WITHDRAWN: "withdrawn",
  FINISHED: "finished"
};

export const MATCH_STATUS = {
  PENDING: "pending",
  LIVE: "live",
  COMPLETED: "completed",
  BYE: "bye"
};

export const BRACKET_TYPES = {
  SINGLE_ELIMINATION: "single_elimination",
  DOUBLE_ELIMINATION: "double_elimination"
};

export const RECOGNITION_STATUS = {
  NOT_REQUESTED: "not_requested",
  REQUESTED: "requested",
  APPROVED: "approved",
  REJECTED: "rejected"
};

export function createTournamentProState({
  participationType = null,
  capacity = null,
  format = null,
  matchSystem = null
} = {}) {
  return {
    version: 3,
    participationType,
    capacity,
    format,
    matchSystem,
    status: TOURNAMENT_EVENT_STATUS.DRAFT,
    registration: {
      status: "closed",
      deadline: null,
      requirements: [],
      requests: {}
    },
    participants: {},
    bracket: createEmptyBracket(format),
    checkIn: {
      status: "unopened",
      opened: false,
      completed: false,
      openedAt: null,
      completedAt: null
    },
    matches: {},
    results: {
      standings: [],
      winnerIds: [],
      completedAt: null
    },
    recognition: {
      enabled: false,
      requests: {}
    }
  };
}

export function createEmptyBracket(format = null) {
  return {
    generated: false,
    version: 3,
    type: normalizeBracketType(format),
    generatedAt: null,
    completedAt: null,
    stages: [],
    slots: {},
    championId: null
  };
}

export function ensureTournamentProState(event = {}) {
  const current = event.pro || {};
  const base = createTournamentProState({
    participationType: event.participationType || null,
    capacity: event.capacity || null,
    format: event.format || null,
    matchSystem: event.matchSystem || null
  });

  const legacyCheckIn = current.checkIn || {};
  const checkInStatus = legacyCheckIn.status || (
    legacyCheckIn.completed ? "completed" : legacyCheckIn.opened ? "open" : "unopened"
  );

  return {
    ...base,
    ...current,
    version: Math.max(Number(current.version) || 0, 3),
    registration: {
      ...base.registration,
      ...(current.registration || {}),
      requirements: Array.isArray(current.registration?.requirements)
        ? current.registration.requirements
        : []
    },
    participants: isObject(current.participants) ? current.participants : {},
    bracket: normalizeBracket(current.bracket, event.format),
    checkIn: {
      ...base.checkIn,
      ...legacyCheckIn,
      status: checkInStatus,
      opened: checkInStatus === "open" || checkInStatus === "completed" || Boolean(legacyCheckIn.opened),
      completed: checkInStatus === "completed" || Boolean(legacyCheckIn.completed)
    },
    matches: isObject(current.matches) ? current.matches : {},
    results: {
      ...base.results,
      ...(current.results || {}),
      standings: Array.isArray(current.results?.standings)
        ? current.results.standings
        : [],
      winnerIds: Array.isArray(current.results?.winnerIds)
        ? current.results.winnerIds
        : []
    },
    recognition: {
      ...base.recognition,
      ...(current.recognition || {}),
      requests: isObject(current.recognition?.requests)
        ? current.recognition.requests
        : {}
    }
  };
}

export function createParticipant({
  participantId,
  entityType,
  entityId = null,
  displayName,
  manual = false
} = {}) {
  const now = new Date().toISOString();
  return {
    id: participantId,
    entityType,
    entityId,
    displayName: displayName || "Participante",
    manual,
    status: PARTICIPANT_STATUS.PENDING,
    checkIn: false,
    slotIds: [],
    seed: null,
    createdAt: now,
    updatedAt: now
  };
}

export function generateBracket(participants = [], capacity = null, format = null) {
  const type = normalizeBracketType(format);
  if (type === BRACKET_TYPES.DOUBLE_ELIMINATION) {
    return generateDoubleEliminationBracket(participants, capacity);
  }
  return generateSingleEliminationBracket(participants, capacity);
}

export function generateSingleEliminationBracket(participants = [], capacity = null) {
  const normalized = normalizeParticipants(participants);
  const targetSize = normalizeCapacity(capacity, normalized.length);
  const bracketSize = nextPowerOfTwo(Math.max(2, Math.min(targetSize, 128)));
  const seeded = normalized.slice(0, bracketSize);
  const slots = {};

  for (let index = 0; index < bracketSize; index += 1) {
    const seed = index + 1;
    const participant = seeded[index] || null;
    slots[`seed-${seed}`] = {
      seed,
      participantId: participant?.id || null
    };
    if (participant) participant.seed = seed;
  }

  const rounds = [];
  let roundSize = bracketSize;
  let roundNumber = 1;
  let matchSequence = 1;

  while (roundSize >= 2) {
    const matches = [];
    const matchCount = roundSize / 2;

    for (let index = 0; index < matchCount; index += 1) {
      const a = roundNumber === 1 ? seeded[index * 2] || null : null;
      const b = roundNumber === 1 ? seeded[index * 2 + 1] || null : null;
      const id = `W-R${roundNumber}-M${matchSequence++}`;
      const status = a && b
        ? MATCH_STATUS.PENDING
        : a || b
          ? MATCH_STATUS.BYE
          : MATCH_STATUS.PENDING;

      matches.push(createMatch({
        id,
        bracket: "winners",
        round: roundNumber,
        position: index + 1,
        status,
        participantAId: a?.id || null,
        participantBId: b?.id || null,
        winnerId: a && !b ? a.id : null
      }));
    }

    rounds.push({
      id: `winners-round-${roundNumber}`,
      bracket: "winners",
      number: roundNumber,
      matches
    });

    roundSize /= 2;
    roundNumber += 1;
  }

  linkRoundProgression(rounds);
  applyAutomaticByes(rounds);

  return {
    generated: true,
    version: 3,
    type: BRACKET_TYPES.SINGLE_ELIMINATION,
    generatedAt: new Date().toISOString(),
    completedAt: null,
    stages: rounds,
    slots,
    championId: null
  };
}

export function generateDoubleEliminationBracket(participants = [], capacity = null) {
  const winners = generateSingleEliminationBracket(participants, capacity);
  const winnersRounds = winners.stages.map((stage) => ({
    ...stage,
    bracket: "winners"
  }));
  const bracketSize = Object.keys(winners.slots).length;
  const winnersRoundCount = winnersRounds.length;
  const losersRoundsCount = Math.max(1, (winnersRoundCount * 2) - 2);
  const losersRounds = [];
  let sequence = 1;

  for (let round = 1; round <= losersRoundsCount; round += 1) {
    const stageIndex = Math.ceil(round / 2);
    const matchCount = Math.max(1, Math.floor(bracketSize / Math.pow(2, stageIndex + (round % 2 === 0 ? 1 : 2))));
    const matches = [];

    for (let position = 1; position <= matchCount; position += 1) {
      matches.push(createMatch({
        id: `L-R${round}-M${sequence++}`,
        bracket: "losers",
        round,
        position,
        status: MATCH_STATUS.PENDING
      }));
    }

    losersRounds.push({
      id: `losers-round-${round}`,
      bracket: "losers",
      number: round,
      matches
    });
  }

  linkRoundProgression(losersRounds);
  linkDoubleEliminationLoserRoutes(winnersRounds, losersRounds);

  const finalStage = {
    id: "grand-final",
    bracket: "grand_final",
    number: 1,
    matches: [createMatch({
      id: "GF-M1",
      bracket: "grand_final",
      round: 1,
      position: 1,
      status: MATCH_STATUS.PENDING
    })]
  };

  const lastWinnersMatch = winnersRounds[winnersRounds.length - 1]?.matches?.[0];
  const lastLosersMatch = losersRounds[losersRounds.length - 1]?.matches?.[0];
  if (lastWinnersMatch) {
    lastWinnersMatch.nextMatchId = finalStage.matches[0].id;
    lastWinnersMatch.nextSlot = "A";
  }
  if (lastLosersMatch) {
    lastLosersMatch.nextMatchId = finalStage.matches[0].id;
    lastLosersMatch.nextSlot = "B";
  }

  return {
    generated: true,
    version: 3,
    type: BRACKET_TYPES.DOUBLE_ELIMINATION,
    generatedAt: new Date().toISOString(),
    completedAt: null,
    stages: [
      ...winnersRounds,
      ...losersRounds,
      finalStage
    ],
    slots: winners.slots,
    championId: null
  };
}

export function startMatch(bracket, matchId, now = new Date().toISOString()) {
  const nextBracket = clone(bracket);
  const match = findMatch(nextBracket, matchId);
  if (!match) throw new Error("Match no encontrado.");
  if (match.status === MATCH_STATUS.COMPLETED) throw new Error("El match ya fue completado.");
  if (match.status === MATCH_STATUS.BYE) throw new Error("Un BYE no puede iniciarse como match.");
  if (!match.participantAId || !match.participantBId) {
    throw new Error("El match todavía no tiene dos participantes.");
  }

  match.status = MATCH_STATUS.LIVE;
  match.startedAt = match.startedAt || now;
  return nextBracket;
}

export function applyMatchResult(bracket, matchId, winnerId, score = null, now = new Date().toISOString()) {
  const nextBracket = clone(bracket);
  const match = findMatch(nextBracket, matchId);
  if (!match) throw new Error("Match no encontrado.");
  if (match.status === MATCH_STATUS.COMPLETED) throw new Error("El match ya fue completado.");
  if (match.status !== MATCH_STATUS.LIVE) throw new Error("El match debe estar en vivo antes de registrar el resultado.");
  if (![match.participantAId, match.participantBId].includes(winnerId)) {
    throw new Error("El ganador no pertenece al match.");
  }

  match.winnerId = winnerId;
  match.loserId = match.participantAId === winnerId
    ? match.participantBId
    : match.participantAId;
  match.score = normalizeScore(score);
  match.status = MATCH_STATUS.COMPLETED;
  match.completedAt = now;

  routeWinner(nextBracket, match);

  if (nextBracket.type === BRACKET_TYPES.DOUBLE_ELIMINATION && match.bracket === "winners" && match.loserId) {
    routeLoser(nextBracket, match);
  }

  const final = findMatch(nextBracket, "GF-M1");
  if (final && final.status !== MATCH_STATUS.COMPLETED && final.participantAId && final.participantBId) {
    final.status = MATCH_STATUS.PENDING;
  }

  if (match.bracket === "grand_final") {
    nextBracket.championId = winnerId;
    nextBracket.completedAt = now;
  } else if (nextBracket.type === BRACKET_TYPES.SINGLE_ELIMINATION && !hasOpenMatches(nextBracket)) {
    nextBracket.championId = winnerId;
    nextBracket.completedAt = now;
  }

  return nextBracket;
}

function createMatch({
  id,
  bracket,
  round,
  position,
  status = MATCH_STATUS.PENDING,
  participantAId = null,
  participantBId = null,
  winnerId = null
}) {
  return {
    id,
    bracket,
    round,
    position,
    status,
    participantAId,
    participantBId,
    winnerId,
    loserId: null,
    score: null,
    nextMatchId: null,
    nextSlot: null,
    startedAt: null,
    completedAt: null
  };
}

function linkDoubleEliminationLoserRoutes(winnersRounds, losersRounds) {
  winnersRounds.forEach((round, index) => {
    const loserRound = losersRounds[Math.min(index * 2, losersRounds.length - 1)];
    if (!loserRound) return;
    round.matches.forEach((match, matchIndex) => {
      const target = loserRound.matches[Math.floor(matchIndex / 2)] || loserRound.matches[0];
      if (target) match.loserRoute = {
        matchId: target.id,
        slot: index === 0 ? (matchIndex % 2 === 0 ? "A" : "B") : "B"
      };
    });
  });
}

function routeLoser(bracket, match) {
  const route = match.loserRoute;
  if (!route) return;
  const target = findMatch(bracket, route.matchId);
  if (!target || target.status === MATCH_STATUS.COMPLETED) return;

  if (route.slot === "A") target.participantAId = match.loserId;
  else target.participantBId = match.loserId;
  refreshPendingStatus(target);
}

function routeWinner(bracket, match) {
  if (!match.nextMatchId || !match.winnerId) return;
  const next = findMatch(bracket, match.nextMatchId);
  if (!next || next.status === MATCH_STATUS.COMPLETED) return;

  if (match.nextSlot === "A") next.participantAId = match.winnerId;
  else if (match.nextSlot === "B") next.participantBId = match.winnerId;
  else if (!next.participantAId) next.participantAId = match.winnerId;
  else if (!next.participantBId) next.participantBId = match.winnerId;
  refreshPendingStatus(next);
}

function refreshPendingStatus(match) {
  if (match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.LIVE) return;

  // Tener un solo participante no significa BYE por sí mismo.
  // En rondas futuras, el segundo participante puede llegar desde un
  // match predecesor todavía pendiente. Los BYE se resuelven únicamente
  // cuando la estructura del bracket confirma que el otro lado no llegará.
  match.status = match.participantAId && match.participantBId
    ? MATCH_STATUS.PENDING
    : MATCH_STATUS.PENDING;
}

function linkRoundProgression(rounds) {
  for (let index = 0; index < rounds.length - 1; index += 1) {
    const current = rounds[index];
    const next = rounds[index + 1];
    current.matches.forEach((match, matchIndex) => {
      const nextMatch = next.matches[Math.floor(matchIndex / 2)];
      if (nextMatch) {
        match.nextMatchId = nextMatch.id;
        match.nextSlot = matchIndex % 2 === 0 ? "A" : "B";
      }
    });
  }
}

function applyAutomaticByes(rounds) {
  if (!rounds[0]) return;

  let changed = true;
  while (changed) {
    changed = false;
    rounds.forEach((round) => {
      round.matches.forEach((match) => {
        if (match.status !== MATCH_STATUS.BYE || !match.winnerId || !match.nextMatchId) return;
        const next = findMatch({ stages: rounds }, match.nextMatchId);
        if (!next) return;

        const beforeA = next.participantAId;
        const beforeB = next.participantBId;
        routeWinner({ stages: rounds }, match);
        if (beforeA !== next.participantAId || beforeB !== next.participantBId) changed = true;
      });
    });
  }
}

function normalizeBracket(bracket, format) {
  if (!isObject(bracket)) return createEmptyBracket(format);
  return {
    ...createEmptyBracket(format),
    ...bracket,
    version: Math.max(Number(bracket.version) || 0, 3),
    type: bracket.type || normalizeBracketType(format),
    stages: Array.isArray(bracket.stages) ? bracket.stages : [],
    slots: isObject(bracket.slots) ? bracket.slots : {}
  };
}

function normalizeBracketType(format) {
  const value = String(format || "").toLowerCase();
  if (value.includes("double") || value.includes("doble")) return BRACKET_TYPES.DOUBLE_ELIMINATION;
  return BRACKET_TYPES.SINGLE_ELIMINATION;
}

function normalizeParticipants(participants) {
  return (Array.isArray(participants) ? participants : [])
    .filter(Boolean)
    .map((participant) => ({ ...participant }));
}

function normalizeCapacity(capacity, fallback) {
  const value = Number(capacity);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : Math.max(2, fallback);
}

function normalizeScore(score) {
  if (score == null) return null;
  if (typeof score === "object") return clone(score);
  return String(score);
}

function findMatch(bracket, matchId) {
  return (bracket.stages || [])
    .flatMap((stage) => stage.matches || [])
    .find((match) => match.id === matchId) || null;
}

function hasOpenMatches(bracket) {
  return (bracket.stages || [])
    .flatMap((stage) => stage.matches || [])
    .some((match) => [MATCH_STATUS.PENDING, MATCH_STATUS.LIVE].includes(match.status));
}

function nextPowerOfTwo(value) {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
