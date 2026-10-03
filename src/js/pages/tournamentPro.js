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
  setEventStatus,
  startMatch,
  completeMatch,
  createCompetitionStation,
  assignMatchToStation,
  releaseMatchStation,
  getOfficialResults,
  finalizeTournament,
  auditTournamentProBracketAgainstCompetitionCore,
  syncCompetitionDomainStructureFromLegacyBracket
} from "../services/tournamentProOperations.js";
import { getTournamentRegistrationRequestsMarkup, loadTournamentRegistrationRequests, bindTournamentRegistrationRequests } from "../components/tournamentRegistrationRequests.js";
import { ensureTournamentProState } from "../services/tournamentPro.js";
import { runCompetitionBracketMigrationDryRun } from "../services/competitionBracketMigrationDryRun.js";
import {
  getCompetitionPhases,
  getCompetitionStructures,
  getCompetitionRounds,
  getMatchAdvancement,
  getCompetitionDeliveryMode,
  getCompetitionStations,
  getCompetitionOperationsModel
} from "../services/competitionCore.js";
import {
  validateCompetitionConfiguration,
  COMPETITION_CONFIGURATION_STATUS
} from "../services/competitionConfiguration.js";

export function TournamentPro() {
  const page = document.createElement("main");
  page.className = "tournament-pro-page";
  page.innerHTML = `
    <div class="tournament-pro-page__container">
      <header class="tournament-pro-page__header">
        <div>
          <span class="tournament-pro-page__eyebrow">ARKHAM // TOURNAMENT PRO</span>
          <h1>ADMINISTRAR TORNEO</h1>
          <p data-pro-message>Cargando estructura de competencia…</p>
        </div>
        <div class="tournament-pro-page__header-actions">
          <button type="button" data-pro-back hidden>
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            Dashboard
          </button>
        </div>
      </header>
      <div class="tournament-pro-page__grid" data-pro-content></div>
    </div>
  `;

  const message = page.querySelector("[data-pro-message]");
  const content = page.querySelector("[data-pro-content]");
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const eventId = params.get("eventId");
  const workspaceViewIds = new Set(["dashboard", "competition", "operations", "results"]);
  const checkInViewIds = new Set(["setup", "checkin"]);
  const isPhoneDevice = () => {
    const userAgent = String(navigator.userAgent || "");
    const mobileUserAgent = /Android.*Mobile|iPhone|iPod|Windows Phone/i.test(userAgent);
    const touchNarrowViewport = window.matchMedia("(max-width: 767px)").matches && Number(navigator.maxTouchPoints || 0) > 0;
    return mobileUserAgent || touchNarrowViewport;
  };
  const mobileNoticeStorageKey = `arkham:tournament-pro:mobile-notice:v1:${tournamentId || "unknown"}:${eventId || "unknown"}`;
  const shouldShowMobileNotice = () => {
    if (!isPhoneDevice()) return false;
    try {
      return sessionStorage.getItem(mobileNoticeStorageKey) !== "dismissed";
    } catch {
      return true;
    }
  };
  const dismissMobileNotice = () => {
    try {
      sessionStorage.setItem(mobileNoticeStorageKey, "dismissed");
    } catch {
      // Ignore storage restrictions and simply close the modal for this render.
    }
    page.querySelector("[data-mobile-experience-modal]")?.remove();
  };
  const getWorkspaceView = () => {
    const value = new URLSearchParams(window.location.search).get("proView");
    return workspaceViewIds.has(value) ? value : "dashboard";
  };
  const getCheckInView = () => {
    const value = new URLSearchParams(window.location.search).get("proCheckIn");
    if (value === "checkin") return "checkin";
    return "setup";
  };
  const navigateCheckIn = (view, { replace = false } = {}) => {
    const nextView = checkInViewIds.has(view) ? view : "requests";
    const url = new URL(window.location.href);
    url.searchParams.set("proView", "operations");
    if (nextView === "requests") url.searchParams.delete("proCheckIn");
    else url.searchParams.set("proCheckIn", nextView);
    window.history[replace ? "replaceState" : "pushState"]({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (typeof renderWorkspace === "function") renderWorkspace();
  };

  const competitionViewIds = new Set(["structure", "bracket", "matches"]);
  const getCompetitionView = () => {
    const value = new URLSearchParams(window.location.search).get("competitionView");
    return competitionViewIds.has(value) ? value : "structure";
  };
  const navigateCompetitionView = (view, { replace = false } = {}) => {
    const nextView = competitionViewIds.has(view) ? view : "structure";
    const url = new URL(window.location.href);
    url.searchParams.set("proView", "competition");
    if (nextView === "structure") url.searchParams.delete("competitionView");
    else url.searchParams.set("competitionView", nextView);
    window.history[replace ? "replaceState" : "pushState"]({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (typeof renderWorkspace === "function") renderWorkspace();
  };
  let renderWorkspace = null;
  const navigateWorkspace = (view, { replace = false, focus = null } = {}) => {
    const url = new URL(window.location.href);
    if (view === "dashboard") url.searchParams.delete("proView");
    else url.searchParams.set("proView", view);
    if (focus) url.searchParams.set("proFocus", focus);
    else url.searchParams.delete("proFocus");
    window.history[replace ? "replaceState" : "pushState"]({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (typeof renderWorkspace === "function") renderWorkspace();
    if (focus) {
      requestAnimationFrame(() => {
        page.querySelector(`[data-pro-anchor="${cssEscape(focus)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  window.addEventListener("popstate", () => {
    if (typeof renderWorkspace === "function") renderWorkspace();
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
      let competitionValidation = validateCompetitionConfiguration({
        gameId: event.gameId,
        competitionOption: event.competitionOption,
        participationType: event.participationType,
        format: pro.format || event.format,
        matchSystem: pro.matchSystem || event.matchSystem,
        capacity: pro.capacity?.value || pro.capacity || event.capacity?.value || event.capacity
      });
      let registrationRequests = [];
      let registrationRequestsError = "";
      try {
        registrationRequests = await loadTournamentRegistrationRequests({ tournamentId, eventId });
      } catch (error) {
        registrationRequestsError = error?.message || "No fue posible cargar las solicitudes.";
      }
      if (
        !pro.bracket?.generated &&
        competitionValidation.status !== COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED &&
        competitionValidation.status !== COMPETITION_CONFIGURATION_STATUS.INVALID
      ) {
        event = await prepareBracket({ tournamentId, eventId, event });
        pro = ensureTournamentProState(event);
        competitionValidation = validateCompetitionConfiguration({
          gameId: event.gameId,
          competitionOption: event.competitionOption,
          participationType: event.participationType,
          format: pro.format || event.format,
          matchSystem: pro.matchSystem || event.matchSystem,
          capacity: pro.capacity?.value || pro.capacity || event.capacity?.value || event.capacity
        });
      }

      let selectedSlotId = null;
      let replacementParticipantId = null;
      let modalOpen = false;
      let finalizationModalOpen = false;
      let selectedWorkspacePhaseId = null;
      let selectedWorkspaceStructureId = null;
      let selectedWorkspaceRoundId = null;
      let selectedWorkspaceMatchId = null;
      let selectedOperationalStationId = null;
      let competitionCoreAudit = null;
      let competitionCoreAuditLoading = false;
      const pendingMatchOperations = new Set();

      const isMatchOperationPending = (matchId) =>
        Boolean(matchId && pendingMatchOperations.has(matchId));

      const refresh = async () => {
        event = await getTournamentProEvent(tournamentId, eventId);
        pro = ensureTournamentProState(event || {});
        competitionValidation = validateCompetitionConfiguration({
          gameId: event?.gameId,
          competitionOption: event?.competitionOption,
          participationType: event?.participationType,
          format: pro.format || event?.format,
          matchSystem: pro.matchSystem || event?.matchSystem,
          capacity: pro.capacity?.value || pro.capacity || event?.capacity?.value || event?.capacity
        });
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

      const formatAuditSide = (side) => {
        if (!side) return "Posición vacía";
        if (side.displayName) return side.displayName;
        if (side.participantId) {
          return pro.participants?.[side.participantId]?.displayName || side.participantId;
        }
        if (side.entryId) {
          return pro.entries?.[side.entryId]?.displayName || `Entry ${side.entryId}`;
        }
        return "Posición vacía";
      };

      const renderAuditMatchList = (label, matches = []) => {
        const safeMatches = Array.isArray(matches) ? matches : [];
        if (!safeMatches.length) return "";

        return `
          <details class="tournament-pro-page__audit-details">
            <summary><strong>${escapeHtml(label)} (${safeMatches.length})</strong></summary>
            <div class="tournament-pro-page__audit-match-list">
              ${safeMatches.map((match) => {
                const round = match.roundOrder ?? match.round ?? match.roundId ?? "Sin round";
                const bracket = formatLabel(match.bracket || "competition");
                const winnerRoute = match.advancement?.winnerDestination;
                const loserRoute = match.advancement?.loserDestination;
                const routes = [
                  winnerRoute?.matchId
                    ? `Ganador → ${winnerRoute.matchId}${winnerRoute.slot ? ` (${winnerRoute.slot})` : ""}`
                    : null,
                  loserRoute?.matchId
                    ? `Perdedor → ${loserRoute.matchId}${loserRoute.slot ? ` (${loserRoute.slot})` : ""}`
                    : null
                ].filter(Boolean);

                return `
                  <div class="tournament-pro-page__audit-match">
                    <strong>${escapeHtml(match.id || "Match sin ID")}</strong>
                    <small>${escapeHtml(`${bracket} · Round ${round}`)}</small>
                    <small>${escapeHtml(formatAuditSide(match.participantA))} vs ${escapeHtml(formatAuditSide(match.participantB))}</small>
                    <small>${escapeHtml(routes.length ? routes.join(" · ") : "Sin rutas declaradas")}</small>
                  </div>
                `;
              }).join("")}
            </div>
          </details>
        `;
      };

      const participationLabel = formatLabel(event.participationType);
      const formatValue = formatLabel(event.format);
      const matchSystem = formatLabel(event.matchSystem);
      const capacity = event.capacity?.value ?? event.capacity ?? "—";
      const game = formatLabel(event.gameId);

      const getParticipantName = (id) =>
        id ? pro.participants?.[id]?.displayName || id : "Posición disponible";

      const getMatchGameSummary = (match) => {
        const games = Array.isArray(match?.games) ? match.games : [];
        const completedGames = games.filter((game) => game?.status === "completed");
        const winsA = completedGames.filter((game) => game?.winner?.side === "A").length;
        const winsB = completedGames.filter((game) => game?.winner?.side === "B").length;
        const lastGame = completedGames[completedGames.length - 1] || null;
        const lastWinnerSide = lastGame?.winner?.side === "A" || lastGame?.winner?.side === "B"
          ? lastGame.winner.side
          : null;

        return {
          games: completedGames,
          winsA,
          winsB,
          lastGame,
          lastWinnerSide,
          nextGameNumber: completedGames.length + 1
        };
      };

      const getInitials = (value = "") => {
        const parts = String(value).trim().split(/\s+/).filter(Boolean);
        return (parts.slice(0, 2).map((part) => part[0]).join("") || "?").toUpperCase();
      };

      const getCompetitionWorkspaceModel = () => {
        const configuredPhases = getCompetitionPhases(event);
        const structures = getCompetitionStructures(event);
        const stages = Array.isArray(pro.bracket?.stages) ? pro.bracket.stages : [];
        const bracketType = String(pro.bracket?.type || event.format || "single_elimination").toLowerCase();
        const legacyType = bracketType === "double_elimination" ? "DOUBLE_ELIMINATION" : "SINGLE_ELIMINATION";

        if (!configuredPhases.length) {
          const legacyPhaseId = "legacy-main";
          return [{
            id: legacyPhaseId,
            name: "Main Competition",
            order: 1,
            status: pro.status || "configured",
            matchFormat: pro.matchSystem || event.matchSystem || null,
            legacy: true,
            structures: [{
              id: "legacy-main-structure",
              name: bracketType === "double_elimination" ? "Double Elimination" : "Single Elimination",
              type: legacyType,
              order: 1,
              legacy: true,
              rounds: getCompetitionRounds(event, { bracket: null })
            }]
          }];
        }

        return configuredPhases
          .map((phase, phaseIndex) => {
            const phaseStructures = structures.filter((structure) => structure.phaseId === phase.id);
            const phaseStages = stages.filter((stage) => {
              if (stage?.phaseId) return stage.phaseId === phase.id;
              return phaseStructures.length === 0 && phaseIndex === 0;
            });
            const normalizedStructures = phaseStructures.length
              ? phaseStructures.map((structure) => ({
                  ...structure,
                  rounds: getCompetitionRounds(event, { structureId: structure.id, phaseId: phase.id })
                }))
              : [{
                  id: `${phase.id}-derived`,
                  name: "Main Structure",
                  type: legacyType,
                  order: 1,
                  legacy: true,
                  rounds: phaseStages.length ? phaseStages : getCompetitionRounds(event, { phaseId: phase.id })
                }];

            return {
              ...phase,
              id: phase.id || `phase-${phaseIndex + 1}`,
              name: phase.name || `Phase ${phaseIndex + 1}`,
              order: Number.isFinite(Number(phase.order)) ? Number(phase.order) : phaseIndex + 1,
              status: phase.status || "configured",
              structures: normalizedStructures
            };
          })
          .sort((a, b) => a.order - b.order);
      };

      const renderSlot = (slot) => {
        const participant = slot.participantId ? pro.participants?.[slot.participantId] : null;
        const name = participant?.displayName || "Posición disponible";
        const meta = participant
          ? (participant.entityId || (participant.manual ? "Participante manual" : "Player/Team ARKHAM"))
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
        const matchSystemValue = match.matchSystem || pro.matchSystem || null;
        const deliveryMode = getCompetitionDeliveryMode(event);
        const stations = getCompetitionStations(event);
        const matchStation = stations.find((station) => station.currentMatchId === match.id) || null;
        const canAssignStation = eventLive && match.status === "pending" && hasBoth;
        const resourceLabel = deliveryMode === "physical" ? "ESTACIÓN" : "LOBBY";
        const resourceEmptyLabel = deliveryMode === "physical" ? "Sin estación" : "Sin lobby";

        return `
          <article class="tournament-pro-page__match tournament-pro-page__match--${escapeAttr(match.status || "pending")} ${hasBoth ? "is-ready" : ""}" data-match-id="${escapeAttr(match.id)}">
            <div class="tournament-pro-page__match-top">
              <span class="tournament-pro-page__match-id">${escapeHtml(match.id)}</span>
              <span class="tournament-pro-page__match-status">${escapeHtml(matchStatusLabel(match.status))}</span>
            </div>
            ${matchSystemValue ? `<div class="tournament-pro-page__match-system">${escapeHtml(matchSystemValue)}</div>` : ""}
            <div class="tournament-pro-page__match-player ${match.winnerId === participantAId ? "is-winner" : ""}">
              <span>${escapeHtml(getParticipantName(participantAId))}</span>
            </div>
            <div class="tournament-pro-page__match-player ${match.winnerId === participantBId ? "is-winner" : ""}">
              <span>${escapeHtml(getParticipantName(participantBId))}</span>
            </div>
            ${match.score ? `<div class="tournament-pro-page__score">Resultado · ${escapeHtml(formatScore(match.score))}</div>` : ""}
            ${match.status === "bye" ? `<div class="tournament-pro-page__match-note"><i class="fa-solid fa-forward" aria-hidden="true"></i> BYE · avance automático</div>` : ""}
            ${hasBoth ? `
              <div class="tournament-pro-page__match-resource">
                <span>${resourceLabel}</span>
                ${canAssignStation ? `
                  <select data-assign-station="${escapeAttr(match.id)}" aria-label="Asignar ${resourceLabel.toLowerCase()}">
                    <option value="">${resourceEmptyLabel}</option>
                    ${stations.map((station) => `
                      <option value="${escapeAttr(station.id)}" ${matchStation?.id === station.id ? "selected" : ""} ${station.currentMatchId && station.currentMatchId !== match.id ? "disabled" : ""}>
                        ${escapeHtml(station.name)}${station.currentMatchId && station.currentMatchId !== match.id ? " · ocupada" : ""}
                      </option>
                    `).join("")}
                  </select>
                ` : `
                  <strong>${escapeHtml(matchStation?.name || resourceEmptyLabel)}</strong>
                `}
              </div>
            ` : ""}
            ${match.status === "pending" && hasBoth ? `
              <button type="button" class="tournament-pro-page__match-action" data-open-match="${escapeAttr(match.id)}">
                <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> Abrir match
              </button>
            ` : ""}

          </article>
        `;
      };

      const renderAdminBracketGroup = (groupStages, bracketType, currentPro, eventLive) => {
        if (!groupStages.length) return "";
        const labels = {
          winners: "WINNERS BRACKET",
          losers: "LOSERS BRACKET",
          grand_final: "GRAND FINAL"
        };

        return `
          <section class="tournament-pro-page__bracket-group tournament-pro-page__bracket-group--${escapeAttr(bracketType)}">
            <header class="tournament-pro-page__bracket-group-header">
              <div>
                <span>${escapeHtml(bracketType === "winners" ? "CUADRO PRINCIPAL" : bracketType === "losers" ? "RUTA DE ELIMINADOS" : "CIERRE")}</span>
                <strong>${labels[bracketType]}</strong>
              </div>
            </header>
            <div class="tournament-pro-page__bracket-shell">
              <div class="tournament-pro-page__bracket">
                ${groupStages.map((stage, index) => `
                  <div class="tournament-pro-page__stage ${index === 0 ? "tournament-pro-page__stage--active" : "tournament-pro-page__stage--future"}" data-stage-index="${index + 1}" data-match-count="${stage.matches.length}" data-round-id="${escapeAttr(stage.id || `${bracketType}-round-${stage.number || index + 1}`)}">
                    <div class="tournament-pro-page__stage-heading">
                      <span class="tournament-pro-page__stage-index">${stage.bracket === "grand_final" ? "GF" : `R${stage.number || index + 1}`}</span>
                      <div><strong>${escapeHtml(stage.bracket === "grand_final" ? "GRAND FINAL" : stage.bracket === "losers" ? `RONDA ${stage.number}` : stage.number === 1 ? "PRIMERA RONDA" : `RONDA ${stage.number}`)}</strong></div>
                    </div>
                    <div class="tournament-pro-page__matches">
                      ${stage.matches.map((match) => renderMatchCard(match, { eventLive })).join("")}
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          </section>
        `;
      };

      const render = () => {
        const currentView = getWorkspaceView();
        const competitionView = getCompetitionView();
        const viewMeta = {
          dashboard: { title: game, subtitle: "" },
          competition: { title: "COMPETITION", subtitle: "Estructura competitiva" },
          operations: { title: "CHECK-IN", subtitle: "Preparación de participantes y asistencia" },
          results: { title: "RESULTS", subtitle: "Resultados oficiales" }
        }[currentView];
        const titleElement = page.querySelector(".tournament-pro-page__header h1");
        const subtitleElement = page.querySelector("[data-pro-message]");
        if (titleElement) titleElement.textContent = viewMeta.title;
        if (subtitleElement) subtitleElement.textContent = viewMeta.subtitle;
        const backButton = page.querySelector("[data-pro-back]");
        if (backButton) backButton.hidden = currentView === "dashboard";

        const stages = pro.bracket?.stages || [];
        const allCompetitionMatches = stages.flatMap((stage, stageIndex) =>
          (stage.matches || []).map((match, matchIndex) => ({
            match,
            stage,
            stageIndex,
            matchIndex,
            roundName: stage.bracket === "grand_final" ? "Grand Final" : (stage.name || `Round ${stage.number || stageIndex + 1}`)
          }))
        );
        const slots = Object.values(pro.bracket?.slots || {}).sort((a, b) => a.seed - b.seed);
        const participants = Object.values(pro.participants || {});
        const assigned = slots.filter((slot) => slot.participantId).length;
        const present = participants.filter((participant) => participant.checkIn === true).length;
        const noShows = participants.filter((participant) => participant.status === "no_show").length;
        const checkInOpen = pro.checkIn?.status === "open";
        const checkInCompleted = pro.checkIn?.status === "completed";
        const eventLive = pro.status === "live";
        const eventFinished = pro.status === "finished";
        const openMatches = stages
          .flatMap((stage) => stage.matches || [])
          .filter((match) => ["pending", "live"].includes(match.status));
        let officialResults = [];
        try {
          officialResults = getOfficialResults(pro);
        } catch {
          officialResults = [];
        }
        const canFinalize = eventLive && openMatches.length === 0 && officialResults.length > 0;
        const canStart = !eventLive && !eventFinished && !checkInOpen && !checkInCompleted && assigned >= 2;
        const canAddParticipant = !eventLive && !eventFinished && !checkInOpen && !checkInCompleted && assigned < Number(capacity || 0);
        const selectedSlot = slots.find((slot) => slot.seed && `seed-${slot.seed}` === selectedSlotId);
        const selectedParticipantName = selectedSlot?.participantId
          ? getParticipantName(selectedSlot.participantId)
          : "";

        const workspacePhases = getCompetitionWorkspaceModel();
        if (!workspacePhases.some((phase) => phase.id === selectedWorkspacePhaseId)) {
          selectedWorkspacePhaseId = workspacePhases[0]?.id || null;
        }
        const selectedWorkspacePhase = workspacePhases.find((phase) => phase.id === selectedWorkspacePhaseId) || workspacePhases[0] || null;
        if (!selectedWorkspacePhase?.structures?.some((structure) => structure.id === selectedWorkspaceStructureId)) {
          selectedWorkspaceStructureId = selectedWorkspacePhase?.structures?.[0]?.id || null;
        }
        const selectedWorkspaceStructure = selectedWorkspacePhase?.structures?.find((structure) => structure.id === selectedWorkspaceStructureId)
          || selectedWorkspacePhase?.structures?.[0]
          || null;
        const workspaceRounds = selectedWorkspaceStructure?.rounds || [];
        if (!workspaceRounds.some((round) => round.id === selectedWorkspaceRoundId)) {
          selectedWorkspaceRoundId = workspaceRounds[0]?.id || null;
        }
        const selectedWorkspaceRound = workspaceRounds.find((round) => round.id === selectedWorkspaceRoundId)
          || workspaceRounds[0]
          || null;
        const selectedWorkspaceMatches = Array.isArray(selectedWorkspaceRound?.matches) ? selectedWorkspaceRound.matches : [];
        const matchSelectionPool = competitionView === "structure"
          ? selectedWorkspaceMatches
          : allCompetitionMatches.map((item) => item.match);
        const competitionStations = getCompetitionStations(event);
        const competitionDeliveryMode = getCompetitionDeliveryMode(event);
        const competitionResourceLabel = competitionDeliveryMode === "physical" ? "estaciones" : "lobbies";
        const competitionResourceSingular = competitionDeliveryMode === "physical" ? "estación" : "lobby";
        const operationsModel = getCompetitionOperationsModel(event);
        if (!operationsModel.stations.some((station) => station.id === selectedOperationalStationId)) {
          selectedOperationalStationId = null;
        }
        const selectedOperationalStation = operationsModel.stations.find((station) => station.id === selectedOperationalStationId) || null;
        const selectedOperationalMatch = selectedOperationalStation?.currentMatchId
          ? allCompetitionMatches.find((item) => item.match?.id === selectedOperationalStation.currentMatchId)?.match || null
          : null;
        const selectedOperationalMatchGameSummary = getMatchGameSummary(selectedOperationalMatch);
        const selectedOperationalMatchPending = isMatchOperationPending(selectedOperationalMatch?.id);
        const operationalAssignableMatches = operationsModel.readyUnassigned;
        if (!matchSelectionPool.some((match) => match?.id === selectedWorkspaceMatchId)) {
          selectedWorkspaceMatchId = null;
        }
        const selectedWorkspaceMatch = matchSelectionPool.find((match) => match?.id === selectedWorkspaceMatchId) || null;
        const selectedWorkspaceMatchGameSummary = getMatchGameSummary(selectedWorkspaceMatch);
        const selectedWorkspaceMatchContext = selectedWorkspaceMatch
          ? allCompetitionMatches.find((item) => item.match?.id === selectedWorkspaceMatch.id) || null
          : null;
        const selectedWorkspaceMatchHasBoth = Boolean(
          selectedWorkspaceMatch?.participantAId && selectedWorkspaceMatch?.participantBId
        );
        const selectedWorkspaceMatchCanStart = Boolean(
          eventLive &&
          selectedWorkspaceMatchHasBoth &&
          selectedWorkspaceMatch.status === "pending"
        );
        const selectedWorkspaceMatchPending = isMatchOperationPending(selectedWorkspaceMatch?.id);
        const selectedWorkspaceMatchCanComplete = Boolean(
          eventLive &&
          selectedWorkspaceMatchHasBoth &&
          selectedWorkspaceMatch.status === "live"
        );

        const formatAdvancementDestination = (destination) => {
          if (!destination) return "Sin ruta definida";
          if (destination.type === "MATCH") {
            return `${destination.matchId || "Match"}${destination.slot ? ` · Slot ${destination.slot}` : ""}`;
          }
          if (destination.type === "CHAMPION") return "Campeón";
          if (destination.type === "ELIMINATED") return "Eliminado";
          return formatLabel(destination.type);
        };

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
            ? (participant.status === "no_show" ? "Asiento liberado" : participant.entityId || (participant.manual ? "Participante manual" : "Player/Team ARKHAM"))
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

        const totalMatches = stages.reduce((sum, stage) => sum + (stage.matches?.length || 0), 0);
        const totalRounds = workspaceRoundsCount(stages, workspacePhases);
        const primaryStructure = workspacePhases[0]?.structures?.[0] || null;
        const primaryStructureLabel = primaryStructure?.name || formatLabel(pro.bracket?.type || event.format || "Competition");

        const mobileExperienceModalMarkup = shouldShowMobileNotice() ? `
          <div class="tournament-pro-page__mobile-modal-backdrop" data-mobile-experience-modal>
            <section class="tournament-pro-page__mobile-modal" role="dialog" aria-modal="true" aria-labelledby="tournament-pro-mobile-title">
              <div class="tournament-pro-page__mobile-modal-icon"><i class="fa-solid fa-desktop" aria-hidden="true"></i></div>
              <span class="tournament-pro-page__eyebrow">EXPERIENCIA RECOMENDADA</span>
              <h2 id="tournament-pro-mobile-title">ARKHAM funciona en teléfono</h2>
              <p>Puedes continuar administrando desde tu teléfono. Para brackets, operación intensiva y varias tareas simultáneas, ARKHAM está pensado principalmente para <strong>desktop y tablet</strong>.</p>
              <button type="button" class="tournament-pro-page__mobile-modal-action" data-mobile-experience-dismiss>
                Continuar en teléfono
              </button>
            </section>
          </div>
        ` : "";

        const registrationCount = registrationRequests.length;
        const dashboardMarkup = `
          <section class="tournament-pro-page__dashboard tournament-pro-page__dashboard--v5">
            <div class="tournament-pro-page__dashboard-topline">
              <div>
                <span class="tournament-pro-page__eyebrow">TOURNAMENT OVERVIEW</span>
                <h2>${escapeHtml(game)}</h2>
                <span class="tournament-pro-page__dashboard-context">${escapeHtml(primaryStructureLabel)} · ${totalRounds} rounds · ${totalMatches} matches</span>
              </div>
              <span class="tournament-pro-page__dashboard-status">${escapeHtml(statusLabel)}</span>
            </div>

            <section class="tournament-pro-page__dashboard-workspaces tournament-pro-page__dashboard-workspaces--v5">
              <div class="tournament-pro-page__dashboard-section-heading">
                <span class="tournament-pro-page__eyebrow">WORKSPACES</span>
              </div>
              <div class="tournament-pro-page__workspace-grid--v5">
                <button type="button" class="tournament-pro-page__workspace-entry tournament-pro-page__workspace-entry--primary" data-workspace-view="operations">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-clipboard-check" aria-hidden="true"></i></span>
                  <span>
                    <strong>Check-in</strong>
                    <small>Solicitudes, participantes, asistencia y preparación.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry" data-workspace-view="competition">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-code-branch" aria-hidden="true"></i></span>
                  <span>
                    <strong>Competition / Bracket</strong>
                    <small>Fases, estructuras, rounds y cuadro competitivo.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry" data-workspace-view="results">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-trophy" aria-hidden="true"></i></span>
                  <span>
                    <strong>Resultados</strong>
                    <small>Resultados oficiales, posiciones y cierre.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry" data-configure-information>
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-gear" aria-hidden="true"></i></span>
                  <span>
                    <strong>Settings</strong>
                    <small>Configuración general del torneo.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>
              </div>
            </section>



          </section>
          ${mobileExperienceModalMarkup}
        `;

        const competitionCoreAuditMarkup = competitionCoreAuditLoading ? `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide">
            <div class="tournament-pro-page__workspace-header">
              <div>
                <span class="tournament-pro-page__eyebrow">COMPETITION CORE</span>
                <h2>Auditando bracket</h2>
                <p>Comparando el bracket operativo actual contra el modelo declarativo de Competition Core.</p>
              </div>
              <span class="tournament-pro-page__workspace-count">ANALIZANDO</span>
            </div>
          </section>
        ` : competitionCoreAudit ? `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide">
            <div class="tournament-pro-page__workspace-header">
              <div>
                <span class="tournament-pro-page__eyebrow">COMPETITION CORE</span>
                <h2>Audit de arquitectura</h2>
                <p>Diagnóstico de solo lectura. No modifica ni persiste el bracket operativo.</p>
              </div>
              <span class="tournament-pro-page__workspace-count">${escapeHtml(formatLabel(competitionCoreAudit.status || "—"))}</span>
            </div>
            <div class="tournament-pro-page__workspace-body">
              <div class="tournament-pro-page__structure-selector">
                <span class="tournament-pro-page__workspace-label">PIPELINE</span>
                <div class="tournament-pro-page__phase-flow">
                  ${[
                    ["GENERATION", competitionCoreAudit.generation?.status],
                    ["COMPARISON", competitionCoreAudit.comparison?.status],
                    ["READINESS", competitionCoreAudit.readiness?.status],
                    ["RECONCILIATION", competitionCoreAudit.reconciliation?.status]
                  ].map(([label, status]) => `
                    <div class="tournament-pro-page__phase-card ${status === "READY" || status === "MATCH" || status === "NOT_REQUIRED" ? "is-active" : ""}">
                      <span class="tournament-pro-page__phase-index">${escapeHtml(label.slice(0, 2))}</span>
                      <span class="tournament-pro-page__phase-card-copy">
                        <strong>${escapeHtml(label)}</strong>
                        <small>${escapeHtml(formatLabel(status || "NO EJECUTADO"))}</small>
                      </span>
                    </div>
                  `).join("")}
                </div>
              </div>
              <div class="tournament-pro-page__workspace-entry">
                <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-code-compare" aria-hidden="true"></i></span>
                <span>
                  <strong>Resultado del diagnóstico</strong>
                  <small>${escapeHtml((competitionCoreAudit.reasonCodes || []).length
                    ? competitionCoreAudit.reasonCodes.join(" · ")
                    : "No se detectaron códigos de bloqueo o diferencia.")}</small>
                </span>
              </div>
              ${competitionCoreAudit.comparison ? `
                <div class="tournament-pro-page__workspace-entry">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-list-check" aria-hidden="true"></i></span>
                  <span>
                    <strong>Detalle de matches comparados</strong>
                    <small>${escapeHtml(`${competitionCoreAudit.comparison.summary?.currentMatchCount || 0} actuales · ${competitionCoreAudit.comparison.summary?.generatedMatchCount || 0} generados · ${competitionCoreAudit.comparison.summary?.equivalentMatches || 0} equivalentes`)}</small>
                  </span>
                </div>
                ${renderAuditMatchList("Solo en el bracket actual", competitionCoreAudit.comparison.currentOnly)}
                ${renderAuditMatchList("Solo en Competition Core", competitionCoreAudit.comparison.generatedOnly)}
              ` : ""}
              ${competitionCoreAudit.generation?.summary ? `
                <div class="tournament-pro-page__workspace-entry">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-diagram-project" aria-hidden="true"></i></span>
                  <span>
                    <strong>Competition Core</strong>
                    <small>${escapeHtml(`${competitionCoreAudit.generation.summary.matchCount || 0} matches · ${competitionCoreAudit.generation.summary.roundCount || 0} rounds · ${competitionCoreAudit.generation.summary.winnerRoutes || 0} rutas de ganador · ${competitionCoreAudit.generation.summary.loserRoutes || 0} rutas de perdedor`)}</small>
                  </span>
                </div>
              ` : ""}
              <div class="tournament-pro-page__workspace-entry">
                <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></span>
                <span>
                  <strong>Acción recomendada por el pipeline</strong>
                  <button type="button" class="tournament-pro-page__primary-action" data-run-competition-core-migration-dry-run ${competitionCoreAudit.readiness?.status !== "READY" || competitionCoreAudit.reconciliation?.status !== "NOT_REQUIRED" ? "disabled" : ""}>
                    Simular migración sin guardar
                  </button>
                  <small>Se habilita cuando Readiness está lista y no hace falta reconciliación.</small>
                  <small>${escapeHtml(competitionCoreAudit.reconciliation?.status === "NOT_REQUIRED"
                    ? "El gráfico actual y el generado son equivalentes; todavía no se aplica ninguna migración."
                    : competitionCoreAudit.generation?.status === "INCOMPLETE"
                      ? "Competition Core todavía necesita una estructura declarativa válida para poder comparar el bracket."
                      : "El diagnóstico detectó diferencias o bloqueos. No se modifica el bracket operativo.")}</small>
                </span>
              </div>
              ${competitionCoreAudit.generation?.reasonCodes?.includes("STRUCTURE_NOT_FOUND") ? `
                <div class="tournament-pro-page__workspace-entry">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-link" aria-hidden="true"></i></span>
                  <span>
                    <strong>Preparar estructura declarativa</strong>
                    <small>Crea Phase → Structure → Round → Slot a partir del bracket actual. El bracket operativo legacy permanece intacto.</small>
                  </span>
                  <button type="button" class="tournament-pro-page__primary-action" data-sync-competition-core-structure>
                    Preparar estructura
                  </button>
                </div>
              ` : ""}
            </div>
          </section>
        ` : `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide">
            <div class="tournament-pro-page__workspace-header">
              <div>
                <span class="tournament-pro-page__eyebrow">COMPETITION CORE</span>
                <h2>Validar arquitectura competitiva</h2>
                <p>Ejecuta un diagnóstico de solo lectura antes de tocar el motor operativo actual.</p>
              </div>
              <button type="button" class="tournament-pro-page__primary-action" data-run-competition-core-audit>
                <i class="fa-solid fa-code-compare" aria-hidden="true"></i>
                Ejecutar audit
              </button>
            </div>
          </section>
        `;

        const competitionStructureMarkup = `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__competition-workspace">
            <div class="tournament-pro-page__workspace-header">
              <div>
                <span class="tournament-pro-page__eyebrow">COMPETENCIA</span>
                <h2>Main Competition</h2>
              </div>
              <div class="tournament-pro-page__workspace-path">
                <span>COMPETITION</span>
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                <strong>${escapeHtml(selectedWorkspacePhase?.name || "Sin fase")}</strong>
                ${selectedWorkspaceStructure ? `<i class="fa-solid fa-chevron-right" aria-hidden="true"></i><strong>${escapeHtml(selectedWorkspaceStructure.name)}</strong>` : ""}
              </div>
            </div>

            <div class="tournament-pro-page__phase-flow" role="tablist" aria-label="Fases de competencia">
              ${workspacePhases.map((phase, index) => `
                <button type="button" class="tournament-pro-page__phase-card ${phase.id === selectedWorkspacePhase?.id ? "is-active" : ""}" data-workspace-phase="${escapeAttr(phase.id)}" role="tab" aria-selected="${phase.id === selectedWorkspacePhase?.id}">
                  <span class="tournament-pro-page__phase-index">P${index + 1}</span>
                  <span class="tournament-pro-page__phase-card-copy">
                    <strong>${escapeHtml(phase.name)}</strong>
                    <small>${escapeHtml(formatLabel(phase.status || "configured"))}${phase.legacy ? " · compatibilidad legacy" : ""}</small>
                  </span>
                  ${index < workspacePhases.length - 1 ? `<i class="fa-solid fa-arrow-right tournament-pro-page__phase-arrow" aria-hidden="true"></i>` : ""}
                </button>
              `).join("")}
            </div>

            ${selectedWorkspacePhase ? `
              <div class="tournament-pro-page__workspace-body">
                <div class="tournament-pro-page__structure-selector" role="tablist" aria-label="Competition structures">
                  <span class="tournament-pro-page__workspace-label">STRUCTURES</span>
                  <div class="tournament-pro-page__structure-tabs">
                    ${selectedWorkspacePhase.structures.map((structure) => `
                      <button type="button" class="tournament-pro-page__structure-tab ${structure.id === selectedWorkspaceStructure?.id ? "is-active" : ""}" data-workspace-structure="${escapeAttr(structure.id)}" role="tab" aria-selected="${structure.id === selectedWorkspaceStructure?.id}">
                        <span class="tournament-pro-page__structure-icon"><i class="fa-solid ${structure.type === "DOUBLE_ELIMINATION" ? "fa-code-branch" : "fa-diagram-project"}" aria-hidden="true"></i></span>
                        <span class="tournament-pro-page__structure-tab-copy">
                          <strong>${escapeHtml(structure.name)}</strong>
                          <small>${escapeHtml(formatLabel(structure.type || "Structure"))}</small>
                        </span>
                      </button>
                    `).join("")}
                  </div>
                </div>

                <div class="tournament-pro-page__structure-detail">
                  <div class="tournament-pro-page__structure-detail-header">
                    <div>
                      <span class="tournament-pro-page__eyebrow">STRUCTURE</span>
                      <h3>${escapeHtml(selectedWorkspaceStructure?.name || "Sin estructura")}</h3>
                      <p>${escapeHtml(formatLabel(selectedWorkspaceStructure?.type || "Structure"))} · ${selectedWorkspaceStructure?.legacy ? "derivada del bracket actual" : "configurada en Competition Core"}</p>
                    </div>
                    <span class="tournament-pro-page__workspace-count">${selectedWorkspaceStructure?.rounds?.length || 0} rounds</span>
                  </div>

                  <div class="tournament-pro-page__round-grid">
                    ${(workspaceRounds).map((round, index) => {
                      const roundMatches = Array.isArray(round.matches) ? round.matches : [];
                      const roundBracket = round.bracket ? formatLabel(round.bracket) : "Competition";
                      const matchCount = roundMatches.length || stages.filter((stage) => stage.number === round.number && (!round.bracket || stage.bracket === round.bracket)).reduce((total, stage) => total + (stage.matches?.length || 0), 0);
                      const roundId = round.id || `${round.bracket || "round"}-round-${round.number || index + 1}`;
                      return `
                        <button type="button" class="tournament-pro-page__round-card ${roundId === selectedWorkspaceRound?.id ? "is-active" : ""}" data-workspace-round="${escapeAttr(roundId)}">
                          <span class="tournament-pro-page__round-number">${round.bracket === "grand_final" ? "GF" : `R${escapeHtml(String(round.number || index + 1))}`}</span>
                          <span class="tournament-pro-page__round-copy">
                            <strong>${escapeHtml(round.name || `Round ${index + 1}`)}</strong>
                            <small>${escapeHtml(roundBracket)} · ${matchCount} ${matchCount === 1 ? "match" : "matches"}</small>
                          </span>
                          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                        </button>
                      `;
                    }).join("") || `<div class="tournament-pro-page__workspace-empty">Esta estructura todavía no tiene rounds materializados.</div>`}
                  </div>

                  ${selectedWorkspaceRound ? `
                    <div class="tournament-pro-page__round-detail">
                      <div class="tournament-pro-page__round-detail-header">
                        <div>
                          <span class="tournament-pro-page__eyebrow">ROUND</span>
                          <h4>${escapeHtml(selectedWorkspaceRound.name)}</h4>
                          <p>${escapeHtml(formatLabel(selectedWorkspaceRound.bracket || "competition"))} · ${selectedWorkspaceRound.matches?.length || 0} matches</p>
                        </div>
                        <button type="button" class="tournament-pro-page__round-open" data-open-bracket-round="${escapeAttr(selectedWorkspaceRound.id || "")}">
                          Ver en bracket <i class="fa-solid fa-arrow-down" aria-hidden="true"></i>
                        </button>
                      </div>
                      <div class="tournament-pro-page__round-matches">
                        ${(selectedWorkspaceRound.matches || []).map((match) => {
                          const advancement = getMatchAdvancement(match, pro.bracket || {});
                          const aName = getParticipantName(match.participantAId);
                          const bName = getParticipantName(match.participantBId);
                          return `
                            <button type="button" class="tournament-pro-page__round-match ${match.id === selectedWorkspaceMatch?.id ? "is-active" : ""}" data-workspace-match="${escapeAttr(match.id || "")}">
                              <span class="tournament-pro-page__round-match-main">
                                <span class="tournament-pro-page__round-match-id">${escapeHtml(match.id || "MATCH")}</span>
                                <strong>${escapeHtml(aName)}</strong>
                                <span class="tournament-pro-page__round-match-vs">vs</span>
                                <strong>${escapeHtml(bName)}</strong>
                              </span>
                              <span class="tournament-pro-page__round-match-meta">
                                <span>${escapeHtml(matchStatusLabel(match.status))}</span>
                                <small>W → ${escapeHtml(formatAdvancementDestination(advancement?.winnerDestination))}</small>
                                <small>L → ${escapeHtml(formatAdvancementDestination(advancement?.loserDestination))}</small>
                              </span>
                            </button>
                          `;
                        }).join("") || `<div class="tournament-pro-page__workspace-empty">Este round todavía no tiene matches.</div>`}
                      </div>

                      ${selectedWorkspaceMatch ? `
                        <article class="tournament-pro-page__match-workspace">
                          <div class="tournament-pro-page__match-workspace-header">
                            <div>
                              <span class="tournament-pro-page__eyebrow">MATCH</span>
                              <h5>${escapeHtml(selectedWorkspaceMatch.id || "Match")}</h5>
                              <p>${escapeHtml(formatLabel(selectedWorkspaceMatch.bracket || selectedWorkspaceRound.bracket || "competition"))} · ${escapeHtml(selectedWorkspaceRound.name || "Round")}</p>
                            </div>
                            <span class="tournament-pro-page__match-workspace-status">${escapeHtml(matchStatusLabel(selectedWorkspaceMatch.status))}</span>
                          </div>

                          <div class="tournament-pro-page__match-workspace-players">
                            <div class="tournament-pro-page__match-workspace-player">
                              <span>PLAYER A</span>
                              <strong>${escapeHtml(getParticipantName(selectedWorkspaceMatch.participantAId))}</strong>
                              <small>${selectedWorkspaceMatch.winnerId === selectedWorkspaceMatch.participantAId ? "Ganador" : ""}</small>
                            </div>
                            <div class="tournament-pro-page__match-workspace-vs">VS</div>
                            <div class="tournament-pro-page__match-workspace-player is-right">
                              <span>PLAYER B</span>
                              <strong>${escapeHtml(getParticipantName(selectedWorkspaceMatch.participantBId))}</strong>
                              <small>${selectedWorkspaceMatch.winnerId === selectedWorkspaceMatch.participantBId ? "Ganador" : ""}</small>
                            </div>
                          </div>

                          <div class="tournament-pro-page__match-workspace-grid">
                            <div>
                              <span>FORMATO</span>
                              <strong>${escapeHtml(formatLabel(selectedWorkspaceMatch.matchSystem || selectedWorkspaceStructure?.matchFormat || pro.matchSystem || event.matchSystem || "—"))}</strong>
                            </div>
                            <div>
                              <span>RESULTADO</span>
                              <strong>${selectedWorkspaceMatch.score ? escapeHtml(formatScore(selectedWorkspaceMatch.score)) : "Pendiente"}</strong>
                            </div>
                            <div>
                              <span>WINNER</span>
                              <strong>${escapeHtml(formatAdvancementDestination(getMatchAdvancement(selectedWorkspaceMatch, pro.bracket || {})?.winnerDestination))}</strong>
                            </div>
                            <div>
                              <span>LOSER</span>
                              <strong>${escapeHtml(formatAdvancementDestination(getMatchAdvancement(selectedWorkspaceMatch, pro.bracket || {})?.loserDestination))}</strong>
                            </div>
                          </div>

                          <div class="tournament-pro-page__match-workspace-actions">
                            <button type="button" class="tournament-pro-page__round-open" data-open-bracket-match="${escapeAttr(selectedWorkspaceMatch.id || "")}">
                              Ver en bracket <i class="fa-solid fa-arrow-down" aria-hidden="true"></i>
                            </button>
                          </div>
                        </article>
                      ` : ""}
                    </div>
                  ` : ""}
                </div>
              </div>
            ` : `<div class="tournament-pro-page__workspace-empty">No hay fases configuradas para esta competencia.</div>`}
          </section>

        `;

        const currentCheckInView = checkInOpen || checkInCompleted ? "checkin" : getCheckInView();
        const capacityValue = Number(capacity || 0);
        const pendingCheckIn = Math.max(assigned - present - noShows, 0);
        const seatsRemaining = Math.max(capacityValue - assigned, 0);
        const canOpenCheckIn = !eventLive && !eventFinished && !checkInOpen && !checkInCompleted && capacityValue >= 2 && assigned >= capacityValue;
        const checkInStepLabel = currentCheckInView === "checkin" ? "Confirma asistencia y prepara el inicio" : "Completa los participantes para abrir el check-in";

        const participantListMarkup = `
          <section class="tournament-pro-page__checkin-panel tournament-pro-page__checkin-panel--participants">
            <div class="tournament-pro-page__checkin-panel-header">
              <div>
                <span class="tournament-pro-page__eyebrow">PASO 1 · PARTICIPANTES</span>
                <h3>Completa los asientos</h3>
                <p>Agrega jugadores o equipos manualmente y asigna las solicitudes aceptadas. El check-in se abre cuando los asientos están completos.</p>
              </div>
              <div class="tournament-pro-page__checkin-panel-actions">
                <div class="tournament-pro-page__checkin-metrics">
                  <strong>${assigned} / ${escapeHtml(capacity)}</strong><span>asientos ocupados</span>
                </div>
                <button type="button" class="tournament-pro-page__primary-action tournament-pro-page__participant-add-action" data-late-add ${canAddParticipant ? "" : "disabled"}>
                  <i class="fa-solid fa-user-plus" aria-hidden="true"></i> Agregar participante
                </button>
              </div>
            </div>
            <div class="tournament-pro-page__participant-list">
              ${participants.map((participant) => {
                const slot = Object.values(pro.bracket?.slots || {}).find((item) => item.participantId === participant.id);
                return `
                  <article class="tournament-pro-page__participant">
                    <div class="tournament-pro-page__participant-main">
                      <strong>${escapeHtml(participant.displayName || participant.id)}</strong>
                      <span>${escapeHtml(participant.entityId || (participant.manual ? "Participante manual" : "Player/Team ARKHAM"))}${slot ? ` · Seed ${escapeHtml(String(slot.seed))}` : ""}</span>
                    </div>
                    <div class="tournament-pro-page__participant-status">
                      <span class="tournament-pro-page__registration-badge">Asignado</span>
                      ${!eventLive && !eventFinished && !checkInOpen && !checkInCompleted ? `<button type="button" data-replace="${escapeAttr(participant.id)}">Reemplazar</button>` : ""}
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
                const canChange = checkInOpen && !eventLive && !eventFinished;
                return `
                  <article class="tournament-pro-page__participant ${isPresent ? "is-present" : isNoShow ? "is-no-show" : ""}">
                    <div class="tournament-pro-page__participant-main">
                      <strong>${escapeHtml(participant.displayName || participant.id)}</strong>
                      <span>${escapeHtml(participant.entityId || (participant.manual ? "Participante manual" : "Player/Team ARKHAM"))}</span>
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

        const preparationMarkup = `
          <div class="tournament-pro-page__checkin-preparation-grid">
            ${requestsMarkup}
            ${participantListMarkup}
          </div>
          <div class="tournament-pro-page__checkin-next-step">
            <div>
              <span class="tournament-pro-page__eyebrow">SIGUIENTE PASO</span>
              <strong>${canOpenCheckIn ? "Todos los asientos están ocupados" : `Faltan ${seatsRemaining} asientos por asignar`}</strong>
              <p>${canOpenCheckIn ? "Ya puedes abrir el check-in y confirmar quién está presente." : "Acepta solicitudes o agrega participantes manualmente hasta completar la capacidad."}</p>
            </div>
            <button type="button" data-action="start-tournament" ${canOpenCheckIn ? "" : "disabled"}>
              <i class="fa-solid fa-clipboard-check" aria-hidden="true"></i> Abrir check-in
            </button>
          </div>
        `;

        const operationsMarkup = `
          <section class="tournament-pro-page__checkin-workspace">
            <header class="tournament-pro-page__checkin-workspace-header">
              <div>
                <span class="tournament-pro-page__eyebrow">CHECK-IN</span>
                <h2>${currentCheckInView === "checkin" ? "Confirmar asistencia" : "Preparar participantes"}</h2>
                <p>${currentCheckInView === "checkin" ? "Revisa la asistencia final antes de iniciar el torneo." : "Primero completa los participantes. Después abrirás el check-in para confirmar asistencia."}</p>
              </div>
              <span class="tournament-pro-page__status">${escapeHtml(statusLabel)}</span>
            </header>

            <div class="tournament-pro-page__checkin-summary-grid">
              <div><span>PARTICIPANTES</span><strong>${assigned} / ${escapeHtml(capacity)}</strong></div>
              <div><span>SOLICITUDES</span><strong>${registrationCount}</strong></div>
              <div><span>ASISTENCIA</span><strong>${present} / ${assigned}</strong></div>
              <div><span>ESTADO</span><strong>${checkInOpen ? "En curso" : checkInCompleted ? "Completado" : eventLive ? "En vivo" : "Preparación"}</strong></div>
            </div>

            ${checkInCompleted && !eventLive && !eventFinished ? `
              <div class="tournament-pro-page__operation-bar">
                <div><strong>Todo listo para comenzar</strong><span>${present} participantes confirmados. El bracket puede iniciar.</span></div>
                <button type="button" data-action="live" ${present >= 2 ? "" : "disabled"}><i class="fa-solid fa-play" aria-hidden="true"></i> Iniciar torneo</button>
              </div>
            ` : eventLive ? `
              <div class="tournament-pro-page__operation-bar">
                <div><strong>Competencia en vivo</strong><span>La preparación terminó. Los cambios de participantes están protegidos.</span></div>
                <button type="button" data-workspace-view="competition"><i class="fa-solid fa-code-branch" aria-hidden="true"></i> Abrir bracket</button>
              </div>
            ` : eventFinished ? `
              <div class="tournament-pro-page__operation-bar"><div><strong>Torneo finalizado</strong><span>La información histórica permanece disponible.</span></div></div>
            ` : ""}

            ${currentCheckInView === "checkin" ? checkInListMarkup : preparationMarkup}
          </section>

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
                    <label class="tournament-pro-page__modal-label">Buscar en ARKHAM</label>
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
                    <span><strong>Agregar participante manual</strong><small>Úsalo si no tiene perfil en ARKHAM.</small></span>
                    <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                  </button>
                </div>
              </section>
            </div>
          ` : ""}
        `;

        const competitionBracketStages = {
          winners: stages.filter((stage) => stage.bracket === "winners"),
          losers: stages.filter((stage) => stage.bracket === "losers"),
          grandFinal: stages.filter((stage) => stage.bracket === "grand_final")
        };
        const singleEliminationStages = stages.filter((stage) => !["losers", "grand_final"].includes(stage.bracket));

        const competitionBracketMarkup = `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__competition-workspace">
            <div class="tournament-pro-page__workspace-header">
              <div>
                <span class="tournament-pro-page__eyebrow">BRACKET</span>
                <h2>Cuadro competitivo</h2>
              </div>
              <div class="tournament-pro-page__workspace-path">
                <span>COMPETITION</span>
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                <strong>BRACKET</strong>
              </div>
            </div>
            ${competitionBracketStages.winners.length || competitionBracketStages.losers.length || competitionBracketStages.grandFinal.length
              ? `${competitionBracketStages.winners.length ? renderAdminBracketGroup(competitionBracketStages.winners, "winners", pro, eventLive) : singleEliminationStages.length ? renderAdminBracketGroup(singleEliminationStages, "winners", pro, eventLive) : ""}
                 ${competitionBracketStages.losers.length ? renderAdminBracketGroup(competitionBracketStages.losers, "losers", pro, eventLive) : ""}
                 ${competitionBracketStages.grandFinal.length ? renderAdminBracketGroup(competitionBracketStages.grandFinal, "grand_final", pro, eventLive) : ""}`
              : `<div class="tournament-pro-page__workspace-empty">Todavía no hay un bracket generado.</div>`}
          </section>
        `;

        const selectedMatchStation = selectedWorkspaceMatch
          ? competitionStations.find((station) => station.currentMatchId === selectedWorkspaceMatch.id) || null
          : null;

        const competitionMatchesMarkup = `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__competition-workspace">
            <div class="tournament-pro-page__workspace-header">
              <div>
                <span class="tournament-pro-page__eyebrow">OPERATIONS</span>
                <h2>${competitionDeliveryMode === "physical" ? "Operación de estaciones" : "Operación de lobbies"}</h2>
                <p class="tournament-pro-page__workspace-description">Opera el evento desde los recursos físicos. Asigna aquí los matches que estén listos; los matches que dependan de otro resultado permanecen en espera.</p>
              </div>
              <div class="tournament-pro-page__workspace-header-actions">
                <span class="tournament-pro-page__workspace-count">${operationsModel.summary.stations} ${competitionResourceLabel}</span>
                <button type="button" class="tournament-pro-page__primary-action" data-action="create-station">
                  <i class="fa-solid fa-plus" aria-hidden="true"></i> Añadir ${competitionResourceSingular}
                </button>
              </div>
            </div>

            <div class="tournament-pro-page__operations-summary">
              <div><span>EN JUEGO</span><strong>${operationsModel.summary.activeMatches}</strong></div>
              <div><span>LISTOS</span><strong>${operationsModel.summary.readyMatches}</strong></div>
              <div><span>ESPERANDO</span><strong>${operationsModel.summary.waitingMatches}</strong></div>
              <div><span>LIBRES</span><strong>${operationsModel.summary.freeStations}</strong></div>
            </div>

            <section class="tournament-pro-page__resource-panel tournament-pro-page__resource-panel--operations">
              <div class="tournament-pro-page__resource-panel-header">
                <div>
                  <span class="tournament-pro-page__eyebrow">ESTACIONES</span>
                  <h3>${competitionDeliveryMode === "physical" ? "¿Qué está pasando en cada estación?" : "¿Qué está pasando en cada lobby?"}</h3>
                </div>
                <span class="tournament-pro-page__workspace-count">${operationsModel.summary.occupiedStations}/${operationsModel.summary.stations} ocupadas</span>
              </div>
              ${operationsModel.stations.length ? `
                <div class="tournament-pro-page__operations-stations">
                  ${operationsModel.stations.map((station) => {
                    const stationMatch = station.currentMatchId
                      ? allCompetitionMatches.find((item) => item.match?.id === station.currentMatchId)?.match || null
                      : null;
                    const operationalStatus = stationMatch?.status === "live" ? "EN JUEGO" : stationMatch ? "ASIGNADA" : "LIBRE";
                    return `
                      <button type="button" class="tournament-pro-page__operation-station ${stationMatch ? "is-occupied" : "is-free"} ${stationMatch?.status === "live" ? "is-live" : ""}" data-operational-station="${escapeAttr(station.id)}">
                        <span class="tournament-pro-page__operation-station-top">
                          <span class="tournament-pro-page__resource-card-index">${escapeHtml(String(station.number).padStart(2, "0"))}</span>
                          <span class="tournament-pro-page__resource-card-status">${operationalStatus}</span>
                        </span>
                        <span class="tournament-pro-page__operation-station-name">${escapeHtml(station.name)}</span>
                        ${stationMatch ? `
                          <span class="tournament-pro-page__operation-station-match">
                            <strong>${escapeHtml(getParticipantName(stationMatch.participantAId))}</strong>
                            <span>VS</span>
                            <strong>${escapeHtml(getParticipantName(stationMatch.participantBId))}</strong>
                          </span>
                          <small>${escapeHtml(stationMatch.id)} · ${escapeHtml(matchStatusLabel(stationMatch.status))}</small>
                        ` : `
                          <span class="tournament-pro-page__operation-station-empty">Asignar un match listo</span>
                        `}
                      </button>
                    `;
                  }).join("")}
                </div>
              ` : `
                <div class="tournament-pro-page__workspace-empty">Añade ${competitionResourceLabel} para comenzar a operar el evento.</div>
              `}
            </section>

            <div class="tournament-pro-page__operations-columns">
              <section class="tournament-pro-page__operations-list">
                <div class="tournament-pro-page__operations-list-header">
                  <div>
                    <span class="tournament-pro-page__eyebrow">READY</span>
                    <h3>Matches listos para jugar</h3>
                  </div>
                  <span>${operationalAssignableMatches.length}</span>
                </div>
                ${operationalAssignableMatches.length ? operationalAssignableMatches.slice(0, 8).map(({ match, stage }) => `
                  <button type="button" class="tournament-pro-page__operation-match" data-open-operation-match="${escapeAttr(match.id)}">
                    <span class="tournament-pro-page__operation-match-id">${escapeHtml(match.id)}</span>
                    <span class="tournament-pro-page__operation-match-players">
                      <strong>${escapeHtml(getParticipantName(match.participantAId))}</strong>
                      <span>VS</span>
                      <strong>${escapeHtml(getParticipantName(match.participantBId))}</strong>
                    </span>
                    <small>${escapeHtml(stage?.bracket === "grand_final" ? "Grand Final" : formatLabel(stage?.bracket || "Winners"))} · Round ${escapeHtml(String(stage?.number || "—"))}</small>
                  </button>
                `).join("") : `
                  <div class="tournament-pro-page__operations-empty">No hay matches listos sin asignar.</div>
                `}
              </section>

              <section class="tournament-pro-page__operations-list">
                <div class="tournament-pro-page__operations-list-header">
                  <div>
                    <span class="tournament-pro-page__eyebrow">WAITING</span>
                    <h3>Matches que todavía dependen de algo</h3>
                  </div>
                  <span>${operationsModel.waiting.length}</span>
                </div>
                ${operationsModel.waiting.length ? operationsModel.waiting.slice(0, 8).map(({ match, reason }) => `
                  <button type="button" class="tournament-pro-page__operation-match is-waiting${reason.code === "NEXT_MATCH" ? " is-next-match" : reason.code === "WAITING_FOR_PARTICIPANT" ? " is-waiting-rival" : ""}" data-open-operation-match="${escapeAttr(match.id)}">
                    <span class="tournament-pro-page__operation-match-id">${escapeHtml(match.id)}</span>
                    <span class="tournament-pro-page__operation-match-players">
                      <strong>${escapeHtml(getParticipantName(match.participantAId))}</strong>
                      <span>VS</span>
                      <strong>${escapeHtml(getParticipantName(match.participantBId))}</strong>
                    </span>
                    <small>${escapeHtml(reason.label)}</small>
                  </button>
                `).join("") : `
                  <div class="tournament-pro-page__operations-empty">No hay matches esperando.</div>
                `}
              </section>
            </div>

            ${selectedWorkspaceMatch ? `
              <article class="tournament-pro-page__match-workspace tournament-pro-page__match-workspace--operations">
                <div class="tournament-pro-page__match-workspace-header">
                  <div>
                    <span class="tournament-pro-page__eyebrow">MATCH</span>
                    <h3>${escapeHtml(selectedWorkspaceMatch.id || "Match")}</h3>
                    <p>${escapeHtml(formatLabel(selectedWorkspaceMatch.bracket || "competition"))} · ${escapeHtml(selectedWorkspaceMatchContext?.stage?.name || `Round ${selectedWorkspaceMatchContext?.stage?.number || "—"}`)}</p>
                  </div>
                  <span class="tournament-pro-page__match-workspace-status">${escapeHtml(matchStatusLabel(selectedWorkspaceMatch.status))}</span>
                </div>

                <div class="tournament-pro-page__match-workspace-players">
                  <div class="tournament-pro-page__match-workspace-player">
                    <span>PLAYER A</span>
                    <strong>${escapeHtml(getParticipantName(selectedWorkspaceMatch.participantAId))}</strong>
                  </div>
                  <div class="tournament-pro-page__match-workspace-vs">VS</div>
                  <div class="tournament-pro-page__match-workspace-player is-right">
                    <span>PLAYER B</span>
                    <strong>${escapeHtml(getParticipantName(selectedWorkspaceMatch.participantBId))}</strong>
                  </div>
                </div>

                <div class="tournament-pro-page__match-workspace-grid">
                  <div><span>ESTACIÓN</span><strong>${escapeHtml(selectedMatchStation?.name || "Sin estación")}</strong></div>
                  <div><span>FORMATO</span><strong>${escapeHtml(formatLabel(selectedWorkspaceMatch.matchSystem || pro.matchSystem || event.matchSystem || "—"))}</strong></div>
                  <div><span>RESULTADO</span><strong>${selectedWorkspaceMatch.score ? escapeHtml(formatScore(selectedWorkspaceMatch.score)) : "Pendiente"}</strong></div>
                  <div><span>ESTADO</span><strong>${escapeHtml(matchStatusLabel(selectedWorkspaceMatch.status))}</strong></div>
                </div>

                ${selectedWorkspaceMatch.status === "live" ? `
                  <section class="tournament-pro-page__match-series-panel tournament-pro-page__match-series-panel--workspace" aria-label="Progreso de la serie">
                    <div class="tournament-pro-page__match-series-panel-header">
                      <div>
                        <span class="tournament-pro-page__eyebrow">SERIE EN CURSO</span>
                        <strong>Games ${selectedWorkspaceMatchGameSummary.winsA} — ${selectedWorkspaceMatchGameSummary.winsB}</strong>
                      </div>
                      <span class="tournament-pro-page__match-series-next-badge">GAME ${selectedWorkspaceMatchGameSummary.nextGameNumber}</span>
                    </div>
                    <div class="tournament-pro-page__match-series-progress">
                      <div>
                        <span>ÚLTIMO GAME</span>
                        <strong>${selectedWorkspaceMatchGameSummary.lastGame ? `GAME ${selectedWorkspaceMatchGameSummary.games.length}` : "NINGUNO"}</strong>
                        <small>${selectedWorkspaceMatchGameSummary.lastGame
                          ? `${selectedWorkspaceMatchGameSummary.lastWinnerSide === "A"
                            ? escapeHtml(getParticipantName(selectedWorkspaceMatch.participantAId))
                            : selectedWorkspaceMatchGameSummary.lastWinnerSide === "B"
                              ? escapeHtml(getParticipantName(selectedWorkspaceMatch.participantBId))
                              : "Resultado registrado"} ganó`
                          : "Aún no hay Games registrados"}</small>
                      </div>
                      <div class="tournament-pro-page__match-series-arrow" aria-hidden="true">→</div>
                      <div class="is-next">
                        <span>AHORA</span>
                        <strong>GAME ${selectedWorkspaceMatchGameSummary.nextGameNumber}</strong>
                        <small>Listo para registrar</small>
                      </div>
                    </div>
                  </section>
                ` : ""}

                <div class="tournament-pro-page__match-workspace-actions">
                  ${selectedWorkspaceMatchCanStart && selectedMatchStation ? `<button type="button" class="tournament-pro-page__primary-action" data-start-match="${escapeAttr(selectedWorkspaceMatch.id || "")}"><i class="fa-solid fa-play" aria-hidden="true"></i> Iniciar match</button>` : ""}
                  ${selectedWorkspaceMatchCanComplete ? `
                    <div class="tournament-pro-page__score-inputs">
                      <label><span>A</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-score-a="${escapeAttr(selectedWorkspaceMatch.id || "")}"></label>
                      <span class="tournament-pro-page__score-separator">—</span>
                      <label><span>B</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-score-b="${escapeAttr(selectedWorkspaceMatch.id || "")}"></label>
                    </div>
                    ${selectedWorkspaceMatchPending ? `<span class="tournament-pro-page__match-helper">Guardando resultado… Game ${escapeHtml(String(selectedWorkspaceMatchGameSummary.nextGameNumber))} quedará disponible al confirmar la persistencia.</span>` : ""}
                    <button type="button" data-winner="${escapeAttr(selectedWorkspaceMatch.participantAId || "")}" data-match="${escapeAttr(selectedWorkspaceMatch.id || "")}" ${selectedWorkspaceMatchPending ? "disabled" : ""}>Ganó ${escapeHtml(getParticipantName(selectedWorkspaceMatch.participantAId))}</button>
                    <button type="button" data-winner="${escapeAttr(selectedWorkspaceMatch.participantBId || "")}" data-match="${escapeAttr(selectedWorkspaceMatch.id || "")}" ${selectedWorkspaceMatchPending ? "disabled" : ""}>Ganó ${escapeHtml(getParticipantName(selectedWorkspaceMatch.participantBId))}</button>
                  ` : ""}
                  ${!selectedWorkspaceMatchCanStart && selectedWorkspaceMatch.status === "pending" && !selectedMatchStation ? `<span class="tournament-pro-page__match-helper">Asigna una estación antes de iniciar este match.</span>` : ""}
                </div>
              </article>
            ` : ""}

            ${selectedOperationalStation ? `
              <div class="tournament-pro-page__modal-backdrop" data-operation-station-backdrop>
                <aside class="tournament-pro-page__modal tournament-pro-page__operations-modal" role="dialog" aria-modal="true" aria-label="${escapeAttr(selectedOperationalStation.name)}">
                  <header class="tournament-pro-page__modal-header">
                    <div>
                      <span class="tournament-pro-page__eyebrow">${escapeHtml(competitionDeliveryMode === "physical" ? "STATION" : "LOBBY")}</span>
                      <h2>${escapeHtml(selectedOperationalStation.name)}</h2>
                      <p>${selectedOperationalMatch ? "Recurso ocupado" : "Recurso disponible"}</p>
                    </div>
                    <button type="button" class="tournament-pro-page__modal-close" data-operation-station-close aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                  </header>
                  <div class="tournament-pro-page__modal-body">
                    ${selectedOperationalMatch ? `
                      <div class="tournament-pro-page__operations-current-match tournament-pro-page__operations-current-match--active">
                        <div class="tournament-pro-page__match-workspace-header">
                          <div>
                            <span class="tournament-pro-page__eyebrow">CONTROL DEL MATCH</span>
                            <strong>${escapeHtml(selectedOperationalMatch.id)}</strong>
                            <small>${escapeHtml(selectedOperationalMatch.status === "pending" ? "Listo para iniciar" : matchStatusLabel(selectedOperationalMatch.status))}</small>
                          </div>
                          <span class="tournament-pro-page__match-workspace-status">${escapeHtml(matchStatusLabel(selectedOperationalMatch.status))}</span>
                        </div>

                        <div class="tournament-pro-page__match-workspace-players">
                          <div class="tournament-pro-page__match-workspace-player">
                            <span>PLAYER A</span>
                            <strong>${escapeHtml(getParticipantName(selectedOperationalMatch.participantAId))}</strong>
                          </div>
                          <div class="tournament-pro-page__match-workspace-vs">VS</div>
                          <div class="tournament-pro-page__match-workspace-player is-right">
                            <span>PLAYER B</span>
                            <strong>${escapeHtml(getParticipantName(selectedOperationalMatch.participantBId))}</strong>
                          </div>
                        </div>

                        <div class="tournament-pro-page__match-workspace-grid">
                          <div><span>ESTACIÓN</span><strong>${escapeHtml(selectedOperationalStation.name)}</strong></div>
                          <div><span>FORMATO</span><strong>${escapeHtml(formatLabel(selectedOperationalMatch.matchSystem || pro.matchSystem || event.matchSystem || "—"))}</strong></div>
                          <div><span>RESULTADO</span><strong>${selectedOperationalMatch.score ? escapeHtml(formatScore(selectedOperationalMatch.score)) : "Pendiente"}</strong></div>
                          <div><span>ESTADO</span><strong>${escapeHtml(matchStatusLabel(selectedOperationalMatch.status))}</strong></div>
                        </div>

                        ${selectedOperationalMatch.status === "live" ? `
                          <section class="tournament-pro-page__match-series-panel" aria-label="Progreso de la serie">
                            <div class="tournament-pro-page__match-series-panel-header">
                              <div>
                                <span class="tournament-pro-page__eyebrow">SERIE EN CURSO</span>
                                <strong>Games ${selectedOperationalMatchGameSummary.winsA} — ${selectedOperationalMatchGameSummary.winsB}</strong>
                              </div>
                              <span class="tournament-pro-page__match-series-next-badge">
                                GAME ${selectedOperationalMatchGameSummary.nextGameNumber}
                              </span>
                            </div>

                            <div class="tournament-pro-page__match-series-progress">
                              <div>
                                <span>ÚLTIMO GAME</span>
                                <strong>${selectedOperationalMatchGameSummary.lastGame ? `GAME ${selectedOperationalMatchGameSummary.games.length}` : "NINGUNO"}</strong>
                                <small>${selectedOperationalMatchGameSummary.lastGame
                                  ? `${selectedOperationalMatchGameSummary.lastWinnerSide === "A"
                                    ? escapeHtml(getParticipantName(selectedOperationalMatch.participantAId))
                                    : selectedOperationalMatchGameSummary.lastWinnerSide === "B"
                                      ? escapeHtml(getParticipantName(selectedOperationalMatch.participantBId))
                                      : "Resultado registrado"} ganó`
                                  : "Aún no hay Games registrados"}</small>
                              </div>
                              <div class="tournament-pro-page__match-series-arrow" aria-hidden="true">→</div>
                              <div class="is-next">
                                <span>AHORA</span>
                                <strong>GAME ${selectedOperationalMatchGameSummary.nextGameNumber}</strong>
                                <small>Registra el siguiente Game de la serie</small>
                              </div>
                            </div>

                            <div class="tournament-pro-page__match-series-meta">
                              <span>Serie: <strong>${selectedOperationalMatchGameSummary.winsA} — ${selectedOperationalMatchGameSummary.winsB}</strong></span>
                              <span>Games registrados: <strong>${selectedOperationalMatchGameSummary.games.length}</strong></span>
                            </div>
                          </section>
                        ` : ""}

                        ${selectedOperationalMatch.status === "pending" ? `
                          <div class="tournament-pro-page__operations-modal-actions">
                            <button type="button" class="tournament-pro-page__primary-action" data-start-match="${escapeAttr(selectedOperationalMatch.id)}">
                              <i class="fa-solid fa-play" aria-hidden="true"></i> Iniciar match
                            </button>
                            <button type="button" data-release-station="${escapeAttr(selectedOperationalMatch.id)}">Liberar ${escapeHtml(competitionResourceSingular)}</button>
                          </div>
                        ` : selectedOperationalMatch.status === "live" ? `
                          <div class="tournament-pro-page__operations-modal-actions">
                            <div class="tournament-pro-page__match-game-entry-heading">
                              <div>
                                <span class="tournament-pro-page__eyebrow">REGISTRAR RESULTADO</span>
                                <strong>GAME ${selectedOperationalMatchGameSummary.nextGameNumber}</strong>
                              </div>
                              <small>Elige el ganador después de introducir el marcador.</small>
                            </div>
                            <div class="tournament-pro-page__score-inputs">
                              <label><span>${escapeHtml(getParticipantName(selectedOperationalMatch.participantAId))}</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-score-a="${escapeAttr(selectedOperationalMatch.id)}"></label>
                              <span class="tournament-pro-page__score-separator">—</span>
                              <label><span>${escapeHtml(getParticipantName(selectedOperationalMatch.participantBId))}</span><input type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-score-b="${escapeAttr(selectedOperationalMatch.id)}"></label>
                            </div>
                            ${selectedOperationalMatchPending ? `<span class="tournament-pro-page__match-helper">Guardando resultado… Game ${escapeHtml(String(selectedOperationalMatchGameSummary.nextGameNumber))} quedará disponible al confirmar la persistencia.</span>` : ""}
                            <button type="button" data-winner="${escapeAttr(selectedOperationalMatch.participantAId || "")}" data-match="${escapeAttr(selectedOperationalMatch.id)}" ${selectedOperationalMatchPending ? "disabled" : ""}>GAME ${escapeHtml(String(selectedOperationalMatchGameSummary.nextGameNumber))} · GANÓ ${escapeHtml(getParticipantName(selectedOperationalMatch.participantAId))}</button>
                            <button type="button" data-winner="${escapeAttr(selectedOperationalMatch.participantBId || "")}" data-match="${escapeAttr(selectedOperationalMatch.id)}" ${selectedOperationalMatchPending ? "disabled" : ""}>GAME ${escapeHtml(String(selectedOperationalMatchGameSummary.nextGameNumber))} · GANÓ ${escapeHtml(getParticipantName(selectedOperationalMatch.participantBId))}</button>
                          </div>
                        ` : `
                          <div class="tournament-pro-page__operations-modal-actions">
                            <span class="tournament-pro-page__match-helper">Este match ya no está disponible para operación.</span>
                          </div>
                        `}
                      </div>
                    ` : `
                      <div>
                        <span class="tournament-pro-page__eyebrow">MATCHES LISTOS</span>
                        <h3>Selecciona qué jugar aquí</h3>
                        ${operationalAssignableMatches.length ? `
                          <div class="tournament-pro-page__operations-modal-list">
                            ${operationalAssignableMatches.slice(0, 12).map(({ match, stage }) => `
                              <button type="button" class="tournament-pro-page__operation-match" data-assign-operation-match="${escapeAttr(match.id)}" data-assign-operation-station="${escapeAttr(selectedOperationalStation.id)}">
                                <span class="tournament-pro-page__operation-match-id">${escapeHtml(match.id)}</span>
                                <span class="tournament-pro-page__operation-match-players"><strong>${escapeHtml(getParticipantName(match.participantAId))}</strong><span>VS</span><strong>${escapeHtml(getParticipantName(match.participantBId))}</strong></span>
                                <small>${escapeHtml(stage?.bracket === "grand_final" ? "Grand Final" : formatLabel(stage?.bracket || "Winners"))} · Round ${escapeHtml(String(stage?.number || "—"))}</small>
                              </button>
                            `).join("")}
                          </div>
                        ` : `<div class="tournament-pro-page__operations-empty">No hay matches listos para asignar.</div>`}
                      </div>
                    `}
                  </div>
                </aside>
              </div>
            ` : ""}
          </section>
        `;
        const competitionMarkup = `
          <div class="tournament-pro-page__competition-workspace">
            ${import.meta.env.DEV ? competitionCoreAuditMarkup : ""}
            <nav class="tournament-pro-page__competition-tabs" aria-label="Competition workspace">
              <button type="button" class="${competitionView === "structure" ? "is-active" : ""}" data-competition-view="structure">STRUCTURE</button>
              <button type="button" class="${competitionView === "bracket" ? "is-active" : ""}" data-competition-view="bracket">BRACKET</button>
              <button type="button" class="${competitionView === "matches" ? "is-active" : ""}" data-competition-view="matches">MATCHES</button>
            </nav>
            ${competitionView === "structure" ? competitionStructureMarkup : competitionView === "bracket" ? competitionBracketMarkup : competitionMatchesMarkup}
          </div>
        `;

        const resultsMarkup = `
          <section class="tournament-pro-page__results-workspace">
            <div class="tournament-pro-page__results-header">
              <div>
                <span class="tournament-pro-page__eyebrow">RESULTADOS</span>
                <h2>Resultados oficiales</h2>
                <p>Esta vista separa el resultado competitivo de la operación diaria del torneo.</p>
              </div>
              <span class="tournament-pro-page__workspace-count">${officialResults.length} posiciones</span>
            </div>
            ${eventLive ? `
              <div class="tournament-pro-page__results-action-bar">
                <div><strong>${canFinalize ? "Competencia lista para cierre" : "Competencia en curso"}</strong><span>${canFinalize ? "Todos los matches están resueltos y el resultado oficial puede cerrarse." : "Los resultados oficiales se actualizan conforme se completan los matches."}</span></div>
                <button type="button" class="tournament-pro-page__primary-action" data-action="open-finalization" ${canFinalize ? "" : "disabled"}><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> Finalizar torneo</button>
              </div>
            ` : ""}
            <div class="tournament-pro-page__results-list">
              ${officialResults.map((result) => `
                <article class="tournament-pro-page__result-card">
                  <span class="tournament-pro-page__result-position">${escapeHtml(String(result.position))}</span>
                  <div><strong>${escapeHtml(result.displayName)}</strong><small>${result.position}.º lugar</small></div>
                </article>
              `).join("") || `
                <div class="tournament-pro-page__results-empty">
                  <i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
                  <strong>Resultados todavía no disponibles</strong>
                  <span>Completa los matches desde Competition para generar el resultado oficial.</span>
                  <button type="button" data-workspace-view="operations">Ir a Check-in</button>
                </div>
              `}
            </div>
            ${finalizationModalOpen && eventLive ? `
              <div class="tournament-pro-page__modal-backdrop tournament-pro-page__finalization-modal-backdrop" data-finalization-modal>
                <section class="tournament-pro-page__modal tournament-pro-page__finalization-modal" role="dialog" aria-modal="true" aria-labelledby="tournament-pro-finalization-title">
                  <header class="tournament-pro-page__modal-header">
                    <div>
                      <span class="tournament-pro-page__eyebrow">CIERRE OFICIAL</span>
                      <h2 id="tournament-pro-finalization-title">Finalizar competencia</h2>
                      <p>El resultado oficial proviene del bracket. El organizador solo define qué puestos recibirán reconocimiento.</p>
                    </div>
                    <button type="button" class="tournament-pro-page__modal-close" data-finalization-close aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                  </header>
                  <div class="tournament-pro-page__modal-body">
                    <div class="tournament-pro-page__finalization-section">
                      <span class="tournament-pro-page__eyebrow">RESULTADO OFICIAL</span>
                      <div class="tournament-pro-page__official-results">
                        ${officialResults.map((result) => `
                          <label class="tournament-pro-page__official-result">
                            <span class="tournament-pro-page__official-result-position">${result.position === 1 ? "🥇" : result.position === 2 ? "🥈" : "🥉"}</span>
                            <span class="tournament-pro-page__official-result-copy"><strong>${escapeHtml(result.displayName)}</strong><small>${result.position}.º lugar</small></span>
                            <input type="checkbox" value="${escapeAttr(String(result.position))}" data-recognition-position="${escapeAttr(String(result.position))}" checked>
                          </label>
                        `).join("") || `<div class="tournament-pro-page__empty">No hay un resultado oficial disponible.</div>`}
                      </div>
                    </div>
                    <div class="tournament-pro-page__finalization-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>Solo se muestran puestos que pueden determinarse con certeza a partir del bracket.</span></div>
                    <div class="tournament-pro-page__finalization-actions">
                      <button type="button" data-finalization-close>Cancelar</button>
                      <button type="button" class="tournament-pro-page__primary-action" data-action="finalize-tournament"><i class="fa-solid fa-trophy" aria-hidden="true"></i> Otorgar premios y cerrar</button>
                    </div>
                  </div>
                </section>
              </div>
            ` : ""}
          </section>
        `;

        if (currentView === "dashboard") {
          content.innerHTML = dashboardMarkup;
        } else if (currentView === "competition") {
          content.innerHTML = competitionMarkup;
        } else if (currentView === "results") {
          content.innerHTML = resultsMarkup;
        } else {
          content.innerHTML = operationsMarkup;
        }

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

      renderWorkspace = render;

      const runOperation = async (operation) => {
        try {
          event = await operation();
          pro = ensureTournamentProState(event || {});
          render();
        } catch (error) {
          window.alert(error?.message || "No fue posible completar la operación.");
        }
      };

      const runMatchResultOperation = async ({ matchId, winnerId, score }) => {
        if (!matchId || pendingMatchOperations.has(matchId)) return;

        pendingMatchOperations.add(matchId);
        render();

        try {
          event = await completeMatch({
            tournamentId,
            eventId,
            event,
            matchId,
            winnerId,
            score,
            onPersistenceSettled: async ({ success, error }) => {
              pendingMatchOperations.delete(matchId);

              if (!success) {
                console.error("ARKHAM — No fue posible persistir el resultado del Match:", error);
                try {
                  event = await getTournamentProEvent(tournamentId, eventId);
                  pro = ensureTournamentProState(event || {});
                  render();
                } catch (refreshError) {
                  console.error("ARKHAM — No fue posible recuperar el estado después de un fallo de persistencia:", refreshError);
                }
                window.alert("El resultado se procesó localmente, pero no pudo guardarse. Se restauró el estado confirmado del torneo.");
                return;
              }

              pro = ensureTournamentProState(event || {});
              render();
            }
          });

          pro = ensureTournamentProState(event || {});
          render();
        } catch (error) {
          pendingMatchOperations.delete(matchId);
          render();
          window.alert(error?.message || "No fue posible registrar el resultado del Game.");
        }
      };

      const bind = () => {
        page.querySelectorAll("[data-workspace-view]").forEach((button) => {
          button.addEventListener("click", () => navigateWorkspace(button.dataset.workspaceView || "dashboard"));
        });

        page.querySelectorAll("[data-competition-view]").forEach((button) => {
          button.addEventListener("click", () => navigateCompetitionView(button.dataset.competitionView || "structure"));
        });

        page.querySelector("[data-run-competition-core-audit]")?.addEventListener("click", () => {
          if (competitionCoreAuditLoading) return;

          competitionCoreAuditLoading = true;
          competitionCoreAudit = null;
          render();

          requestAnimationFrame(() => {
            try {
              competitionCoreAudit = auditTournamentProBracketAgainstCompetitionCore(event, {
                structureId: selectedWorkspaceStructureId || null,
                phaseId: selectedWorkspacePhaseId || null
              });
            } catch (error) {
              competitionCoreAudit = {
                status: "INVALID",
                reasonCodes: [error?.message || "AUDIT_ERROR"],
                generation: null,
                comparison: null,
                readiness: null,
                reconciliation: null
              };
            } finally {
              competitionCoreAuditLoading = false;
              render();
            }
          });
        });

        page.querySelector("[data-run-competition-core-migration-dry-run]")?.addEventListener("click", () => {
          if (!competitionCoreAudit || competitionCoreAuditLoading) return;

          try {
            const result = runCompetitionBracketMigrationDryRun(event, {
              currentBracket: competitionCoreAudit.currentBracket,
              readiness: competitionCoreAudit.readiness,
              reconciliation: competitionCoreAudit.reconciliation,
              allowEquivalentAdoption: true
            });
            window.alert([
              "Resultado: " + result.status,
              "Materializer: " + (result.materialization?.status || "no ejecutado"),
              "Validación: " + (result.validation?.status || "no ejecutada"),
              "Partidos: " + result.beforeMatchCount + " actuales → " + result.afterMatchCount + " propuestos",
              "Persistencia: no",
              (result.reasonCodes || []).join(" · ")
            ].filter(Boolean).join("\n"));
          } catch (error) {
            window.alert("No se pudo simular la migración: " + (error?.message || "error desconocido"));
          }
        });

        page.querySelector("[data-sync-competition-core-structure]")?.addEventListener("click", async () => {
          if (competitionCoreAuditLoading) return;

          const confirmed = window.confirm(
            "Se agregará la estructura declarativa de Competition Core a partir del bracket actual. El bracket operativo legacy no se reemplazará. ¿Continuar?"
          );
          if (!confirmed) return;

          competitionCoreAuditLoading = true;
          render();

          try {
            event = await syncCompetitionDomainStructureFromLegacyBracket({
              tournamentId,
              eventId,
              event
            });
            pro = ensureTournamentProState(event || {});
            competitionCoreAudit = auditTournamentProBracketAgainstCompetitionCore(event, {
              structureId: selectedWorkspaceStructureId || null,
              phaseId: selectedWorkspacePhaseId || null
            });
          } catch (error) {
            competitionCoreAudit = {
              status: "INVALID",
              reasonCodes: [error?.message || "STRUCTURE_SYNC_ERROR"],
              generation: null,
              comparison: null,
              readiness: null,
              reconciliation: null
            };
          } finally {
            competitionCoreAuditLoading = false;
            render();
          }
        });

        page.querySelector("[data-pro-back]")?.addEventListener("click", () => navigateWorkspace("dashboard"));

        page.querySelector("[data-mobile-experience-dismiss]")?.addEventListener("click", dismissMobileNotice);
        page.querySelector("[data-mobile-experience-modal]")?.addEventListener("click", (event) => {
          if (event.target === event.currentTarget) dismissMobileNotice();
        });

        page.querySelectorAll("[data-configure-information]").forEach((button) => {
          button.addEventListener("click", () => {
            if (!tournamentId || !eventId) return;
            const targetUrl = `/dashboard/tournaments/edit?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}`;
            window.history.pushState({}, "", targetUrl);
            window.dispatchEvent(new PopStateEvent("popstate"));
          });
        });

        page.querySelectorAll("[data-checkin-view]").forEach((button) => {
          button.addEventListener("click", () => navigateCheckIn(button.dataset.checkinView || "requests"));
        });

        page.querySelectorAll("[data-workspace-phase]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedWorkspacePhaseId = button.dataset.workspacePhase || null;
            selectedWorkspaceStructureId = null;
            selectedWorkspaceRoundId = null;
            selectedWorkspaceMatchId = null;
            render();
          });
        });

        page.querySelectorAll("[data-workspace-structure]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedWorkspaceStructureId = button.dataset.workspaceStructure || null;
            selectedWorkspaceRoundId = null;
            selectedWorkspaceMatchId = null;
            render();
          });
        });

        page.querySelectorAll("[data-workspace-round]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedWorkspaceRoundId = button.dataset.workspaceRound || null;
            selectedWorkspaceMatchId = null;
            render();
          });
        });

        page.querySelectorAll("[data-workspace-match]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedWorkspaceMatchId = button.dataset.workspaceMatch || null;
            render();
          });
        });

        page.querySelectorAll("[data-open-match]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedWorkspaceMatchId = button.dataset.openMatch || null;
            navigateCompetitionView("matches");
          });
        });

        page.querySelectorAll("[data-operational-station]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedOperationalStationId = button.dataset.operationalStation || null;
            render();
          });
        });

        page.querySelectorAll("[data-operation-station-close], [data-operation-station-backdrop]").forEach((element) => {
          element.addEventListener("click", (clickEvent) => {
            if (element.hasAttribute("data-operation-station-backdrop") && clickEvent.target !== element) return;
            selectedOperationalStationId = null;
            render();
          });
        });

        page.querySelectorAll("[data-assign-operation-match]").forEach((button) => {
          button.addEventListener("click", () => runOperation(() => assignMatchToStation({
            tournamentId,
            eventId,
            event,
            matchId: button.dataset.assignOperationMatch,
            stationId: button.dataset.assignOperationStation
          })));
        });

        page.querySelectorAll("[data-open-operation-match]").forEach((button) => {
          button.addEventListener("click", () => {
            const matchId = button.dataset.openOperationMatch;
            selectedWorkspaceMatchId = matchId || null;
            render();
          });
        });

        page.querySelectorAll("[data-assign-station]").forEach((select) => {
          select.addEventListener("change", () => {
            const matchId = select.dataset.assignStation;
            const stationId = select.value;
            if (!stationId) {
              return runOperation(() => releaseMatchStation({
                tournamentId,
                eventId,
                event,
                matchId
              }));
            }
            return runOperation(() => assignMatchToStation({
              tournamentId,
              eventId,
              event,
              matchId,
              stationId
            }));
          });
        });

        page.querySelectorAll("[data-release-station]").forEach((button) => {
          button.addEventListener("click", () => runOperation(() => releaseMatchStation({
            tournamentId,
            eventId,
            event,
            matchId: button.dataset.releaseStation
          })));
        });

        page.querySelectorAll("[data-open-bracket-round]").forEach((button) => {
          button.addEventListener("click", () => {
            const target = page.querySelector(`[data-round-id="${cssEscape(button.dataset.openBracketRound || "")}"]`);
            target?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        });

        page.querySelectorAll("[data-open-bracket-match]").forEach((button) => {
          button.addEventListener("click", () => {
            const target = page.querySelector(`[data-match-id="${cssEscape(button.dataset.openBracketMatch || "")}"]`);
            target?.scrollIntoView({ behavior: "smooth", block: "center" });
            target?.classList.add("is-focused");
            window.setTimeout(() => target?.classList.remove("is-focused"), 900);
          });
        });

        page.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
          const action = button.dataset.action;
          if (action === "create-station") {
            return runOperation(() => createCompetitionStation({
              tournamentId,
              eventId,
              event
            }));
          }
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
          if (action === "open-finalization") {
            finalizationModalOpen = true;
            render();
            return;
          }
          if (action === "finalize-tournament") {
            const recognizedPositions = [...page.querySelectorAll("[data-recognition-position]:checked")]
              .map((input) => Number(input.value));
            finalizationModalOpen = false;
            return runOperation(() => finalizeTournament({
              tournamentId,
              eventId,
              event,
              recognizedPositions
            }));
          }
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

            return runMatchResultOperation({
              matchId,
              winnerId: button.dataset.winner,
              score
            });
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

        page.querySelectorAll("[data-finalization-close], [data-finalization-modal]").forEach((element) => element.addEventListener("click", (clickEvent) => {
          if (element.hasAttribute("data-finalization-modal") && clickEvent.target !== element) return;
          finalizationModalOpen = false;
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
          if (replacementParticipantId) {
            event = await replaceParticipantInSlot({
              tournamentId,
              eventId,
              event,
              slotId: selectedSlotId,
              participantId: replacementParticipantId,
              entityType,
              entityId,
              displayName,
              manual
            });
          } else {
            event = await addParticipantToSlot({
              tournamentId,
              eventId,
              event,
              slotId: selectedSlotId,
              entityType,
              entityId,
              displayName,
              manual
            });
          }

          pro = ensureTournamentProState(event);
          selectedSlotId = null;
          replacementParticipantId = null;
          modalOpen = false;
          render();
        } catch (error) {
          window.alert(error.message || "No fue posible completar la operación.");
        }
      };

      const handleModalKeydown = (event) => {
        if (event.key !== "Escape") return;
        if (finalizationModalOpen) {
          finalizationModalOpen = false;
          render();
          return;
        }
        if (!modalOpen) return;
        selectedSlotId = null;
        modalOpen = false;
        render();
      };
      page.addEventListener("keydown", handleModalKeydown);

      render();
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

function workspaceRoundsCount(stages = [], workspacePhases = []) {
  const stageCount = stages.length;
  if (stageCount) return stageCount;
  return workspacePhases.reduce((total, phase) => total + (phase.structures || []).reduce((sum, structure) => sum + (structure.rounds || []).length, 0), 0);
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
