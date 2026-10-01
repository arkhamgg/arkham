// ========================================
// NEXUS — Tournament Pro Domain
// ========================================

import {
  getCompetitionFormatCapability,
  COMPETITION_CONFIGURATION_STATUS
} from "./competitionConfiguration.js";

import {
  TOURNAMENT_EVENT_STATUS,
  PARTICIPANT_STATUS,
  MATCH_STATUS,
  BRACKET_TYPES,
  RECOGNITION_STATUS
} from "./competitionTypes.js";

export {
  TOURNAMENT_EVENT_STATUS,
  PARTICIPANT_STATUS,
  MATCH_STATUS,
  BRACKET_TYPES,
  RECOGNITION_STATUS
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
    entries: {},
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
    entries: normalizePersistentEntries(
      current.entries,
      isObject(current.participants) ? current.participants : {}
    ),
    stations: Array.isArray(current.stations)
      ? current.stations
      : [],
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

  normalized.bracket.slots = normalizeBracketSlots(normalized.bracket.slots, normalized.entries);

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

function normalizePersistentEntries(currentEntries, participants = {}) {
  const source = isObject(currentEntries) ? currentEntries : {};
  const entries = {};

  Object.values(participants).forEach((participant) => {
    if (!participant?.id) return;

    const existingEntry = Object.values(source).find(
      (entry) => entry?.legacyParticipantId === participant.id
    ) || source[`entry_${participant.id}`];

    const entryId = existingEntry?.id || `entry_${participant.id}`;

    entries[entryId] = {
      id: entryId,
      competitionId: existingEntry?.competitionId || null,
      entityType: participant.entityType || "manual",
      entityId: participant.entityId ?? null,
      displayName: participant.displayName || "Participante",
      status: mapParticipantStatusToEntryStatus(participant.status),
      seed: participant.seed ?? null,
      registrationData: participant.registrationData ?? null,
      competitiveState: {
        participantStatus: participant.status ?? null,
        checkIn: participant.checkIn === true,
        slotIds: Array.isArray(participant.slotIds) ? [...participant.slotIds] : [],
        replacedByEntryId: participant.replacedByParticipantId
          ? `entry_${participant.replacedByParticipantId}`
          : null
      },
      legacyParticipantId: participant.id,
      createdAt: existingEntry?.createdAt || participant.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  Object.values(source).forEach((entry) => {
    if (!entry?.id || !entry.legacyParticipantId) return;
    if (!entries[entry.id]) {
      entries[entry.id] = { ...entry };
    }
  });

  return entries;
}

function mapParticipantStatusToEntryStatus(status) {
  switch (status) {
    case PARTICIPANT_STATUS.CHECKED_IN:
      return "checked_in";
    case PARTICIPANT_STATUS.COMPETING:
    case PARTICIPANT_STATUS.ADVANCED:
      return "active";
    case PARTICIPANT_STATUS.ELIMINATED:
      return "eliminated";
    case PARTICIPANT_STATUS.WITHDRAWN:
    case PARTICIPANT_STATUS.NO_SHOW:
      return "withdrawn";
    case PARTICIPANT_STATUS.DQ:
      return "dq";
    default:
      return "registered";
  }
}

export function createCompetitionEntry({
  entryId,
  competitionId = null,
  participant
} = {}) {
  if (!participant?.id) {
    throw new Error("No se puede crear una Entry sin participante.");
  }

  const now = new Date().toISOString();

  return {
    id: entryId || `entry_${crypto.randomUUID()}`,
    competitionId,
    entityType: participant.entityType || "manual",
    entityId: participant.entityId ?? null,
    displayName: participant.displayName || "Participante",
    status: mapParticipantStatusToEntryStatus(participant.status),
    seed: participant.seed ?? null,
    registrationData: participant.registrationData ?? null,
    competitiveState: {
      participantStatus: participant.status ?? null,
      checkIn: participant.checkIn === true,
      slotIds: Array.isArray(participant.slotIds) ? [...participant.slotIds] : [],
      replacedByEntryId: participant.replacedByParticipantId
        ? `entry_${participant.replacedByParticipantId}`
        : null
    },
    legacyParticipantId: participant.id,
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
  winnerId = null,
  matchSystem = null,
  phaseId = null
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
    matchSystem,
    phaseId,
    startedAt: null,
    completedAt: null
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

function normalizeBracketSlots(slots = {}, entries = {}) {
  if (!isObject(slots)) return {};

  const entryByParticipantId = new Map(
    Object.values(entries || {})
      .filter((entry) => entry?.id && entry?.legacyParticipantId)
      .map((entry) => [entry.legacyParticipantId, entry])
  );

  return Object.fromEntries(
    Object.entries(slots).map(([slotId, slot]) => {
      const normalizedSlot = { ...(slot || {}) };
      let entry = normalizedSlot.entryId
        ? entries?.[normalizedSlot.entryId] || null
        : null;

      if (!entry && normalizedSlot.participantId) {
        entry = entryByParticipantId.get(normalizedSlot.participantId) || null;
      }

      if (entry) {
        normalizedSlot.entryId = entry.id;
        normalizedSlot.participantId = normalizedSlot.participantId || entry.legacyParticipantId;
      } else if (normalizedSlot.participantId) {
        normalizedSlot.entryId = `entry_${normalizedSlot.participantId}`;
      } else if (!normalizedSlot.entryId) {
        normalizedSlot.entryId = null;
      }

      return [slotId, normalizedSlot];
    })
  );
}

export function syncBracketSlotsWithEntries(pro) {
  if (!pro?.bracket?.slots || !isObject(pro.entries)) return pro;

  const entryByParticipantId = new Map(
    Object.values(pro.entries)
      .filter((entry) => entry?.id && entry?.legacyParticipantId)
      .map((entry) => [entry.legacyParticipantId, entry])
  );

  Object.values(pro.bracket.slots).forEach((slot) => {
    if (!slot || typeof slot !== "object") return;

    const entry = slot.entryId
      ? pro.entries[slot.entryId] || null
      : entryByParticipantId.get(slot.participantId) || null;

    if (entry) {
      slot.entryId = entry.id;
      slot.participantId = slot.participantId || entry.legacyParticipantId;
      return;
    }

    if (slot.participantId) {
      slot.entryId = `entry_${slot.participantId}`;
    }
  });

  return pro;
}

function normalizeBracket(bracket, format) {
  if (!isObject(bracket)) return createEmptyBracket(format);
  return {
    ...createEmptyBracket(format),
    ...bracket,
    version: Math.max(Number(bracket.version) || 0, 4),
    type: bracket.type || normalizeBracketType(format),
    stages: Array.isArray(bracket.stages) ? bracket.stages : [],
    slots: isObject(bracket.slots) ? bracket.slots : {}
  };
}

function normalizeBracketType(format) {
  const capability = getCompetitionFormatCapability(format);

  if (capability.status !== COMPETITION_CONFIGURATION_STATUS.SUPPORTED) {
    return null;
  }

  return capability.engineFormat === BRACKET_TYPES.DOUBLE_ELIMINATION
    ? BRACKET_TYPES.DOUBLE_ELIMINATION
    : BRACKET_TYPES.SINGLE_ELIMINATION;
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
