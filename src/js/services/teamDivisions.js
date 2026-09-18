// ========================================
// NEXUS — Team Divisions Service
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

  const response = await fetch(`/api/team-divisions?${query.toString()}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "No fue posible procesar la división.");
    error.data = data;
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function getTeamDivisions(teamId) {
  return requestApi({ teamId });
}

export async function createTeamDivision({ teamId, name, gameId, description = "", players = [] }) {
  return requestApi({
    method: "POST",
    teamId,
    body: { teamId, name, gameId, description, players }
  });
}

export async function updateTeamDivision({ teamId, divisionId, name, description = "", status = "active" }) {
  return requestApi({
    method: "PATCH",
    teamId,
    body: { teamId, divisionId, name, description, status }
  });
}

export async function deleteTeamDivision({ teamId, divisionId }) {
  return requestApi({
    method: "DELETE",
    teamId,
    body: { teamId, divisionId }
  });
}
