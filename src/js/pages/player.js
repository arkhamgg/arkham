// ========================================
// NEXUS — Player Account Views
// ========================================

import { getCurrentEntityContext } from "../services/entityContext.js";
import { getGames } from "../services/gameCatalog.js";
import { getEntities } from "../services/firestore.js";
import { updateEntity } from "../services/firestore.js";
import { uploadImage } from "../services/imagekit.js";
import { getMyTournamentRegistrationRequests } from "../services/tournamentRegistration.js";
import { getMyTournamentCompetitions, requestTournamentRecognition } from "../services/tournamentRecognition.js";

const ROLE_OPTIONS = [
  ["streamer", "Streamer"],
  ["content_creator", "Creador de contenido"],
  ["influencer", "Influencer"],
  ["competitive_player", "Jugador competitivo"]
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}

function getTeamName(team = {}) {
  return team.name || team.teamName || team.shortName || team.id || "Team";
}

export function PlayerView({ view = "competitions" } = {}) {
  if (view === "profile") return PlayerProfileView();

  const page = document.createElement("main");
  page.className = `player-view-page player-view-page--${escapeHtml(view)}`;

  const views = {
    competitions: ["COMPETITIVO", "Mis competencias", "Aquí aparecerán las competencias en las que participes."],
    requests: ["COMPETITIVO", "Solicitudes a torneo", "Consulta el estado de tus solicitudes y gestiona nuevos intentos."],
    results: ["COMPETITIVO", "Mis resultados", "Tu historial de resultados competitivos se mostrará aquí."],
    stats: ["COMPETITIVO", "Estadísticas", "Tus estadísticas competitivas se construirán a partir de tus partidas registradas."]
  };
  const current = views[view] || views.competitions;

  page.innerHTML = `<section class="player-view-page__content">
    <header class="player-view-page__header">
      <span class="player-view-page__eyebrow">${current[0]}</span>
      <h1>${current[1]}</h1>
      <p>${current[2]}</p>
    </header>
    <div class="player-view-page__body" data-player-view-body>
      <span class="player-view-page__status">Cargando...</span>
    </div>
  </section>`;

  if (view === "requests") {
    loadPlayerTournamentRequests(page);
  } else if (view === "competitions") {
    loadPlayerCompetitions(page);
  } else {
    page.querySelector("[data-player-view-body]").innerHTML =
      `<span class="player-view-page__status">MÓDULO PLAYER · EN CONSTRUCCIÓN</span>`;
  }

  return page;
}

async function loadPlayerCompetitions(page) {
  const body = page.querySelector("[data-player-view-body]");
  if (!body) return;

  try {
    const response = await getMyTournamentCompetitions();
    const competitions = Array.isArray(response?.competitions) ? response.competitions : [];

    if (!competitions.length) {
      body.innerHTML = `<div class="player-requests-empty"><i class="fa-regular fa-trophy" aria-hidden="true"></i><strong>Aún no tienes competencias registradas.</strong><span>Cuando participes en una competencia Pro aparecerá aquí.</span></div>`;
      return;
    }

    const statusMeta = {
      finished: { label: "FINALIZADA", className: "is-finished" },
      live: { label: "EN VIVO", className: "is-live" },
      published: { label: "PUBLICADA", className: "is-published" },
      check_in: { label: "CHECK-IN", className: "is-checkin" }
    };

    body.innerHTML = `<div class="player-competitions-list">${competitions.map((competition) => {
      const meta = statusMeta[competition.status] || { label: String(competition.status || "COMPETENCIA").toUpperCase(), className: "" };
      const recognition = competition.recognition || {};
      const recognitionLabel = recognition.eligible
        ? recognition.status === "approved" ? "RECONOCIMIENTO APROBADO" : recognition.status === "requested" ? "RECONOCIMIENTO EN REVISIÓN" : recognition.status === "rejected" ? "RECONOCIMIENTO RECHAZADO" : "RECONOCIMIENTO DISPONIBLE"
        : "SIN RECONOCIMIENTO";
      const url = `/competitions/event?tournamentId=${encodeURIComponent(competition.tournamentId)}&eventId=${encodeURIComponent(competition.eventId)}`;
      return `<article class="player-competition-card ${meta.className}">
        <div class="player-competition-card__top"><span>${escapeHtml(meta.label)}</span><span>${escapeHtml(competition.gameId || "COMPETENCIA")}</span></div>
        <div class="player-competition-card__main"><span>COMPETENCIA</span><h2>${escapeHtml(competition.name)}</h2><p>${escapeHtml(competition.format || "—")} · ${escapeHtml(competition.matchSystem || "—")}</p></div>
        <div class="player-competition-card__result">
          <span>RESULTADO</span><strong>${competition.position ? `${escapeHtml(String(competition.position))}.º lugar` : "Pendiente"}</strong>
        </div>
        ${recognition.eligible ? `<div class="player-competition-card__recognition ${recognition.status === "approved" ? "is-approved" : recognition.status === "rejected" ? "is-rejected" : recognition.status === "requested" ? "is-requested" : "is-available"}"><i class="fa-solid fa-award"></i><span>${escapeHtml(recognitionLabel)}</span></div>` : ""}
        <footer><a href="${url}">VER COMPETENCIA <i class="fa-solid fa-arrow-right"></i></a>${recognition.eligible && ["not_requested", "rejected"].includes(recognition.status) ? `<button type="button" class="player-competition-card__claim" data-claim-tournament="${escapeHtml(competition.tournamentId)}" data-claim-event="${escapeHtml(competition.eventId)}">${recognition.status === "rejected" ? "RECLAMAR NUEVAMENTE" : "RECLAMAR RECONOCIMIENTO"}</button>` : ""}</footer>
      </article>`;
    }).join("")}</div>`;

    body.querySelectorAll("[data-claim-tournament]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await requestTournamentRecognition({ tournamentId: button.dataset.claimTournament, eventId: button.dataset.claimEvent });
          await loadPlayerCompetitions(page);
        } catch (error) {
          window.alert(error?.message || "No fue posible reclamar el reconocimiento.");
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    console.error("NEXUS — Error cargando competencias del Player:", error);
    body.innerHTML = `<div class="player-requests-empty is-error"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><strong>No fue posible cargar tus competencias.</strong><span>${escapeHtml(error?.message || "Intenta nuevamente más tarde.")}</span></div>`;
  }
}

async function loadPlayerTournamentRequests(page) {
  const body = page.querySelector("[data-player-view-body]");
  if (!body) return;

  try {
    const response = await getMyTournamentRegistrationRequests();
    const requests = Array.isArray(response?.requests) ? response.requests : [];

    if (!requests.length) {
      body.innerHTML = `
        <div class="player-requests-empty">
          <i class="fa-regular fa-inbox" aria-hidden="true"></i>
          <strong>No tienes solicitudes activas.</strong>
          <span>Cuando solicites un asiento en un torneo aparecerá aquí mientras siga vigente.</span>
        </div>`;
      return;
    }

    const statusMeta = {
      pending: { label: "EN REVISIÓN", icon: "fa-hourglass-half", className: "is-pending" },
      approved: { label: "ASIENTO APROBADO", icon: "fa-circle-check", className: "is-approved" },
      rejected: { label: "RECHAZADA", icon: "fa-circle-xmark", className: "is-rejected" }
    };

    body.innerHTML = `
      <div class="player-requests-list">
        ${requests.map((request) => {
          const status = statusMeta[request.status] || statusMeta.pending;
          const retryUrl = `/competitions/event?tournamentId=${encodeURIComponent(request.tournamentId)}&eventId=${encodeURIComponent(request.eventId)}`;
          return `
            <article class="player-request-card ${status.className}">
              <div class="player-request-card__status">
                <i class="fa-solid ${status.icon}" aria-hidden="true"></i>
                <span>${status.label}</span>
              </div>
              <div class="player-request-card__main">
                <span class="player-request-card__eyebrow">TORNEO</span>
                <h2>${escapeHtml(request.tournamentName)}</h2>
                <span>${escapeHtml(request.gameId || "Competencia NEXUS")}</span>
              </div>
              ${request.status === "rejected" && request.rejectionReason ? `
                <div class="player-request-card__reason">
                  <span>MOTIVO DEL RECHAZO</span>
                  <p>${escapeHtml(request.rejectionReason)}</p>
                </div>` : ""}
              <div class="player-request-card__footer">
                <span>${request.status === "pending" ? "El organizador está revisando tu solicitud." : request.status === "approved" ? "Tu asiento ya fue otorgado." : "Puedes volver a solicitar el asiento."}</span>
                ${request.status === "rejected" ? `
                  <a class="player-request-card__retry" href="${retryUrl}">
                    <span>VOLVER A INTENTAR</span>
                    <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
                  </a>` : ""}
              </div>
            </article>`;
        }).join("")}
      </div>`;
  } catch (error) {
    console.error("NEXUS — Error cargando solicitudes del Player:", error);
    body.innerHTML = `
      <div class="player-requests-empty is-error">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <strong>No fue posible cargar tus solicitudes.</strong>
        <span>${escapeHtml(error?.message || "Intenta nuevamente más tarde.")}</span>
      </div>`;
  }
}

function PlayerProfileView() {
  const page = document.createElement("main");
  page.className = "player-profile-page";
  page.innerHTML = `<section class="player-profile-page__content"><header><span class="player-profile-page__eyebrow">CUENTA</span><h1>Mi perfil</h1><p>Edita la información que utilizas para identificarte dentro de NEXUS.</p></header><div data-player-profile-state>Cargando perfil...</div></section>`;

  (async () => {
    const context = await getCurrentEntityContext();
    if (!context || context.type !== "player") {
      page.querySelector("[data-player-profile-state]").textContent = "No se pudo cargar el perfil Player.";
      return;
    }
    const player = context.entity;
    const roles = Array.isArray(player.roles) ? player.roles : [];
    const state = page.querySelector("[data-player-profile-state]");
    state.innerHTML = `<form class="player-profile-form" data-player-profile-form>
      <div class="player-profile-form__photo"><label>FOTO DE PERFIL</label><div class="player-profile-form__photo-row"><div class="player-profile-form__photo-preview">${player.photo?.url ? `<img src="${escapeHtml(player.photo.url)}" alt="">` : `<i class="fa-solid fa-user"></i>`}</div><input type="file" id="player-profile-photo" accept="image/jpeg,image/png,image/webp"><span>JPG, PNG o WEBP</span></div></div>
      <div class="player-profile-form__grid"><label>Nombre<input name="name" value="${escapeHtml(player.name)}" required></label><label>Apellido<input name="lastName" value="${escapeHtml(player.lastName)}" required></label><label>Gamertag<input name="gamertag" value="${escapeHtml(player.gamertag)}" required></label><label>Fecha de nacimiento<input type="date" name="birthDate" value="${escapeHtml(player.birthDate)}" required></label></div>
      <section><h2>Redes sociales</h2><div class="player-profile-form__grid">${["instagram","facebook","tiktok","youtube","twitch","kick"].map(key => `<label>${key}<input name="${key}" value="${escapeHtml(player[key] || "")}"></label>`).join("")}</div></section>
      <section><h2>Roles</h2><div class="player-profile-form__roles">${ROLE_OPTIONS.map(([value,label]) => `<label><input type="checkbox" name="roles" value="${value}" ${roles.includes(value) ? "checked" : ""}><span>${label}</span></label>`).join("")}</div></section>
      <footer><button type="submit">GUARDAR CAMBIOS</button><span data-player-profile-message></span></footer>
    </form>`;
    const form = state.querySelector("form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      const message = form.querySelector("[data-player-profile-message]");
      button.disabled = true;
      message.textContent = "Guardando...";
      try {
        const data = new FormData(form);
        const update = { name: data.get("name"), lastName: data.get("lastName"), gamertag: data.get("gamertag"), birthDate: data.get("birthDate"), instagram: data.get("instagram"), facebook: data.get("facebook"), tiktok: data.get("tiktok"), youtube: data.get("youtube"), twitch: data.get("twitch"), kick: data.get("kick"), roles: data.getAll("roles") };
        const photo = form.querySelector("#player-profile-photo")?.files?.[0];
        if (photo) {
          const result = await uploadImage(photo, { folder: "/nexus/players" });
          update.photo = { url: result.url, fileId: result.fileId, filePath: result.filePath };
        }
        await updateEntity("players", context.id, update);
        message.textContent = "Perfil actualizado correctamente.";
      } catch (error) {
        console.error("NEXUS — Error actualizando perfil Player:", error);
        message.textContent = "No se pudo actualizar el perfil.";
      } finally { button.disabled = false; }
    });
  })();
  return page;
}

export function PlayerCompetitiveProfileView() {
  const page = document.createElement("main");
  page.className = "player-competitive-profile-page";
  page.innerHTML = `<section class="player-competitive-profile-page__content"><header><span>COMPETITIVO</span><h1>Perfil competitivo</h1><p>Configura los juegos que compites, tus roles y tu situación dentro de Teams.</p></header><div data-competitive-profile-state>Cargando juegos...</div></section>`;

  (async () => {
    const context = await getCurrentEntityContext();
    if (!context || context.type !== "player") {
      page.querySelector("[data-competitive-profile-state]").textContent = "No se pudo cargar el perfil Player.";
      return;
    }

    const [games, teams] = await Promise.all([
      getGames(),
      getEntities("teams")
    ]);

    const state = page.querySelector("[data-competitive-profile-state]");
    const entity = context.entity || {};
    const profiles = Array.isArray(entity.competitiveProfiles)
      ? entity.competitiveProfiles
      : [];

    let rows = profiles.map((profile) => ({
      gameId: profile?.gameId || "",
      roleIds: Array.isArray(profile?.roleIds) ? [...profile.roleIds] : [],
      availability: ["available", "looking_for_team", "in_team"].includes(profile?.availability)
        ? profile.availability
        : "available"
    }));

    if (!rows.length) rows.push({ gameId: "", roleIds: [], availability: "available" });

    // Team es una relación global. teamId solo representa una pertenencia CONFIRMADA.
    let globalTeamId = entity.teamId || null;
    let pendingTeamId = entity.teamRequest?.status === "pending"
      ? entity.teamRequest?.teamId || null
      : null;
    let pendingRequestedAt = entity.teamRequest?.requestedAt || null;
    let teamSearch = "";
    let editingIndex = null;

    const getTeam = (teamId) => teams.find((team) => team.id === teamId) || null;
    const getTeamLabel = (teamId) => getTeam(teamId) ? getTeamName(getTeam(teamId)) : teamId || "Team";

    function getRoleEntries(game) {
      const roles = game?.competitiveInfo?.roles || [];

      if (Array.isArray(roles)) {
        return roles
          .map((role) => {
            if (typeof role === "string") return [role, role];
            return [role?.id || role?.name, role?.name || role?.id];
          })
          .filter(([id, label]) => id && label);
      }

      if (roles && typeof roles === "object") {
        return Object.entries(roles)
          .map(([id, role]) => [id, typeof role === "string" ? role : role?.name || id])
          .filter(([id, label]) => id && label);
      }

      return [];
    }

    function renderTeamSection() {
      const confirmed = getTeam(globalTeamId);
      const pending = getTeam(pendingTeamId);

      return `<section class="competitive-profile-form__team-section">
        <div>
          <span class="competitive-profile-form__section-label">TEAM</span>
          <strong>Tu Team</strong>
          <small>La pertenencia es global. Un Player solo puede tener un Team confirmado a la vez.</small>
        </div>
        <div class="competitive-profile-form__team-picker">
          ${confirmed ? `
            <div class="competitive-profile-form__team-current competitive-profile-form__team-current--confirmed">
              <span>TEAM ACTUAL · CONFIRMADO</span>
              <strong>${escapeHtml(getTeamName(confirmed))}</strong>
              <small>ID: ${escapeHtml(confirmed.id)}</small>
              <button type="button" class="competitive-profile-form__team-action" data-change-team>CAMBIAR DE TEAM</button>
            </div>` : ""}

          ${pending ? `
            <div class="competitive-profile-form__team-pending">
              <div class="competitive-profile-form__team-pending-icon"><i class="fa-solid fa-clock"></i></div>
              <div>
                <span>SOLICITUD PENDIENTE</span>
                <strong>${escapeHtml(getTeamName(pending))}</strong>
                <small>El Team debe aceptar tu solicitud. Tu Team actual no cambia hasta que exista una confirmación.</small>
              </div>
              <div class="competitive-profile-form__team-pending-actions">
                <button type="button" class="competitive-profile-form__team-action" data-change-team>CAMBIAR SOLICITUD</button>
                <button type="button" class="competitive-profile-form__team-cancel" data-clear-team-request>CANCELAR SOLICITUD</button>
              </div>
            </div>` : ""}

          ${!confirmed && !pending && entity.teamRequest?.status === "rejected" ? `
            <div class="competitive-profile-form__team-pending competitive-profile-form__team-pending--rejected">
              <div class="competitive-profile-form__team-pending-icon"><i class="fa-solid fa-xmark"></i></div>
              <div>
                <span>SOLICITUD RECHAZADA</span>
                <strong>${escapeHtml(getTeamLabel(entity.teamRequest.teamId))}</strong>
                <small>${escapeHtml(entity.teamRequest.reviewReason || "El Team rechazó tu solicitud. Puedes volver a solicitar tu incorporación.")}</small>
              </div>
            </div>` : ""}

          ${!confirmed && !pending ? `
            <div class="competitive-profile-form__team-empty-state">
              <strong>Aún no tienes un Team</strong>
              <span>Puedes buscar uno y enviar una solicitud de incorporación.</span>
            </div>` : ""}

          <div class="competitive-profile-form__team-search-wrap" data-team-search-wrap ${confirmed && !pending ? 'hidden' : ''}>
            <label for="player-team-search">${pending ? "Buscar otro Team" : confirmed ? "Buscar nuevo Team" : "Buscar Team"}</label>
            <div class="competitive-profile-form__team-search">
              <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <input id="player-team-search" type="search" data-team-search value="${escapeHtml(teamSearch)}" placeholder="Nombre, short name o ID" autocomplete="off" role="combobox" aria-expanded="false">
            </div>
            <div class="competitive-profile-form__team-results" data-team-results role="listbox" hidden></div>
          </div>
        </div>
      </section>`;
    }

    function renderGameEditor(index) {
      const profile = rows[index];
      const game = games.find((item) => item.id === profile.gameId);
      const roleEntries = getRoleEntries(game);

      return `<article class="competitive-profile-form__game competitive-profile-form__game--editing" data-game-row="${index}">
        <div class="competitive-profile-form__game-head">
          <div><span>CONFIGURANDO</span><strong>JUEGO ${String(index + 1).padStart(2, "0")}</strong></div>
          ${rows.length > 1 ? `<button type="button" data-remove-game="${index}" aria-label="Eliminar juego"><i class="fa-solid fa-xmark"></i></button>` : ""}
        </div>

        <label>Juego<select data-game-select="${index}">
          <option value="">Selecciona un juego</option>
          ${games.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === profile.gameId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select></label>

        <div class="competitive-profile-form__roles">
          <span>ROLES · PUEDES ELEGIR VARIOS</span>
          ${roleEntries.length
            ? `<div class="competitive-profile-form__role-options">${roleEntries.map(([id, label]) => `<label><input type="checkbox" data-role="${index}" value="${escapeHtml(id)}" ${profile.roleIds.includes(id) ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`).join("")}</div>`
            : `<em>${profile.gameId ? "Este juego no tiene roles competitivos configurados." : "Selecciona un juego para cargar sus roles."}</em>`}
        </div>

        <label>Disponibilidad para este juego<select data-availability="${index}">
          <option value="available" ${profile.availability === "available" ? "selected" : ""}>Disponible</option>
          <option value="looking_for_team" ${profile.availability === "looking_for_team" ? "selected" : ""}>Buscando Team</option>
          <option value="in_team" ${profile.availability === "in_team" ? "selected" : ""}>Compito con mi Team</option>
        </select></label>

        ${profile.availability === "in_team"
          ? `<div class="competitive-profile-form__team-note ${globalTeamId ? "" : "is-warning"}">
              <i class="fa-solid ${globalTeamId ? "fa-link" : "fa-triangle-exclamation"}"></i>
              <span>${globalTeamId
                ? `Este juego utilizará tu Team confirmado: <strong>${escapeHtml(getTeamLabel(globalTeamId))}</strong>.`
                : "Selecciona o confirma un Team global antes de indicar que compites con él."}</span>
            </div>`
          : ""}
      </article>`;
    }

    function renderGameCard(profile, index) {
      const game = games.find((item) => item.id === profile.gameId);
      const roles = profile.roleIds || [];
      const availability = {
        available: ["Disponible", "is-available"],
        looking_for_team: ["Buscando Team", "is-looking"],
        in_team: ["Compitiendo con mi Team", "is-in-team"]
      }[profile.availability] || ["Disponible", "is-available"];

      return `<article class="competitive-profile-card">
        <div class="competitive-profile-card__top">
          <div class="competitive-profile-card__game-icon"><i class="fa-solid fa-gamepad"></i></div>
          <div class="competitive-profile-card__identity"><span>JUEGO</span><h2>${escapeHtml(game?.name || profile.gameId)}</h2></div>
          <button type="button" class="competitive-profile-card__edit" data-edit-game="${index}"><i class="fa-solid fa-pen"></i> ACTUALIZAR ESTE JUEGO</button>
        </div>
        <div class="competitive-profile-card__body">
          <div><span>ROLES</span><div class="competitive-profile-card__roles">${roles.length ? roles.map((role) => `<span>${escapeHtml(role)}</span>`).join("") : "<em>Sin roles</em>"}</div></div>
          <div><span>ESTADO</span><strong class="competitive-profile-card__status ${availability[1]}">${availability[0]}</strong></div>
          ${profile.availability === "in_team" ? `<div><span>TEAM</span><strong>${escapeHtml(getTeamLabel(globalTeamId))}</strong></div>` : ""}
        </div>
      </article>`;
    }

    function render() {
      state.innerHTML = `<form class="competitive-profile-form" data-competitive-form>
        <div class="competitive-profile-form__intro">
          <strong>Tu perfil competitivo</strong>
          <span>Puedes competir en varios juegos y tener varios roles dentro de cada uno. Tu Player solo puede pertenecer a un Team confirmado a la vez.</span>
        </div>

        ${renderTeamSection()}

        <section class="competitive-profile-form__games-section">
          <div class="competitive-profile-form__section-header">
            <div><span class="competitive-profile-form__section-label">JUEGOS</span><strong>Tu historial competitivo</strong><small>Agrega cada juego una sola vez y configura sus roles de forma independiente.</small></div>
          </div>
          <div class="competitive-profile-form__games" data-games>
            ${editingIndex !== null
              ? renderGameEditor(editingIndex)
              : rows.filter((profile) => profile.gameId).map(renderGameCard).join("") || `<div class="competitive-profile-form__games-empty"><i class="fa-solid fa-gamepad"></i><strong>Aún no has configurado juegos.</strong><span>Agrega tu primer juego para comenzar tu perfil competitivo.</span></div>`}
          </div>
          <button type="button" class="competitive-profile-form__add" data-add-game><i class="fa-solid fa-plus"></i> ${editingIndex !== null ? "AGREGAR OTRO JUEGO" : "AGREGAR JUEGO"}</button>
        </section>

        <footer><button type="submit">GUARDAR PERFIL COMPETITIVO</button><span data-competitive-message></span></footer>
      </form>`;

      bind();
    }

    function renderTeamResults(query = "") {
      const results = state.querySelector("[data-team-results]");
      const input = state.querySelector("[data-team-search]");
      if (!results || !input) return;

      const normalized = query.trim().toLowerCase();
      if (!normalized) {
        results.hidden = true;
        input.setAttribute("aria-expanded", "false");
        results.innerHTML = "";
        return;
      }

      const matches = teams.filter((team) => {
        const haystack = [team.id, team.name, team.shortName, team.teamName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      }).slice(0, 10);

      results.innerHTML = matches.length
        ? matches.map((team) => `<button type="button" class="competitive-profile-form__team-result" data-team-result data-team-id="${escapeHtml(team.id)}" role="option"><strong>${escapeHtml(getTeamName(team))}</strong><span>${escapeHtml(team.id)}</span></button>`).join("")
        : `<div class="competitive-profile-form__team-empty">No encontramos un Team con ese nombre o ID.</div>`;

      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function bind() {
      const form = state.querySelector("[data-competitive-form]");
      const gamesContainer = state.querySelector("[data-games]");
      const teamInput = state.querySelector("[data-team-search]");

      if (teamInput) {
        teamInput.addEventListener("input", (event) => {
          teamSearch = event.target.value;
          renderTeamResults(teamSearch);
        });
        teamInput.addEventListener("focus", (event) => renderTeamResults(event.target.value));
      }

      if (!state.dataset.clickBound) {
        state.addEventListener("click", handleClick);
        state.dataset.clickBound = "true";
      }

      if (gamesContainer) {
        gamesContainer.addEventListener("change", (event) => {
          const gameSelect = event.target.closest("[data-game-select]");
          if (gameSelect) {
            const index = Number(gameSelect.dataset.gameSelect);
            rows[index].gameId = gameSelect.value;
            rows[index].roleIds = [];
            editingIndex = index;
            render();
            return;
          }

          const roleInput = event.target.closest("[data-role]");
          if (roleInput) {
            const index = Number(roleInput.dataset.role);
            rows[index].roleIds = [...gamesContainer.querySelectorAll(`[data-role="${index}"]:checked`)].map((input) => input.value);
            return;
          }

          const availability = event.target.closest("[data-availability]");
          if (availability) {
            const index = Number(availability.dataset.availability);
            rows[index].availability = availability.value;
            editingIndex = index;
            render();
          }
        });
      }

      if (form) {
        form.addEventListener("submit", handleSubmit);
      }
    }

    function handleClick(event) {
      const result = event.target.closest("[data-team-result]");
      if (result) {
        const team = teams.find((item) => item.id === result.dataset.teamId);
        if (!team) return;

        if (team.id === globalTeamId) {
          pendingTeamId = null;
          pendingRequestedAt = null;
        } else {
          pendingTeamId = team.id;
          pendingRequestedAt = new Date().toISOString();
        }

        teamSearch = "";
        render();
        return;
      }

      const changeTeam = event.target.closest("[data-change-team]");
      if (changeTeam) {
        const wrap = state.querySelector("[data-team-search-wrap]");
        if (wrap) wrap.hidden = false;
        const input = state.querySelector("[data-team-search]");
        input?.focus();
        return;
      }

      const edit = event.target.closest("[data-edit-game]");
      if (edit) {
        editingIndex = Number(edit.dataset.editGame);
        render();
        return;
      }

      const remove = event.target.closest("[data-remove-game]");
      if (remove) {
        const index = Number(remove.dataset.removeGame);
        rows.splice(index, 1);
        if (!rows.length) rows.push({ gameId: "", roleIds: [], availability: "available" });
        editingIndex = null;
        render();
        return;
      }

      const add = event.target.closest("[data-add-game]");
      if (add) {
        rows.push({ gameId: "", roleIds: [], availability: "available" });
        editingIndex = rows.length - 1;
        render();
        return;
      }

      const clearPending = event.target.closest("[data-clear-team-request]");
      if (clearPending) {
        pendingTeamId = null;
        pendingRequestedAt = null;
        teamSearch = "";
        render();
      }
    }

    async function handleSubmit(event) {
      event.preventDefault();
      const message = state.querySelector("[data-competitive-message]");
      const button = state.querySelector("button[type=submit]");
      const clean = rows
        .filter((profile) => profile.gameId)
        .map((profile) => ({
          gameId: profile.gameId,
          roleIds: [...new Set(profile.roleIds || [])],
          availability: ["available", "looking_for_team", "in_team"].includes(profile.availability)
            ? profile.availability
            : "available"
        }));

      if (clean.some((profile) => !profile.roleIds.length)) {
        message.textContent = "Selecciona al menos un rol para cada juego.";
        return;
      }

      if (clean.some((profile) => profile.availability === "in_team") && !globalTeamId) {
        message.textContent = "Necesitas un Team confirmado para indicar que compites con él.";
        return;
      }

      if (pendingTeamId === globalTeamId) {
        pendingTeamId = null;
        pendingRequestedAt = null;
      }

      button.disabled = true;
      message.textContent = "Guardando...";

      try {
        const update = {
          teamId: globalTeamId,
          competitiveProfiles: clean
        };

        if (pendingTeamId) {
          update.teamRequest = {
            teamId: pendingTeamId,
            status: "pending",
            requestedAt: pendingRequestedAt || new Date().toISOString()
          };
        } else {
          update.teamRequest = null;
        }

        await updateEntity("players", context.id, update);
        message.textContent = "Perfil competitivo actualizado correctamente.";
        editingIndex = null;
        render();
        state.querySelector("[data-competitive-message]").textContent = "Perfil competitivo actualizado correctamente.";
      } catch (error) {
        console.error("NEXUS — Error actualizando perfil competitivo:", error);
        message.textContent = "No se pudo guardar el perfil competitivo.";
      } finally {
        const currentButton = state.querySelector("button[type=submit]");
        if (currentButton) currentButton.disabled = false;
      }
    }

    render();
  })().catch((error) => {
    console.error("NEXUS — Error cargando perfil competitivo:", error);
    page.querySelector("[data-competitive-profile-state]").textContent = "No se pudo cargar el perfil competitivo.";
  });

  return page;
}
