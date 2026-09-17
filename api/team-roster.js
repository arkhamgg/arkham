// ========================================
// NEXUS — Team Roster API
// ========================================

import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_lib/firebaseAdmin.js";

function json(res, status, payload) {
  return res.status(status).json(payload);
}

async function authenticate(req) {
  const header = req.headers?.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Debes iniciar sesión.");

  const app = getFirebaseAdminApp();
  const decoded = await getAuth(app).verifyIdToken(token);

  return { app, uid: decoded.uid };
}

async function getOwnedTeam(db, uid, teamId) {
  if (!teamId) throw new Error("No se indicó el Team.");

  const teamRef = db.collection("teams").doc(teamId);
  const teamSnap = await teamRef.get();

  if (!teamSnap.exists) throw new Error("No se encontró el Team.");

  const team = { id: teamSnap.id, ...teamSnap.data() };

  if (team.ownerId !== uid) {
    const error = new Error("No tienes permisos para administrar este Team.");
    error.status = 403;
    throw error;
  }

  return { team, teamRef };
}

function playerName(player = {}) {
  return [player.gamertag, player.name, player.lastName]
    .filter(Boolean)
    .join(" ") || player.id || "Player";
}

function normalizeRequest(player = {}) {
  const request = player.teamRequest;
  if (!request?.teamId || !request?.status) return null;

  return {
    playerId: player.id,
    playerName: playerName(player),
    gamertag: player.gamertag || "",
    teamId: request.teamId,
    status: String(request.status).toLowerCase(),
    requestedAt: request.requestedAt || null,
    respondedAt: request.respondedAt || null,
    reviewReason: request.reviewReason || null
  };
}

export default async function handler(req, res) {
  try {
    const { app, uid } = await authenticate(req);
    const db = getFirestore(app);
    const method = String(req.method || "GET").toUpperCase();
    const teamId = String(req.query?.teamId || req.body?.teamId || "").trim();

    const { team } = await getOwnedTeam(db, uid, teamId);

    if (method === "GET") {
      const playersSnap = await db.collection("players").get();
      const players = playersSnap.docs.map((document) => ({
        id: document.id,
        ...document.data()
      }));

      const members = players
        .filter((player) => player.teamId === teamId)
        .map((player) => ({
          playerId: player.id,
          playerName: playerName(player),
          gamertag: player.gamertag || "",
          teamId,
          divisionId: player.teamRoster?.divisionId || null,
          roleId: player.teamRoster?.roleId || null,
          joinedAt: player.teamRoster?.joinedAt || null
        }));

      const requestSnapshot = await db
        .collection("teamRequests")
        .where("teamId", "==", teamId)
        .get();

      const requests = requestSnapshot.docs
        .map((document) => ({
          id: document.id,
          requestId: document.id,
          ...document.data()
        }))
        .filter((request) => request.type === "player_request")
        .map((request) => ({
          ...request,
          status: String(request.status || "pending").toLowerCase(),
          playerName: playerName(players.find((player) => player.id === request.playerId) || {}),
          gamertag: players.find((player) => player.id === request.playerId)?.gamertag || ""
        }));

      // Compatibilidad con solicitudes creadas por la versión anterior,
      // que todavía viven únicamente dentro de players/{playerId}.teamRequest.
      const legacyRequests = players
        .map((player) => normalizeRequest(player))
        .filter((request) => request?.teamId === teamId)
        .filter((request) => !requests.some((item) => item.playerId === request.playerId))
        .map((request) => ({
          ...request,
          requestId: null,
          id: null
        }));

      requests.push(...legacyRequests);

      requests.sort((a, b) =>
        String(b.requestedAt || "").localeCompare(String(a.requestedAt || ""))
      );

      return json(res, 200, {
        success: true,
        team,
        members,
        requests
      });
    }

    if (method !== "POST") {
      return json(res, 405, { error: "Método no permitido." });
    }

    const action = String(req.body?.action || "").trim().toLowerCase();
    const playerId = String(req.body?.playerId || "").trim();
    const requestId = String(req.body?.requestId || "").trim();

    if (!playerId) {
      return json(res, 400, { error: "No se indicó el Player." });
    }

    const playerRef = db.collection("players").doc(playerId);
    const playerSnap = await playerRef.get();

    if (!playerSnap.exists) {
      return json(res, 404, { error: "No se encontró el Player." });
    }

    const player = { id: playerSnap.id, ...playerSnap.data() };
    const legacyRequest = player.teamRequest || null;

    let requestRef = null;
    let request = legacyRequest;

    if (requestId) {
      requestRef = db.collection("teamRequests").doc(requestId);
      const requestSnap = await requestRef.get();

      if (!requestSnap.exists) {
        return json(res, 404, { error: "No se encontró la solicitud." });
      }

      request = { id: requestSnap.id, ...requestSnap.data() };

      if (
        request.teamId !== teamId ||
        request.playerId !== playerId ||
        request.status !== "pending"
      ) {
        return json(res, 409, {
          error: "Esta solicitud ya no está pendiente o pertenece a otro Team."
        });
      }
    } else if (legacyRequest?.teamId !== teamId || legacyRequest?.status !== "pending") {
      return json(res, 409, {
        error: "Esta solicitud ya no está pendiente o pertenece a otro Team."
      });
    }

    if (action === "approve") {
      if (player.teamId && player.teamId !== teamId) {
        return json(res, 409, {
          error: "Este Player ya pertenece a otro Team confirmado."
        });
      }

      const rosterRef = db.collection("teamRoster").doc();
      const batch = db.batch();

      batch.set(rosterRef, {
        teamId,
        playerId,
        divisionId: null,
        roleId: null,
        status: "active",
        joinedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      if (requestRef) {
        batch.update(requestRef, {
          status: "approved",
          respondedAt: FieldValue.serverTimestamp(),
          respondedBy: uid,
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      batch.update(playerRef, {
        teamId,
        teamRequest: {
          ...request,
          status: "approved",
          respondedAt: FieldValue.serverTimestamp(),
          respondedBy: uid
        },
        teamRoster: {
          rosterId: rosterRef.id,
          divisionId: null,
          roleId: null,
          status: "active",
          joinedAt: FieldValue.serverTimestamp()
        },
        updatedAt: FieldValue.serverTimestamp()
      });

      await batch.commit();

      return json(res, 200, {
        success: true,
        action: "approved",
        playerId,
        rosterId: rosterRef.id
      });
    }

    if (action === "reject") {
      const reason = String(req.body?.reason || "").trim().slice(0, 300);

      if (requestRef) {
        const batch = db.batch();

        batch.update(requestRef, {
          status: "rejected",
          respondedAt: FieldValue.serverTimestamp(),
          respondedBy: uid,
          reviewReason: reason || null,
          updatedAt: FieldValue.serverTimestamp()
        });

        batch.update(playerRef, {
          teamRequest: {
            ...request,
            status: "rejected",
            respondedAt: FieldValue.serverTimestamp(),
            respondedBy: uid,
            reviewReason: reason || null
          },
          updatedAt: FieldValue.serverTimestamp()
        });

        await batch.commit();
      } else {
        await playerRef.update({
          teamRequest: {
            ...request,
            status: "rejected",
            respondedAt: FieldValue.serverTimestamp(),
            respondedBy: uid,
            reviewReason: reason || null
          },
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      return json(res, 200, {
        success: true,
        action: "rejected",
        playerId
      });
    }

    return json(res, 400, { error: "Acción de Roster no reconocida." });
  } catch (error) {
    console.error("NEXUS — Team Roster API error:", error);
    return json(res, error?.status || 500, {
      error: error?.message || "No fue posible procesar el Roster."
    });
  }
}
