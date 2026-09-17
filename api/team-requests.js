// ========================================
// NEXUS — Team Requests API
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

function playerName(player = {}) {
  return [player.gamertag, player.name, player.lastName]
    .filter(Boolean)
    .join(" ") || player.id || "Player";
}

function normalizeRequest(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    requestId: doc.id,
    teamId: data.teamId || null,
    playerId: data.playerId || null,
    status: String(data.status || "pending").toLowerCase(),
    type: data.type || "player_request",
    requestedAt: data.requestedAt || null,
    respondedAt: data.respondedAt || null,
    respondedBy: data.respondedBy || null,
    reviewReason: data.reviewReason || null,
    createdAt: data.createdAt || data.requestedAt || null
  };
}

export default async function handler(req, res) {
  try {
    const { app, uid } = await authenticate(req);
    const db = getFirestore(app);
    const method = String(req.method || "GET").toUpperCase();

    const profileSnap = await db.collection("users").doc(uid).get();
    const profile = profileSnap.exists ? profileSnap.data() : null;

    const entityType = profile?.entityType === "player" ? "player" : null;
    const playerId = profile?.entityType === "player" ? profile?.entityId : null;

    if (method === "GET") {
      if (!playerId) {
        return json(res, 400, {
          success: false,
          error: "Tu cuenta NEXUS no tiene un perfil Player."
        });
      }

      const snapshot = await db
        .collection("teamRequests")
        .where("playerId", "==", playerId)
        .get();

      const requests = snapshot.docs
        .map(normalizeRequest)
        .sort((a, b) => String(b.requestedAt || "").localeCompare(String(a.requestedAt || "")));

      return json(res, 200, {
        success: true,
        requests
      });
    }

    if (method !== "POST") {
      return json(res, 405, { error: "Método no permitido." });
    }

    if (!entityType || !playerId) {
      return json(res, 400, {
        success: false,
        error: "Tu cuenta NEXUS no tiene un perfil Player."
      });
    }

    const action = String(req.body?.action || "").trim().toLowerCase();
    const teamId = String(req.body?.teamId || "").trim();

    if (!teamId) {
      return json(res, 400, { error: "No se indicó el Team." });
    }

    const teamRef = db.collection("teams").doc(teamId);
    const playerRef = db.collection("players").doc(playerId);

    const [teamSnap, playerSnap] = await Promise.all([
      teamRef.get(),
      playerRef.get()
    ]);

    if (!teamSnap.exists) {
      return json(res, 404, { error: "No se encontró el Team." });
    }

    if (!playerSnap.exists) {
      return json(res, 404, { error: "No se encontró tu perfil Player." });
    }

    const player = { id: playerSnap.id, ...playerSnap.data() };

    if (action === "submit") {
      if (player.teamId) {
        return json(res, 409, {
          error: "Ya perteneces a un Team confirmado."
        });
      }

      const existingSnapshot = await db
        .collection("teamRequests")
        .where("playerId", "==", playerId)
        .get();

      const existing = existingSnapshot.docs
        .map(normalizeRequest)
        .filter((request) => request.status === "pending");

      const sameTeam = existing.find((request) => request.teamId === teamId);

      if (sameTeam) {
        return json(res, 409, {
          error: "Ya tienes una solicitud pendiente para este Team.",
          request: sameTeam
        });
      }

      const batch = db.batch();

      existing.forEach((request) => {
        batch.update(db.collection("teamRequests").doc(request.requestId), {
          status: "cancelled",
          respondedAt: FieldValue.serverTimestamp(),
          respondedBy: uid,
          reviewReason: "Solicitud reemplazada por una nueva solicitud.",
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      const requestRef = db.collection("teamRequests").doc();
      batch.set(requestRef, {
        teamId,
        playerId,
        type: "player_request",
        status: "pending",
        requestedAt: FieldValue.serverTimestamp(),
        respondedAt: null,
        respondedBy: null,
        reviewReason: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      batch.update(playerRef, {
        teamRequest: {
          teamId,
          status: "pending",
          requestedAt: FieldValue.serverTimestamp(),
          respondedAt: null,
          respondedBy: null,
          reviewReason: null,
          requestId: requestRef.id
        },
        updatedAt: FieldValue.serverTimestamp()
      });

      await batch.commit();

      return json(res, 200, {
        success: true,
        action: "submitted",
        requestId: requestRef.id,
        teamId
      });
    }

    if (action === "cancel") {
      const snapshot = await db
        .collection("teamRequests")
        .where("playerId", "==", playerId)
        .get();

      const pending = snapshot.docs
        .map(normalizeRequest)
        .filter((request) => request.teamId === teamId && request.status === "pending");

      if (!pending.length) {
        return json(res, 404, {
          error: "No tienes una solicitud pendiente para este Team."
        });
      }

      const batch = db.batch();

      pending.forEach((request) => {
        batch.update(db.collection("teamRequests").doc(request.requestId), {
          status: "cancelled",
          respondedAt: FieldValue.serverTimestamp(),
          respondedBy: uid,
          reviewReason: null,
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      const currentRequest = player.teamRequest || null;

      if (currentRequest?.teamId === teamId && currentRequest?.status === "pending") {
        batch.update(playerRef, {
          teamRequest: {
            ...currentRequest,
            status: "cancelled",
            respondedAt: FieldValue.serverTimestamp(),
            respondedBy: uid
          },
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      await batch.commit();

      return json(res, 200, {
        success: true,
        action: "cancelled",
        teamId
      });
    }

    return json(res, 400, { error: "Acción de solicitud no reconocida." });
  } catch (error) {
    console.error("NEXUS — Team Requests API error:", error);
    return json(res, error?.status || 500, {
      error: error?.message || "No fue posible procesar la solicitud de Team."
    });
  }
}
