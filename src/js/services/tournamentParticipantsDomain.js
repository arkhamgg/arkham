// ========================================
// ARKHAM — Tournament Participants Domain Contract
// ========================================
// Owns participant identity resolution, active/capacity queries, and the
// compatibility link between legacy Participants and persistent Entries.
// It does not persist data, assign competition slots, or mutate bracket/matches.

import { createCompetitionEntry, PARTICIPANT_STATUS } from "./tournamentPro.js";

export function mapParticipantStatusToEntryStatus(status) {
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

/**
 * Ensures one persistent Entry is linked to a legacy Participant.
 * Contract: mutates the supplied in-memory `pro` only; caller owns persistence.
 */
export function ensurePersistentEntry(pro, participant, { competitionId = null } = {}) {
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

/** Accepts either a Participant ID or its linked Entry ID. */
export function resolveParticipantId(pro, identifier) {
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

export function getCompetitionCapacity(pro, event) {
  return Number(
    pro?.capacity?.value ??
    pro?.capacity ??
    event?.capacity?.value ??
    event?.capacity ??
    0
  );
}

/** Returns true when a withdrawn participant has an explicit replacement. */
export function isReplacedParticipant(participant) {
  return Boolean(
    participant?.status === PARTICIPANT_STATUS.WITHDRAWN &&
    participant?.replacedByParticipantId
  );
}

export function isActiveParticipant(participant) {
  return ![
    PARTICIPANT_STATUS.REJECTED,
    PARTICIPANT_STATUS.WITHDRAWN,
    PARTICIPANT_STATUS.NO_SHOW
  ].includes(participant?.status);
}

export function getActiveCompetitionParticipants(pro) {
  return Object.values(pro?.participants || {})
    .filter((participant) => isActiveParticipant(participant));
}
