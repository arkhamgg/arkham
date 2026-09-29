// ========================================
// NEXUS — Tournament Pro Domain
// ========================================

import {
  getCompetitionFormatCapability,
  COMPETITION_CONFIGURATION_STATUS
} from "./competitionConfiguration.js";

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

import {
  MATCH_STATUS,
  BRACKET_TYPES
} from "./competitionCore.js";

export { MATCH_STATUS, BRACKET_TYPES };

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
    version: 4,
    participationType,
    capacity,
    format,
    matchSystem,
    phases: [],
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
    version: 4,
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

  const normalized = {
    ...base,
    ...current,
    version: Math.max(Number(current.version) || 0, 4),
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

  if (Object.prototype.hasOwnProperty.call(current, "phases")) {
    normalized.phases = Array.isArray(current.phases) ? current.phases : [];
  } else {
    delete normalized.phases;
  }

  return normalized;
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

export function generateBracket(participants = [], capacity = null, format = null, matchSystem = null) {
  const type = normalizeBracketType(format);

  if (!type) {
    throw new Error(
      `El formato "${format || "seleccionado"}" no tiene una implementación disponible en el motor competitivo.`
    );
  }

  if (type === BRACKET_TYPES.DOUBLE_ELIMINATION) {
    return generateDoubleEliminationBracket(participants, capacity, matchSystem);
  }

  return generateSingleEliminationBracket(participants, capacity, matchSystem);
}

export function generateSingleEliminationBracket(participants = [], capacity = null, matchSystem = null) {
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
        winnerId: a && !b ? a.id : null,
        matchSystem
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
    version: 4,
    type: BRACKET_TYPES.SINGLE_ELIMINATION,
    generatedAt: new Date().toISOString(),
    completedAt: null,
    stages: rounds,
    slots,
    matchSystem,
    championId: null
  };
}

export function generateDoubleEliminationBracket(participants = [], capacity = null, matchSystem = null) {
  const winners = generateSingleEliminationBracket(participants, capacity, matchSystem);
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
    const matchCount = round % 2 === 1
      ? Math.max(1, Math.floor(bracketSize / Math.pow(2, stageIndex + 1)))
      : Math.max(1, Math.floor(bracketSize / Math.pow(2, stageIndex + 1)));
    const matches = [];

    for (let position = 1; position <= matchCount; position += 1) {
      matches.push(createMatch({
        id: `L-R${round}-M${sequence++}`,
        bracket: "losers",
        round,
        position,
        status: MATCH_STATUS.PENDING,
        matchSystem
      }));
    }

    losersRounds.push({
      id: `losers-round-${round}`,
      bracket: "losers",
      number: round,
      matches
    });
  }

  linkLosersProgression(losersRounds);
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
      status: MATCH_STATUS.PENDING,
      matchSystem
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
    version: 4,
    type: BRACKET_TYPES.DOUBLE_ELIMINATION,
    generatedAt: new Date().toISOString(),
    completedAt: null,
    stages: [
      ...winnersRounds,
      ...losersRounds,
      finalStage
    ],
    slots: winners.slots,
    matchSystem,
    championId: null
  };
}

function linkDoubleEliminationLoserRoutes(winnersRounds, losersRounds) {
  winnersRounds.forEach((round, roundIndex) => {
    const winnerRound = round.number || roundIndex + 1;

    round.matches.forEach((match, matchIndex) => {
      if (winnerRound === 1) {
        const target = losersRounds[0]?.matches[Math.floor(matchIndex / 2)];
        if (!target) return;

        match.loserRoute = {
          matchId: target.id,
          slot: matchIndex % 2 === 0 ? "A" : "B"
        };
        return;
      }

      const targetRound = losersRounds[(winnerRound * 2) - 3];
      const target = targetRound?.matches[matchIndex];
      if (!target) return;

      match.loserRoute = {
        matchId: target.id,
        slot: "B"
      };
    });
  });
}

function linkLosersProgression(rounds) {
  for (let index = 0; index < rounds.length - 1; index += 1) {
    const current = rounds[index];
    const next = rounds[index + 1];
    const currentRound = current.number || index + 1;

    current.matches.forEach((match, matchIndex) => {
      let nextMatch = null;
      let nextSlot = null;

      if (currentRound % 2 === 1) {
        nextMatch = next.matches[matchIndex];
        nextSlot = "A";
      } else {
        nextMatch = next.matches[Math.floor(matchIndex / 2)];
        nextSlot = matchIndex % 2 === 0 ? "A" : "B";
      }

      if (nextMatch) {
        match.nextMatchId = nextMatch.id;
        match.nextSlot = nextSlot;
      }
    });
  }
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
