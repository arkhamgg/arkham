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
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const eventId = params.get("eventId");

  page.innerHTML = `
    <section class="tournament-recognitions-page__container">
      <header class="tournament-recognitions-page__header">
        <div>
          <span class="tournament-recognitions-page__eyebrow">TOURNAMENT PRO // RECONOCIMIENTOS</span>
          <h1>Reconocimientos</h1>
          <p>Revisa las solicitudes de los participantes y valida únicamente los reconocimientos habilitados por el resultado oficial.</p>
        </div>
        <a href="${tournamentId && eventId ? `/dashboard/tournaments/pro?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}` : "/dashboard"}" class="tournament-recognitions-page__back">Volver al torneo</a>
      </header>
      <div data-recognition-content class="tournament-recognitions-page__content">
        <div class="tournament-recognitions-page__loading"><i class="fa-solid fa-spinner fa-spin"></i> Cargando reconocimientos...</div>
      </div>
    </section>`;

  if (!tournamentId || !eventId) {
    page.querySelector("[data-recognition-content]").innerHTML = `<div class="tournament-recognitions-page__empty"><strong>Competencia no identificada.</strong><span>Abre Reconocimientos desde un torneo específico.</span></div>`;
    return page;
  }

  load(page, tournamentId, eventId);
  return page;
}

async function load(page, tournamentId, eventId) {
  const content = page.querySelector("[data-recognition-content]");
  try {
    const response = await getTournamentRecognitionRequests({ tournamentId, eventId });
    render(page, tournamentId, eventId, response);
  } catch (error) {
    content.innerHTML = `<div class="tournament-recognitions-page__empty is-error"><strong>No fue posible cargar los reconocimientos.</strong><span>${escapeHtml(error?.message || "Intenta nuevamente.")}</span></div>`;
  }
}

function render(page, tournamentId, eventId, response) {
  const content = page.querySelector("[data-recognition-content]");
  const recognitions = Array.isArray(response?.recognitions) ? response.recognitions : [];
  const pending = recognitions.filter((item) => item.status === "requested");
  const history = recognitions.filter((item) => item.status !== "requested");

  content.innerHTML = `
    <section class="tournament-recognitions-page__summary">
      <div><span>COMPETENCIA</span><strong>${escapeHtml(response?.competition?.name || "Competencia NEXUS")}</strong></div>
      <div><span>ESTADO</span><strong>${escapeHtml(response?.competition?.status || "—")}</strong></div>
      <div><span>PENDIENTES</span><strong>${pending.length}</strong></div>
    </section>

    <section class="tournament-recognitions-page__section">
      <div class="tournament-recognitions-page__section-head">
        <div><span>01</span><h2>Pendientes</h2></div>
        <p>Solicitudes que requieren una decisión del organizador.</p>
      </div>
      <div class="tournament-recognitions-page__list">
        ${pending.length ? pending.map((item) => renderPending(item)).join("") : `<div class="tournament-recognitions-page__empty"><strong>No hay solicitudes pendientes.</strong><span>Cuando un participante reclame un reconocimiento aparecerá aquí.</span></div>`}
      </div>
    </section>

    <section class="tournament-recognitions-page__section">
      <div class="tournament-recognitions-page__section-head">
        <div><span>02</span><h2>Historial</h2></div>
        <p>El historial conserva aprobaciones, rechazos y nuevos intentos.</p>
      </div>
      <div class="tournament-recognitions-page__list">
        ${history.length ? history.map(renderHistory).join("") : `<div class="tournament-recognitions-page__empty"><strong>Sin movimientos todavía.</strong></div>`}
      </div>
    </section>`;

  page.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", async () => {
      const participantId = button.dataset.review;
      const approve = button.dataset.approve === "true";
      const reason = approve ? "" : window.prompt("Motivo del rechazo (opcional):", "") || "";
      if (!approve && reason === null) return;
      button.disabled = true;
      try {
        await reviewTournamentRecognition({ tournamentId, eventId, participantId, approve, reason });
        await load(page, tournamentId, eventId);
      } catch (error) {
        window.alert(error?.message || "No fue posible actualizar el reconocimiento.");
        button.disabled = false;
      }
    });
  });
}

function renderPending(item) {
  return `
    <article class="tournament-recognition-card tournament-recognition-card--pending">
      <div class="tournament-recognition-card__rank"><span>${escapeHtml(String(item.position))}.º</span><small>LUGAR</small></div>
      <div class="tournament-recognition-card__main"><span class="tournament-recognition-card__eyebrow">SOLICITUD DE RECONOCIMIENTO</span><h3>${escapeHtml(item.displayName)}</h3><span>${escapeHtml(item.entityType === "player" ? "Player" : item.entityType === "team" ? "Team" : "Participante")}</span></div>
      <div class="tournament-recognition-card__meta"><span>Solicitado</span><strong>${escapeHtml(formatDate(item.requestedAt))}</strong></div>
      <div class="tournament-recognition-card__actions"><button type="button" data-review="${escapeHtml(item.participantId)}" data-approve="false">Rechazar</button><button type="button" class="is-primary" data-review="${escapeHtml(item.participantId)}" data-approve="true">Otorgar reconocimiento</button></div>
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
      <div class="tournament-recognition-card__meta"><span>${rejected ? "Motivo" : approved ? "Otorgado" : "Estado"}</span><strong>${escapeHtml(rejected ? (item.reviewReason || "Sin motivo indicado") : approved ? formatDate(item.reviewedAt) : "Disponible para reclamar")}</strong></div>
    </article>`;
}
