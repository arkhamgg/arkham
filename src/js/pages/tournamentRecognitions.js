// ========================================
// NEXUS — Tournament Recognition Management
// ========================================

import { getTournamentRecognitionRequests, reviewTournamentRecognition } from "../services/tournamentRecognition.js";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function TournamentRecognitions() {
  const page = document.createElement("main");
  page.className = "tournament-recognitions-page";

  page.innerHTML = `
    <section class="tournament-recognitions-page__container">
      <header class="tournament-recognitions-page__header">
        <div>
          <span class="tournament-recognitions-page__eyebrow">TOURNAMENT PRO // RECONOCIMIENTOS</span>
          <h1>Reconocimientos</h1>
          <p>Gestiona las solicitudes de reconocimiento de todas tus competencias. Cada reconocimiento permanece como historial una vez otorgado o rechazado.</p>
        </div>
        <a href="/dashboard" class="tournament-recognitions-page__back">Volver al dashboard</a>
      </header>
      <div data-recognition-content class="tournament-recognitions-page__content">
        <div class="tournament-recognitions-page__loading"><i class="fa-solid fa-spinner fa-spin"></i> Cargando reconocimientos...</div>
      </div>
    </section>`;

  load(page);
  return page;
}

async function load(page) {
  const content = page.querySelector("[data-recognition-content]");
  try {
    const response = await getTournamentRecognitionRequests();
    render(page, response);
  } catch (error) {
    content.innerHTML = `<div class="tournament-recognitions-page__empty is-error"><strong>No fue posible cargar los reconocimientos.</strong><span>${escapeHtml(error?.message || "Intenta nuevamente.")}</span></div>`;
  }
}

function render(page, response) {
  const content = page.querySelector("[data-recognition-content]");
  const recognitions = Array.isArray(response?.recognitions) ? response.recognitions : [];
  const pending = recognitions.filter((item) => item.status === "requested");
  const history = recognitions.filter((item) => item.status !== "requested");
  const approved = recognitions.filter((item) => item.status === "approved");
  const rejected = recognitions.filter((item) => item.status === "rejected");
  const competitions = Array.isArray(response?.competitions) ? response.competitions : [];

  content.innerHTML = `
    <section class="tournament-recognitions-page__summary">
      <div><span>COMPETENCIAS</span><strong>${competitions.length}</strong></div>
      <div><span>PENDIENTES</span><strong>${pending.length}</strong></div>
      <div><span>OTORGADOS</span><strong>${approved.length}</strong></div>
      <div><span>RECHAZADOS</span><strong>${rejected.length}</strong></div>
    </section>

    <section class="tournament-recognitions-page__section">
      <div class="tournament-recognitions-page__section-head">
        <div><span>01</span><h2>Pendientes</h2></div>
        <p>Solicitudes de cualquier competencia que requieren una decisión.</p>
      </div>
      <div class="tournament-recognitions-page__list">
        ${pending.length ? pending.map((item) => renderPending(item)).join("") : `<div class="tournament-recognitions-page__empty"><strong>No hay solicitudes pendientes.</strong><span>Cuando un Player o participante reclame un reconocimiento aparecerá aquí.</span></div>`}
      </div>
    </section>

    <section class="tournament-recognitions-page__section">
      <div class="tournament-recognitions-page__section-head">
        <div><span>02</span><h2>Historial</h2></div>
        <p>Los reconocimientos otorgados y rechazados permanecen aquí como registro del organizador.</p>
      </div>
      <div class="tournament-recognitions-page__list">
        ${history.length ? history.map(renderHistory).join("") : `<div class="tournament-recognitions-page__empty"><strong>Sin movimientos todavía.</strong><span>Los reconocimientos emitidos por tus competencias aparecerán aquí.</span></div>`}
      </div>
    </section>`;

  page.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", async () => {
      const tournamentId = button.dataset.tournamentId;
      const eventId = button.dataset.eventId;
      const participantId = button.dataset.review;
      const approve = button.dataset.approve === "true";
      const reason = approve ? "" : window.prompt("Motivo del rechazo (opcional):", "") || "";

      if (!approve && reason === null) return;

      button.disabled = true;
      try {
        await reviewTournamentRecognition({ tournamentId, eventId, participantId, approve, reason });
        await load(page);
      } catch (error) {
        window.alert(error?.message || "No fue posible actualizar el reconocimiento.");
        button.disabled = false;
      }
    });
  });
}

function renderCompetitionMeta(item) {
  return `
    <div class="tournament-recognition-card__competition">
      <span class="tournament-recognition-card__eyebrow">COMPETENCIA</span>
      <strong>${escapeHtml(item.competitionName || "Competencia NEXUS")}</strong>
      <small>${escapeHtml(item.tournamentName || "Torneo NEXUS")}</small>
    </div>`;
}

function renderPending(item) {
  return `
    <article class="tournament-recognition-card tournament-recognition-card--pending">
      <div class="tournament-recognition-card__rank"><span>${escapeHtml(String(item.position))}.º</span><small>LUGAR</small></div>
      <div class="tournament-recognition-card__main">
        <span class="tournament-recognition-card__eyebrow">SOLICITUD DE RECONOCIMIENTO</span>
        <h3>${escapeHtml(item.displayName)}</h3>
        <span>${escapeHtml(item.entityType === "player" ? "Player" : item.entityType === "team" ? "Team" : "Participante")}</span>
      </div>
      ${renderCompetitionMeta(item)}
      <div class="tournament-recognition-card__meta"><span>Solicitado</span><strong>${escapeHtml(formatDate(item.requestedAt))}</strong></div>
      <div class="tournament-recognition-card__actions">
        <button type="button" data-review="${escapeHtml(item.participantId)}" data-tournament-id="${escapeHtml(item.tournamentId)}" data-event-id="${escapeHtml(item.eventId)}" data-approve="false">Rechazar</button>
        <button type="button" class="is-primary" data-review="${escapeHtml(item.participantId)}" data-tournament-id="${escapeHtml(item.tournamentId)}" data-event-id="${escapeHtml(item.eventId)}" data-approve="true">Otorgar reconocimiento</button>
      </div>
    </article>`;
}

function renderHistory(item) {
  const approved = item.status === "approved";
  const rejected = item.status === "rejected";
  const status = approved ? "OTORGADO" : rejected ? "RECHAZADO" : "SIN RECLAMAR";
  return `
    <article class="tournament-recognition-card ${approved ? "is-approved" : rejected ? "is-rejected" : "is-unclaimed"}">
      <div class="tournament-recognition-card__rank"><span>${escapeHtml(String(item.position))}.º</span><small>LUGAR</small></div>
      <div class="tournament-recognition-card__main"><span class="tournament-recognition-card__eyebrow">${status}</span><h3>${escapeHtml(item.displayName)}</h3><span>${escapeHtml(item.entityType === "player" ? "Player" : item.entityType === "team" ? "Team" : "Participante")}</span></div>
      ${renderCompetitionMeta(item)}
      <div class="tournament-recognition-card__meta"><span>${rejected ? "Motivo" : approved ? "Otorgado" : "Estado"}</span><strong>${escapeHtml(rejected ? (item.reviewReason || "Sin motivo indicado") : approved ? formatDate(item.reviewedAt) : "Disponible para reclamar")}</strong></div>
      <div class="tournament-recognition-card__actions">
        ${approved ? `<span class="tournament-recognition-card__locked"><i class="fa-solid fa-lock"></i> RECONOCIMIENTO CERRADO</span>` : rejected ? `<span class="tournament-recognition-card__locked"><i class="fa-solid fa-clock-rotate-left"></i> HISTORIAL CONSERVADO</span>` : ""}
      </div>
    </article>`;
}
console("success")