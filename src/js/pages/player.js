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
  page.innerHTML = `<section class="player-competitive-profile-page__content"><header><span>COMPETITIVO</span><h1>Perfil competitivo</h1><p>Configura cómo compites por cada juego y tu disponibilidad para Teams.</p></header><div data-competitive-profile-state>Cargando juegos...</div></section>`;

  (async () => {
    const context = await getCurrentEntityContext();
    if (!context || context.type !== "player") {
      page.querySelector("[data-competitive-profile-state]").textContent = "No se pudo cargar el perfil Player.";
      return;
    }
    const [games, teams] = await Promise.all([getGames(), getEntities("teams")]);
    const state = page.querySelector("[data-competitive-profile-state]");
    const profiles = Array.isArray(context.entity.competitiveProfiles) ? context.entity.competitiveProfiles : [];

    state.innerHTML = `<form class="competitive-profile-form" data-competitive-form>
      <div class="competitive-profile-form__intro"><strong>Tu perfil por juego</strong><span>Puedes configurar más de un juego. Los roles disponibles se cargan desde el catálogo competitivo de cada juego.</span></div>
      <div class="competitive-profile-form__games" data-games></div>
      <button type="button" class="competitive-profile-form__add" data-add-game><i class="fa-solid fa-plus"></i> AGREGAR JUEGO</button>
      <footer><button type="submit">GUARDAR PERFIL COMPETITIVO</button><span data-competitive-message></span></footer>
    </form>`;

    const gamesContainer = state.querySelector("[data-games]");
    let rows = profiles.length ? profiles.map((profile) => ({ ...profile })) : [{ gameId: "", roleIds: [], availability: "available", teamId: null }];

    function renderRows() {
      gamesContainer.innerHTML = rows.map((profile, index) => {
        const game = games.find((item) => item.id === profile.gameId);
        const roles = game?.competitiveInformation?.roles || [];
        const roleEntries = Array.isArray(roles)
          ? roles.map((role) => {
              if (typeof role === "string") return [role, role];
              return [role?.id || role?.name, role?.name || role?.id];
            }).filter(([id, label]) => id && label)
          : Object.entries(roles);
        const selectedTeam = teams.find((team) => team.id === profile.teamId);
        const teamSearch = profile.teamSearch ?? (selectedTeam ? getTeamName(selectedTeam) : "");
        return `<article class="competitive-profile-form__game" data-game-row="${index}">
          <div class="competitive-profile-form__game-head"><strong>JUEGO ${String(index + 1).padStart(2, "0")}</strong>${rows.length > 1 ? `<button type="button" data-remove-game="${index}" aria-label="Eliminar juego"><i class="fa-solid fa-xmark"></i></button>` : ""}</div>
          <label>Juego<select data-game-select="${index}"><option value="">Selecciona un juego</option>${games.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === profile.gameId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
          <div class="competitive-profile-form__roles"><span>ROLES</span>${roleEntries.length ? roleEntries.map(([id, role]) => `<label><input type="checkbox" data-role="${index}" value="${escapeHtml(id)}" ${profile.roleIds?.includes(id) ? "checked" : ""}><span>${escapeHtml(typeof role === "string" ? role : role?.name || id)}</span></label>`).join("") : `<em>Selecciona un juego para cargar sus roles.</em>`}</div>
          <label>Disponibilidad<select data-availability="${index}"><option value="available" ${profile.availability !== "in_team" ? "selected" : ""}>Disponible</option><option value="in_team" ${profile.availability === "in_team" ? "selected" : ""}>En un Team</option></select></label>
          ${profile.availability === "in_team" ? `<div class="competitive-profile-form__team-picker" data-team-picker="${index}">
            <label for="team-search-${index}">Team asociado</label>
            <div class="competitive-profile-form__team-search">
              <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <input id="team-search-${index}" type="search" data-team-search="${index}" value="${escapeHtml(teamSearch)}" placeholder="Buscar por nombre o ID" autocomplete="off" role="combobox" aria-expanded="false">
            </div>
            <div class="competitive-profile-form__team-results" data-team-results="${index}" role="listbox" hidden></div>
            <div class="competitive-profile-form__team-current" data-team-current="${index}">${selectedTeam ? `<span>Team seleccionado</span><strong>${escapeHtml(getTeamName(selectedTeam))}</strong><small>ID: ${escapeHtml(selectedTeam.id)}</small>` : `<span>Ningún Team seleccionado</span>`}</div>
            <small>La pertenencia pública solo debe considerarse activa cuando el Team confirme la relación.</small>
          </div>` : ""}
        </article>`;
      }).join("");
      bindRows();
    }

    function renderTeamResults(index, query = "") {
      const results = gamesContainer.querySelector(`[data-team-results="${index}"]`);
      const input = gamesContainer.querySelector(`[data-team-search="${index}"]`);
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
          const haystack = [team.id, getTeamName(team), team.shortName]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalized);
        })
        .slice(0, 10);

      results.innerHTML = matches.length
        ? matches.map((team) => `<button type="button" class="competitive-profile-form__team-result" data-team-result="${index}" data-team-id="${escapeHtml(team.id)}"><strong>${escapeHtml(getTeamName(team))}</strong><span>${escapeHtml(team.id)}</span></button>`).join("")
        : `<div class="competitive-profile-form__team-empty">No encontramos un Team con ese nombre o ID.</div>`;

      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function bindRows() {
      gamesContainer.querySelectorAll("[data-game-select]").forEach((select) => select.addEventListener("change", () => { const i=Number(select.dataset.gameSelect); rows[i].gameId=select.value; rows[i].roleIds=[]; renderRows(); }));
      gamesContainer.querySelectorAll("[data-role]").forEach((input) => input.addEventListener("change", () => { const i=Number(input.dataset.role); rows[i].roleIds=[...gamesContainer.querySelectorAll(`[data-role="${i}"]:checked`)].map((el)=>el.value); }));
      gamesContainer.querySelectorAll("[data-availability]").forEach((select) => select.addEventListener("change", () => { const i=Number(select.dataset.availability); rows[i].availability=select.value; if(select.value !== "in_team") rows[i].teamId=null; renderRows(); }));
      gamesContainer.querySelectorAll("[data-team-search]").forEach((input) => {
        const index = Number(input.dataset.teamSearch);
        input.addEventListener("input", () => {
          rows[index].teamSearch = input.value;
          renderTeamResults(index, input.value);
        });
        input.addEventListener("focus", () => renderTeamResults(index, input.value));
      });
      gamesContainer.querySelectorAll("[data-team-result]").forEach((button) => button.addEventListener("click", () => {
        const index = Number(button.dataset.teamResult);
        const team = teams.find((item) => item.id === button.dataset.teamId);
        if (!team) return;
        rows[index].teamId = team.id;
        rows[index].teamSearch = getTeamName(team);
        renderRows();
      }));
      gamesContainer.querySelectorAll("[data-remove-game]").forEach((button) => button.addEventListener("click", () => { rows.splice(Number(button.dataset.removeGame),1); renderRows(); }));
    }

    state.querySelector("[data-add-game]").addEventListener("click", () => { rows.push({ gameId:"", roleIds:[], availability:"available", teamId:null }); renderRows(); });
    state.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = state.querySelector("[data-competitive-message]");
      const button = state.querySelector("button[type=submit]");
      const clean = rows.filter((profile) => profile.gameId).map((profile) => ({ gameId: profile.gameId, roleIds: [...new Set(profile.roleIds || [])], availability: profile.availability === "in_team" ? "in_team" : "available", teamId: profile.availability === "in_team" ? (profile.teamId || null) : null }));
      if (clean.some((profile) => !profile.roleIds.length)) { message.textContent = "Selecciona al menos un rol para cada juego."; return; }
      button.disabled=true; message.textContent="Guardando...";
      try { await updateEntity("players", context.id, { competitiveProfiles: clean }); message.textContent="Perfil competitivo actualizado correctamente."; }
      catch(error){ console.error("NEXUS — Error actualizando perfil competitivo:", error); message.textContent="No se pudo guardar el perfil competitivo."; }
      finally { button.disabled=false; }
    });
    renderRows();
  })().catch((error) => { console.error("NEXUS — Error cargando perfil competitivo:", error); page.querySelector("[data-competitive-profile-state]").textContent="No se pudo cargar el perfil competitivo."; });
  return page;
}
