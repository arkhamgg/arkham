// ========================================
// NEXUS — Public Tournament Registration
// ========================================

import { submitTournamentParticipationRequest } from "../services/tournamentRegistration.js";
import { uploadImage } from "../services/imagekit.js";
import { getCurrentSession, initializeSession } from "../services/session.js";

export function openPublicTournamentRegistration({
  page,
  tournament,
  event,
  tournamentId,
  eventId
}) {
  const existing = page.querySelector("[data-public-registration-modal]");
  if (existing) existing.remove();

  const requirements = event?.registrationRequirements;
  const enabledRequirements = requirements?.enabled && Array.isArray(requirements.requirements)
    ? requirements.requirements
    : [];
  const proofRequired = enabledRequirements.some((item) => item?.requiresProof === true);

  const modal = document.createElement("div");
  modal.className = "competition-public-registration-modal";
  modal.setAttribute("data-public-registration-modal", "");
  modal.innerHTML = `
    <div class="competition-public-registration-modal__backdrop" data-registration-backdrop></div>
    <section class="competition-public-registration-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="public-registration-title">
      <button type="button" class="competition-public-registration-modal__close" data-registration-close aria-label="Cerrar">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>

      <span class="competition-public-registration-modal__eyebrow">NEXUS // TOURNAMENT REGISTRATION</span>
      <h2 id="public-registration-title">SOLICITAR ASIENTO</h2>
      <p class="competition-public-registration-modal__event">${escapeHtml(tournament?.name || "COMPETENCIA NEXUS")}</p>

      <div class="competition-public-registration-modal__identity" data-registration-identity>
        Cargando cuenta NEXUS...
      </div>

      ${enabledRequirements.length ? `
        <div class="competition-public-registration-modal__requirements">
          <div class="competition-public-registration-modal__section-label">REQUISITOS DE INSCRIPCIÓN</div>
          ${enabledRequirements.map(renderRequirement).join("")}
          ${proofRequired ? `
            <label class="competition-public-registration-modal__file">
              <span>COMPROBANTE</span>
              <input type="file" accept="image/*,application/pdf" data-registration-proof ${proofRequired ? "required" : ""}>
              <small data-registration-proof-name>Selecciona el comprobante.</small>
            </label>
          ` : ""}
        </div>
      ` : `
        <div class="competition-public-registration-modal__no-requirements">
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
          <div>
            <strong>INSCRIPCIÓN ABIERTA</strong>
            <span>No hay requisitos adicionales configurados por la organización.</span>
          </div>
        </div>
      `}

      <p class="competition-public-registration-modal__status" data-registration-status aria-live="polite"></p>

      <button type="button" class="competition-public-registration-modal__submit" data-registration-submit>
        <span>ENVIAR SOLICITUD</span>
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </button>
    </section>
  `;

  page.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("[data-registration-close]")?.addEventListener("click", close);
  modal.querySelector("[data-registration-backdrop]")?.addEventListener("click", close);
  modal.addEventListener("keydown", (eventKey) => {
    if (eventKey.key === "Escape") close();
  });
  modal.tabIndex = -1;
  modal.focus();

  const identity = modal.querySelector("[data-registration-identity]");
  const status = modal.querySelector("[data-registration-status]");
  const submit = modal.querySelector("[data-registration-submit]");
  const proofInput = modal.querySelector("[data-registration-proof]");
  const proofName = modal.querySelector("[data-registration-proof-name]");

  initializeSession().then(() => {
    const session = getCurrentSession();
    const profile = session?.profile;
    if (!session?.user?.uid) {
      identity.innerHTML = `<strong>CUENTA REQUERIDA</strong><span>Debes iniciar sesión para solicitar un asiento.</span>`;
      submit.disabled = true;
      return;
    }

    identity.innerHTML = `<strong>${escapeHtml(profile?.entityType === "team" ? "EQUIPO NEXUS" : "PLAYER NEXUS")}</strong><span>${escapeHtml(profile?.entityId || session.user.email || session.user.uid)}</span>`;
  });

  proofInput?.addEventListener("change", () => {
    proofName.textContent = proofInput.files?.[0]?.name || "Selecciona el comprobante.";
  });

  submit.addEventListener("click", async () => {
    try {
      submit.disabled = true;
      status.textContent = "ENVIANDO SOLICITUD...";
      status.classList.remove("is-error", "is-success");

      await initializeSession();
      const session = getCurrentSession();
      if (!session?.user?.uid) {
        throw new Error("Debes iniciar sesión para solicitar un asiento.");
      }

      let proof = null;
      if (proofInput?.files?.[0]) {
        const file = proofInput.files[0];
        const uploaded = await uploadImage(file, {
          folder: `/nexus/tournament-registration/${session.user.uid}/${tournamentId}/${eventId}`
        });
        proof = {
          provider: uploaded.provider || "imagekit",
          fileId: uploaded.fileId || null,
          filePath: uploaded.filePath || null,
          url: uploaded.url || null,
          fileName: file.name,
          contentType: file.type || null
        };
      }

      await submitTournamentParticipationRequest({
        tournamentId,
        eventId,
        proof
      });

      status.textContent = "Solicitud enviada. El organizador debe otorgarte un asiento.";
      status.classList.add("is-success");
      submit.innerHTML = `<span>SOLICITUD ENVIADA</span><i class="fa-solid fa-check" aria-hidden="true"></i>`;
    } catch (error) {
      status.textContent = error.message || "No fue posible enviar la solicitud.";
      status.classList.add("is-error");
      submit.disabled = false;
    }
  });

  return modal;
}

function renderRequirement(requirement) {
  const amount = Number(requirement?.amount);
  const amountLabel = Number.isFinite(amount) && amount > 0 ? `Q${amount.toFixed(2)}` : "";
  const info = requirement?.paymentInfo || {};
  return `
    <article class="competition-public-registration-modal__requirement">
      <strong>${escapeHtml(requirement?.title || "Requisito")}</strong>
      ${amountLabel ? `<b>${escapeHtml(amountLabel)}</b>` : ""}
      ${info.bank ? `<span>Banco: ${escapeHtml(info.bank)}</span>` : ""}
      ${info.accountNumber ? `<span>Cuenta: ${escapeHtml(info.accountNumber)}</span>` : ""}
      ${info.accountName ? `<span>Titular: ${escapeHtml(info.accountName)}</span>` : ""}
      ${requirement?.requiresProof ? `<small>Comprobante requerido</small>` : ""}
    </article>
  `;
}

function escapeHtml(value = "") {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}
