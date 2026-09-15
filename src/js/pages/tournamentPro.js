import { getCurrentAccountContext } from "../services/account.js";
import { getCurrentEntityContext } from "../services/entityContext.js";
import { createSubscriptionAccess } from "../services/planService.js";
import { hasEffectiveSubscriptionAccess } from "../services/subscription.js";
import {
  getTournamentProEvent,
  searchTournamentEntities,
  prepareBracket,
  addParticipantToSlot,
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
        const canAddLate = checkInCompleted && !eventLive && !eventFinished;
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
                <button type="button" data-action="start-tournament" ${canStart ? "" : "disabled"}>
                  <i class="fa-solid fa-play" aria-hidden="true"></i> Iniciar torneo
                </button>
              ` : checkInOpen ? `
                <div>
                  <strong>Check-in en curso</strong>
                  <span>Marca quién está presente y libera los asientos de quienes no asistieron.</span>
                </div>
                <button type="button" data-action="complete-checkin">
                  <i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> Finalizar check-in
                </button>
              ` : checkInCompleted && !eventLive && !eventFinished ? `
                <div>
                  <strong>Bracket listo para iniciar</strong>
                  <span>${present} presentes · ${noShows} asientos liberados${canAddLate ? " · Puedes agregar reemplazos antes del primer match." : ""}</span>
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

          ${checkInOpen || checkInCompleted ? `
            <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__checkin-card">
              <div class="tournament-pro-page__section-heading">
                <div>
                  <span class="tournament-pro-page__eyebrow">CHECK-IN</span>
                  <h2>Asistencia</h2>
                </div>
                <div class="tournament-pro-page__bracket-counter">
                  <strong>${present}</strong><span>presentes · ${noShows} no-show</span>
                </div>
              </div>
              <p class="tournament-pro-page__helper">El check-in es exclusivamente para confirmar asistencia el día del evento. Un no-show conserva su historial y libera su asiento competitivo.</p>
              <div class="tournament-pro-page__participant-list">
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
                      <div class="tournament-pro-page__inline-actions">
                        ${canChange && !isPresent && !isNoShow ? `<button type="button" data-present="${escapeAttr(participant.id)}">Presente</button>` : ""}
                        ${canChange && isPresent ? `<button type="button" data-noshow="${escapeAttr(participant.id)}">Liberar asiento</button>` : ""}
                        ${isPresent ? `<span class="tournament-pro-page__checkin-badge tournament-pro-page__checkin-badge--present">Presente</span>` : ""}
                        ${isNoShow ? `<span class="tournament-pro-page__checkin-badge tournament-pro-page__checkin-badge--noshow">No asistió · asiento libre</span>` : ""}
                      </div>
                    </article>
                  `;
                }).join("") || `<div class="tournament-pro-page__empty">No hay participantes asignados.</div>`}
              </div>
            </section>
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
                      <span class="tournament-pro-page__stage-index">01</span>
                      <div><span class="tournament-pro-page__stage-kicker">INICIO</span><strong>${escapeHtml(firstStage.bracket === "winners" ? "WINNERS · RONDA 1" : "RONDA 1")}</strong></div>
                    </div>
                    <div class="tournament-pro-page__matches">
                      ${firstStage.matches.map((match) => {
                        const a = pro.bracket.slots?.[`seed-${((match.position - 1) * 2) + 1}`];
                        const b = pro.bracket.slots?.[`seed-${((match.position - 1) * 2) + 2}`];
                        return `
                          <article class="tournament-pro-page__match" data-match-index="${match.position || 0}">
                            <div class="tournament-pro-page__match-top">
                              <span class="tournament-pro-page__match-id">${escapeHtml(match.id)}</span>
                              <span class="tournament-pro-page__match-status">${escapeHtml(match.status || "pending")}</span>
                            </div>
                            ${a ? renderSlot(a) : ""}
                            ${b ? renderSlot(b) : ""}
                          </article>
                        `;
                      }).join("")}
                    </div>
                  </div>
                ` : `<div class="tournament-pro-page__empty">No hay bracket disponible.</div>`}

                ${stages.slice(1).map((stage, index) => `
                  <div class="tournament-pro-page__stage tournament-pro-page__stage--future" data-stage-index="${index + 2}" data-match-count="${stage.matches.length}">
                    <div class="tournament-pro-page__stage-heading">
                      <span class="tournament-pro-page__stage-index">${String(index + 2).padStart(2, "0")}</span>
                      <div><span class="tournament-pro-page__stage-kicker">SIGUIENTE</span><strong>${escapeHtml(stage.bracket === "grand_final" ? "GRAND FINAL" : `${stage.bracket === "losers" ? "LOSERS" : "WINNERS"} · RONDA ${stage.number}`)}</strong></div>
                    </div>
                    <div class="tournament-pro-page__matches">
                      ${stage.matches.map((match) => `
                        <article class="tournament-pro-page__match tournament-pro-page__match--future">
                          <div class="tournament-pro-page__match-top"><span class="tournament-pro-page__match-id">${escapeHtml(match.id)}</span><span class="tournament-pro-page__match-status">${escapeHtml(match.status || "pendiente")}</span></div>
                          <div class="tournament-pro-page__future-slot"><span>${escapeHtml(getParticipantName(match.participantAId))}</span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></div>
                          <div class="tournament-pro-page__future-slot"><span>${escapeHtml(getParticipantName(match.participantBId))}</span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></div>
                        </article>
                      `).join("")}
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          </section>

          ${canAddLate ? `
            <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__late-entry-card">
              <div class="tournament-pro-page__section-heading">
                <div><span class="tournament-pro-page__eyebrow">REEMPLAZOS</span><h2>Agregar participante</h2></div>
                <span class="tournament-pro-page__status">ANTES DEL PRIMER MATCH</span>
              </div>
              <p class="tournament-pro-page__helper">Si un asiento fue liberado durante el check-in, puedes ocuparlo con un Player o Team antes de comenzar la competencia.</p>
              <button type="button" data-late-add class="tournament-pro-page__primary-action"><i class="fa-solid fa-user-plus" aria-hidden="true"></i> Agregar participante</button>
            </section>
          ` : ""}

          ${getTournamentRegistrationRequestsMarkup(registrationRequests, registrationRequestsError)}

          ${modalOpen && selectedSlot ? `
            <div class="tournament-pro-page__modal-backdrop" data-slot-modal-backdrop>
              <section class="tournament-pro-page__modal" role="dialog" aria-modal="true" aria-labelledby="tournament-pro-slot-modal-title">
                <header class="tournament-pro-page__modal-header">
                  <div>
                    <span class="tournament-pro-page__eyebrow">ASIGNAR PARTICIPANTE</span>
                    <h2 id="tournament-pro-slot-modal-title">Seed ${escapeHtml(selectedSlot.seed)}</h2>
                    <p>${selectedParticipantName ? `Actualmente: ${escapeHtml(selectedParticipantName)}` : "Esta posición está disponible."}</p>
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
          if (action === "start-tournament") return runOperation(() => setCheckInOpen({ tournamentId, eventId, event, open: true }));
          if (action === "complete-checkin") return runOperation(() => completeCheckIn({ tournamentId, eventId, event }));
          if (action === "live") return runOperation(() => setEventStatus({ tournamentId, eventId, event, status: "live" }));
        }));

        page.querySelectorAll("[data-present]").forEach((button) => button.addEventListener("click", () => runOperation(() => setParticipantCheckIn({ tournamentId, eventId, event, participantId: button.dataset.present, present: true }))));
        page.querySelectorAll("[data-noshow]").forEach((button) => button.addEventListener("click", () => runOperation(() => setParticipantCheckIn({ tournamentId, eventId, event, participantId: button.dataset.noshow, present: false }))));

        page.querySelectorAll("[data-slot-add]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedSlotId = button.dataset.slotAdd;
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
          modalOpen = true;
          render();
          requestAnimationFrame(() => page.querySelector("[data-slot-search-form] input")?.focus());
        });

        page.querySelectorAll("[data-slot-modal-close], [data-slot-modal-backdrop]").forEach((element) => element.addEventListener("click", (clickEvent) => {
          if (element.hasAttribute("data-slot-modal-backdrop") && clickEvent.target !== element) return;
          selectedSlotId = null;
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
