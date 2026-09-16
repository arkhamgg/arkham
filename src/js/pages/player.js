// ========================================
// NEXUS — Player Account Views
// ========================================

import { getCurrentEntityContext } from "../services/entityContext.js";
import { getGames } from "../services/gameCatalog.js";
import { getEntities } from "../services/firestore.js";
import { updateEntity } from "../services/firestore.js";
import { uploadImage } from "../services/imagekit.js";

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
  page.className = "player-view-page";
  const views = {
    competitions: ["COMPETITIVO", "Mis competencias", "Aquí aparecerán las competencias en las que participes."],
    requests: ["COMPETITIVO", "Solicitudes a torneo", "Consulta el estado de tus solicitudes y gestiona nuevos intentos."],
    results: ["COMPETITIVO", "Mis resultados", "Tu historial de resultados competitivos se mostrará aquí."],
    stats: ["COMPETITIVO", "Estadísticas", "Tus estadísticas competitivas se construirán a partir de tus partidas registradas."]
  };
  const current = views[view] || views.competitions;
  page.innerHTML = `<section class="player-view-page__content"><span class="player-view-page__eyebrow">${current[0]}</span><h1>${current[1]}</h1><p>${current[2]}</p><span class="player-view-page__status">MÓDULO PLAYER · EN CONSTRUCCIÓN</span></section>`;
  return page;
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
    const profiles = Array.isArray(context.entity.competitiveProfiles)
      ? context.entity.competitiveProfiles
      : [];

    // La relación con un Team es global para el Player.
    // Se conserva compatibilidad con datos anteriores que guardaban teamId por juego.
    const legacyTeamIds = profiles
      .map((profile) => profile?.teamId)
      .filter(Boolean);
    const uniqueLegacyTeamIds = [...new Set(legacyTeamIds)];
    let globalTeamId = context.entity.teamId || uniqueLegacyTeamIds[0] || null;
    let teamSearch = globalTeamId
      ? getTeamName(teams.find((team) => team.id === globalTeamId) || {})
      : "";

    state.innerHTML = `<form class="competitive-profile-form" data-competitive-form>
      <div class="competitive-profile-form__intro">
        <strong>Tu perfil competitivo</strong>
        <span>Puedes competir en varios juegos y tener varios roles dentro de cada uno. Tu Player solo puede pertenecer a un Team a la vez.</span>
      </div>

      <section class="competitive-profile-form__team-section">
        <div>
          <span class="competitive-profile-form__section-label">TEAM</span>
          <strong>Tu Team</strong>
          <small>La pertenencia a un Team es global, no por juego. La confirmación formal del Team se gestionará posteriormente.</small>
        </div>
        <div class="competitive-profile-form__team-picker">
          <label for="player-team-search">Buscar Team por nombre o ID</label>
          <div class="competitive-profile-form__team-search">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input id="player-team-search" type="search" data-team-search value="${escapeHtml(teamSearch)}" placeholder="Ej. BlackNode Predators o ID" autocomplete="off" role="combobox" aria-expanded="false">
          </div>
          <div class="competitive-profile-form__team-results" data-team-results role="listbox" hidden></div>
          <div class="competitive-profile-form__team-current" data-team-current>
            ${globalTeamId
              ? `<span>Team seleccionado</span><strong>${escapeHtml(getTeamName(teams.find((team) => team.id === globalTeamId) || {}))}</strong><small>ID: ${escapeHtml(globalTeamId)}</small><button type="button" class="competitive-profile-form__team-clear" data-team-clear>QUITAR TEAM</button>`
              : `<span>Ningún Team seleccionado</span><small>Selecciona uno si actualmente perteneces a un Team.</small>`}
          </div>
        </div>
      </section>

      <div class="competitive-profile-form__games" data-games></div>
      <button type="button" class="competitive-profile-form__add" data-add-game><i class="fa-solid fa-plus"></i> AGREGAR JUEGO</button>
      <footer><button type="submit">GUARDAR PERFIL COMPETITIVO</button><span data-competitive-message></span></footer>
    </form>`;

    const gamesContainer = state.querySelector("[data-games]");

    let rows = profiles.length
      ? profiles.map((profile) => ({
          gameId: profile?.gameId || "",
          roleIds: Array.isArray(profile?.roleIds) ? [...profile.roleIds] : [],
          availability: profile?.availability || "available"
        }))
      : [{ gameId: "", roleIds: [], availability: "available" }];

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

    function renderRows() {
      gamesContainer.innerHTML = rows.map((profile, index) => {
        const game = games.find((item) => item.id === profile.gameId);
        const roleEntries = getRoleEntries(game);

        return `<article class="competitive-profile-form__game" data-game-row="${index}">
          <div class="competitive-profile-form__game-head">
            <strong>JUEGO ${String(index + 1).padStart(2, "0")}</strong>
            ${rows.length > 1 ? `<button type="button" data-remove-game="${index}" aria-label="Eliminar juego"><i class="fa-solid fa-xmark"></i></button>` : ""}
          </div>

          <label>Juego<select data-game-select="${index}">
            <option value="">Selecciona un juego</option>
            ${games.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === profile.gameId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
          </select></label>

          <div class="competitive-profile-form__roles">
            <span>ROLES · PUEDES ELEGIR VARIOS</span>
            ${roleEntries.length
              ? roleEntries.map(([id, label]) => `<label><input type="checkbox" data-role="${index}" value="${escapeHtml(id)}" ${profile.roleIds.includes(id) ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`).join("")
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
                  ? `Este juego utilizará tu Team global: <strong>${escapeHtml(getTeamName(teams.find((team) => team.id === globalTeamId) || {}))}</strong>.`
                  : "Selecciona primero tu Team global arriba para indicar que compites con él."}</span>
              </div>`
            : ""}
        </article>`;
      }).join("");
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

      const matches = teams
        .filter((team) => {
          const haystack = [team.id, team.name, team.shortName, team.teamName]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalized);
        })
        .slice(0, 10);

      results.innerHTML = matches.length
        ? matches.map((team) => `<button type="button" class="competitive-profile-form__team-result" data-team-result data-team-id="${escapeHtml(team.id)}" role="option"><strong>${escapeHtml(getTeamName(team))}</strong><span>${escapeHtml(team.id)}</span></button>`).join("")
        : `<div class="competitive-profile-form__team-empty">No encontramos un Team con ese nombre o ID.</div>`;

      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    state.querySelector("[data-team-search]").addEventListener("input", (event) => {
      teamSearch = event.target.value;
      renderTeamResults(teamSearch);
    });

    state.querySelector("[data-team-search]").addEventListener("focus", (event) => {
      renderTeamResults(event.target.value);
    });

    state.addEventListener("click", (event) => {
      const result = event.target.closest("[data-team-result]");
      if (result) {
        const team = teams.find((item) => item.id === result.dataset.teamId);
        if (!team) return;

        globalTeamId = team.id;
        teamSearch = getTeamName(team);
        state.querySelector("[data-team-search]").value = teamSearch;
        renderTeamResults("");
        renderRows();
        renderTeamCurrent();
        return;
      }

      const clear = event.target.closest("[data-team-clear]");
      if (clear) {
        globalTeamId = null;
        teamSearch = "";
        state.querySelector("[data-team-search]").value = "";
        renderTeamResults("");
        renderTeamCurrent();
        renderRows();
      }
    });

    function renderTeamCurrent() {
      const current = state.querySelector("[data-team-current]");
      if (!current) return;

      const selectedTeam = teams.find((team) => team.id === globalTeamId);
      current.innerHTML = selectedTeam
        ? `<span>Team seleccionado</span><strong>${escapeHtml(getTeamName(selectedTeam))}</strong><small>ID: ${escapeHtml(selectedTeam.id)}</small><button type="button" class="competitive-profile-form__team-clear" data-team-clear>QUITAR TEAM</button>`
        : `<span>Ningún Team seleccionado</span><small>Selecciona uno si actualmente perteneces a un Team.</small>`;
    }

    gamesContainer.addEventListener("change", (event) => {
      const gameSelect = event.target.closest("[data-game-select]");
      if (gameSelect) {
        const index = Number(gameSelect.dataset.gameSelect);
        rows[index].gameId = gameSelect.value;
        rows[index].roleIds = [];
        renderRows();
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
        renderRows();
      }
    });

    gamesContainer.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove-game]");
      if (!remove) return;
      rows.splice(Number(remove.dataset.removeGame), 1);
      renderRows();
    });

    state.querySelector("[data-add-game]").addEventListener("click", () => {
      rows.push({ gameId: "", roleIds: [], availability: "available" });
      renderRows();
    });

    state.querySelector("form").addEventListener("submit", async (event) => {
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
        message.textContent = "Selecciona tu Team global antes de indicar que compites con él.";
        return;
      }

      button.disabled = true;
      message.textContent = "Guardando...";

      try {
        await updateEntity("players", context.id, {
          teamId: globalTeamId,
          competitiveProfiles: clean
        });
        message.textContent = "Perfil competitivo actualizado correctamente.";
      } catch (error) {
        console.error("NEXUS — Error actualizando perfil competitivo:", error);
        message.textContent = "No se pudo guardar el perfil competitivo.";
      } finally {
        button.disabled = false;
      }
    });

    renderRows();
    renderTeamCurrent();
  })().catch((error) => {
    console.error("NEXUS — Error cargando perfil competitivo:", error);
    page.querySelector("[data-competitive-profile-state]").textContent = "No se pudo cargar el perfil competitivo.";
  });

  return page;
}
