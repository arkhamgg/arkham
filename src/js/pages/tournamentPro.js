import { getCurrentAccountContext } from "../services/account.js";
import { getCurrentEntityContext } from "../services/entityContext.js";
import { createSubscriptionAccess } from "../services/planService.js";
import { hasEffectiveSubscriptionAccess } from "../services/subscription.js";
import {
  getTournamentProEvent,
  searchTournamentEntities,
  prepareBracket,
  addParticipantToSlot,
  replaceParticipantInSlot,
  setParticipantCheckIn,
  setCheckInOpen,
  completeCheckIn,
  setEventStatus
} from "../services/tournamentProOperations.js";
import { getTournamentRegistrationRequestsMarkup, loadTournamentRegistrationRequests, bindTournamentRegistrationRequests } from "../components/tournamentRegistrationRequests.js";
import { ensureTournamentProState } from "../services/tournamentPro.js";

export function TournamentPro() {
  const page = document.createElement("main");
  page.className = "tournament-pro-page";
  page.innerHTML = `
    <div class="tournament-pro-page__container">
      <header class="tournament-pro-page__header">
        <div>
          <span class="tournament-pro-page__eyebrow">NEXUS // TOURNAMENT PRO</span>
          <h1>ADMINISTRAR TORNEO</h1>
          <p data-pro-message>Cargando estructura de competencia…</p>
        </div>
        <button type="button" data-configure-information>
          <i class="fa-solid fa-sliders" aria-hidden="true"></i>
          Configurar información
        </button>
      </header>
      <div class="tournament-pro-page__grid" data-pro-content></div>
    </div>
  `;

  const message = page.querySelector("[data-pro-message]");
  const content = page.querySelector("[data-pro-content]");
  const configureButton = page.querySelector("[data-configure-information]");
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const eventId = params.get("eventId");

  configureButton.addEventListener("click", () => {
    if (!tournamentId || !eventId) return;
    const targetUrl = `/dashboard/tournaments/edit?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}`;
    window.history.pushState({}, "", targetUrl);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  if (!tournamentId || !eventId) {
    message.textContent = "Falta tournamentId o eventId.";
    return page;
  }

  const loadTournamentPro = async () => {
    try {
      const account = await getCurrentAccountContext();
      const entity = await getCurrentEntityContext();

      if (
        !hasEffectiveSubscriptionAccess(account?.subscription) ||
        entity?.productId !== "tournament"
      ) {
        message.textContent = "Tournament Pro no está disponible para esta cuenta en este momento.";
        return;
      }

      const access = createSubscriptionAccess(account.subscription, "tournament");
      if (!access.hasCapability("tournament_control")) {
        message.textContent = "La cuenta no tiene la capacidad de control de torneo.";
        return;
      }

      let event = await getTournamentProEvent(tournamentId, eventId);
      if (!event) throw new Error("Evento no encontrado.");

      let pro = ensureTournamentProState(event);
      let registrationRequests = [];
      let registrationRequestsError = "";
      try {
        registrationRequests = await loadTournamentRegistrationRequests({ tournamentId, eventId });
      } catch (error) {
        registrationRequestsError = error?.message || "No fue posible cargar las solicitudes.";
      }
      if (!pro.bracket?.generated) {
        event = await prepareBracket({ tournamentId, eventId, event });
        pro = ensureTournamentProState(event);
      }

      let selectedSlotId = null;
      let replacementParticipantId = null;
      let modalOpen = false;

      const refresh = async () => {
        event = await getTournamentProEvent(tournamentId, eventId);
        pro = ensureTournamentProState(event || {});
        registrationRequestsError = "";
        try {
          registrationRequests = await loadTournamentRegistrationRequests({ tournamentId, eventId });
        } catch (error) {
          registrationRequests = [];
          registrationRequestsError = error?.message || "No fue posible cargar las solicitudes.";
        }
        render();
      };

      const formatLabel = (value) => {
        const normalized = String(value || "").replace(/[-_]/g, " ");
        if (!normalized) return "—";
        return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
      };

      const participationLabel = formatLabel(event.participationType);
      const formatValue = formatLabel(event.format);
      const matchSystem = formatLabel(event.matchSystem);
      const capacity = event.capacity?.value ?? event.capacity ?? "—";
      const game = formatLabel(event.gameId);

      const getParticipantName = (id) =>
        id ? pro.participants?.[id]?.displayName || id : "Posición disponible";

      const getInitials = (value = "") => {
        const parts = String(value).trim().split(/\s+/).filter(Boolean);
        return (parts.slice(0, 2).map((part) => part[0]).join("") || "?").toUpperCase();
      };

      const renderSlot = (slot) => {
        const participant = slot.participantId ? pro.participants?.[slot.participantId] : null;
        const name = participant?.displayName || "Posición disponible";
        const meta = participant
          ? (participant.entityId || (participant.manual ? "Participante manual" : "Player/Team NEXUS"))
          : "Esperando participante";

        return `
          <div class="tournament-pro-page__bracket-slot ${participant ? "is-filled" : "is-empty"}">
            <div class="tournament-pro-page__bracket-slot-seed">${escapeHtml(String(slot.seed).padStart(2, "0"))}</div>
            <div class="tournament-pro-page__bracket-slot-avatar">${escapeHtml(getInitials(name))}</div>
            <div class="tournament-pro-page__bracket-slot-info">
              <strong>${escapeHtml(name)}</strong>
              <span>${escapeHtml(meta)}</span>
            </div>
            ${!participant ? `
              <button type="button" class="tournament-pro-page__slot-add" data-slot-add="${escapeAttr(`seed-${slot.seed}`)}" aria-label="Agregar participante al seed ${slot.seed}">
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
              </button>
            ` : ""}
          </div>
        `;
      };

      const matchStatusLabel = (status) => ({
        pending: "PENDIENTE",
        live: "EN VIVO",
        completed: "COMPLETADO",
        bye: "BYE"
      }[status] || String(status || "PENDIENTE").toUpperCase());

      const renderMatchCard = (match, { slotA = null, slotB = null, eventLive = false } = {}) => {
        const participantAId = match.participantAId || slotA?.participantId || null;
        const participantBId = match.participantBId || slotB?.participantId || null;
        const hasBoth = Boolean(participantAId && participantBId);
        const canStartMatch = eventLive && match.status === "pending" && hasBoth;
        const canCompleteMatch = eventLive && match.status === "live" && hasBoth;

        return `
          <article class="tournament-pro-page__match tournament-pro-page__match--${escapeAttr(match.status || "pending")} ${canStartMatch ? "is-ready" : ""}" data-match-id="${escapeAttr(match.id)}">
            <div class="tournament-pro-page__match-top">
              <span class="tournament-pro-page__match-id">${escapeHtml(match.id)}</span>
              <span class="tournament-pro-page__match-status">${escapeHtml(matchStatusLabel(match.status))}</span>
            </div>
            <div class="tournament-pro-page__match-player ${match.winnerId === participantAId ? "is-winner" : ""}">
              <span>${escapeHtml(getParticipantName(participantAId))}</span>
              ${canCompleteMatch ? `<button type="button" data-winner="${escapeAttr(participantAId)}" data-match="${escapeAttr(match.id)}">GANÓ</button>` : ""}
            </div>
            <div class="tournament-pro-page__match-player ${match.winnerId === participantBId ? "is-winner" : ""}">
              <span>${escapeHtml(getParticipantName(participantBId))}</span>
              ${canCompleteMatch ? `<button type="button" data-winner="${escapeAttr(participantBId)}" data-match="${escapeAttr(match.id)}">GANÓ</button>` : ""}
            </div>
            ${match.score ? `<div class="tournament-pro-page__score">Resultado · ${escapeHtml(formatScore(match.score))}</div>` : ""}
            ${match.status === "bye" ? `<div class="tournament-pro-page__match-note"><i class="fa-solid fa-forward" aria-hidden="true"></i> BYE · avance automático</div>` : ""}
            ${canStartMatch ? `<button type="button" class="tournament-pro-page__match-action" data-start-match="${escapeAttr(match.id)}"><i class="fa-solid fa-play" aria-hidden="true"></i> Iniciar match</button>` : ""}
            ${canCompleteMatch ? `
              <div class="tournament-pro-page__score-inputs">
                <label><span>A</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-score-a="${escapeAttr(match.id)}"></label>
                <span class="tournament-pro-page__score-separator">—</span>
                <label><span>B</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-score-b="${escapeAttr(match.id)}"></label>
              </div>
              <small class="tournament-pro-page__match-helper">Selecciona GANÓ para cerrar el match y avanzar el bracket.</small>
            ` : ""}
          </article>
        `;
      };

      const render = () => {
        const stages = pro.bracket?.stages || [];
        const firstStage = stages.find((stage) => stage.bracket === "winners" && stage.number === 1);
        const slots = Object.values(pro.bracket?.slots || {}).sort((a, b) => a.seed - b.seed);
        const participants = Object.values(pro.participants || {});
        const assigned = slots.filter((slot) => slot.participantId).length;
        const present = participants.filter((participant) => participant.checkIn === true).length;
        const noShows = participants.filter((participant) => participant.status === "no_show").length;
        const checkInOpen = pro.checkIn?.status === "open";
        const checkInCompleted = pro.checkIn?.status === "completed";
        const eventLive = pro.status === "live";
        const eventFinished = pro.status === "finished";
        const canStart = !eventLive && !eventFinished && !checkInOpen && !checkInCompleted && assigned >= 2;
        const canAddParticipant = !eventLive && !eventFinished && !checkInOpen && !checkInCompleted && assigned < Number(capacity || 0);
        const selectedSlot = slots.find((slot) => slot.seed && `seed-${slot.seed}` === selectedSlotId);
        const selectedParticipantName = selectedSlot?.participantId
          ? getParticipantName(selectedSlot.participantId)
          : "";

        const statusLabel = eventLive
          ? "EN VIVO"
          : checkInOpen
            ? "CHECK-IN ABIERTO"
            : checkInCompleted
              ? "BRACKET LISTO"
              : "PREPARACIÓN";

        const renderSlot = (slot) => {
          const participant = slot.participantId ? pro.participants?.[slot.participantId] : null;
          const name = participant?.displayName || "Posición disponible";
          const meta = participant
            ? (participant.status === "no_show" ? "Asiento liberado" : participant.entityId || (participant.manual ? "Participante manual" : "Player/Team NEXUS"))
            : "Esperando participante";
          const mutable = !eventLive && !eventFinished && !checkInCompleted;

          return `
            <div class="tournament-pro-page__bracket-slot ${participant ? "is-filled" : "is-empty"}">
              <div class="tournament-pro-page__bracket-slot-seed">${escapeHtml(String(slot.seed).padStart(2, "0"))}</div>
              <div class="tournament-pro-page__bracket-slot-avatar">${escapeHtml(getInitials(name))}</div>
              <div class="tournament-pro-page__bracket-slot-info">
                <strong>${escapeHtml(name)}</strong>
                <span>${escapeHtml(meta)}</span>
              </div>
              ${!participant && mutable ? `
                <button type="button" class="tournament-pro-page__slot-add" data-slot-add="${escapeAttr(`seed-${slot.seed}`)}" aria-label="Agregar participante al seed ${slot.seed}">
                  <i class="fa-solid fa-plus" aria-hidden="true"></i>
                </button>
              ` : ""}
            </div>
          `;
        };

        content.innerHTML = `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__card--control">
            <div class="tournament-pro-page__section-heading">
              <div>
                <span class="tournament-pro-page__eyebrow">OPERACIÓN</span>
                <h2>Control del torneo</h2>
              </div>
              <span class="tournament-pro-page__status">${escapeHtml(statusLabel)}</span>
            </div>
            <div class="tournament-pro-page__event-summary">
              <div><span>Juego</span><strong>${escapeHtml(game)}</strong></div>
              <div><span>Participación</span><strong>${escapeHtml(participationLabel)}</strong></div>
              <div><span>Formato</span><strong>${escapeHtml(formatValue)}</strong></div>
              <div><span>Partida</span><strong>${escapeHtml(matchSystem)}</strong></div>
              <div><span>Capacidad</span><strong>${escapeHtml(capacity)}</strong></div>
            </div>
            <div class="tournament-pro-page__operation-bar">
              ${!checkInOpen && !checkInCompleted && !eventLive && !eventFinished ? `
                <div>
                  <strong>Antes de comenzar</strong>
                  <span>${assigned >= 2 ? "Hay suficientes participantes para iniciar el torneo." : "Necesitas al menos 2 participantes asignados para iniciar."}</span>
                </div>
                <div class="tournament-pro-page__operation-actions">
                  <button type="button" data-action="add-participant" ${canAddParticipant ? "" : "disabled"}>
                    <i class="fa-solid fa-user-plus" aria-hidden="true"></i> Agregar participante
                  </button>
                  <button type="button" data-action="start-tournament" ${canStart ? "" : "disabled"}>
                    <i class="fa-solid fa-play" aria-hidden="true"></i> Iniciar torneo
                  </button>
                </div>
              ` : checkInOpen ? `
                <div>
                  <strong>Check-in en curso</strong>
                  <span>Marca quién está presente, libera asientos o reemplaza directamente a un participante que no asistió.</span>
                </div>
              ` : checkInCompleted && !eventLive && !eventFinished ? `
                <div>
                  <strong>Bracket listo para iniciar</strong>
                  <span>${present} presentes · ${noShows} asientos liberados</span>
                </div>
                <button type="button" data-action="live" ${present >= 2 ? "" : "disabled"}>
                  <i class="fa-solid fa-bolt" aria-hidden="true"></i> Pasar a competencia
                </button>
              ` : eventLive ? `
                <div><strong>Competencia en vivo</strong><span>La configuración estructural está bloqueada.</span></div>
              ` : `
                <div><strong>Torneo finalizado</strong><span>La información histórica permanece disponible.</span></div>
              `}
            </div>
          </section>

          ${checkInOpen ? `
            <div class="tournament-pro-page__modal-backdrop tournament-pro-page__checkin-modal-backdrop" data-checkin-modal>
              <section class="tournament-pro-page__modal tournament-pro-page__checkin-modal" role="dialog" aria-modal="true" aria-labelledby="tournament-pro-checkin-modal-title">
                <header class="tournament-pro-page__modal-header tournament-pro-page__checkin-modal-header">
                  <div>
                    <span class="tournament-pro-page__eyebrow">CHECK-IN</span>
                    <h2 id="tournament-pro-checkin-modal-title">Confirmar asistencia</h2>
                    <p>El check-in es exclusivamente para confirmar quién está presente el día del evento. Elige una acción directamente para cada participante.</p>
                  </div>
                  <div class="tournament-pro-page__bracket-counter">
                    <strong>${present}</strong><span>presentes · ${noShows} no-show</span>
                  </div>
                </header>
                <div class="tournament-pro-page__modal-body tournament-pro-page__checkin-modal-body">
                  <div class="tournament-pro-page__checkin-summary">
                    <span>${participants.length} participantes asignados</span>
                    <span>${Math.max(assigned - present - noShows, 0)} pendientes</span>
                  </div>
                  <div class="tournament-pro-page__participant-list tournament-pro-page__checkin-participant-list">
                    ${participants.map((participant) => {
                      const isPresent = participant.checkIn === true;
                      const isNoShow = participant.status === "no_show";
                      const canChange = checkInOpen && !eventLive && !eventFinished;
                      return `
                        <article class="tournament-pro-page__participant ${isPresent ? "is-present" : isNoShow ? "is-no-show" : ""}">
                          <div>
                            <strong>${escapeHtml(participant.displayName || participant.id)}</strong>
                            <span>${escapeHtml(participant.entityId || (participant.manual ? "Participante manual" : "Player/Team NEXUS"))}</span>
                          </div>
                          <div class="tournament-pro-page__inline-actions tournament-pro-page__checkin-actions">
                            ${canChange ? `<button type="button" class="tournament-pro-page__checkin-choice tournament-pro-page__checkin-choice--present" data-present="${escapeAttr(participant.id)}" ${isPresent ? "disabled" : ""}>Presente</button>` : ""}
                            ${canChange ? `<button type="button" class="tournament-pro-page__checkin-choice tournament-pro-page__checkin-choice--release" data-noshow="${escapeAttr(participant.id)}" ${isNoShow ? "disabled" : ""}>Liberar asiento</button>` : ""}
                            ${canChange ? `<button type="button" class="tournament-pro-page__checkin-choice tournament-pro-page__checkin-choice--replace" data-replace="${escapeAttr(participant.id)}">Reemplazar</button>` : ""}
                            ${isPresent ? `<span class="tournament-pro-page__checkin-badge tournament-pro-page__checkin-badge--present">Presente</span>` : ""}
                            ${isNoShow ? `<span class="tournament-pro-page__checkin-badge tournament-pro-page__checkin-badge--noshow">No asistió · asiento libre</span>` : ""}
                          </div>
                        </article>
                      `;
                    }).join("") || `<div class="tournament-pro-page__empty">No hay participantes asignados.</div>`}
                  </div>
                </div>
                <footer class="tournament-pro-page__checkin-modal-footer">
                  <div>
                    <strong>${present} presentes</strong>
                    <span>Necesitas al menos 2 para pasar a competencia.</span>
                  </div>
                  <button type="button" class="tournament-pro-page__primary-action" data-action="complete-checkin">
                    <i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> Finalizar check-in
                  </button>
                </footer>
              </section>
            </div>
          ` : ""}

          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__bracket-card">
            <div class="tournament-pro-page__section-heading">
              <div>
                <span class="tournament-pro-page__eyebrow">BRACKET</span>
                <h2>${escapeHtml(formatValue)}</h2>
              </div>
              <div class="tournament-pro-page__bracket-counter">
                <strong>${assigned}</strong>
                <span>/ ${escapeHtml(capacity)} posiciones</span>
              </div>
            </div>
            <p class="tournament-pro-page__helper">Este es el mismo bracket operativo que alimenta la vista pública. Antes del check-in puedes preparar posiciones; después, los cambios estructurales quedan limitados para proteger los resultados.</p>

            <div class="tournament-pro-page__bracket-shell">
              <div class="tournament-pro-page__bracket">
                ${firstStage ? `
                  <div class="tournament-pro-page__stage tournament-pro-page__stage--active" data-match-count="${firstStage.matches.length}">
                    <div class="tournament-pro-page__stage-heading">
                      <span class="tournament-pro-page__stage-index">R1</span>
                      <div><strong>${escapeHtml(firstStage.bracket === "winners" ? "PRIMERA RONDA" : "RONDA 1")}</strong></div>
                    </div>
                    <div class="tournament-pro-page__matches">
                      ${firstStage.matches.map((match) => {
                        const a = pro.bracket.slots?.[`seed-${((match.position - 1) * 2) + 1}`];
                        const b = pro.bracket.slots?.[`seed-${((match.position - 1) * 2) + 2}`];
                        return renderMatchCard(match, { slotA: a, slotB: b, eventLive });
                      }).join("")}
                    </div>
                  </div>
                ` : `<div class="tournament-pro-page__empty">No hay bracket disponible.</div>`}

                ${stages.slice(1).map((stage, index) => `
                  <div class="tournament-pro-page__stage tournament-pro-page__stage--future" data-stage-index="${index + 2}" data-match-count="${stage.matches.length}">
                    <div class="tournament-pro-page__stage-heading">
                      <span class="tournament-pro-page__stage-index">R${index + 2}</span>
                      <div><strong>${escapeHtml(stage.bracket === "grand_final" ? "GRAND FINAL" : `${stage.bracket === "losers" ? "LOSERS" : `RONDA ${stage.number}`}`)}</strong></div>
                    </div>
                    <div class="tournament-pro-page__matches">
                      ${stage.matches.map((match) => renderMatchCard(match, { eventLive })).join("")}
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          </section>

          ${getTournamentRegistrationRequestsMarkup(registrationRequests, registrationRequestsError)}

          ${modalOpen && selectedSlot ? `
            <div class="tournament-pro-page__modal-backdrop" data-slot-modal-backdrop>
              <section class="tournament-pro-page__modal" role="dialog" aria-modal="true" aria-labelledby="tournament-pro-slot-modal-title">
                <header class="tournament-pro-page__modal-header">
                  <div>
                    <span class="tournament-pro-page__eyebrow">${replacementParticipantId ? "REEMPLAZAR PARTICIPANTE" : "ASIGNAR PARTICIPANTE"}</span>
                    <h2 id="tournament-pro-slot-modal-title">Seed ${escapeHtml(selectedSlot.seed)}</h2>
                    <p>${replacementParticipantId ? `Reemplazando: ${escapeHtml(selectedParticipantName)}` : selectedParticipantName ? `Actualmente: ${escapeHtml(selectedParticipantName)}` : "Esta posición está disponible."}</p>
                  </div>
                  <button type="button" class="tournament-pro-page__modal-close" data-slot-modal-close aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                </header>
                <div class="tournament-pro-page__modal-body">
                  <form data-slot-search-form>
                    <label class="tournament-pro-page__modal-label">Buscar en NEXUS</label>
                    <div class="tournament-pro-page__search-row">
                      <input name="term" placeholder="Nombre, gamertag o ID" required autofocus>
                      <select name="type" aria-label="Tipo de participante"><option value="player">Player</option><option value="team">Team</option></select>
                      <button type="submit"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Buscar</button>
                    </div>
                  </form>
                  <div class="tournament-pro-page__search-results" data-slot-search-results></div>
                  <div class="tournament-pro-page__modal-divider"><span>o</span></div>
                  <button type="button" class="tournament-pro-page__manual-option" data-slot-manual>
                    <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
                    <span><strong>Agregar participante manual</strong><small>Úsalo si no tiene perfil en NEXUS.</small></span>
                    <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                  </button>
                </div>
              </section>
            </div>
          ` : ""}
        `;

        bind();
        bindTournamentRegistrationRequests({
          page,
          tournamentId,
          eventId,
          getEvent: () => event,
          onChanged: async () => {
            registrationRequestsError = "";
            try {
              registrationRequests = await loadTournamentRegistrationRequests({ tournamentId, eventId });
            } catch (error) {
              registrationRequests = [];
              registrationRequestsError = error?.message || "No fue posible cargar las solicitudes.";
            }
            event = await getTournamentProEvent(tournamentId, eventId);
            pro = ensureTournamentProState(event || {});
            render();
          }
        });
      };

      const runOperation = async (operation) => {
        try {
          event = await operation();
          pro = ensureTournamentProState(event || {});
          render();
        } catch (error) {
          window.alert(error?.message || "No fue posible completar la operación.");
        }
      };

      const bind = () => {
        page.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
          const action = button.dataset.action;
          if (action === "add-participant") {
            const emptySlot = Object.values(pro.bracket?.slots || {})
              .filter((slot) => !slot.participantId)
              .sort((a, b) => Number(a.seed) - Number(b.seed))[0];
            if (!emptySlot) return window.alert("No hay posiciones disponibles en el bracket.");
            selectedSlotId = `seed-${emptySlot.seed}`;
            replacementParticipantId = null;
            modalOpen = true;
            render();
            return requestAnimationFrame(() => page.querySelector("[data-slot-search-form] input")?.focus());
          }
          if (action === "start-tournament") return runOperation(() => setCheckInOpen({ tournamentId, eventId, event, open: true }));
          if (action === "complete-checkin") return runOperation(() => completeCheckIn({ tournamentId, eventId, event }));
          if (action === "live") return runOperation(() => setEventStatus({ tournamentId, eventId, event, status: "live" }));
        }));

        page.querySelectorAll("[data-present]").forEach((button) => button.addEventListener("click", () => runOperation(() => setParticipantCheckIn({ tournamentId, eventId, event, participantId: button.dataset.present, present: true }))));
        page.querySelectorAll("[data-noshow]").forEach((button) => button.addEventListener("click", () => runOperation(() => setParticipantCheckIn({ tournamentId, eventId, event, participantId: button.dataset.noshow, present: false }))));

        page.querySelectorAll("[data-start-match]").forEach((button) => {
          button.addEventListener("click", () => runOperation(() => startMatch({
            tournamentId,
            eventId,
            event,
            matchId: button.dataset.startMatch
          })));
        });

        page.querySelectorAll("[data-winner]").forEach((button) => {
          button.addEventListener("click", () => {
            const matchId = button.dataset.match;
            const scoreA = page.querySelector(`[data-score-a="${cssEscape(matchId)}"]`)?.value;
            const scoreB = page.querySelector(`[data-score-b="${cssEscape(matchId)}"]`)?.value;
            const score = (scoreA !== undefined && scoreA !== "") || (scoreB !== undefined && scoreB !== "")
              ? { a: Number(scoreA || 0), b: Number(scoreB || 0) }
              : null;

            return runOperation(() => completeMatch({
              tournamentId,
              eventId,
              event,
              matchId,
              winnerId: button.dataset.winner,
              score
            }));
          });
        });

        page.querySelectorAll("[data-replace]").forEach((button) => {
          button.addEventListener("click", () => {
            const participant = pro.participants?.[button.dataset.replace];
            const slot = Object.values(pro.bracket?.slots || {}).find((item) => item.participantId === participant?.id);
            if (!slot) return window.alert("No se encontró la posición de este participante.");
            selectedSlotId = `seed-${slot.seed}`;
            replacementParticipantId = participant.id;
            modalOpen = true;
            render();
            requestAnimationFrame(() => page.querySelector("[data-slot-search-form] input")?.focus());
          });
        });

        page.querySelectorAll("[data-slot-add]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedSlotId = button.dataset.slotAdd;
            replacementParticipantId = null;
            modalOpen = true;
            render();
            requestAnimationFrame(() => page.querySelector("[data-slot-search-form] input")?.focus());
          });
        });

        page.querySelector("[data-late-add]")?.addEventListener("click", () => {
          const empty = Object.values(pro.bracket?.slots || {})
            .filter((slot) => !slot.participantId)
            .sort((a, b) => Number(a.seed) - Number(b.seed))[0];
          if (!empty) return window.alert("No hay un asiento liberado disponible.");
          selectedSlotId = `seed-${empty.seed}`;
          replacementParticipantId = null;
          modalOpen = true;
          render();
          requestAnimationFrame(() => page.querySelector("[data-slot-search-form] input")?.focus());
        });

        page.querySelectorAll("[data-slot-modal-close], [data-slot-modal-backdrop]").forEach((element) => element.addEventListener("click", (clickEvent) => {
          if (element.hasAttribute("data-slot-modal-backdrop") && clickEvent.target !== element) return;
          selectedSlotId = null;
          replacementParticipantId = null;
          modalOpen = false;
          render();
        }));

        const form = page.querySelector("[data-slot-search-form]");
        form?.addEventListener("submit", async (submitEvent) => {
          submitEvent.preventDefault();
          const data = new FormData(form);
          const target = page.querySelector("[data-slot-search-results]");
          target.textContent = "Buscando…";
          try {
            const results = await searchTournamentEntities(data.get("type"), data.get("term"));
            target.innerHTML = results.map((result) => `
              <button type="button" data-slot-result-id="${escapeAttr(result.id)}" data-slot-result-type="${escapeAttr(data.get("type"))}" data-slot-result-name="${escapeAttr(result.name || result.gamertag || result.id)}">
                <strong>${escapeHtml(result.name || result.gamertag || result.id)}</strong>
                <span>${escapeHtml(result.gamertag || result.id)}</span>
              </button>
            `).join("") || "Sin resultados";
            target.querySelectorAll("[data-slot-result-id]").forEach((resultButton) => resultButton.addEventListener("click", () => assignParticipant({
              entityType: resultButton.dataset.slotResultType,
              entityId: resultButton.dataset.slotResultId,
              displayName: resultButton.dataset.slotResultName,
              manual: false
            })));
          } catch (error) {
            target.textContent = error.message || "No fue posible buscar.";
          }
        });

        page.querySelector("[data-slot-manual]")?.addEventListener("click", () => {
          const displayName = window.prompt("Nombre del participante:");
          if (!displayName?.trim()) return;
          assignParticipant({ entityType: "manual", displayName: displayName.trim(), manual: true });
        });
      };

      const assignParticipant = async ({ entityType, entityId = null, displayName, manual = false }) => {
        if (!selectedSlotId) return;
        try {
          event = await addParticipantToSlot({ tournamentId, eventId, event, slotId: selectedSlotId, entityType, entityId, displayName, manual });
          pro = ensureTournamentProState(event);
          selectedSlotId = null;
          replacementParticipantId = null;
          modalOpen = false;
          render();
        } catch (error) {
          window.alert(error.message || "No fue posible agregar el participante.");
        }
      };

      const handleModalKeydown = (event) => {
        if (event.key !== "Escape" || !modalOpen) return;
        selectedSlotId = null;
        modalOpen = false;
        render();
      };
      page.addEventListener("keydown", handleModalKeydown);

      render();
      message.textContent = "Prepara las posiciones y, cuando haya al menos 2 participantes, inicia el torneo para abrir el check-in.";
    } catch (error) {
      console.error(error);
      message.textContent = error.message || "No fue posible cargar Tournament Pro.";
    }
  };

  loadTournamentPro();
  return page;
}

function cssEscape(value) {
  return typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(value)
    : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function formatScore(score) {
  if (!score || typeof score !== "object") return "";
  if ("a" in score || "b" in score) return `${score.a ?? 0} — ${score.b ?? 0}`;
  return Object.values(score).join(" — ");
}

function escapeHtml(value = "") {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

function escapeAttr(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
