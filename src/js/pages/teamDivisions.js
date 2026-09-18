// ========================================
// NEXUS — Team Divisions
// ========================================

import { getCurrentEntityContext } from "../services/entityContext.js";
import { getGames } from "../services/gameCatalog.js";
import { getTeamRoster } from "../services/teamRoster.js";
import {
  getTeamDivisions,
  createTeamDivision,
  updateTeamDivision,
  deleteTeamDivision
} from "../services/teamDivisions.js";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function getRoleEntries(game) {
  const roles = game?.competitiveInfo?.roles || [];

  const normalizeRole = (role, fallbackId = "") => {
    if (typeof role === "string") {
      const value = role.trim();
      return value ? [value, value] : null;
    }

    if (!role || typeof role !== "object") return null;

    const id = String(
      role.id ??
      role.roleId ??
      role.key ??
      role.value ??
      role.slug ??
      role.code ??
      fallbackId ??
      role.name ??
      role.label ??
      ""
    ).trim();

    const label = String(
      role.name ??
      role.label ??
      role.title ??
      role.displayName ??
      role.id ??
      role.roleId ??
      id
    ).trim();

    return id && label ? [id, label] : null;
  };

  if (Array.isArray(roles)) {
    return roles
      .map((role) => normalizeRole(role))
      .filter(Boolean);
  }

  if (roles && typeof roles === "object") {
    return Object.entries(roles)
      .map(([id, role]) => normalizeRole(role, id))
      .filter(Boolean);
  }

  return [];
}

function getMemberName(member) {
  return member?.gamertag || member?.playerName || member?.playerId || "Player";
}

function getMemberSecondary(member) {
  if (member?.gamertag && member?.playerName && member.playerName !== member.gamertag) {
    return member.playerName;
  }
  return `ID: ${member?.playerId || "—"}`;
}

export function TeamDivisions() {
  const page = document.createElement("main");
  page.className = "team-page team-divisions-page";
  page.innerHTML = `
    <section class="team-page__content">
      <header class="team-page__header">
        <span>TEAM</span>
        <h1>Divisiones</h1>
        <p>Organiza tu Team por juego. Cada división será la base para construir su roster competitivo y asignar roles.</p>
      </header>

      <div class="team-divisions__state" data-divisions-state>
        <span>Cargando divisiones...</span>
      </div>
    </section>
  `;

  loadDivisions(page);
  return page;
}

async function loadDivisions(page) {
  const state = page.querySelector("[data-divisions-state]");

  try {
    const context = await getCurrentEntityContext();
    if (context?.type !== "team" || !context.id) {
      renderError(state, "Team no disponible", "No se encontró el Team activo de esta sesión.");
      return;
    }

    const [divisionResponse, games, rosterResponse] = await Promise.all([
      getTeamDivisions(context.id),
      getGames(),
      getTeamRoster(context.id)
    ]);

    renderDivisions(state, {
      teamId: context.id,
      divisions: Array.isArray(divisionResponse?.divisions) ? divisionResponse.divisions : [],
      games: Array.isArray(games) ? games : [],
      members: Array.isArray(rosterResponse?.members) ? rosterResponse.members : []
    });
  } catch (error) {
    console.error("NEXUS — Error cargando Divisiones:", error);
    renderError(state, "No se pudieron cargar las Divisiones", error?.message || "Intenta nuevamente.", true, page);
  }
}

function renderDivisions(state, { teamId, divisions, games, members }) {
  state.innerHTML = `
    <div class="team-divisions__toolbar">
      <div>
        <span class="team-divisions__eyebrow">ORGANIZACIÓN COMPETITIVA</span>
        <h2>${divisions.length} ${divisions.length === 1 ? "división" : "divisiones"}</h2>
      </div>
      <button type="button" class="team-divisions__primary" data-create-division>
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
        CREAR DIVISIÓN
      </button>
    </div>

    <div class="team-divisions__list" data-division-list>
      ${divisions.length ? divisions.map(renderDivision).join("") : renderEmpty()}
    </div>

    <div class="team-divisions__modal" data-division-modal hidden>
      <div class="team-divisions__backdrop" data-close-modal></div>
      <section class="team-divisions__dialog" role="dialog" aria-modal="true" aria-labelledby="division-modal-title">
        <header>
          <div>
            <span>TEAM / DIVISIÓN</span>
            <h2 id="division-modal-title" data-modal-title>Crear división</h2>
          </div>
          <button type="button" class="team-divisions__modal-close" data-close-modal aria-label="Cerrar">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>

        <form data-division-form>
          <input type="hidden" name="divisionId" value="">

          <label>
            <span>Nombre de la división</span>
            <input name="name" type="text" maxlength="60" placeholder="Ej. BlackNode COD" required>
          </label>

          <label>
            <span>Juego</span>
            <select name="gameId" required>
              <option value="">Selecciona un juego</option>
              ${games.map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name || game.title || game.id)}</option>`).join("")}
            </select>
            <small>Los roles competitivos se cargarán desde la configuración del juego en NEXUS.</small>
          </label>

          <div class="team-divisions__builder" data-division-builder hidden>
            <div class="team-divisions__builder-header">
              <div>
                <span>ROSTER DE LA DIVISIÓN</span>
                <strong>Jugadores y roles</strong>
                <small>Solo puedes agregar Players activos de tu Roster que aún no pertenecen a otra división.</small>
              </div>
              <span class="team-divisions__builder-count" data-selected-count>0 Players</span>
            </div>

            <div class="team-divisions__selected" data-selected-members></div>

            <div class="team-divisions__add-player">
              <div class="team-divisions__add-player-header">
                <div>
                  <span>AGREGAR PLAYER</span>
                  <strong>Buscar en tu Roster</strong>
                </div>
                <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
              </div>
              <div class="team-divisions__search-wrap">
                <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input type="search" data-player-search placeholder="Buscar por nombre o ID..." autocomplete="off">
              </div>
              <div class="team-divisions__player-results" data-player-results hidden></div>
            </div>
          </div>

          <label>
            <span>Descripción <em>OPCIONAL</em></span>
            <textarea name="description" rows="4" maxlength="240" placeholder="Describe el objetivo o identidad de esta división."></textarea>
          </label>

          <div class="team-divisions__form-error" data-form-error hidden></div>

          <footer>
            <button type="button" class="team-divisions__secondary" data-close-modal>CANCELAR</button>
            <button type="submit" class="team-divisions__primary" data-submit-division>CREAR DIVISIÓN</button>
          </footer>
        </form>
      </section>
    </div>
  `;

  bindDivisionEvents(state, { teamId, divisions, games, members });
}

function renderDivision(division) {
  const statusLabel = division.status === "inactive" ? "INACTIVA" : "ACTIVA";
  const statusClass = division.status === "inactive" ? "is-inactive" : "";

  return `
    <article class="team-divisions__card ${statusClass}" data-division-card data-division-id="${escapeHtml(division.id)}">
      <div class="team-divisions__game-icon">
        <i class="fa-solid fa-gamepad" aria-hidden="true"></i>
      </div>
      <div class="team-divisions__main">
        <span class="team-divisions__game">${escapeHtml(division.gameName || division.gameId)}</span>
        <h3>${escapeHtml(division.name)}</h3>
        <p>${escapeHtml(division.description || "Sin descripción.")}</p>
      </div>
      <div class="team-divisions__meta">
        <span class="team-divisions__status">${statusLabel}</span>
        <small>${Number.isFinite(Number(division.playerCount)) ? Number(division.playerCount) : 0} Players</small>
      </div>
      <div class="team-divisions__actions">
        <button type="button" data-edit-division="${escapeHtml(division.id)}">EDITAR</button>
        <button type="button" data-delete-division="${escapeHtml(division.id)}">ELIMINAR</button>
      </div>
    </article>`;
}

function renderEmpty() {
  return `
    <div class="team-divisions__empty">
      <div class="team-divisions__empty-icon">
        <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
      </div>
      <strong>Tu Team todavía no tiene divisiones.</strong>
      <span>Crea una división para comenzar a organizar tu estructura competitiva por juego.</span>
      <button type="button" class="team-divisions__primary" data-create-division>
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
        CREAR PRIMERA DIVISIÓN
      </button>
    </div>`;
}

function bindDivisionEvents(state, { teamId, divisions, games, members }) {
  state.querySelectorAll("[data-create-division]").forEach((button) => {
    button.addEventListener("click", () => openModal(state, null, games, members));
  });

  state.querySelectorAll("[data-edit-division]").forEach((button) => {
    button.addEventListener("click", () => {
      const division = divisions.find((item) => item.id === button.dataset.editDivision);
      if (division) openModal(state, division, games, members);
    });
  });

  state.querySelectorAll("[data-delete-division]").forEach((button) => {
    button.addEventListener("click", async () => {
      const divisionId = button.dataset.deleteDivision;
      const division = divisions.find((item) => item.id === divisionId);
      if (!division) return;

      if (!window.confirm(`¿Eliminar la división "${division.name}"? Esta acción no se puede deshacer.`)) return;

      button.disabled = true;
      try {
        await deleteTeamDivision({ teamId, divisionId });
        await refreshDivisions(state, teamId);
      } catch (error) {
        console.error("NEXUS — Error eliminando división:", error);
        button.disabled = false;
        window.alert(error?.message || "No fue posible eliminar la división.");
      }
    });
  });

  state.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(state));
  });

  state.querySelector("[data-division-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = form.querySelector("[data-form-error]");
    const submit = form.querySelector("[data-submit-division]");
    const formData = new FormData(form);
    const divisionId = String(formData.get("divisionId") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const gameId = String(formData.get("gameId") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const selectedMembers = readSelectedMembers(form);

    errorBox.hidden = true;
    errorBox.textContent = "";
    submit.disabled = true;
    submit.textContent = divisionId ? "GUARDANDO..." : "CREANDO...";

    try {
      if (divisionId) {
        await updateTeamDivision({
          teamId,
          divisionId,
          name,
          description,
          players: selectedMembers
        });
      } else {
        await createTeamDivision({
          teamId,
          name,
          gameId,
          description,
          players: selectedMembers
        });
      }

      closeModal(state);
      await refreshDivisions(state, teamId);
    } catch (error) {
      console.error("NEXUS — Error guardando división:", error);
      errorBox.textContent = error?.message || "No fue posible guardar la división.";
      errorBox.hidden = false;
      submit.disabled = false;
      submit.textContent = divisionId ? "GUARDAR CAMBIOS" : "CREAR DIVISIÓN";
    }
  });
}

function openModal(state, division, games, members) {
  const modal = state.querySelector("[data-division-modal]");
  const form = modal?.querySelector("[data-division-form]");
  if (!modal || !form) return;

  const title = modal.querySelector("[data-modal-title]");
  const submit = form.querySelector("[data-submit-division]");
  const gameSelect = form.elements.gameId;
  const builder = form.querySelector("[data-division-builder]");
  const selectedMembersBox = form.querySelector("[data-selected-members]");
  const searchInput = form.querySelector("[data-player-search]");

  form.reset();
  form.elements.divisionId.value = division?.id || "";
  form.elements.name.value = division?.name || "";
  form.elements.description.value = division?.description || "";
  gameSelect.value = division?.gameId || "";
  gameSelect.disabled = Boolean(division);
  title.textContent = division ? "Editar división" : "Crear división";
  submit.textContent = division ? "GUARDAR CAMBIOS" : "CREAR DIVISIÓN";

  form._divisionRosterMembers = members;
  form._divisionGames = games;

  const persistedMembers = division
    ? members
        .filter((member) => String(member?.divisionId || "") === String(division.id))
        .map((member) => ({
          playerId: String(member.playerId || "").trim(),
          roleId: String(member.roleId || "").trim()
        }))
        .filter((member) => member.playerId)
    : [];

  form._divisionMembers = persistedMembers;

  // El roster builder también se utiliza al editar para que lo guardado
  // en teamRoster sea visible y pueda administrarse desde la división.
  if (builder) builder.hidden = false;
  if (searchInput) searchInput.value = "";
  if (selectedMembersBox) {
    selectedMembersBox.innerHTML = renderSelectedMembers(
      persistedMembers,
      members,
      getRoleEntries(games.find((game) => game.id === gameSelect.value))
    );
  }

  const updateBuilder = () => updatePlayerBuilder(form, members, games);
  gameSelect.onchange = updateBuilder;
  if (searchInput) searchInput.oninput = () => renderPlayerResults(form, members);

  modal.hidden = false;
  document.body.classList.add("is-modal-open");
  updatePlayerBuilder(form, members, games);
  setTimeout(() => form.elements.name.focus(), 0);
}

function updatePlayerBuilder(form, members, games) {
  const gameId = String(form.elements.gameId.value || "").trim();
  const game = games.find((item) => item.id === gameId);
  const roles = getRoleEntries(game);
  const builder = form.querySelector("[data-division-builder]");
  const results = form.querySelector("[data-player-results]");
  const selectedBox = form.querySelector("[data-selected-members]");
  const count = form.querySelector("[data-selected-count]");
  const searchInput = form.querySelector("[data-player-search]");

  if (!builder) return;
  builder.hidden = !gameId;

  if (!gameId) {
    if (selectedBox) selectedBox.innerHTML = "";
    if (results) results.hidden = true;
    return;
  }

  form._divisionRoles = roles;
  form._divisionMembers = Array.isArray(form._divisionMembers) ? form._divisionMembers : [];

  if (selectedBox) selectedBox.innerHTML = renderSelectedMembers(form._divisionMembers, members, roles);
  if (count) count.textContent = `${form._divisionMembers.length} ${form._divisionMembers.length === 1 ? "Player" : "Players"}`;

  renderPlayerResults(form, members);
  if (searchInput && document.activeElement !== searchInput) searchInput.value = "";
}

function renderPlayerResults(form, members) {
  const results = form.querySelector("[data-player-results]");
  const searchInput = form.querySelector("[data-player-search]");
  if (!results || !searchInput) return;

  const term = String(searchInput.value || "").trim().toLowerCase();
  const selected = new Set((form._divisionMembers || []).map((item) => item.playerId));
  const currentDivisionId = String(form.elements.divisionId?.value || "").trim();
  const available = members.filter((member) => {
    if (selected.has(member.playerId)) return false;

    const memberDivisionId = String(member?.divisionId || "").trim();

    // En edición, los Players de esta misma división siguen disponibles
    // para volver a seleccionarse si fueron retirados del estado local.
    if (currentDivisionId) {
      return !memberDivisionId || memberDivisionId === currentDivisionId;
    }

    return !memberDivisionId;
  });
  const filtered = term
    ? available.filter((member) => {
        const haystack = [member.playerId, member.playerName, member.gamertag].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(term);
      })
    : available.slice(0, 8);

  if (!filtered.length) {
    results.innerHTML = `<div class="team-divisions__player-results-empty">${term ? "No se encontró ningún Player en tu Roster." : "Todos tus Players ya están asignados a esta división."}</div>`;
    results.hidden = false;
    return;
  }

  results.innerHTML = filtered.map((member) => `
    <button type="button" class="team-divisions__player-result" data-add-player="${escapeHtml(member.playerId)}">
      <span class="team-divisions__player-result-avatar"><i class="fa-solid fa-user" aria-hidden="true"></i></span>
      <span class="team-divisions__player-result-main">
        <strong>${escapeHtml(getMemberName(member))}</strong>
        <small>${escapeHtml(getMemberSecondary(member))}</small>
      </span>
      <i class="fa-solid fa-plus" aria-hidden="true"></i>
    </button>
  `).join("");
  results.hidden = false;

  results.querySelectorAll("[data-add-player]").forEach((button) => {
    button.addEventListener("click", () => {
      const member = members.find((item) => item.playerId === button.dataset.addPlayer);
      if (!member) return;
      if ((form._divisionMembers || []).some((item) => item.playerId === member.playerId)) return;

      const roles = form._divisionRoles || [];
      form._divisionMembers = [
        ...(form._divisionMembers || []),
        { playerId: member.playerId, roleId: roles[0]?.[0] || "" }
      ];
      renderSelectedMembersAndResults(form, members);
    });
  });
}

function renderSelectedMembersAndResults(form, members) {
  const selectedBox = form.querySelector("[data-selected-members]");
  const count = form.querySelector("[data-selected-count]");
  const roles = form._divisionRoles || [];

  if (selectedBox) selectedBox.innerHTML = renderSelectedMembers(form._divisionMembers || [], members, roles);
  if (count) {
    const total = (form._divisionMembers || []).length;
    count.textContent = `${total} ${total === 1 ? "Player" : "Players"}`;
  }

  selectedBox?.querySelectorAll("[data-role-player]").forEach((select) => {
    select.addEventListener("change", () => {
      const player = form._divisionMembers.find((item) => item.playerId === select.dataset.rolePlayer);
      if (player) player.roleId = select.value;
    });
  });

  selectedBox?.querySelectorAll("[data-remove-selected]").forEach((button) => {
    button.addEventListener("click", () => {
      form._divisionMembers = (form._divisionMembers || []).filter((item) => item.playerId !== button.dataset.removeSelected);
      renderSelectedMembersAndResults(form, members);
    });
  });

  renderPlayerResults(form, members);
}

function renderSelectedMembers(selected, members = [], roles = []) {
  if (!selected.length) {
    return `<div class="team-divisions__selected-empty">Todavía no has agregado Players. Busca en tu Roster y asígnales un rol.</div>`;
  }

  return selected.map((item) => {
    const member = members.find((candidate) => candidate.playerId === item.playerId) || { playerId: item.playerId };
    return `
      <article class="team-divisions__selected-player">
        <div class="team-divisions__selected-player-avatar"><i class="fa-solid fa-user" aria-hidden="true"></i></div>
        <div class="team-divisions__selected-player-main">
          <strong>${escapeHtml(getMemberName(member))}</strong>
          <small>${escapeHtml(getMemberSecondary(member))}</small>
        </div>
        <label class="team-divisions__role-field">
          <span>ROL</span>
          <select data-role-player="${escapeHtml(item.playerId)}" ${roles.length ? "" : "disabled"}>
            ${roles.length
              ? roles.map(([id, label]) => `<option value="${escapeHtml(id)}" ${id === item.roleId ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")
              : `<option value="">Sin roles configurados</option>`}
          </select>
        </label>
        <button type="button" class="team-divisions__selected-remove" data-remove-selected="${escapeHtml(item.playerId)}" aria-label="Retirar Player">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </article>`;
  }).join("");
}

function readSelectedMembers(form) {
  return (form._divisionMembers || [])
    .map((item) => ({
      playerId: String(item.playerId || "").trim(),
      roleId: String(item.roleId || "").trim()
    }))
    .filter((item) => item.playerId);
}

function closeModal(state) {
  const modal = state.querySelector("[data-division-modal]");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("is-modal-open");
}

async function refreshDivisions(state, teamId) {
  const [divisionResponse, games, rosterResponse] = await Promise.all([
    getTeamDivisions(teamId),
    getGames(),
    getTeamRoster(teamId)
  ]);

  renderDivisions(state, {
    teamId,
    divisions: Array.isArray(divisionResponse?.divisions) ? divisionResponse.divisions : [],
    games: Array.isArray(games) ? games : [],
    members: Array.isArray(rosterResponse?.members) ? rosterResponse.members : []
  });
}

function renderError(state, title, message, retry = false, page = null) {
  state.innerHTML = `
    <div class="team-divisions__empty team-divisions__empty--error">
      <div class="team-divisions__empty-icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
      ${retry ? `<button type="button" class="team-divisions__primary" data-retry-divisions>REINTENTAR</button>` : ""}
    </div>`;

  if (retry && page) {
    state.querySelector("[data-retry-divisions]")?.addEventListener("click", () => loadDivisions(page));
  }
}
