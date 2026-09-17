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

export async function prepareBracket({ tournamentId, eventId, event }) {
  const pro = ensureTournamentProState(event);

  if ([TOURNAMENT_EVENT_STATUS.LIVE, TOURNAMENT_EVENT_STATUS.FINISHED].includes(pro.status)) {
    throw new Error("No puedes preparar el bracket después de iniciar el evento.");
  }

  const capacity = pro.capacity?.value || pro.capacity || event.capacity?.value || event.capacity;

  if (!Number(capacity) || Number(capacity) < 2) {
    throw new Error("La capacidad del torneo debe ser de al menos 2 participantes.");
  }

  pro.bracket = buildBracket([], capacity, pro.format || event.format);

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

  syncFirstRoundFromSlots(pro);
  applyBracketByes(pro.bracket);

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

export async function updateParticipantStatus({
  tournamentId,
  eventId,
  event,
  participantId,
  status
}) {
  const pro = ensureTournamentProState(event);
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

      participant.seed = slot.seed;
      participant.slotIds = [slotId];
    } else {
      const [slotId, slot] = alreadyAssigned;

      participant.seed = slot.seed;
      participant.slotIds = [slotId];
    }

    // Actualizar primera ronda del bracket.
    // La aprobación NO resuelve BYEs.
    // Los BYEs se determinan al cerrar el check-in.
    syncFirstRoundFromSlots(pro);
  } else {
    // El bracket todavía no existe.
    //
    // El participante queda aprobado y sin slot.
    // generateBracket() lo incluirá posteriormente.

    participant.seed = null;
    participant.slotIds = [];
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
    pro.format || event.format
  );

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

  if (status === TOURNAMENT_EVENT_STATUS.FINISHED) {
    if (!pro.bracket.championId) {
      throw new Error(
        "El evento no puede finalizar sin campeón."
      );
    }

    pro.results.completedAt =
      new Date().toISOString();

    pro.bracket.completedAt =
      new Date().toISOString();

    pro.results.winnerIds = [
      pro.bracket.championId
    ];

    pro.results.standings =
      buildStandings(pro);
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

  pro.bracket = beginMatch(
    pro.bracket,
    matchId
  );

  setParticipantsCompeting(
    pro,
    match
  );

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
  score = null
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

  pro.bracket = applyMatchResult(
    pro.bracket,
    matchId,
    winnerId,
    score
  );

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

  return savePro(
    tournamentId,
    eventId,
    event,
    pro
  );
}

export async function requestRecognition({
  tournamentId,
  eventId,
  event,
  participantId
}) {
  const pro = ensureTournamentProState(event);

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
      pro.bracket.slots?.[
        `seed-${seedA}`
      ]?.participantId || null;

    const participantBId =
      pro.bracket.slots?.[
        `seed-${seedB}`
      ]?.participantId || null;

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