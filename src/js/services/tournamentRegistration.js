// ========================================
// NEXUS — Public Tournament Registration
// ========================================

import { getCurrentSession, initializeSession } from "./session.js";

const API = "/api/tournament-registration";

async function getIdToken() {
  await initializeSession();
  const session = getCurrentSession();
  if (!session?.user?.uid) {
    throw new Error("Debes iniciar sesión para solicitar un asiento.");
  }

  const { getAuth } = await import("firebase/auth");
  const user = getAuth().currentUser;
  if (!user) throw new Error("Debes iniciar sesión para solicitar un asiento.");
  return user.getIdToken();
}

async function request(url, options = {}) {
  const token = await getIdToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "No fue posible procesar la solicitud.");
  }
  return data;
}

export async function submitTournamentParticipationRequest({
  tournamentId,
  eventId,
  proof = null
}) {
  return request(API, {
    method: "POST",
    body: JSON.stringify({
      tournamentId,
      eventId,
      proof
    })
  });
}
