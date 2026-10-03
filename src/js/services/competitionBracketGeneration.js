// ========================================
// ARKHAM — Competition Bracket Generation
// ========================================
//
// Bracket Generation Engine v1.
//
// This module consumes the read-only Bracket Blueprint produced by
// competitionCore.js and materializes an in-memory Match structure.
//
// IMPORTANT:
// - No Firebase writes.
// - No Tournament Pro mutation.
// - No replacement of generateBracket().
// - No Operations integration.
// - No automatic BYE calculation.
//
// The purpose of V1 is to make the generated structure inspectable before
// any persistence or operational migration is considered.
// ========================================

import {
  BRACKET_BLUEPRINT_STATUS,
  generateCompetitionBracketBlueprint
} from "./competitionCore.js";

export const BRACKET_GENERATION_STATUS = {
  READY: "READY",
  INCOMPLETE: "INCOMPLETE",
  CONFLICT: "CONFLICT",
  INVALID: "INVALID",
  UNSUPPORTED: "UNSUPPORTED"
};

export const BRACKET_GENERATION_SOURCES = {
  BLUEPRINT: "BLUEPRINT"
};

function normalizeGenerationStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return Object.values(BRACKET_GENERATION_STATUS).includes(normalized)
    ? normalized
    : BRACKET_GENERATION_STATUS.INCOMPLETE;
}

function mapBlueprintStatus(status) {
  switch (status) {
    case BRACKET_BLUEPRINT_STATUS.READY:
      return BRACKET_GENERATION_STATUS.READY;
    case BRACKET_BLUEPRINT_STATUS.CONFLICT:
      return BRACKET_GENERATION_STATUS.CONFLICT;
    case BRACKET_BLUEPRINT_STATUS.INVALID:
      return BRACKET_GENERATION_STATUS.INVALID;
    case BRACKET_BLUEPRINT_STATUS.UNSUPPORTED:
      return BRACKET_GENERATION_STATUS.UNSUPPORTED;
    case BRACKET_BLUEPRINT_STATUS.INCOMPLETE:
    default:
      return BRACKET_GENERATION_STATUS.INCOMPLETE;
  }
}

function normalizeParticipant(participant = null) {
  if (!participant || typeof participant !== "object") return null;

  return {
    entryId: participant.entryId ?? null,
    participantId: participant.participantId ?? null,
    seed: participant.seed ?? null,
    displayName: participant.displayName ?? null
  };
}

function createMatchFromBlueprint(blueprintMatch = {}) {
  const participants = Array.isArray(blueprintMatch.participants)
    ? blueprintMatch.participants.map(normalizeParticipant)
    : [];

  const participantA = participants[0] || null;
  const participantB = participants[1] || null;

  return {
    id: blueprintMatch.id || null,
    competitionId: blueprintMatch.competitionId ?? null,
    phaseId: blueprintMatch.phaseId ?? null,
    phaseGroupId: blueprintMatch.phaseGroupId ?? null,
    structureId: blueprintMatch.structureId ?? null,
    roundId: blueprintMatch.roundId ?? null,
    round: blueprintMatch.round ?? null,
    roundOrder: blueprintMatch.roundOrder ?? null,
    bracket: blueprintMatch.bracket ?? null,
    order: blueprintMatch.order ?? null,
    status: participantA?.entryId && participantB?.entryId ? "READY" : "PENDING",
    participants: {
      A: participantA,
      B: participantB
    },
    entryAId: participantA?.entryId ?? null,
    entryBId: participantB?.entryId ?? null,
    participantAId: participantA?.participantId ?? null,
    participantBId: participantB?.participantId ?? null,
    winnerEntryId: null,
    loserEntryId: null,
    winnerId: null,
    loserId: null,
    games: [],
    result: null,
    advancement: {
      winnerDestination: blueprintMatch.advancement?.winnerDestination || blueprintMatch.winnerDestination || null,
      loserDestination: blueprintMatch.advancement?.loserDestination || blueprintMatch.loserDestination || null
    },
    source: BRACKET_GENERATION_SOURCES.BLUEPRINT
  };
}

function buildRoundIndex(rounds = []) {
  return new Map(
    rounds
      .filter((round) => round?.id)
      .map((round) => [round.id, round])
  );
}

function buildMatchIndex(matches = []) {
  return new Map(
    matches
      .filter((match) => match?.id)
      .map((match) => [match.id, match])
  );
}

/**
 * Builds deterministic Winner → next Match routes inside the same bracket.
 *
 * The route is inferred only when two consecutive rounds are structurally
 * compatible. This keeps V1 deterministic without inventing Double
 * Elimination loser-routing rules that are not present in the Blueprint.
 */
function resolveWinnerRoutes(generatedMatches, blueprintRounds) {
  const routes = [];
  const roundsById = buildRoundIndex(blueprintRounds);
  const matchesByRound = new Map();

  generatedMatches.forEach((match) => {
    const destination = match.advancement?.winnerDestination;
    if (!destination?.matchId) return;
    routes.push({
      sourceMatchId: match.id,
      type: "WINNER",
      destinationMatchId: destination.matchId,
      destinationSlot: destination.slot || null
    });
  });

  generatedMatches.forEach((match) => {
    if (!match.roundId) return;
    if (!matchesByRound.has(match.roundId)) {
      matchesByRound.set(match.roundId, []);
    }
    matchesByRound.get(match.roundId).push(match);
  });

  matchesByRound.forEach((roundMatches, roundId) => {
    const round = roundsById.get(roundId);
    if (!round) return;

    const sameBracketNextRound = blueprintRounds
      .filter((candidate) =>
        candidate?.bracket === round.bracket &&
        Number(candidate?.order) > Number(round?.order)
      )
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))[0] || null;

    if (!sameBracketNextRound) return;

    const nextMatches = matchesByRound.get(sameBracketNextRound.id) || [];

    roundMatches
      .slice()
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .forEach((match, index) => {
        if (match.advancement.winnerDestination?.matchId) return;
        const destination = nextMatches[Math.floor(index / 2)] || null;
        if (!destination) return;

        const slot = index % 2 === 0 ? "A" : "B";
        match.advancement.winnerDestination = {
          matchId: destination.id,
          slot,
          reason: "WINNER_ADVANCEMENT"
        };

        routes.push({
          sourceMatchId: match.id,
          type: "WINNER",
          destinationMatchId: destination.id,
          destinationSlot: slot
        });
      });
  });

  return routes;
}

/**
 * Preserves explicit loser-route metadata if the Blueprint already provides it.
 * V1 never invents a Double Elimination loser bracket mapping.
 */
function resolveExplicitLoserRoutes(generatedMatches, blueprintMatches = []) {
  const blueprintById = buildMatchIndex(blueprintMatches);
  const routes = [];

  generatedMatches.forEach((match) => {
    const blueprintMatch = blueprintById.get(match.id);
    const destination = blueprintMatch?.advancement?.loserDestination ||
      blueprintMatch?.loserDestination ||
      null;

    if (!destination?.matchId) return;

    match.advancement.loserDestination = {
      matchId: destination.matchId,
      slot: destination.slot || null,
      reason: destination.reason || "LOSER_ROUTE"
    };

    routes.push({
      sourceMatchId: match.id,
      type: "LOSER",
      destinationMatchId: destination.matchId,
      destinationSlot: destination.slot || null
    });
  });

  return routes;
}

function validateGeneratedMatches(matches = []) {
  const reasonCodes = [];
  const ids = new Set();

  matches.forEach((match) => {
    if (!match.id) {
      reasonCodes.push("MATCH_ID_MISSING");
      return;
    }

    if (ids.has(match.id)) {
      reasonCodes.push("DUPLICATE_MATCH_ID");
    }

    ids.add(match.id);

    if (!match.structureId) reasonCodes.push("STRUCTURE_ID_MISSING");
    if (!match.roundId) reasonCodes.push("ROUND_ID_MISSING");
  });

  return [...new Set(reasonCodes)];
}

/**
 * Generates an in-memory Match structure from an existing Bracket Blueprint.
 *
 * If `options.blueprint` is supplied, it is consumed directly. Otherwise the
 * function asks Competition Core to generate the Blueprint first.
 *
 * The returned object is safe to inspect, compare and test. It is not a
 * persistence command and it must not be passed to Firebase as-is.
 */
export function generateCompetitionBracket(event = {}, options = {}) {
  const blueprint = options.blueprint || generateCompetitionBracketBlueprint(event, options);

  if (!blueprint || typeof blueprint !== "object") {
    return {
      status: BRACKET_GENERATION_STATUS.INVALID,
      reasonCodes: ["BLUEPRINT_INVALID"],
      source: BRACKET_GENERATION_SOURCES.BLUEPRINT,
      blueprint: null,
      matches: [],
      rounds: [],
      routes: [],
      summary: {
        roundCount: 0,
        matchCount: 0,
        readyMatches: 0,
        pendingMatches: 0,
        winnerRoutes: 0,
        loserRoutes: 0
      }
    };
  }

  const mappedBlueprintStatus = mapBlueprintStatus(blueprint.status);
  const reasonCodes = Array.isArray(blueprint.reasonCodes)
    ? [...blueprint.reasonCodes]
    : [];

  if (mappedBlueprintStatus !== BRACKET_GENERATION_STATUS.READY) {
    return {
      status: normalizeGenerationStatus(mappedBlueprintStatus),
      reasonCodes: [...new Set(reasonCodes)],
      source: BRACKET_GENERATION_SOURCES.BLUEPRINT,
      blueprint,
      matches: [],
      rounds: [],
      routes: [],
      summary: {
        roundCount: 0,
        matchCount: 0,
        readyMatches: 0,
        pendingMatches: 0,
        winnerRoutes: 0,
        loserRoutes: 0
      }
    };
  }

  const blueprintRounds = Array.isArray(blueprint.rounds)
    ? blueprint.rounds
    : [];
  const blueprintMatches = Array.isArray(blueprint.matches)
    ? blueprint.matches
    : [];

  const matches = blueprintMatches.map((match) => createMatchFromBlueprint(match));
  const validationCodes = validateGeneratedMatches(matches);
  reasonCodes.push(...validationCodes);

  const winnerRoutes = resolveWinnerRoutes(matches, blueprintRounds);
  const loserRoutes = resolveExplicitLoserRoutes(matches, blueprintMatches);
  const routes = [...winnerRoutes, ...loserRoutes];

  const rounds = blueprintRounds.map((round) => ({
    id: round.id || null,
    name: round.name || "Round",
    order: round.order ?? null,
    number: round.number ?? null,
    type: round.type || null,
    bracket: round.bracket || null,
    phaseId: round.phaseId || null,
    phaseGroupId: round.phaseGroupId || null,
    structureId: round.structureId || null,
    matchIds: matches
      .filter((match) => match.roundId === round.id)
      .map((match) => match.id),
    source: BRACKET_GENERATION_SOURCES.BLUEPRINT
  }));

  const status = validationCodes.length
    ? BRACKET_GENERATION_STATUS.INVALID
    : BRACKET_GENERATION_STATUS.READY;

  return {
    status,
    reasonCodes: [...new Set(reasonCodes)],
    source: BRACKET_GENERATION_SOURCES.BLUEPRINT,
    blueprint,
    structure: blueprint.structure || null,
    rounds,
    matches,
    routes,
    summary: {
      roundCount: rounds.length,
      matchCount: matches.length,
      readyMatches: matches.filter((match) => match.status === "READY").length,
      pendingMatches: matches.filter((match) => match.status === "PENDING").length,
      winnerRoutes: winnerRoutes.length,
      loserRoutes: loserRoutes.length
    }
  };
}

/**
 * Generates the Match structure and returns only a compact comparison summary.
 * Useful for development tooling without exposing the full generated graph.
 */
export function getCompetitionBracketGenerationSummary(event = {}, options = {}) {
  const generated = generateCompetitionBracket(event, options);

  return {
    status: generated.status,
    reasonCodes: generated.reasonCodes,
    roundCount: generated.summary.roundCount,
    matchCount: generated.summary.matchCount,
    readyMatches: generated.summary.readyMatches,
    pendingMatches: generated.summary.pendingMatches,
    winnerRoutes: generated.summary.winnerRoutes,
    loserRoutes: generated.summary.loserRoutes
  };
}

/**
 * Returns whether the generated graph is safe to compare with the current
 * operational bracket. This is intentionally not a persistence permission.
 */
export function canCompareCompetitionBracketGeneration(generated = {}) {
  return Boolean(
    generated &&
    generated.status === BRACKET_GENERATION_STATUS.READY &&
    Array.isArray(generated.matches) &&
    Array.isArray(generated.routes)
  );
}
