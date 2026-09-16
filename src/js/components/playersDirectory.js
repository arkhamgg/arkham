// ========================================
// NEXUS — Players Directory
// ========================================

import { getEntity, getEntityPage } from "../services/firestore.js";
import { getGames } from "../services/gameCatalog.js";

const PAGE_SIZE = 24;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function getInitials(player = {}) {
  const value = String(player.gamertag || `${player.name || ""} ${player.lastName || ""}`).trim();
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "NX";
}

function calculateAge(birthDate) {
  if (!birthDate) return null;

  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();

  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 && age <= 120 ? age : null;
}

function getProfileGames(player, games) {
  const profiles = Array.isArray(player.competitiveProfiles)
    ? player.competitiveProfiles
    : [];

  return profiles
    .map((profile) => {
      const game = games.find((item) => item.id === profile.gameId);
      return {
        ...profile,
        gameName: game?.name || profile.gameId || "Juego"
      };
    })
    .filter((profile) => profile.gameId);
}

function getRoles(profile) {
  return Array.isArray(profile?.roleIds)
    ? profile.roleIds.filter(Boolean)
    : [];
}

function getSocialEntries(player) {
  return [
    ["instagram", "Instagram", "fa-instagram"],
    ["tiktok", "TikTok", "fa-tiktok"],
    ["youtube", "YouTube", "fa-youtube"],
    ["twitch", "Twitch", "fa-twitch"],
    ["kick", "Kick", "fa-play"]
  ].filter(([key]) => player[key]);
}

function getSocialUrl(platform, value) {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  if (/^https?:\/\//i.test(raw)) return raw;

  const bases = {
    instagram: "https://instagram.com/",
    tiktok: "https://tiktok.com/@",
    youtube: "https://youtube.com/@",
    twitch: "https://twitch.tv/",
    kick: "https://kick.com/"
  };

  return `${bases[platform] || ""}${raw.replace(/^@/, "")}`;
}

function getAchievements(player) {
  const values = [
    ...(Array.isArray(player.titles) ? player.titles : []),
    ...(Array.isArray(player.achievements) ? player.achievements : [])
  ];

  return values.map((item) => {
    if (typeof item === "string") return item;
    return item?.name || item?.title || item?.label || "Reconocimiento";
  }).filter(Boolean);
}

function createPlayerCard(player, index, games) {
  const card = document.createElement("article");
  card.className = "players-directory-card";
  card.tabIndex = 0;
  card.dataset.playerId = player.id;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Ver perfil de ${player.gamertag || player.name || "Player"}`);

  const profiles = getProfileGames(player, games);
  const primaryProfile = profiles[0];
  const roles = primaryProfile ? getRoles(primaryProfile) : [];
  const teamLabel = player.teamId ? "TEAM CONFIRMADO" : "SIN TEAM";

  card.innerHTML = `
    <div class="players-directory-card__top">
      <span class="players-directory-card__index">${String(index).padStart(2, "0")}</span>
      <span class="players-directory-card__status">
        <span></span> NEXUS PLAYER
      </span>
    </div>

    <div class="players-directory-card__avatar">
      ${player.photo?.url
        ? `<img src="${escapeHtml(player.photo.url)}" alt="">`
        : `<span>${escapeHtml(getInitials(player))}</span>`}
    </div>

    <div class="players-directory-card__identity">
      <span>${escapeHtml(teamLabel)}</span>
      <h2>${escapeHtml(player.gamertag || `${player.name || ""} ${player.lastName || ""}`.trim() || "PLAYER")}</h2>
      <p>${escapeHtml(`${player.name || ""} ${player.lastName || ""}`.trim() || "Perfil competitivo")}</p>
    </div>

    <div class="players-directory-card__games">
      ${profiles.length
        ? profiles.slice(0, 3).map((profile) => `<span>${escapeHtml(profile.gameName)}</span>`).join("")
        : `<span>Perfil competitivo por configurar</span>`}
      ${profiles.length > 3 ? `<span>+${profiles.length - 3} JUEGOS</span>` : ""}
    </div>

    <div class="players-directory-card__roles">
      ${roles.length
        ? roles.slice(0, 3).map((role) => `<span>${escapeHtml(role)}</span>`).join("")
        : `<span>SIN ROL REGISTRADO</span>`}
      ${roles.length > 3 ? `<span>+${roles.length - 3}</span>` : ""}
    </div>

    <div class="players-directory-card__action">
      <span>VER PERFIL</span>
      <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
    </div>
  `;

  return card;
}

function renderModal(player, games, team) {
  const modal = document.createElement("div");
  modal.className = "players-directory-modal-backdrop";
  modal.dataset.playerModal = "true";

  const profiles = getProfileGames(player, games);
  const age = calculateAge(player.birthDate);
  const socials = getSocialEntries(player);
  const achievements = getAchievements(player);
  const teamRequest = player.teamRequest?.status === "pending" ? player.teamRequest : null;

  modal.innerHTML = `
    <section class="players-directory-modal" role="dialog" aria-modal="true" aria-labelledby="player-profile-title">
      <header class="players-directory-modal__header">
        <div>
          <span class="players-directory-modal__eyebrow">NEXUS PLAYER</span>
          <h2 id="player-profile-title">${escapeHtml(player.gamertag || "PLAYER")}</h2>
          <p>${escapeHtml(`${player.name || ""} ${player.lastName || ""}`.trim() || "Perfil competitivo")}</p>
        </div>
        <button type="button" class="players-directory-modal__close" data-close-player-modal aria-label="Cerrar">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>

      <div class="players-directory-modal__body">
        <aside class="players-directory-modal__identity">
          <div class="players-directory-modal__avatar">
            ${player.photo?.url
              ? `<img src="${escapeHtml(player.photo.url)}" alt="">`
              : `<span>${escapeHtml(getInitials(player))}</span>`}
          </div>
          <span class="players-directory-modal__label">GAMERTAG</span>
          <strong>${escapeHtml(player.gamertag || "—")}</strong>
          ${age !== null ? `<span class="players-directory-modal__age">${age} AÑOS</span>` : ""}

          <div class="players-directory-modal__team">
            <span class="players-directory-modal__label">TEAM</span>
            ${team
              ? `<strong>${escapeHtml(team.name || team.shortName || team.id)}</strong><small>AFILIACIÓN CONFIRMADA</small>`
              : teamRequest
                ? `<strong>${escapeHtml(teamRequest.teamName || teamRequest.teamId || "Team")}</strong><small class="is-pending">SOLICITUD PENDIENTE</small>`
                : `<strong>AGENTE LIBRE</strong><small>DISPONIBLE PARA TEAM</small>`}
          </div>
        </aside>

        <div class="players-directory-modal__content">
          <section class="players-directory-modal__section">
            <div class="players-directory-modal__section-head">
              <span>01</span>
              <h3>PERFIL COMPETITIVO</h3>
            </div>
            <div class="players-directory-modal__games">
              ${profiles.length
                ? profiles.map((profile) => `
                  <article class="players-directory-modal__game">
                    <div>
                      <span>GAME</span>
                      <strong>${escapeHtml(profile.gameName)}</strong>
                    </div>
                    <div>
                      <span>ROLES</span>
                      <div class="players-directory-modal__chips">
                        ${getRoles(profile).length
                          ? getRoles(profile).map((role) => `<span>${escapeHtml(role)}</span>`).join("")
                          : `<span>SIN ROL</span>`}
                      </div>
                    </div>
                    <div>
                      <span>DISPONIBILIDAD</span>
                      <strong>${profile.availability === "in_team" ? "EN TEAM" : profile.availability === "looking_for_team" ? "BUSCANDO TEAM" : "DISPONIBLE"}</strong>
                    </div>
                  </article>
                `).join("")
                : `<div class="players-directory-modal__empty">Este Player todavía no ha configurado su perfil competitivo.</div>`}
            </div>
          </section>

          <section class="players-directory-modal__section">
            <div class="players-directory-modal__section-head">
              <span>02</span>
              <h3>LOGROS Y TÍTULOS</h3>
            </div>
            <div class="players-directory-modal__achievements">
              ${achievements.length
                ? achievements.map((item) => `<span><i class="fa-solid fa-trophy"></i>${escapeHtml(item)}</span>`).join("")
                : `<span class="is-muted">Sin títulos o reconocimientos registrados.</span>`}
            </div>
          </section>

          ${socials.length ? `
            <section class="players-directory-modal__section">
              <div class="players-directory-modal__section-head">
                <span>03</span>
                <h3>REDES</h3>
              </div>
              <div class="players-directory-modal__socials">
                ${socials.map(([key, label, icon]) => `<a href="${escapeHtml(getSocialUrl(key, player[key]))}" target="_blank" rel="noopener noreferrer"><i class="fa-brands ${icon}"></i><span>${label}</span></a>`).join("")}
              </div>
            </section>
          ` : ""}
        </div>
      </div>
    </section>
  `;

  return modal;
}

export function PlayersDirectory() {
  const page = document.createElement("main");
  page.className = "players-directory";

  page.innerHTML = `
    <div class="players-directory__container">
      <header class="players-directory__header">
        <div class="players-directory__eyebrow"><span>04</span><span>NEXUS PLAYERS</span></div>
        <div class="players-directory__heading">
          <h1>LOS JUGADORES <span>QUE COMPITEN.</span></h1>
          <p>Explora el talento competitivo de NEXUS y descubre perfiles disponibles para competir.</p>
        </div>
      </header>

      <section class="players-directory__directory" aria-labelledby="players-directory-title">
        <div class="players-directory__directory-head">
          <div><span>DIRECTORIO</span><h2 id="players-directory-title">PLAYER DATABASE</h2></div>
          <span class="players-directory__count" data-player-count>— PLAYERS</span>
        </div>
        <div class="players-directory__grid" data-player-grid></div>
        <div class="players-directory__state" data-player-state>Cargando Players...</div>
        <div class="players-directory__load-more-wrap" data-load-more-wrap hidden>
          <button type="button" class="players-directory__load-more" data-load-more>CARGAR MÁS PLAYERS <i class="fa-solid fa-arrow-down"></i></button>
        </div>
      </section>
    </div>
  `;

  const grid = page.querySelector("[data-player-grid]");
  const state = page.querySelector("[data-player-state]");
  const count = page.querySelector("[data-player-count]");
  const loadMoreWrap = page.querySelector("[data-load-more-wrap]");
  const loadMore = page.querySelector("[data-load-more]");

  let cursor = null;
  let loading = false;
  let totalLoaded = 0;
  let games = [];

  async function loadPage() {
    if (loading) return;
    loading = true;
    loadMore.disabled = true;

    if (!cursor) state.textContent = "Cargando Players...";
    else state.textContent = "Cargando más Players...";

    try {
      if (!games.length) games = await getGames();

      const result = await getEntityPage("players", {
        pageSize: PAGE_SIZE,
        cursor
      });

      if (!result.items.length && totalLoaded === 0) {
        state.textContent = "Todavía no hay Players públicos registrados.";
        loadMoreWrap.hidden = true;
        return;
      }

      result.items.forEach((player, index) => {
        grid.appendChild(createPlayerCard(player, totalLoaded + index + 1, games));
      });

      totalLoaded += result.items.length;
      cursor = result.cursor;
      count.textContent = `${totalLoaded} PLAYERS CARGADOS`;
      state.textContent = "";
      state.hidden = true;
      loadMoreWrap.hidden = !result.hasMore;
    } catch (error) {
      console.error("NEXUS — Error cargando Players:", error);
      state.hidden = false;
      state.textContent = "No se pudo cargar el directorio de Players.";
      loadMoreWrap.hidden = true;
    } finally {
      loading = false;
      loadMore.disabled = false;
    }
  }

  async function openPlayer(playerId) {
    try {
      const player = await getEntity("players", playerId);
      if (!player) return;

      const team = player.teamId
        ? await getEntity("teams", player.teamId)
        : null;

      const modal = renderModal(player, games, team);
      document.body.appendChild(modal);
      document.body.classList.add("players-directory-modal-open");

      const close = () => {
        modal.remove();
        document.body.classList.remove("players-directory-modal-open");
      };

      modal.querySelector("[data-close-player-modal]").addEventListener("click", close);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) close();
      });

      document.addEventListener("keydown", function onKey(event) {
        if (event.key === "Escape") {
          close();
          document.removeEventListener("keydown", onKey);
        }
      });
    } catch (error) {
      console.error("NEXUS — Error abriendo perfil Player:", error);
    }
  }

  grid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-player-id]");
    if (card) openPlayer(card.dataset.playerId);
  });

  grid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-player-id]");
    if (!card) return;
    event.preventDefault();
    openPlayer(card.dataset.playerId);
  });

  loadMore.addEventListener("click", loadPage);
  loadPage();

  return page;
}
