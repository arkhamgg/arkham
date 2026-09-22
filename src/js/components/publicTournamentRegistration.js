// ========================================
// ARKHAM — Public Tournament Registration
// ========================================

import { uploadImage } from "../services/imagekit.js";
import { getCurrentSession, initializeSession } from "../services/session.js";
import { submitTournamentParticipationRequest } from "../services/tournamentRegistration.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function closeModal(modal) {
  if (modal?.parentNode) modal.remove();
}

export async function openPublicTournamentRegistration({ page, tournament, event, tournamentId, eventId }) {
  await initializeSession();
  const session = getCurrentSession();
  if (!session) throw new Error("Debes iniciar sesión para continuar.");

  const requirements = event?.registrationRequirements?.enabled
    ? (event.registrationRequirements.requirements || [])
    : [];
  const requiresProof = requirements.some((item) => item?.requiresProof === true);
  const profile = session.profile || {};
  const identityName = profile.entityId ? `${profile.entityType === "team" ? "TEAM" : "PLAYER"} · ${profile.entityId}` : "Cuenta ARKHAM";

  const modal = document.createElement("div");
  modal.className = "competition-public-registration-modal";
  modal.innerHTML = `
    <div class="competition-public-registration-modal__backdrop" data-registration-backdrop></div>
    <section class="competition-public-registration-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="public-registration-title">
      <button type="button" class="competition-public-registration-modal__close" data-registration-close aria-label="Cerrar">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>

      <span class="competition-public-registration-modal__eyebrow">ARKHAM // REGISTRATION</span>
      <h2 id="public-registration-title">SOLICITAR ASIENTO</h2>
      <p class="competition-public-registration-modal__event">${escapeHtml(event?.name || tournament?.name || "Competencia")}</p>

      <div class="competition-public-registration-modal__identity">
        <strong>${escapeHtml(identityName)}</strong>
        <span>${escapeHtml(session.user?.email || "Cuenta autenticada")}</span>
      </div>

      ${requirements.length ? `
        <div class="competition-public-registration-modal__section-label">REQUISITOS</div>
        <div class="competition-public-registration-modal__requirements">
          ${requirements.map((requirement) => `
            <article class="competition-public-registration-modal__requirement">
              <b>${escapeHtml(requirement.title || requirement.type || "Requisito")}</b>
              ${requirement.amount ? `<strong>Q${escapeHtml(Number(requirement.amount).toFixed(2))}</strong>` : ""}
              ${requirement.paymentInfo?.bank ? `<span>Banco: ${escapeHtml(requirement.paymentInfo.bank)}</span>` : ""}
              ${requirement.paymentInfo?.accountNumber ? `<span>Cuenta: ${escapeHtml(requirement.paymentInfo.accountNumber)}</span>` : ""}
              ${requirement.paymentInfo?.accountName ? `<span>Titular: ${escapeHtml(requirement.paymentInfo.accountName)}</span>` : ""}
              ${requirement.requiresProof ? `<small>Se requiere comprobante.</small>` : ""}
            </article>
          `).join("")}
        </div>
      ` : `
        <div class="competition-public-registration-modal__no-requirements">
          <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
          <div>
            <strong>INSCRIPCIÓN ABIERTA</strong>
            <span>No hay requisitos adicionales configurados por la organización.</span>
          </div>
        </div>
      `}

      ${requiresProof ? `
        <label class="competition-public-registration-modal__file">
          <strong>COMPROBANTE</strong>
          <span>Adjunta el comprobante solicitado por la organización.</span>
          <input type="file" accept="image/*,.pdf" data-registration-proof>
          <small>Formatos recomendados: JPG, PNG o PDF.</small>
        </label>
      ` : ""}

      <p class="competition-public-registration-modal__status" data-registration-status></p>
      <button type="button" class="competition-public-registration-modal__submit" data-registration-submit>
        <span>ENVIAR SOLICITUD</span>
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </button>
    </section>
  `;

  document.body.appendChild(modal);

  const close = () => closeModal(modal);
  modal.querySelector("[data-registration-close]")?.addEventListener("click", close);
  modal.querySelector("[data-registration-backdrop]")?.addEventListener("click", close);

  const status = modal.querySelector("[data-registration-status]");
  const submit = modal.querySelector("[data-registration-submit]");
  const proofInput = modal.querySelector("[data-registration-proof]");

  submit.addEventListener("click", async () => {
    try {
      submit.disabled = true;
      status.className = "competition-public-registration-modal__status";
      status.textContent = "Enviando solicitud...";

      let proof = null;
      const file = proofInput?.files?.[0] || null;
      if (requiresProof && !file) throw new Error("Debes adjuntar el comprobante requerido.");

      if (file) {
        const uploaded = await uploadImage(file, {
          folder: `/nexus/tournament-registration/${session.user.uid}/${tournamentId}/${eventId}`,
          fileName: file.name
        });
        proof = {
          url: uploaded?.url || null,
          fileId: uploaded?.fileId || null,
          name: file.name,
          type: file.type,
          size: file.size
        };
      }

      await submitTournamentParticipationRequest({ tournamentId, eventId, proof });

      status.className = "competition-public-registration-modal__status is-success";
      status.textContent = "Solicitud enviada. El organizador debe otorgarte un asiento.";
      page.dispatchEvent(new CustomEvent("arkham:registration-submitted", { detail: { tournamentId, eventId } }));

      window.setTimeout(close, 1200);
    } catch (error) {
      console.error("ARKHAM — Error enviando solicitud:", error);
      status.className = "competition-public-registration-modal__status is-error";
      status.textContent = error?.message || "No fue posible enviar la solicitud.";
      submit.disabled = false;
    }
  });

  return modal;
}
