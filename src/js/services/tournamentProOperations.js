// ========================================
// NEXUS — Tournament Pro Operations
// ========================================

import {
  getMapEntity,
  updateMapEntity,
  getEntities
} from "./firestore.js";

import { auth, db } from "./firebase.js";
import {
  doc,
  FieldPath,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";

import {
  ensureTournamentProState,
  createParticipant,
  syncBracketSlotsWithEntries,
  createCompetitionEntry,
  generateBracket as buildBracket,
  PARTICIPANT_STATUS,
  MATCH_STATUS,
  RECOGNITION_STATUS,
  TOURNAMENT_EVENT_STATUS
} from "./tournamentPro.js";
import {
  startMatchCommand,
  applyMatchResultCommand,
  getCompetitionEliminationRoundSpecs,
  getCompetitionDeliveryMode,
  getCompetitionStations,
  normalizeStation
} from "./competitionCore.js";
import {
  MATCH_LIFECYCLE,
  callMatchLifecycle,
  getMatchLifecycle,
  uncallMatchLifecycle
} from "./competitionMatchLifecycle.js";
import {
  createNextMatchGame,
  startMatchGame,
  completeMatchGame
} from "./competitionGames.js";
import {
  applyGameResult
} from "./competitionGameResults.js";
import {
  getMatchResult
} from "./competitionMatchResults.js";
import {
  createLegacyMatchResultCommand
} from "./competitionMatchResultBridge.js";
import { STATION_STATUS, STATION_TYPES } from "./competitionTypes.js";
import { getGameMatchSystems } from "./gameCatalog.js";
import {
  validateCompetitionConfiguration,
  COMPETITION_CONFIGURATION_STATUS
} from "./competitionConfiguration.js";
import {
  generateCompetitionBracket
} from "./competitionBracketGeneration.js";
import {
  compareCompetitionBrackets
} from "./competitionBracketComparison.js";
import {
  evaluateCompetitionBracketMigrationReadiness
} from "./competitionBracketMigrationReadiness.js";
import {
  buildCompetitionBracketReconciliationPlan
} from "./competitionBracketReconciliation.js";

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

function ensurePersistentEntry(pro, participant, { competitionId = null } = {}) {
  if (!participant?.id) return null;

  pro.entries = pro.entries || {};

  const existing = Object.values(pro.entries).find(
    (entry) => entry?.legacyParticipantId === participant.id
  );

  const entry = existing || createCompetitionEntry({
    competitionId,
    participant
  });

  entry.competitionId = entry.competitionId || competitionId;
  entry.entityType = participant.entityType || entry.entityType || "manual";
  entry.entityId = participant.entityId ?? entry.entityId ?? null;
  entry.displayName = participant.displayName || entry.displayName || "Participante";
  entry.status = mapParticipantStatusToEntryStatus(participant.status);
  entry.seed = participant.seed ?? null;
  entry.registrationData = participant.registrationData ?? null;
  entry.competitiveState = {
    ...(entry.competitiveState || {}),
    participantStatus: participant.status ?? null,
    checkIn: participant.checkIn === true,
    slotIds: Array.isArray(participant.slotIds) ? [...participant.slotIds] : [],
    replacedByEntryId: participant.replacedByParticipantId
      ? (
        Object.values(pro.entries).find(
          (candidate) => candidate?.legacyParticipantId === participant.replacedByParticipantId
        )?.id || `entry_${participant.replacedByParticipantId}`
      )
      : null
  };
  entry.legacyParticipantId = participant.id;
  entry.updatedAt = new Date().toISOString();

  pro.entries[entry.id] = entry;
  return entry;
}

function normalizeGameScoreValue(value) {
  const score = Number(value);

  if (!Number.isFinite(score) || score < 0) {
    return null;
  }

  return score;
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveParticipantId(pro, identifier) {
  if (!identifier) return identifier;

  if (pro?.participants?.[identifier]) {
    return identifier;
  }

  const entry = pro?.entries?.[identifier];
  if (entry?.legacyParticipantId && pro?.participants?.[entry.legacyParticipantId]) {
    return entry.legacyParticipantId;
  }

  const entryByParticipant = Object.values(pro?.entries || {}).find(
    (candidate) => candidate?.legacyParticipantId === identifier
  );

  return entryByParticipant?.legacyParticipantId || identifier;
}

export async function getTournamentProEvent(tournamentId, eventId) {
  return getMapEntity("tournaments", tournamentId, "events", eventId);
}

/**
 * Read-only bridge between the current Tournament Pro operational bracket
 * and the Competition Core bracket pipeline.
 *
 * It does not replace the legacy generator, mutate the event, or persist
 * anything. It evaluates Generation -> Comparison -> Migration Readiness
 * -> Reconciliation only.
 */
export function auditTournamentProBracketAgainstCompetitionCore(
  event,
  {
    structureId = null,
    phaseId = null,
    phaseGroupId = null
  } = {}
) {
  const currentBracket = event?.pro?.bracket || event?.bracket || null;

  if (!currentBracket) {
    return {
      status: "BLOCKED",
      reasonCodes: ["CURRENT_BRACKET_MISSING"],
      currentBracket: null,
      generation: null,
      comparison: null,
      readiness: null,
      reconciliation: null
    };
  }

  const generation = generateCompetitionBracket(event, {
    structureId,
    phaseId,
    phaseGroupId
  });

  if (generation.status !== "READY") {
    return {
      status: generation.status,
      reasonCodes: [
        "COMPETITION_CORE_GENERATION_NOT_READY",
        ...(generation.reasonCodes || [])
      ],
      currentBracket,
      generation,
      comparison: null,
      readiness: null,
      reconciliation: null
    };
  }

  const comparison = compareCompetitionBrackets(
    event,
    {
      currentBracket,
      generated: generation
    }
  );

  const readiness = evaluateCompetitionBracketMigrationReadiness(
    event,
    {
      currentBracket,
      generated: generation
    }
  );

  const reconciliation = buildCompetitionBracketReconciliationPlan(
    event,
    {
      currentBracket,
      generated: generation,
      readiness,
      comparison
    }
  );

  return {
    status: reconciliation.status,
    reasonCodes: [
      ...(comparison.reasonCodes || []),
      ...(readiness.reasonCodes || []),
      ...(reconciliation.reasonCodes || [])
    ],
    currentBracket,
    generation,
    comparison,
    readiness,
    reconciliation
  };
}


/**
 * Builds and persists the declarative Competition Structure from the current
 * legacy Tournament Pro bracket without replacing or rewriting that bracket.
 *
 * This is the controlled compatibility bridge discovered by the architecture
 * audit: legacy stages remain operational, while Phase -> Structure -> Round
 * -> Slot becomes explicitly available to Competition Core.
 */
export async function syncCompetitionDomainStructureFromLegacyBracket({
  tournamentId,
  eventId,
  event
}) {
  const pro = ensureTournamentProState(event);
  const bracket = pro?.bracket;

  if (!bracket?.generated || !Array.isArray(bracket.stages) || !bracket.stages.length) {
    throw new Error("No existe un bracket legacy generado que pueda sincronizarse con Competition Core.");
  }

  const existingPhases = Array.isArray(pro.phases)
    ? pro.phases.map((phase) => ({ ...phase }))
    : [];

  const existingStructure = existingPhases
    .flatMap((phase) => Array.isArray(phase?.structures) ? phase.structures : [])
    .find((structure) => structure?.id);

  if (existingStructure) {
    return { ...event, pro };
  }

  const phaseIndex = existingPhases.length;
  const phase = existingPhases.find((candidate) => candidate && typeof candidate === "object") || null;
  const phaseId = phase?.id || `phase-main-${eventId}`;
  const structureId = `structure-main-${eventId}`;
  const structureType = String(bracket.type || "").toUpperCase() === "DOUBLE_ELIMINATION"
    ? "DOUBLE_ELIMINATION"
    : "SINGLE_ELIMINATION";

  const rounds = bracket.stages.map((stage, index) => {
    const roundId = stage?.id || `${structureId}-round-${index + 1}`;
    const matches = Array.isArray(stage?.matches) ? stage.matches : [];

    return {
      id: roundId,
      phaseId,
      structureId,
      order: Number.isFinite(Number(stage?.number)) ? Number(stage.number) : index + 1,
      number: Number.isFinite(Number(stage?.number)) ? Number(stage.number) : index + 1,
      name: stage?.bracket === "grand_final"
        ? "Grand Final"
        : `${stage?.bracket === "losers" ? "Losers" : "Winners"} Round ${Number(stage?.number) || index + 1}`,
      type: stage?.bracket === "grand_final" ? "GRAND_FINAL" : "ELIMINATION",
      bracket: stage?.bracket || "winners",
      status: "configured",
      matches: matches.map((match, matchIndex) => ({
        id: match?.id || `${roundId}-match-${matchIndex + 1}`,
        position: Number(match?.position) || matchIndex + 1,
        participantAId: match?.participantAId || null,
        participantBId: match?.participantBId || null,
        entryAId: match?.entryAId || null,
        entryBId: match?.entryBId || null,
        nextMatchId: match?.nextMatchId || null,
        nextSlot: match?.nextSlot || null,
        loserRoute: match?.loserRoute || null
      }))
    };
  });

  const firstRound = rounds.find((round) => round.bracket === "winners" && Number(round.number) === 1)
    || rounds[0]
    || null;

  const entriesByParticipantId = new Map(
    Object.values(pro.entries || {})
      .filter((entry) => entry?.legacyParticipantId)
      .map((entry) => [entry.legacyParticipantId, entry])
  );

  const slots = Object.entries(bracket.slots || {}).map(([slotId, slot], index) => {
    const participantId = slot?.participantId || null;
    const entry = slot?.entryId
      ? pro.entries?.[slot.entryId] || null
      : entriesByParticipantId.get(participantId) || null;
    const seed = Number(slot?.seed);
    const normalizedSeed = Number.isFinite(seed) ? seed : index + 1;

    return {
      id: slotId,
      phaseId,
      structureId,
      roundId: firstRound?.id || null,
      position: normalizedSeed,
      order: normalizedSeed,
      seed: normalizedSeed,
      entryId: entry?.id || slot?.entryId || null,
      participantId: participantId || entry?.legacyParticipantId || null,
      type: participantId || entry?.id ? "ENTRY" : "EMPTY",
      status: participantId || entry?.id ? "ASSIGNED" : "EMPTY",
      bracket: "winners",
      side: normalizedSeed % 2 === 1 ? "A" : "B",
      matchId: null,
      sourceSlotId: null
    };
  });

  const structure = {
    id: structureId,
    phaseId,
    name: structureType === "DOUBLE_ELIMINATION" ? "Double Elimination" : "Single Elimination",
    order: 1,
    type: structureType,
    status: "configured",
    rounds,
    slots
  };

  const nextPhase = {
    ...(phase || {}),
    id: phaseId,
    competitionId: phase?.competitionId || eventId,
    name: phase?.name || "Main Competition",
    order: Number.isFinite(Number(phase?.order)) ? Number(phase.order) : phaseIndex + 1,
    status: phase?.status || "configured",
    matchFormat: phase?.matchFormat ?? pro.matchSystem ?? event?.matchSystem ?? null,
    phaseGroups: Array.isArray(phase?.phaseGroups) ? [...phase.phaseGroups] : [],
    structures: [structure]
  };

  const nextPhases = phase
    ? existingPhases.map((candidate) => candidate?.id === phaseId ? nextPhase : candidate)
    : [...existingPhases, nextPhase];

  pro.phases = nextPhases;
  return savePro(tournamentId, eventId, event, pro);
}

function assertCompetitionSetupEditable(event, pro) {
  const terminalStatuses = new Set(["live", "check_in", "finished", "archived", "completed"]);
  const eventStatus = String(event?.status || "").toLowerCase();
  const proStatus = String(pro?.status || "").toLowerCase();

  if (terminalStatuses.has(eventStatus) || terminalStatuses.has(proStatus)) {
    throw new Error("La estructura no se puede editar cuando el torneo ya está en check-in o en curso.");
  }

  if (pro?.checkIn?.opened || pro?.checkIn?.completed || ["open", "completed"].includes(String(pro?.checkIn?.status || "").toLowerCase())) {
    throw new Error("Cierra o completa el check-in antes de cambiar la estructura competitiva.");
  }

  const matches = [
    ...Object.values(pro?.matches || {}),
    ...(pro?.bracket?.stages || []).flatMap((stage) => stage?.matches || [])
  ];
  if (matches.some((match) => ["live", "completed"].includes(String(match?.status || "").toLowerCase()))) {
    throw new Error("La estructura no se puede editar después de iniciar o completar un partido.");
  }
}

function normalizeCompetitionSetupName(value, label) {
  const name = String(value || "").trim();
  if (!name) throw new Error(`Escribe un nombre para ${label}.`);
  if (name.length > 80) throw new Error("El nombre no puede superar 80 caracteres.");
  return name;
}

function normalizeStructureTypeValue(value) {
  const type = String(value || "").trim().toUpperCase();
  if (!["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"].includes(type)) {
    throw new Error("Elige eliminación simple o doble para esta estructura.");
  }
  return type;
}

function getStoredCompetitionPhases(event) {
  return Array.isArray(event?.pro?.phases) ? event.pro.phases : null;
}

function createLegacyMainCompetitionPhase({ eventId, event, pro }) {
  return {
    id: "legacy-main",
    competitionId: eventId,
    name: "Main Competition",
    order: 1,
    status: "draft",
    matchFormat: pro?.matchSystem || event?.matchSystem || null,
    phaseGroups: [],
    structures: [],
    legacy: true
  };
}

function preserveLegacyMainCompetition(phases, { eventId, event, pro }) {
  const hasCompatibilityPhase = phases.some((phase) => phase?.id === "legacy-main" || phase?.legacy === true);
  const hasUnassignedLegacyBracket = (pro?.bracket?.stages || []).some((stage) =>
    !stage?.phaseId && !(stage?.matches || []).some((match) => match?.phaseId)
  );
  const shouldPreserve = !hasCompatibilityPhase && (
    phases.length === 0 || hasUnassignedLegacyBracket
  );
  if (!shouldPreserve) return;

  phases.forEach((phase, index) => { phase.order = index + 2; });
  phases.unshift(createLegacyMainCompetitionPhase({ eventId, event, pro }));
}

function serializeCompetitionPhases(phases) {
  const sortObjectKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortObjectKeys);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((sorted, key) => {
      if (value[key] !== undefined) sorted[key] = sortObjectKeys(value[key]);
      return sorted;
    }, {});
  };

  return JSON.stringify(sortObjectKeys(phases));
}

async function persistCompetitionPhasesSafely({
  tournamentId,
  eventId,
  expectedPhases,
  nextPhases
}) {
  if (!tournamentId || !eventId) throw new Error("Falta identificar el torneo o el evento.");
  const tournamentRef = doc(db, "tournaments", tournamentId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(tournamentRef);
    if (!snapshot.exists()) throw new Error("No se encontró el torneo.");
    const currentEvent = snapshot.data()?.events?.[eventId] || null;
    if (!currentEvent) throw new Error("No se encontró el evento.");

    const currentPhases = getStoredCompetitionPhases(currentEvent);
    if (serializeCompetitionPhases(currentPhases) !== serializeCompetitionPhases(expectedPhases)) {
      throw new Error("La configuración cambió en otra sesión. Recarga el evento antes de guardar de nuevo.");
    }

    const currentPro = ensureTournamentProState(currentEvent);
    assertCompetitionSetupEditable(currentEvent, currentPro);
    transaction.update(
      tournamentRef,
      new FieldPath("events", eventId, "pro", "phases"),
      cloneValue(nextPhases),
      new FieldPath("events", eventId, "updatedAt"),
      serverTimestamp(),
      "updatedAt",
      serverTimestamp()
    );
  });

  const persistedEvent = await getMapEntity("tournaments", tournamentId, "events", eventId);
  if (!persistedEvent || serializeCompetitionPhases(getStoredCompetitionPhases(persistedEvent)) !== serializeCompetitionPhases(nextPhases)) {
    throw new Error("No se pudo verificar la configuración guardada. Recarga el evento para confirmar el estado.");
  }

  // Return the persisted record; this write changes only pro.phases.
  return persistedEvent;
}

async function validatePhaseMatchSystem(event, pro, phaseId, matchSystemMode, matchSystem) {
  if (!["CUSTOM", "INHERIT"].includes(matchSystemMode)) {
    throw new Error("Elige un formato de partida válido para esta fase.");
  }
  const mode = matchSystemMode === "CUSTOM" ? "CUSTOM" : "INHERIT";
  if (mode === "INHERIT") return { matchSystemMode: mode, matchSystem: null, matchFormat: null };

  const value = String(matchSystem || "").trim();
  if (!value) throw new Error("Elige el formato de partida para esta fase.");

  let allowed = [];
  try {
    allowed = await getGameMatchSystems(event?.gameId, event?.competitionOption);
  } catch {
    // Existing catalog outages should not prevent keeping the event's current format.
  }

  const existingValue = pro?.phases?.find((phase) => phase?.id === phaseId)?.matchSystem;
  const inheritedValue = pro?.matchSystem || event?.matchSystem || null;
  if (allowed.length > 0 && !allowed.includes(value)) {
    throw new Error("Ese formato ya no está disponible para el juego y modalidad de este torneo.");
  }
  if (allowed.length === 0 && value !== inheritedValue && value !== existingValue) {
    throw new Error("No se pudo verificar ese formato con las opciones del juego. Intenta de nuevo más tarde.");
  }

  return { matchSystemMode: mode, matchSystem: value, matchFormat: value };
}

export async function saveCompetitionPhaseConfiguration({
  tournamentId,
  eventId,
  event,
  phaseId,
  name,
  matchSystemMode = "INHERIT",
  matchSystem = null
}) {
  const pro = ensureTournamentProState(event);
  assertCompetitionSetupEditable(event, pro);
  const expectedPhases = cloneValue(getStoredCompetitionPhases(event));

  const id = String(phaseId || "").trim();
  if (!id) throw new Error("No se pudo identificar la fase.");

  const phases = Array.isArray(pro.phases) ? pro.phases.map((phase) => ({
    ...phase,
    structures: Array.isArray(phase?.structures) ? phase.structures.map((structure) => ({ ...structure })) : []
  })) : [];
  preserveLegacyMainCompetition(phases, { eventId, event, pro });
  const phaseIndex = phases.findIndex((phase) => phase?.id === id);
  const existing = phaseIndex >= 0 ? phases[phaseIndex] : null;
  const normalizedName = normalizeCompetitionSetupName(name, "la fase");
  if (phases.some((phase) => phase?.id !== id && String(phase?.name || "").trim().toLowerCase() === normalizedName.toLowerCase())) {
    throw new Error("Ya existe una fase con ese nombre.");
  }

  const format = await validatePhaseMatchSystem(event, pro, id, matchSystemMode, matchSystem);
  const nextPhase = {
    ...(existing || {}),
    id,
    competitionId: eventId,
    name: normalizedName,
    order: existing?.order || phases.length + 1,
    status: existing?.status || "configured",
    ...format,
    phaseGroups: Array.isArray(existing?.phaseGroups) ? existing.phaseGroups : [],
    structures: Array.isArray(existing?.structures) ? existing.structures : []
  };

  if (phaseIndex >= 0) phases[phaseIndex] = nextPhase;
  else phases.push(nextPhase);
  phases.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  pro.phases = phases.map((phase, index) => ({ ...phase, order: index + 1 }));

  return persistCompetitionPhasesSafely({
    tournamentId,
    eventId,
    expectedPhases,
    nextPhases: pro.phases
  });
}

export async function moveCompetitionPhaseConfiguration({
  tournamentId,
  eventId,
  event,
  phaseId,
  direction
}) {
  const pro = ensureTournamentProState(event);
  assertCompetitionSetupEditable(event, pro);
  const expectedPhases = cloneValue(getStoredCompetitionPhases(event));
  const phases = Array.isArray(pro.phases) ? [...pro.phases] : [];
  const index = phases.findIndex((phase) => phase?.id === phaseId);
  const target = index + (direction === "up" ? -1 : direction === "down" ? 1 : 0);
  if (index < 0 || target < 0 || target >= phases.length || target === index) return { ...event, pro };

  [phases[index], phases[target]] = [phases[target], phases[index]];
  pro.phases = phases.map((phase, phaseIndex) => ({ ...phase, order: phaseIndex + 1 }));
  return persistCompetitionPhasesSafely({
    tournamentId,
    eventId,
    expectedPhases,
    nextPhases: pro.phases
  });
}

export async function saveCompetitionStructureConfiguration({
  tournamentId,
  eventId,
  event,
  phaseId,
  structureId,
  name,
  type
}) {
  const pro = ensureTournamentProState(event);
  assertCompetitionSetupEditable(event, pro);
  const expectedPhases = cloneValue(getStoredCompetitionPhases(event));
  const phases = (pro.phases || []).map((item) => ({
    ...item,
    structures: Array.isArray(item?.structures) ? item.structures.map((structure) => ({ ...structure })) : []
  }));
  const phase = phases.find((item) => item?.id === phaseId);
  if (!phase) throw new Error("Guarda una fase antes de configurar su estructura.");

  const id = String(structureId || "").trim();
  if (!id) throw new Error("No se pudo identificar la estructura.");
  const normalizedName = normalizeCompetitionSetupName(name, "la estructura");
  const normalizedType = normalizeStructureTypeValue(type);
  const structures = Array.isArray(phase.structures) ? phase.structures.map((item) => ({ ...item })) : [];
  const index = structures.findIndex((item) => item?.id === id);
  const existing = index >= 0 ? structures[index] : null;

  if (structures.some((item) => item?.id !== id && String(item?.name || "").trim().toLowerCase() === normalizedName.toLowerCase())) {
    throw new Error("Ya existe una estructura con ese nombre en esta fase.");
  }
  if (existing && String(existing.type || "").toUpperCase() !== normalizedType && ((existing.rounds || []).length || (existing.slots || []).length)) {
    throw new Error("No se puede cambiar el formato de una estructura que ya tiene rounds o posiciones. Crea otra estructura para usar otro formato.");
  }

  const nextStructure = {
    ...(existing || {}),
    id,
    phaseId,
    name: normalizedName,
    order: existing?.order || structures.length + 1,
    type: normalizedType,
    status: existing?.status || "configured",
    matchFormat: phase.matchFormat || phase.matchSystem || pro.matchSystem || event?.matchSystem || null,
    rounds: Array.isArray(existing?.rounds) ? existing.rounds : [],
    slots: Array.isArray(existing?.slots) ? existing.slots : []
  };
  if (index >= 0) structures[index] = nextStructure;
  else structures.push(nextStructure);
  structures.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  phase.structures = structures.map((structure, structureIndex) => ({ ...structure, order: structureIndex + 1 }));
  pro.phases = phases;

  return persistCompetitionPhasesSafely({
    tournamentId,
    eventId,
    expectedPhases,
    nextPhases: pro.phases
  });
}


/**
 * ========================================
 * COMPETITION PHASE GROUPS / POOLS
 * ========================================
 *
 * C.4.0
 *
 * Phase Groups are first-class domain entities that live inside a Phase and
 * belong to a Structure. They are NOT Structures themselves.
 *
 * Domain boundary:
 *   Phase -> Structure -> Phase Group / Pool -> Rounds -> Matches
 *
 * This milestone only formalizes configuration/persistence. It does not
 * generate Round Robin schedules, standings, tiebreakers, qualifiers,
 * seeding, or cross-phase advancement.
 */

const DEFAULT_PHASE_GROUP_RULES = Object.freeze({
  version: 1,
  competition: Object.freeze({
    rounds: 1
  }),
  scoring: Object.freeze({
    win: 3,
    draw: 1,
    loss: 0
  }),
  standings: Object.freeze({
    enabled: true
  }),
  tiebreakers: Object.freeze([]),
  qualification: null
});

function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function requireFiniteNumber(value, label, { integer = false, min = null } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} debe ser un número válido.`);
  }

  if (integer && !Number.isInteger(value)) {
    throw new Error(`${label} debe ser un número entero.`);
  }

  if (min !== null && value < min) {
    throw new Error(`${label} debe ser mayor o igual a ${min}.`);
  }

  return value;
}

function normalizePhaseGroupRulesValue(value, fallback = {}) {
  const source = value === null || value === undefined
    ? fallback
    : value;

  if (!isPlainObject(source)) {
    throw new Error("Las reglas del pool deben ser un objeto válido.");
  }

  const competition = source.competition === undefined
    ? {}
    : source.competition;
  const scoring = source.scoring === undefined
    ? {}
    : source.scoring;
  const standings = source.standings === undefined
    ? {}
    : source.standings;

  if (!isPlainObject(competition)) {
    throw new Error("competition debe ser un objeto válido.");
  }
  if (!isPlainObject(scoring)) {
    throw new Error("scoring debe ser un objeto válido.");
  }
  if (!isPlainObject(standings)) {
    throw new Error("standings debe ser un objeto válido.");
  }

  const version = source.version === undefined
    ? DEFAULT_PHASE_GROUP_RULES.version
    : requireFiniteNumber(source.version, "version", { integer: true, min: 1 });

  const rounds = competition.rounds === undefined
    ? DEFAULT_PHASE_GROUP_RULES.competition.rounds
    : requireFiniteNumber(competition.rounds, "competition.rounds", { integer: true, min: 1 });

  if (![1, 2].includes(rounds)) {
    throw new Error("Las reglas del pool solo permiten 1 o 2 rondas de Round Robin.");
  }

  const win = scoring.win === undefined
    ? DEFAULT_PHASE_GROUP_RULES.scoring.win
    : requireFiniteNumber(scoring.win, "scoring.win", { min: 0 });
  const draw = scoring.draw === undefined
    ? DEFAULT_PHASE_GROUP_RULES.scoring.draw
    : requireFiniteNumber(scoring.draw, "scoring.draw", { min: 0 });
  const loss = scoring.loss === undefined
    ? DEFAULT_PHASE_GROUP_RULES.scoring.loss
    : requireFiniteNumber(scoring.loss, "scoring.loss", { min: 0 });

  if (standings.enabled !== undefined && typeof standings.enabled !== "boolean") {
    throw new Error("standings.enabled debe ser booleano.");
  }

  const tiebreakers = source.tiebreakers === undefined
    ? [...DEFAULT_PHASE_GROUP_RULES.tiebreakers]
    : source.tiebreakers;

  if (!Array.isArray(tiebreakers)) {
    throw new Error("tiebreakers debe ser un arreglo.");
  }

  const qualification = source.qualification === undefined
    ? DEFAULT_PHASE_GROUP_RULES.qualification
    : source.qualification;

  if (qualification !== null && !isPlainObject(qualification)) {
    throw new Error("qualification debe ser un objeto o null.");
  }

  return {
    version,
    competition: {
      rounds
    },
    scoring: {
      win,
      draw,
      loss
    },
    standings: {
      enabled: standings.enabled === undefined
        ? DEFAULT_PHASE_GROUP_RULES.standings.enabled
        : standings.enabled
    },
    tiebreakers: cloneValue(tiebreakers),
    qualification: cloneValue(qualification)
  };
}

function countPhaseGroupParticipants(phaseGroup) {
  if (Array.isArray(phaseGroup?.participants)) {
    return phaseGroup.participants.length;
  }

  if (phaseGroup?.participants && typeof phaseGroup.participants === "object") {
    return Object.keys(phaseGroup.participants).length;
  }

  return 0;
}

function assertCompetitionPhaseStructure(
  phases,
  phaseId,
  structureId,
  { required = true } = {}
) {
  const phase = phases.find((item) => item?.id === phaseId);

  if (!phase) {
    throw new Error("No se encontró la fase seleccionada.");
  }

  const structure = Array.isArray(phase.structures)
    ? phase.structures.find((item) => item?.id === structureId)
    : null;

  if (!structure && required) {
    throw new Error("No se encontró la estructura seleccionada dentro de esta fase.");
  }

  return { phase, structure: structure || null };
}

function normalizePhaseGroupStructureAssociation({
  phase,
  structure,
  phaseGroupId
}) {
  if (!structure?.id) {
    throw new Error("Un pool debe pertenecer a una estructura válida de su fase.");
  }

  const structurePhaseId = String(structure.phaseId || phase?.id || "").trim();
  if (structurePhaseId !== String(phase?.id || "").trim()) {
    throw new Error("La estructura seleccionada no pertenece a esta fase.");
  }

  const normalizedGroupId = String(phaseGroupId || "").trim();
  if (!normalizedGroupId) {
    throw new Error("No se pudo identificar el pool.");
  }

  return {
    phaseId: phase.id,
    structureId: structure.id,
    phaseGroupId: normalizedGroupId
  };
}

export async function saveCompetitionPhaseGroupConfiguration({
  tournamentId,
  eventId,
  event,
  phaseId,
  phaseGroupId,
  name,
  structureId = null,
  rules = null,
  status = null
}) {
  const pro = ensureTournamentProState(event);
  assertCompetitionSetupEditable(event, pro);

  const expectedPhases = cloneValue(getStoredCompetitionPhases(event));
  const phases = (pro.phases || []).map((phase) => ({
    ...phase,
    phaseGroups: Array.isArray(phase?.phaseGroups)
      ? phase.phaseGroups.map((group) => ({ ...group }))
      : [],
    structures: Array.isArray(phase?.structures)
      ? phase.structures.map((structure) => ({ ...structure }))
      : []
  }));

  preserveLegacyMainCompetition(phases, { eventId, event, pro });

  const phase = phases.find((item) => item?.id === phaseId);
  if (!phase) {
    throw new Error("Guarda una fase antes de configurar sus pools.");
  }

  const groups = Array.isArray(phase.phaseGroups)
    ? phase.phaseGroups
    : [];

  const id = String(phaseGroupId || "").trim();
  if (!id) {
    throw new Error("No se pudo identificar el pool.");
  }

  const normalizedName = normalizeCompetitionSetupName(name, "el pool");

  if (
    groups.some(
      (group) =>
        group?.id !== id &&
        String(group?.name || "").trim().toLowerCase() === normalizedName.toLowerCase()
    )
  ) {
    throw new Error("Ya existe un pool con ese nombre en esta fase.");
  }

  const groupIndex = groups.findIndex((group) => group?.id === id);
  const existing = groupIndex >= 0 ? groups[groupIndex] : null;

  const requestedStructureId = String(
    structureId ?? existing?.structureId ?? ""
  ).trim();

  const { structure } = assertCompetitionPhaseStructure(
    phases,
    phaseId,
    requestedStructureId
  );

  const association = normalizePhaseGroupStructureAssociation({
    phase,
    structure,
    phaseGroupId: id
  });

  const nextGroup = {
    ...(existing || {}),
    id: association.phaseGroupId,
    phaseId: association.phaseId,
    structureId: association.structureId,
    name: normalizedName,
    order: existing?.order || groups.length + 1,
    participants: Array.isArray(existing?.participants)
      ? existing.participants
      : (existing?.participants && typeof existing.participants === "object"
        ? existing.participants
        : []),
    rules: normalizePhaseGroupRulesValue(
      rules,
      existing?.rules || {}
    ),
    status: String(status || existing?.status || "configured")
  };

  if (groupIndex >= 0) {
    groups[groupIndex] = nextGroup;
  } else {
    groups.push(nextGroup);
  }

  groups.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  phase.phaseGroups = groups.map((group, index) => ({
    ...group,
    phaseId: phase.id,
    order: index + 1
  }));

  pro.phases = phases;

  return persistCompetitionPhasesSafely({
    tournamentId,
    eventId,
    expectedPhases,
    nextPhases: pro.phases
  });
}

export async function moveCompetitionPhaseGroupConfiguration({
  tournamentId,
  eventId,
  event,
  phaseId,
  phaseGroupId,
  direction
}) {
  const pro = ensureTournamentProState(event);
  assertCompetitionSetupEditable(event, pro);

  const expectedPhases = cloneValue(getStoredCompetitionPhases(event));
  const phases = (pro.phases || []).map((phase) => ({
    ...phase,
    phaseGroups: Array.isArray(phase?.phaseGroups)
      ? [...phase.phaseGroups]
      : [],
    structures: Array.isArray(phase?.structures)
      ? [...phase.structures]
      : []
  }));

  const phase = phases.find((item) => item?.id === phaseId);
  if (!phase) {
    throw new Error("Fase no encontrada.");
  }

  const groups = Array.isArray(phase.phaseGroups)
    ? [...phase.phaseGroups]
    : [];

  const index = groups.findIndex((group) => group?.id === phaseGroupId);
  const target =
    index +
    (
      direction === "up"
        ? -1
        : direction === "down"
          ? 1
          : 0
    );

  if (
    index < 0 ||
    target < 0 ||
    target >= groups.length ||
    target === index
  ) {
    return { ...event, pro };
  }

  [groups[index], groups[target]] = [groups[target], groups[index]];

  phase.phaseGroups = groups.map((group, groupIndex) => ({
    ...group,
    phaseId: phase.id,
    order: groupIndex + 1
  }));

  pro.phases = phases;

  return persistCompetitionPhasesSafely({
    tournamentId,
    eventId,
    expectedPhases,
    nextPhases: pro.phases
  });
}

export async function deleteCompetitionPhaseGroupConfiguration({
  tournamentId,
  eventId,
  event,
  phaseId,
  phaseGroupId
}) {
  const pro = ensureTournamentProState(event);
  assertCompetitionSetupEditable(event, pro);

  const expectedPhases = cloneValue(getStoredCompetitionPhases(event));
  const phases = (pro.phases || []).map((phase) => ({
    ...phase,
    phaseGroups: Array.isArray(phase?.phaseGroups)
      ? phase.phaseGroups.map((group) => ({ ...group }))
      : [],
    structures: Array.isArray(phase?.structures)
      ? phase.structures.map((structure) => ({ ...structure }))
      : []
  }));

  const phase = phases.find((item) => item?.id === phaseId);
  if (!phase) {
    throw new Error("Fase no encontrada.");
  }

  const groups = Array.isArray(phase.phaseGroups)
    ? phase.phaseGroups
    : [];

  const groupIndex = groups.findIndex((group) => group?.id === phaseGroupId);
  if (groupIndex < 0) {
    throw new Error("Pool no encontrado.");
  }

  const group = groups[groupIndex];

  if (countPhaseGroupParticipants(group) > 0) {
    throw new Error("No puedes eliminar un pool que todavía tiene participantes asignados.");
  }

  const referencedByStructure = (phase.structures || []).some((structure) => {
    if (Array.isArray(structure?.phaseGroupIds) && structure.phaseGroupIds.includes(phaseGroupId)) {
      return true;
    }

    if (Array.isArray(structure?.slots)) {
      return structure.slots.some((slot) => slot?.phaseGroupId === phaseGroupId);
    }

    return false;
  });

  if (referencedByStructure) {
    throw new Error("No puedes eliminar un pool que todavía está referenciado por la estructura.");
  }

  phase.phaseGroups = groups
    .filter((candidate) => candidate?.id !== phaseGroupId)
    .map((candidate, index) => ({
      ...candidate,
      phaseId: phase.id,
      order: index + 1
    }));

  pro.phases = phases;

  return persistCompetitionPhasesSafely({
    tournamentId,
    eventId,
    expectedPhases,
    nextPhases: pro.phases
  });
}


/**
 * Materializes the operational Match projection from the declarative
 * Competition Structure.
 *
 * Architectural boundary:
 *   Structure definition -> Competition Core blueprint -> materialized Matches
 *
 * The Structure remains authoritative for rounds, slots and configuration.
 * The generated Matches stored inside round.matches are a compatibility /
 * operational projection used by the current Tournament Pro UI and legacy
 * runtime. They must never be treated as the source of truth for building
 * or editing the Structure.
 *
 * This function intentionally remains local to Operations in C.3:
 * - it does not move Match persistence to another module yet;
 * - it does not change the existing SE/DE generator;
 * - it does not alter legacy bracket operations, lobbies or results;
 * - it keeps the current persisted round.matches projection synchronized.
 */
function materializeCompetitionStructureMatches({ event, pro, phases, phase, structure }) {
  const generated = generateCompetitionBracket({
    ...event,
    pro: { ...pro, phases }
  }, { phaseId: phase.id, structureId: structure.id });
  if (generated.status !== "READY" || generated.matches.length === 0) {
    throw new Error(`No se pudo materializar el cuadro: ${(generated.reasonCodes || []).join(", ") || generated.status}.`);
  }

  const matchesByRoundId = new Map();
  generated.matches.forEach((match) => {
    const roundMatches = matchesByRoundId.get(match.roundId) || [];
    const participantA = Array.isArray(match.participants)
      ? match.participants[0] || null
      : match.participants?.A || null;
    const participantB = Array.isArray(match.participants)
      ? match.participants[1] || null
      : match.participants?.B || null;
    roundMatches.push({
      ...match,
      entryAId: participantA?.entryId || match.entryAId || null,
      participantAId: participantA?.participantId || match.participantAId || null,
      entryBId: participantB?.entryId || match.entryBId || null,
      participantBId: participantB?.participantId || match.participantBId || null,
      matchSystem: structure.matchFormat || phase.matchFormat || phase.matchSystem || pro.matchSystem || event?.matchSystem || null
    });
    matchesByRoundId.set(match.roundId, roundMatches);
  });

  structure.rounds = structure.rounds.map((round) => {
    const matches = matchesByRoundId.get(round.id) || [];
    return {
      ...round,
      matches,
      matchCount: matches.length,
      matchIds: matches.map((match) => match.id),
      source: "competition-core",
      materialization: "BLUEPRINT"
    };
  });
  phase.structures = phase.structures.map((item) => item.id === structure.id ? structure : item);
  return generated;
}

export async function prepareCompetitionStructureBracket({
  tournamentId,
  eventId,
  event,
  phaseId,
  structureId
}) {
  const pro = ensureTournamentProState(event);
  assertCompetitionSetupEditable(event, pro);
  const expectedPhases = cloneValue(getStoredCompetitionPhases(event));
  const phases = (pro.phases || []).map((phase) => ({
    ...phase,
    structures: Array.isArray(phase?.structures)
      ? phase.structures.map((structure) => ({ ...structure }))
      : []
  }));
  const phase = phases.find((item) => item?.id === phaseId);
  const structure = phase?.structures?.find((item) => item?.id === structureId);
  if (!phase || !structure) throw new Error("No se encontró la fase o estructura seleccionada.");
  if ((structure.rounds || []).length || (structure.slots || []).length) {
    throw new Error("Esta estructura ya tiene rondas o posiciones preparadas.");
  }

  const capacity = Number(pro.capacity?.value ?? pro.capacity ?? event?.capacity?.value ?? event?.capacity);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 256 || (capacity & (capacity - 1)) !== 0) {
    throw new Error("Por ahora, Competition Core requiere una capacidad de 2, 4, 8, 16, 32, 64, 128 o 256 participantes para preparar este formato.");
  }

  const structureType = normalizeStructureTypeValue(structure.type);
  const specs = getCompetitionEliminationRoundSpecs(structureType, capacity);
  if (!Array.isArray(specs) || !specs.length) {
    throw new Error("No se pudo crear el recorrido de rondas para esta estructura.");
  }
  const roundSpecs = specs.map((spec) => ({
    ...spec,
    name: spec.bracket === "grand_final" ? "Gran final" : `Ronda ${spec.number}`,
    type: spec.bracket === "grand_final" ? "GRAND_FINAL" : "ELIMINATION"
  }));

  const rounds = roundSpecs.map((spec, index) => ({
    id: `${structure.id}-round-${spec.bracket}-r${spec.number}`,
    phaseId,
    structureId,
    order: index + 1,
    number: spec.number,
    name: spec.name,
    type: spec.type,
    bracket: spec.bracket,
    status: "configured",
    matchCount: spec.matchCount,
    matches: []
  }));
  const firstRound = rounds.find((round) => round.bracket === "winners" && round.number === 1);
  const slots = Array.from({ length: capacity }, (_, index) => ({
    id: `${structure.id}-slot-${index + 1}`,
    phaseId,
    structureId,
    roundId: firstRound.id,
    position: index + 1,
    order: index + 1,
    seed: null,
    entryId: null,
    participantId: null,
    type: "EMPTY",
    status: "EMPTY",
    bracket: "winners"
  }));

  structure.rounds = rounds;
  structure.slots = slots;
  phase.structures = phase.structures.map((item) => item.id === structureId ? structure : item);
  materializeCompetitionStructureMatches({ event, pro, phases, phase, structure });

  return persistCompetitionPhasesSafely({
    tournamentId,
    eventId,
    expectedPhases,
    nextPhases: phases
  });
}

export async function assignCompetitionEntryToStructureSlot({
  tournamentId,
  eventId,
  event,
  phaseId,
  structureId,
  slotId,
  entryId
}) {
  const pro = ensureTournamentProState(event);
  assertCompetitionSetupEditable(event, pro);
  const expectedPhases = cloneValue(getStoredCompetitionPhases(event));
  const phases = cloneValue(getStoredCompetitionPhases(event));
  const phase = phases?.find((item) => item?.id === phaseId);
  const structure = phase?.structures?.find((item) => item?.id === structureId);
  const slot = structure?.slots?.find((item) => item?.id === slotId);
  if (!phase || !structure || !slot) throw new Error("No se encontró la posición seleccionada.");
  if (!(structure.rounds || []).length || !(structure.slots || []).length) {
    throw new Error("Primero prepara las rondas y posiciones de esta estructura.");
  }
  if ((structure.rounds || []).some((round) => (round.matches || []).some((match) => ["LIVE", "COMPLETED"].includes(String(match?.status || "").toUpperCase())))) {
    throw new Error("No se pueden cambiar participantes después de iniciar un partido.");
  }

  const normalizedEntryId = String(entryId || "").trim() || null;
  const entry = normalizedEntryId ? pro.entries?.[normalizedEntryId] : null;
  const participantId = entry?.legacyParticipantId || null;
  const participant = participantId ? pro.participants?.[participantId] : null;
  if (normalizedEntryId && (!entry || !participant)) {
    throw new Error("No se encontró el participante seleccionado. Recarga el torneo e inténtalo de nuevo.");
  }
  const inactiveStatuses = new Set(["withdrawn", "eliminated", "dq", "rejected", "no_show"]);
  if (entry && (inactiveStatuses.has(String(entry.status || "").toLowerCase()) || inactiveStatuses.has(String(participant.status || "").toLowerCase()))) {
    throw new Error("Ese participante ya no está activo en la competencia.");
  }

  if (entry) {
    const duplicateSlot = structure.slots.find((candidate) =>
      candidate.id !== slot.id && (
        candidate.entryId === normalizedEntryId ||
        (participantId && candidate.participantId === participantId)
      )
    );
    if (duplicateSlot) throw new Error("Ese participante ya ocupa otra posición de esta estructura.");
  }

  slot.entryId = normalizedEntryId;
  slot.participantId = normalizedEntryId ? participantId : null;
  slot.type = normalizedEntryId ? "ENTRY" : "EMPTY";
  slot.status = normalizedEntryId ? "ASSIGNED" : "EMPTY";
  slot.updatedAt = new Date().toISOString();
  materializeCompetitionStructureMatches({ event, pro, phases, phase, structure });

  return persistCompetitionPhasesSafely({
    tournamentId,
    eventId,
    expectedPhases,
    nextPhases: phases
  });
}

export async function moveCompetitionStructureConfiguration({
  tournamentId,
  eventId,
  event,
  phaseId,
  structureId,
  direction
}) {
  const pro = ensureTournamentProState(event);
  assertCompetitionSetupEditable(event, pro);
  const expectedPhases = cloneValue(getStoredCompetitionPhases(event));
  const phases = (pro.phases || []).map((item) => ({
    ...item,
    structures: Array.isArray(item?.structures) ? [...item.structures] : []
  }));
  const phase = phases.find((item) => item?.id === phaseId);
  if (!phase) throw new Error("Fase no encontrada.");
  const structures = Array.isArray(phase.structures) ? [...phase.structures] : [];
  const index = structures.findIndex((item) => item?.id === structureId);
  const target = index + (direction === "up" ? -1 : direction === "down" ? 1 : 0);
  if (index < 0 || target < 0 || target >= structures.length || target === index) return { ...event, pro };

  [structures[index], structures[target]] = [structures[target], structures[index]];
  phase.structures = structures.map((structure, structureIndex) => ({ ...structure, order: structureIndex + 1 }));
  pro.phases = phases;
  return persistCompetitionPhasesSafely({
    tournamentId,
    eventId,
    expectedPhases,
    nextPhases: pro.phases
  });
}


async function savePro(tournamentId, eventId, event, pro) {
  await updateMapEntity(
    "tournaments",
    tournamentId,
    "events",
    eventId,
    { pro }
  );
  return { ...event, pro };
}

function saveProOptimistic(
  tournamentId,
  eventId,
  event,
  pro,
  { onPersistenceSettled = null } = {}
) {
  const nextEvent = { ...event, pro };

  void updateMapEntity(
    "tournaments",
    tournamentId,
    "events",
    eventId,
    { pro }
  )
    .then(() => {
      if (typeof onPersistenceSettled === "function") {
        return onPersistenceSettled({
          success: true,
          error: null
        });
      }
      return null;
    })
    .catch((error) => {
      console.error(
        "ARKHAM — Error persistiendo operación optimista de Tournament Pro:",
        error
      );

      if (typeof onPersistenceSettled === "function") {
        return onPersistenceSettled({
          success: false,
          error
        });
      }

      return null;
    });

  return nextEvent;
}

export async function searchTournamentEntities(type, term = "") {
  const collection = type === "team" ? "teams" : "players";
  const normalized = String(term || "").trim().toLowerCase();
  if (!normalized) return [];

  const entities = await getEntities(collection);
  return entities
    .filter((entity) => {
      const haystack = [
        entity.id,
        entity.name,
        entity.lastName,
        entity.gamertag,
        entity.shortName
      ].filter(Boolean).join(" ").toLowerCase();

      return haystack.includes(normalized);
    })
    .slice(0, 20);
}

function ensureStationState(pro, event) {
  const stations = getCompetitionStations({ ...event, pro });
  const normalizedStations = stations.map((station, index) => normalizeStation(station, {
    mode: getCompetitionDeliveryMode(event),
    order: index + 1
  }));

  const matches = (pro?.bracket?.stages || [])
    .flatMap((stage) => Array.isArray(stage?.matches) ? stage.matches : []);

  const matchesById = new Map(
    matches
      .filter((match) => match?.id)
      .map((match) => [match.id, match])
  );

  const assignedMatchIds = new Set();

  normalizedStations.forEach((station) => {
    const matchId = station.currentMatchId || null;

    if (!matchId) {
      station.currentMatchId = null;
      station.status = STATION_STATUS.AVAILABLE;
      return;
    }

    const match = matchesById.get(matchId);

    // A station may never keep a reference to a Match that no longer exists
    // in the operational bracket, nor to a completed/BYE Match.
    if (
      !match ||
      [MATCH_STATUS.COMPLETED, MATCH_STATUS.BYE].includes(match.status) ||
      assignedMatchIds.has(matchId)
    ) {
      station.currentMatchId = null;
      station.status = STATION_STATUS.AVAILABLE;
      return;
    }

    // A Match can occupy only one station. The first normalized station wins;
    // duplicate references are released deterministically.
    assignedMatchIds.add(matchId);

    if (match.status === MATCH_STATUS.PENDING) {
      const lifecycle = getMatchLifecycle(match);

      // A pending Match with a station is operationally CALLED. Recover the
      // lifecycle if the station survived persistence but calledAt did not.
      if (lifecycle === MATCH_LIFECYCLE.READY) {
        const calledMatch = callMatchLifecycle(match);
        Object.assign(match, {
          calledAt: calledMatch.calledAt
        });
      } else if (lifecycle !== MATCH_LIFECYCLE.CALLED) {
        station.currentMatchId = null;
        station.status = STATION_STATUS.AVAILABLE;
        assignedMatchIds.delete(matchId);
        return;
      }

      station.status = STATION_STATUS.ASSIGNED;
      return;
    }

    if (match.status === MATCH_STATUS.LIVE) {
      station.status = STATION_STATUS.IN_PROGRESS;
      return;
    }

    station.currentMatchId = null;
    station.status = STATION_STATUS.AVAILABLE;
    assignedMatchIds.delete(matchId);
  });

  // A CALLED Match without a real station cannot remain invisible in the
  // READY queue. Revert it to READY so the organizer can assign it again.
  matches.forEach((match) => {
    if (
      match?.status === MATCH_STATUS.PENDING &&
      getMatchLifecycle(match) === MATCH_LIFECYCLE.CALLED &&
      !assignedMatchIds.has(match.id)
    ) {
      const readyMatch = uncallMatchLifecycle(match);
      Object.keys(match).forEach((key) => {
        if (!(key in readyMatch)) delete match[key];
      });
      Object.assign(match, readyMatch);
    }
  });

  pro.stations = normalizedStations;
  return pro.stations;
}

function getMatchWithStation(pro, matchId) {
  const station = (pro.stations || []).find((item) => item.currentMatchId === matchId);
  return station || null;
}

function assertStationAssignable(pro, match) {
  if (!match) throw new Error("Match no encontrado.");
  if (match.status !== MATCH_STATUS.PENDING) {
    throw new Error("Solo puedes asignar una estación a un match pendiente.");
  }

  const lifecycle = getMatchLifecycle(match);
  if (
    lifecycle !== MATCH_LIFECYCLE.READY &&
    lifecycle !== MATCH_LIFECYCLE.CALLED
  ) {
    throw new Error("Solo puedes asignar una estación a un match listo para operar.");
  }

  validateMatchParticipants(pro, match);
}

function assignStationInMemory(pro, matchId, stationId) {
  const stations = pro.stations || [];
  const match = findMatch(pro.bracket, matchId);
  assertStationAssignable(pro, match);

  const target = stations.find((station) => station.id === stationId);
  if (!target) throw new Error("Estación no encontrada.");

  if (target.currentMatchId && target.currentMatchId !== matchId) {
    throw new Error("La estación ya está asignada a otro match.");
  }

  stations.forEach((station) => {
    if (station.currentMatchId === matchId && station.id !== stationId) {
      station.currentMatchId = null;
      station.status = STATION_STATUS.AVAILABLE;
    }
  });

  const lifecycle = getMatchLifecycle(match);

  target.currentMatchId = matchId;
  target.status = STATION_STATUS.ASSIGNED;

  // Station assignment is the operational moment in which a READY Match
  // becomes CALLED. If the Match is already CALLED, changing its Station/Lobby
  // only moves the operational resource; it must not create a new lifecycle
  // transition or discard the original calledAt timestamp.
  if (lifecycle === MATCH_LIFECYCLE.READY) {
    const calledMatch = callMatchLifecycle(match);
    Object.assign(match, {
      calledAt: calledMatch.calledAt
    });
  }

  return target;
}

function releaseStationInMemory(pro, matchId) {
  const station = getMatchWithStation(pro, matchId);
  const match = findMatch(pro.bracket, matchId);

  // Releasing the operational resource also clears CALLED when the Match is
  // still pending. This keeps the queue authoritative: no station means the
  // Match must be visible as READY again.
  if (match && getMatchLifecycle(match) === MATCH_LIFECYCLE.CALLED) {
    const readyMatch = uncallMatchLifecycle(match);
    Object.keys(match).forEach((key) => {
      if (!(key in readyMatch)) delete match[key];
    });
    Object.assign(match, readyMatch);
  }

  if (!station) return null;

  station.currentMatchId = null;
  station.status = STATION_STATUS.AVAILABLE;
  return station;
}

function autoAssignInitialRoundStations(pro, event) {
  ensureStationState(pro, event);

  const availableStations = (pro.stations || [])
    .filter((station) => !station.currentMatchId && station.status === STATION_STATUS.AVAILABLE)
    .sort((a, b) => a.number - b.number);

  if (!availableStations.length) return [];

  const initialMatches = (pro.bracket?.stages || [])
    .filter((stage) => stage?.bracket === "winners" && Number(stage.number) === 1)
    .flatMap((stage) => stage.matches || [])
    .filter((match) => (
      match?.status === MATCH_STATUS.PENDING &&
      match?.participantAId &&
      match?.participantBId &&
      !getMatchWithStation(pro, match.id)
    ));

  const assignments = [];
  initialMatches.forEach((match, index) => {
    const station = availableStations[index];
    if (!station) return;
    station.currentMatchId = match.id;
    station.status = STATION_STATUS.ASSIGNED;

    const calledMatch = callMatchLifecycle(match);
    Object.assign(match, {
      calledAt: calledMatch.calledAt
    });

    assignments.push({ stationId: station.id, matchId: match.id });
  });

  if (assignments.length) {
    pro.stationAutoAssignment = {
      mode: "INITIAL_ROUND",
      assignedAt: new Date().toISOString(),
      assignments
    };
  }

  return assignments;
}

export async function createCompetitionStation({
  tournamentId,
  eventId,
  event
}) {
  const pro = ensureTournamentProState(event);
  const stations = ensureStationState(pro, event);
  const mode = getCompetitionDeliveryMode(event);
  const nextNumber = stations.reduce((max, station) => Math.max(max, Number(station.number) || 0), 0) + 1;
  const station = normalizeStation({
    id: `${mode === STATION_TYPES.PHYSICAL ? "station" : "lobby"}-${nextNumber}`,
    number: nextNumber,
    type: mode,
    name: `${mode === STATION_TYPES.PHYSICAL ? "Station" : "Lobby"} ${nextNumber}`,
    status: STATION_STATUS.AVAILABLE,
    currentMatchId: null,
    assignedStaffIds: []
  }, { mode, order: nextNumber });

  pro.stations.push(station);
  return savePro(tournamentId, eventId, event, pro);
}

export async function assignMatchToStation({
  tournamentId,
  eventId,
  event,
  matchId,
  stationId
}) {
  const pro = ensureTournamentProState(event);
  ensureStationState(pro, event);
  if (pro.status !== TOURNAMENT_EVENT_STATUS.LIVE) {
    throw new Error("Solo puedes asignar estaciones cuando el evento está en vivo.");
  }

  if (!stationId) {
    throw new Error("Selecciona una estación.");
  }

  assignStationInMemory(pro, matchId, stationId);
  return savePro(tournamentId, eventId, event, pro);
}

export async function releaseMatchStation({
  tournamentId,
  eventId,
  event,
  matchId
}) {
  const pro = ensureTournamentProState(event);
  ensureStationState(pro, event);
  const match = findMatch(pro.bracket, matchId);
  assertStationAssignable(pro, match);
  releaseStationInMemory(pro, matchId);
  return savePro(tournamentId, eventId, event, pro);
}

export async function prepareBracket({ tournamentId, eventId, event }) {
  const pro = ensureTournamentProState(event);
  const validation = validateCompetitionConfiguration({
    gameId: event?.gameId,
    competitionOption: event?.competitionOption,
    participationType: event?.participationType,
    format: pro.format || event?.format,
    matchSystem: pro.matchSystem || event?.matchSystem,
    capacity: pro.capacity?.value || pro.capacity || event?.capacity?.value || event?.capacity
  });

  if (validation.status === COMPETITION_CONFIGURATION_STATUS.INVALID) {
    throw new Error(
      `La configuración competitiva no es válida: ${validation.errors.join(" ")}`
    );
  }

  if (validation.status === COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED) {
    throw new Error(
      `El formato "${event?.format || "seleccionado"}" todavía no está disponible para ejecutar este torneo. Tu configuración se conservará sin cambios.`
    );
  }

  if ([TOURNAMENT_EVENT_STATUS.LIVE, TOURNAMENT_EVENT_STATUS.FINISHED].includes(pro.status)) {
    throw new Error("No puedes preparar el bracket después de iniciar el evento.");
  }

  const capacity = pro.capacity?.value || pro.capacity || event.capacity?.value || event.capacity;

  if (!Number(capacity) || Number(capacity) < 2) {
    throw new Error("La capacidad del torneo debe ser de al menos 2 participantes.");
  }

  pro.bracket = buildBracket(
    [],
    capacity,
    pro.format || event.format,
    pro.matchSystem || event?.matchSystem || null
  );

  pro.checkIn = {
    status: "unopened",
    opened: false,
    completed: false,
    openedAt: null,
    completedAt: null
  };

  return savePro(tournamentId, eventId, event, pro);
}

export async function addParticipantToSlot({
  tournamentId,
  eventId,
  event,
  slotId,
  entityType,
  entityId = null,
  displayName,
  manual = false
}) {
  const pro = ensureTournamentProState(event);

  if (!pro.bracket?.generated) {
    throw new Error("Primero prepara el bracket del torneo.");
  }

  if (pro.checkIn?.completed) {
    throw new Error("El check-in ya fue finalizado. Los nombres y posiciones del bracket están bloqueados.");
  }

  const slot = pro.bracket.slots?.[slotId];

  if (!slot) {
    throw new Error("La posición seleccionada no existe.");
  }

  if (slot.participantId) {
    throw new Error("Esta posición ya está ocupada.");
  }

  const participantId = `${entityType}_${entityId || crypto.randomUUID()}`;

  if (pro.participants[participantId]) {
    throw new Error("El participante ya está agregado al torneo.");
  }

  const capacity = Number(
    pro.capacity?.value ||
    pro.capacity ||
    event.capacity?.value ||
    event.capacity
  );

  const occupiedSlotCount = Object.values(pro.bracket.slots || {})
    .filter((slot) => Boolean(slot?.participantId))
    .length;

  if (capacity > 0 && occupiedSlotCount >= capacity) {
    throw new Error("La capacidad del torneo ya está completa.");
  }

  const participant = createParticipant({
    participantId,
    entityType,
    entityId,
    displayName,
    manual
  });

  participant.status = PARTICIPANT_STATUS.APPROVED;
  participant.seed = slot.seed;
  participant.slotIds = [slotId];
  participant.updatedAt = new Date().toISOString();

  pro.participants[participantId] = participant;
  slot.participantId = participantId;
  const entry = ensurePersistentEntry(pro, participant, { competitionId: eventId });
  slot.entryId = entry?.id || `entry_${participantId}`;
  pro.registration.status = "open";

  syncFirstRoundFromSlots(pro);

  return savePro(tournamentId, eventId, event, pro);
}

export async function replaceParticipantInSlot({
  tournamentId,
  eventId,
  event,
  slotId,
  participantId,
  entityType,
  entityId = null,
  displayName,
  manual = false
}) {
  const pro = ensureTournamentProState(event);
  participantId = resolveParticipantId(pro, participantId);

  if (!pro.checkIn?.opened || pro.checkIn?.completed) {
    throw new Error("El reemplazo solo puede hacerse mientras el check-in está abierto.");
  }

  const slot = pro.bracket?.slots?.[slotId];

  if (!slot) {
    throw new Error("La posición seleccionada no existe.");
  }

  const currentParticipant = pro.participants?.[participantId];

  if (!currentParticipant) {
    throw new Error("El participante que será reemplazado no existe.");
  }

  if (slot.participantId !== participantId) {
    throw new Error("La posición ya no corresponde al participante seleccionado.");
  }

  const newParticipantId = `${entityType}_${entityId || crypto.randomUUID()}`;

  if (pro.participants[newParticipantId]) {
    throw new Error("El participante ya está agregado al torneo.");
  }

  const replacement = createParticipant({
    participantId: newParticipantId,
    entityType,
    entityId,
    displayName,
    manual
  });

  replacement.status = PARTICIPANT_STATUS.APPROVED;
  replacement.checkIn = false;
  replacement.seed = slot.seed;
  replacement.slotIds = [slotId];
  replacement.updatedAt = new Date().toISOString();

  currentParticipant.status = currentParticipant.status === PARTICIPANT_STATUS.NO_SHOW
    ? PARTICIPANT_STATUS.NO_SHOW
    : PARTICIPANT_STATUS.WITHDRAWN;

  currentParticipant.checkIn = false;
  currentParticipant.replacedAt = new Date().toISOString();
  currentParticipant.replacedByParticipantId = newParticipantId;
  currentParticipant.updatedAt = new Date().toISOString();

  pro.participants[newParticipantId] = replacement;
  slot.participantId = newParticipantId;
  const replacementEntry = ensurePersistentEntry(pro, replacement, { competitionId: eventId });
  slot.entryId = replacementEntry?.id || `entry_${newParticipantId}`;
  syncFirstRoundFromSlots(pro);
  applyBracketByes(pro.bracket);

  ensurePersistentEntry(pro, currentParticipant, { competitionId: eventId });
  return savePro(tournamentId, eventId, event, pro);
}

export async function addParticipant({
  tournamentId,
  eventId,
  event,
  entityType,
  entityId = null,
  displayName,
  manual = false
}) {
  const pro = ensureTournamentProState(event);

  if (pro.checkIn?.completed) {
    throw new Error("El check-in ya fue finalizado. No puedes agregar ni cambiar participantes.");
  }

  const participantId = `${entityType}_${entityId || crypto.randomUUID()}`;

  if (pro.participants[participantId]) {
    throw new Error("El participante ya está agregado al torneo.");
  }

  const activeCount = Object.values(pro.participants)
    .filter((participant) => ![
      PARTICIPANT_STATUS.REJECTED,
      PARTICIPANT_STATUS.WITHDRAWN,
      PARTICIPANT_STATUS.NO_SHOW
    ].includes(participant.status))
    .length;

  const capacity = Number(
    pro.capacity?.value ||
    pro.capacity ||
    event.capacity?.value ||
    event.capacity
  );

  if (capacity > 0 && activeCount >= capacity) {
    throw new Error("La capacidad del torneo ya está completa.");
  }

  const participant = createParticipant({
    participantId,
    entityType,
    entityId,
    displayName,
    manual
  });

  pro.participants[participantId] = participant;
  ensurePersistentEntry(pro, participant, { competitionId: eventId });
  pro.registration.status = "open";

  return savePro(tournamentId, eventId, event, pro);
}

export async function updateParticipantStatus({
  tournamentId,
  eventId,
  event,
  participantId,
  status
}) {
  const pro = ensureTournamentProState(event);
  participantId = resolveParticipantId(pro, participantId);
  const participant = pro.participants[participantId];

  if (!participant) {
    throw new Error("Participante no encontrado.");
  }

  const allowed = Object.values(PARTICIPANT_STATUS);

  if (!allowed.includes(status)) {
    throw new Error("Estado de participante inválido.");
  }

  if (
    participant.status === PARTICIPANT_STATUS.NO_SHOW &&
    status !== PARTICIPANT_STATUS.APPROVED
  ) {
    throw new Error("Un no-show debe reactivarse como aprobado antes de continuar.");
  }

  participant.status = status;
  participant.updatedAt = new Date().toISOString();

  if (status === PARTICIPANT_STATUS.CHECKED_IN) {
    participant.checkIn = true;
  }

  if (status === PARTICIPANT_STATUS.NO_SHOW) {
    participant.checkIn = false;
  }

  if (
    status === PARTICIPANT_STATUS.NO_SHOW &&
    pro.bracket?.generated
  ) {
    releaseNoShowFromBracket(pro.bracket, participantId);
  }

  ensurePersistentEntry(pro, participant, { competitionId: eventId });
  return savePro(tournamentId, eventId, event, pro);
}

export async function setParticipantCheckIn({
  tournamentId,
  eventId,
  event,
  participantId,
  present = true
}) {
  const pro = ensureTournamentProState(event);
  participantId = resolveParticipantId(pro, participantId);

  if (!pro.checkIn.opened) {
    throw new Error("El check-in todavía no está abierto.");
  }

  const participant = pro.participants[participantId];

  if (!participant) {
    throw new Error("Participante no encontrado.");
  }

  if (
    [
      PARTICIPANT_STATUS.REJECTED,
      PARTICIPANT_STATUS.WITHDRAWN
    ].includes(participant.status)
  ) {
    throw new Error("Este participante no puede hacer check-in.");
  }

  participant.checkIn = Boolean(present);

  participant.status = present
    ? PARTICIPANT_STATUS.CHECKED_IN
    : PARTICIPANT_STATUS.NO_SHOW;

  participant.updatedAt = new Date().toISOString();

  if (!present && pro.bracket?.generated) {
    releaseNoShowFromBracket(pro.bracket, participantId);
    syncFirstRoundFromSlots(pro);
    applyBracketByes(pro.bracket);
  }

  ensurePersistentEntry(pro, participant, { competitionId: eventId });
  return savePro(tournamentId, eventId, event, pro);
}

export async function approveParticipationRequest({
  tournamentId,
  eventId,
  event,
  requestId,
  approve = true,
  rejectionReason = ""
}) {
  const pro = ensureTournamentProState(event);

  if (pro.checkIn?.completed) {
    throw new Error("El check-in ya fue finalizado. La lista de participantes está bloqueada.");
  }

  const request = pro.registration.requests?.[requestId];

  if (!request) {
    throw new Error("Solicitud no encontrada.");
  }

  // ========================================
  // RECHAZAR
  // ========================================

  if (!approve) {
    request.status = "rejected";
    request.reviewedAt = new Date().toISOString();
    request.rejectionReason = String(rejectionReason || "").trim();

    return savePro(tournamentId, eventId, event, pro);
  }

  // ========================================
  // APROBAR
  // ========================================

  const participantId =
    request.participantId ||
    `request_${requestId}`;

  let participant = pro.participants?.[participantId];

  // Si todavía no existe, creamos el participante.
  if (!participant) {
    participant = createParticipant({
      participantId,
      entityType: request.entityType || "manual",
      entityId: request.entityId || null,
      displayName: request.displayName,
      manual: !request.entityId
    });

    pro.participants[participantId] = participant;
  }

  ensurePersistentEntry(pro, participant, { competitionId: eventId });

  // ========================================
  // ASIENTO AUTOMÁTICO EN BRACKET
  // ========================================
  //
  // La aprobación representa un asiento real.
  //
  // Si el bracket ya fue generado:
  //   1. buscamos si ya tiene slot
  //   2. si no, buscamos el primer slot libre
  //   3. asignamos participante
  //   4. sincronizamos primera ronda
  //
  // Si el bracket todavía no existe:
  //   el participante queda aprobado en participants
  //   y será incluido cuando se genere el bracket.
  //

  if (pro.bracket?.generated) {
    const alreadyAssigned = Object.entries(
      pro.bracket.slots || {}
    ).find(
      ([, slot]) => slot?.participantId === participantId
    );

    if (!alreadyAssigned) {
      const availableSlot = Object.entries(
        pro.bracket.slots || {}
      )
        .sort(
          ([, a], [, b]) =>
            Number(a?.seed || 0) - Number(b?.seed || 0)
        )
        .find(
          ([, slot]) => !slot?.participantId
        );

      // No existe asiento disponible.
      //
      // Importante:
      // no aprobamos la solicitud ni dejamos un participante
      // aprobado fuera del bracket.
      if (!availableSlot) {
        if (
          !request.participantId &&
          pro.participants[participantId]
        ) {
          delete pro.participants[participantId];
        }

        throw new Error(
          "No hay asientos disponibles en el bracket para aprobar esta solicitud."
        );
      }

      const [slotId, slot] = availableSlot;

      slot.participantId = participantId;
      const entry = ensurePersistentEntry(pro, participant, { competitionId: eventId });
      slot.entryId = entry?.id || `entry_${participantId}`;

      participant.seed = slot.seed;
      participant.slotIds = [slotId];
    } else {
      const [slotId, slot] = alreadyAssigned;

      const entry = ensurePersistentEntry(pro, participant, { competitionId: eventId });
      slot.entryId = entry?.id || `entry_${participantId}`;
      participant.seed = slot.seed;
      participant.slotIds = [slotId];
    }

    // Actualizar primera ronda del bracket.
    // La aprobación NO resuelve BYEs.
    // Los BYEs se determinan al cerrar el check-in.
    ensurePersistentEntry(pro, participant, { competitionId: eventId });
    syncFirstRoundFromSlots(pro);
  } else {
    // El bracket todavía no existe.
    //
    // El participante queda aprobado y sin slot.
    // generateBracket() lo incluirá posteriormente.

    participant.seed = null;
    participant.slotIds = [];
    ensurePersistentEntry(pro, participant, { competitionId: eventId });
  }

  // ========================================
  // ESTADO FINAL
  // ========================================

  participant.status = PARTICIPANT_STATUS.APPROVED;
  participant.checkIn = false;
  participant.updatedAt = new Date().toISOString();

  request.status = "approved";
  request.reviewedAt = new Date().toISOString();
  request.rejectionReason = null;
  request.participantId = participantId;

  pro.registration.status = "open";

  return savePro(tournamentId, eventId, event, pro);
}

export async function setCheckInOpen({
  tournamentId,
  eventId,
  event,
  open
}) {
  const pro = ensureTournamentProState(event);
  const nextOpen = Boolean(open);

  if (nextOpen) {
    if (!pro.bracket.generated) {
      throw new Error("Prepara el bracket antes de abrir el check-in.");
    }

    if (
      pro.status === TOURNAMENT_EVENT_STATUS.LIVE ||
      pro.status === TOURNAMENT_EVENT_STATUS.FINISHED
    ) {
      throw new Error("El check-in no puede abrirse en este estado del torneo.");
    }

    pro.checkIn.status = "open";
    pro.checkIn.opened = true;
    pro.checkIn.completed = false;
    pro.checkIn.openedAt =
      pro.checkIn.openedAt ||
      new Date().toISOString();

    pro.status = TOURNAMENT_EVENT_STATUS.CHECK_IN;
  } else {
    if (!pro.checkIn.opened) {
      throw new Error("El check-in no está abierto.");
    }

    completeCheckInState(pro);
  }

  return savePro(tournamentId, eventId, event, pro);
}

export async function completeCheckIn({
  tournamentId,
  eventId,
  event
}) {
  const pro = ensureTournamentProState(event);

  if (!pro.checkIn.opened) {
    throw new Error("El check-in todavía no está abierto.");
  }

  completeCheckInState(pro);

  return savePro(tournamentId, eventId, event, pro);
}

export async function generateBracket({
  tournamentId,
  eventId,
  event
}) {
  const pro = ensureTournamentProState(event);

  if (
    pro.status === TOURNAMENT_EVENT_STATUS.LIVE ||
    pro.status === TOURNAMENT_EVENT_STATUS.FINISHED
  ) {
    throw new Error(
      "No puedes regenerar el bracket después de iniciar el evento."
    );
  }

  const participants = Object.values(pro.participants)
    .filter(
      (participant) =>
        ![
          PARTICIPANT_STATUS.REJECTED,
          PARTICIPANT_STATUS.NO_SHOW,
          PARTICIPANT_STATUS.WITHDRAWN
        ].includes(participant.status)
    );

  if (participants.length < 2) {
    throw new Error(
      "Se necesitan al menos 2 participantes para generar el bracket."
    );
  }

  const capacity =
    pro.capacity?.value ||
    pro.capacity ||
    event.capacity?.value ||
    event.capacity ||
    participants.length;

  pro.bracket = buildBracket(
    participants,
    capacity,
    pro.format || event.format,
    pro.matchSystem || event.matchSystem || null
  );

  Object.values(pro.participants).forEach((participant) => {
    ensurePersistentEntry(pro, participant, { competitionId: eventId });
  });
  syncBracketSlotsWithEntries(pro);

  Object.values(pro.participants).forEach((participant) => {
    const slot = Object.values(
      pro.bracket.slots
    ).find(
      (item) => item.participantId === participant.id
    );

    participant.seed = slot?.seed || null;

    participant.slotIds = slot
      ? [`seed-${slot.seed}`]
      : [];

    if (
      participant.status === PARTICIPANT_STATUS.PENDING
    ) {
      participant.status = PARTICIPANT_STATUS.APPROVED;
    }

    participant.updatedAt = new Date().toISOString();
  });

  pro.bracket.generatedAt = new Date().toISOString();
  ensureStationState(pro, event);
  pro.stations.forEach((station) => {
    station.currentMatchId = null;
    station.status = STATION_STATUS.AVAILABLE;
  });
  delete pro.stationAutoAssignment;

  pro.checkIn = {
    status: "unopened",
    opened: false,
    completed: false,
    openedAt: null,
    completedAt: null
  };

  return savePro(
    tournamentId,
    eventId,
    event,
    pro
  );
}

export async function setEventStatus({
  tournamentId,
  eventId,
  event,
  status
}) {
  const pro = ensureTournamentProState(event);

  if (!Object.values(TOURNAMENT_EVENT_STATUS).includes(status)) {
    throw new Error("Estado de torneo inválido.");
  }

  if (status === TOURNAMENT_EVENT_STATUS.LIVE) {
    const validation = validateCompetitionConfiguration({
      gameId: event?.gameId,
      competitionOption: event?.competitionOption,
      participationType: event?.participationType,
      format: pro.format || event?.format,
      matchSystem: pro.matchSystem || event?.matchSystem,
      capacity: pro.capacity?.value || pro.capacity || event?.capacity?.value || event?.capacity
    });

    if (validation.status === COMPETITION_CONFIGURATION_STATUS.INVALID) {
      throw new Error(`La configuración competitiva no es válida: ${validation.errors.join(" ")}`);
    }

    if (validation.status === COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED) {
      throw new Error(
        `El formato "${event?.format || "seleccionado"}" todavía no está disponible para iniciar este torneo.`
      );
    }

    validateCanStartEvent(pro);
  }

  if (status === TOURNAMENT_EVENT_STATUS.CHECK_IN) {
    if (!pro.bracket.generated) {
      throw new Error("Prepara el bracket antes de abrir el check-in.");
    }

    pro.checkIn.status = "open";
    pro.checkIn.opened = true;
    pro.checkIn.completed = false;
    pro.checkIn.openedAt =
      pro.checkIn.openedAt ||
      new Date().toISOString();
  }

  pro.status = status;

  if (status === TOURNAMENT_EVENT_STATUS.LIVE) {
    autoAssignInitialRoundStations(pro, event);
  }

  if (status === TOURNAMENT_EVENT_STATUS.FINISHED) {
    throw new Error(
      "La finalización oficial requiere seleccionar los puestos reconocidos."
    );
  }

  return savePro(
    tournamentId,
    eventId,
    event,
    pro
  );
}

export async function startMatch({
  tournamentId,
  eventId,
  event,
  matchId
}) {
  const pro = ensureTournamentProState(event);

  if (pro.status !== TOURNAMENT_EVENT_STATUS.LIVE) {
    throw new Error("El evento debe estar en vivo.");
  }

  const match = findMatch(
    pro.bracket,
    matchId
  );

  if (!match) {
    throw new Error("Match no encontrado.");
  }

  validateMatchParticipants(
    pro,
    match
  );

  ensureStationState(pro, event);
  const assignedStation = getMatchWithStation(pro, matchId);
  if (pro.stations.length > 0 && !assignedStation) {
    throw new Error("Asigna una estación o lobby antes de iniciar el match.");
  }

  pro.bracket = startMatchCommand(
    pro.bracket,
    matchId
  );

  setParticipantsCompeting(
    pro,
    match
  );

  ensureStationState(pro, event);
  const station = getMatchWithStation(pro, matchId);
  if (station) station.status = STATION_STATUS.IN_PROGRESS;

  return savePro(
    tournamentId,
    eventId,
    event,
    pro
  );
}

export async function completeMatch({
  tournamentId,
  eventId,
  event,
  matchId,
  winnerId,
  score = null,
  onPersistenceSettled = null
}) {
  const pro = ensureTournamentProState(event);
  winnerId = resolveParticipantId(pro, winnerId);

  if (pro.status !== TOURNAMENT_EVENT_STATUS.LIVE) {
    throw new Error("El evento debe estar en vivo.");
  }

  const match = findMatch(
    pro.bracket,
    matchId
  );

  if (!match) {
    throw new Error("Match no encontrado.");
  }

  validateMatchParticipants(
    pro,
    match
  );

  if (match.status !== MATCH_STATUS.LIVE) {
    throw new Error(
      "El match debe estar en vivo antes de registrar el resultado del Game."
    );
  }

  const winnerSide =
    winnerId === match.participantAId
      ? "A"
      : winnerId === match.participantBId
        ? "B"
        : null;

  if (!winnerSide) {
    throw new Error(
      "El ganador indicado no pertenece al match."
    );
  }

  const scoreA = normalizeGameScoreValue(
    score?.A ?? score?.a
  );
  const scoreB = normalizeGameScoreValue(
    score?.B ?? score?.b
  );

  if (scoreA === null || scoreB === null) {
    throw new Error(
      "El resultado del Game requiere un marcador numérico para A y B."
    );
  }

  // Trabajamos sobre una copia completa del bracket.
  // Así, si Advancement o la validación Entry/Participant falla,
  // el Match original no queda contaminado con un Game que nunca
  // llegó a persistirse.
  const workingPro = {
    ...pro,
    bracket: cloneValue(pro.bracket)
  };

  // Esta es la API pública existente para reconciliar Slots, Matches
  // y Entries. No exportamos ni duplicamos la función interna de
  // tournamentPro.js; reutilizamos el contrato ya existente.
  syncBracketSlotsWithEntries(workingPro);

  const workingMatch = findMatch(
    workingPro.bracket,
    matchId
  );

  if (!workingMatch) {
    throw new Error("Match no encontrado en el bracket de trabajo.");
  }

  validateMatchParticipants(
    workingPro,
    workingMatch
  );

  const workingWinnerSide =
    winnerId === workingMatch.participantAId
      ? "A"
      : winnerId === workingMatch.participantBId
        ? "B"
        : null;

  if (!workingWinnerSide) {
    throw new Error(
      "El ganador indicado no pertenece al match después de reconciliar identidades."
    );
  }

  const {
    match: matchWithGame,
    game: pendingGame
  } = createNextMatchGame(workingMatch);

  // Game Lifecycle:
  // 1. createNextMatchGame() crea el Game en PENDING.
  // 2. startMatchGame() lo lleva a LIVE.
  // 3. applyGameResult() registra el resultado validado.
  // 4. completeMatchGame() proyecta ese resultado sobre el Game
  //    y lo lleva a COMPLETED.
  //
  // El Match continúa siendo la autoridad para la serie completa;
  // el Game Lifecycle únicamente controla la vida de cada Game.
  const liveGame = startMatchGame(pendingGame);

  const gameResultOperation = applyGameResult(
    liveGame,
    {
      winnerSide: workingWinnerSide,
      scoreA,
      scoreB
    }
  );

  const completedGame = completeMatchGame(
    gameResultOperation.game,
    {
      result: gameResultOperation.result
    }
  );

  workingMatch.games = matchWithGame.games.map(
    (candidateGame) =>
      candidateGame.id === pendingGame.id
        ? completedGame
        : candidateGame
  );

  const matchResult = getMatchResult(workingMatch);

  if (matchResult.status === "invalid") {
    throw new Error(
      "El formato del match no permite calcular el resultado de la serie."
    );
  }

  // El score del Match representa ahora la serie:
  // cantidad de Games ganados por cada lado.
  workingMatch.score = {
    A: matchResult.score.A,
    B: matchResult.score.B
  };

  // Si la serie todavía no está decidida (por ejemplo, BO3 1-0
  // o BO3 1-1), persistimos únicamente el bracket de trabajo válido
  // y dejamos el Match en vivo.
  if (matchResult.status !== "completed") {
    pro.bracket = workingPro.bracket;
    ensureStationState(pro, event);

    return saveProOptimistic(
      tournamentId,
      eventId,
      event,
      pro,
      { onPersistenceSettled }
    );
  }

  // Solo cuando Match Result confirma la serie usamos el Bridge
  // sobre el Match reconciliado para entrar al mismo motor de
  // Advancement que ya existía.
  const resultCommand =
    createLegacyMatchResultCommand(workingMatch);

  resultCommand.source = {
    ...resultCommand.source,
    operation: "TOURNAMENT_PRO_GAME_RESULTS"
  };

  const resultOperation = applyMatchResultCommand(
    workingPro.bracket,
    resultCommand
  );

  // Advancement terminó correctamente. Solo ahora reemplazamos el
  // bracket real; si lanza una excepción, pro.bracket sigue intacto.
  pro.bracket = resultOperation.bracket;

  const updatedMatch = findMatch(
    pro.bracket,
    matchId
  );

  if (
    updatedMatch?.winnerId &&
    pro.participants[updatedMatch.winnerId]
  ) {
    pro.participants[
      updatedMatch.winnerId
    ].status = PARTICIPANT_STATUS.ADVANCED;
  }

  if (
    updatedMatch?.loserId &&
    pro.participants[updatedMatch.loserId]
  ) {
    pro.participants[
      updatedMatch.loserId
    ].status = PARTICIPANT_STATUS.ELIMINATED;
  }

  ensureStationState(pro, event);
  releaseStationInMemory(pro, matchId);

  return saveProOptimistic(
    tournamentId,
    eventId,
    event,
    pro,
    { onPersistenceSettled }
  );
}

// ========================================
// FINALIZACIÓN OFICIAL
// ========================================
//
// La finalización no modifica el resultado del bracket.
// El campeón y los puestos que puedan determinarse
// provienen exclusivamente del resultado operativo.
//
// El organizador únicamente decide qué puestos reciben
// reconocimiento.
// ========================================

export function getOfficialResults(pro) {
  const bracket = pro?.bracket;
  if (!bracket?.generated) {
    throw new Error("El bracket todavía no está generado.");
  }

  const matches = (bracket.stages || [])
    .flatMap((stage) => stage.matches || []);

  const finalMatch =
    matches.find(
      (match) =>
        match.bracket === "grand_final" &&
        match.id === "GF-M1"
    ) ||
    [...matches]
      .reverse()
      .find(
        (match) =>
          match.bracket === "winners" &&
          match.status === MATCH_STATUS.COMPLETED
      );

  const championId =
    bracket.championId ||
    finalMatch?.winnerId ||
    null;

  if (!championId) {
    throw new Error(
      "El evento no puede finalizar sin campeón."
    );
  }

  const firstParticipant =
    pro.participants?.[championId];

  const results = [
    {
      position: 1,
      participantId: championId,
      displayName:
        firstParticipant?.displayName ||
        championId
    }
  ];

  const runnerUpId =
    finalMatch?.loserId ||
    null;

  if (runnerUpId && runnerUpId !== championId) {
    const participant =
      pro.participants?.[runnerUpId];

    results.push({
      position: 2,
      participantId: runnerUpId,
      displayName:
        participant?.displayName ||
        runnerUpId
    });
  }

  return results;
}

export async function finalizeTournament({
  tournamentId,
  eventId,
  event,
  recognizedPositions = []
}) {
  const pro = ensureTournamentProState(event);

  if (pro.status !== TOURNAMENT_EVENT_STATUS.LIVE) {
    throw new Error(
      "Solo puedes finalizar un torneo que está en vivo."
    );
  }

  if (!pro.bracket?.generated) {
    throw new Error("El bracket todavía no está generado.");
  }

  const allMatches =
    pro.bracket.stages?.flatMap(
      (stage) => stage.matches || []
    ) || [];

  const openMatch = allMatches.find(
    (match) =>
      match.status === MATCH_STATUS.PENDING ||
      match.status === MATCH_STATUS.LIVE
  );

  if (openMatch) {
    throw new Error(
      "No puedes finalizar el torneo mientras existan matches pendientes o en vivo."
    );
  }

  const officialResults =
    getOfficialResults(pro);

  const availablePositions =
    new Set(
      officialResults.map(
        (result) => result.position
      )
    );

  const positions =
    [...new Set(
      (Array.isArray(recognizedPositions)
        ? recognizedPositions
        : []
      )
        .map((position) => Number(position))
        .filter(
          (position) =>
            Number.isInteger(position) &&
            availablePositions.has(position)
        )
    )]
      .sort((a, b) => a - b);

  if (positions.length === 0) {
    throw new Error(
      "Selecciona al menos un puesto para otorgar reconocimiento."
    );
  }

  const user = auth.currentUser;

  if (!user) {
    throw new Error("Debes iniciar sesión para finalizar el torneo.");
  }

  const token = await user.getIdToken();

  const response = await fetch("/api/tournament-finalization", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      tournamentId,
      eventId,
      recognizedPositions: positions
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    const error = new Error(
      data?.error ||
      "No fue posible finalizar el torneo."
    );
    error.status = response.status;
    throw error;
  }

  return {
    ...event,
    pro: data.event?.pro || {
      ...pro,
      status: TOURNAMENT_EVENT_STATUS.FINISHED
    }
  };
}

export async function requestRecognition({
  tournamentId,
  eventId,
  event,
  participantId
}) {
  const pro = ensureTournamentProState(event);
  participantId = resolveParticipantId(pro, participantId);

  if (!pro.recognition.enabled) {
    throw new Error(
      "El reconocimiento no está habilitado."
    );
  }

  if (!pro.participants[participantId]) {
    throw new Error(
      "Participante no encontrado."
    );
  }

  pro.recognition.requests[participantId] = {
    status: RECOGNITION_STATUS.REQUESTED,
    requestedAt: new Date().toISOString()
  };

  return savePro(
    tournamentId,
    eventId,
    event,
    pro
  );
}

export async function reviewRecognition({
  tournamentId,
  eventId,
  event,
  participantId,
  approve = true
}) {
  const pro = ensureTournamentProState(event);
  participantId = resolveParticipantId(pro, participantId);

  const request =
    pro.recognition.requests?.[participantId];

  if (!request) {
    throw new Error(
      "Solicitud de reconocimiento no encontrada."
    );
  }

  request.status = approve
    ? RECOGNITION_STATUS.APPROVED
    : RECOGNITION_STATUS.REJECTED;

  request.reviewedAt =
    new Date().toISOString();

  return savePro(
    tournamentId,
    eventId,
    event,
    pro
  );
}

function resolveSlotParticipantId(pro, slot) {
  if (!slot) return null;

  if (slot.entryId && pro.entries?.[slot.entryId]?.legacyParticipantId) {
    return pro.entries[slot.entryId].legacyParticipantId;
  }

  return slot.participantId || null;
}

function syncFirstRoundFromSlots(pro, resolveByes = false) {
  const firstRound =
    pro.bracket?.stages?.find(
      (stage) =>
        stage.bracket === "winners" &&
        stage.number === 1
    );

  if (!firstRound) return;

  firstRound.matches.forEach((match) => {
    const seedA =
      ((match.position - 1) * 2) + 1;

    const seedB = seedA + 1;

    const participantAId =
      resolveSlotParticipantId(
        pro,
        pro.bracket.slots?.[`seed-${seedA}`]
      );

    const participantBId =
      resolveSlotParticipantId(
        pro,
        pro.bracket.slots?.[`seed-${seedB}`]
      );

    match.participantAId =
      participantAId;

    match.participantBId =
      participantBId;

    match.winnerId = null;
    match.loserId = null;

    if (
      participantAId &&
      participantBId
    ) {
      match.status =
        MATCH_STATUS.PENDING;
    } else if (
      resolveByes &&
      (participantAId || participantBId)
    ) {
      match.status =
        MATCH_STATUS.BYE;

      match.winnerId =
        participantAId ||
        participantBId;
    } else {
      match.status =
        MATCH_STATUS.PENDING;
    }
  });
}

function applyBracketByes(bracket) {
  if (!bracket?.stages) return;

  // Un BYE solo resuelve el match inmediatamente siguiente.
  // Un match de una ronda posterior NO puede convertirse en BYE
  // simplemente porque todavía tenga un solo participante: puede estar
  // esperando al ganador de otro match anterior.
  const matches =
    bracket.stages.flatMap(
      (stage) => stage.matches || []
    );

  matches.forEach((match) => {
    if (
      match.status !== MATCH_STATUS.BYE ||
      !match.winnerId ||
      !match.nextMatchId
    ) {
      return;
    }

    const nextMatch =
      matches.find(
        (candidate) =>
          candidate.id === match.nextMatchId
      );

    if (
      !nextMatch ||
      nextMatch.status === MATCH_STATUS.COMPLETED ||
      nextMatch.status === MATCH_STATUS.LIVE
    ) {
      return;
    }

    const slot =
      match.nextSlot === "B"
        ? "B"
        : "A";

    const key =
      slot === "B"
        ? "participantBId"
        : "participantAId";

    nextMatch[key] =
      match.winnerId;

    // No declaramos BYE en la siguiente ronda automáticamente.
    // Primero verificamos si todavía existe algún match predecesor
    // pendiente que deba aportar al otro slot.
    const predecessors =
      matches.filter(
        (candidate) =>
          candidate.nextMatchId ===
          nextMatch.id
      );

    const hasPendingPredecessor =
      predecessors.some(
        (candidate) =>
          candidate.status ===
            MATCH_STATUS.PENDING ||
          candidate.status ===
            MATCH_STATUS.LIVE
      );

    if (hasPendingPredecessor) {
      nextMatch.status =
        MATCH_STATUS.PENDING;

      nextMatch.winnerId = null;
      return;
    }

    if (
      nextMatch.participantAId &&
      nextMatch.participantBId
    ) {
      nextMatch.status =
        MATCH_STATUS.PENDING;

      nextMatch.winnerId = null;
    } else if (
      nextMatch.participantAId ||
      nextMatch.participantBId
    ) {
      // Solo cuando todos los predecesores ya están resueltos puede
      // determinarse que el otro lado no llegará.
      nextMatch.status =
        MATCH_STATUS.BYE;

      nextMatch.winnerId =
        nextMatch.participantAId ||
        nextMatch.participantBId;
    } else {
      nextMatch.status =
        MATCH_STATUS.PENDING;

      nextMatch.winnerId = null;
    }
  });
}

function findMatch(bracket, matchId) {
  return (bracket?.stages || [])
    .flatMap(
      (stage) => stage.matches || []
    )
    .find(
      (match) => match.id === matchId
    ) || null;
}

function validateMatchParticipants(
  pro,
  match
) {
  if (
    match.status !== MATCH_STATUS.LIVE &&
    match.status !== MATCH_STATUS.PENDING
  ) {
    throw new Error(
      "El match no está disponible para esta operación."
    );
  }

  if (
    !match.participantAId ||
    !match.participantBId
  ) {
    throw new Error(
      "El match todavía no tiene dos participantes."
    );
  }
}

function completeCheckInState(pro) {
  if (pro.bracket?.generated) {
    // Solo al cerrar el check-in se determinan los BYEs.
    syncFirstRoundFromSlots(pro, true);
    applyBracketByes(pro.bracket);
  }

  pro.checkIn.status =
    "completed";

  pro.checkIn.opened = true;
  pro.checkIn.completed = true;

  pro.checkIn.completedAt =
    new Date().toISOString();
}

function validateCanStartEvent(pro) {
  if (!pro.bracket?.generated) {
    throw new Error(
      "Prepara el bracket antes de iniciar el evento."
    );
  }

  if (!pro.checkIn?.completed) {
    throw new Error(
      "Debes cerrar el check-in antes de iniciar el evento."
    );
  }

  const presentParticipants =
    Object.values(
      pro.participants || {}
    ).filter(
      (participant) =>
        participant.checkIn === true &&
        participant.status !==
          PARTICIPANT_STATUS.NO_SHOW &&
        participant.status !==
          PARTICIPANT_STATUS.WITHDRAWN
    );

  if (presentParticipants.length < 2) {
    throw new Error(
      "Se necesitan al menos 2 participantes presentes para pasar a competencia."
    );
  }
}

function setParticipantsCompeting(
  pro,
  match
) {
  [
    match.participantAId,
    match.participantBId
  ].forEach((participantId) => {
    const participant =
      pro.participants?.[participantId];

    if (participant) {
      participant.status =
        PARTICIPANT_STATUS.COMPETING;
    }
  });
}

function releaseNoShowFromBracket(
  bracket,
  participantId
) {
  (bracket?.stages || [])
    .forEach((stage) => {
      (stage.matches || [])
        .forEach((match) => {
          if (
            match.status ===
            MATCH_STATUS.COMPLETED
          ) {
            return;
          }

          if (
            match.participantAId ===
            participantId
          ) {
            match.participantAId = null;
          }

          if (
            match.participantBId ===
            participantId
          ) {
            match.participantBId = null;
          }

          if (
            match.winnerId ===
            participantId
          ) {
            match.winnerId = null;
          }

          if (
            match.status !==
            MATCH_STATUS.LIVE
          ) {
            match.status =
              match.participantAId &&
              match.participantBId
                ? MATCH_STATUS.PENDING
                : match.participantAId ||
                    match.participantBId
                  ? MATCH_STATUS.BYE
                  : MATCH_STATUS.PENDING;
          }
        });
    });

  Object.values(
    bracket?.slots || {}
  ).forEach((slot) => {
    if (
      slot.participantId ===
      participantId
    ) {
      slot.participantId = null;
      slot.entryId = null;
    }
  });
}

function buildStandings(pro) {
  return Object.values(
    pro.participants || {}
  )
    .sort((a, b) =>
      String(a.status).localeCompare(
        String(b.status)
      )
    )
    .map(
      (participant, index) => ({
        position: index + 1,
        participantId: participant.id,
        displayName:
          participant.displayName
      })
    );
}
