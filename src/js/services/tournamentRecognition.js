// ========================================
// NEXUS — Tournament Recognition Service
// ========================================

import { getAuth } from "firebase/auth";
import { initializeSession } from "./session.js";

async function getIdToken() {
  await initializeSession();
  const user = getAuth().currentUser;
  if (!user) throw new Error("Debes iniciar sesión.");
  return user.getIdToken();
}

async function requestApi({ method = "GET", mode = null, tournamentId = null, eventId = null, body = null } = {}) {
  const token = await getIdToken();
  const query = new URLSearchParams();
  if (mode) query.set("mode", mode);
  if (tournamentId) query.set("tournamentId", tournamentId);
  if (eventId) query.set("eventId", eventId);

  const response = await fetch(`/api/tournament-recognition?${query.toString()}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "No fue posible procesar el reconocimiento.");
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

export function getMyTournamentCompetitions() {
  return requestApi({ mode: "mine" });
}

export function getMyRecognitionStatus({ tournamentId, eventId }) {
  return requestApi({ mode: "status", tournamentId, eventId });
}

export function getTournamentRecognitionRequests({ tournamentId = null, eventId = null } = {}) {
  return requestApi({ mode: "list", tournamentId, eventId });
}

export function requestTournamentRecognition({ tournamentId, eventId }) {
  return requestApi({ method: "POST", tournamentId, eventId, body: { action: "request" } });
}

export function reviewTournamentRecognition({ tournamentId, eventId, participantId, approve, reason = "" }) {
  return requestApi({
    method: "POST",
    tournamentId,
    eventId,
    body: { action: "review", participantId, approve, reason }
  });
}
console.log("success")