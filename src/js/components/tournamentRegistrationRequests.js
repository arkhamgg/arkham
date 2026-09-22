// ========================================
// ARKHAM — Tournament Registration Requests
// ========================================

import { getTournamentRegistrationRequests } from "../services/tournamentRegistration.js";
import { approveParticipationRequest } from "../services/tournamentProOperations.js";
import { ensureTournamentProState } from "../services/tournamentPro.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusLabel(status) {
  return ({ pending: "EN REVISIÓN", approved: "ASIENTO OTORGADO", rejected: "RECHAZADA" })[status] || String(status || "—").toUpperCase();
}

export function getTournamentRegistrationRequestsMarkup(requests = [], loadError = "") {
  const pending = requests.filter((request) => request.status === "pending");
  return `
    <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__registration-card">
      <div class="tournament-pro-page__section-heading">
        <div>
          <span class="tournament-pro-page__eyebrow">INSCRIPCIONES</span>
          <h2>Solicitudes de participación</h2>
        </div>
        <span class="tournament-pro-page__registration-badge ${pending.length ? "is-alert" : ""}">${pending.length} pendientes</span>
      </div>
      <p class="tournament-pro-page__helper">Revisa las solicitudes, valida los requisitos y otorga el asiento para incorporarlo al bracket.</p>
      ${loadError ? `
        <div class="tournament-pro-page__registration-error" role="alert">
          <strong>No fue posible cargar las solicitudes.</strong>
          <span>${escapeHtml(loadError)}</span>
        </div>
      ` : ""}
      <div class="tournament-pro-page__registration-list" data-registration-request-list>
        ${requests.length ? requests.map((request) => `
          <article class="tournament-pro-page__registration-request" data-request-row="${escapeHtml(request.id)}">
            <div class="tournament-pro-page__registration-request-main">
              <strong>${escapeHtml(request.displayName || request.entityId || "Participante")}</strong>
              <span>${escapeHtml(request.entityType === "team" ? "Team" : "Player")} · ${escapeHtml(request.entityId || "Manual")}</span>
              <small>${statusLabel(request.status)}</small>
              ${request.rejectionReason ? `<em>Motivo: ${escapeHtml(request.rejectionReason)}</em>` : ""}
            </div>
            <div class="tournament-pro-page__registration-request-actions">
              ${request.proof?.url ? `<a href="${escapeHtml(request.proof.url)}" target="_blank" rel="noopener noreferrer">Ver comprobante</a>` : ""}
              ${request.status === "pending" ? `
                <button type="button" data-request-action="reject" data-request-id="${escapeHtml(request.id)}">Rechazar</button>
                <button type="button" class="is-primary" data-request-action="approve" data-request-id="${escapeHtml(request.id)}">Otorgar asiento</button>
              ` : ""}
            </div>
          </article>
        `).join("") : `
          <div class="tournament-pro-page__registration-empty">
            <i class="fa-regular fa-circle-check" aria-hidden="true"></i>
            <span>No hay solicitudes de participación.</span>
          </div>
        `}
      </div>
      <p class="tournament-pro-page__registration-status" data-registration-request-status aria-live="polite"></p>
    </section>
  `;
}

export async function loadTournamentRegistrationRequests({ tournamentId, eventId }) {
  const response = await getTournamentRegistrationRequests({ tournamentId, eventId });
  return response?.requests || [];
}

export function bindTournamentRegistrationRequests({ page, tournamentId, eventId, getEvent, onChanged }) {
  page.querySelectorAll("[data-request-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const requestId = button.dataset.requestId;
      const action = button.dataset.requestAction;
      const status = page.querySelector("[data-registration-request-status]");
      const event = getEvent();
      if (!requestId || !event) return;

      try {
        button.disabled = true;
        status.textContent = action === "approve" ? "Otorgando asiento..." : "Registrando rechazo...";

        let rejectionReason = "";
        if (action === "reject") {
          rejectionReason = window.prompt("Motivo del rechazo:")?.trim() || "";
          if (!rejectionReason) {
            button.disabled = false;
            status.textContent = "El rechazo requiere un motivo.";
            return;
          }
        }

        await approveParticipationRequest({
          tournamentId,
          eventId,
          event,
          requestId,
          approve: action === "approve",
          rejectionReason
        });

        status.textContent = action === "approve" ? "Asiento otorgado y bracket actualizado." : "Solicitud rechazada.";
        if (onChanged) await onChanged();
      } catch (error) {
        button.disabled = false;
        status.textContent = error?.message || "No fue posible actualizar la solicitud.";
      }
    });
  });
}
