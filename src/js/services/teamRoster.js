// ========================================
// NEXUS — Team Roster Service
// ========================================

import { getAuth } from "firebase/auth";
import { initializeSession } from "./session.js";

async function getIdToken() {
  await initializeSession();
  const user = getAuth().currentUser;
  if (!user) throw new Error("Debes iniciar sesión para continuar.");
  return user.getIdToken();
}

async function requestApi({ method = "GET", teamId, body = null }) {
  const token = await getIdToken();
  const query = new URLSearchParams();
  if (teamId) query.set("teamId", teamId);

  const response = await fetch(`/api/team-roster?${query.toString()}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "No fue posible procesar el Roster.");
    error.data = data;
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function getTeamRoster(teamId) {
  return requestApi({ teamId });
}

export async function approveTeamRequest({ teamId, playerId }) {
  return requestApi({
    method: "POST",
    teamId,
    body: { action: "approve", teamId, playerId }
  });
}

export async function rejectTeamRequest({ teamId, playerId, reason = "" }) {
  return requestApi({
    method: "POST",
    teamId,
    body: { action: "reject", teamId, playerId, reason }
  });
}
