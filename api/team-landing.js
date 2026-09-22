// ========================================
// ARKHAM — Public Team Landing API
// ========================================

import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "./_lib/firebaseAdmin.js";

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value?._seconds === "number") return new Date(value._seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isEffectivePro(subscription) {
  if (!subscription || subscription.planId !== "pro") return false;
  if (!["active"].includes(String(subscription.status || "").toLowerCase())) return false;

  const periodEnd = toDate(subscription.currentPeriodEnd);
  if (!periodEnd) return true;
  return periodEnd.getTime() > Date.now();
}

function safeTimestamp(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function normalizeLanding(landing = {}) {
  const primaryColor = /^#[0-9A-Fa-f]{6}$/.test(String(landing.primaryColor || ""))
    ? String(landing.primaryColor).toUpperCase()
    : "#E30613";

  return {
    primaryColor,
    background: landing.background?.url
      ? {
          url: landing.background.url
        }
      : null,
    sponsors: Array.isArray(landing.sponsors)
      ? landing.sponsors
          .filter((sponsor) => sponsor?.logo?.url)
          .slice(0, 8)
          .map((sponsor) => ({
            id: sponsor.id || null,
            logo: { url: sponsor.logo.url }
          }))
      : []
  };
}

function playerName(player = {}) {
  const fullName = [player.name, player.lastName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

  return String(
    fullName ||
    player.displayName ||
    player.fullName ||
    player.gamertag ||
    player.id ||
    "Player"
  );
}

export default async function handler(req, res) {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    return json(res, 405, { error: "Método no permitido." });
  }

  const teamId = String(req.query?.teamId || "").trim();
  if (!teamId) return json(res, 400, { error: "No se indicó el Team." });

  try {
    const app = getFirebaseAdminApp();
    const db = getFirestore(app);
    const teamRef = db.collection("teams").doc(teamId);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      return json(res, 404, { error: "No se encontró el Team." });
    }

    const teamData = teamSnap.data() || {};

    const [divisionSnap, rosterSnap, subscriptionsSnap] = await Promise.all([
      teamRef.collection("divisions").where("status", "==", "active").get(),
      teamRef.collection("teamRoster").where("status", "==", "active").get(),
      db.collection("subscriptions").where("entityId", "==", teamId).get()
    ]);

    const subscription = subscriptionsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.entityType === "team" && item.productId === "team" && item.planId === "pro")
      .sort((a, b) => {
        const aEnd = toDate(a.currentPeriodEnd)?.getTime() || 0;
        const bEnd = toDate(b.currentPeriodEnd)?.getTime() || 0;
        return bEnd - aEnd;
      })[0] || null;

    const isPro = isEffectivePro(subscription);

    const playerIds = rosterSnap.docs
      .map((doc) => String(doc.data()?.playerId || "").trim())
      .filter(Boolean);

    const playerSnapshots = await Promise.all(
      playerIds.map((playerId) => db.collection("players").doc(playerId).get())
    );

    const players = new Map(
      playerSnapshots
        .filter((snap) => snap.exists)
        .map((snap) => [snap.id, { id: snap.id, ...snap.data() }])
    );

    const divisions = divisionSnap.docs
      .map((doc) => ({
        id: doc.id,
        name: String(doc.data()?.name || "División"),
        gameId: String(doc.data()?.gameId || ""),
        gameName: String(doc.data()?.gameName || doc.data()?.gameId || "Juego"),
        description: String(doc.data()?.description || "")
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    const divisionMap = new Map(divisions.map((division) => [division.id, division]));

    const roster = rosterSnap.docs
      .map((doc) => {
        const rosterData = doc.data() || {};
        const playerId = String(rosterData.playerId || "");
        const player = players.get(playerId);
        if (!player) return null;

        const division = divisionMap.get(String(rosterData.divisionId || ""));

        return {
          id: doc.id,
          playerId,
          name: playerName(player),
          gamertag: String(player.gamertag || ""),
          photo: player.photo?.url ? { url: player.photo.url } : null,
          divisionId: division?.id || null,
          divisionName: division?.name || null,
          roleId: rosterData.roleId || null
        };
      })
      .filter(Boolean);

    const safeTeam = {
      id: teamId,
      name: String(teamData.name || teamData.teamName || "Team"),
      shortName: String(teamData.shortName || ""),
      description: String(teamData.description || ""),
      logo: teamData.logo?.url ? { url: teamData.logo.url } : null,
      instagram: String(teamData.instagram || ""),
      facebook: String(teamData.facebook || ""),
      tiktok: String(teamData.tiktok || ""),
      youtube: String(teamData.youtube || ""),
      twitch: String(teamData.twitch || ""),
      kick: String(teamData.kick || "")
    };

    return json(res, 200, {
      success: true,
      isPro,
      team: safeTeam,
      landing: isPro ? normalizeLanding(teamData.landing) : null,
      divisions: isPro ? divisions : [],
      roster: isPro ? roster : [],
      subscription: isPro
        ? { currentPeriodEnd: safeTimestamp(subscription?.currentPeriodEnd) }
        : null
    });
  } catch (error) {
    console.error("ARKHAM — Error cargando Team Landing pública:", error);
    return json(res, 500, {
      error: "No fue posible cargar la información pública del Team."
    });
  }
}
