// ========================================
// NEXUS — Team Competitions
// ========================================

import { getCurrentEntityContext } from "../services/entityContext.js";
import {
  getMyTournamentRegistrationRequests
} from "../services/tournamentRegistration.js";
import {
  getMyTournamentCompetitions,
  requestTournamentRecognition
} from "../services/tournamentRecognition.js";

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
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function competitionUrl(competition) {
  return `/competitions/event?tournamentId=${encodeURIComponent(competition.tournamentId)}&eventId=${encodeURIComponent(competition.eventId)}`;
}

export function TeamCompetitions({ view = "competitions" } = {}) {
  const page = document.createElement("main");
  page.className = `team-page team-competitions-page team-competitions-page--${view}`;

  const copy = view === "requests"
    ? {
        eyebrow: "COMPETITIVO",
        title: "Solicitudes a torneo",
        description: "Consulta el estado de las solicitudes realizadas por tu Team para ocupar un asiento en una competencia."
      }
    : {
        eyebrow: "COMPETITIVO",
        title: "Mis competencias",
        description: "Aquí encontrarás las competencias en las que participa o ha participado tu Team."
      };

  page.innerHTML = `
    <section class="team-page__content">
      <header class="team-page__header">
        <span>${copy.eyebrow}</span>
        <h1>${copy.title}</h1>
        <p>${copy.description}</p>
      </header>

      <div class="team-competitions__state" data-team-competition-state>
        <span>Cargando...</span>
      </div>
    </section>
  `;

  loadTeamCompetitiveView(page, view);
  return page;
}

async function loadTeamCompetitiveView(page, view) {
  const state = page.querySelector("[data-team-competition-state]");
  if (!state) return;

  try {
    const context = await getCurrentEntityContext();
    if (context?.type !== "team" || !context.id) {
      renderError(state, "Team no disponible", "No se encontró el Team activo de esta sesión.");
      return;
    }

    if (view === "requests") {
      await loadRequests(state);
    } else {
      await loadCompetitions(state);
    }
  } catch (error) {
    console.error("NEXUS — Error cargando módulo competitivo del Team:", error);
    renderError(state, "No fue posible cargar la información", error?.message || "Intenta nuevamente.", true, page, view);
  }
}

async function loadCompetitions(state) {
  const response = await getMyTournamentCompetitions();
  const competitions = Array.isArray(response?.competitions) ? response.competitions : [];

  if (!competitions.length) {
    state.innerHTML = `
      <div class="team-competitions__empty">
        <i class="fa-regular fa-trophy" aria-hidden="true"></i>
        <strong>Aún no tienes competencias registradas.</strong>
        <span>Cuando tu Team tenga una participación en una competencia Pro aparecerá aquí.</span>
        <a href="/competitions" data-team-competitive-link>EXPLORAR COMPETENCIAS <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </div>`;
    bindInternalLinks(state);
    return;
  }

  const statusMeta = {
    finished: { label: "FINALIZADA", className: "is-finished" },
    live: { label: "EN VIVO", className: "is-live" },
    published: { label: "PUBLICADA", className: "is-published" },
    check_in: { label: "CHECK-IN", className: "is-checkin" }
  };

  state.innerHTML = `
    <div class="team-competitions__toolbar">
      <div>
        <span>PARTICIPACIÓN COMPETITIVA</span>
        <strong>${competitions.length}</strong>
        <small>${competitions.length === 1 ? "competencia registrada" : "competencias registradas"}</small>
      </div>
      <a href="/competitions" data-team-competitive-link>EXPLORAR COMPETENCIAS <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
    </div>

    <div class="team-competitions__list">
      ${competitions.map((competition) => {
        const meta = statusMeta[competition.status] || {
          label: String(competition.status || "COMPETENCIA").toUpperCase(),
          className: ""
        };
        const recognition = competition.recognition || {};
        const recognitionLabel = recognition.eligible
          ? recognition.status === "approved"
            ? "RECONOCIMIENTO APROBADO"
            : recognition.status === "requested"
              ? "RECONOCIMIENTO EN REVISIÓN"
              : recognition.status === "rejected"
                ? "RECONOCIMIENTO RECHAZADO"
                : "RECONOCIMIENTO DISPONIBLE"
          : "SIN RECONOCIMIENTO";

        return `
          <article class="team-competition-card ${meta.className}">
            <div class="team-competition-card__top">
              <span>${escapeHtml(meta.label)}</span>
              <span>${escapeHtml(competition.gameId || "COMPETENCIA")}</span>
            </div>
            <div class="team-competition-card__main">
              <span>COMPETENCIA</span>
              <h2>${escapeHtml(competition.name || competition.tournamentName || "Competencia NEXUS")}</h2>
              <p>${escapeHtml(competition.format || "—")} · ${escapeHtml(competition.matchSystem || "—")}</p>
            </div>
            <div class="team-competition-card__meta">
              <span>FECHA</span>
              <strong>${escapeHtml(formatDate(competition.dateTime))}</strong>
            </div>
            ${recognition.eligible ? `
              <div class="team-competition-card__recognition ${recognition.status === "approved" ? "is-approved" : recognition.status === "rejected" ? "is-rejected" : recognition.status === "requested" ? "is-requested" : "is-available"}">
                <i class="fa-solid fa-award" aria-hidden="true"></i>
                <span>${escapeHtml(recognitionLabel)}</span>
              </div>` : ""}
            <footer>
              <a href="${competitionUrl(competition)}" data-team-competitive-link>
                VER COMPETENCIA <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </a>
              ${recognition.eligible && ["not_requested", "rejected"].includes(recognition.status) ? `
                <button type="button" class="team-competition-card__claim" data-claim-tournament="${escapeHtml(competition.tournamentId)}" data-claim-event="${escapeHtml(competition.eventId)}">
                  ${recognition.status === "rejected" ? "RECLAMAR NUEVAMENTE" : "RECLAMAR RECONOCIMIENTO"}
                  <i class="fa-solid fa-award" aria-hidden="true"></i>
                </button>` : ""}
            </footer>
          </article>`;
      }).join("")}
    </div>
  `;

  state.querySelectorAll("[data-claim-tournament]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await requestTournamentRecognition({
          tournamentId: button.dataset.claimTournament,
          eventId: button.dataset.claimEvent
        });
        await loadCompetitions(state);
      } catch (error) {
        window.alert(error?.message || "No fue posible reclamar el reconocimiento.");
        button.disabled = false;
      }
    });
  });

  bindInternalLinks(state);
}

async function loadRequests(state) {
  const response = await getMyTournamentRegistrationRequests();
  const requests = Array.isArray(response?.requests) ? response.requests : [];

  if (!requests.length) {
    state.innerHTML = `
      <div class="team-competitions__empty">
        <i class="fa-regular fa-inbox" aria-hidden="true"></i>
        <strong>No tienes solicitudes a torneos.</strong>
        <span>Cuando tu Team solicite un asiento en una competencia aparecerá aquí.</span>
        <a href="/competitions" data-team-competitive-link>EXPLORAR COMPETENCIAS <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </div>`;
    bindInternalLinks(state);
    return;
  }

  const statusMeta = {
    pending: { label: "EN REVISIÓN", icon: "fa-hourglass-half", className: "is-pending" },
    approved: { label: "ASIENTO APROBADO", icon: "fa-circle-check", className: "is-approved" },
    rejected: { label: "RECHAZADA", icon: "fa-circle-xmark", className: "is-rejected" }
  };

  state.innerHTML = `
    <div class="team-competitions__toolbar">
      <div>
        <span>SOLICITUDES</span>
        <strong>${requests.length}</strong>
        <small>${requests.length === 1 ? "solicitud registrada" : "solicitudes registradas"}</small>
      </div>
      <a href="/competitions" data-team-competitive-link>EXPLORAR COMPETENCIAS <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
    </div>

    <div class="team-competition-requests">
      ${requests.map((request) => {
        const status = statusMeta[request.status] || statusMeta.pending;
        const url = competitionUrl(request);
        return `
          <article class="team-competition-request ${status.className}">
            <div class="team-competition-request__status">
              <i class="fa-solid ${status.icon}" aria-hidden="true"></i>
              <span>${status.label}</span>
            </div>
            <div class="team-competition-request__main">
              <span>TORNEO</span>
              <h2>${escapeHtml(request.tournamentName || "Torneo NEXUS")}</h2>
              <small>${escapeHtml(request.gameId || "Competencia NEXUS")}</small>
            </div>
            <div class="team-competition-request__date">
              <span>FECHA DE SOLICITUD</span>
              <strong>${escapeHtml(formatDate(request.createdAt))}</strong>
            </div>
            ${request.status === "rejected" && request.rejectionReason ? `
              <div class="team-competition-request__reason">
                <span>MOTIVO DEL RECHAZO</span>
                <p>${escapeHtml(request.rejectionReason)}</p>
              </div>` : ""}
            <footer>
              <span>${request.status === "pending" ? "El organizador está revisando la solicitud." : request.status === "approved" ? "El asiento de tu Team ya fue otorgado." : "Puedes volver a solicitar el asiento desde la competencia."}</span>
              <a href="${url}" data-team-competitive-link>
                ${request.status === "rejected" ? "VOLVER A INTENTAR" : "VER COMPETENCIA"}
                <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </a>
            </footer>
          </article>`;
      }).join("")}
    </div>
  `;

  bindInternalLinks(state);
}

function bindInternalLinks(state) {
  state.querySelectorAll("[data-team-competitive-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.history.pushState({}, "", link.getAttribute("href"));
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });
}

function renderError(state, title, message, retry = false, page = null, view = "competitions") {
  state.innerHTML = `
    <div class="team-competitions__empty team-competitions__empty--error">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
      ${retry && page ? `<button type="button" data-team-competitive-retry>REINTENTAR</button>` : ""}
    </div>`;

  state.querySelector("[data-team-competitive-retry]")?.addEventListener("click", () => {
    loadTeamCompetitiveView(page, view);
  });
}
