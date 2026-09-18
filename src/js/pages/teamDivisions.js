// ========================================
// NEXUS — Team Divisions
// ========================================

import { getCurrentEntityContext } from "../services/entityContext.js";
import { getGames } from "../services/gameCatalog.js";
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

    const [divisionResponse, games] = await Promise.all([
      getTeamDivisions(context.id),
      getGames()
    ]);

    renderDivisions(state, {
      teamId: context.id,
      divisions: Array.isArray(divisionResponse?.divisions) ? divisionResponse.divisions : [],
      games: Array.isArray(games) ? games : []
    });
  } catch (error) {
    console.error("NEXUS — Error cargando Divisiones:", error);
    renderError(state, "No se pudieron cargar las Divisiones", error?.message || "Intenta nuevamente.", true, page);
  }
}

function renderDivisions(state, { teamId, divisions, games }) {
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
      ${divisions.length
        ? divisions.map(renderDivision).join("")
        : renderEmpty()}
    </div>

    <div class="team-divisions__modal" data-division-modal hidden>
      <div class="team-divisions__backdrop" data-close-modal></div>
      <section class="team-divisions__dialog" role="dialog" aria-modal="true" aria-labelledby="division-modal-title">
        <header>
          <span>TEAM / DIVISIÓN</span>
          <h2 id="division-modal-title" data-modal-title>Crear división</h2>
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

  bindDivisionEvents(state, { teamId, divisions, games });
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

function bindDivisionEvents(state, { teamId, divisions, games }) {
  state.querySelectorAll("[data-create-division]").forEach((button) => {
    button.addEventListener("click", () => openModal(state, null, games));
  });

  state.querySelectorAll("[data-edit-division]").forEach((button) => {
    button.addEventListener("click", () => {
      const division = divisions.find((item) => item.id === button.dataset.editDivision);
      if (division) openModal(state, division, games);
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

    errorBox.hidden = true;
    errorBox.textContent = "";
    submit.disabled = true;
    submit.textContent = divisionId ? "GUARDANDO..." : "CREANDO...";

    try {
      if (divisionId) {
        await updateTeamDivision({ teamId, divisionId, name, description });
      } else {
        await createTeamDivision({ teamId, name, gameId, description });
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

function openModal(state, division, games) {
  const modal = state.querySelector("[data-division-modal]");
  const form = modal?.querySelector("[data-division-form]");
  if (!modal || !form) return;

  const title = modal.querySelector("[data-modal-title]");
  const submit = form.querySelector("[data-submit-division]");
  const gameSelect = form.elements.gameId;

  form.reset();
  form.elements.divisionId.value = division?.id || "";
  form.elements.name.value = division?.name || "";
  form.elements.description.value = division?.description || "";
  gameSelect.value = division?.gameId || "";
  gameSelect.disabled = Boolean(division);
  title.textContent = division ? "Editar división" : "Crear división";
  submit.textContent = division ? "GUARDAR CAMBIOS" : "CREAR DIVISIÓN";
  modal.hidden = false;
  document.body.classList.add("is-modal-open");
  setTimeout(() => form.elements.name.focus(), 0);
}

function closeModal(state) {
  const modal = state.querySelector("[data-division-modal]");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("is-modal-open");
}

async function refreshDivisions(state, teamId) {
  const [divisionResponse, games] = await Promise.all([
    getTeamDivisions(teamId),
    getGames()
  ]);

  renderDivisions(state, {
    teamId,
    divisions: Array.isArray(divisionResponse?.divisions) ? divisionResponse.divisions : [],
    games: Array.isArray(games) ? games : []
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
