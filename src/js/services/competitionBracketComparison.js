// ========================================
// ARKHAM — Competition Bracket Comparison
// ========================================
//
// Bracket Comparison Engine v1.
//
// Compares the current operational bracket representation against the
// read-only Bracket Generation Engine output.
//
// IMPORTANT:
// - No Firebase writes.
// - No Tournament Pro mutation.
// - No replacement of generateBracket().
// - No Operations integration.
// - No Match mutation.
// - Legacy representation differences are reported separately.
//
// V1 is an audit/verification layer. It does not decide which bracket is
// correct and it does not migrate data.
// ========================================

import {
  BRACKET_GENERATION_STATUS,
  generateCompetitionBracket
} from "./competitionBracketGeneration.js";

export const BRACKET_COMPARISON_STATUS = {
  MATCH: "MATCH",
  DIFFERENCES: "DIFFERENCES",
  CURRENT_ONLY: "CURRENT_ONLY",
  GENERATED_ONLY: "GENERATED_ONLY",
  INVALID: "INVALID",
  UNSUPPORTED: "UNSUPPORTED"
};

export const BRACKET_COMPARISON_CODES = {
  MATCH_EQUIVALENT: "MATCH_EQUIVALENT",
  LEGACY_REPRESENTATION_ONLY: "LEGACY_REPRESENTATION_ONLY",
  PARTICIPANT_MISMATCH: "PARTICIPANT_MISMATCH",
  ENTRY_ID_MISMATCH: "ENTRY_ID_MISMATCH",
  PARTICIPANT_ID_MISMATCH: "PARTICIPANT_ID_MISMATCH",
  ROUND_MISMATCH: "ROUND_MISMATCH",
  PHASE_MISMATCH: "PHASE_MISMATCH",
  PHASE_GROUP_MISMATCH: "PHASE_GROUP_MISMATCH",
  STRUCTURE_MISMATCH: "STRUCTURE_MISMATCH",
  POSITION_MISMATCH: "POSITION_MISMATCH",
  BRACKET_MISMATCH: "BRACKET_MISMATCH",
  WINNER_ROUTE_MISMATCH: "WINNER_ROUTE_MISMATCH",
  LOSER_ROUTE_MISMATCH: "LOSER_ROUTE_MISMATCH",
  MATCH_ID_MISSING: "MATCH_ID_MISSING",
  DUPLICATE_MATCH_ID: "DUPLICATE_MATCH_ID",
  GENERATION_NOT_READY: "GENERATION_NOT_READY",
  CURRENT_BRACKET_MISSING: "CURRENT_BRACKET_MISSING"
};

function normalizeValue(value) {
  if (value === undefined || value === "") return null;
  return value;
}

function normalizeParticipant(participant = null) {
  if (!participant || typeof participant !== "object") return null;

  return {
    entryId: normalizeValue(participant.entryId),
    participantId: normalizeValue(participant.participantId),
    seed: normalizeValue(participant.seed),
    displayName: normalizeValue(participant.displayName)
  };
}

function getParticipant(match, side) {
  const participants = match?.participants;

  if (participants && typeof participants === "object" && !Array.isArray(participants)) {
    return normalizeParticipant(participants[side] || null);
  }

  const index = side === "A" ? 0 : 1;
  if (Array.isArray(participants)) {
    return normalizeParticipant(participants[index] || null);
  }

  return normalizeParticipant({
    entryId: side === "A" ? match?.entryAId : match?.entryBId,
    participantId: side === "A" ? match?.participantAId : match?.participantBId,
    seed: side === "A" ? match?.seedA : match?.seedB,
    displayName: side === "A" ? match?.participantAName : match?.participantBName
  });
}

function normalizeMatch(match = {}) {
  const participantA = getParticipant(match, "A");
  const participantB = getParticipant(match, "B");

  return {
    id: normalizeValue(match.id),
    competitionId: normalizeValue(match.competitionId),
    phaseId: normalizeValue(match.phaseId),
    phaseGroupId: normalizeValue(match.phaseGroupId),
    structureId: normalizeValue(match.structureId),
    roundId: normalizeValue(match.roundId),
    round: normalizeValue(match.round),
    roundOrder: normalizeValue(match.roundOrder),
    order: normalizeValue(match.order),
    bracket: normalizeValue(match.bracket),
    participantA,
    participantB,
    entryAId: participantA?.entryId ?? normalizeValue(match.entryAId),
    entryBId: participantB?.entryId ?? normalizeValue(match.entryBId),
    participantAId: participantA?.participantId ?? normalizeValue(match.participantAId),
    participantBId: participantB?.participantId ?? normalizeValue(match.participantBId),
    advancement: {
      winnerDestination: normalizeDestination(
        match?.advancement?.winnerDestination ||
        match?.winnerDestination ||
        (match?.nextMatchId
          ? { matchId: match.nextMatchId, slot: match.nextSlot || null, reason: "WINNER_ADVANCEMENT" }
          : null)
      ),
      loserDestination: normalizeDestination(
        match?.advancement?.loserDestination ||
        match?.loserDestination ||
        match?.loserRoute ||
        null
      )
    }
  };
}

function normalizeDestination(destination = null) {
  if (!destination || typeof destination !== "object") return null;

  return {
    matchId: normalizeValue(destination.matchId),
    slot: normalizeValue(destination.slot),
    reason: normalizeValue(destination.reason)
  };
}

function extractCurrentMatches(currentBracket, event = {}, generatedMatches = []) {
  const generatedById = new Map(
    generatedMatches.filter((match) => match?.id).map((match) => [match.id, match])
  );
  const entriesByParticipantId = new Map(
    Object.values(event?.pro?.entries || {})
      .filter((entry) => entry?.legacyParticipantId && entry?.id)
      .map((entry) => [entry.legacyParticipantId, entry.id])
  );
  const enrich = (match, stage = null, stageIndex = null) => {
    const generated = generatedById.get(match?.id) || {};
    return {
      ...match,
      phaseId: match?.phaseId ?? stage?.phaseId ?? generated.phaseId ?? null,
      phaseGroupId: match?.phaseGroupId ?? stage?.phaseGroupId ?? generated.phaseGroupId ?? null,
      structureId: match?.structureId ?? stage?.structureId ?? generated.structureId ?? null,
      roundId: match?.roundId ?? stage?.id ?? generated.roundId ?? null,
      round: match?.round ?? stage?.number ?? generated.round ?? null,
      roundOrder: match?.roundOrder ?? stage?.number ?? generated.roundOrder ?? (stageIndex == null ? null : stageIndex + 1),
      order: match?.order ?? match?.position ?? generated.order ?? null,
      bracket: match?.bracket ?? stage?.bracket ?? generated.bracket ?? null,
      entryAId: match?.entryAId ?? entriesByParticipantId.get(match?.participantAId) ?? null,
      entryBId: match?.entryBId ?? entriesByParticipantId.get(match?.participantBId) ?? null
    };
  };
  const currentStages = Array.isArray(currentBracket?.bracket?.stages)
    ? currentBracket.bracket.stages
    : Array.isArray(currentBracket?.stages)
      ? currentBracket.stages
      : null;

  if (currentStages) {
    return currentStages.flatMap((stage, index) =>
      (Array.isArray(stage?.matches) ? stage.matches : [])
        .map((match) => enrich(match, stage, index))
    );
  }

  if (Array.isArray(currentBracket)) return currentBracket.map((match) => enrich(match));
  if (Array.isArray(currentBracket?.matches)) return currentBracket.matches.map((match) => enrich(match));
  if (Array.isArray(currentBracket?.bracket?.matches)) return currentBracket.bracket.matches.map((match) => enrich(match));

  return [];
}

function extractGeneratedMatches(generated) {
  return Array.isArray(generated?.matches) ? generated.matches : [];
}

function buildMatchIndex(matches = []) {
  const index = new Map();
  const duplicateIds = new Set();

  matches.forEach((rawMatch) => {
    const match = normalizeMatch(rawMatch);

    if (!match.id) return;

    if (index.has(match.id)) {
      duplicateIds.add(match.id);
      return;
    }

    index.set(match.id, match);
  });

  return { index, duplicateIds };
}

function sameValue(a, b) {
  return normalizeValue(a) === normalizeValue(b);
}

function compareParticipant(current, generated, side) {
  const differences = [];

  if (!sameValue(current?.entryId, generated?.entryId)) {
    differences.push({
      code: BRACKET_COMPARISON_CODES.ENTRY_ID_MISMATCH,
      side,
      current: current?.entryId ?? null,
      generated: generated?.entryId ?? null
    });
  }

  if (!sameValue(current?.participantId, generated?.participantId)) {
    differences.push({
      code: BRACKET_COMPARISON_CODES.PARTICIPANT_ID_MISMATCH,
      side,
      current: current?.participantId ?? null,
      generated: generated?.participantId ?? null
    });
  }

  const hasComparableIdentity =
    current?.entryId != null ||
    generated?.entryId != null ||
    current?.participantId != null ||
    generated?.participantId != null;

  if (
    hasComparableIdentity &&
    differences.some((difference) =>
      [
        BRACKET_COMPARISON_CODES.ENTRY_ID_MISMATCH,
        BRACKET_COMPARISON_CODES.PARTICIPANT_ID_MISMATCH
      ].includes(difference.code)
    )
  ) {
    differences.push({
      code: BRACKET_COMPARISON_CODES.PARTICIPANT_MISMATCH,
      side
    });
  }

  return differences;
}

function compareDestination(current, generated, code) {
  const currentDestination = normalizeDestination(current);
  const generatedDestination = normalizeDestination(generated);

  if (
    sameValue(currentDestination?.matchId, generatedDestination?.matchId) &&
    sameValue(currentDestination?.slot, generatedDestination?.slot)
  ) {
    return null;
  }

  return {
    code,
    current: currentDestination,
    generated: generatedDestination
  };
}

function compareMatch(currentRaw, generatedRaw) {
  const current = normalizeMatch(currentRaw);
  const generated = normalizeMatch(generatedRaw);
  const differences = [];

  const directFields = [
    ["competitionId", null],
    ["phaseId", BRACKET_COMPARISON_CODES.PHASE_MISMATCH],
    ["phaseGroupId", BRACKET_COMPARISON_CODES.PHASE_GROUP_MISMATCH],
    ["structureId", BRACKET_COMPARISON_CODES.STRUCTURE_MISMATCH],
    ["roundId", BRACKET_COMPARISON_CODES.ROUND_MISMATCH],
    ["round", BRACKET_COMPARISON_CODES.ROUND_MISMATCH],
    ["roundOrder", BRACKET_COMPARISON_CODES.ROUND_MISMATCH],
    ["order", BRACKET_COMPARISON_CODES.POSITION_MISMATCH],
    ["bracket", BRACKET_COMPARISON_CODES.BRACKET_MISMATCH]
  ];

  directFields.forEach(([field, code]) => {
    if (!sameValue(current[field], generated[field]) && code) {
      differences.push({
        code,
        field,
        current: current[field] ?? null,
        generated: generated[field] ?? null
      });
    }
  });

  differences.push(...compareParticipant(current.participantA, generated.participantA, "A"));
  differences.push(...compareParticipant(current.participantB, generated.participantB, "B"));

  const winnerDifference = compareDestination(
    current.advancement.winnerDestination,
    generated.advancement.winnerDestination,
    BRACKET_COMPARISON_CODES.WINNER_ROUTE_MISMATCH
  );

  if (winnerDifference) differences.push(winnerDifference);

  const loserDifference = compareDestination(
    current.advancement.loserDestination,
    generated.advancement.loserDestination,
    BRACKET_COMPARISON_CODES.LOSER_ROUTE_MISMATCH
  );

  if (loserDifference) differences.push(loserDifference);

  const onlyLegacyRepresentation =
    differences.length > 0 &&
    differences.every((difference) => {
      if (difference.code === BRACKET_COMPARISON_CODES.ROUND_MISMATCH) {
        return (
          difference.field === "round" &&
          sameValue(current.roundId, generated.roundId)
        );
      }

      if (difference.code === BRACKET_COMPARISON_CODES.PARTICIPANT_ID_MISMATCH) {
        return (
          current.entryAId == null &&
          current.entryBId == null &&
          generated.entryAId != null &&
          generated.entryBId != null
        );
      }

      return false;
    });

  if (onlyLegacyRepresentation) {
    differences.push({
      code: BRACKET_COMPARISON_CODES.LEGACY_REPRESENTATION_ONLY
    });
  }

  return {
    id: current.id || generated.id || null,
    equivalent: differences.length === 0 || onlyLegacyRepresentation,
    legacyRepresentationOnly: onlyLegacyRepresentation,
    differences
  };
}

function collectRouteIndex(matches = []) {
  const routes = [];

  matches.forEach((rawMatch) => {
    const match = normalizeMatch(rawMatch);

    if (match.advancement.winnerDestination?.matchId) {
      routes.push({
        sourceMatchId: match.id,
        type: "WINNER",
        destinationMatchId: match.advancement.winnerDestination.matchId,
        destinationSlot: match.advancement.winnerDestination.slot
      });
    }

    if (match.advancement.loserDestination?.matchId) {
      routes.push({
        sourceMatchId: match.id,
        type: "LOSER",
        destinationMatchId: match.advancement.loserDestination.matchId,
        destinationSlot: match.advancement.loserDestination.slot
      });
    }
  });

  return routes;
}

function compareRouteSets(currentMatches, generatedMatches) {
  const currentRoutes = collectRouteIndex(currentMatches);
  const generatedRoutes = collectRouteIndex(generatedMatches);

  const routeKey = (route) =>
    [
      route.sourceMatchId,
      route.type,
      route.destinationMatchId,
      route.destinationSlot
    ].map((value) => value ?? "").join("|");

  const currentSet = new Map(currentRoutes.map((route) => [routeKey(route), route]));
  const generatedSet = new Map(generatedRoutes.map((route) => [routeKey(route), route]));

  const currentOnly = currentRoutes.filter((route) => !generatedSet.has(routeKey(route)));
  const generatedOnly = generatedRoutes.filter((route) => !currentSet.has(routeKey(route)));

  return {
    currentRoutes,
    generatedRoutes,
    currentOnly,
    generatedOnly,
    winnerMismatches: [
      ...currentOnly.filter((route) => route.type === "WINNER"),
      ...generatedOnly.filter((route) => route.type === "WINNER")
    ],
    loserMismatches: [
      ...currentOnly.filter((route) => route.type === "LOSER"),
      ...generatedOnly.filter((route) => route.type === "LOSER")
    ]
  };
}

function buildReasonCodes(comparisons, currentOnly, generatedOnly, routeComparison) {
  const codes = [];

  if (currentOnly.length) codes.push(BRACKET_COMPARISON_CODES.CURRENT_ONLY);
  if (generatedOnly.length) codes.push(BRACKET_COMPARISON_CODES.GENERATED_ONLY);

  comparisons.forEach((comparison) => {
    comparison.differences.forEach((difference) => {
      if (difference.code !== BRACKET_COMPARISON_CODES.LEGACY_REPRESENTATION_ONLY) {
        codes.push(difference.code);
      }
    });
  });

  if (routeComparison.winnerMismatches.length) {
    codes.push(BRACKET_COMPARISON_CODES.WINNER_ROUTE_MISMATCH);
  }

  if (routeComparison.loserMismatches.length) {
    codes.push(BRACKET_COMPARISON_CODES.LOSER_ROUTE_MISMATCH);
  }

  return [...new Set(codes)];
}

function summarize(comparisons, currentOnly, generatedOnly, routeComparison) {
  return {
    currentMatchCount: comparisons.length + currentOnly.length,
    generatedMatchCount: comparisons.length + generatedOnly.length,
    equivalentMatches: comparisons.filter((comparison) => comparison.equivalent).length,
    currentOnly: currentOnly.length,
    generatedOnly: generatedOnly.length,
    identityMismatches: comparisons.filter((comparison) =>
      comparison.differences.some((difference) =>
        [
          BRACKET_COMPARISON_CODES.ENTRY_ID_MISMATCH,
          BRACKET_COMPARISON_CODES.PARTICIPANT_ID_MISMATCH,
          BRACKET_COMPARISON_CODES.PARTICIPANT_MISMATCH
        ].includes(difference.code)
      )
    ).length,
    roundMismatches: comparisons.filter((comparison) =>
      comparison.differences.some((difference) =>
        difference.code === BRACKET_COMPARISON_CODES.ROUND_MISMATCH
      )
    ).length,
    participantMismatches: comparisons.filter((comparison) =>
      comparison.differences.some((difference) =>
        difference.code === BRACKET_COMPARISON_CODES.PARTICIPANT_MISMATCH
      )
    ).length,
    winnerRouteMismatches: routeComparison.winnerMismatches.length,
    loserRouteMismatches: routeComparison.loserMismatches.length,
    structureMismatches: comparisons.filter((comparison) =>
      comparison.differences.some((difference) =>
        difference.code === BRACKET_COMPARISON_CODES.STRUCTURE_MISMATCH
      )
    ).length,
    phaseMismatches: comparisons.filter((comparison) =>
      comparison.differences.some((difference) =>
        [
          BRACKET_COMPARISON_CODES.PHASE_MISMATCH,
          BRACKET_COMPARISON_CODES.PHASE_GROUP_MISMATCH
        ].includes(difference.code)
      )
    ).length,
    legacyRepresentationOnly: comparisons.filter(
      (comparison) => comparison.legacyRepresentationOnly
    ).length
  };
}

/**
 * Compares the current operational bracket against a generated bracket.
 *
 * Expected input:
 *   compareCompetitionBrackets(event, {
 *     currentBracket: currentOperationalBracket
 *   })
 *
 * The current bracket is supplied by the caller because V1 intentionally does
 * not reach into Tournament Pro state or Firebase.
 */
export function compareCompetitionBrackets(event = {}, options = {}) {
  const currentBracket = options.currentBracket ?? null;

  if (!currentBracket) {
    return {
      status: BRACKET_COMPARISON_STATUS.INVALID,
      reasonCodes: [BRACKET_COMPARISON_CODES.CURRENT_BRACKET_MISSING],
      generation: null,
      matches: [],
      currentOnly: [],
      generatedOnly: [],
      routes: {
        current: [],
        generated: [],
        currentOnly: [],
        generatedOnly: []
      },
      summary: {
        currentMatchCount: 0,
        generatedMatchCount: 0,
        equivalentMatches: 0,
        currentOnly: 0,
        generatedOnly: 0,
        identityMismatches: 0,
        roundMismatches: 0,
        participantMismatches: 0,
        winnerRouteMismatches: 0,
        loserRouteMismatches: 0,
        structureMismatches: 0,
        phaseMismatches: 0,
        legacyRepresentationOnly: 0
      }
    };
  }

  const generation = options.generated ||
    generateCompetitionBracket(event, options);

  if (!generation || generation.status !== BRACKET_GENERATION_STATUS.READY) {
    return {
      status:
        generation?.status === BRACKET_GENERATION_STATUS.UNSUPPORTED
          ? BRACKET_COMPARISON_STATUS.UNSUPPORTED
          : BRACKET_COMPARISON_STATUS.INVALID,
      reasonCodes: [
        BRACKET_COMPARISON_CODES.GENERATION_NOT_READY,
        ...(Array.isArray(generation?.reasonCodes) ? generation.reasonCodes : [])
      ],
      generation,
      matches: [],
      currentOnly: [],
      generatedOnly: [],
      routes: {
        current: [],
        generated: [],
        currentOnly: [],
        generatedOnly: []
      },
      summary: {
        currentMatchCount: 0,
        generatedMatchCount: 0,
        equivalentMatches: 0,
        currentOnly: 0,
        generatedOnly: 0,
        identityMismatches: 0,
        roundMismatches: 0,
        participantMismatches: 0,
        winnerRouteMismatches: 0,
        loserRouteMismatches: 0,
        structureMismatches: 0,
        phaseMismatches: 0,
        legacyRepresentationOnly: 0
      }
    };
  }

  const generatedMatches = extractGeneratedMatches(generation);
  const currentMatches = extractCurrentMatches(currentBracket, event, generatedMatches);

  const currentIndex = buildMatchIndex(currentMatches);
  const generatedIndex = buildMatchIndex(generatedMatches);

  const comparisons = [];
  const currentOnly = [];
  const generatedOnly = [];

  currentIndex.index.forEach((currentMatch, id) => {
    const generatedMatch = generatedIndex.index.get(id);

    if (!generatedMatch) {
      currentOnly.push(currentMatch);
      return;
    }

    comparisons.push(compareMatch(currentMatch, generatedMatch));
  });

  generatedIndex.index.forEach((generatedMatch, id) => {
    if (!currentIndex.index.has(id)) {
      generatedOnly.push(generatedMatch);
    }
  });

  const routeComparison = compareRouteSets(currentMatches, generatedMatches);
  const reasonCodes = buildReasonCodes(
    comparisons,
    currentOnly,
    generatedOnly,
    routeComparison
  );

  const hasBlockingDifferences =
    currentOnly.length > 0 ||
    generatedOnly.length > 0 ||
    comparisons.some((comparison) =>
      comparison.differences.some(
        (difference) =>
          difference.code !== BRACKET_COMPARISON_CODES.LEGACY_REPRESENTATION_ONLY
      )
    ) ||
    routeComparison.winnerMismatches.length > 0 ||
    routeComparison.loserMismatches.length > 0;

  return {
    status: hasBlockingDifferences
      ? BRACKET_COMPARISON_STATUS.DIFFERENCES
      : BRACKET_COMPARISON_STATUS.MATCH,
    reasonCodes:
      reasonCodes.length > 0
        ? reasonCodes
        : [BRACKET_COMPARISON_CODES.MATCH_EQUIVALENT],
    generation,
    matches: comparisons,
    currentOnly,
    generatedOnly,
    routes: {
      current: routeComparison.currentRoutes,
      generated: routeComparison.generatedRoutes,
      currentOnly: routeComparison.currentOnly,
      generatedOnly: routeComparison.generatedOnly
    },
    summary: summarize(
      comparisons,
      currentOnly,
      generatedOnly,
      routeComparison
    )
  };
}

/**
 * Compact development summary.
 */
export function getCompetitionBracketComparisonSummary(event = {}, options = {}) {
  const comparison = compareCompetitionBrackets(event, options);

  return {
    status: comparison.status,
    reasonCodes: comparison.reasonCodes,
    ...comparison.summary
  };
}

/**
 * Returns true only when the comparison completed and found no structural
 * differences other than explicitly classified legacy representation noise.
 */
export function isCompetitionBracketEquivalent(comparison = {}) {
  return Boolean(
    comparison &&
    comparison.status === BRACKET_COMPARISON_STATUS.MATCH &&
    Array.isArray(comparison.matches) &&
    Array.isArray(comparison.currentOnly) &&
    Array.isArray(comparison.generatedOnly)
  );
}
