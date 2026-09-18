// ========================================
// NEXUS — Team Landing Service
// ========================================

import { getEntity, updateEntity } from "./firestore.js";
import { uploadImage } from "./imagekit.js";

const DEFAULT_PRIMARY_COLOR = "#E30613";

function normalizeLanding(landing = {}) {
  return {
    primaryColor: /^#[0-9A-Fa-f]{6}$/.test(String(landing.primaryColor || ""))
      ? String(landing.primaryColor).toUpperCase()
      : DEFAULT_PRIMARY_COLOR,
    background: landing.background || null,
    sponsors: Array.isArray(landing.sponsors) ? landing.sponsors.filter(Boolean) : []
  };
}

export async function getTeamLandingConfig(teamId) {
  const team = await getEntity("teams", teamId);
  if (!team) return null;

  return {
    team,
    landing: normalizeLanding(team.landing)
  };
}

export async function saveTeamLandingConfig(teamId, landing) {
  const normalized = normalizeLanding(landing);

  await updateEntity("teams", teamId, {
    landing: normalized
  });

  return normalized;
}

export async function uploadTeamLandingBackground(file) {
  return uploadImage(file, {
    folder: "/nexus/teams/landings"
  });
}

export async function uploadTeamSponsorLogo(file) {
  return uploadImage(file, {
    folder: "/nexus/teams/sponsors"
  });
}

export async function getPublicTeamLanding(teamId) {
  const response = await fetch(
    `/api/team-landing?teamId=${encodeURIComponent(teamId)}`
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "No fue posible cargar el Team.");
  }

  return data;
}
