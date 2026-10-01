// ========================================
// ARKHAM — Competition Core
// ========================================
//
// V1 architecture seam.
//
// The current competition engine implementation remains in
// tournamentPro.js so existing behavior is preserved while
// Tournament Pro begins consuming the competition domain through
// a dedicated Core entry point.
//
// Match Result now has an explicit Core contract. The underlying
// bracket implementation remains in tournamentPro.js for this step.
// ========================================

import {
  applyMatchResult,
  ensureTournamentProState,
  createParticipant,
  generateBracket,
  startMatch
} from "./tournamentPro.js";
import {
  PARTICIPANT_STATUS,
  MATCH_STATUS,
  RECOGNITION_STATUS,
  TOURNAMENT_EVENT_STATUS,
  BRACKET_TYPES,
  STATION_TYPES,
  STATION_STATUS
} from "./competitionTypes.js";


/**
 * Returns the optional Phase configuration without changing legacy events.
 */
export function getCompetitionPhases(event = {}) {
  return Array.isArray(event?.pro?.phases) ? event.pro.phases : [];
}

export const ENTRY_STATUS = {
  REGISTERED: "registered",
  CHECKED_IN: "checked_in",
  ACTIVE: "active",
  ELIMINATED: "eliminated",
  WITHDRAWN: "withdrawn",
  DQ: "dq"
};

/**
 * Normalizes a Competition Entry without changing the persisted legacy
 * participant model. In V1, Participant remains the storage source while
 * Entry becomes the competition-facing domain representation.
 */
export function normalizeEntry(entry = {}, { competitionId = null } = {}) {
  if (!entry || typeof entry !== "object") return null;

  const id = typeof entry.id === "string" && entry.id.trim()
    ? entry.id.trim()
    : null;

  if (!id) return null;

  return {
    id,
    competitionId: entry.competitionId ?? competitionId ?? null,
    entityType: entry.entityType || "manual",
    entityId: entry.entityId ?? null,
    displayName: entry.displayName || "Participante",
    status: normalizeEntryStatus(entry.status),
    seed: entry.seed ?? null,
    registrationData: entry.registrationData ?? null,
    competitiveState: {
      participantStatus: entry.competitiveState?.participantStatus ?? entry.status ?? null,
      checkIn: entry.competitiveState?.checkIn === true || entry.checkIn === true,
      slotIds: Array.isArray(entry.competitiveState?.slotIds)
        ? [...entry.competitiveState.slotIds]
        : Array.isArray(entry.slotIds)
          ? [...entry.slotIds]
          : [],
      replacedByEntryId:
        entry.competitiveState?.replacedByEntryId ??
        entry.replacedByEntryId ??
        entry.replacedByParticipantId ??
        null
    },
    legacyParticipantId: entry.legacyParticipantId ?? entry.id
  };
}

/**
 * Adapts the existing pro.participants collection into Competition Entries.
 * This is read-only and intentionally preserves the existing participant IDs
 * so legacy bracket slots and matches continue to work unchanged.
 */
export function getCompetitionEntries(event = {}, { includeInactive = true } = {}) {
  const competitionId = event?.id || event?.eventId || null;
  const persistentEntries = event?.pro?.entries;

  const source = persistentEntries && typeof persistentEntries === "object" && !Array.isArray(persistentEntries)
    ? Object.values(persistentEntries)
    : Object.values(event?.pro?.participants || {});

  return source
    .map((entry) => normalizeEntry(entry, { competitionId }))
    .filter(Boolean)
    .filter((entry) => (
      includeInactive ||
      ![ENTRY_STATUS.ELIMINATED, ENTRY_STATUS.WITHDRAWN, ENTRY_STATUS.DQ].includes(entry.status)
    ));
}

export function getCompetitionEntry(event = {}, entryId = null) {
  if (!entryId) return null;
  return getCompetitionEntries(event).find((entry) => entry.id === entryId) || null;
}

export function getCompetitionEntryForSlot(event = {}, slot = null) {
  if (!slot) return null;

  const entryId = typeof slot.entryId === "string" && slot.entryId.trim()
    ? slot.entryId.trim()
    : null;

  if (entryId) {
    const byId = getCompetitionEntry(event, entryId);
    if (byId) return byId;
  }

  const participantId = slot.participantId || null;
  return participantId
    ? getCompetitionEntries(event).find((entry) => entry.legacyParticipantId === participantId) || null
    : null;
}

function normalizeEntryStatus(status) {
  switch (status) {
    case PARTICIPANT_STATUS.CHECKED_IN:
      return ENTRY_STATUS.CHECKED_IN;
    case PARTICIPANT_STATUS.COMPETING:
    case PARTICIPANT_STATUS.ADVANCED:
      return ENTRY_STATUS.ACTIVE;
    case PARTICIPANT_STATUS.ELIMINATED:
      return ENTRY_STATUS.ELIMINATED;
    case PARTICIPANT_STATUS.WITHDRAWN:
    case PARTICIPANT_STATUS.NO_SHOW:
      return ENTRY_STATUS.WITHDRAWN;
    case PARTICIPANT_STATUS.APPROVED:
    case PARTICIPANT_STATUS.REQUESTED:
    case PARTICIPANT_STATUS.PENDING:
    default:
      return ENTRY_STATUS.REGISTERED;
  }
}

/**
 * Resolves the Phase context of a Match. Legacy matches without phaseId
 * continue to resolve to null.
 */
export function getMatchPhase(event = {}, match = {}) {
  if (!match || typeof match !== "object" || !match.phaseId) return null;
  return getCompetitionPhases(event).find((phase) => phase?.id === match.phaseId) || null;
}

/**
 * Resolves the effective Match System using persisted Match data first, then
 * the Phase configuration, then the competition-level legacy configuration.
 */
export function getEffectiveMatchSystem(event = {}, match = {}) {
  if (match && typeof match.matchSystem === "string" && match.matchSystem.trim()) {
    return match.matchSystem.trim();
  }

  const phase = getMatchPhase(event, match);
  if (phase?.matchSystemMode === "CUSTOM" &&
      typeof phase.matchSystem === "string" &&
      phase.matchSystem.trim()) {
    return phase.matchSystem.trim();
  }

  return event?.pro?.matchSystem || event?.matchSystem || null;
}


/**
 * Resolves whether the competition operates with physical stations or
 * virtual lobbies. The source of truth is the event Location setting.
 */
export function getCompetitionDeliveryMode(event = {}) {
  return event?.location?.type === "presencial"
    ? STATION_TYPES.PHYSICAL
    : STATION_TYPES.VIRTUAL;
}

export function normalizeStation(station = {}, { mode = STATION_TYPES.PHYSICAL, order = 1 } = {}) {
  if (!station || typeof station !== "object") return null;

  const normalizedMode = mode === STATION_TYPES.PHYSICAL
    ? STATION_TYPES.PHYSICAL
    : STATION_TYPES.VIRTUAL;
  const number = Number(station.number);
  const normalizedNumber = Number.isFinite(number) && number > 0 ? number : order;

  return {
    ...station,
    id: typeof station.id === "string" && station.id.trim()
      ? station.id.trim()
      : `${normalizedMode === STATION_TYPES.PHYSICAL ? "station" : "lobby"}-${normalizedNumber}`,
    number: normalizedNumber,
    type: normalizedMode,
    name: typeof station.name === "string" && station.name.trim() && !/^(station|lobby)\s+\d+$/i.test(station.name.trim())
      ? station.name.trim()
      : `${normalizedMode === STATION_TYPES.PHYSICAL ? "Station" : "Lobby"} ${normalizedNumber}`,
    status: Object.values(STATION_STATUS).includes(station.status)
      ? station.status
      : STATION_STATUS.AVAILABLE,
    currentMatchId: station.currentMatchId || null,
    assignedStaffIds: Array.isArray(station.assignedStaffIds)
      ? station.assignedStaffIds
      : []
  };
}

export function getCompetitionStations(event = {}) {
  const mode = getCompetitionDeliveryMode(event);
  const stations = Array.isArray(event?.pro?.stations) ? event.pro.stations : [];

  return stations
    .map((station, index) => normalizeStation(station, { mode, order: index + 1 }))
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);
}

export const STRUCTURE_TYPES = {
  SINGLE_ELIMINATION: "SINGLE_ELIMINATION",
  DOUBLE_ELIMINATION: "DOUBLE_ELIMINATION",
  GROUP: "GROUP",
  ROUND_ROBIN: "ROUND_ROBIN",
  SWISS: "SWISS"
};

/**
 * Normalizes the first Competition Structure contract without changing the
 * persisted tournament model. Structures are currently descriptive domain
 * objects; the existing Single/Double Elimination engine remains the source
 * of bracket generation.
 */
export function normalizeStructure(structure = {}, { phaseId = null, order = 1 } = {}) {
  if (!structure || typeof structure !== "object") {
    return null;
  }

  const type = normalizeStructureType(structure.type || structure.structureType);

  return {
    ...structure,
    id: typeof structure.id === "string" && structure.id.trim()
      ? structure.id.trim()
      : null,
    phaseId: structure.phaseId ?? phaseId ?? null,
    name: typeof structure.name === "string" && structure.name.trim()
      ? structure.name.trim()
      : "Structure",
    order: Number.isFinite(Number(structure.order))
      ? Number(structure.order)
      : order,
    type,
    status: structure.status || "configured"
  };
}

/**
 * Returns only explicitly declared structures from the competition phases.
 * Legacy events with no phase/structure data return an empty array.
 */
export function getCompetitionStructures(event = {}) {
  const phases = Array.isArray(event?.pro?.phases) ? event.pro.phases : [];
  const structures = [];

  phases.forEach((phase, phaseIndex) => {
    const phaseStructures = Array.isArray(phase?.structures)
      ? phase.structures
      : [];

    phaseStructures.forEach((structure, structureIndex) => {
      const normalized = normalizeStructure(structure, {
        phaseId: phase?.id || null,
        order: structureIndex + 1
      });

      if (normalized) {
        structures.push({
          ...normalized,
          phaseOrder: Number.isFinite(Number(phase?.order))
            ? Number(phase.order)
            : phaseIndex + 1
        });
      }
    });
  });

  return structures.sort((a, b) => {
    if (a.phaseOrder !== b.phaseOrder) return a.phaseOrder - b.phaseOrder;
    return a.order - b.order;
  });
}

/**
 * Resolves the Structure context for a Match without mutating the bracket.
 * A Match with an explicit structureId resolves against declared phase
 * structures. Legacy matches can still be described from the existing
 * bracket type without creating or persisting a synthetic Structure.
 */
export function getMatchStructure(event = {}, match = {}) {
  if (!match || typeof match !== "object") return null;

  const structures = getCompetitionStructures(event);
  if (match.structureId) {
    return structures.find((structure) => structure.id === match.structureId) || null;
  }

  const bracketType = normalizeCoreBracketType(event?.pro?.bracket?.type || event?.format);
  if (!bracketType) return null;

  return {
    id: null,
    phaseId: match.phaseId ?? null,
    name: bracketType === BRACKET_TYPES.DOUBLE_ELIMINATION
      ? "Main Bracket"
      : "Main Bracket",
    order: 1,
    type: bracketType === BRACKET_TYPES.DOUBLE_ELIMINATION
      ? STRUCTURE_TYPES.DOUBLE_ELIMINATION
      : STRUCTURE_TYPES.SINGLE_ELIMINATION,
    status: "legacy-derived",
    source: "bracket"
  };
}

/**
 * Resolves the existing Round context of a Match. This is deliberately a
 * read-only bridge from the current `round` field to the future Round domain
 * entity. No roundId is introduced and no bracket data is rewritten here.
 */
export function getMatchRound(match = {}) {
  if (!match || typeof match !== "object") return null;

  const number = Number(match.round);
  return {
    id: match.roundId ?? null,
    name: typeof match.roundName === "string" && match.roundName.trim()
      ? match.roundName.trim()
      : match.bracket === "grand_final"
        ? "Grand Final"
        : Number.isFinite(number)
          ? `Round ${number}`
          : "Round",
    number: Number.isFinite(number) ? number : null,
    bracket: match.bracket || null,
    source: match.roundId ? "domain" : "legacy-field"
  };
}


/**
 * Formal bracket segments used by the Competition Core.
 *
 * These values describe the competitive lane a Match/Round belongs to.
 * They intentionally preserve the legacy engine vocabulary so existing
 * brackets remain readable without requiring a data migration.
 */
export const BRACKET_SEGMENTS = {
  WINNERS: "winners",
  LOSERS: "losers",
  GRAND_FINAL: "grand_final"
};

export function normalizeBracketSegment(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === BRACKET_SEGMENTS.WINNERS) {
    return BRACKET_SEGMENTS.WINNERS;
  }

  if (normalized === BRACKET_SEGMENTS.LOSERS) {
    return BRACKET_SEGMENTS.LOSERS;
  }

  if (
    normalized === BRACKET_SEGMENTS.GRAND_FINAL ||
    normalized === "grand-final" ||
    normalized === "grand final"
  ) {
    return BRACKET_SEGMENTS.GRAND_FINAL;
  }

  return null;
}

/**
 * Normalizes the existing stage representation into the future Round
 * contract without changing or persisting the bracket.
 *
 * Legacy stages already contain the information required by the Core:
 * stage.id, stage.bracket, stage.number and stage.matches. We expose those
 * fields through one stable Round shape so future UI/API consumers do not
 * need to understand the legacy stage name.
 */
export function normalizeRound(round = {}, {
  structureId = null,
  phaseId = null,
  order = 1
} = {}) {
  if (!round || typeof round !== "object") return null;

  const number = Number(round.number ?? round.order);
  const bracket = normalizeBracketSegment(round.bracket);
  const normalizedOrder = Number.isFinite(number)
    ? number
    : Number.isFinite(Number(order))
      ? Number(order)
      : 1;

  const id = typeof round.id === "string" && round.id.trim()
    ? round.id.trim()
    : null;

  const name = typeof round.name === "string" && round.name.trim()
    ? round.name.trim()
    : bracket === BRACKET_SEGMENTS.GRAND_FINAL
      ? "Grand Final"
      : Number.isFinite(number)
        ? `Round ${number}`
        : "Round";

  return {
    ...round,
    id,
    structureId: round.structureId ?? structureId ?? null,
    phaseId: round.phaseId ?? phaseId ?? null,
    name,
    order: normalizedOrder,
    number: Number.isFinite(number) ? number : null,
    bracket,
    matches: Array.isArray(round.matches) ? round.matches : [],
    status: round.status || "configured",
    source: round.id ? "stage" : "legacy-derived"
  };
}

/**
 * Returns the bracket segment for a Match using the canonical Core
 * vocabulary. This is deliberately read-only and supports legacy matches.
 */
export function getMatchBracketSegment(match = {}) {
  if (!match || typeof match !== "object") return null;
  return normalizeBracketSegment(match.bracket);
}

/**
 * Builds the formal Round view of the existing bracket stages.
 *
 * No persistence and no bracket generation occur here. This is an adapter
 * that lets the Core expose Round entities before the underlying engine is
 * migrated from its legacy `stages` representation.
 */
export function getCompetitionRounds(event = {}, {
  phaseId = null,
  structureId = null,
  bracket = null
} = {}) {
  const stages = Array.isArray(event?.pro?.bracket?.stages)
    ? event.pro.bracket.stages
    : [];

  return stages
    .map((stage, index) => {
      const stageMatches = Array.isArray(stage?.matches) ? stage.matches : [];
      const representativeMatch = stageMatches[0] || {};
      const stagePhaseId = stage?.phaseId
        ?? representativeMatch?.phaseId
        ?? phaseId
        ?? null;
      const stageStructure = getMatchStructure(event, {
        ...representativeMatch,
        phaseId: stagePhaseId,
        structureId: stage?.structureId ?? structureId ?? null
      });
      const normalizedBracket = normalizeBracketSegment(
        stage?.bracket || representativeMatch?.bracket
      );

      return normalizeRound(stage, {
        structureId: stage?.structureId
          ?? stageStructure?.id
          ?? structureId
          ?? null,
        phaseId: stagePhaseId,
        order: index + 1
      });
    })
    .filter((round) => {
      if (!round) return false;
      if (phaseId && round.phaseId !== phaseId) return false;
      if (structureId && round.structureId !== structureId) return false;
      if (bracket && round.bracket !== normalizeBracketSegment(bracket)) return false;
      return true;
    });
}

/**
 * Resolves the complete structural context of a Match.
 *
 * This is the read-side contract future Phase/Structure/Round UI can use:
 * Phase -> Structure -> Round -> Match. Legacy brackets are represented by
 * derived objects rather than rewritten data.
 */
export function getMatchCompetitionContext(event = {}, match = {}) {
  if (!match || typeof match !== "object") return null;

  const phase = getMatchPhase(event, match);
  const structure = getMatchStructure(event, match);
  const round = getMatchRound(match);
  const bracket = getMatchBracketSegment(match);

  return {
    phase,
    structure,
    round: round
      ? {
          ...round,
          structureId: round.id && structure?.id
            ? structure.id
            : round.structureId ?? structure?.id ?? null,
          phaseId: match.phaseId ?? phase?.id ?? null,
          bracket
        }
      : null,
    bracket
  };
}

function normalizeCoreBracketType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === BRACKET_TYPES.DOUBLE_ELIMINATION) return BRACKET_TYPES.DOUBLE_ELIMINATION;
  if (normalized === BRACKET_TYPES.SINGLE_ELIMINATION) return BRACKET_TYPES.SINGLE_ELIMINATION;
  return null;
}

function normalizeStructureType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (Object.values(STRUCTURE_TYPES).includes(normalized)) return normalized;
  return null;
}


/**
 * Canonical Advancement destination types.
 *
 * The current bracket engine stores routes directly on Match records
 * (`nextMatchId`, `nextSlot`, `loserRoute`). The Core exposes those routes
 * through this stable contract without changing or persisting the underlying
 * data yet.
 */
export const ADVANCEMENT_DESTINATION_TYPES = {
  MATCH: "MATCH",
  ELIMINATED: "ELIMINATED",
  CHAMPION: "CHAMPION"
};

export function normalizeAdvancementDestination(destination = null) {
  if (!destination || typeof destination !== "object") return null;

  const type = String(destination.type || "").trim().toUpperCase();

  if (type === ADVANCEMENT_DESTINATION_TYPES.MATCH) {
    const matchId = typeof destination.matchId === "string"
      ? destination.matchId.trim()
      : "";

    if (!matchId) return null;

    return {
      type: ADVANCEMENT_DESTINATION_TYPES.MATCH,
      matchId,
      slot: destination.slot === "A" || destination.slot === "B"
        ? destination.slot
        : null,
      reason: destination.reason || null
    };
  }

  if (type === ADVANCEMENT_DESTINATION_TYPES.CHAMPION) {
    return {
      type: ADVANCEMENT_DESTINATION_TYPES.CHAMPION,
      matchId: null,
      slot: null,
      reason: destination.reason || null
    };
  }

  if (type === ADVANCEMENT_DESTINATION_TYPES.ELIMINATED) {
    return {
      type: ADVANCEMENT_DESTINATION_TYPES.ELIMINATED,
      matchId: null,
      slot: null,
      reason: destination.reason || null
    };
  }

  return null;
}

/**
 * Returns the formal advancement contract for one Match.
 *
 * This is a read-only adapter over the existing deterministic routes. It does
 * not calculate a second bracket and does not mutate the Match.
 */
export function getMatchAdvancement(match = {}, bracket = {}) {
  if (!match || typeof match !== "object") return null;

  const bracketSegment = normalizeBracketSegment(match.bracket);
  const isGrandFinal = bracketSegment === BRACKET_SEGMENTS.GRAND_FINAL;
  const isDoubleEliminationWinner =
    bracket?.type === BRACKET_TYPES.DOUBLE_ELIMINATION &&
    bracketSegment === BRACKET_SEGMENTS.WINNERS;

  const winnerDestination = match.nextMatchId
    ? normalizeAdvancementDestination({
        type: ADVANCEMENT_DESTINATION_TYPES.MATCH,
        matchId: match.nextMatchId,
        slot: match.nextSlot || null,
        reason: "WINNER_ADVANCEMENT"
      })
    : normalizeAdvancementDestination({
        type: isGrandFinal
          ? ADVANCEMENT_DESTINATION_TYPES.CHAMPION
          : ADVANCEMENT_DESTINATION_TYPES.CHAMPION,
        reason: isGrandFinal
          ? "GRAND_FINAL_WIN"
          : "TERMINAL_WIN"
      });

  const loserDestination = isDoubleEliminationWinner && match.loserRoute
    ? normalizeAdvancementDestination({
        type: ADVANCEMENT_DESTINATION_TYPES.MATCH,
        matchId: match.loserRoute.matchId,
        slot: match.loserRoute.slot || null,
        reason: "LOSER_ROUTE"
      })
    : normalizeAdvancementDestination({
        type: ADVANCEMENT_DESTINATION_TYPES.ELIMINATED,
        reason: isGrandFinal
          ? "GRAND_FINAL_LOSS"
          : "ELIMINATION"
      });

  return {
    sourceMatchId: match.id || null,
    winnerDestination,
    loserDestination,
    rules: {
      winner: winnerDestination?.type === ADVANCEMENT_DESTINATION_TYPES.MATCH
        ? "ADVANCE"
        : "CHAMPION",
      loser: loserDestination?.type === ADVANCEMENT_DESTINATION_TYPES.MATCH
        ? "ROUTE"
        : "ELIMINATED"
    }
  };
}

/**
 * Builds a read-only Advancement Graph from the current bracket.
 *
 * Nodes are existing Matches. Edges are derived from winner/loser
 * destinations. Terminal outcomes are represented without inventing Match
 * records or rewriting legacy bracket data.
 */
export function getAdvancementGraph(bracket = {}) {
  const stages = Array.isArray(bracket?.stages) ? bracket.stages : [];
  const matches = stages.flatMap((stage) =>
    Array.isArray(stage?.matches) ? stage.matches : []
  );

  const nodes = matches.map((match) => ({
    matchId: match.id || null,
    bracket: normalizeBracketSegment(match.bracket),
    round: Number.isFinite(Number(match.round))
      ? Number(match.round)
      : null
  }));

  const edges = [];
  const terminals = [];

  matches.forEach((match) => {
    const advancement = getMatchAdvancement(match, bracket);
    if (!advancement) return;

    [
      ["winner", advancement.winnerDestination],
      ["loser", advancement.loserDestination]
    ].forEach(([outcome, destination]) => {
      if (!destination) return;

      if (destination.type === ADVANCEMENT_DESTINATION_TYPES.MATCH) {
        edges.push({
          sourceMatchId: advancement.sourceMatchId,
          outcome,
          destinationMatchId: destination.matchId,
          slot: destination.slot,
          reason: destination.reason
        });
        return;
      }

      terminals.push({
        sourceMatchId: advancement.sourceMatchId,
        outcome,
        type: destination.type,
        reason: destination.reason
      });
    });
  });

  return {
    nodes,
    edges,
    terminals
  };
}

export const MATCH_LIFECYCLE = {
  SCHEDULED: "scheduled",
  READY: "ready",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  BYE: "bye"
};

/**
 * Returns the operational lifecycle state of a Match without changing the
 * persisted Match status used by the existing tournament engine.
 *
 * V1 deliberately derives READY/SCHEDULED from the existing PENDING state:
 * - PENDING + two participants -> READY
 * - PENDING + missing participant(s) -> SCHEDULED
 * This keeps legacy brackets compatible while giving the Core a stable
 * lifecycle vocabulary for future Tournament Operations and Match Queue work.
 */
export function getMatchLifecycle(match) {
  if (!match || typeof match !== "object") {
    throw new Error("Match no encontrado.");
  }

  if (match.status === MATCH_STATUS.BYE) {
    return MATCH_LIFECYCLE.BYE;
  }

  if (match.status === MATCH_STATUS.COMPLETED) {
    return MATCH_LIFECYCLE.COMPLETED;
  }

  if (match.status === MATCH_STATUS.LIVE) {
    return MATCH_LIFECYCLE.IN_PROGRESS;
  }

  if (match.status === MATCH_STATUS.PENDING) {
    return match.participantAId && match.participantBId
      ? MATCH_LIFECYCLE.READY
      : MATCH_LIFECYCLE.SCHEDULED;
  }

  throw new Error(`Estado de Match no soportado: ${match.status}.`);
}


export const MATCH_QUEUE_STATUS = {
  WAITING: "waiting",
  READY: "ready",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  BYE: "bye"
};

/**
 * Builds a read-only Match Queue from the current bracket.
 *
 * The queue is derived from the Match Lifecycle and does not mutate or
 * persist anything. A Match in the legacy PENDING state is exposed as
 * WAITING when it is missing a participant and READY when both participants
 * are present. This gives Tournament Pro and future Operations clients a
 * common queue vocabulary without changing the existing bracket model.
 */
export function getMatchQueue(bracket, {
  includeCompleted = false,
  includeBye = false
} = {}) {
  const stages = Array.isArray(bracket?.stages) ? bracket.stages : [];
  const all = [];

  stages.forEach((stage, stageIndex) => {
    const matches = Array.isArray(stage?.matches) ? stage.matches : [];

    matches.forEach((match, matchIndex) => {
      const lifecycle = getMatchLifecycle(match);
      const queueStatus = lifecycle === MATCH_LIFECYCLE.SCHEDULED
        ? MATCH_QUEUE_STATUS.WAITING
        : lifecycle;

      if (queueStatus === MATCH_QUEUE_STATUS.COMPLETED && !includeCompleted) {
        return;
      }

      if (queueStatus === MATCH_QUEUE_STATUS.BYE && !includeBye) {
        return;
      }

      all.push({
        match,
        matchId: match.id,
        stageId: stage?.id || null,
        stageIndex,
        matchIndex,
        lifecycle,
        queueStatus
      });
    });
  });

  return {
    all,
    waiting: all.filter((item) => item.queueStatus === MATCH_QUEUE_STATUS.WAITING),
    ready: all.filter((item) => item.queueStatus === MATCH_QUEUE_STATUS.READY),
    inProgress: all.filter((item) => item.queueStatus === MATCH_QUEUE_STATUS.IN_PROGRESS),
    completed: all.filter((item) => item.queueStatus === MATCH_QUEUE_STATUS.COMPLETED),
    bye: all.filter((item) => item.queueStatus === MATCH_QUEUE_STATUS.BYE)
  };
}

/**
 * Returns only the matches currently ready to be operated.
 */
export function getReadyMatchQueue(bracket) {
  return getMatchQueue(bracket).ready;
}

/**
 * Returns the first ready Match in bracket order without mutating the bracket.
 */
export function getNextReadyMatch(bracket) {
  return getReadyMatchQueue(bracket)[0] || null;
}

/**
 * Builds the operational view of the competition without mutating persisted state.
 *
 * Competition remains Match-centric in the domain, while Operations is Station-centric
 * for the operator. A Match can therefore be READY, WAITING, IN_PROGRESS or COMPLETED
 * independently from its current station assignment.
 */
export function getCompetitionOperationsModel(event = {}) {
  const bracket = event?.pro?.bracket || {};
  const stations = getCompetitionStations(event);
  const queue = getMatchQueue(bracket);
  const inProgress = queue.inProgress;
  const busyParticipantIds = new Set(
    inProgress.flatMap(({ match }) => [match?.participantAId, match?.participantBId].filter(Boolean))
  );

  const stationByMatchId = new Map(
    stations.filter((station) => station.currentMatchId).map((station) => [station.currentMatchId, station])
  );

  const describeWaitingReason = (match) => {
    const missing = [match?.participantAId, match?.participantBId].filter((id) => !id).length;
    if (missing === 2) return { code: "NEXT_MATCH", label: "Siguiente match" };
    if (missing === 1) return { code: "WAITING_FOR_PARTICIPANT", label: "Esperando rival" };

    const busy = [match.participantAId, match.participantBId].filter((id) => busyParticipantIds.has(id));
    if (busy.length) return { code: "PARTICIPANT_BUSY", label: "Jugador en otro match" };

    return { code: "WAITING", label: "Esperando" };
  };

  const structurallyReady = queue.ready.map((item) => ({
    ...item,
    station: stationByMatchId.get(item.matchId) || null,
    assigned: Boolean(stationByMatchId.get(item.matchId))
  }));

  const waiting = [
    ...queue.waiting.map((item) => ({
      ...item,
      reason: describeWaitingReason(item.match),
      station: stationByMatchId.get(item.matchId) || null
    })),
    ...structurallyReady
      .filter((item) => describeWaitingReason(item.match).code !== "WAITING")
      .map((item) => ({
        ...item,
        reason: describeWaitingReason(item.match)
      }))
  ];

  const ready = structurallyReady.filter((item) => describeWaitingReason(item.match).code === "WAITING");

  const active = queue.inProgress.map((item) => ({
    ...item,
    station: stationByMatchId.get(item.matchId) || null
  }));

  const completed = queue.completed.map((item) => ({
    ...item,
    station: stationByMatchId.get(item.matchId) || null
  }));

  const freeStations = stations.filter((station) => !station.currentMatchId);
  const occupiedStations = stations.filter((station) => Boolean(station.currentMatchId));
  const readyUnassigned = ready.filter((item) => !item.station);
  const readyAssigned = ready.filter((item) => Boolean(item.station));

  return {
    stations,
    freeStations,
    occupiedStations,
    active,
    ready,
    readyUnassigned,
    readyAssigned,
    waiting,
    completed,
    nextReadyMatch: readyUnassigned[0] || readyAssigned[0] || null,
    busyParticipantIds: [...busyParticipantIds],
    summary: {
      stations: stations.length,
      freeStations: freeStations.length,
      occupiedStations: occupiedStations.length,
      activeMatches: active.length,
      readyMatches: readyUnassigned.length,
      waitingMatches: waiting.length
    }
  };
}

export {
  ensureTournamentProState,
  createParticipant,
  generateBracket,
  startMatch,
  PARTICIPANT_STATUS,
  MATCH_STATUS,
  RECOGNITION_STATUS,
  TOURNAMENT_EVENT_STATUS,
  BRACKET_TYPES
};

/**
 * Creates the domain command used to report a Match result.
 *
 * This is intentionally a small data contract for V1. Validation and
 * bracket mutation remain in the existing competition engine until the
 * dependent logic can be migrated safely.
 */
export function createMatchResultCommand({
  matchId,
  winnerId,
  score = null
}) {
  return normalizeMatchResultCommand({
    matchId,
    winnerId,
    score
  });
}

/**
 * Normalizes and validates the minimal Match Result contract.
 *
 * This layer deliberately validates only the shape of the command.
 * Competition-state validation (match existence, LIVE status, winner
 * membership, advancement, etc.) remains in the existing engine so we do
 * not duplicate bracket rules in the Core.
 */
export function normalizeMatchResultCommand(command) {
  if (!command || typeof command !== "object") {
    throw new Error("El resultado del match debe ser un objeto.");
  }

  const matchId = typeof command.matchId === "string"
    ? command.matchId.trim()
    : "";
  const winnerId = typeof command.winnerId === "string"
    ? command.winnerId.trim()
    : "";

  if (!matchId) {
    throw new Error("El resultado del match requiere matchId.");
  }

  if (!winnerId) {
    throw new Error("El resultado del match requiere winnerId.");
  }

  return {
    matchId,
    winnerId,
    score: command.score ?? null
  };
}

/**
 * Validates that a Match is in a valid state for the requested operation.
 *
 * The Core owns the operation-level state contract while the existing
 * competition engine remains responsible for bracket mutation.
 */
export function validateMatchState(match, operation = "result") {
  if (!match || typeof match !== "object") {
    throw new Error("Match no encontrado.");
  }

  if (operation === "start") {
    const lifecycle = getMatchLifecycle(match);

    if (
      lifecycle !== MATCH_LIFECYCLE.READY &&
      lifecycle !== MATCH_LIFECYCLE.IN_PROGRESS
    ) {
      throw new Error("El match no está disponible para iniciar.");
    }

    return true;
  }

  if (operation === "result") {
    if (getMatchLifecycle(match) !== MATCH_LIFECYCLE.IN_PROGRESS) {
      throw new Error("El match debe estar en vivo antes de registrar el resultado.");
    }

    return true;
  }

  throw new Error(`Operación de Match no soportada: ${operation}.`);
}

function findMatch(bracket, matchId) {
  return (bracket?.stages || [])
    .flatMap((stage) => stage.matches || [])
    .find((match) => match.id === matchId) || null;
}

export function validateMatchStateInBracket(bracket, matchId, operation = "result") {
  const match = findMatch(bracket, matchId);
  validateMatchState(match, operation);
  return match;
}

/**
 * Validates that a Match is available for a Tournament Pro operation.
 *
 * This keeps the operation-level Match eligibility contract inside the
 * Competition Core instead of duplicating it in Tournament Pro Operations.
 */
export function validateMatchForOperation(bracket, matchId, operation = "result") {
  return validateMatchStateInBracket(bracket, matchId, operation);
}

/**
 * Validates that the reported winner is one of the two participants
 * currently assigned to the Match.
 *
 * This is intentionally limited to participant membership. Bracket
 * advancement and loser routing remain responsibilities of the existing
 * competition engine.
 */
export function validateMatchWinner(match, winnerId) {
  if (!match || typeof match !== "object") {
    throw new Error("Match no encontrado.");
  }

  const normalizedWinnerId = typeof winnerId === "string"
    ? winnerId.trim()
    : "";

  if (!normalizedWinnerId) {
    throw new Error("El resultado del match requiere winnerId.");
  }

  const isParticipant =
    normalizedWinnerId === match.participantAId ||
    normalizedWinnerId === match.participantBId;

  if (!isParticipant) {
    throw new Error("El ganador indicado no pertenece al match.");
  }

  return true;
}

/**
 * Starts a Match through the existing competition engine after the Core
 * validates its current state.
 */
export function startMatchCommand(bracket, matchId) {
  validateMatchStateInBracket(bracket, matchId, "start");
  return startMatch(bracket, matchId);
}

/**
 * Builds a non-mutating advancement plan for an accepted Match result.
 *
 * The plan describes where the winner and loser are expected to go based
 * on the deterministic routes already stored on the current Match. It does
 * not change the bracket and does not implement a second advancement engine.
 * The existing tournamentPro engine remains responsible for applying the
 * actual participant movement.
 */
export function createAdvancementPlan(bracket, command) {
  const normalizedCommand = normalizeMatchResultCommand(command);
  const match = validateMatchStateInBracket(
    bracket,
    normalizedCommand.matchId,
    "result"
  );

  validateMatchWinner(match, normalizedCommand.winnerId);

  const loserId = match.participantAId === normalizedCommand.winnerId
    ? match.participantBId
    : match.participantAId;

  const winnerDestination = match.nextMatchId
    ? {
        matchId: match.nextMatchId,
        slot: match.nextSlot || null,
        reason: "WINNER_ADVANCEMENT"
      }
    : null;

  const loserDestination =
    bracket?.type === BRACKET_TYPES.DOUBLE_ELIMINATION &&
    match.bracket === "winners" &&
    match.loserRoute
      ? {
          matchId: match.loserRoute.matchId,
          slot: match.loserRoute.slot || null,
          reason: "LOSER_ROUTE"
        }
      : null;

  const isGrandFinal = match.bracket === "grand_final";
  const completesSingleElimination =
    bracket?.type === BRACKET_TYPES.SINGLE_ELIMINATION && !winnerDestination;

  return {
    matchId: normalizedCommand.matchId,
    winner: {
      entryId: normalizedCommand.winnerId,
      destination: winnerDestination
    },
    loser: {
      entryId: loserId || null,
      destination: loserDestination
    },
    completion: {
      isGrandFinal,
      completesSingleElimination
    }
  };
}

/**
 * Applies a Match result through the existing competition engine.
 *
 * Keeping this adapter here gives future clients (Tournament Operations,
 * API, etc.) one Core entry point without creating a second bracket engine.
 */
/**
 * Applies a previously calculated Advancement Plan through the existing
 * bracket engine.
 *
 * The plan is the decision; this function is the application seam. The
 * underlying movement rules are still delegated to tournamentPro.js so
 * there is only one real bracket engine.
 */
export function applyAdvancementPlan(bracket, advancementPlan, { score = null } = {}) {
  if (!advancementPlan || typeof advancementPlan !== "object") {
    throw new Error("El Advancement Plan es requerido.");
  }

  const matchId = typeof advancementPlan.matchId === "string"
    ? advancementPlan.matchId.trim()
    : "";
  const winnerId = typeof advancementPlan.winner?.entryId === "string"
    ? advancementPlan.winner.entryId.trim()
    : "";

  if (!matchId) {
    throw new Error("El Advancement Plan requiere matchId.");
  }

  if (!winnerId) {
    throw new Error("El Advancement Plan requiere winnerId.");
  }

  const match = validateMatchStateInBracket(
    bracket,
    matchId,
    "result"
  );

  validateMatchWinner(match, winnerId);

  return applyMatchResult(
    bracket,
    matchId,
    winnerId,
    score
  );
}

/**
 * Applies a Match result through the existing competition engine.
 *
 * The Core now has an explicit two-step boundary: first it decides the
 * advancement plan, then it applies that plan through the existing engine.
 * This keeps future clients (Tournament Operations, API, etc.) on the same
 * advancement path without creating a second bracket engine.
 */
export function applyMatchResultCommand(bracket, command) {
  const normalizedCommand = normalizeMatchResultCommand(command);
  const advancementPlan = createAdvancementPlan(
    bracket,
    normalizedCommand
  );

  const nextBracket = applyAdvancementPlan(
    bracket,
    advancementPlan,
    { score: normalizedCommand.score }
  );

  const completedMatch = findMatch(
    nextBracket,
    normalizedCommand.matchId
  );

  const acceptedResult = {
    matchId: normalizedCommand.matchId,
    winnerId: completedMatch?.winnerId || normalizedCommand.winnerId,
    loserId: completedMatch?.loserId || null,
    result: {
      winnerId: completedMatch?.winnerId || normalizedCommand.winnerId,
      loserId: completedMatch?.loserId || null,
      score: normalizedCommand.score ?? null
    },
    lifecycle: completedMatch
      ? getMatchLifecycle(completedMatch)
      : MATCH_LIFECYCLE.COMPLETED,
    source: normalizedCommand.source || "TOURNAMENT_PRO"
  };

  return {
    bracket: nextBracket,
    result: acceptedResult,
    advancementPlan
  };
}
