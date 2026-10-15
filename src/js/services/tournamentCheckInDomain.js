// ========================================
// ARKHAM — Tournament Check-in Domain
// ========================================
// Owns check-in-specific eligibility, attendance queries, and state transitions.
// It does not persist data, resolve participant/entry identity, or mutate the
// bracket. Tournament Pro Operations coordinates those effects.

import { PARTICIPANT_STATUS } from "./tournamentPro.js";

export function getPresentCheckInParticipants(pro) {
  return Object.values(pro?.participants || {}).filter(
    (participant) =>
      participant?.checkIn === true &&
      participant?.status !== PARTICIPANT_STATUS.NO_SHOW &&
      participant?.status !== PARTICIPANT_STATUS.WITHDRAWN
  );
}

export function assertCheckInIsOpen(pro, message = "El check-in todavía no está abierto.") {
  if (!pro?.checkIn?.opened) {
    throw new Error(message);
  }
}

export function assertParticipantCanCheckIn(participant, isReplaced = false) {
  if (!participant) {
    throw new Error("Participante no encontrado.");
  }

  if ([PARTICIPANT_STATUS.REJECTED, PARTICIPANT_STATUS.WITHDRAWN].includes(participant.status)) {
    throw new Error(
      isReplaced
        ? "Este participante ya fue reemplazado y está bloqueado."
        : "Este participante no puede hacer check-in."
    );
  }
}

export function assertEnoughPresentParticipants(participants, message) {
  if (participants.length < 2) {
    throw new Error(message);
  }
}

export function setCheckInOpenedState(pro, now = new Date().toISOString()) {
  pro.checkIn.status = "open";
  pro.checkIn.opened = true;
  pro.checkIn.completed = false;
  pro.checkIn.openedAt = pro.checkIn.openedAt || now;
}

export function setCheckInCompletedState(pro, now = new Date().toISOString()) {
  pro.checkIn.status = "completed";
  pro.checkIn.opened = true;
  pro.checkIn.completed = true;
  pro.checkIn.completedAt = now;
}
