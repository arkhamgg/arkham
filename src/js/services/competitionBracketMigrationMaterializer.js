// ========================================
// ARKHAM — Competition Bracket Migration Materializer
// ========================================
//
// Bracket Migration Materializer v1.
//
// Converts the declarative Competition Core bracket graph into the legacy
// operational bracket shape consumed by Tournament Pro (stages[].matches).
//
// IMPORTANT:
// - No Firebase writes.
// - No Tournament Pro mutation.
// - No persistence.
// - Does not execute migration.
// - Returns a detached proposed bracket only.
//
// This adapter is intentionally placed before the future persistence layer.
// Directly persisting the flat generated Match graph would not be sufficient
// because the current operational engine still resolves Matches through
// legacy bracket stages.
// ========================================

export const BRACKET_MIGRATION_MATERIALIZER_STATUS = {
  READY: "READY",
  NO_CHANGE: "NO_CHANGE",
  BLOCKED: "BLOCKED",
  INVALID: "INVALID",
  UNSUPPORTED: "UNSUPPORTED"
};

export const BRACKET_MIGRATION_MATERIALIZER_CODES = {
  CURRENT_BRACKET_MISSING: "CURRENT_BRACKET_MISSING",
  GENERATED_BRACKET_MISSING: "GENERATED_BRACKET_MISSING",
  CURRENT_STAGES_MISSING: "CURRENT_STAGES_MISSING",
  GENERATED_MATCHES_MISSING: "GENERATED_MATCHES_MISSING",
  GENERATED_MATCH_INVALID: "GENERATED_MATCH_INVALID",
  GENERATED_MATCH_STATUS_UNSUPPORTED: "GENERATED_MATCH_STATUS_UNSUPPORTED",
  GENERATED_MATCH_DUPLICATE: "GENERATED_MATCH_DUPLICATE",
  GENERATED_ROUND_MISSING: "GENERATED_ROUND_MISSING",
  GENERATED_STAGE_UNRESOLVED: "GENERATED_STAGE_UNRESOLVED",
  STAGE_MATCH_COUNT_CHANGED: "STAGE_MATCH_COUNT_CHANGED",
  STAGE_COUNT_CHANGED: "STAGE_COUNT_CHANGED",
  MATERIALIZATION_FAILED: "MATERIALIZATION_FAILED",
  UNSUPPORTED_BRACKET_SHAPE: "UNSUPPORTED_BRACKET_SHAPE"
};

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function extractStages(bracket) {
  if (Array.isArray(bracket?.stages)) return bracket.stages;
  if (Array.isArray(bracket?.bracket?.stages)) return bracket.bracket.stages;
  return [];
}

function extractMatches(bracket) {
  if (Array.isArray(bracket)) return bracket;
  if (Array.isArray(bracket?.stages)) {
    return bracket.stages.flatMap((stage) =>
      Array.isArray(stage?.matches) ? stage.matches : []
    );
  }
  if (Array.isArray(bracket?.bracket?.stages)) {
    return bracket.bracket.stages.flatMap((stage) =>
      Array.isArray(stage?.matches) ? stage.matches : []
    );
  }
  if (Array.isArray(bracket?.matches)) return bracket.matches;
  if (Array.isArray(bracket?.bracket?.matches)) return bracket.bracket.matches;
  return [];
}

function normalizeBracketType(value) {
  return String(value || "").trim().toLowerCase();
}

function getMatchBracket(match) {
  return normalizeBracketType(match?.bracket || "winners");
}

function getMatchRoundNumber(match) {
  const candidates = [
    match?.round,
    match?.roundNumber,
    match?.roundOrder
  ];

  for (const candidate of candidates) {
    const number = Number(candidate);
    if (Number.isFinite(number) && number > 0) return number;
  }

  return null;
}

function getMatchRoundId(match) {
  return match?.roundId || null;
}

function getStageKey(stage) {
  return `${normalizeBracketType(stage?.bracket || "winners")}::${Number(stage?.number || 0)}`;
}

function getMatchKey(match) {
  return `${getMatchBracket(match)}::${getMatchRoundNumber(match) || "?"}`;
}

function normalizeGeneratedMatch(match) {
  if (!match || typeof match !== "object") return null;

  if (!match.id) return null;
  if (!getMatchRoundId(match) && !getMatchRoundNumber(match)) return null;

  return clone(match);
}

function normalizeOperationalMatchStatus(status) {
  switch (String(status || "").trim().toUpperCase()) {
    // READY and PENDING are Competition Core generation states. In the
    // persisted Tournament Pro model, both are represented by legacy PENDING;
    // readiness is derived from participant assignment by Match Lifecycle.
    case "READY":
    case "PENDING":
      return "pending";
    case "LIVE":
      return "live";
    case "COMPLETED":
      return "completed";
    case "BYE":
      return "bye";
    default:
      return null;
  }
}

function resolveStageForMatch(match, stages) {
  const roundId = getMatchRoundId(match);
  const roundNumber = getMatchRoundNumber(match);
  const bracket = getMatchBracket(match);

  if (roundId) {
    const byId = stages.find((stage) => String(stage?.id || "") === String(roundId));
    if (byId) return byId;
  }

  return stages.find((stage) => {
    return (
      normalizeBracketType(stage?.bracket || "winners") === bracket &&
      Number(stage?.number || 0) === Number(roundNumber || 0)
    );
  }) || null;
}

function materializeStageMatches(currentStage, generatedMatches) {
  const stage = clone(currentStage);
  stage.matches = generatedMatches.map((match, index) => ({
    ...match,
    round: match.round ?? stage.number,
    position: match.position ?? index + 1,
    bracket: match.bracket || stage.bracket || "winners"
  }));

  return stage;
}

/**
 * Materializes a generated Competition Core graph into the operational
 * `stages[].matches` representation.
 *
 * The current bracket is used as the structural shell so legacy metadata,
 * stage ordering and unrelated bracket fields survive the conversion.
 */
export function materializeCompetitionBracketForMigration(
  currentBracket = null,
  generatedBracket = null
) {
  if (!currentBracket) {
    return {
      status: BRACKET_MIGRATION_MATERIALIZER_STATUS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_MATERIALIZER_CODES.CURRENT_BRACKET_MISSING],
      materialized: false,
      bracket: null,
      beforeMatchCount: 0,
      afterMatchCount: 0
    };
  }

  if (!generatedBracket) {
    return {
      status: BRACKET_MIGRATION_MATERIALIZER_STATUS.BLOCKED,
      reasonCodes: [BRACKET_MIGRATION_MATERIALIZER_CODES.GENERATED_BRACKET_MISSING],
      materialized: false,
      bracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  const currentStages = extractStages(currentBracket);
  const generatedMatches = extractMatches(generatedBracket)
    .map(normalizeGeneratedMatch);

  const reasonCodes = [];

  if (!currentStages.length) {
    return {
      status: BRACKET_MIGRATION_MATERIALIZER_STATUS.UNSUPPORTED,
      reasonCodes: [BRACKET_MIGRATION_MATERIALIZER_CODES.CURRENT_STAGES_MISSING],
      materialized: false,
      bracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  if (!generatedMatches.length) {
    return {
      status: BRACKET_MIGRATION_MATERIALIZER_STATUS.INVALID,
      reasonCodes: [BRACKET_MIGRATION_MATERIALIZER_CODES.GENERATED_MATCHES_MISSING],
      materialized: false,
      bracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  if (generatedMatches.some((match) => !match)) {
    return {
      status: BRACKET_MIGRATION_MATERIALIZER_STATUS.INVALID,
      reasonCodes: [BRACKET_MIGRATION_MATERIALIZER_CODES.GENERATED_MATCH_INVALID],
      materialized: false,
      bracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  const unsupportedStatusMatches = generatedMatches
    .filter((match) => !normalizeOperationalMatchStatus(match.status))
    .map((match) => match.id);

  if (unsupportedStatusMatches.length) {
    return {
      status: BRACKET_MIGRATION_MATERIALIZER_STATUS.INVALID,
      reasonCodes: [BRACKET_MIGRATION_MATERIALIZER_CODES.GENERATED_MATCH_STATUS_UNSUPPORTED],
      materialized: false,
      bracket: null,
      unsupportedMatchIds: unsupportedStatusMatches,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  generatedMatches.forEach((match) => {
    match.status = normalizeOperationalMatchStatus(match.status);
  });

  const ids = generatedMatches.map((match) => String(match.id));
  if (new Set(ids).size !== ids.length) {
    return {
      status: BRACKET_MIGRATION_MATERIALIZER_STATUS.INVALID,
      reasonCodes: [BRACKET_MIGRATION_MATERIALIZER_CODES.GENERATED_MATCH_DUPLICATE],
      materialized: false,
      bracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  const grouped = new Map();

  for (const match of generatedMatches) {
    const roundId = getMatchRoundId(match);
    if (!roundId && !getMatchRoundNumber(match)) {
      reasonCodes.push(BRACKET_MIGRATION_MATERIALIZER_CODES.GENERATED_ROUND_MISSING);
      continue;
    }

    const key = getMatchKey(match);
    const bucket = grouped.get(key) || [];
    bucket.push(match);
    grouped.set(key, bucket);
  }

  if (reasonCodes.length) {
    return {
      status: BRACKET_MIGRATION_MATERIALIZER_STATUS.INVALID,
      reasonCodes: unique(reasonCodes),
      materialized: false,
      bracket: null,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  const stageMap = new Map();
  currentStages.forEach((stage) => stageMap.set(getStageKey(stage), stage));

  const consumedStageKeys = new Set();
  const unresolvedMatches = [];

  for (const match of generatedMatches) {
    const stage = resolveStageForMatch(match, currentStages);
    if (!stage) {
      unresolvedMatches.push(match.id);
    }
  }

  if (unresolvedMatches.length) {
    return {
      status: BRACKET_MIGRATION_MATERIALIZER_STATUS.INVALID,
      reasonCodes: [BRACKET_MIGRATION_MATERIALIZER_CODES.GENERATED_STAGE_UNRESOLVED],
      materialized: false,
      bracket: null,
      unresolvedMatchIds: unresolvedMatches,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: 0
    };
  }

  const materializedStages = currentStages.map((stage) => {
    const key = getStageKey(stage);
    const matches = grouped.get(key) || [];

    consumedStageKeys.add(key);

    if (matches.length !== (stage.matches?.length || 0)) {
      reasonCodes.push(BRACKET_MIGRATION_MATERIALIZER_CODES.STAGE_MATCH_COUNT_CHANGED);
    }

    return materializeStageMatches(stage, matches);
  });

  const unmatchedGeneratedStageKeys = [...grouped.keys()]
    .filter((key) => !stageMap.has(key));

  if (unmatchedGeneratedStageKeys.length) {
    reasonCodes.push(BRACKET_MIGRATION_MATERIALIZER_CODES.STAGE_COUNT_CHANGED);

    return {
      status: BRACKET_MIGRATION_MATERIALIZER_STATUS.BLOCKED,
      reasonCodes: unique([
        ...reasonCodes,
        BRACKET_MIGRATION_MATERIALIZER_CODES.GENERATED_STAGE_UNRESOLVED
      ]),
      materialized: false,
      bracket: null,
      unresolvedStageKeys: unmatchedGeneratedStageKeys,
      beforeMatchCount: extractMatches(currentBracket).length,
      afterMatchCount: generatedMatches.length
    };
  }

  const nextBracket = clone(currentBracket);
  nextBracket.stages = materializedStages;

  // Keep legacy operational fields coherent with the generated graph.
  nextBracket.generated = true;
  nextBracket.completedAt = null;
  nextBracket.championId = null;

  if (generatedBracket.type) {
    nextBracket.type = generatedBracket.type;
  }

  if (generatedBracket.version !== undefined) {
    nextBracket.version = generatedBracket.version;
  }

  if (generatedBracket.matchSystem !== undefined) {
    nextBracket.matchSystem = generatedBracket.matchSystem;
  }

  if (generatedBracket.slots) {
    nextBracket.slots = clone(generatedBracket.slots);
  }

  const status = reasonCodes.length
    ? BRACKET_MIGRATION_MATERIALIZER_STATUS.READY
    : BRACKET_MIGRATION_MATERIALIZER_STATUS.READY;

  return {
    status,
    reasonCodes: unique(reasonCodes),
    materialized: true,
    bracket: nextBracket,
    beforeMatchCount: extractMatches(currentBracket).length,
    afterMatchCount: generatedMatches.length,
    matchCountChanged: extractMatches(currentBracket).length !== generatedMatches.length,
    stageCount: materializedStages.length,
    generatedStageCount: grouped.size
  };
}

export function getCompetitionBracketMigrationMaterializationSummary(
  currentBracket = null,
  generatedBracket = null
) {
  const result = materializeCompetitionBracketForMigration(
    currentBracket,
    generatedBracket
  );

  return {
    status: result.status,
    reasonCodes: result.reasonCodes,
    materialized: result.materialized === true,
    beforeMatchCount: result.beforeMatchCount,
    afterMatchCount: result.afterMatchCount,
    matchCountChanged: result.matchCountChanged === true,
    stageCount: result.stageCount || 0,
    generatedStageCount: result.generatedStageCount || 0
  };
}
