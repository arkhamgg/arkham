// ========================================
// NEXUS — Tournament Pro Operations
// ========================================

import {
  getMapEntity,
  updateMapEntity,
  getEntities
} from "./firestore.js";

import {
  ensureTournamentProState,
  createParticipant,
  generateBracket as buildBracket,
  startMatch as beginMatch,
  applyMatchResult,
  PARTICIPANT_STATUS,
  MATCH_STATUS,
  RECOGNITION_STATUS,
  TOURNAMENT_EVENT_STATUS
} from "./tournamentPro.js";

export async function getTournamentProEvent(tournamentId, eventId) {
  return getMapEntity("tournaments", tournamentId, "events", eventId);
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
  const participantId = `${entityType}_${entityId || crypto.randomUUID()}`;
  if (pro.participants[participantId]) {
    throw new Error("El participante ya está agregado al torneo.");
  }

  const activeCount = Object.values(pro.participants)
    .filter((participant) => ![
      PARTICIPANT_STATUS.REJECTED,
      PARTICIPANT_STATUS.WITHDRAWN,
      PARTICIPANT_STATUS.NO_SHOW
    ].includes(participant.status)).length;
  const capacity = Number(pro.capacity?.value || pro.capacity || event.capacity?.value || event.capacity);
  if (capacity > 0 && activeCount >= capacity) {
    throw new Error("La capacidad del torneo ya está completa.");
  }

  pro.participants[participantId] = createParticipant({
    participantId,
    entityType,
    entityId,
    displayName,
    manual
  });

  pro.registration.status = "open";
  return savePro(tournamentId, eventId, event, pro);
}

export async function updateParticipantStatus({ tournamentId, eventId, event, participantId, status }) {
  const pro = ensureTournamentProState(event);
  const participant = pro.participants[participantId];
  if (!participant) throw new Error("Participante no encontrado.");

  const allowed = Object.values(PARTICIPANT_STATUS);
  if (!allowed.includes(status)) throw new Error("Estado de participante inválido.");
  if (participant.status === PARTICIPANT_STATUS.NO_SHOW && status !== PARTICIPANT_STATUS.APPROVED) {
    throw new Error("Un no-show debe reactivarse como aprobado antes de continuar.");
  }

  participant.status = status;
  participant.updatedAt = new Date().toISOString();
  if (status === PARTICIPANT_STATUS.CHECKED_IN) participant.checkIn = true;
  if (status === PARTICIPANT_STATUS.NO_SHOW) participant.checkIn = false;

  if (status === PARTICIPANT_STATUS.NO_SHOW && pro.bracket?.generated) {
    releaseNoShowFromBracket(pro.bracket, participantId);
  }

  return savePro(tournamentId, eventId, event, pro);
}

export async function setParticipantCheckIn({ tournamentId, eventId, event, participantId, present = true }) {
  const pro = ensureTournamentProState(event);
  if (!pro.checkIn.opened) throw new Error("El check-in todavía no está abierto.");

  const participant = pro.participants[participantId];
  if (!participant) throw new Error("Participante no encontrado.");
  if ([PARTICIPANT_STATUS.REJECTED, PARTICIPANT_STATUS.WITHDRAWN].includes(participant.status)) {
    throw new Error("Este participante no puede hacer check-in.");
  }

  participant.checkIn = Boolean(present);
  participant.status = present
    ? PARTICIPANT_STATUS.CHECKED_IN
    : PARTICIPANT_STATUS.NO_SHOW;
  participant.updatedAt = new Date().toISOString();

  if (!present && pro.bracket?.generated) releaseNoShowFromBracket(pro.bracket, participantId);
  return savePro(tournamentId, eventId, event, pro);
}

export async function approveParticipationRequest({ tournamentId, eventId, event, requestId, approve = true }) {
  const pro = ensureTournamentProState(event);
  const request = pro.registration.requests?.[requestId];
  if (!request) throw new Error("Solicitud no encontrada.");

  request.status = approve ? "approved" : "rejected";
  request.reviewedAt = new Date().toISOString();

  if (approve) {
    const participantId = request.participantId || `request_${requestId}`;
    pro.participants[participantId] = createParticipant({
      participantId,
      entityType: request.entityType || "manual",
      entityId: request.entityId || null,
      displayName: request.displayName,
      manual: !request.entityId
    });
    request.participantId = participantId;
  }

  return savePro(tournamentId, eventId, event, pro);
}

export async function setCheckInOpen({ tournamentId, eventId, event, open }) {
  const pro = ensureTournamentProState(event);
  const nextOpen = Boolean(open);

  if (nextOpen) {
    if (!pro.bracket.generated) throw new Error("Genera el bracket antes de abrir el check-in.");
    if (pro.status === TOURNAMENT_EVENT_STATUS.LIVE || pro.status === TOURNAMENT_EVENT_STATUS.FINISHED) {
      throw new Error("El check-in no puede abrirse en este estado del torneo.");
    }
    pro.checkIn.status = "open";
    pro.checkIn.opened = true;
    pro.checkIn.completed = false;
    pro.checkIn.openedAt = pro.checkIn.openedAt || new Date().toISOString();
    pro.status = TOURNAMENT_EVENT_STATUS.CHECK_IN;
  } else {
    if (!pro.checkIn.opened) throw new Error("El check-in no está abierto.");
    completeCheckInState(pro);
  }

  return savePro(tournamentId, eventId, event, pro);
}

export async function completeCheckIn({ tournamentId, eventId, event }) {
  const pro = ensureTournamentProState(event);
  if (!pro.checkIn.opened) throw new Error("El check-in todavía no está abierto.");
  completeCheckInState(pro);
  return savePro(tournamentId, eventId, event, pro);
}

export async function generateBracket({ tournamentId, eventId, event }) {
  const pro = ensureTournamentProState(event);
  if (pro.status === TOURNAMENT_EVENT_STATUS.LIVE || pro.status === TOURNAMENT_EVENT_STATUS.FINISHED) {
    throw new Error("No puedes regenerar el bracket después de iniciar el evento.");
  }

  const participants = Object.values(pro.participants)
    .filter((participant) => ![
      PARTICIPANT_STATUS.REJECTED,
      PARTICIPANT_STATUS.NO_SHOW,
      PARTICIPANT_STATUS.WITHDRAWN
    ].includes(participant.status));

  if (participants.length < 2) {
    throw new Error("Se necesitan al menos 2 participantes para generar el bracket.");
  }

  const capacity = pro.capacity?.value || pro.capacity || event.capacity?.value || event.capacity || participants.length;
  pro.bracket = buildBracket(participants, capacity, pro.format || event.format);

  Object.values(pro.participants).forEach((participant) => {
    const slot = Object.values(pro.bracket.slots).find((item) => item.participantId === participant.id);
    participant.seed = slot?.seed || null;
    participant.slotIds = slot ? [`seed-${slot.seed}`] : [];
    if (participant.status === PARTICIPANT_STATUS.PENDING) participant.status = PARTICIPANT_STATUS.APPROVED;
    participant.updatedAt = new Date().toISOString();
  });

  pro.bracket.generatedAt = new Date().toISOString();
  pro.checkIn = {
    status: "unopened",
    opened: false,
    completed: false,
    openedAt: null,
    completedAt: null
  };
  return savePro(tournamentId, eventId, event, pro);
}

export async function setEventStatus({ tournamentId, eventId, event, status }) {
  const pro = ensureTournamentProState(event);
  if (!Object.values(TOURNAMENT_EVENT_STATUS).includes(status)) {
    throw new Error("Estado de torneo inválido.");
  }
  if (status === TOURNAMENT_EVENT_STATUS.LIVE) {
    validateCanStartEvent(pro);
    prepareLiveParticipants(pro);
  }
  if (status === TOURNAMENT_EVENT_STATUS.CHECK_IN) {
    if (!pro.bracket.generated) throw new Error("Genera el bracket antes de abrir el check-in.");
    pro.checkIn.status = "open";
    pro.checkIn.opened = true;
    pro.checkIn.completed = false;
    pro.checkIn.openedAt = pro.checkIn.openedAt || new Date().toISOString();
  }

  pro.status = status;
  if (status === TOURNAMENT_EVENT_STATUS.FINISHED) {
    if (!pro.bracket.championId) throw new Error("El evento no puede finalizar sin campeón.");
    pro.results.completedAt = new Date().toISOString();
    pro.bracket.completedAt = new Date().toISOString();
    pro.results.winnerIds = [pro.bracket.championId];
    pro.results.standings = buildStandings(pro);
  }
  return savePro(tournamentId, eventId, event, pro);
}

export async function startMatch({ tournamentId, eventId, event, matchId }) {
  const pro = ensureTournamentProState(event);
  if (pro.status !== TOURNAMENT_EVENT_STATUS.LIVE) throw new Error("El evento debe estar en vivo.");

  const match = findMatch(pro.bracket, matchId);
  if (!match) throw new Error("Match no encontrado.");
  validateMatchParticipants(pro, match);

  pro.bracket = beginMatch(pro.bracket, matchId);
  setParticipantsCompeting(pro, match);
  return savePro(tournamentId, eventId, event, pro);
}

export async function completeMatch({ tournamentId, eventId, event, matchId, winnerId, score = null }) {
  const pro = ensureTournamentProState(event);
  if (pro.status !== TOURNAMENT_EVENT_STATUS.LIVE) throw new Error("El evento debe estar en vivo.");

  const match = findMatch(pro.bracket, matchId);
  if (!match) throw new Error("Match no encontrado.");
  validateMatchParticipants(pro, match);
  if (match.status !== MATCH_STATUS.LIVE) throw new Error("El match debe estar en vivo antes de registrar el resultado.");

  pro.bracket = applyMatchResult(pro.bracket, matchId, winnerId, score);
  const updatedMatch = findMatch(pro.bracket, matchId);

  if (updatedMatch?.loserId && pro.participants[updatedMatch.loserId]) {
    const loser = pro.participants[updatedMatch.loserId];
    loser.status = updatedMatch.bracket === "winners" && pro.bracket.type === "double_elimination"
      ? PARTICIPANT_STATUS.ADVANCED
      : PARTICIPANT_STATUS.ELIMINATED;
    loser.updatedAt = new Date().toISOString();
  }

  if (pro.participants[winnerId]) {
    pro.participants[winnerId].status = pro.bracket.championId === winnerId
      ? PARTICIPANT_STATUS.FINISHED
      : PARTICIPANT_STATUS.ADVANCED;
    pro.participants[winnerId].updatedAt = new Date().toISOString();
  }

  if (pro.bracket.championId) {
    pro.results.winnerIds = [pro.bracket.championId];
    pro.results.standings = buildStandings(pro);
  }

  return savePro(tournamentId, eventId, event, pro);
}

export async function requestRecognition({ tournamentId, eventId, event, participantId }) {
  const pro = ensureTournamentProState(event);
  if (!pro.recognition.enabled) throw new Error("El reconocimiento no está habilitado.");
  if (!pro.participants[participantId]) throw new Error("Participante no encontrado.");
  pro.recognition.requests[participantId] = {
    participantId,
    status: RECOGNITION_STATUS.REQUESTED,
    requestedAt: new Date().toISOString()
  };
  return savePro(tournamentId, eventId, event, pro);
}

export async function reviewRecognition({ tournamentId, eventId, event, participantId, approve = true }) {
  const pro = ensureTournamentProState(event);
  const request = pro.recognition.requests[participantId];
  if (!request) throw new Error("Solicitud de reconocimiento no encontrada.");
  request.status = approve ? RECOGNITION_STATUS.APPROVED : RECOGNITION_STATUS.REJECTED;
  request.reviewedAt = new Date().toISOString();
  return savePro(tournamentId, eventId, event, pro);
}

function completeCheckInState(pro) {
  const unresolved = Object.values(pro.participants).filter((participant) => {
    if ([PARTICIPANT_STATUS.REJECTED, PARTICIPANT_STATUS.WITHDRAWN, PARTICIPANT_STATUS.NO_SHOW].includes(participant.status)) return false;
    return participant.checkIn !== true;
  });

  if (unresolved.length) {
    throw new Error(`Falta confirmar asistencia de ${unresolved.length} participante(s).`);
  }

  pro.checkIn.status = "completed";
  pro.checkIn.opened = true;
  pro.checkIn.completed = true;
  pro.checkIn.completedAt = new Date().toISOString();
  pro.status = TOURNAMENT_EVENT_STATUS.CHECK_IN;
}

function validateCanStartEvent(pro) {
  if (!pro.bracket.generated) throw new Error("Genera el bracket antes de iniciar el evento.");
  if (!pro.checkIn.opened || !pro.checkIn.completed) {
    throw new Error("Completa el check-in antes de iniciar el evento.");
  }
  const unresolved = Object.values(pro.participants).filter((participant) => {
    if ([PARTICIPANT_STATUS.REJECTED, PARTICIPANT_STATUS.WITHDRAWN, PARTICIPANT_STATUS.NO_SHOW].includes(participant.status)) return false;
    return participant.checkIn !== true;
  });
  if (unresolved.length) throw new Error(`Hay ${unresolved.length} participante(s) sin asistencia confirmada.`);
}

function prepareLiveParticipants(pro) {
  Object.values(pro.participants).forEach((participant) => {
    if (participant.checkIn === true && participant.status === PARTICIPANT_STATUS.CHECKED_IN) {
      participant.status = PARTICIPANT_STATUS.APPROVED;
      participant.updatedAt = new Date().toISOString();
    }
  });
}

function validateMatchParticipants(pro, match) {
  if (match.status === MATCH_STATUS.BYE) throw new Error("Un BYE no requiere resultado manual.");
  if (!match.participantAId || !match.participantBId) throw new Error("El match todavía no tiene dos participantes.");

  [match.participantAId, match.participantBId].forEach((participantId) => {
    const participant = pro.participants[participantId];
    if (!participant) throw new Error("Uno de los participantes del match no existe.");
    if (participant.status === PARTICIPANT_STATUS.NO_SHOW || participant.checkIn !== true) {
      throw new Error("Todos los participantes del match deben estar presentes.");
    }
  });
}

function setParticipantsCompeting(pro, match) {
  [match.participantAId, match.participantBId].forEach((participantId) => {
    const participant = pro.participants[participantId];
    if (participant) {
      participant.status = PARTICIPANT_STATUS.COMPETING;
      participant.updatedAt = new Date().toISOString();
    }
  });
}

function releaseNoShowFromBracket(bracket, participantId) {
  for (const stage of bracket.stages || []) {
    for (const match of stage.matches || []) {
      if (match.status === MATCH_STATUS.COMPLETED) continue;
      if (match.participantAId !== participantId && match.participantBId !== participantId) continue;
      if (match.participantAId === participantId) match.participantAId = null;
      if (match.participantBId === participantId) match.participantBId = null;
      match.winnerId = null;
      match.loserId = null;
      match.startedAt = null;
      match.score = null;
      match.completedAt = null;
      match.status = match.participantAId || match.participantBId ? MATCH_STATUS.BYE : MATCH_STATUS.PENDING;
      if (match.status === MATCH_STATUS.BYE) {
        match.winnerId = match.participantAId || match.participantBId;
        propagateBye(bracket, match);
      }
    }
  }
}

function propagateBye(bracket, match) {
  if (match.status !== MATCH_STATUS.BYE || !match.winnerId || !match.nextMatchId) return;
  const next = findMatch(bracket, match.nextMatchId);
  if (!next || next.status === MATCH_STATUS.COMPLETED || next.status === MATCH_STATUS.LIVE) return;

  if (match.nextSlot === "A") next.participantAId = match.winnerId;
  else if (match.nextSlot === "B") next.participantBId = match.winnerId;
  else if (!next.participantAId) next.participantAId = match.winnerId;
  else if (!next.participantBId) next.participantBId = match.winnerId;

  if (next.participantAId && next.participantBId) {
    next.status = MATCH_STATUS.PENDING;
    next.winnerId = null;
  } else if (next.participantAId || next.participantBId) {
    next.status = MATCH_STATUS.BYE;
    next.winnerId = next.participantAId || next.participantBId;
    propagateBye(bracket, next);
  }
}

function findMatch(bracket, matchId) {
  return (bracket?.stages || [])
    .flatMap((stage) => stage.matches || [])
    .find((match) => match.id === matchId) || null;
}

function buildStandings(pro) {
  const champion = pro.bracket.championId;
  const participants = Object.values(pro.participants);
  const rows = participants.map((participant) => ({
    participantId: participant.id,
    displayName: participant.displayName,
    position: participant.id === champion ? 1 : null
  }));
  return rows.sort((a, b) => (a.position || 999) - (b.position || 999));
}
