import { getCurrentAccountContext } from "../services/account.js";
import { getCurrentEntityContext } from "../services/entityContext.js";
import { createSubscriptionAccess } from "../services/planService.js";
import { hasEffectiveSubscriptionAccess } from "../services/subscription.js";
import {
  getTournamentProEvent,
  searchTournamentEntities,
  addParticipant,
  updateParticipantStatus,
  setParticipantCheckIn,
  setCheckInOpen,
  completeCheckIn,
  generateBracket,
  setEventStatus,
  startMatch,
  completeMatch,
  approveParticipationRequest,
  requestRecognition,
  reviewRecognition
} from "../services/tournamentProOperations.js";
import { ensureTournamentProState, PARTICIPANT_STATUS, TOURNAMENT_EVENT_STATUS } from "../services/tournamentPro.js";

export async function TournamentPro() {
  const page = document.createElement("main");
  page.className = "tournament-pro-page";
  page.innerHTML = `
    <div class="tournament-pro-page__container">
      <header>
        <span> NEXUS // TOURNAMENT PRO </span>
        <h1>CONTROL DE COMPETENCIA</h1>
        <p data-pro-message>Cargando…</p>
      </header>
      <div class="tournament-pro-page__grid" data-pro-content></div>
    </div>
  `;

  const message = page.querySelector("[data-pro-message]");
  const content = page.querySelector("[data-pro-content]");
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const eventId = params.get("eventId");

  if (!tournamentId || !eventId) {
    message.textContent = "Falta tournamentId o eventId.";
    return page;
  }

  try {
    const account = await getCurrentAccountContext();
    const entity = await getCurrentEntityContext();
    if (!hasEffectiveSubscriptionAccess(account?.subscription) || entity?.productId !== "tournament") {
      message.textContent = "Tournament Pro no está disponible para esta cuenta en este momento.";
      return page;
    }
    const access = createSubscriptionAccess(account.subscription, "tournament");
    if (!access.hasCapability("tournament_control")) {
      message.textContent = "La cuenta no tiene la capacidad de control de torneo.";
      return page;
    }

    let event = await getTournamentProEvent(tournamentId, eventId);
    if (!event) throw new Error("Evento no encontrado.");
    let pro = ensureTournamentProState(event);

    const refresh = async () => {
      event = await getTournamentProEvent(tournamentId, eventId);
      pro = ensureTournamentProState(event || {});
      render();
    };

    const render = () => {
      const participants = Object.values(pro.participants || {});
      const matches = pro.bracket?.stages?.flatMap((stage) => stage.matches || []) || [];
      const requests = Object.entries(pro.registration?.requests || {});
      const recognition = Object.entries(pro.recognition?.requests || {});
      const present = participants.filter((participant) => participant.checkIn === true).length;
      const noShows = participants.filter((participant) => participant.status === PARTICIPANT_STATUS.NO_SHOW).length;
      const pending = matches.filter((match) => match.status === "pending").length;
      const live = matches.filter((match) => match.status === "live").length;
      const completed = matches.filter((match) => match.status === "completed").length;
      const nameFor = (id) => id ? pro.participants?.[id]?.displayName || id : "BYE";

      content.innerHTML = `
        <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__card--control">
          <div class="tournament-pro-page__section-heading">
            <div><span class="tournament-pro-page__eyebrow">OPERACIÓN</span><h2>Control del evento</h2></div>
            <span class="tournament-pro-page__status">${escapeHtml(pro.status)}</span>
          </div>
          <div class="tournament-pro-page__actions">
            <button data-action="publish">Publicar</button>
            <button data-action="generate" ${pro.status === TOURNAMENT_EVENT_STATUS.LIVE || pro.status === TOURNAMENT_EVENT_STATUS.FINISHED ? "disabled" : ""}>Generar bracket</button>
            <button data-action="open-checkin" ${!pro.bracket?.generated || pro.checkIn?.opened ? "disabled" : ""}>Abrir check-in</button>
            <button data-action="complete-checkin" ${!pro.checkIn?.opened || pro.checkIn?.completed ? "disabled" : ""}>Cerrar check-in</button>
            <button data-action="live" ${!pro.checkIn?.completed || pro.status === TOURNAMENT_EVENT_STATUS.LIVE ? "disabled" : ""}>Iniciar evento</button>
            <button data-action="finish" ${!pro.bracket?.championId || pro.status !== TOURNAMENT_EVENT_STATUS.LIVE ? "disabled" : ""}>Finalizar</button>
          </div>
          <div class="tournament-pro-page__stats">
            <div><strong>${participants.length}</strong><span>Participantes</span></div>
            <div><strong>${present}</strong><span>Presentes</span></div>
            <div><strong>${noShows}</strong><span>No-show</span></div>
            <div><strong>${pending}</strong><span>Pendientes</span></div>
            <div><strong>${live}</strong><span>En vivo</span></div>
            <div><strong>${completed}</strong><span>Completados</span></div>
          </div>
        </section>

        <section class="tournament-pro-page__card">
          <div class="tournament-pro-page__section-heading"><div><span class="tournament-pro-page__eyebrow">CHECK-IN</span><h2>Asistencia</h2></div><span>${escapeHtml(pro.checkIn?.status || "unopened")}</span></div>
          <div class="tournament-pro-page__participant-list">
            ${participants.map((participant) => `
              <div class="tournament-pro-page__participant ${participant.checkIn ? "is-present" : ""}">
                <div><strong>${escapeHtml(participant.displayName)}</strong><span>${escapeHtml(participant.status)}${participant.seed ? ` · Seed ${participant.seed}` : ""}</span></div>
                <div class="tournament-pro-page__inline-actions">
                  ${pro.checkIn?.opened && participant.status !== "no_show" && participant.status !== "rejected" && participant.status !== "withdrawn" && !participant.checkIn ? `<button data-present="${escapeAttr(participant.id)}">Presente</button>` : ""}
                  ${pro.checkIn?.opened && participant.checkIn ? `<button data-noshow="${escapeAttr(participant.id)}">No show</button>` : ""}
                  ${participant.status === "no_show" ? `<button data-reactivate="${escapeAttr(participant.id)}">Reactivar</button>` : ""}
                </div>
              </div>
            `).join("") || "Sin participantes"}
          </div>
        </section>

        <section class="tournament-pro-page__card">
          <div class="tournament-pro-page__section-heading"><div><span class="tournament-pro-page__eyebrow">REGISTRO</span><h2>Participantes</h2></div></div>
          <form data-search-form>
            <div class="tournament-pro-page__search-row">
              <input name="term" placeholder="Nombre, gamertag o ID" required>
              <select name="type"><option value="player">Player</option><option value="team">Team</option></select>
              <button>Buscar</button>
            </div>
          </form>
          <div class="tournament-pro-page__search-results" data-search-results></div>
          <button data-action="manual-add">+ Participante manual</button>
        </section>

        <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__bracket-card">
          <div class="tournament-pro-page__section-heading"><div><span class="tournament-pro-page__eyebrow">MATCH ENGINE</span><h2>Bracket en vivo</h2></div>${pro.bracket?.championId ? `<strong>CAMPEÓN · ${escapeHtml(nameFor(pro.bracket.championId))}</strong>` : ""}</div>
          ${pro.bracket?.generated ? `
            <div class="tournament-pro-page__bracket">
              ${(pro.bracket.stages || []).map((stage) => `
                <div class="tournament-pro-page__stage">
                  <div class="tournament-pro-page__stage-title">${escapeHtml(stage.bracket === "grand_final" ? "GRAND FINAL" : `${stage.bracket === "losers" ? "LOSERS" : "WINNERS"} · RONDA ${stage.number}`)}</div>
                  ${(stage.matches || []).map((match) => {
                    const canStart = pro.status === TOURNAMENT_EVENT_STATUS.LIVE && match.status === "pending" && match.participantAId && match.participantBId;
                    const canResult = pro.status === TOURNAMENT_EVENT_STATUS.LIVE && match.status === "live";
                    return `<article class="tournament-pro-page__match tournament-pro-page__match--${escapeAttr(match.status)}">
                      <div class="tournament-pro-page__match-top"><span>${escapeHtml(match.id)}</span><span>${escapeHtml(match.status)}</span></div>
                      <div class="tournament-pro-page__match-player"><span>${escapeHtml(nameFor(match.participantAId))}</span>${canResult ? `<button data-winner="${escapeAttr(match.participantAId)}" data-match="${escapeAttr(match.id)}">GANÓ</button>` : ""}</div>
                      <div class="tournament-pro-page__match-player"><span>${escapeHtml(nameFor(match.participantBId))}</span>${canResult ? `<button data-winner="${escapeAttr(match.participantBId)}" data-match="${escapeAttr(match.id)}">GANÓ</button>` : ""}</div>
                      ${match.score ? `<div class="tournament-pro-page__score">${escapeHtml(formatScore(match.score))}</div>` : ""}
                      ${match.status === "bye" ? `<div class="tournament-pro-page__match-note">BYE · avance automático</div>` : ""}
                      ${canStart ? `<button data-start-match="${escapeAttr(match.id)}">Iniciar match</button>` : ""}
                      ${canResult ? `<div class="tournament-pro-page__score-inputs"><input type="number" min="0" placeholder="A" data-score-a="${escapeAttr(match.id)}"><input type="number" min="0" placeholder="B" data-score-b="${escapeAttr(match.id)}"></div>` : ""}
                    </article>`;
                  }).join("")}
                </div>
              `).join("")}
            </div>
          ` : `<div class="tournament-pro-page__empty">Genera el bracket para comenzar.</div>`}
        </section>

        <section class="tournament-pro-page__card">
          <div class="tournament-pro-page__section-heading"><div><span class="tournament-pro-page__eyebrow">SOLICITUDES</span><h2>Participación</h2></div></div>
          ${requests.map(([id, request]) => `<div class="tournament-pro-page__request"><div><strong>${escapeHtml(request.displayName || id)}</strong><span>${escapeHtml(request.status)}</span></div>${request.status === "pending" ? `<div class="tournament-pro-page__inline-actions"><button data-approve="${escapeAttr(id)}">Aceptar</button><button data-reject="${escapeAttr(id)}">Rechazar</button></div>` : ""}</div>`).join("") || "Sin solicitudes"}
        </section>

        <section class="tournament-pro-page__card">
          <div class="tournament-pro-page__section-heading"><div><span class="tournament-pro-page__eyebrow">RECONOCIMIENTO</span><h2>Solicitudes</h2></div></div>
          ${recognition.map(([id, request]) => `<div class="tournament-pro-page__request"><div><strong>${escapeHtml(nameFor(id))}</strong><span>${escapeHtml(request.status)}</span></div>${request.status === "requested" ? `<div class="tournament-pro-page__inline-actions"><button data-rec-approve="${escapeAttr(id)}">Aprobar</button><button data-rec-reject="${escapeAttr(id)}">Rechazar</button></div>` : ""}</div>`).join("") || "Sin solicitudes"}
        </section>
      `;
      bind();
    };

    const bind = () => {
      page.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
        const action = button.dataset.action;
        if (action === "generate") return run(() => generateBracket({ tournamentId, eventId, event }));
        if (action === "open-checkin") return run(() => setCheckInOpen({ tournamentId, eventId, event, open: true }));
        if (action === "complete-checkin") return run(() => completeCheckIn({ tournamentId, eventId, event }));
        if (action === "manual-add") {
          const displayName = window.prompt("Nombre del participante manual:");
          if (displayName?.trim()) return run(() => addParticipant({ tournamentId, eventId, event, entityType: "manual", displayName: displayName.trim(), manual: true }));
          return;
        }
        const status = { publish: TOURNAMENT_EVENT_STATUS.PUBLISHED, live: TOURNAMENT_EVENT_STATUS.LIVE, finish: TOURNAMENT_EVENT_STATUS.FINISHED }[action];
        if (status) return run(() => setEventStatus({ tournamentId, eventId, event, status }));
      }));

      page.querySelectorAll("[data-present]").forEach((button) => button.addEventListener("click", () => run(() => setParticipantCheckIn({ tournamentId, eventId, event, participantId: button.dataset.present, present: true }))));
      page.querySelectorAll("[data-noshow]").forEach((button) => button.addEventListener("click", () => run(() => setParticipantCheckIn({ tournamentId, eventId, event, participantId: button.dataset.noshow, present: false }))));
      page.querySelectorAll("[data-reactivate]").forEach((button) => button.addEventListener("click", () => run(() => updateParticipantStatus({ tournamentId, eventId, event, participantId: button.dataset.reactivate, status: PARTICIPANT_STATUS.APPROVED }))));
      page.querySelectorAll("[data-start-match]").forEach((button) => button.addEventListener("click", () => run(() => startMatch({ tournamentId, eventId, event, matchId: button.dataset.startMatch }))));
      page.querySelectorAll("[data-winner]").forEach((button) => button.addEventListener("click", () => {
        const id = button.dataset.match;
        const a = page.querySelector(`[data-score-a="${cssEscape(id)}"]`)?.value;
        const b = page.querySelector(`[data-score-b="${cssEscape(id)}"]`)?.value;
        const score = a !== undefined && (a !== "" || b !== "") ? { a: Number(a || 0), b: Number(b || 0) } : null;
        return run(() => completeMatch({ tournamentId, eventId, event, matchId: id, winnerId: button.dataset.winner, score }));
      }));

      const form = page.querySelector("[data-search-form]");
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        const target = page.querySelector("[data-search-results]");
        target.textContent = "Buscando…";
        try {
          const results = await searchTournamentEntities(data.get("type"), data.get("term"));
          target.innerHTML = results.map((result) => `<button type="button" data-add-id="${escapeAttr(result.id)}" data-add-type="${escapeAttr(data.get("type"))}" data-add-name="${escapeAttr(result.name || result.gamertag || result.id)}"><strong>${escapeHtml(result.name || result.gamertag || result.id)}</strong><span>${escapeHtml(result.id)}</span></button>`).join("") || "Sin resultados";
          page.querySelectorAll("[data-add-id]").forEach((button) => button.addEventListener("click", () => run(() => addParticipant({ tournamentId, eventId, event, entityType: button.dataset.addType, entityId: button.dataset.addId, displayName: button.dataset.addName }))));
        } catch (error) { target.textContent = error.message || "No fue posible buscar."; }
      });

      page.querySelectorAll("[data-approve]").forEach((button) => button.addEventListener("click", () => run(() => approveParticipationRequest({ tournamentId, eventId, event, requestId: button.dataset.approve, approve: true }))));
      page.querySelectorAll("[data-reject]").forEach((button) => button.addEventListener("click", () => run(() => approveParticipationRequest({ tournamentId, eventId, event, requestId: button.dataset.reject, approve: false }))));
      page.querySelectorAll("[data-rec-approve]").forEach((button) => button.addEventListener("click", () => run(() => reviewRecognition({ tournamentId, eventId, event, participantId: button.dataset.recApprove, approve: true }))));
      page.querySelectorAll("[data-rec-reject]").forEach((button) => button.addEventListener("click", () => run(() => reviewRecognition({ tournamentId, eventId, event, participantId: button.dataset.recReject, approve: false }))));
    };

    render();
  } catch (error) {
    console.error(error);
    message.textContent = error.message || "No fue posible cargar Tournament Pro.";
  }

  return page;
}

function formatScore(score) {
  if (!score || typeof score !== "object") return "";
  if ("a" in score || "b" in score) return `${score.a ?? 0} — ${score.b ?? 0}`;
  return Object.values(score).join(" — ");
}

function cssEscape(value) {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function escapeHtml(value = "") { const div = document.createElement("div"); div.textContent = String(value); return div.innerHTML; }
function escapeAttr(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
