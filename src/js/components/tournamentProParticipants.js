import { getTournamentRegistrationRequestsMarkup } from "./tournamentRegistrationRequests.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Renders the participant-registration workspace presentation.
 * Business rules, persistence, and event handlers remain in the orchestrator/services.
 */
export function renderTournamentProParticipants({
  participants = [],
  capacity = "—",
  canAddParticipant = false,
  declaredStructureSlots = [],
  declaredAssignedParticipantIds = new Set(),
  legacySlots = [],
  registrationRequests = [],
  registrationRequestsError = "",
  registrationCount = registrationRequests.length,
  participantsComplete = false,
  registered = 0,
  placementComplete = false,
  capacityValue = Number(capacity || 0)
} = {}) {
  const participantListMarkup = `
    <section class="tournament-pro-page__checkin-panel tournament-pro-page__checkin-panel--participants">
      <div class="tournament-pro-page__checkin-panel-header">
        <div>
          <span class="tournament-pro-page__eyebrow">PASO 1 · PARTICIPANTES</span>
          <h3>Completa los asientos</h3>
          <p>Define quién participa. Si la estructura ya está preparada, ARKHAM puede colocar automáticamente los participantes en la primera estructura disponible.</p>
        </div>
        <div class="tournament-pro-page__checkin-panel-actions">
          <div class="tournament-pro-page__checkin-metrics">
            <strong>${registered} / ${escapeHtml(capacity)}</strong><span>participantes registrados</span>
          </div>
          <button type="button" class="tournament-pro-page__primary-action tournament-pro-page__participant-add-action" data-late-add ${canAddParticipant ? "" : "disabled"}>
            <i class="fa-solid fa-user-plus" aria-hidden="true"></i> Agregar participante
          </button>
        </div>
      </div>
      <div class="tournament-pro-page__participant-list">
        ${participants.map((participant) => {
          const slot = declaredStructureSlots.find((item) => item?.participantId === participant.id)
            || legacySlots.find((item) => item?.participantId === participant.id);
          return `
            <article class="tournament-pro-page__participant">
              <div class="tournament-pro-page__participant-main">
                <strong>${escapeHtml(participant.displayName || participant.id)}</strong>
                <span>${escapeHtml(participant.entityId || (participant.manual ? "Participante manual" : "Player/Team ARKHAM"))}${slot ? ` · ${slot.seed != null ? `Seed ${escapeHtml(String(slot.seed))}` : `Posición ${escapeHtml(String(slot.position || "—"))}`}` : ""}</span>
              </div>
              <div class="tournament-pro-page__participant-status">
                <span class="tournament-pro-page__registration-badge">${declaredAssignedParticipantIds.has(participant.id) || legacySlots.some((item) => item?.participantId === participant.id) ? "Asignado" : "Registrado"}</span>
              </div>
            </article>
          `;
        }).join("") || `<div class="tournament-pro-page__empty">Todavía no hay participantes asignados.</div>`}
      </div>
    </section>
  `;

  const requestsMarkup = `
    <section class="tournament-pro-page__checkin-panel tournament-pro-page__checkin-panel--requests">
      <div class="tournament-pro-page__checkin-panel-header">
        <div>
          <span class="tournament-pro-page__eyebrow">PASO 1 · SOLICITUDES</span>
          <h3>Solicitudes de inscripción</h3>
          <p>Acepta las solicitudes que quieras convertir en participantes. También puedes agregar participantes manualmente.</p>
        </div>
        <span class="tournament-pro-page__checkin-panel-count">${registrationCount} pendientes</span>
      </div>
      ${getTournamentRegistrationRequestsMarkup(registrationRequests, registrationRequestsError)}
    </section>
  `;

  const preparationMarkup = `
    <div class="tournament-pro-page__checkin-preparation-grid">
      ${requestsMarkup}
      ${participantListMarkup}
    </div>
    <div class="tournament-pro-page__checkin-next-step">
      <div>
        <span class="tournament-pro-page__eyebrow">SIGUIENTE PASO</span>
        <strong>${participantsComplete ? "Participantes y estructura listos" : registered >= capacityValue ? "Falta completar la colocación en la estructura" : `Faltan ${Math.max(capacityValue - registered, 0)} participantes por registrar`}</strong>
        <p>${participantsComplete ? "La competencia ya tiene la lista completa y los participantes están colocados en la estructura operativa." : "Puedes seguir registrando participantes y volver a Configuración cuando quieras preparar o ajustar la estructura."}</p>
      </div>
      <button type="button" data-workspace-view="configuration">
        <i class="fa-solid fa-code-branch" aria-hidden="true"></i> Abrir configuración
      </button>
    </div>
  `;

  return { participantListMarkup, requestsMarkup, preparationMarkup };
}
