// ========================================
// NEXUS — Tournament Recognition API
// ========================================

import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_lib/firebaseAdmin.js";

function json(res, status, payload) { return res.status(status).json(payload); }

async function authenticate(req) {
  const header = req.headers?.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Debes iniciar sesión.");
  const app = getFirebaseAdminApp();
  const decoded = await getAuth(app).verifyIdToken(token);
  return { app, uid: decoded.uid };
}

function getEntityKey(profile) {
  const entityType = profile?.entityType === "team" ? "team" : profile?.entityType === "player" ? "player" : null;
  return { entityType, entityId: profile?.entityId || null };
}

function getEvent(tournament, eventId) {
  const event = tournament?.events?.[eventId];
  if (!event) throw new Error("No se encontró el evento.");
  if (!event.pro) throw new Error("Este evento no tiene Tournament Pro habilitado.");
  return event;
}

function getRecognitionEntries(event) {
  const pro = event?.pro || {};
  const positions = Array.isArray(pro.recognition?.positions) ? pro.recognition.positions : [];
  const results = Array.isArray(pro.results?.standings) ? pro.results.standings : [];
  const requests = pro.recognition?.requests || {};

  return positions.map((position) => {
    const result = results.find((item) => Number(item.position) === Number(position));
    const participantId = result?.participantId || null;
    const participant = participantId ? pro.participants?.[participantId] : null;
    const request = requests?.[participantId] || null;
    return {
      position: Number(position),
      participantId,
      entityType: participant?.entityType || null,
      entityId: participant?.entityId || null,
      displayName: result?.displayName || participant?.displayName || participantId || "Participante",
      status: request?.status || "not_requested",
      requestedAt: request?.requestedAt || null,
      reviewedAt: request?.reviewedAt || null,
      reviewReason: request?.reviewReason || null,
      history: Array.isArray(request?.history) ? request.history : []
    };
  });
}

function isOwner(tournament, event, uid) {
  return Boolean((event?.ownerId && event.ownerId === uid) || (tournament?.ownerId && tournament.ownerId === uid));
}

function competitionSummary(tournamentId, eventId, tournament, event, entityType, entityId) {
  const pro = event.pro || {};
  const participantId = `${entityType}_${entityId}`;
  const participant = pro.participants?.[participantId] || Object.values(pro.participants || {}).find((item) => item.entityType === entityType && item.entityId === entityId);
  if (!participant) return null;

  const standings = Array.isArray(pro.results?.standings) ? pro.results.standings : [];
  const result = standings.find((item) => item.participantId === participant.id || item.participantId === participantId) || null;
  const recognition = getRecognitionEntries(event).find((item) => item.participantId === participant.id || item.participantId === participantId) || null;

  return {
    tournamentId,
    eventId,
    name: event.name || tournament.name || tournament.title || "Competencia NEXUS",
    tournamentName: tournament.name || tournament.title || "Torneo NEXUS",
    gameId: event.gameId || null,
    participationType: event.participationType || null,
    format: event.format || null,
    matchSystem: event.matchSystem || null,
    dateTime: event.dateTime || event.startDateTime || null,
    location: event.location || null,
    status: pro.status || event.status || "unknown",
    participantId: participant.id || participantId,
    participantStatus: participant.status || null,
    position: result?.position || null,
    recognition: recognition ? {
      eligible: true,
      position: recognition.position,
      status: recognition.status,
      requestedAt: recognition.requestedAt,
      reviewedAt: recognition.reviewedAt,
      reviewReason: recognition.reviewReason,
      history: recognition.history
    } : { eligible: false, position: null, status: "not_requested" }
  };
}

export default async function handler(req, res) {
  try {
    const { app, uid } = await authenticate(req);
    const db = getFirestore(app);
    const method = String(req.method || "GET").toUpperCase();
    const mode = String(req.query?.mode || req.body?.mode || "mine").toLowerCase();
    const tournamentId = String(req.query?.tournamentId || req.body?.tournamentId || "").trim();
    const eventId = String(req.query?.eventId || req.body?.eventId || "").trim();

    const profileSnap = await db.collection("users").doc(uid).get();
    const profile = profileSnap.exists ? profileSnap.data() : null;
    const { entityType, entityId } = getEntityKey(profile);

    // ========================================
    // ORGANIZER — GLOBAL RECOGNITIONS
    // ========================================
    // This view is intentionally independent from a single tournament/event.
    // One organizer can have several Tournament Pro events active or completed,
    // so the dashboard must aggregate all recognition records owned by uid.
    if (method === "GET" && mode === "list") {
      const tournamentsSnap = await db.collection("tournaments").get();
      const competitions = [];
      const recognitions = [];

      tournamentsSnap.forEach((doc) => {
        const tournament = { id: doc.id, ...doc.data() };
        const events = tournament.events && typeof tournament.events === "object" ? tournament.events : {};

        Object.entries(events).forEach(([currentEventId, event]) => {
          if (!event?.pro) return;

          const owner = isOwner(tournament, event, uid);
          if (!owner) return;

          const entries = getRecognitionEntries(event);
          if (!entries.length) return;

          const competition = {
            tournamentId: doc.id,
            eventId: currentEventId,
            name: event.name || tournament.name || tournament.title || "Competencia NEXUS",
            tournamentName: tournament.name || tournament.title || "Torneo NEXUS",
            status: event.pro?.status || event.status || null,
            gameId: event.gameId || null,
            dateTime: event.dateTime || event.startDateTime || null
          };

          competitions.push(competition);

          entries.forEach((recognition) => {
            recognitions.push({
              ...recognition,
              tournamentId: doc.id,
              eventId: currentEventId,
              competitionName: competition.name,
              tournamentName: competition.tournamentName,
              competitionStatus: competition.status,
              gameId: competition.gameId,
              dateTime: competition.dateTime
            });
          });
        });
      });

      competitions.sort((a, b) => String(b.dateTime || "").localeCompare(String(a.dateTime || "")));
      recognitions.sort((a, b) => {
        const statusOrder = { requested: 0, rejected: 1, approved: 2, not_requested: 3 };
        const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        if (statusDiff !== 0) return statusDiff;
        return String(b.reviewedAt || b.requestedAt || b.dateTime || "").localeCompare(String(a.reviewedAt || a.requestedAt || a.dateTime || ""));
      });

      return json(res, 200, {
        success: true,
        scope: "organizer",
        competitions,
        recognitions
      });
    }

    if (!entityType || !entityId) return json(res, 200, { success: true, hasProfile: false, competitions: [], recognitions: [] });

    // ========================================
    // PLAYER / TEAM — OWN COMPETITIONS
    // ========================================
    if (method === "GET" && mode === "mine") {
      const tournamentsSnap = await db.collection("tournaments").get();
      const competitions = [];
      tournamentsSnap.forEach((doc) => {
        const tournament = { id: doc.id, ...doc.data() };
        const events = tournament.events && typeof tournament.events === "object" ? tournament.events : {};
        Object.entries(events).forEach(([currentEventId, event]) => {
          if (!event?.pro) return;
          const summary = competitionSummary(doc.id, currentEventId, tournament, event, entityType, entityId);
          if (summary) competitions.push(summary);
        });
      });
      competitions.sort((a, b) => String(b.dateTime || "").localeCompare(String(a.dateTime || "")));
      return json(res, 200, { success: true, hasProfile: true, competitions });
    }

    if (!tournamentId || !eventId) return json(res, 400, { success: false, error: "Faltan los datos de la competencia." });

    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const tournamentSnap = await tournamentRef.get();
    if (!tournamentSnap.exists) throw new Error("No se encontró el torneo.");
    const tournament = { id: tournamentSnap.id, ...tournamentSnap.data() };
    const event = getEvent(tournament, eventId);

    // ========================================
    // PLAYER — CURRENT RECOGNITION STATUS
    // ========================================
    if (method === "GET" && mode === "status") {
      const summary = competitionSummary(tournamentId, eventId, tournament, event, entityType, entityId);
      const recognition = summary?.recognition || { eligible: false, status: "not_requested" };
      return json(res, 200, { success: true, hasProfile: true, eligible: recognition.eligible, recognition });
    }

    if (method !== "POST") return json(res, 405, { success: false, error: "Método no permitido." });

    const action = String(req.body?.action || "").toLowerCase();

    // ========================================
    // PLAYER — CLAIM
    // ========================================
    if (action === "request") {
      if (event.pro.status !== "finished") throw new Error("El reconocimiento solo puede reclamarse cuando la competencia ha finalizado.");
      const participantId = `${entityType}_${entityId}`;
      const entries = getRecognitionEntries(event);
      const eligible = entries.find((item) => item.participantId === participantId || item.entityId === entityId);
      if (!eligible) throw new Error("Este participante no tiene un reconocimiento habilitado.");

      const existing = event.pro.recognition?.requests?.[eligible.participantId] || null;
      if (existing?.status === "approved") throw new Error("Este reconocimiento ya fue aprobado.");
      if (existing?.status === "requested") throw new Error("Tu solicitud de reconocimiento ya está en revisión.");

      const now = new Date().toISOString();
      const history = Array.isArray(existing?.history) ? existing.history : [];
      history.push({ status: "requested", requestedAt: now });
      const request = {
        status: "requested",
        requestedAt: now,
        reviewedAt: null,
        reviewReason: null,
        history
      };

      await tournamentRef.update({
        [`events.${eventId}.pro.recognition.requests.${eligible.participantId}`]: request,
        updatedAt: FieldValue.serverTimestamp()
      });

      return json(res, 200, { success: true, recognition: { ...eligible, ...request } });
    }

    // ========================================
    // ORGANIZER — REVIEW
    // ========================================
    if (action === "review") {
      if (!isOwner(tournament, event, uid)) return json(res, 403, { success: false, error: "No tienes permiso para revisar reconocimientos." });
      if (event.pro.status !== "finished") throw new Error("La competencia todavía no está finalizada.");

      const participantId = String(req.body?.participantId || "").trim();
      const approve = req.body?.approve === true;
      const reason = String(req.body?.reason || "").trim();
      if (!participantId) throw new Error("Falta el participante.");

      const eligible = getRecognitionEntries(event).find((item) => item.participantId === participantId);
      if (!eligible) throw new Error("El participante no tiene un reconocimiento habilitado.");

      const existing = event.pro.recognition?.requests?.[participantId] || null;
      if (!existing || existing.status !== "requested") throw new Error("No existe una solicitud pendiente para este reconocimiento.");

      const now = new Date().toISOString();
      const history = Array.isArray(existing.history) ? existing.history : [];
      history.push({ status: approve ? "approved" : "rejected", reviewedAt: now, reviewReason: reason || null });
      const request = {
        ...existing,
        status: approve ? "approved" : "rejected",
        reviewedAt: now,
        reviewReason: reason || null,
        history
      };

      const updates = {
        [`events.${eventId}.pro.recognition.requests.${participantId}`]: request,
        updatedAt: FieldValue.serverTimestamp()
      };
      let playerUpdate = null;

      if (approve && eligible.entityType === "player" && eligible.entityId) {
        const playerRef = db.collection("players").doc(eligible.entityId);
        const playerSnap = await playerRef.get();
        if (playerSnap.exists) {
          const player = playerSnap.data() || {};
          const achievements = Array.isArray(player.achievements) ? [...player.achievements] : [];
          const achievement = {
            title: eligible.position === 1 ? "Campeón" : eligible.position === 2 ? "Subcampeón" : `${eligible.position}.º lugar`,
            name: event.name || tournament.name || tournament.title || "Competencia NEXUS",
            competitionId: eventId,
            tournamentId,
            gameId: event.gameId || null,
            position: eligible.position,
            awardedAt: now,
            verification: "nexus"
          };
          const exists = achievements.some((item) => item && typeof item === "object" && item.competitionId === eventId && Number(item.position) === Number(eligible.position));
          if (!exists) achievements.push(achievement);
          playerUpdate = { ref: playerRef, data: { achievements, updatedAt: FieldValue.serverTimestamp() } };
        }
      }

      const batch = db.batch();
      batch.update(tournamentRef, updates);
      if (playerUpdate) batch.update(playerUpdate.ref, playerUpdate.data);
      await batch.commit();

      return json(res, 200, { success: true, recognition: { ...eligible, ...request } });
    }

    throw new Error("Acción de reconocimiento no válida.");
  } catch (error) {
    console.error("NEXUS — Tournament Recognition API:", error);
    return json(res, error?.message?.includes("permiso") ? 403 : 400, { success: false, error: error?.message || "No fue posible procesar el reconocimiento." });
  }
}

