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
  const snap = await teamRef.get();
  if (!snap.exists) throw new Error("No se encontró el Team.");
  const team = { id: snap.id, ...snap.data() };
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

async function commitInChunks(db, operations) {
  for (let index = 0; index < operations.length; index += 450) {
    const batch = db.batch();
    operations.slice(index, index + 450).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

async function migrateLegacyRoster(db, teamRef, teamId) {
  const target = teamRef.collection("teamRoster");
  const existing = await target.limit(1).get();
  if (!existing.empty) return;

  const legacy = await db.collection("teamRoster")
    .where("teamId", "==", teamId)
    .get();
  if (legacy.empty) return;

  await commitInChunks(db, legacy.docs.map((doc) => (batch) => {
    batch.set(target.doc(doc.id), {
      ...doc.data(),
      migratedFrom: "teamRoster",
      migratedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.delete(doc.ref);
  }));
}

async function migrateLegacyRequests(db, teamRef, teamId) {
  const target = teamRef.collection("teamRequests");
  const existing = await target.limit(1).get();
  if (!existing.empty) return;

  const legacy = await db.collection("teamRequests")
    .where("teamId", "==", teamId)
    .get();
  if (legacy.empty) return;

  await commitInChunks(db, legacy.docs.map((doc) => (batch) => {
    batch.set(target.doc(doc.id), {
      ...doc.data(),
      migratedFrom: "teamRequests",
      migratedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.delete(doc.ref);
  }));
}

export default async function handler(req, res) {
  try {
    const { app, uid } = await authenticate(req);
    const db = getFirestore(app);
    const method = String(req.method || "GET").toUpperCase();
    const teamId = String(req.query?.teamId || req.body?.teamId || "").trim();
    const { team, teamRef } = await getOwnedTeam(db, uid, teamId);
    const rosterRef = teamRef.collection("teamRoster");
    const requestsRef = teamRef.collection("teamRequests");

    await migrateLegacyRoster(db, teamRef, teamId);
    await migrateLegacyRequests(db, teamRef, teamId);

    if (method === "GET") {
      const [playersSnap, rosterSnap, requestSnap] = await Promise.all([
        db.collection("players").get(),
        rosterRef.where("status", "==", "active").get(),
        requestsRef.get()
      ]);

      const players = new Map(playersSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));

      const members = rosterSnap.docs.map((doc) => {
        const roster = doc.data() || {};
        const player = players.get(String(roster.playerId || ""));
        if (!player) return null;
        return {
          rosterId: doc.id,
          playerId: String(roster.playerId || ""),
          playerName: playerName(player),
          gamertag: player.gamertag || "",
          teamId,
          divisionId: roster.divisionId || null,
          roleId: roster.roleId || null,
          joinedAt: roster.joinedAt || null,
          status: roster.status || "active"
        };
      }).filter(Boolean);

      const requests = requestSnap.docs
        .map(normalizeRequest)
        .filter((request) => request.type === "player_request")
        .map(({ _ref, ...request }) => {
          const player = players.get(request.playerId);
          return {
            ...request,
            playerName: playerName(player || {}),
            gamertag: player?.gamertag || ""
          };
        })
        .sort((a, b) => String(b.requestedAt || "").localeCompare(String(a.requestedAt || "")));

      return json(res, 200, { success: true, team, members, requests });
    }

    if (method !== "POST") return json(res, 405, { error: "Método no permitido." });

    const action = String(req.body?.action || "").trim().toLowerCase();
    const playerId = String(req.body?.playerId || "").trim();
    const requestId = String(req.body?.requestId || "").trim();
    if (!playerId) return json(res, 400, { error: "No se indicó el Player." });

    const playerRef = db.collection("players").doc(playerId);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) return json(res, 404, { error: "No se encontró el Player." });
    const player = { id: playerSnap.id, ...playerSnap.data() };

    if (action === "remove") {
      if (player.teamId !== teamId) return json(res, 409, { error: "Este Player ya no pertenece a este Team." });

      const rosterSnapshot = await rosterRef
        .where("playerId", "==", playerId)
        .where("status", "==", "active")
        .get();

      const batch = db.batch();
      rosterSnapshot.docs.forEach((doc) => batch.update(doc.ref, {
        status: "removed",
        removedAt: FieldValue.serverTimestamp(),
        removedBy: uid,
        updatedAt: FieldValue.serverTimestamp()
      }));

      const competitiveProfiles = Array.isArray(player.competitiveProfiles)
        ? player.competitiveProfiles.map((profile) => ({
            ...profile,
            availability: profile?.availability === "in_team" ? "looking_for_team" : profile?.availability
          }))
        : null;

      batch.update(playerRef, {
        teamId: null,
        teamMembershipStatus: "removed",
        ...(competitiveProfiles ? { competitiveProfiles } : {}),
        updatedAt: FieldValue.serverTimestamp()
      });

      await batch.commit();
      return json(res, 200, { success: true, action: "removed", playerId, teamId, rosterRecordsUpdated: rosterSnapshot.size });
    }

    let requestRef = null;
    let request = null;

    if (requestId) {
      requestRef = requestsRef.doc(requestId);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) return json(res, 404, { error: "No se encontró la solicitud." });
      request = { id: requestSnap.id, ...requestSnap.data() };
    } else {
      const pendingSnapshot = await requestsRef
        .where("playerId", "==", playerId)
        .where("status", "==", "pending")
        .limit(1)
        .get();
      if (!pendingSnapshot.empty) {
        requestRef = pendingSnapshot.docs[0].ref;
        request = { id: pendingSnapshot.docs[0].id, ...pendingSnapshot.docs[0].data() };
      }
    }

    if (!request || request.teamId !== teamId || request.playerId !== playerId || request.status !== "pending") {
      return json(res, 409, { error: "Esta solicitud ya no está pendiente o pertenece a otro Team." });
    }

    if (action === "approve") {
      if (player.teamId && player.teamId !== teamId) {
        return json(res, 409, { error: "Este Player ya pertenece a otro Team confirmado." });
      }

      const existingRoster = await rosterRef.where("playerId", "==", playerId).where("status", "==", "active").limit(1).get();
      if (!existingRoster.empty) {
        return json(res, 409, { error: "Este Player ya está activo en el Roster de este Team." });
      }

      const rosterDoc = rosterRef.doc();
      const batch = db.batch();
      batch.set(rosterDoc, {
        playerId,
        divisionId: null,
        roleId: null,
        status: "active",
        joinedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      batch.update(requestRef, {
        status: "approved",
        respondedAt: FieldValue.serverTimestamp(),
        respondedBy: uid,
        updatedAt: FieldValue.serverTimestamp()
      });
      batch.update(playerRef, {
        teamId,
        teamMembershipStatus: "active",
        updatedAt: FieldValue.serverTimestamp()
      });
      await batch.commit();

      return json(res, 200, { success: true, action: "approved", playerId, rosterId: rosterDoc.id });
    }

    if (action === "reject") {
      const reason = String(req.body?.reason || "").trim().slice(0, 300);
      const batch = db.batch();
      batch.update(requestRef, {
        status: "rejected",
        respondedAt: FieldValue.serverTimestamp(),
        respondedBy: uid,
        reviewReason: reason || null,
        updatedAt: FieldValue.serverTimestamp()
      });
      // Mantener el snapshot actual en Player evita romper la UI existente;
      // el historial y la fuente de verdad siguen estando en teamRequests.
      batch.update(playerRef, {
        teamRequest: {
          teamId,
          status: "rejected",
          respondedAt: FieldValue.serverTimestamp(),
          respondedBy: uid,
          reviewReason: reason || null,
          requestId: request.id
        },
        updatedAt: FieldValue.serverTimestamp()
      });
      await batch.commit();
      return json(res, 200, { success: true, action: "rejected", playerId });
    }

    return json(res, 400, { error: "Acción de Roster no reconocida." });
  } catch (error) {
    console.error("NEXUS — Team Roster API error:", error);
    return json(res, error?.status || 500, { error: error?.message || "No fue posible procesar el Roster." });
  }
}
