// ========================================
// NEXUS — Public Tournament Bracket
// ========================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initials(name) {
  const parts = String(name || "Participante")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

function normalizeCapacity(capacity, slots) {
  const numeric = Number(capacity);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return slots;
}

function getParticipantName(pro, participantId) {
  if (!participantId) return "";
  return pro?.participants?.[participantId]?.displayName || participantId;
}

function getParticipantCount(pro) {
  const slots = Object.values(pro?.bracket?.slots || {});
  return slots.filter((slot) => Boolean(slot?.participantId)).length;
}

function renderSlot(pro, participantId, seed, winnerId) {
  if (!participantId) {
    return `
      <div class="public-bracket__slot public-bracket__slot--empty">
        <span class="public-bracket__seed">${escapeHtml(seed)}</span>
        <span class="public-bracket__avatar">+</span>
        <span class="public-bracket__slot-name">POR ASIGNAR</span>
      </div>
    `;
  }

  const name = getParticipantName(pro, participantId);
  const isWinner = winnerId === participantId;

  return `
    <div class="public-bracket__slot ${isWinner ? "public-bracket__slot--winner" : ""}">
      <span class="public-bracket__seed">${escapeHtml(seed)}</span>
      <span class="public-bracket__avatar">${escapeHtml(initials(name))}</span>
      <span class="public-bracket__slot-name">${escapeHtml(name)}</span>
      ${isWinner ? '<i class="fa-solid fa-crown" aria-hidden="true"></i>' : ""}
    </div>
  `;
}

function renderMatch(pro, match) {
  const a = match?.participantAId || null;
  const b = match?.participantBId || null;
  const winner = match?.winnerId || null;

  return `
    <article class="public-bracket__match public-bracket__match--${escapeHtml(match?.status || "pending")}">
      <div class="public-bracket__match-code">
        ${escapeHtml(match?.id || "MATCH")}
      </div>
      ${renderSlot(pro, a, "A", winner)}
      ${renderSlot(pro, b, "B", winner)}
    </article>
  `;
}

function renderStage(pro, stage, index) {
  const matches = Array.isArray(stage?.matches) ? stage.matches : [];

  return `
    <div class="public-bracket__stage">
      <div class="public-bracket__stage-header">
        <span>R${index + 1}</span>
        <strong>${escapeHtml(stage?.bracket === "losers" ? "LOSERS" : stage?.bracket === "grand_final" ? "GRAND FINAL" : stage?.number === 1 ? "PRIMERA RONDA" : `RONDA ${stage?.number || index + 1}`)}</strong>
      </div>
      <div class="public-bracket__stage-matches">
        ${matches.map((match) => renderMatch(pro, match)).join("")}
      </div>
    </div>
  `;
}

export function getPublicTournamentBracketMarkup(event = {}, registrationState = null) {
  const pro = event?.pro;

  // event.pro is the public projection of the Pro operational state.
  // Free events do not receive this block from the Builder.
  if (!pro || typeof pro !== "object") return "";

  const bracket = pro.bracket || {};
  const slots = Object.values(bracket.slots || {});
  const capacity = normalizeCapacity(event.capacity, slots.length || 0);
  const count = getParticipantCount(pro);
  const generated = bracket.generated === true;
  const requestStatus = registrationState?.request?.status || null;
  const rejectionReason = registrationState?.request?.rejectionReason || null;
  const recognition = registrationState?.recognition || null;
  const isFinished = pro.status === "finished";
  const recognitionEligible = Boolean(isFinished && recognition?.eligible);
  const recognitionStatus = recognition?.status || "not_requested";
  const canShowRegistration = registrationState?.canRegister !== false && !isFinished;
  const stages = Array.isArray(bracket.stages) ? bracket.stages : [];

  if (!generated) {
    return `
      <section class="competition-landing__pro-bracket" data-public-bracket>
        <div class="public-bracket__container">
          <header class="public-bracket__header">
            <div>
              <span class="public-bracket__eyebrow">NEXUS // TOURNAMENT PRO</span>
              <h2>COMPETIDORES</h2>
              <p>La competencia todavía no ha generado su bracket.</p>
            </div>
            <div class="public-bracket__counter-wrap">
            <div class="public-bracket__counter-label">
              <span>INSCRITOS</span>
              <strong class="public-bracket__counter">${count}/${escapeHtml(capacity)}</strong>
            </div>
            ${recognitionEligible ? `
              <button type="button" class="public-bracket__registration-button public-bracket__registration-button--${escapeHtml(recognitionStatus)}" data-recognition-cta ${recognitionStatus === "requested" || recognitionStatus === "approved" ? "disabled" : ""}>
                <span>${escapeHtml(recognitionStatus === "requested" ? "RECONOCIMIENTO EN REVISIÓN" : recognitionStatus === "approved" ? "RECONOCIMIENTO APROBADO" : recognitionStatus === "rejected" ? "VOLVER A RECLAMAR" : "RECLAMAR RECONOCIMIENTO")}</span>
                <i class="fa-solid ${recognitionStatus === "approved" ? "fa-check" : recognitionStatus === "requested" ? "fa-hourglass-half" : recognitionStatus === "rejected" ? "fa-rotate-right" : "fa-award"}" aria-hidden="true"></i>
              </button>
            ` : canShowRegistration ? `
              <button type="button" class="public-bracket__registration-button public-bracket__registration-button--${escapeHtml(requestStatus || "available")}" data-registration-cta>
                <span>${escapeHtml(requestStatus === "pending" ? "SOLICITUD EN REVISIÓN" : requestStatus === "approved" ? "ASIENTO CONFIRMADO" : requestStatus === "rejected" ? "VOLVER A INTENTAR" : "SOLICITAR ASIENTO")}</span>
                <i class="fa-solid ${requestStatus === "approved" ? "fa-check" : requestStatus === "pending" ? "fa-hourglass-half" : requestStatus === "rejected" ? "fa-rotate-right" : "fa-arrow-right"}" aria-hidden="true"></i>
              </button>
            ` : ""}
          </div>
          </header>
        </div>
      </section>
    `;
  }

  return `
    <section class="competition-landing__pro-bracket" data-public-bracket>
      <div class="public-bracket__container">
        <header class="public-bracket__header">
          <div>
            <span class="public-bracket__eyebrow">NEXUS // TOURNAMENT PRO</span>
            <h2>BRACKET</h2>
            <p>Los competidores se incorporan al cuadro conforme el organizador los asigna.</p>
          </div>
          <div class="public-bracket__counter-wrap">
            <div class="public-bracket__counter-label">
              <span>INSCRITOS</span>
              <strong class="public-bracket__counter">${count}/${escapeHtml(capacity)}</strong>
            </div>
            ${recognitionEligible ? `
              <button type="button" class="public-bracket__registration-button public-bracket__registration-button--${escapeHtml(recognitionStatus)}" data-recognition-cta ${recognitionStatus === "requested" || recognitionStatus === "approved" ? "disabled" : ""}>
                <span>${escapeHtml(recognitionStatus === "requested" ? "RECONOCIMIENTO EN REVISIÓN" : recognitionStatus === "approved" ? "RECONOCIMIENTO APROBADO" : recognitionStatus === "rejected" ? "VOLVER A RECLAMAR" : "RECLAMAR RECONOCIMIENTO")}</span>
                <i class="fa-solid ${recognitionStatus === "approved" ? "fa-check" : recognitionStatus === "requested" ? "fa-hourglass-half" : recognitionStatus === "rejected" ? "fa-rotate-right" : "fa-award"}" aria-hidden="true"></i>
              </button>
            ` : canShowRegistration ? `
              <button type="button" class="public-bracket__registration-button public-bracket__registration-button--${escapeHtml(requestStatus || "available")}" data-registration-cta>
                <span>${escapeHtml(requestStatus === "pending" ? "SOLICITUD EN REVISIÓN" : requestStatus === "approved" ? "ASIENTO CONFIRMADO" : requestStatus === "rejected" ? "VOLVER A INTENTAR" : "SOLICITAR ASIENTO")}</span>
                <i class="fa-solid ${requestStatus === "approved" ? "fa-check" : requestStatus === "pending" ? "fa-hourglass-half" : requestStatus === "rejected" ? "fa-rotate-right" : "fa-arrow-right"}" aria-hidden="true"></i>
              </button>
            ` : ""}
          </div>
        </header>

        <div class="public-bracket__board" role="region" aria-label="Bracket del torneo">
          ${stages.map((stage, index) => renderStage(pro, stage, index)).join("")}
        </div>
      </div>
    </section>
  `;
}

export function updatePublicTournamentBracket(page, event = {}, registrationState = null) {
  const mount = page?.querySelector("[data-public-bracket-mount]");
  if (!mount) return;

  mount.innerHTML = getPublicTournamentBracketMarkup(event, registrationState);
}
