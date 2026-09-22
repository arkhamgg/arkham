// ========================================
// ARKHAM — Team Requests API
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

function normalizeRequest(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    requestId: doc.id,
    teamId: data.teamId || doc.ref.parent.parent?.id || null,
    playerId: data.playerId || null,
    status: String(data.status || "pending").toLowerCase(),
    type: data.type || "player_request",
    requestedAt: data.requestedAt || null,
    respondedAt: data.respondedAt || null,
    respondedBy: data.respondedBy || null,
    reviewReason: data.reviewReason || null,
    createdAt: data.createdAt || data.requestedAt || null,
    _ref: doc.ref
  };
}

async function getPlayerRequestDocs(db, playerId) {
  try {
    const snapshot = await db.collectionGroup("teamRequests")
      .where("playerId", "==", playerId)
      .get();
    return snapshot.docs;
  } catch (queryError) {
    console.warn("ARKHAM — collectionGroup teamRequests no disponible; usando fallback por Team.", queryError);
    const teamsSnapshot = await db.collection("teams").get();
    const snapshots = await Promise.all(
      teamsSnapshot.docs.map((teamDoc) =>
        teamDoc.ref.collection("teamRequests")
          .where("playerId", "==", playerId)
          .get()
      )
    );
    return snapshots.flatMap((snapshot) => snapshot.docs);
  }
}

export default async function handler(req, res) {
  try {
    const { app, uid } = await authenticate(req);
    const db = getFirestore(app);
    const method = String(req.method || "GET").toUpperCase();

    const profileSnap = await db.collection("users").doc(uid).get();
    const profile = profileSnap.exists ? profileSnap.data() : null;
    const playerId = profile?.entityType === "player" ? profile?.entityId : null;

    if (method === "GET") {
      if (!playerId) return json(res, 400, { success: false, error: "Tu cuenta ARKHAM no tiene un perfil Player." });

      let requestDocs = [];
      try {
        const snapshot = await db.collectionGroup("teamRequests")
          .where("playerId", "==", playerId)
          .get();
        requestDocs = snapshot.docs;
      } catch (queryError) {
        // Fallback sin collection-group index: las solicitudes siguen siendo
        // team-scoped, por lo que recorremos los Teams existentes.
        console.warn("ARKHAM — collectionGroup teamRequests no disponible; usando fallback por Team.", queryError);
        const teamsSnapshot = await db.collection("teams").get();
        const teamRequestsSnapshots = await Promise.all(
          teamsSnapshot.docs.map((teamDoc) =>
            teamDoc.ref.collection("teamRequests")
              .where("playerId", "==", playerId)
              .get()
          )
        );
        requestDocs = teamRequestsSnapshots.flatMap((snapshot) => snapshot.docs);
      }

      const requests = requestDocs
        .map(normalizeRequest)
        .map(({ _ref, ...request }) => request)
        .sort((a, b) => String(b.requestedAt || "").localeCompare(String(a.requestedAt || "")));

      return json(res, 200, { success: true, requests });
    }

    if (method !== "POST") return json(res, 405, { error: "Método no permitido." });
    if (!playerId) return json(res, 400, { success: false, error: "Tu cuenta ARKHAM no tiene un perfil Player." });

    const action = String(req.body?.action || "").trim().toLowerCase();
    const teamId = String(req.body?.teamId || "").trim();
    if (!teamId) return json(res, 400, { error: "No se indicó el Team." });

    const teamRef = db.collection("teams").doc(teamId);
    const playerRef = db.collection("players").doc(playerId);
    const [teamSnap, playerSnap] = await Promise.all([teamRef.get(), playerRef.get()]);

    if (!teamSnap.exists) return json(res, 404, { error: "No se encontró el Team." });
    if (!playerSnap.exists) return json(res, 404, { error: "No se encontró tu perfil Player." });

    const player = { id: playerSnap.id, ...playerSnap.data() };
    const requestsRef = teamRef.collection("teamRequests");

    if (action === "submit") {
      if (player.teamId) return json(res, 409, { error: "Ya perteneces a un Team confirmado." });

      const pendingDocs = await getPlayerRequestDocs(db, playerId);
      const pendingSnapshot = { docs: pendingDocs };

      const pending = pendingSnapshot.docs
        .map(normalizeRequest)
        .filter((request) => request.status === "pending");

      const sameTeam = pending.find((request) => request.teamId === teamId);
      if (sameTeam) return json(res, 409, { error: "Ya tienes una solicitud pendiente para este Team.", request: (({ _ref, ...r }) => r)(sameTeam) });

      const batch = db.batch();
      pending.forEach((request) => {
        batch.update(request._ref, {
          status: "cancelled",
          respondedAt: FieldValue.serverTimestamp(),
          respondedBy: uid,
          reviewReason: "Solicitud reemplazada por una nueva solicitud.",
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      const requestRef = requestsRef.doc();
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

      // Se conserva únicamente como estado de conveniencia para compatibilidad
      // con la versión actual del perfil Player. La fuente de verdad es teamRequests.
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
      return json(res, 200, { success: true, action: "submitted", requestId: requestRef.id, teamId });
    }

    if (action === "cancel") {
      const pendingDocs = await getPlayerRequestDocs(db, playerId);

      const pending = pendingDocs
        .map(normalizeRequest)
        .filter((request) => request.teamId === teamId && request.status === "pending");

      if (!pending.length) return json(res, 404, { error: "No tienes una solicitud pendiente para este Team." });

      const batch = db.batch();
      pending.forEach((request) => {
        batch.update(request._ref, {
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
      return json(res, 200, { success: true, action: "cancelled", teamId });
    }

    return json(res, 400, { error: "Acción de solicitud no reconocida." });
  } catch (error) {
    console.error("ARKHAM — Team Requests API error:", error);
    return json(res, error?.status || 500, { error: error?.message || "No fue posible procesar la solicitud de Team." });
  }
}
