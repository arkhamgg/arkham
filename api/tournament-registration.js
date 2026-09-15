// ========================================
// NEXUS — Tournament Registration API
// ========================================

import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_lib/firebaseAdmin.js";

const app = getFirebaseAdminApp();
const adminAuth = getAuth(app);
const db = getFirestore(app);

function response(res, success, data = {}, status = 200) {
  return res.status(status).json({ success, ...data });
}

function tokenFrom(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

async function authenticate(req) {
  const token = tokenFrom(req);
  if (!token) throw new Error("AUTH_TOKEN_MISSING");
  return adminAuth.verifyIdToken(token);
}

function eventRef(tournamentId, eventId) {
  return db.collection("tournaments").doc(tournamentId);
}

function normalizeParticipantType(event, profile) {
  const participation = String(event?.participationType || "").toLowerCase();
  if (participation.includes("team") || participation.includes("equipo")) {
    if (profile.entityType !== "team") throw new Error("Este evento requiere un equipo NEXUS.");
    return "team";
  }
  if (profile.entityType !== "player") throw new Error("Este evento requiere un perfil Player NEXUS.");
  return "player";
}

export default async function handler(req, res) {
  try {
    const decoded = await authenticate(req);

    if (req.method === "POST") {
      const { tournamentId, eventId, proof = null } = req.body || {};
      if (!tournamentId || !eventId) return response(res, false, { error: "Faltan tournamentId o eventId." }, 400);

      const userSnap = await db.collection("users").doc(decoded.uid).get();
      if (!userSnap.exists) return response(res, false, { error: "Tu cuenta NEXUS no tiene un perfil competitivo." }, 400);
      const profile = userSnap.data() || {};

      const ref = eventRef(tournamentId, eventId);
      const snap = await ref.get();
      if (!snap.exists) return response(res, false, { error: "No se encontró el torneo." }, 404);
      const data = snap.data() || {};
      const event = data.events?.[eventId];
      if (!event) return response(res, false, { error: "No se encontró el evento." }, 404);
      if (!event.pro) return response(res, false, { error: "Este evento no tiene inscripción Tournament Pro." }, 403);
      if (event.pro.status === "finished" || event.pro.status === "archived") return response(res, false, { error: "La inscripción para este evento ya está cerrada." }, 400);

      const participantType = normalizeParticipantType(event, profile);
      const participantCollection = participantType === "team" ? "teams" : "players";
      const participantSnap = await db.collection(participantCollection).doc(profile.entityId).get();
      if (!participantSnap.exists) return response(res, false, { error: "Tu perfil competitivo ya no está disponible." }, 400);
      const participantData = participantSnap.data() || {};
      const participantId = `${participantType}_${profile.entityId}`;
      const requests = event.pro.registration?.requests || {};
      const participants = event.pro.participants || {};
      const duplicate = Object.values(requests).find((item) => item?.uid === decoded.uid && ["pending", "approved"].includes(item.status));
      if (duplicate) return response(res, false, { error: "Ya tienes una solicitud activa para este evento." }, 409);
      if (participants[participantId]) return response(res, false, { error: "Ya formas parte de este evento." }, 409);

      const capacity = Number(event.pro.capacity?.value || event.pro.capacity || event.capacity?.value || event.capacity || 0);
      const activeCount = Object.values(participants).filter((p) => !["rejected", "withdrawn", "no_show"].includes(p.status)).length;
      if (capacity > 0 && activeCount >= capacity) return response(res, false, { error: "No quedan asientos disponibles." }, 409);

      const requestId = `request_${decoded.uid}_${Date.now()}`;
      const displayName = profile.entityType === "team"
        ? (participantData.name || participantData.shortName || profile.entityId)
        : (participantData.gamertag || participantData.name || `${participantData.firstName || ""} ${participantData.lastName || ""}`.trim() || profile.entityId);

      const requirements = event.registrationRequirements?.enabled
        ? (event.registrationRequirements.requirements || [])
        : [];
      const proofRequired = requirements.some((item) => item?.requiresProof === true);
      if (proofRequired && !proof) {
        return response(res, false, { error: "Debes adjuntar el comprobante requerido para enviar la solicitud." }, 400);
      }

      const request = {
        uid: decoded.uid,
        entityType: participantType,
        entityId: profile.entityId,
        participantId,
        displayName,
        status: "pending",
        proof: proof || null,
        requirements: event.registrationRequirements || null,
        createdAt: new Date().toISOString(),
        reviewedAt: null
      };

      await ref.update({
        [`events.${eventId}.pro.registration.requests.${requestId}`]: request,
        updatedAt: FieldValue.serverTimestamp()
      });

      return response(res, true, { requestId, status: "pending" }, 201);
    }

    return response(res, false, { error: "Método HTTP no permitido." }, 405);
  } catch (error) {
    console.error("NEXUS — Tournament Registration API:", error);
    const status = error.message === "AUTH_TOKEN_MISSING" ? 401 : 500;
    return response(res, false, { error: error.message || "No fue posible procesar la solicitud." }, status);
  }
}
