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

function getOfficialResults(pro) {
  const bracket = pro?.bracket;
  if (!bracket?.generated) throw new Error("El bracket todavía no está generado.");
  const matches = (bracket.stages || []).flatMap((stage) => stage.matches || []);
  const finalMatch = matches.find((match) => match.bracket === "grand_final" && match.id === "GF-M1")
    || [...matches].reverse().find((match) => match.bracket === "winners" && match.status === "completed");
  const championId = bracket.championId || finalMatch?.winnerId || null;
  if (!championId) throw new Error("El evento no puede finalizar sin campeón.");
  const champion = pro.participants?.[championId];
  const results = [{ position: 1, participantId: championId, displayName: champion?.displayName || championId }];
  const runnerUpId = finalMatch?.loserId || null;
  if (runnerUpId && runnerUpId !== championId) {
    const participant = pro.participants?.[runnerUpId];
    results.push({ position: 2, participantId: runnerUpId, displayName: participant?.displayName || runnerUpId });
  }
  return results;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { success: false, error: "Método no permitido." });
  try {
    const { app, uid } = await authenticate(req);
    const db = getFirestore(app);
    const tournamentId = String(req.body?.tournamentId || "").trim();
    const eventId = String(req.body?.eventId || "").trim();
    const requestedPositions = Array.isArray(req.body?.recognizedPositions) ? req.body.recognizedPositions.map(Number) : [];
    if (!tournamentId || !eventId) return json(res, 400, { success: false, error: "Faltan los datos de la competencia." });

    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const historyRef = db.collection("competitionHistory").doc(eventId);

    const result = await db.runTransaction(async (transaction) => {
      const tournamentSnap = await transaction.get(tournamentRef);
      if (!tournamentSnap.exists) throw new Error("No se encontró el torneo.");
      const historySnap = await transaction.get(historyRef);
      if (historySnap.exists) throw new Error("El historial de esta competencia ya existe.");

      const tournament = tournamentSnap.data() || {};
      const event = tournament.events?.[eventId];
      if (!event) throw new Error("No se encontró el evento.");
      if (event.ownerId && event.ownerId !== uid && tournament.ownerId !== uid) throw new Error("No tienes permiso para finalizar esta competencia.");
      if (!event.pro) throw new Error("Este evento no tiene Tournament Pro habilitado.");
      if (event.pro.status !== "live") throw new Error("Solo puedes finalizar un torneo que está en vivo.");

      const pro = event.pro;
      const allMatches = (pro.bracket?.stages || []).flatMap((stage) => stage.matches || []);
      if (allMatches.some((match) => match.status === "pending" || match.status === "live")) {
        throw new Error("No puedes finalizar el torneo mientras existan matches pendientes o en vivo.");
      }

      const officialResults = getOfficialResults(pro);
      const availablePositions = new Set(officialResults.map((item) => item.position));
      const positions = [...new Set(requestedPositions)]
        .filter((position) => Number.isInteger(position) && availablePositions.has(position))
        .sort((a, b) => a - b);
      if (!positions.length) throw new Error("Selecciona al menos un puesto para otorgar reconocimiento.");

      const completedAt = new Date().toISOString();
      const standings = officialResults.map((result) => ({ ...result }));
      const recognitionRecords = positions.map((position) => {
        const result = officialResults.find((item) => item.position === position);
        return { position, participantId: result.participantId, displayName: result.displayName, status: "NOT_REQUESTED" };
      });

      const updatedPro = {
        ...pro,
        status: "finished",
        results: { ...(pro.results || {}), standings, winnerIds: officialResults.filter((r) => r.position === 1).map((r) => r.participantId), completedAt },
        bracket: { ...pro.bracket, completedAt },
        recognition: { ...(pro.recognition || {}), enabled: true, positions, requests: {} }
      };

      const history = {
        competitionId: eventId,
        tournamentId,
        name: event.name || "",
        gameId: event.gameId || null,
        competitionOption: event.competitionOption || null,
        participationType: event.participationType || null,
        format: event.format || null,
        matchSystem: event.matchSystem || null,
        capacity: event.capacity?.value ?? event.capacity ?? null,
        dateTime: event.dateTime || event.startDateTime || null,
        location: event.location || null,
        registrationCost: event.registrationCost ?? event.cost ?? null,
        status: "completed",
        results: {
          first: standings.find((r) => r.position === 1) || null,
          second: standings.find((r) => r.position === 2) || null,
          third: standings.find((r) => r.position === 3) || null
        },
        recognitions: recognitionRecords,
        completedAt
      };

      transaction.update(tournamentRef, {
        [`events.${eventId}.pro`]: updatedPro,
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.create(historyRef, { ...history, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

      return { event: { ...event, pro: updatedPro }, history };
    });

    return json(res, 200, { success: true, event: result.event, history: result.history });
  } catch (error) {
    console.error("ARKHAM — Tournament Finalization API:", error);
    const message = error?.message || "No fue posible finalizar el torneo.";
    return json(res, message.includes("permiso") ? 403 : 400, { success: false, error: message });
  }
}
