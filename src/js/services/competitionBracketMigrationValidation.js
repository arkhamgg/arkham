// ========================================
// ARKHAM — Competition Bracket Migration Validation
// ========================================
//
// Bracket Migration Dual Validation v1.
//
// Validates both the current operational bracket and the proposed migration
// bracket before any future persistence/adoption operation.
//
// IMPORTANT:
// - No Firebase writes.
// - No Tournament Pro mutation.
// - No Match mutation.
// - No persistence.
// - No migration is executed.
// - This module only validates graph integrity.
//
// Pipeline:
//
// Generation
//   -> Comparison
//   -> Migration Readiness
//   -> Reconciliation
//   -> Migration Policy
//   -> Dry Run
//   -> Dual Validation
//   -> Migration Executor (future)
//
// V1 intentionally validates graph integrity without attempting to repair,
// normalize or mutate either graph.
// ========================================

export const BRACKET_MIGRATION_VALIDATION_STATUS = {
  READY: "READY",
  CURRENT_INVALID: "CURRENT_INVALID",
  PROPOSED_INVALID: "PROPOSED_INVALID",
  BOTH_INVALID: "BOTH_INVALID",
  BLOCKED: "BLOCKED",
  INVALID: "INVALID"
};

export const BRACKET_MIGRATION_VALIDATION_CODES = {
  CURRENT_BRACKET_MISSING: "CURRENT_BRACKET_MISSING",
  PROPOSED_BRACKET_MISSING: "PROPOSED_BRACKET_MISSING",

  EMPTY_BRACKET: "EMPTY_BRACKET",
  INVALID_MATCH_COLLECTION: "INVALID_MATCH_COLLECTION",

  INVALID_MATCH_ID: "INVALID_MATCH_ID",
  DUPLICATE_MATCH_ID: "DUPLICATE_MATCH_ID",

  INVALID_ROUND_ID: "INVALID_ROUND_ID",
  INVALID_STRUCTURE_ID: "INVALID_STRUCTURE_ID",
  INVALID_PHASE_ID: "INVALID_PHASE_ID",
  INVALID_PHASE_GROUP_ID: "INVALID_PHASE_GROUP_ID",

  DUPLICATE_ENTRY_IN_MATCH: "DUPLICATE_ENTRY_IN_MATCH",
  DUPLICATE_PARTICIPANT_IN_MATCH: "DUPLICATE_PARTICIPANT_IN_MATCH",

  INVALID_PARTICIPANT_CONTAINER: "INVALID_PARTICIPANT_CONTAINER",

  INVALID_WINNER_ROUTE: "INVALID_WINNER_ROUTE",
  INVALID_LOSER_ROUTE: "INVALID_LOSER_ROUTE",
  ROUTE_DESTINATION_MISSING: "ROUTE_DESTINATION_MISSING",
  ROUTE_DESTINATION_MATCH_MISSING: "ROUTE_DESTINATION_MATCH_MISSING",
  ROUTE_DESTINATION_SLOT_INVALID: "ROUTE_DESTINATION_SLOT_INVALID",

  INVALID_MATCH_REFERENCE: "INVALID_MATCH_REFERENCE",

  MATCH_COUNT_CHANGED: "MATCH_COUNT_CHANGED",

  CURRENT_GRAPH_INVALID: "CURRENT_GRAPH_INVALID",
  PROPOSED_GRAPH_INVALID: "PROPOSED_GRAPH_INVALID",

  DUAL_VALIDATION_FAILED: "DUAL_VALIDATION_FAILED"
};

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeValue(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return value;
}

function normalizeId(value) {
  const normalized = normalizeValue(value);

  if (normalized === null) return null;

  const result = String(normalized).trim();

  return result || null;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function extractMatches(bracket) {
  if (Array.isArray(bracket)) {
    return bracket;
  }

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

  if (Array.isArray(bracket?.matches)) {
    return bracket.matches;
  }

  if (Array.isArray(bracket?.bracket?.matches)) {
    return bracket.bracket.matches;
  }

  return [];
}

function extractParticipantIdentity(participant) {
  if (participant === undefined || participant === null) {
    return {
      entryId: null,
      participantId: null
    };
  }

  if (typeof participant === "string" || typeof participant === "number") {
    return {
      entryId: null,
      participantId: normalizeId(participant)
    };
  }

  return {
    entryId: normalizeId(
      participant?.entryId ||
      participant?.entryID ||
      participant?.entry?.id
    ),
    participantId: normalizeId(
      participant?.participantId ||
      participant?.participantID ||
      participant?.participant?.id ||
      participant?.id
    )
  };
}

function extractMatchParticipants(match) {
  const participants = [];

  if (match?.participants?.A !== undefined) {
    participants.push({
      side: "A",
      value: match.participants.A
    });
  }

  if (match?.participants?.B !== undefined) {
    participants.push({
      side: "B",
      value: match.participants.B
    });
  }

  if (match?.participantA !== undefined) {
    participants.push({
      side: "A",
      value: match.participantA
    });
  }

  if (match?.participantB !== undefined) {
    participants.push({
      side: "B",
      value: match.participantB
    });
  }

  if (
    match?.participants &&
    !Array.isArray(match.participants) &&
    typeof match.participants === "object" &&
    !("A" in match.participants) &&
    !("B" in match.participants)
  ) {
    if (match.participants.entryAId || match.participants.participantAId) {
      participants.push({
        side: "A",
        value: {
          entryId: match.participants.entryAId,
          participantId: match.participants.participantAId
        }
      });
    }

    if (match.participants.entryBId || match.participants.participantBId) {
      participants.push({
        side: "B",
        value: {
          entryId: match.participants.entryBId,
          participantId: match.participants.participantBId
        }
      });
    }
  }

  return participants;
}

function extractRoute(match, type) {
  const advancement = match?.advancement || {};

  if (type === "WINNER") {
    return (
      advancement?.winnerDestination ||
      match?.winnerDestination ||
      match?.advancement?.winner ||
      null
    );
  }

  return (
    advancement?.loserDestination ||
    match?.loserDestination ||
    match?.advancement?.loser ||
    null
  );
}

function extractRouteDestinationMatchId(route) {
  if (!route) return null;

  if (typeof route === "string" || typeof route === "number") {
    return normalizeId(route);
  }

  return normalizeId(
    route?.matchId ||
    route?.destinationMatchId ||
    route?.targetMatchId ||
    route?.destination?.matchId
  );
}

function extractRouteDestinationSlot(route) {
  if (!route || typeof route !== "object") {
    return null;
  }

  return normalizeId(
    route?.slot ||
    route?.destinationSlot ||
    route?.targetSlot ||
    route?.destination?.slot
  );
}

function isByeMatch(match) {
  const status = String(match?.status || "").trim().toUpperCase();
  const bracket = String(match?.bracket || "").trim().toUpperCase();

  return (
    status === "BYE" ||
    bracket === "BYE" ||
    match?.isBye === true
  );
}

function validateIdField(
  match,
  field,
  code,
  errors,
  matchId
) {
  const value = match?.[field];

  if (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    !normalizeId(value)
  ) {
    errors.push({
      code,
      matchId,
      field
    });
  }
}

function validateRoute(
  match,
  type,
  matchIds,
  errors,
  matchId
) {
  const route = extractRoute(match, type);

  if (!route) {
    return;
  }

  const destinationMatchId = extractRouteDestinationMatchId(route);

  if (!destinationMatchId) {
    errors.push({
      code:
        type === "WINNER"
          ? BRACKET_MIGRATION_VALIDATION_CODES.INVALID_WINNER_ROUTE
          : BRACKET_MIGRATION_VALIDATION_CODES.INVALID_LOSER_ROUTE,
      matchId
    });

    return;
  }

  if (!matchIds.has(destinationMatchId)) {
    errors.push({
      code: BRACKET_MIGRATION_VALIDATION_CODES.ROUTE_DESTINATION_MATCH_MISSING,
      matchId,
      routeType: type,
      destinationMatchId
    });
  }

  const destinationSlot = extractRouteDestinationSlot(route);

  if (
    destinationSlot !== null &&
    !["A", "B", "a", "b"].includes(destinationSlot)
  ) {
    errors.push({
      code: BRACKET_MIGRATION_VALIDATION_CODES.ROUTE_DESTINATION_SLOT_INVALID,
      matchId,
      routeType: type,
      destinationSlot
    });
  }
}

function validateMatchParticipants(match, errors, matchId) {
  const participants = extractMatchParticipants(match);

  if (!participants.length) {
    return;
  }

  const entryIds = [];
  const participantIds = [];

  for (const participant of participants) {
    if (
      participant.value !== undefined &&
      participant.value !== null &&
      typeof participant.value !== "object" &&
      typeof participant.value !== "string" &&
      typeof participant.value !== "number"
    ) {
      errors.push({
        code:
          BRACKET_MIGRATION_VALIDATION_CODES.INVALID_PARTICIPANT_CONTAINER,
        matchId,
        side: participant.side
      });

      continue;
    }

    const identity = extractParticipantIdentity(participant.value);

    if (identity.entryId) {
      entryIds.push(identity.entryId);
    }

    if (identity.participantId) {
      participantIds.push(identity.participantId);
    }
  }

  const duplicateEntryIds = unique(
    entryIds.filter(
      (entryId, index) => entryIds.indexOf(entryId) !== index
    )
  );

  const duplicateParticipantIds = unique(
    participantIds.filter(
      (participantId, index) =>
        participantIds.indexOf(participantId) !== index
    )
  );

  if (duplicateEntryIds.length && !isByeMatch(match)) {
    errors.push({
      code: BRACKET_MIGRATION_VALIDATION_CODES.DUPLICATE_ENTRY_IN_MATCH,
      matchId,
      entryIds: duplicateEntryIds
    });
  }

  if (duplicateParticipantIds.length && !isByeMatch(match)) {
    errors.push({
      code: BRACKET_MIGRATION_VALIDATION_CODES.DUPLICATE_PARTICIPANT_IN_MATCH,
      matchId,
      participantIds: duplicateParticipantIds
    });
  }
}

function validateMatchCollection(matches = [], {
  strict = false
} = {}) {
  const errors = [];
  const matchIds = new Set();

  if (!Array.isArray(matches)) {
    return {
      valid: false,
      errors: [
        {
          code:
            BRACKET_MIGRATION_VALIDATION_CODES.INVALID_MATCH_COLLECTION
        }
      ],
      matchIds: []
    };
  }

  if (!matches.length) {
    return {
      valid: false,
      errors: [
        {
          code: BRACKET_MIGRATION_VALIDATION_CODES.EMPTY_BRACKET
        }
      ],
      matchIds: []
    };
  }

  for (const match of matches) {
    const matchId = normalizeId(match?.id);

    if (!matchId) {
      errors.push({
        code: BRACKET_MIGRATION_VALIDATION_CODES.INVALID_MATCH_ID
      });

      continue;
    }

    if (matchIds.has(matchId)) {
      errors.push({
        code: BRACKET_MIGRATION_VALIDATION_CODES.DUPLICATE_MATCH_ID,
        matchId
      });

      continue;
    }

    matchIds.add(matchId);

    validateIdField(
      match,
      "roundId",
      BRACKET_MIGRATION_VALIDATION_CODES.INVALID_ROUND_ID,
      errors,
      matchId
    );

    validateIdField(
      match,
      "structureId",
      BRACKET_MIGRATION_VALIDATION_CODES.INVALID_STRUCTURE_ID,
      errors,
      matchId
    );

    validateIdField(
      match,
      "phaseId",
      BRACKET_MIGRATION_VALIDATION_CODES.INVALID_PHASE_ID,
      errors,
      matchId
    );

    validateIdField(
      match,
      "phaseGroupId",
      BRACKET_MIGRATION_VALIDATION_CODES.INVALID_PHASE_GROUP_ID,
      errors,
      matchId
    );

    validateMatchParticipants(match, errors, matchId);

    if (strict) {
      if (!normalizeId(match?.roundId)) {
        errors.push({
          code: BRACKET_MIGRATION_VALIDATION_CODES.INVALID_ROUND_ID,
          matchId,
          strict: true
        });
      }

      if (!normalizeId(match?.structureId)) {
        errors.push({
          code: BRACKET_MIGRATION_VALIDATION_CODES.INVALID_STRUCTURE_ID,
          matchId,
          strict: true
        });
      }
    }
  }

  for (const match of matches) {
    const matchId = normalizeId(match?.id);

    if (!matchId) continue;

    validateRoute(
      match,
      "WINNER",
      matchIds,
      errors,
      matchId
    );

    validateRoute(
      match,
      "LOSER",
      matchIds,
      errors,
      matchId
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    matchIds: [...matchIds]
  };
}

/**
 * Validates one bracket graph without mutating it.
 *
 * `strict` should normally be used for generated/proposed graphs.
 * Current operational brackets may still contain legacy representations,
 * therefore the default validation remains compatibility-friendly.
 */
export function validateCompetitionBracketGraph(
  bracket = null,
  {
    strict = false,
    label = "BRACKET"
  } = {}
) {
  if (!bracket) {
    return {
      valid: false,
      label,
      reasonCodes: [
        label === "CURRENT"
          ? BRACKET_MIGRATION_VALIDATION_CODES.CURRENT_BRACKET_MISSING
          : BRACKET_MIGRATION_VALIDATION_CODES.PROPOSED_BRACKET_MISSING
      ],
      errors: [],
      matchCount: 0,
      matchIds: []
    };
  }

  const matches = extractMatches(bracket);

  const result = validateMatchCollection(matches, {
    strict
  });

  const reasonCodes = unique(
    result.errors.map((error) => error?.code)
  );

  return {
    valid: result.valid,
    label,
    reasonCodes,
    errors: result.errors,
    matchCount: matches.length,
    matchIds: result.matchIds
  };
}

/**
 * Performs dual validation over the current and proposed bracket.
 *
 * The current bracket is validated using compatibility-friendly rules.
 * The proposed bracket is validated using strict graph rules.
 *
 * V1 does not repair either graph and does not compare business ownership.
 * Comparison/Reconciliation remain responsible for semantic differences.
 */
export function validateCompetitionBracketMigration(
  event = {},
  {
    currentBracket = null,
    proposedBracket = null,
    strictProposed = true
  } = {}
) {
  if (!currentBracket && !proposedBracket) {
    return {
      status: BRACKET_MIGRATION_VALIDATION_STATUS.BLOCKED,
      reasonCodes: [
        BRACKET_MIGRATION_VALIDATION_CODES.CURRENT_BRACKET_MISSING,
        BRACKET_MIGRATION_VALIDATION_CODES.PROPOSED_BRACKET_MISSING
      ],
      valid: false,
      current: null,
      proposed: null,
      matchCountChanged: false,
      event
    };
  }

  if (!currentBracket) {
    return {
      status: BRACKET_MIGRATION_VALIDATION_STATUS.CURRENT_INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_VALIDATION_CODES.CURRENT_BRACKET_MISSING
      ],
      valid: false,
      current: null,
      proposed: validateCompetitionBracketGraph(proposedBracket, {
        strict: strictProposed,
        label: "PROPOSED"
      }),
      matchCountChanged: false,
      event
    };
  }

  if (!proposedBracket) {
    return {
      status: BRACKET_MIGRATION_VALIDATION_STATUS.PROPOSED_INVALID,
      reasonCodes: [
        BRACKET_MIGRATION_VALIDATION_CODES.PROPOSED_BRACKET_MISSING
      ],
      valid: false,
      current: validateCompetitionBracketGraph(currentBracket, {
        strict: false,
        label: "CURRENT"
      }),
      proposed: null,
      matchCountChanged: false,
      event
    };
  }

  const current = validateCompetitionBracketGraph(currentBracket, {
    strict: false,
    label: "CURRENT"
  });

  const proposed = validateCompetitionBracketGraph(proposedBracket, {
    strict: strictProposed,
    label: "PROPOSED"
  });

  const matchCountChanged =
    current.matchCount !== proposed.matchCount;

  const reasonCodes = [
    ...current.reasonCodes,
    ...proposed.reasonCodes
  ];

  if (matchCountChanged) {
    reasonCodes.push(
      BRACKET_MIGRATION_VALIDATION_CODES.MATCH_COUNT_CHANGED
    );
  }

  const currentValid = current.valid;
  const proposedValid = proposed.valid;

  let status;

  if (!currentValid && !proposedValid) {
    status = BRACKET_MIGRATION_VALIDATION_STATUS.BOTH_INVALID;
    reasonCodes.push(
      BRACKET_MIGRATION_VALIDATION_CODES.DUAL_VALIDATION_FAILED
    );
  } else if (!currentValid) {
    status = BRACKET_MIGRATION_VALIDATION_STATUS.CURRENT_INVALID;
    reasonCodes.push(
      BRACKET_MIGRATION_VALIDATION_CODES.CURRENT_GRAPH_INVALID
    );
  } else if (!proposedValid) {
    status = BRACKET_MIGRATION_VALIDATION_STATUS.PROPOSED_INVALID;
    reasonCodes.push(
      BRACKET_MIGRATION_VALIDATION_CODES.PROPOSED_GRAPH_INVALID
    );
  } else {
    status = BRACKET_MIGRATION_VALIDATION_STATUS.READY;
  }

  return {
    status,
    reasonCodes: unique(reasonCodes),
    valid: currentValid && proposedValid,
    current,
    proposed,
    matchCountChanged,
    event
  };
}

/**
 * Compact summary intended for migration guards and future executor logic.
 */
export function getCompetitionBracketMigrationValidationSummary(
  event = {},
  options = {}
) {
  const validation = validateCompetitionBracketMigration(
    event,
    options
  );

  return {
    status: validation.status,
    reasonCodes: validation.reasonCodes,
    valid: validation.valid === true,
    currentValid: validation.current?.valid === true,
    proposedValid: validation.proposed?.valid === true,
    currentMatchCount: validation.current?.matchCount || 0,
    proposedMatchCount: validation.proposed?.matchCount || 0,
    matchCountChanged: validation.matchCountChanged === true
  };
}

/**
 * Returns true only when both graphs pass their respective validation rules.
 *
 * This does not authorize persistence or adoption.
 */
export function canProceedWithCompetitionBracketMigrationValidation(
  validation = {}
) {
  return Boolean(
    validation &&
    validation.status === BRACKET_MIGRATION_VALIDATION_STATUS.READY &&
    validation.valid === true
  );
}
