// ========================================
// NEXUS — Team Requests Service
// ========================================

import { getAuth } from "firebase/auth";
import { initializeSession } from "./session.js";

async function getIdToken() {
  await initializeSession();
  const user = getAuth().currentUser;
  if (!user) throw new Error("Debes iniciar sesión para continuar.");
  return user.getIdToken();
}

async function requestApi({ method = "GET", body = null, queryParams = {} }) {
  const token = await getIdToken();
  const query = new URLSearchParams();

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  const response = await fetch(`/api/team-requests${query.toString() ? `?${query.toString()}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error || "No fue posible procesar la solicitud de Team.");
    error.data = data;
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function submitTeamRequest({ teamId }) {
  return requestApi({
    method: "POST",
    body: {
      action: "submit",
      teamId
    }
  });
}

export async function cancelTeamRequest({ teamId }) {
  return requestApi({
    method: "POST",
    body: {
      action: "cancel",
      teamId
    }
  });
}

export async function getMyTeamRequests() {
  return requestApi({
    queryParams: { mode: "mine" }
  });
}
