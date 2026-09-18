// ========================================
// NEXUS — Team Divisions API
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

  const ref = db.collection("teams").doc(teamId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("No se encontró el Team.");

  const team = { id: snap.id, ...snap.data() };
  if (team.ownerId !== uid) {
    const error = new Error("No tienes permisos para administrar este Team.");
    error.status = 403;
    throw error;
  }

  return { team, teamRef: ref };
}

function normalizeDivision(id, division = {}) {
  return {
    id,
    name: String(division.name || "").trim(),
    gameId: String(division.gameId || "").trim(),
    gameName: String(division.gameName || "").trim(),
    description: String(division.description || "").trim(),
    status: division.status === "inactive" ? "inactive" : "active",
    createdAt: division.createdAt || null,
    updatedAt: division.updatedAt || null
  };
}

function sortDivisions(divisions) {
  return divisions.sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "es")
  );
}

export default async function handler(req, res) {
  try {
    const { app, uid } = await authenticate(req);
    const db = getFirestore(app);
    const method = String(req.method || "GET").toUpperCase();
    const teamId = String(req.query?.teamId || req.body?.teamId || "").trim();
    const { team, teamRef } = await getOwnedTeam(db, uid, teamId);

    const divisions = team.divisions && typeof team.divisions === "object" && !Array.isArray(team.divisions)
      ? team.divisions
      : {};

    if (method === "GET") {
      const rosterSnap = await db.collection("teamRoster")
        .where("teamId", "==", teamId)
        .where("status", "==", "active")
        .get();

      const playerCounts = {};
      rosterSnap.docs.forEach((doc) => {
        const divisionId = doc.data()?.divisionId;
        if (divisionId) playerCounts[divisionId] = (playerCounts[divisionId] || 0) + 1;
      });

      return json(res, 200, {
        team: { id: team.id, name: team.name || team.teamName || "Team" },
        divisions: sortDivisions(
          Object.entries(divisions).map(([id, division]) => ({
            ...normalizeDivision(id, division),
            playerCount: playerCounts[id] || 0
          }))
        )
      });
    }

    if (method !== "POST" && method !== "PATCH" && method !== "DELETE") {
      return json(res, 405, { error: "Método no permitido." });
    }

    if (method === "POST") {
      const name = String(req.body?.name || "").trim();
      const gameId = String(req.body?.gameId || "").trim();
      const description = String(req.body?.description || "").trim();
      const players = Array.isArray(req.body?.players) ? req.body.players : [];

      if (!name) return json(res, 400, { error: "El nombre de la división es obligatorio." });
      if (!gameId) return json(res, 400, { error: "Debes seleccionar un juego." });

      const gameSnap = await db.collection("games").doc(gameId).get();
      if (!gameSnap.exists) return json(res, 400, { error: "El juego seleccionado no existe." });
      const game = gameSnap.data();
      if (game.status !== "active") return json(res, 400, { error: "El juego seleccionado no está disponible." });

      const duplicate = Object.values(divisions).some((division) =>
        String(division?.gameId || "") === gameId && String(division?.status || "active") === "active"
      );
      if (duplicate) {
        return json(res, 409, { error: "Este Team ya tiene una división activa para ese juego." });
      }

      const roles = game?.competitiveInfo?.roles || [];
      const roleMap = new Map();

      const registerRole = (role, fallbackId = "") => {
        if (typeof role === "string") {
          const value = role.trim();
          if (value) roleMap.set(value, role);
          return;
        }

        if (!role || typeof role !== "object") return;

        const identifiers = [
          role.id,
          role.roleId,
          role.key,
          role.value,
          role.slug,
          role.code,
          fallbackId,
          role.name,
          role.label
        ]
          .filter((value) => value !== undefined && value !== null)
          .map((value) => String(value).trim())
          .filter(Boolean);

        identifiers.forEach((identifier) => {
          roleMap.set(identifier, role);
        });
      };

      if (Array.isArray(roles)) {
        roles.forEach((role) => registerRole(role));
      } else if (roles && typeof roles === "object") {
        Object.entries(roles).forEach(([id, role]) => registerRole(role, id));
      }

      const normalizedPlayers = [];
      const playerIds = new Set();

      for (const item of players) {
        const playerId = String(item?.playerId || "").trim();
        const roleId = String(item?.roleId || "").trim();

        if (!playerId || playerIds.has(playerId)) continue;
        playerIds.add(playerId);

        const matchingRoleId = roleId
          ? [...roleMap.keys()].find((identifier) =>
              String(identifier).trim().toLowerCase() === roleId.toLowerCase()
            )
          : null;

        if (!roleId || !matchingRoleId) {
          return json(res, 400, {
            error: `El rol seleccionado para el Player ${playerId} no pertenece a la configuración competitiva de este juego.`
          });
        }

        // Persistimos el identificador canónico que existe en la configuración del juego.
        item.roleId = String(matchingRoleId);

        normalizedPlayers.push({ playerId, roleId });
      }

      const rosterSnapshot = await db
        .collection("teamRoster")
        .where("teamId", "==", teamId)
        .where("status", "==", "active")
        .get();

      const rosterByPlayer = new Map();
      rosterSnapshot.docs.forEach((doc) => {
        const data = doc.data() || {};
        if (data.playerId) rosterByPlayer.set(String(data.playerId), { id: doc.id, ...data });
      });

      for (const item of normalizedPlayers) {
        const roster = rosterByPlayer.get(item.playerId);
        if (!roster) {
          return json(res, 409, {
            error: `El Player ${item.playerId} no pertenece al Roster activo de este Team.`
          });
        }

        if (roster.divisionId && String(roster.divisionId) !== "") {
          return json(res, 409, {
            error: `El Player ${item.playerId} ya pertenece a otra división de este Team.`
          });
        }
      }

      const divisionId = db.collection("teams").doc().id;
      const division = {
        name,
        gameId,
        gameName: String(game.name || game.title || gameId),
        description,
        status: "active",
        playerCount: normalizedPlayers.length,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      const batch = db.batch();
      batch.update(teamRef, {
        [`divisions.${divisionId}`]: division,
        updatedAt: FieldValue.serverTimestamp()
      });

      normalizedPlayers.forEach((item) => {
        const roster = rosterByPlayer.get(item.playerId);
        batch.update(db.collection("teamRoster").doc(roster.id), {
          divisionId,
          roleId: item.roleId,
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      await batch.commit();

      return json(res, 201, {
        division: normalizeDivision(divisionId, { ...division, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
        playerCount: normalizedPlayers.length
      });
    }

    const divisionId = String(req.body?.divisionId || req.query?.divisionId || "").trim();
    if (!divisionId || !divisions[divisionId]) {
      return json(res, 404, { error: "No se encontró la división." });
    }

    if (method === "PATCH") {
      const current = divisions[divisionId];
      const name = String(req.body?.name ?? current.name ?? "").trim();
      const description = String(req.body?.description ?? current.description ?? "").trim();
      const status = req.body?.status === "inactive" ? "inactive" : "active";

      if (!name) return json(res, 400, { error: "El nombre de la división es obligatorio." });

      await teamRef.update({
        [`divisions.${divisionId}.name`]: name,
        [`divisions.${divisionId}.description`]: description,
        [`divisions.${divisionId}.status`]: status,
        [`divisions.${divisionId}.updatedAt`]: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      return json(res, 200, { ok: true });
    }

    const rosterSnap = await db.collection("teamRoster")
      .where("teamId", "==", teamId)
      .where("divisionId", "==", divisionId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    const hasPlayers = !rosterSnap.empty;

    if (hasPlayers) {
      return json(res, 409, {
        error: "No puedes eliminar una división que tiene Players asignados. Retira primero a sus jugadores."
      });
    }

    await teamRef.update({
      [`divisions.${divisionId}`]: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error("NEXUS — Team Divisions API:", error);
    return json(res, error?.status || 500, {
      error: error?.message || "No fue posible procesar las divisiones."
    });
  }
}
