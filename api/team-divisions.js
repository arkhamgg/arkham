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

function normalizeDivision(id, division = {}) {
  return {
    id,
    name: String(division.name || "").trim(),
    gameId: String(division.gameId || "").trim(),
    gameName: String(division.gameName || "").trim(),
    description: String(division.description || "").trim(),
    status: division.status === "inactive" ? "inactive" : "active",
    playerCount: Number(division.playerCount || 0),
    createdAt: division.createdAt || null,
    updatedAt: division.updatedAt || null
  };
}

function sortDivisions(divisions) {
  return divisions.sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "es")
  );
}

function divisionsCollection(teamRef) {
  return teamRef.collection("divisions");
}

function rosterCollection(teamRef) {
  return teamRef.collection("teamRoster");
}

async function commitInChunks(db, operations) {
  for (let index = 0; index < operations.length; index += 450) {
    const batch = db.batch();
    operations.slice(index, index + 450).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

async function migrateLegacyDivisions(db, teamRef, team) {
  const collection = divisionsCollection(teamRef);
  const existing = await collection.limit(1).get();
  if (!existing.empty) return;

  const legacy = team.divisions && typeof team.divisions === "object" && !Array.isArray(team.divisions)
    ? team.divisions
    : {};

  const entries = Object.entries(legacy);
  if (!entries.length) return;

  await commitInChunks(db, entries.map(([id, division]) => (batch) => {
    batch.set(collection.doc(id), division, { merge: true });
  }));

  await teamRef.update({
    divisions: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp()
  });
}

async function migrateLegacyRoster(db, teamRef, teamId) {
  const collection = rosterCollection(teamRef);
  const existing = await collection.limit(1).get();
  if (!existing.empty) return;

  const legacy = await db.collection("teamRoster")
    .where("teamId", "==", teamId)
    .get();

  if (legacy.empty) return;

  await commitInChunks(db, legacy.docs.map((doc) => (batch) => {
    batch.set(collection.doc(doc.id), {
      ...doc.data(),
      migratedFrom: "teamRoster",
      migratedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.delete(doc.ref);
  }));
}

function buildRoleMap(game) {
  const roles = game?.competitiveInfo?.roles || [];
  const roleMap = new Map();

  const registerRole = (role, fallbackId = "") => {
    if (typeof role === "string") {
      const value = role.trim();
      if (value) roleMap.set(value.toLowerCase(), value);
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

    identifiers.forEach((identifier) => roleMap.set(identifier.toLowerCase(), identifier));
  };

  if (Array.isArray(roles)) {
    roles.forEach((role) => registerRole(role));
  } else if (roles && typeof roles === "object") {
    Object.entries(roles).forEach(([id, role]) => registerRole(role, id));
  }

  return roleMap;
}

async function getRosterByPlayer(teamRef) {
  const snapshot = await rosterCollection(teamRef)
    .where("status", "==", "active")
    .get();

  const map = new Map();
  snapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    if (data.playerId) map.set(String(data.playerId), { id: doc.id, ...data });
  });
  return { snapshot, map };
}

export default async function handler(req, res) {
  try {
    const { app, uid } = await authenticate(req);
    const db = getFirestore(app);
    const method = String(req.method || "GET").toUpperCase();
    const teamId = String(req.query?.teamId || req.body?.teamId || "").trim();
    const { team, teamRef } = await getOwnedTeam(db, uid, teamId);

    await migrateLegacyDivisions(db, teamRef, team);
    await migrateLegacyRoster(db, teamRef, teamId);

    const divisionsRef = divisionsCollection(teamRef);

    if (method === "GET") {
      const [divisionSnap, rosterSnap] = await Promise.all([
        divisionsRef.get(),
        rosterCollection(teamRef).where("status", "==", "active").get()
      ]);

      const playerCounts = {};
      rosterSnap.docs.forEach((doc) => {
        const divisionId = String(doc.data()?.divisionId || "").trim();
        if (divisionId) playerCounts[divisionId] = (playerCounts[divisionId] || 0) + 1;
      });

      return json(res, 200, {
        team: { id: team.id, name: team.name || team.teamName || "Team" },
        divisions: sortDivisions(
          divisionSnap.docs.map((doc) => ({
            ...normalizeDivision(doc.id, doc.data()),
            playerCount: playerCounts[doc.id] || 0
          }))
        )
      });
    }

    if (!["POST", "PATCH", "DELETE"].includes(method)) {
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
      const game = gameSnap.data() || {};
      if (game.status !== "active") return json(res, 400, { error: "El juego seleccionado no está disponible." });

      const activeDivisions = await divisionsRef.where("status", "==", "active").get();
      if (activeDivisions.docs.some((doc) => String(doc.data()?.gameId || "") === gameId)) {
        return json(res, 409, { error: "Este Team ya tiene una división activa para ese juego." });
      }

      const roleMap = buildRoleMap(game);
      const { map: rosterByPlayer } = await getRosterByPlayer(teamRef);
      const normalizedPlayers = [];
      const playerIds = new Set();

      for (const item of players) {
        const playerId = String(item?.playerId || "").trim();
        const roleId = String(item?.roleId || "").trim();
        if (!playerId || playerIds.has(playerId)) continue;
        playerIds.add(playerId);

        const canonicalRoleId = roleMap.get(roleId.toLowerCase());
        if (!canonicalRoleId) {
          return json(res, 400, {
            error: `El rol seleccionado para el Player ${playerId} no pertenece a la configuración competitiva de este juego.`
          });
        }

        const roster = rosterByPlayer.get(playerId);
        if (!roster) {
          return json(res, 409, { error: `El Player ${playerId} no pertenece al Roster activo de este Team.` });
        }
        if (roster.divisionId) {
          return json(res, 409, { error: `El Player ${playerId} ya pertenece a otra división de este Team.` });
        }

        normalizedPlayers.push({ playerId, roleId: canonicalRoleId });
      }

      const divisionRef = divisionsRef.doc();
      const now = new Date().toISOString();
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
      batch.set(divisionRef, division);
      normalizedPlayers.forEach((item) => {
        const roster = rosterByPlayer.get(item.playerId);
        batch.update(rosterCollection(teamRef).doc(roster.id), {
          divisionId: divisionRef.id,
          roleId: item.roleId,
          updatedAt: FieldValue.serverTimestamp()
        });
      });
      batch.update(teamRef, { updatedAt: FieldValue.serverTimestamp() });
      await batch.commit();

      return json(res, 201, {
        division: normalizeDivision(divisionRef.id, {
          ...division,
          createdAt: now,
          updatedAt: now
        }),
        playerCount: normalizedPlayers.length
      });
    }

    const divisionId = String(req.body?.divisionId || req.query?.divisionId || "").trim();
    const divisionRef = divisionsRef.doc(divisionId);
    const divisionSnap = await divisionRef.get();

    if (!divisionId || !divisionSnap.exists) {
      return json(res, 404, { error: "No se encontró la división." });
    }

    if (method === "PATCH") {
      const current = divisionSnap.data() || {};
      const name = String(req.body?.name ?? current.name ?? "").trim();
      const description = String(req.body?.description ?? current.description ?? "").trim();
      const status = req.body?.status === "inactive" ? "inactive" : "active";
      const players = Array.isArray(req.body?.players) ? req.body.players : [];

      if (!name) return json(res, 400, { error: "El nombre de la división es obligatorio." });

      const gameSnap = await db.collection("games").doc(String(current.gameId || "")).get();
      if (!gameSnap.exists) return json(res, 400, { error: "No se encontró la configuración del juego de esta división." });

      const roleMap = buildRoleMap(gameSnap.data() || {});
      const { snapshot: rosterSnapshot, map: rosterByPlayer } = await getRosterByPlayer(teamRef);
      const normalizedPlayers = [];
      const selectedIds = new Set();

      for (const item of players) {
        const playerId = String(item?.playerId || "").trim();
        const roleId = String(item?.roleId || "").trim();
        if (!playerId || selectedIds.has(playerId)) continue;
        selectedIds.add(playerId);

        const canonicalRoleId = roleMap.get(roleId.toLowerCase());
        if (!canonicalRoleId) {
          return json(res, 400, {
            error: `El rol seleccionado para el Player ${playerId} no pertenece a la configuración competitiva de este juego.`
          });
        }

        const roster = rosterByPlayer.get(playerId);
        if (!roster) return json(res, 409, { error: `El Player ${playerId} no pertenece al Roster activo de este Team.` });

        const existingDivisionId = String(roster.divisionId || "").trim();
        if (existingDivisionId && existingDivisionId !== divisionId) {
          return json(res, 409, { error: `El Player ${playerId} ya pertenece a otra división de este Team.` });
        }

        normalizedPlayers.push({ playerId, roleId: canonicalRoleId });
      }

      const batch = db.batch();
      rosterSnapshot.docs
        .filter((doc) => String(doc.data()?.divisionId || "") === divisionId)
        .forEach((doc) => {
          if (!selectedIds.has(String(doc.data()?.playerId || ""))) {
            batch.update(doc.ref, {
              divisionId: FieldValue.delete(),
              roleId: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp()
            });
          }
        });

      normalizedPlayers.forEach((item) => {
        const roster = rosterByPlayer.get(item.playerId);
        batch.update(rosterCollection(teamRef).doc(roster.id), {
          divisionId,
          roleId: item.roleId,
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      batch.update(divisionRef, {
        name,
        description,
        status,
        playerCount: normalizedPlayers.length,
        updatedAt: FieldValue.serverTimestamp()
      });

      await batch.commit();
      return json(res, 200, { ok: true, playerCount: normalizedPlayers.length });
    }

    const assigned = await rosterCollection(teamRef)
      .where("divisionId", "==", divisionId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (!assigned.empty) {
      return json(res, 409, {
        error: "No puedes eliminar una división que tiene Players asignados. Retira primero a sus jugadores."
      });
    }

    await divisionRef.delete();
    await teamRef.update({ updatedAt: FieldValue.serverTimestamp() });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error("NEXUS — Team Divisions API:", error);
    return json(res, error?.status || 500, {
      error: error?.message || "No fue posible procesar las divisiones."
    });
  }
}
