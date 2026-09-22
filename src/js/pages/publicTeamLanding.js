// ========================================
// ARKHAM — Public Team Landing
// ========================================

import { getPublicTeamLanding } from "../services/teamLanding.js";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function getTeamId() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "teams" ? segments[1] : null;
}

export function PublicTeamLanding() {
  const page = document.createElement("main");
  page.className = "public-team-landing";
  page.innerHTML = `
    <div class="public-team-landing__state">
      <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
      <span>CARGANDO TEAM...</span>
    </div>
  `;

  const teamId = getTeamId();
  if (!teamId) {
    renderError(page, "No se encontró el Team.");
    return page;
  }

  loadPublicLanding(page, teamId);
  return page;
}

async function loadPublicLanding(page, teamId) {
  try {
    const data = await getPublicTeamLanding(teamId);

    if (!data?.isPro) {
      renderBasicTeam(page, data?.team || null);
      return;
    }

    renderLanding(page, data);
  } catch (error) {
    console.error("ARKHAM — Error cargando Team público:", error);
    renderError(page, error?.message || "No fue posible cargar el Team.");
  }
}

function renderLanding(page, data) {
  const team = data.team || {};
  const landing = data.landing || {};
  const color = /^#[0-9A-Fa-f]{6}$/.test(landing.primaryColor || "") ? landing.primaryColor : "#E30613";
  const background = landing.background?.url || "";
  const divisions = Array.isArray(data.divisions) ? data.divisions : [];
  const roster = Array.isArray(data.roster) ? data.roster : [];
  const sponsors = Array.isArray(landing.sponsors) ? landing.sponsors : [];

  page.style.setProperty("--team-primary", color);
  page.innerHTML = `
    <div class="public-team-landing__shell">
      <header class="public-team-landing__hero" ${background ? `style="background-image:linear-gradient(180deg, rgba(5,5,5,.25), rgba(5,5,5,.96)),url('${escapeHtml(background)}')"` : ""}>
        <div class="public-team-landing__hero-overlay"></div>
        <div class="public-team-landing__nav">
          <span>ARKHAM</span>
          <span>TEAM</span>
        </div>
        <div class="public-team-landing__hero-content">
          <div class="public-team-landing__logo">
            ${team.logo?.url ? `<img src="${escapeHtml(team.logo.url)}" alt="${escapeHtml(team.name || "Team")}">` : `<span>${escapeHtml(team.shortName || team.name?.charAt(0) || "NX")}</span>`}
          </div>
          <span class="public-team-landing__tag">${escapeHtml(team.shortName || "TEAM")}</span>
          <h1>${escapeHtml(team.name || "Team")}</h1>
          <p>${escapeHtml(team.description || "Equipo competitivo dentro del ecosistema ARKHAM.")}</p>
          ${renderSocials(team)}
        </div>
      </header>

      <main class="public-team-landing__content">
        <section class="public-team-landing__stats">
          <article><strong>${divisions.length}</strong><span>DIVISIONES</span></article>
          <article><strong>${roster.length}</strong><span>PLAYERS</span></article>
          <article><strong>${sponsors.length}</strong><span>PATROCINADORES</span></article>
        </section>

        <section class="public-team-landing__section">
          <header><span>01</span><div><small>COMPETITIVE STRUCTURE</small><h2>Divisiones</h2></div></header>
          ${divisions.length ? `<div class="public-team-landing__divisions">${divisions.map(renderDivision).join("")}</div>` : renderEmpty("Aún no hay divisiones publicadas.")}
        </section>

        <section class="public-team-landing__section">
          <header><span>02</span><div><small>ACTIVE ROSTER</small><h2>Roster</h2></div></header>
          ${roster.length ? `<div class="public-team-landing__roster">${roster.map(renderRosterPlayer).join("")}</div>` : renderEmpty("Aún no hay Players en el Roster.")}
        </section>

        ${sponsors.length ? `
          <section class="public-team-landing__section public-team-landing__section--sponsors">
            <header><span>03</span><div><small>SUPPORTED BY</small><h2>Patrocinadores</h2></div></header>
            <div class="public-team-landing__sponsors">${sponsors.map((sponsor) => `<div><img src="${escapeHtml(sponsor.logo?.url || "")}" alt="Patrocinador"></div>`).join("")}</div>
          </section>
        ` : ""}
      </main>

      <footer class="public-team-landing__footer">
        <span>ARKHAM TEAMS</span>
        <strong>${escapeHtml(team.name || "Team")}</strong>
        <a href="/teams">EXPLORAR TEAMS <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </footer>
    </div>
  `;

  page.querySelectorAll("a[href^='/teams']").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href) return;
      event.preventDefault();
      window.history.pushState({}, "", href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });
}

function renderDivision(division) {
  return `
    <article class="public-team-landing__division">
      <span>${escapeHtml(division.gameName || division.gameId || "JUEGO")}</span>
      <h3>${escapeHtml(division.name)}</h3>
      <p>${escapeHtml(division.description || "División competitiva del Team.")}</p>
    </article>
  `;
}

function renderRosterPlayer(player) {
  return `
    <article class="public-team-landing__player">
      <div class="public-team-landing__player-photo">
        ${player.photo?.url ? `<img src="${escapeHtml(player.photo.url)}" alt="">` : `<i class="fa-solid fa-user" aria-hidden="true"></i>`}
      </div>
      <div>
        <span>${escapeHtml(player.divisionName || "ROSTER")}</span>
        <h3>${escapeHtml(player.gamertag || player.name || "Player")}</h3>
        ${player.gamertag && player.name && player.name !== player.gamertag ? `<small>${escapeHtml(player.name)}</small>` : ""}
      </div>
      ${player.roleId ? `<strong>${escapeHtml(player.roleId)}</strong>` : ""}
    </article>
  `;
}

function renderSocials(team) {
  const socials = [
    ["instagram", "fa-instagram"],
    ["facebook", "fa-facebook-f"],
    ["tiktok", "fa-tiktok"],
    ["youtube", "fa-youtube"],
    ["twitch", "fa-twitch"],
    ["kick", "fa-k" ]
  ].filter(([key]) => team[key]);

  if (!socials.length) return "";

  return `<div class="public-team-landing__socials">${socials.map(([key, icon]) => `<a href="${escapeHtml(team[key])}" target="_blank" rel="noopener noreferrer" aria-label="${key}"><i class="fa-brands ${icon}" aria-hidden="true"></i></a>`).join("")}</div>`;
}

function renderBasicTeam(page, team) {
  if (!team) {
    renderError(page, "No se encontró el Team.");
    return;
  }

  page.innerHTML = `
    <section class="public-team-basic">
      <div class="public-team-basic__logo">
        ${team.logo?.url ? `<img src="${escapeHtml(team.logo.url)}" alt="">` : `<span>${escapeHtml(team.shortName || team.name?.charAt(0) || "NX")}</span>`}
      </div>
      <span>TEAM ARKHAM</span>
      <h1>${escapeHtml(team.name || "Team")}</h1>
      <p>${escapeHtml(team.description || "Este Team forma parte del ecosistema ARKHAM.")}</p>
      <small>La Landing pública completa está disponible con Team Pro.</small>
    </section>
  `;
}

function renderEmpty(message) {
  return `<div class="public-team-landing__empty"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>${escapeHtml(message)}</span></div>`;
}

function renderError(page, message) {
  page.innerHTML = `<div class="public-team-landing__state public-team-landing__state--error"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><span>${escapeHtml(message)}</span></div>`;
}
