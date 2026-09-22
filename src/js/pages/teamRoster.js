// ========================================
// ARKHAM — Team Roster
// ========================================

import { getCurrentEntityContext } from "../services/entityContext.js";
import {
  getTeamRoster,
  approveTeamRequest,
  rejectTeamRequest,
  removeTeamMember
} from "../services/teamRoster.js";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function formatDate(value) {
  if (!value) return "";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function TeamRoster() {
  const page = document.createElement("main");
  page.className = "team-page team-roster-page";

  page.innerHTML = `
    <section class="team-page__content">
      <header class="team-page__header">
        <span>TEAM</span>
        <h1>Roster</h1>
        <p>Gestiona tus jugadores, solicitudes de incorporación y miembros activos de tu organización.</p>
      </header>

      <div class="team-roster__state" data-roster-state>
        <span>Cargando Roster...</span>
      </div>
    </section>
  `;

  loadRoster(page);
  return page;
}

async function loadRoster(page) {
  const state = page.querySelector("[data-roster-state]");

  try {
    const context = await getCurrentEntityContext();
    if (context?.type !== "team" || !context.id) {
      state.innerHTML = `
        <div class="team-roster__empty">
          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
          <strong>Team no disponible</strong>
          <span>No se encontró el Team activo de esta sesión.</span>
        </div>`;
      return;
    }

    const response = await getTeamRoster(context.id);
    renderRoster(state, response);
  } catch (error) {
    console.error("ARKHAM — Error cargando Team Roster:", error);
    state.innerHTML = `
      <div class="team-roster__empty team-roster__empty--error">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <strong>No se pudo cargar el Roster</strong>
        <span>${escapeHtml(error?.message || "Intenta nuevamente.")}</span>
        <button type="button" data-retry-roster>REINTENTAR</button>
      </div>`;

    state.querySelector("[data-retry-roster]")?.addEventListener("click", () => loadRoster(page));
  }
}

function renderRoster(state, response) {
  const members = Array.isArray(response?.members) ? response.members : [];
  const allRequests = Array.isArray(response?.requests)
    ? response.requests
    : [];

  const requests = allRequests.filter((request) => request.status === "pending");
  const history = allRequests.filter((request) =>
    ["approved", "rejected", "cancelled"].includes(request.status)
  );

  state.innerHTML = `
    <div class="team-roster__stats">
      <article>
        <span>ROSTER ACTIVO</span>
        <strong>${members.length}</strong>
        <small>Players confirmados</small>
      </article>
      <article class="${requests.length ? "has-pending" : ""}">
        <span>SOLICITUDES</span>
        <strong>${requests.length}</strong>
        <small>Incorporaciones pendientes</small>
      </article>
    </div>

    <section class="team-roster__section">
      <header class="team-roster__section-header">
        <div>
          <span>ORGANIZACIÓN</span>
          <h2>Jugadores activos</h2>
        </div>
        <a href="/dashboard/team/divisions" data-team-roster-link>
          Gestionar divisiones <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </a>
      </header>

      ${members.length
        ? `<div class="team-roster__members">
            ${members.map(renderMember).join("")}
          </div>`
        : `<div class="team-roster__empty">
            <i class="fa-solid fa-users" aria-hidden="true"></i>
            <strong>Aún no tienes jugadores en tu Roster.</strong>
            <span>Cuando un Player solicite incorporarse a tu Team, su solicitud aparecerá aquí para revisión.</span>
          </div>`}
    </section>

    <section class="team-roster__section team-roster__section--requests">
      <header class="team-roster__section-header">
        <div>
          <span>INCORPORACIONES</span>
          <h2>Solicitudes pendientes</h2>
        </div>
        <span class="team-roster__counter">${requests.length}</span>
      </header>

      ${requests.length
        ? `<div class="team-roster__requests">${requests.map(renderRequest).join("")}</div>`
        : `<div class="team-roster__empty team-roster__empty--compact">
            <i class="fa-regular fa-circle-check" aria-hidden="true"></i>
            <strong>No tienes solicitudes pendientes.</strong>
            <span>Las nuevas solicitudes de Players aparecerán automáticamente en esta sección.</span>
          </div>`}
    </section>

    <section class="team-roster__section team-roster__section--history">
      <header class="team-roster__section-header">
        <div>
          <span>HISTORIAL</span>
          <h2>Solicitudes procesadas</h2>
        </div>
        <span class="team-roster__counter">${history.length}</span>
      </header>

      ${history.length
        ? `<div class="team-roster__requests">${history.map(renderRequestHistory).join("")}</div>`
        : `<div class="team-roster__empty team-roster__empty--compact">
            <i class="fa-regular fa-clock" aria-hidden="true"></i>
            <strong>Aún no hay solicitudes procesadas.</strong>
            <span>Las solicitudes aceptadas, rechazadas o canceladas permanecerán aquí como referencia.</span>
          </div>`}
    </section>
  `;

  state.querySelectorAll("[data-team-roster-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.history.pushState({}, "", link.getAttribute("href"));
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });

  state.querySelectorAll("[data-remove-member]").forEach((button) => {
    button.addEventListener("click", async () => {
      const playerId = button.dataset.playerId;
      const teamId = response?.team?.id;
      if (!playerId || !teamId) return;

      const confirmed = window.confirm(
        "¿Quieres expulsar a este Player del Roster? Podrá solicitar incorporarse a otro Team después de ser retirado."
      );
      if (!confirmed) return;

      button.disabled = true;

      try {
        await removeTeamMember({ teamId, playerId });
        await loadRoster(state.closest(".team-roster-page") || state);
      } catch (error) {
        console.error("ARKHAM — Error expulsando Player del Team:", error);
        button.disabled = false;
        window.alert(error?.message || "No fue posible expulsar al Player.");
      }
    });
  });

  state.querySelectorAll("[data-roster-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const playerId = button.dataset.playerId;
      const requestId = button.dataset.requestId || "";
      const action = button.dataset.rosterAction;
      const teamId = response?.team?.id;
      if (!playerId || !teamId || !action) return;

      const requestCard = button.closest("[data-request-card]");
      const buttons = requestCard?.querySelectorAll("button") || [];
      buttons.forEach((item) => { item.disabled = true; });

      try {
        if (action === "reject") {
          const reason = window.prompt("Motivo del rechazo (opcional):", "") || "";
          await rejectTeamRequest({ teamId, playerId, requestId, reason });
        } else {
          await approveTeamRequest({ teamId, playerId, requestId });
        }

        await loadRoster(state.closest(".team-roster-page") || state);
      } catch (error) {
        console.error("ARKHAM — Error procesando solicitud de Team:", error);
        buttons.forEach((item) => { item.disabled = false; });
        window.alert(error?.message || "No fue posible procesar la solicitud.");
      }
    });
  });
}

function renderMember(member) {
  const displayName = member.gamertag || member.playerName || member.playerId;
  const secondary = member.gamertag && member.playerName !== member.gamertag
    ? member.playerName
    : `ID: ${member.playerId}`;

  return `
    <article class="team-roster__member">
      <div class="team-roster__avatar">
        <i class="fa-solid fa-user" aria-hidden="true"></i>
      </div>
      <div class="team-roster__member-main">
        <strong>${escapeHtml(displayName)}</strong>
        <span>${escapeHtml(secondary)}</span>
      </div>
      <div class="team-roster__member-meta">
        <span>${member.divisionId ? escapeHtml(member.divisionId) : "SIN DIVISIÓN"}</span>
        <small>${member.roleId ? escapeHtml(member.roleId) : "Rol pendiente"}</small>
      </div>
      <div class="team-roster__member-actions">
        <button type="button" data-remove-member data-player-id="${escapeHtml(member.playerId)}">
          EXPULSAR
        </button>
      </div>
    </article>`;
}


function renderRequestHistory(request) {
  const statusMeta = {
    approved: ["APROBADA", "fa-circle-check"],
    rejected: ["RECHAZADA", "fa-circle-xmark"],
    cancelled: ["CANCELADA", "fa-ban"]
  };

  const [label, icon] = statusMeta[request.status] || ["PROCESADA", "fa-circle-check"];

  return `
    <article class="team-roster__request team-roster__request--history is-${escapeHtml(request.status)}">
      <div class="team-roster__avatar">
        <i class="fa-solid ${icon}" aria-hidden="true"></i>
      </div>
      <div class="team-roster__request-main">
        <strong>${escapeHtml(request.gamertag || request.playerName)}</strong>
        <span>${escapeHtml(request.playerName)} · ID: ${escapeHtml(request.playerId)}</span>
        <small>Solicitud ${escapeHtml(label.toLowerCase())} · ${escapeHtml(formatDate(request.respondedAt) || formatDate(request.requestedAt) || "sin fecha")}</small>
        ${request.reviewReason ? `<small>Motivo: ${escapeHtml(request.reviewReason)}</small>` : ""}
      </div>
      <div class="team-roster__counter">${escapeHtml(label)}</div>
    </article>`;
}

function renderRequest(request) {
  return `
    <article class="team-roster__request" data-request-card>
      <div class="team-roster__avatar">
        <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
      </div>
      <div class="team-roster__request-main">
        <strong>${escapeHtml(request.gamertag || request.playerName)}</strong>
        <span>${escapeHtml(request.playerName)} · ID: ${escapeHtml(request.playerId)}</span>
        <small>Solicitud enviada ${escapeHtml(formatDate(request.requestedAt) || "recientemente")}</small>
      </div>
      <div class="team-roster__request-actions">
        <button type="button" data-roster-action="reject" data-player-id="${escapeHtml(request.playerId)}"
          data-request-id="${escapeHtml(request.requestId || "")}">RECHAZAR</button>
        <button type="button" data-roster-action="approve" data-player-id="${escapeHtml(request.playerId)}"
          data-request-id="${escapeHtml(request.requestId || "")}">ACEPTAR</button>
      </div>
    </article>`;
}
