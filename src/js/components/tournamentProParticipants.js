import { getTournamentRegistrationRequestsMarkup } from "./tournamentRegistrationRequests.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
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
  capacityValue = Number(capacity || 0),
  present = 0,
  assigned = 0,
  pendingCheckIn = 0,
  noShows = 0,
  checkInOpen = false,
  eventLive = false,
  eventFinished = false
} = {}) {
  const participantListMarkup = `
    <section class="tournament-pro-page__checkin-panel tournament-pro-page__checkin-panel--participants participants-workspace__panel">
      <div class="tournament-pro-page__checkin-panel-header participants-workspace__panel-header">
        <div>
          <span class="tournament-pro-page__eyebrow">PARTICIPANTES</span>
          <h3>Participantes registrados</h3>
        </div>
        <div class="tournament-pro-page__checkin-panel-actions participants-workspace__panel-actions">
          <div class="tournament-pro-page__checkin-metrics">
            <strong>${registered} / ${escapeHtml(capacity)}</strong><span>registrados</span>
          </div>
          <button type="button" class="tournament-pro-page__primary-action tournament-pro-page__participant-add-action" data-late-add ${canAddParticipant ? "" : "disabled"}>
            <i class="fa-solid fa-user-plus" aria-hidden="true"></i> Agregar participante
          </button>
        </div>
      </div>
      <div class="tournament-pro-page__participant-list participants-workspace__list">
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
        }).join("") || `<div class="tournament-pro-page__empty">Todavía no hay participantes registrados.</div>`}
      </div>
    </section>
  `;

  const requestsMarkup = `
    <section class="tournament-pro-page__checkin-panel tournament-pro-page__checkin-panel--requests participants-workspace__panel">
      <div class="tournament-pro-page__checkin-panel-header participants-workspace__panel-header">
        <div>
          <span class="tournament-pro-page__eyebrow">SOLICITUDES</span>
          <h3>Solicitudes de inscripción</h3>
        </div>
        <span class="tournament-pro-page__checkin-panel-count">${registrationCount} pendientes</span>
      </div>
      ${getTournamentRegistrationRequestsMarkup(registrationRequests, registrationRequestsError)}
    </section>
  `;

  const preparationMarkup = `
    <div class="tournament-pro-page__checkin-preparation-grid participants-workspace">
      ${requestsMarkup}
      ${participantListMarkup}
    </div>
    <div class="tournament-pro-page__checkin-next-step participants-workspace__next-step">
      <div>
        <span class="tournament-pro-page__eyebrow">ESTADO DE PARTICIPANTES</span>
        <strong>${participantsComplete ? "Participantes listos" : registered >= capacityValue ? "Participantes registrados" : `Faltan ${Math.max(capacityValue - registered, 0)} participantes`}</strong>
      </div>
      <span class="participants-workspace__status-detail">${placementComplete ? "Colocación completada" : "La colocación se gestiona desde Configuración"}</span>
    </div>
  `;

  const checkInListMarkup = `
          <section class="tournament-pro-page__checkin-panel tournament-pro-page__checkin-panel--attendance">
            <div class="tournament-pro-page__checkin-panel-header">
              <div>
                <span class="tournament-pro-page__eyebrow">PASO 2 · CHECK-IN</span>
                <h3>Confirma la asistencia</h3>
                <p>Marca quién llegó, libera el asiento de quien no asistió o reemplázalo antes de iniciar el torneo.</p>
              </div>
              <div class="tournament-pro-page__checkin-metrics">
                <strong>${present} / ${assigned}</strong><span>presentes</span>
              </div>
            </div>
            <div class="tournament-pro-page__checkin-summary">
              <span>${present} presentes</span>
              <span>${pendingCheckIn} pendientes</span>
              <span>${noShows} asientos liberados</span>
            </div>
            <div class="tournament-pro-page__participant-list">
              ${participants.map((participant) => {
                const isPresent = participant.checkIn === true;
                const isNoShow = participant.status === "no_show";
                const isReplaced = participant.status === "withdrawn" && Boolean(participant.replacedByParticipantId);
                const canChange = checkInOpen && !eventLive && !eventFinished && !isReplaced;
                return `
                  <article class="tournament-pro-page__participant ${isReplaced ? "is-replaced" : isPresent ? "is-present" : isNoShow ? "is-no-show" : ""}">
                    <div class="tournament-pro-page__participant-main">
                      <strong>${escapeHtml(participant.displayName || participant.id)}</strong>
                      <span>${escapeHtml(participant.entityId || (participant.manual ? "Participante manual" : "Player/Team ARKHAM"))}</span>
                    </div>
                    <div class="tournament-pro-page__inline-actions tournament-pro-page__checkin-actions">
                      ${isReplaced
                        ? `<span class="tournament-pro-page__checkin-replaced-label">Reemplazado · bloqueado</span>`
                        : [
                            canChange && !isPresent
                              ? `<button type="button" class="tournament-pro-page__checkin-choice tournament-pro-page__checkin-choice--present" data-present="${escapeAttr(participant.id)}">Presente</button>`
                              : "",
                            canChange
                              ? `<button type="button" class="tournament-pro-page__checkin-choice tournament-pro-page__checkin-choice--release ${isNoShow ? "is-released" : ""}" data-noshow="${escapeAttr(participant.id)}" ${isNoShow ? "disabled" : ""}>${isNoShow ? "No asistió · asiento libre" : "Liberar asiento"}</button>`
                              : "",
                            canChange
                              ? `<button type="button" class="tournament-pro-page__checkin-choice tournament-pro-page__checkin-choice--replace" data-replace="${escapeAttr(participant.id)}">Reemplazar</button>`
                              : ""
                          ].join("")}
                    </div>
                  </article>
                `;
              }).join("") || `<div class="tournament-pro-page__empty">No hay participantes asignados.</div>`}
            </div>
            ${checkInOpen ? `
              <div class="tournament-pro-page__checkin-panel-footer">
                <div><strong>${pendingCheckIn === 0 ? "Todos respondieron" : `${pendingCheckIn} pendientes`}</strong><span>Cuando termines de revisar la asistencia, finaliza el check-in para habilitar el inicio del torneo.</span></div>
                <button type="button" class="tournament-pro-page__primary-action" data-action="complete-checkin" ${present >= 2 ? "" : "disabled"}><i class="fa-solid fa-check" aria-hidden="true"></i> Finalizar check-in</button>
              </div>
            ` : `
              <div class="tournament-pro-page__checkin-panel-footer">
                <div><strong>Check-in completado</strong><span>${present} presentes · ${noShows} asientos liberados.</span></div>
              </div>
            `}
          </section>
        `;

  return { participantListMarkup, requestsMarkup, preparationMarkup, checkInListMarkup };
}
