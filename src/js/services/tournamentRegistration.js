// ========================================
// NEXUS — Tournament Registration Service
// ========================================

import { getAuth } from "firebase/auth";
import { initializeSession } from "./session.js";

async function getIdToken() {
  await initializeSession();
  const user = getAuth().currentUser;
  if (!user) throw new Error("Debes iniciar sesión para continuar.");
  return user.getIdToken();
}

async function requestApi({ method = "GET", tournamentId, eventId, mode = null, body = null }) {
  const token = await getIdToken();
  const query = new URLSearchParams();
  if (tournamentId) query.set("tournamentId", tournamentId);
  if (eventId) query.set("eventId", eventId);
  if (mode) query.set("mode", mode);

  const response = await fetch(`/api/tournament-registration?${query.toString()}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "No fue posible procesar la solicitud.");
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function getMyTournamentRegistrationStatus({ tournamentId, eventId }) {
  return requestApi({ tournamentId, eventId, mode: "status" });
}

export async function getTournamentRegistrationRequests({ tournamentId, eventId }) {
  return requestApi({ tournamentId, eventId, mode: "list" });
}

export async function getMyTournamentRegistrationRequests() {
  return requestApi({ mode: "mine" });
}

export async function submitTournamentParticipationRequest({ tournamentId, eventId, proof = null }) {
  return requestApi({
    method: "POST",
    tournamentId,
    eventId,
    body: { action: "submit", proof }
  });
}
console.log("sucess")
console.log("sucess")
