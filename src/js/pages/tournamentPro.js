import { getCurrentAccountContext } from "../services/account.js";
import { getCurrentEntityContext } from "../services/entityContext.js";
import { createSubscriptionAccess } from "../services/planService.js";
import { hasEffectiveSubscriptionAccess } from "../services/subscription.js";
import {
  getTournamentProEvent,
  searchTournamentEntities,
  prepareBracket,
  addParticipant,
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
  syncCompetitionDomainStructureFromLegacyBracket,
  saveCompetitionPhaseConfiguration,
  moveCompetitionPhaseConfiguration,
  saveCompetitionStructureConfiguration,
  prepareCompetitionStructureBracket,
  assignCompetitionEntryToStructureSlot,
  moveCompetitionStructureConfiguration,
  saveCompetitionPhaseGroupConfiguration,
  moveCompetitionPhaseGroupConfiguration,
  deleteCompetitionPhaseGroupConfiguration
} from "../services/tournamentProOperations.js";
import { getTournamentRegistrationRequestsMarkup, loadTournamentRegistrationRequests, bindTournamentRegistrationRequests } from "../components/tournamentRegistrationRequests.js";
import { ensureTournamentProState } from "../services/tournamentPro.js";
import { runCompetitionBracketMigrationDryRun } from "../services/competitionBracketMigrationDryRun.js";
import { executeCompetitionBracketMigration } from "../services/competitionBracketMigrationExecutor.js";
import { persistCompetitionBracketMigration } from "../services/competitionBracketMigrationPersistence.js";
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
import { getGameMatchSystems } from "../services/gameCatalog.js";
import { getMatchLifecycle, MATCH_LIFECYCLE } from "../services/competitionMatchLifecycle.js";

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
  const workspaceViewIds = new Set(["dashboard", "participants", "configuration", "bracket", "matches", "competition", "checkin", "results"]);
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

  const competitionViewIds = new Set(["structure", "bracket", "matches"]);
  const getCompetitionView = () => {
    const value = new URLSearchParams(window.location.search).get("competitionView");
    return competitionViewIds.has(value) ? value : "structure";
  };
  const competitionSectionIds = new Set(["pools", "rounds", "seeding", "advancement", "settings"]);
  const getCompetitionSection = () => {
    const value = new URLSearchParams(window.location.search).get("competitionSection");
    return competitionSectionIds.has(value) ? value : "pools";
  };
  const navigateCompetitionSection = (section, { replace = false } = {}) => {
    const nextSection = competitionSectionIds.has(section) ? section : "pools";
    const url = new URL(window.location.href);
    url.searchParams.set("proView", "competition");
    url.searchParams.delete("competitionView");
    if (nextSection === "pools") url.searchParams.delete("competitionSection");
    else url.searchParams.set("competitionSection", nextSection);
    window.history[replace ? "replaceState" : "pushState"]({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (typeof renderWorkspace === "function") renderWorkspace();
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
    if (view === "dashboard") {
      url.searchParams.delete("proView");
      url.searchParams.delete("competitionView");
      url.searchParams.delete("competitionSection");
    } else {
      url.searchParams.set("proView", view);
      if (view !== "competition") url.searchParams.delete("competitionView");
      if (["bracket", "matches"].includes(view)) url.searchParams.delete("competitionSection");
    }
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

      let competitionMatchSystems = [];
      try {
        competitionMatchSystems = await getGameMatchSystems(event.gameId, event.competitionOption);
      } catch (error) {
        console.warn("ARKHAM — No fue posible cargar los formatos por fase:", error);
      }

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
      const hasDeclarativeCompetitionConfiguration = Object.prototype.hasOwnProperty.call(
        event?.pro || {},
        "phases"
      );

      if (
        !hasDeclarativeCompetitionConfiguration &&
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
      let phaseConfigurationMode = null;
      let structureConfigurationModalOpen = false;
      let editingStructureId = null;
      let structureSlotAssignmentId = null;
      let selectedWorkspacePhaseId = null;
      let phaseSearchQuery = "";
      let selectedWorkspaceStructureId = null;
      let selectedWorkspacePhaseGroupId = null;
      let phaseGroupConfigurationMode = null;
      let editingPhaseGroupId = null;
      let selectedWorkspaceRoundId = null;
      let selectedWorkspaceMatchId = null;
      let selectedOperationalStationId = null;
      let competitionCoreAudit = null;
      let competitionCoreAuditLoading = false;
      let competitionCoreMigrationDryRun = null;
      let competitionSetupSaving = false;
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

      const createCompetitionConfigurationId = (prefix) => {
        const id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        return `${prefix}-${id}`;
      };

      const runCompetitionSetupChange = async (operation) => {
        if (competitionSetupSaving) return;
        competitionSetupSaving = true;
        render();
        try {
          event = await operation();
          pro = ensureTournamentProState(event || {});
          competitionCoreAudit = null;
        } catch (error) {
          window.alert(error?.message || "No fue posible guardar la estructura competitiva.");
        } finally {
          competitionSetupSaving = false;
          render();
        }
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
        const hasCompatibilityPhase = configuredPhases.some((phase) => phase?.id === "legacy-main" || phase?.legacy === true);
        const hasUnassignedLegacyBracket = stages.some((stage) =>
          !stage?.phaseId && !(stage?.matches || []).some((match) => match?.phaseId)
        );
        const shouldShowLegacyMain = configuredPhases.length > 0 &&
          !hasCompatibilityPhase &&
          hasUnassignedLegacyBracket;

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

        const phasesToRender = shouldShowLegacyMain ? [{
          id: "legacy-main",
          name: "Main Competition",
          order: 1,
          status: pro.status || "draft",
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
        }, ...configuredPhases.map((phase, index) => ({ ...phase, order: Number(phase.order) + 1 || index + 2 }))] : configuredPhases;

        return phasesToRender
          .map((phase, phaseIndex) => {
            const phaseStructures = shouldShowLegacyMain && phase.id === "legacy-main"
              ? phase.structures
              : structures.filter((structure) => structure.phaseId === phase.id);
            const phaseStages = stages.filter((stage) => {
              if (stage?.phaseId) return stage.phaseId === phase.id;
              return !shouldShowLegacyMain && phaseIndex === 0;
            });
            const normalizedDeclaredStructures = phaseStructures.map((structure) => {
              const declaredRounds = Array.isArray(structure.rounds) ? structure.rounds : [];
              const hasLinkedOperationalStages = stages.some((stage) =>
                stage?.structureId === structure.id ||
                (stage?.matches || []).some((match) => match?.structureId === structure.id)
              );
              const operationalRounds = declaredRounds.length && hasLinkedOperationalStages
                ? getCompetitionRounds(event, { structureId: structure.id, phaseId: phase.id })
                : [];
              return {
                ...structure,
                rounds: operationalRounds.length ? operationalRounds : declaredRounds
              };
            });
            const normalizedStructures = (shouldShowLegacyMain && phase.id === "legacy-main"
              ? normalizedDeclaredStructures
              : [{
                  id: `${phase.id}-derived`,
                  name: "Main Structure",
                  type: legacyType,
                  order: 0,
                  legacy: true,
                  // Keep the compatibility structure visible when declarative structures
                  // are added. It is a read-model projection, not a persisted structure.
                  // Unassigned legacy rounds remain attached only to the first configured phase.
                  rounds: phaseStages
                }, ...normalizedDeclaredStructures]
            ).map((structure, structureIndex) => ({
              ...structure,
              order: structure.legacy ? 0 : structureIndex + 1
            }));

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
        const matchLifecycle = getMatchLifecycle(match);
        const isCalledMatch = matchLifecycle === MATCH_LIFECYCLE.CALLED;
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
              <span class="tournament-pro-page__match-status">${escapeHtml(isCalledMatch ? "ASIGNADO" : matchStatusLabel(match.status))}</span>
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
        const activeCompetitionView = currentView === "bracket"
          ? "bracket"
          : currentView === "matches"
            ? "matches"
            : currentView === "configuration"
              ? "structure"
              : competitionView;
        const isStandaloneCompetitionWorkspace = ["configuration", "bracket", "matches"].includes(currentView);
        const competitionSection = getCompetitionSection();
        const viewMeta = {
          dashboard: { title: game, subtitle: "" },
          participants: { title: "PARTICIPANTES", subtitle: "Administra solicitudes y completa la lista de participantes" },
          configuration: { title: "CONFIGURACIÓN", subtitle: "Fases, estructuras y pools de la competición" },
          bracket: { title: "BRACKET", subtitle: "Visualiza el cuadro competitivo y sus rutas" },
          matches: { title: "MATCHES", subtitle: "Administra los matches y su operación" },
          competition: { title: "COMPETITION", subtitle: "Estructura competitiva" },
          checkin: { title: "CHECK-IN", subtitle: "Confirma asistencia y prepara el inicio del torneo" },
          results: { title: "RESULTS", subtitle: "Resultados oficiales" }
        }[currentView];
        const titleElement = page.querySelector(".tournament-pro-page__header h1");
        const subtitleElement = page.querySelector("[data-pro-message]");
        if (titleElement) titleElement.textContent = viewMeta.title;
        if (subtitleElement) subtitleElement.textContent = viewMeta.subtitle;
        const backButton = page.querySelector("[data-pro-back]");
        if (backButton) backButton.hidden = currentView === "dashboard";

        const workspacePhases = getCompetitionWorkspaceModel();
        const legacyStages = Array.isArray(pro.bracket?.stages) ? pro.bracket.stages : [];
        const declarativeStages = workspacePhases
          .filter((phase) => phase?.legacy !== true)
          .flatMap((phase) => (Array.isArray(phase?.structures) ? phase.structures : [])
            .filter((structure) => structure?.legacy !== true)
            .flatMap((structure) => Array.isArray(structure?.rounds) ? structure.rounds : []))
          .filter((round) => round && Array.isArray(round.matches));
        const stages = declarativeStages.length ? declarativeStages : legacyStages;
        const allCompetitionMatches = stages.flatMap((stage, stageIndex) =>
          (stage.matches || []).map((match, matchIndex) => ({
            match,
            stage,
            stageIndex,
            matchIndex,
            roundName: stage.bracket === "grand_final" ? "Grand Final" : (stage.name || `Round ${stage.number || stageIndex + 1}`)
          }))
        );
        const legacySlots = Object.values(pro.bracket?.slots || {}).sort((a, b) => Number(a.seed || 0) - Number(b.seed || 0));
        const participants = Object.values(pro.participants || {});
        const activeParticipants = participants.filter((participant) => !["rejected", "withdrawn", "no_show"].includes(String(participant?.status || "").toLowerCase()));
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

        const normalizedPhaseSearch = String(phaseSearchQuery || "").trim().toLocaleLowerCase("es");
        const visibleWorkspacePhases = normalizedPhaseSearch
          ? workspacePhases.filter((phase) => String(phase?.name || "").toLocaleLowerCase("es").includes(normalizedPhaseSearch))
          : workspacePhases;
        if (!workspacePhases.some((phase) => phase.id === selectedWorkspacePhaseId)) {
          selectedWorkspacePhaseId = workspacePhases[0]?.id || null;
        }
        const selectedWorkspacePhase = workspacePhases.find((phase) => phase.id === selectedWorkspacePhaseId) || workspacePhases[0] || null;
        const declaredPhase = (pro.phases || []).find((phase) => phase?.id === selectedWorkspacePhase?.id) || null;
        const declaredStructures = Array.isArray(declaredPhase?.structures) ? declaredPhase.structures : [];
        const declaredPhaseGroups = Array.isArray(declaredPhase?.phaseGroups)
          ? declaredPhase.phaseGroups
          : [];
        if (!selectedWorkspacePhase?.structures?.some((structure) => structure.id === selectedWorkspaceStructureId)) {
          selectedWorkspaceStructureId = selectedWorkspacePhase?.structures?.[0]?.id || null;
        }
        const selectedWorkspaceStructure = selectedWorkspacePhase?.structures?.find((structure) => structure.id === selectedWorkspaceStructureId)
          || selectedWorkspacePhase?.structures?.[0]
          || null;
        if (!declaredPhaseGroups.some((group) => group?.id === selectedWorkspacePhaseGroupId)) {
          selectedWorkspacePhaseGroupId = declaredPhaseGroups[0]?.id || null;
        }
        const selectedWorkspacePhaseGroup = declaredPhaseGroups.find((group) => group?.id === selectedWorkspacePhaseGroupId) || null;
        const modalEditingPhaseGroup = declaredPhaseGroups.find((group) => group?.id === editingPhaseGroupId) || null;
        const selectedDeclaredStructure = declaredStructures.find((structure) => structure?.id === selectedWorkspaceStructure?.id) || null;
        const modalEditingStructure = declaredStructures.find((structure) => structure?.id === editingStructureId) || null;

        const primaryDeclaredPhase = [...workspacePhases]
          .filter((phase) => phase?.legacy !== true)
          .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))[0] || null;
        const primaryDeclaredStructure = [...(primaryDeclaredPhase?.structures || [])]
          .filter((structure) => structure?.legacy !== true)
          .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))[0] || null;
        const declaredStructureSlots = Array.isArray(primaryDeclaredStructure?.slots)
          ? primaryDeclaredStructure.slots
          : [];
        const declaredAssignedSlots = declaredStructureSlots.filter((slot) => slot?.participantId);
        const declaredAssignedParticipantIds = new Set(declaredAssignedSlots.map((slot) => slot.participantId));
        const hasPreparedDeclaredStructure = Boolean(
          primaryDeclaredStructure &&
          Array.isArray(primaryDeclaredStructure.rounds) && primaryDeclaredStructure.rounds.length > 0 &&
          declaredStructureSlots.length > 0
        );
        const assigned = hasPreparedDeclaredStructure
          ? declaredAssignedParticipantIds.size
          : legacySlots.filter((slot) => slot?.participantId).length;
        const registered = activeParticipants.length;
        const placementComplete = hasPreparedDeclaredStructure
          ? declaredAssignedParticipantIds.size === registered && registered > 0
          : legacySlots.filter((slot) => slot?.participantId).length === registered && registered > 0;
        const selectedSlot = hasPreparedDeclaredStructure
          ? declaredStructureSlots.find((slot) =>
              String(slot?.id) === String(selectedSlotId) ||
              (slot?.seed && `seed-${slot.seed}` === selectedSlotId)
            ) || null
          : legacySlots.find((slot) => slot.seed && `seed-${slot.seed}` === selectedSlotId) || null;
        const selectedParticipantName = selectedSlot?.participantId
          ? getParticipantName(selectedSlot.participantId)
          : "";
        const canAddParticipant = !eventLive && !eventFinished && !checkInOpen && !checkInCompleted && registered < Number(capacity || 0);
        const competitionSetupLocked = Boolean(
          eventLive || eventFinished || checkInOpen || checkInCompleted ||
          ["live", "check_in", "finished", "archived", "completed"].includes(String(event.status || pro.status || "").toLowerCase()) ||
          pro.checkIn?.opened || pro.checkIn?.completed ||
          stages.some((stage) => (stage.matches || []).some((match) => ["live", "completed"].includes(String(match.status || "").toLowerCase())))
        );
        const inheritedMatchSystem = pro.matchSystem || event.matchSystem || "";
        const availablePhaseMatchSystems = [...new Set([
          ...competitionMatchSystems,
          inheritedMatchSystem,
          ...workspacePhases.map((phase) => phase.matchSystem || null),
          selectedWorkspacePhase?.matchFormat || null
        ].filter(Boolean))];
        const configuredPhaseMatchSystem = selectedWorkspacePhase?.matchSystem || selectedWorkspacePhase?.matchFormat || "";
        const phaseMatchSystemValue = selectedWorkspacePhase?.matchSystemMode === "CUSTOM"
          ? configuredPhaseMatchSystem
          : configuredPhaseMatchSystem && configuredPhaseMatchSystem !== inheritedMatchSystem
            ? configuredPhaseMatchSystem
            : "";
        const renderPhaseMatchSystemOptions = (selectedValue = "") => `
          <option value="" ${selectedValue ? "" : "selected"}>Heredar del torneo${inheritedMatchSystem ? ` (${escapeHtml(inheritedMatchSystem)})` : ""}</option>
          ${availablePhaseMatchSystems.map((system) => `<option value="${escapeAttr(system)}" ${system === selectedValue ? "selected" : ""}>${escapeHtml(system)}</option>`).join("")}
        `;
        const phaseIsDeclared = Boolean(declaredPhase);
        const selectedStructureType = String(selectedDeclaredStructure?.type || (String(pro.bracket?.type || event.format || "").toLowerCase().includes("double") ? "DOUBLE_ELIMINATION" : "SINGLE_ELIMINATION")).toUpperCase();
        const selectedStructureFormatLocked = Boolean((selectedDeclaredStructure?.rounds || []).length || (selectedDeclaredStructure?.slots || []).length);
        const workspaceRounds = selectedWorkspaceStructure?.rounds || [];
        if (!workspaceRounds.some((round) => round.id === selectedWorkspaceRoundId)) {
          selectedWorkspaceRoundId = workspaceRounds[0]?.id || null;
        }
        const selectedWorkspaceRound = workspaceRounds.find((round) => round.id === selectedWorkspaceRoundId)
          || workspaceRounds[0]
          || null;
        const selectedWorkspaceMatches = Array.isArray(selectedWorkspaceRound?.matches) ? selectedWorkspaceRound.matches : [];
        const selectedWorkspaceRoundSlots = (selectedWorkspaceStructure?.slots || [])
          .filter((slot) => slot?.roundId === selectedWorkspaceRound?.id)
          .sort((a, b) => Number(a.position || a.order || 0) - Number(b.position || b.order || 0));
        const selectedStructureSlotForAssignment = selectedDeclaredStructure?.slots
          ?.find((slot) => slot?.id === structureSlotAssignmentId) || null;
        const inactiveCompetitorStatuses = new Set(["withdrawn", "eliminated", "dq", "rejected", "no_show"]);
        const entriesAssignedElsewhere = new Set((selectedDeclaredStructure?.slots || [])
          .filter((slot) => slot?.id !== selectedStructureSlotForAssignment?.id && slot?.entryId)
          .map((slot) => slot.entryId));
        const structureAssignmentCandidates = Object.values(pro.entries || {})
          .filter((entry) => {
            const participant = entry?.legacyParticipantId ? pro.participants?.[entry.legacyParticipantId] : null;
            return Boolean(
              entry?.id && participant &&
              !inactiveCompetitorStatuses.has(String(entry.status || "").toLowerCase()) &&
              !inactiveCompetitorStatuses.has(String(participant.status || "").toLowerCase()) &&
              (!entriesAssignedElsewhere.has(entry.id) || entry.id === selectedStructureSlotForAssignment?.entryId)
            );
          })
          .sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || ""), "es"));
        const matchSelectionPool = activeCompetitionView === "structure" && currentView !== "operations"
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
        const selectedOperationalCalledEntry = selectedOperationalStation?.currentMatchId
          ? operationsModel.called.find((item) => item.matchId === selectedOperationalStation.currentMatchId) || null
          : null;
        const selectedOperationalMatch = selectedOperationalCalledEntry?.match
          || (selectedOperationalStation?.currentMatchId
            ? allCompetitionMatches.find((item) => item.match?.id === selectedOperationalStation.currentMatchId)?.match || null
            : null);
        const selectedOperationalMatchGameSummary = getMatchGameSummary(selectedOperationalMatch);
        const selectedOperationalMatchPending = isMatchOperationPending(selectedOperationalMatch?.id);
        const operationalAssignableMatches = operationsModel.readyUnassigned;
        if (!matchSelectionPool.some((match) => match?.id === selectedWorkspaceMatchId)) {
          selectedWorkspaceMatchId = null;
        }
        const selectedWorkspaceMatch = matchSelectionPool.find((match) => match?.id === selectedWorkspaceMatchId) || null;
        const selectedWorkspaceMatchIsOperational = Boolean(selectedWorkspaceMatch && allCompetitionMatches.some((item) => item.match === selectedWorkspaceMatch));
        const selectedWorkspaceRoundIsOperational = Boolean(selectedWorkspaceRound && allCompetitionMatches.some((item) => item.stage?.id === selectedWorkspaceRound.id));
        const selectedWorkspaceMatchGameSummary = getMatchGameSummary(selectedWorkspaceMatch);
        const selectedWorkspaceMatchContext = selectedWorkspaceMatch
          ? allCompetitionMatches.find((item) => item.match === selectedWorkspaceMatch) || null
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
          if (destination.type === "MATCH" || destination.matchId) {
            return `${destination.matchId || "Match"}${destination.slot ? ` · Slot ${destination.slot}` : ""}`;
          }
          if (destination.type === "CHAMPION") return "Campeón";
          if (destination.type === "ELIMINATED") return "Eliminado";
          return formatLabel(destination.type);
        };

        const getWorkspaceMatchAdvancement = (match) => {
          if (!match?.advancement || typeof match.advancement !== "object") {
            return getMatchAdvancement(match, pro.bracket || {});
          }
          const normalizeDestination = (destination, terminalType) => {
            if (destination?.matchId) return { ...destination, type: destination.type || "MATCH" };
            if (destination?.type) return destination;
            return { type: terminalType };
          };
          return {
            ...match.advancement,
            winnerDestination: normalizeDestination(match.advancement.winnerDestination, "CHAMPION"),
            loserDestination: normalizeDestination(match.advancement.loserDestination, "ELIMINATED")
          };
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
                <button type="button" class="tournament-pro-page__workspace-entry tournament-pro-page__workspace-entry--configuration" data-workspace-view="configuration">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-sitemap" aria-hidden="true"></i></span>
                  <span>
                    <strong>Configuración</strong>
                    <small>Fases, estructuras, pools y reglas de la competición.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry tournament-pro-page__workspace-entry--primary" data-workspace-view="participants">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-clipboard-check" aria-hidden="true"></i></span>
                  <span>
                    <strong>Participantes</strong>
                    <small>Solicitudes, participantes y preparación de la lista.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry tournament-pro-page__workspace-entry--bracket" data-workspace-view="bracket">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-code-branch" aria-hidden="true"></i></span>
                  <span>
                    <strong>Bracket</strong>
                    <small>Visualiza el cuadro, rondas y rutas de avance.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry tournament-pro-page__workspace-entry--matches" data-workspace-view="matches">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-gamepad" aria-hidden="true"></i></span>
                  <span>
                    <strong>Matches</strong>
                    <small>Operación, lobbies, estaciones y resultados de cada match.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry tournament-pro-page__workspace-entry--checkin" data-open-checkin>
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-clipboard-check" aria-hidden="true"></i></span>
                  <span>
                    <strong>Check-in</strong>
                    <small>${checkInCompleted ? `${present} presentes · Check-in completado.` : checkInOpen ? `${present} / ${assigned} presentes · Check-in en curso.` : assigned >= Number(capacity || 0) ? "Confirma asistencia antes de iniciar el torneo." : `Completa ${Math.max(Number(capacity || 0) - assigned, 0)} asiento(s) para abrirlo.`}</small>
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
                  <button type="button" class="tournament-pro-page__primary-action" data-persist-competition-core-migration ${competitionCoreMigrationDryRun?.status !== "READY" || competitionCoreMigrationDryRun?.validation?.valid !== true ? "disabled" : ""}>
                    Migrar bracket del torneo de prueba
                  </button>
                  <small>Control interno de desarrollo. Úsalo únicamente en un evento de prueba en preparación.</small>
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

        const isDoubleEliminationStructure = selectedWorkspaceStructure?.type === "DOUBLE_ELIMINATION";
        const workspaceRoundGroups = isDoubleEliminationStructure
          ? [
              { key: "winners", label: "WINNERS", rounds: workspaceRounds.filter((round) => round.bracket === "winners") },
              { key: "losers", label: "LOSERS", rounds: workspaceRounds.filter((round) => round.bracket === "losers") },
              { key: "grand_final", label: "GRAND FINAL", rounds: workspaceRounds.filter((round) => round.bracket === "grand_final") }
            ].filter((group) => group.rounds.length)
          : [{ key: "structure", label: null, rounds: workspaceRounds }];

        const selectedWorkspaceRoundGroup = workspaceRoundGroups.find((group) =>
          group.rounds.some((round) => round.id === selectedWorkspaceRound?.id)
        );
        const selectedWorkspaceRoundLabel = selectedWorkspaceRound?.bracket === "grand_final"
          ? "GRAND FINAL"
          : selectedWorkspaceRound?.bracket === "losers"
            ? `LOSERS · RONDA ${selectedWorkspaceRound?.number || 1}`
            : selectedWorkspaceRound
              ? `WINNERS · RONDA ${selectedWorkspaceRound?.number || 1}`
              : "RONDA";

        const round_block = selectedWorkspaceStructure ? `
          <section class="tournament-pro-page__controller-section-panel tournament-pro-page__rounds-panel">
            <div class="tournament-pro-page__section-heading">
              <div>
                <span class="tournament-pro-page__workspace-label">RONDAS</span>
                <small>Administra las rondas definidas para esta estructura.</small>
              </div>
              <span class="tournament-pro-page__step-count">${workspaceRounds.length} ${workspaceRounds.length === 1 ? "ronda" : "rondas"}</span>
            </div>

            ${workspaceRounds.length ? `
              ${workspaceRoundGroups.map((group) => `
                <div class="tournament-pro-page__round-group">
                  ${group.label ? `
                    <div class="tournament-pro-page__section-heading">
                      <div>
                        <span class="tournament-pro-page__workspace-label">${group.label}</span>
                        <small>${group.key === "winners" ? "Cuadro principal" : group.key === "losers" ? "Ruta de eliminados" : "Cierre de la competición"}</small>
                      </div>
                      <span class="tournament-pro-page__step-count">${group.rounds.length} ${group.rounds.length === 1 ? "ronda" : "rondas"}</span>
                    </div>
                  ` : ""}

                  <div class="tournament-pro-page__round-selector" role="tablist" aria-label="${group.label ? `${group.label} de la estructura` : "Rondas de la estructura"}">
                    ${group.rounds.map((round, index) => `
                      <button
                        type="button"
                        class="tournament-pro-page__round-selector-item ${round.id === selectedWorkspaceRound?.id ? "is-active" : ""}"
                        data-workspace-round="${escapeAttr(round.id)}"
                        role="tab"
                        aria-selected="${round.id === selectedWorkspaceRound?.id}"
                      >
                        <span class="tournament-pro-page__round-selector-index">${group.key === "grand_final" ? "GF" : String(round.number || index + 1).padStart(2, "0")}</span>
                        <span>
                          <strong>${escapeHtml(group.key === "grand_final" ? (round.name || "Grand Final") : (round.name || `Ronda ${round.number || index + 1}`))}</strong>
                          <small>${Array.isArray(round.matches) ? round.matches.length : 0} ${Array.isArray(round.matches) && round.matches.length === 1 ? "match" : "matches"}</small>
                        </span>
                        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                      </button>
                    `).join("")}
                  </div>
                </div>
              `).join("")}

              ${selectedWorkspaceRound ? `
                <div class="tournament-pro-page__round-detail">
                  <header class="tournament-pro-page__round-detail-header">
                    <div>
                      <span class="tournament-pro-page__eyebrow">${escapeHtml(selectedWorkspaceRoundLabel)}</span>
                      <h3>${escapeHtml(selectedWorkspaceRound.name || (selectedWorkspaceRound.bracket === "grand_final" ? "Grand Final" : `Ronda ${selectedWorkspaceRound.number || 1}`))}</h3>
                    </div>
                    <span class="tournament-pro-page__step-count">${selectedWorkspaceMatches.length} ${selectedWorkspaceMatches.length === 1 ? "match" : "matches"}</span>
                  </header>

                  ${selectedWorkspaceMatches.length ? `
                    <div class="tournament-pro-page__round-match-grid">
                      ${selectedWorkspaceMatches.map((match) => renderMatchCard(match, { eventLive })).join("")}
                    </div>
                  ` : `
                    <div class="tournament-pro-page__workspace-empty">
                      <strong>Esta ronda todavía no tiene matches materializados</strong>
                      <span>La definición de la ronda existe, pero todavía no hay matches disponibles para administrar.</span>
                    </div>
                  `}
                </div>
              ` : ""}
            ` : `
              <div class="tournament-pro-page__workspace-empty">
                <strong>Esta estructura todavía no tiene rondas</strong>
                <span>Prepara la estructura desde Overview para generar sus rondas y posiciones iniciales.</span>
              </div>
            `}
          </section>
        ` : "";

        const competitionStructureMarkup = `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__competition-controller">
            <div class="tournament-pro-page__controller-layout">
              <aside class="tournament-pro-page__phase-rail" aria-label="Fases de la competencia">
                <div class="tournament-pro-page__phase-rail-heading">
                  <div class="tournament-pro-page__phase-rail-heading-copy">
                    <span class="tournament-pro-page__workspace-label">FASES</span>
                    <small>Selecciona una fase.</small>
                  </div>
                  <div class="tournament-pro-page__phase-rail-heading-actions">
                    <label class="tournament-pro-page__phase-search">
                      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                      <input type="search" value="${escapeAttr(phaseSearchQuery)}" placeholder="Buscar fase…" aria-label="Buscar fase" data-phase-search>
                    </label>
                    <button type="button" class="tournament-pro-page__primary-action tournament-pro-page__phase-add-action" data-open-phase-configuration="add" ${competitionSetupLocked ? "disabled" : ""}>
                      <i class="fa-solid fa-plus" aria-hidden="true"></i> Agregar fase
                    </button>
                  </div>
                </div>
                <div class="tournament-pro-page__phase-rail-list" role="tablist" aria-label="Fases">
                  ${visibleWorkspacePhases.map((phase) => {
                    const index = workspacePhases.findIndex((item) => item.id === phase.id);
                    return `
                    <div class="tournament-pro-page__phase-rail-item ${phase.id === selectedWorkspacePhase?.id ? "is-active" : ""}" data-phase-search-item="${escapeAttr(String(phase.name || "").toLocaleLowerCase("es"))}">
                      <button type="button" class="tournament-pro-page__phase-rail-select" data-workspace-phase="${escapeAttr(phase.id)}" role="tab" aria-selected="${phase.id === selectedWorkspacePhase?.id}">
                        <span class="tournament-pro-page__phase-rail-index">${String(index + 1).padStart(2, "0")}</span>
                        <span class="tournament-pro-page__phase-rail-copy">
                          <strong>${escapeHtml(phase.name)}</strong>
                          <small>${escapeHtml(phase.status === "configured" ? "Configurada" : formatLabel(phase.status || "configured"))}</small>
                        </span>
                      </button>
                      <button type="button" class="tournament-pro-page__phase-rail-edit" data-open-phase-configuration="edit" data-phase-id="${escapeAttr(phase.id)}" ${competitionSetupLocked ? "disabled" : ""} aria-label="Editar ${escapeAttr(phase.name || "fase")}">
                        <i class="fa-solid fa-pen" aria-hidden="true"></i>
                      </button>
                    </div>
                  `;
                  }).join("")}
                  <div class="tournament-pro-page__phase-search-empty" data-phase-search-empty ${visibleWorkspacePhases.length ? "hidden" : ""}>
                    <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                    <span>${normalizedPhaseSearch ? "No hay fases que coincidan con la búsqueda." : "Aún no hay fases. Crea la primera para comenzar."}</span>
                  </div>
                </div>
              </aside>

              <div class="tournament-pro-page__controller-main">
                ${selectedWorkspacePhase ? `
                  <section class="tournament-pro-page__structure-section">
                    <div class="tournament-pro-page__section-heading">
                      <div>
                        <span class="tournament-pro-page__workspace-label">ESTRUCTURAS</span>
                        <small>El formato que ejecutará esta fase.</small>
                      </div>
                      <button type="button" class="tournament-pro-page__secondary-action" data-open-structure-configuration="create" ${competitionSetupLocked || !phaseIsDeclared ? "disabled" : ""}>
                        <i class="fa-solid fa-plus" aria-hidden="true"></i> Agregar estructura
                      </button>
                    </div>
                    <div class="tournament-pro-page__structure-card-grid">
                      ${selectedWorkspacePhase.structures.map((structure) => `
                        <button type="button" class="tournament-pro-page__structure-card ${structure.id === selectedWorkspaceStructure?.id ? "is-active" : ""}" data-workspace-structure="${escapeAttr(structure.id)}">
                          <span class="tournament-pro-page__structure-card-icon"><i class="fa-solid ${structure.type === "DOUBLE_ELIMINATION" ? "fa-code-branch" : "fa-diagram-project"}" aria-hidden="true"></i></span>
                          <span class="tournament-pro-page__structure-card-copy">
                            <strong>${escapeHtml(structure.name)}</strong>
                            <small>${escapeHtml(structure.type === "DOUBLE_ELIMINATION" ? "Doble eliminación" : structure.type === "SINGLE_ELIMINATION" ? "Eliminación simple" : formatLabel(structure.type))}</small>
                            <span>${structure.rounds?.length || 0} rondas · ${structure.slots?.length || structure.slotCount || 0} posiciones</span>
                          </span>
                          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                        </button>
                      `).join("") || `
                        <div class="tournament-pro-page__structure-empty">
                          <span class="tournament-pro-page__structure-card-icon"><i class="fa-solid fa-diagram-project" aria-hidden="true"></i></span>
                          <div>
                            <strong>Esta fase todavía no tiene una estructura</strong>
                            <p>Agrega una estructura para definir cómo competirán los participantes.</p>
                          </div>
                        </div>
                      `}
                    </div>
                  </section>

                  ${selectedWorkspaceStructure ? `
                    <section class="tournament-pro-page__structure-controller">
                      <header class="tournament-pro-page__structure-controller-header">
                        <div>
                          <span class="tournament-pro-page__eyebrow">STRUCTURE CONTROLLER</span>
                          <h3>${escapeHtml(selectedWorkspaceStructure.name)}</h3>
                          <p>${escapeHtml(selectedWorkspaceStructure.type === "DOUBLE_ELIMINATION" ? "Doble eliminación" : selectedWorkspaceStructure.type === "SINGLE_ELIMINATION" ? "Eliminación simple" : formatLabel(selectedWorkspaceStructure.type))}</p>
                        </div>
                        <div class="tournament-pro-page__structure-actions">
                          <button type="button" class="tournament-pro-page__secondary-action" data-open-structure-configuration="edit" ${competitionSetupLocked || !selectedDeclaredStructure ? "disabled" : ""}>
                            <i class="fa-solid fa-pen" aria-hidden="true"></i> Editar estructura
                          </button>
                        </div>
                      </header>

                      ${!selectedWorkspaceStructure.rounds?.length && selectedDeclaredStructure && phaseIsDeclared ? `
                        <div class="tournament-pro-page__structure-preparation-banner">
                          <div>
                            <span class="tournament-pro-page__eyebrow">ESTRUCTURA NO PREPARADA</span>
                            <strong>Genera las rondas y posiciones iniciales</strong>
                            <span>Usa la capacidad actual del torneo para materializar esta estructura.</span>
                          </div>
                          <button type="button" class="tournament-pro-page__primary-action" data-prepare-competition-structure ${competitionSetupLocked || competitionSetupSaving ? "disabled" : ""}>
                            <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Preparar estructura
                          </button>
                        </div>
                      ` : ""}

                      <nav class="tournament-pro-page__structure-nav" aria-label="Configuración de estructura">
                        ${[
                          ["pools", "Pools", "fa-layer-group"],
                          ["rounds", "Rondas", "fa-list-ol"],
                          ["seeding", "Seeding", "fa-ranking-star"],
                          ["advancement", "Progresión", "fa-route"],
                          ["settings", "Settings", "fa-sliders" ]
                        ].map(([id, label, icon]) => `
                          <button type="button" class="${competitionSection === id ? "is-active" : ""}" data-competition-section="${id}">
                            <i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span>
                          </button>
                        `).join("")}
                      </nav>

                      <div class="tournament-pro-page__structure-controller-body">
                        ${competitionSection === "pools" ? `
                          <section class="tournament-pro-page__controller-section-panel">
                            <div class="tournament-pro-page__section-heading">
                              <div><span class="tournament-pro-page__workspace-label">POOLS / GROUPS</span><small>Subdivisiones de la fase asociadas a esta estructura.</small></div>
                              <div class="tournament-pro-page__structure-detail-header-actions">
                                <span class="tournament-pro-page__step-count">${declaredPhaseGroups.filter((group) => group?.structureId === selectedWorkspaceStructure.id).length} pools</span>
                                <button type="button" class="tournament-pro-page__secondary-action" data-open-phase-group-configuration="create" ${competitionSetupLocked || !phaseIsDeclared ? "disabled" : ""}><i class="fa-solid fa-plus" aria-hidden="true"></i> Agregar pool</button>
                              </div>
                            </div>
                            ${(() => {
                              const structureGroups = declaredPhaseGroups.filter((group) => group?.structureId === selectedWorkspaceStructure.id);
                              return structureGroups.length ? `
                                <div class="tournament-pro-page__pool-grid">
                                  ${structureGroups.map((group, index) => {
                                    const participants = Array.isArray(group?.participants) ? group.participants.length : group?.participants && typeof group.participants === "object" ? Object.keys(group.participants).length : 0;
                                    return `<article class="tournament-pro-page__pool-card ${group.id === selectedWorkspacePhaseGroupId ? "is-active" : ""}"><button type="button" data-workspace-phase-group="${escapeAttr(group.id)}"><span class="tournament-pro-page__pool-index">${String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(group.name || `Pool ${index + 1}`)}</strong><small>${participants} participantes</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></article>`;
                                  }).join("")}
                                </div>
                                ${selectedWorkspacePhaseGroup && selectedWorkspacePhaseGroup.structureId === selectedWorkspaceStructure.id ? `<div class="tournament-pro-page__selected-pool"><div><span class="tournament-pro-page__eyebrow">POOL SELECCIONADO</span><strong>${escapeHtml(selectedWorkspacePhaseGroup.name || "Pool")}</strong><span>${Array.isArray(selectedWorkspacePhaseGroup.participants) ? selectedWorkspacePhaseGroup.participants.length : selectedWorkspacePhaseGroup.participants && typeof selectedWorkspacePhaseGroup.participants === "object" ? Object.keys(selectedWorkspacePhaseGroup.participants).length : 0} participantes</span></div><div class="tournament-pro-page__inline-actions"><button type="button" data-open-phase-group-configuration="edit" ${competitionSetupLocked ? "disabled" : ""}><i class="fa-solid fa-pen" aria-hidden="true"></i> Editar</button><button type="button" data-delete-phase-group ${competitionSetupLocked ? "disabled" : ""}><i class="fa-solid fa-trash" aria-hidden="true"></i> Eliminar</button></div></div>` : ""}
                              ` : `<div class="tournament-pro-page__workspace-empty"><strong>Esta estructura todavía no tiene Pools</strong><span>Cuando necesites dividir participantes, créalos aquí. El formato del Pool se configurará en su siguiente etapa.</span></div>`;
                            })()}
                          </section>
                        ` : ""}

                        ${competitionSection === "rounds" ? `
                          ${round_block}
                        ` : ""}

                        ${competitionSection === "seeding" ? `
                          <div class="tournament-pro-page__controller-placeholder"><i class="fa-solid fa-ranking-star" aria-hidden="true"></i><div><strong>Seeding</strong><span>Esta vista será el centro para definir y revisar las posiciones iniciales de la estructura.</span><small>La lógica del motor de seeding permanece intacta en este milestone.</small></div></div>
                        ` : ""}
                        ${competitionSection === "advancement" ? `
                          <div class="tournament-pro-page__controller-placeholder"><i class="fa-solid fa-route" aria-hidden="true"></i><div><strong>Progresión</strong><span>Aquí definiremos cómo los resultados de esta estructura alimentan la siguiente etapa.</span><small>No se modifica todavía la lógica de advancement.</small></div></div>
                        ` : ""}
                        ${competitionSection === "settings" ? `
                          <div class="tournament-pro-page__controller-placeholder"><i class="fa-solid fa-sliders" aria-hidden="true"></i><div><strong>Settings de la estructura</strong><span>Las reglas específicas de esta estructura vivirán aquí para no mezclar configuración con operación.</span><small>Los controles existentes de edición continúan en sus modales.</small></div></div>
                        ` : ""}
                      </div>
                    </section>
                  ` : ""}
                ` : `
                  <div class="tournament-pro-page__controller-empty"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><strong>Empieza creando una fase</strong><span>Las fases son el primer nivel de la competición. Después podrás definir sus estructuras.</span></div>
                `}
              </div>
            </div>
            ${selectedStructureSlotForAssignment ? `
              <div class="tournament-pro-page__modal-backdrop" data-structure-slot-modal-backdrop>
                <section class="tournament-pro-page__modal tournament-pro-page__configuration-modal" role="dialog" aria-modal="true" aria-labelledby="structure-slot-modal-title">
                  <header class="tournament-pro-page__modal-header">
                    <div>
                      <span class="tournament-pro-page__eyebrow">POSICIÓN ${escapeHtml(String(selectedStructureSlotForAssignment.position || selectedStructureSlotForAssignment.order || ""))}</span>
                      <h2 id="structure-slot-modal-title">${selectedStructureSlotForAssignment.entryId ? "Cambiar participante" : "Asignar participante"}</h2>
                      <p>El cambio se guarda en esta estructura y no modifica el bracket operativo.</p>
                    </div>
                    <button type="button" class="tournament-pro-page__modal-close" data-structure-slot-modal-close aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                  </header>
                  <div class="tournament-pro-page__configuration-modal-body">
                    ${structureAssignmentCandidates.length ? `
                      <form class="tournament-pro-page__setup-form" data-assign-structure-entry>
                        <label>Participante
                          <select name="entryId" required ${competitionSetupLocked || competitionSetupSaving ? "disabled" : ""}>
                            <option value="">Selecciona un participante</option>
                            ${structureAssignmentCandidates.map((entry) => `
                              <option value="${escapeAttr(entry.id)}" ${entry.id === selectedStructureSlotForAssignment.entryId ? "selected" : ""}>
                                ${escapeHtml(entry.displayName || "Participante")}
                              </option>
                            `).join("")}
                          </select>
                        </label>
                        <div class="tournament-pro-page__setup-form-actions">
                          <button type="submit" class="tournament-pro-page__primary-action" ${competitionSetupLocked || competitionSetupSaving ? "disabled" : ""}>Guardar posición</button>
                          ${selectedStructureSlotForAssignment.entryId ? `<button type="button" data-clear-structure-slot ${competitionSetupLocked || competitionSetupSaving ? "disabled" : ""}>Dejar disponible</button>` : ""}
                        </div>
                      </form>
                    ` : `
                      <div class="tournament-pro-page__workspace-empty">
                        No hay participantes activos para asignar. Agrégalos primero en Participantes y vuelve a esta posición.
                      </div>
                    `}
                  </div>
                </section>
              </div>
            ` : ""}

            ${phaseGroupConfigurationMode ? `
              <div class="tournament-pro-page__modal-backdrop" data-phase-group-configuration-backdrop>
                <section class="tournament-pro-page__modal tournament-pro-page__configuration-modal" role="dialog" aria-modal="true" aria-labelledby="phase-group-configuration-title">
                  <header class="tournament-pro-page__modal-header">
                    <div>
                      <span class="tournament-pro-page__eyebrow">${phaseGroupConfigurationMode === "edit" ? "EDITAR POOL" : "NUEVO POOL"}</span>
                      <h2 id="phase-group-configuration-title">${phaseGroupConfigurationMode === "edit" ? "Editar pool" : "Agregar pool"}</h2>
                      <p>Los Pools pertenecen a la fase. Su estructura define cómo se competirán sus participantes.</p>
                    </div>
                    <button type="button" class="tournament-pro-page__modal-close" data-phase-group-configuration-close aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                  </header>
                  <div class="tournament-pro-page__configuration-modal-body">
                    <form class="tournament-pro-page__setup-form" data-save-competition-phase-group>
                      <label>Nombre del Pool
                        <input name="phaseGroupName" type="text" maxlength="80" required value="${escapeAttr(modalEditingPhaseGroup?.name || "")}" placeholder="Ej. Pool A" ${competitionSetupLocked ? "disabled" : ""}>
                      </label>
                      <label>Estructura asociada
                        <select name="phaseGroupStructureId" required ${competitionSetupLocked ? "disabled" : ""}>
                          <option value="">Selecciona una estructura</option>
                          ${declaredStructures.map((structure) => `
                            <option value="${escapeAttr(structure.id)}" ${structure.id === modalEditingPhaseGroup?.structureId ? "selected" : ""}>
                              ${escapeHtml(structure.name)} · ${escapeHtml(formatLabel(structure.type))}
                            </option>
                          `).join("")}
                        </select>
                      </label>
                      <div class="tournament-pro-page__setup-form-actions">
                        <button type="submit" class="tournament-pro-page__primary-action" ${competitionSetupLocked || competitionSetupSaving || !declaredStructures.length ? "disabled" : ""}>
                          ${phaseGroupConfigurationMode === "edit" ? "Guardar cambios" : "Crear pool"}
                        </button>
                        ${phaseGroupConfigurationMode === "edit" && modalEditingPhaseGroup ? `
                          <button type="button" data-move-competition-phase-group="up" ${competitionSetupLocked || competitionSetupSaving || Number(modalEditingPhaseGroup.order || 1) <= 1 ? "disabled" : ""} aria-label="Mover pool arriba"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
                          <button type="button" data-move-competition-phase-group="down" ${competitionSetupLocked || competitionSetupSaving || Number(modalEditingPhaseGroup.order || 1) >= declaredPhaseGroups.length ? "disabled" : ""} aria-label="Mover pool abajo"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
                        ` : ""}
                      </div>
                    </form>
                    <p class="tournament-pro-page__setup-note">Los Pools son subdivisiones de la fase. No generan partidos por sí mismos en este paso.</p>
                  </div>
                </section>
              </div>
            ` : ""}

            ${phaseConfigurationMode ? `
              <div class="tournament-pro-page__modal-backdrop" data-phase-configuration-backdrop>
                <section class="tournament-pro-page__modal tournament-pro-page__configuration-modal" role="dialog" aria-modal="true" aria-labelledby="phase-configuration-title">
                  <header class="tournament-pro-page__modal-header">
                    <div>
                      <span class="tournament-pro-page__eyebrow">${phaseConfigurationMode === "edit" ? "EDITAR FASE" : "NUEVA FASE"}</span>
                      <h2 id="phase-configuration-title">${phaseConfigurationMode === "edit" ? "Editar fase" : "Agregar fase"}</h2>
                      <p>${phaseConfigurationMode === "edit" ? "Actualiza el nombre, formato o posición de esta fase." : "Define el nombre y formato de partida de la nueva fase."}</p>
                    </div>
                    <button type="button" class="tournament-pro-page__modal-close" data-phase-configuration-close aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                  </header>
                  <div class="tournament-pro-page__configuration-modal-body">
                    ${phaseConfigurationMode === "edit" ? `
                      <form class="tournament-pro-page__setup-form" data-save-competition-phase>
                        <strong>${phaseIsDeclared ? `Editar: ${escapeHtml(selectedWorkspacePhase?.name || "")}` : "Guardar configuración inicial"}</strong>
                        <label>Nombre de la fase
                          <input name="phaseName" type="text" maxlength="80" required value="${escapeAttr(selectedWorkspacePhase?.name || "")}" ${competitionSetupLocked ? "disabled" : ""}>
                        </label>
                        <label>Formato de partida
                          <select name="phaseMatchSystem" ${competitionSetupLocked ? "disabled" : ""}>${renderPhaseMatchSystemOptions(phaseMatchSystemValue)}</select>
                        </label>
                        <div class="tournament-pro-page__setup-form-actions">
                          <button type="submit" class="tournament-pro-page__primary-action" ${competitionSetupLocked || competitionSetupSaving ? "disabled" : ""}>${phaseIsDeclared ? "Guardar cambios" : "Guardar configuración inicial"}</button>
                          <button type="button" data-move-competition-phase="up" ${competitionSetupLocked || competitionSetupSaving || !phaseIsDeclared || Number(selectedWorkspacePhase?.order || 1) <= 1 ? "disabled" : ""} aria-label="Mover fase arriba"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
                          <button type="button" data-move-competition-phase="down" ${competitionSetupLocked || competitionSetupSaving || !phaseIsDeclared || Number(selectedWorkspacePhase?.order || 1) >= (pro.phases || []).length ? "disabled" : ""} aria-label="Mover fase abajo"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
                        </div>
                      </form>
                    ` : `
                      <form class="tournament-pro-page__setup-form" data-create-competition-phase>
                        <label>Nombre de la fase
                          <input name="phaseName" type="text" maxlength="80" required placeholder="Ej. Playoffs" ${competitionSetupLocked ? "disabled" : ""}>
                        </label>
                        <label>Formato de partida
                          <select name="phaseMatchSystem" ${competitionSetupLocked ? "disabled" : ""}>${renderPhaseMatchSystemOptions()}</select>
                        </label>
                        <div class="tournament-pro-page__setup-form-actions">
                          <button type="submit" class="tournament-pro-page__primary-action" ${competitionSetupLocked || competitionSetupSaving ? "disabled" : ""}><i class="fa-solid fa-plus" aria-hidden="true"></i> Crear fase</button>
                        </div>
                      </form>
                    `}
                    <p class="tournament-pro-page__setup-note">La configuración se guarda separada del bracket operativo.</p>
                  </div>
                </section>
              </div>
            ` : ""}

            ${structureConfigurationModalOpen ? `
              <div class="tournament-pro-page__modal-backdrop" data-structure-configuration-backdrop>
                <section class="tournament-pro-page__modal tournament-pro-page__configuration-modal" role="dialog" aria-modal="true" aria-labelledby="structure-configuration-title">
                  <header class="tournament-pro-page__modal-header">
                    <div>
                      <span class="tournament-pro-page__eyebrow">${modalEditingStructure ? "EDITAR ESTRUCTURA" : "NUEVA ESTRUCTURA"}</span>
                      <h2 id="structure-configuration-title">${modalEditingStructure ? "Editar estructura" : "Agregar estructura"}</h2>
                      <p>Fase: ${escapeHtml(selectedWorkspacePhase?.name || "—")}. Esto no modifica el bracket operativo.</p>
                    </div>
                    <button type="button" class="tournament-pro-page__modal-close" data-structure-configuration-close aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                  </header>
                  <div class="tournament-pro-page__configuration-modal-body">
                    <form class="tournament-pro-page__setup-form" data-save-competition-structure>
                      <label>Nombre de la estructura
                        <input name="structureName" type="text" maxlength="80" required value="${escapeAttr(modalEditingStructure?.name || "")}" placeholder="Ej. Winners Bracket" ${competitionSetupLocked ? "disabled" : ""}>
                      </label>
                      <label>Formato competitivo
                        <select name="structureType" ${competitionSetupLocked || (modalEditingStructure && ((modalEditingStructure.rounds || []).length || (modalEditingStructure.slots || []).length)) ? "disabled" : ""}>
                          <option value="SINGLE_ELIMINATION" ${(modalEditingStructure?.type || "SINGLE_ELIMINATION") === "SINGLE_ELIMINATION" ? "selected" : ""}>Eliminación simple</option>
                          <option value="DOUBLE_ELIMINATION" ${modalEditingStructure?.type === "DOUBLE_ELIMINATION" ? "selected" : ""}>Doble eliminación</option>
                        </select>
                      </label>
                      <div class="tournament-pro-page__setup-form-actions">
                        <button type="submit" class="tournament-pro-page__primary-action" ${competitionSetupLocked || competitionSetupSaving ? "disabled" : ""}>${modalEditingStructure ? "Guardar estructura" : "Crear estructura"}</button>
                        ${modalEditingStructure ? `
                          <button type="button" data-move-competition-structure="up" ${competitionSetupLocked || competitionSetupSaving || Number(modalEditingStructure.order || 1) <= 1 ? "disabled" : ""} aria-label="Mover estructura arriba"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
                          <button type="button" data-move-competition-structure="down" ${competitionSetupLocked || competitionSetupSaving || Number(modalEditingStructure.order || 1) >= declaredStructures.length ? "disabled" : ""} aria-label="Mover estructura abajo"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
                        ` : ""}
                      </div>
                    </form>
                  </div>
                </section>
              </div>
            ` : ""}
          </section>

        `;

        const capacityValue = Number(capacity || 0);
        const pendingCheckIn = Math.max(assigned - present - noShows, 0);
        const seatsRemaining = Math.max(capacityValue - assigned, 0);
        const participantsComplete = !eventLive && !eventFinished && !checkInOpen && !checkInCompleted && capacityValue >= 2 && registered >= capacityValue && placementComplete;
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
                      <span class="tournament-pro-page__registration-badge">${declaredAssignedParticipantIds.has(participant.id) || legacySlots.some((slot) => slot?.participantId === participant.id) ? "Asignado" : "Registrado"}</span>
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
              <strong>${participantsComplete ? "Participantes y estructura listos" : registered >= capacityValue ? "Falta completar la colocación en la estructura" : `Faltan ${Math.max(capacityValue - registered, 0)} participantes por registrar`}</strong>
              <p>${participantsComplete ? "La competencia ya tiene la lista completa y los participantes están colocados en la estructura operativa." : "Puedes seguir registrando participantes y volver a Configuración cuando quieras preparar o ajustar la estructura."}</p>
            </div>
            <button type="button" data-workspace-view="configuration">
              <i class="fa-solid fa-code-branch" aria-hidden="true"></i> Abrir configuración
            </button>
          </div>
        `;

        const operationsMarkup = `
          <section class="tournament-pro-page__checkin-workspace">
            <header class="tournament-pro-page__checkin-workspace-header">
              <div>
                <span class="tournament-pro-page__eyebrow">PARTICIPANTES</span>
                <h2>Preparar participantes</h2>
                <p>Registra participantes aquí. La configuración de la competencia puede prepararse antes, después o en paralelo; cada acción se habilita según sus prerrequisitos.</p>
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
                <button type="button" data-workspace-view="bracket"><i class="fa-solid fa-code-branch" aria-hidden="true"></i> Abrir bracket</button>
              </div>
            ` : eventFinished ? `
              <div class="tournament-pro-page__operation-bar"><div><strong>Torneo finalizado</strong><span>La información histórica permanece disponible.</span></div></div>
            ` : ""}

            ${preparationMarkup}
          </section>

          ${modalOpen ? `
            <div class="tournament-pro-page__modal-backdrop" data-slot-modal-backdrop>
              <section class="tournament-pro-page__modal" role="dialog" aria-modal="true" aria-labelledby="tournament-pro-slot-modal-title">
                <header class="tournament-pro-page__modal-header">
                  <div>
                    <span class="tournament-pro-page__eyebrow">${replacementParticipantId ? "REEMPLAZAR PARTICIPANTE" : "ASIGNAR PARTICIPANTE"}</span>
                    <h2 id="tournament-pro-slot-modal-title">${selectedSlot ? `Seed ${escapeHtml(String(selectedSlot.seed ?? selectedSlot.position ?? ""))}` : "Agregar participante"}</h2>
                    <p>${replacementParticipantId ? `Reemplazando: ${escapeHtml(selectedParticipantName)}` : selectedSlot ? (selectedParticipantName ? `Actualmente: ${escapeHtml(selectedParticipantName)}` : "Esta posición está disponible.") : "Registra al participante. Si existe una única estructura preparada, ARKHAM intentará colocarlo automáticamente."}</p>
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

        const selectedMatchCalledEntry = selectedWorkspaceMatch
          ? operationsModel.called.find((item) => item.matchId === selectedWorkspaceMatch.id) || null
          : null;
        const selectedMatchStation = selectedMatchCalledEntry?.station
          || (selectedWorkspaceMatch
            ? competitionStations.find((station) => station.currentMatchId === selectedWorkspaceMatch.id) || null
            : null);

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
              <div><span>ASIGNADOS</span><strong>${operationsModel.summary.calledMatches}</strong></div>
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
                    const calledStationEntry = station.currentMatchId
                      ? operationsModel.called.find((item) => item.matchId === station.currentMatchId) || null
                      : null;
                    const stationMatch = calledStationEntry?.match
                      || (station.currentMatchId
                        ? allCompetitionMatches.find((item) => item.match?.id === station.currentMatchId)?.match || null
                        : null);
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

            <section class="tournament-pro-page__resource-panel tournament-pro-page__resource-panel--operations">
              <div class="tournament-pro-page__resource-panel-header">
                <div>
                  <span class="tournament-pro-page__eyebrow">CALLED</span>
                  <h3>Matches asignados a un lobby</h3>
                </div>
                <span class="tournament-pro-page__workspace-count">${operationsModel.called.length} asignados</span>
              </div>
              ${operationsModel.called.length ? `
                <div class="tournament-pro-page__operations-list">
                  ${operationsModel.called.slice(0, 8).map(({ match, stage, station }) => `
                    <button type="button" class="tournament-pro-page__operation-match" data-open-operation-match="${escapeAttr(match.id)}">
                      <span class="tournament-pro-page__operation-match-id">${escapeHtml(match.id)}</span>
                      <span class="tournament-pro-page__operation-match-players">
                        <strong>${escapeHtml(getParticipantName(match.participantAId))}</strong>
                        <span>VS</span>
                        <strong>${escapeHtml(getParticipantName(match.participantBId))}</strong>
                      </span>
                      <small>${escapeHtml(station?.name || "Lobby no resuelto")} · ${escapeHtml(stage?.bracket === "grand_final" ? "Grand Final" : formatLabel(stage?.bracket || "Winners"))} · Round ${escapeHtml(String(stage?.number || "—"))}</small>
                    </button>
                  `).join("")}
                </div>
              ` : `
                <div class="tournament-pro-page__workspace-empty">No hay matches asignados a un lobby.</div>
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
                            <small>${escapeHtml(getMatchLifecycle(selectedOperationalMatch) === MATCH_LIFECYCLE.CALLED ? "Asignado · listo para iniciar" : selectedOperationalMatch.status === "pending" ? "Listo para iniciar" : matchStatusLabel(selectedOperationalMatch.status))}</small>
                          </div>
                          <span class="tournament-pro-page__match-workspace-status">${escapeHtml(getMatchLifecycle(selectedOperationalMatch) === MATCH_LIFECYCLE.CALLED ? "ASIGNADO" : matchStatusLabel(selectedOperationalMatch.status))}</span>
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
        const checkInWorkspaceMarkup = `
          <section class="tournament-pro-page__checkin-workspace tournament-pro-page__checkin-workspace--first-class">
            <header class="tournament-pro-page__checkin-workspace-header">
              <div>
                <span class="tournament-pro-page__eyebrow">CHECK-IN</span>
                <h2>Confirmar asistencia</h2>
                <p>Marca quién llegó, libera el asiento de quien no asistió o reemplázalo antes de iniciar el torneo.</p>
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
                <button type="button" data-workspace-view="bracket"><i class="fa-solid fa-code-branch" aria-hidden="true"></i> Abrir bracket</button>
              </div>
            ` : eventFinished ? `
              <div class="tournament-pro-page__operation-bar"><div><strong>Torneo finalizado</strong><span>La información histórica permanece disponible.</span></div></div>
            ` : !checkInOpen && !checkInCompleted ? `
              <div class="tournament-pro-page__operation-bar">
                <div><strong>Check-in todavía no abierto</strong><span>Completa la lista y termina la configuración de la competencia antes de abrirlo.</span></div>
                <button type="button" class="tournament-pro-page__primary-action" data-open-checkin ${participantsComplete ? "" : "disabled"}><i class="fa-solid fa-lock-open" aria-hidden="true"></i> Abrir check-in</button>
              </div>
            ` : ""}

            ${checkInOpen || checkInCompleted ? checkInListMarkup : `
              <div class="tournament-pro-page__checkin-panel">
                <div class="tournament-pro-page__checkin-panel-header">
                  <div>
                    <span class="tournament-pro-page__eyebrow">ESPERANDO APERTURA</span>
                    <h3>El check-in aún no está activo</h3>
                    <p>Cuando abras el check-in, aquí aparecerán Presente, Liberar asiento y Reemplazar.</p>
                  </div>
                </div>
              </div>
            `}
          </section>
        `;

        const competitionMarkup = `
          <div class="tournament-pro-page__competition-workspace ${isStandaloneCompetitionWorkspace ? "tournament-pro-page__competition-workspace--standalone" : ""}">
            ${activeCompetitionView === "structure" ? competitionStructureMarkup : activeCompetitionView === "bracket" ? competitionBracketMarkup : competitionMatchesMarkup}
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
                  <button type="button" data-workspace-view="participants">Ir a Check-in</button>
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
        } else if (currentView === "participants") {
          content.innerHTML = operationsMarkup;
        } else if (["configuration", "bracket", "matches", "competition"].includes(currentView)) {
          content.innerHTML = competitionMarkup;
        } else if (currentView === "checkin") {
          content.innerHTML = checkInWorkspaceMarkup;
        } else {
          content.innerHTML = resultsMarkup;
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

        page.querySelectorAll("[data-open-phase-configuration]").forEach((button) => {
          button.addEventListener("click", () => {
            const mode = button.dataset.openPhaseConfiguration;
            const phaseId = button.dataset.phaseId || null;
            if (mode === "edit" && phaseId) {
              selectedWorkspacePhaseId = phaseId;
              selectedWorkspaceStructureId = null;
              selectedWorkspacePhaseGroupId = null;
              selectedWorkspaceRoundId = null;
              selectedWorkspaceMatchId = null;
            }
            phaseConfigurationMode = mode;
            structureConfigurationModalOpen = false;
            render();
          });
        });

        const phaseSearchInput = page.querySelector("[data-phase-search]");
        phaseSearchInput?.addEventListener("input", (inputEvent) => {
          phaseSearchQuery = inputEvent.currentTarget.value || "";
          const normalizedQuery = phaseSearchQuery.trim().toLocaleLowerCase("es");
          page.querySelectorAll("[data-phase-search-item]").forEach((item) => {
            const phaseName = String(item.dataset.phaseSearchItem || "").toLocaleLowerCase("es");
            item.hidden = Boolean(normalizedQuery && !phaseName.includes(normalizedQuery));
          });
          const visibleItems = [...page.querySelectorAll("[data-phase-search-item]")].filter((item) => !item.hidden);
          const emptyState = page.querySelector("[data-phase-search-empty]");
          if (emptyState) emptyState.hidden = visibleItems.length > 0 || !normalizedQuery;
        });

        page.querySelectorAll("[data-open-structure-configuration]").forEach((button) => {
          button.addEventListener("click", () => {
            const structureId = pro.phases
              ?.find((phase) => phase?.id === selectedWorkspacePhaseId)
              ?.structures
              ?.find((structure) => structure?.id === selectedWorkspaceStructureId)
              ?.id || null;
            editingStructureId = button.dataset.openStructureConfiguration === "edit" ? structureId : null;
            structureConfigurationModalOpen = true;
            phaseConfigurationMode = null;
            render();
          });
        });

        page.querySelector("[data-prepare-competition-structure]")?.addEventListener("click", () => {
          runCompetitionSetupChange(async () => {
            const updatedEvent = await prepareCompetitionStructureBracket({
              tournamentId,
              eventId,
              event,
              phaseId: selectedWorkspacePhaseId,
              structureId: selectedWorkspaceStructureId
            });
            const preparedStructure = updatedEvent?.pro?.phases
              ?.find((phase) => phase?.id === selectedWorkspacePhaseId)
              ?.structures
              ?.find((structure) => structure?.id === selectedWorkspaceStructureId);
            selectedWorkspaceRoundId = preparedStructure?.rounds
              ?.find((round) => round.bracket === "winners" && Number(round.number) === 1)
              ?.id || null;
            selectedWorkspaceMatchId = null;
            return updatedEvent;
          });
        });

        page.querySelectorAll("[data-edit-structure-slot]").forEach((button) => {
          button.addEventListener("click", () => {
            structureSlotAssignmentId = button.dataset.editStructureSlot || null;
            render();
          });
        });

        page.querySelector("[data-structure-slot-modal-close]")?.addEventListener("click", () => {
          structureSlotAssignmentId = null;
          render();
        });
        page.querySelector("[data-structure-slot-modal-backdrop]")?.addEventListener("click", (clickEvent) => {
          if (clickEvent.target !== clickEvent.currentTarget) return;
          structureSlotAssignmentId = null;
          render();
        });

        page.querySelector("[data-assign-structure-entry]")?.addEventListener("submit", (submitEvent) => {
          submitEvent.preventDefault();
          const entryId = new FormData(submitEvent.currentTarget).get("entryId");
          runCompetitionSetupChange(async () => {
            const updatedEvent = await assignCompetitionEntryToStructureSlot({
              tournamentId,
              eventId,
              event,
              phaseId: selectedWorkspacePhaseId,
              structureId: selectedWorkspaceStructureId,
              slotId: structureSlotAssignmentId,
              entryId
            });
            structureSlotAssignmentId = null;
            selectedWorkspaceMatchId = null;
            return updatedEvent;
          });
        });

        page.querySelector("[data-clear-structure-slot]")?.addEventListener("click", () => {
          runCompetitionSetupChange(async () => {
            const updatedEvent = await assignCompetitionEntryToStructureSlot({
              tournamentId,
              eventId,
              event,
              phaseId: selectedWorkspacePhaseId,
              structureId: selectedWorkspaceStructureId,
              slotId: structureSlotAssignmentId,
              entryId: null
            });
            structureSlotAssignmentId = null;
            selectedWorkspaceMatchId = null;
            return updatedEvent;
          });
        });

        page.querySelectorAll("[data-open-phase-group-configuration]").forEach((button) => {
          button.addEventListener("click", () => {
            const mode = button.dataset.openPhaseGroupConfiguration;
            editingPhaseGroupId = mode === "edit" ? selectedWorkspacePhaseGroupId : null;
            phaseGroupConfigurationMode = mode;
            phaseConfigurationMode = null;
            structureConfigurationModalOpen = false;
            render();
          });
        });

        page.querySelector("[data-phase-group-configuration-close]")?.addEventListener("click", () => {
          phaseGroupConfigurationMode = null;
          editingPhaseGroupId = null;
          render();
        });

        page.querySelector("[data-phase-group-configuration-backdrop]")?.addEventListener("click", (clickEvent) => {
          if (clickEvent.target !== clickEvent.currentTarget) return;
          phaseGroupConfigurationMode = null;
          editingPhaseGroupId = null;
          render();
        });

        page.querySelector("[data-save-competition-phase-group]")?.addEventListener("submit", (submitEvent) => {
          submitEvent.preventDefault();
          const form = submitEvent.currentTarget;
          const name = form.elements.phaseGroupName.value;
          const structureId = form.elements.phaseGroupStructureId.value || null;
          const phaseGroupId = editingPhaseGroupId || createCompetitionConfigurationId("phase-group");
          runCompetitionSetupChange(async () => {
            const updatedEvent = await saveCompetitionPhaseGroupConfiguration({
              tournamentId,
              eventId,
              event,
              phaseId: selectedWorkspacePhaseId,
              phaseGroupId,
              name,
              structureId
            });
            selectedWorkspacePhaseGroupId = phaseGroupId;
            phaseGroupConfigurationMode = null;
            editingPhaseGroupId = null;
            return updatedEvent;
          });
        });

        page.querySelectorAll("[data-move-competition-phase-group]").forEach((button) => {
          button.addEventListener("click", () => runCompetitionSetupChange(async () => {
            const updatedEvent = await moveCompetitionPhaseGroupConfiguration({
              tournamentId,
              eventId,
              event,
              phaseId: selectedWorkspacePhaseId,
              phaseGroupId: editingPhaseGroupId || selectedWorkspacePhaseGroupId,
              direction: button.dataset.moveCompetitionPhaseGroup
            });
            phaseGroupConfigurationMode = null;
            editingPhaseGroupId = null;
            return updatedEvent;
          }));
        });

        page.querySelector("[data-delete-phase-group]")?.addEventListener("click", () => {
          const group = declaredPhaseGroups.find((item) => item?.id === selectedWorkspacePhaseGroupId);
          if (!group) return;
          const confirmed = window.confirm(`¿Eliminar el Pool "${group.name || "sin nombre"}"? Solo puede eliminarse si está vacío y no está referenciado por una estructura.`);
          if (!confirmed) return;
          runCompetitionSetupChange(async () => {
            const updatedEvent = await deleteCompetitionPhaseGroupConfiguration({
              tournamentId,
              eventId,
              event,
              phaseId: selectedWorkspacePhaseId,
              phaseGroupId: selectedWorkspacePhaseGroupId
            });
            selectedWorkspacePhaseGroupId = null;
            return updatedEvent;
          });
        });

        page.querySelectorAll("[data-workspace-phase-group]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedWorkspacePhaseGroupId = button.dataset.workspacePhaseGroup || null;
            render();
          });
        });

        page.querySelector("[data-phase-configuration-close]")?.addEventListener("click", () => {
          phaseConfigurationMode = null;
          render();
        });
        page.querySelector("[data-phase-configuration-backdrop]")?.addEventListener("click", (clickEvent) => {
          if (clickEvent.target !== clickEvent.currentTarget) return;
          phaseConfigurationMode = null;
          render();
        });
        page.querySelector("[data-structure-configuration-close]")?.addEventListener("click", () => {
          structureConfigurationModalOpen = false;
          editingStructureId = null;
          render();
        });
        page.querySelector("[data-structure-configuration-backdrop]")?.addEventListener("click", (clickEvent) => {
          if (clickEvent.target !== clickEvent.currentTarget) return;
          structureConfigurationModalOpen = false;
          editingStructureId = null;
          render();
        });

        page.querySelector("[data-save-competition-phase]")?.addEventListener("submit", (submitEvent) => {
          submitEvent.preventDefault();
          const form = submitEvent.currentTarget;
          const name = form.elements.phaseName.value;
          const matchSystem = form.elements.phaseMatchSystem.value;
          const phaseId = selectedWorkspacePhaseId || createCompetitionConfigurationId("phase");
          runCompetitionSetupChange(async () => {
            const updatedEvent = await saveCompetitionPhaseConfiguration({
              tournamentId,
              eventId,
              event,
              phaseId,
              name,
              matchSystemMode: matchSystem ? "CUSTOM" : "INHERIT",
              matchSystem: matchSystem || null
            });
            phaseConfigurationMode = null;
            return updatedEvent;
          });
        });

        page.querySelector("[data-create-competition-phase]")?.addEventListener("submit", (submitEvent) => {
          submitEvent.preventDefault();
          const form = submitEvent.currentTarget;
          const name = form.elements.phaseName.value;
          const matchSystem = form.elements.phaseMatchSystem.value;
          const phaseId = createCompetitionConfigurationId("phase");
          runCompetitionSetupChange(async () => {
            const updatedEvent = await saveCompetitionPhaseConfiguration({
              tournamentId,
              eventId,
              event,
              phaseId,
              name,
              matchSystemMode: matchSystem ? "CUSTOM" : "INHERIT",
              matchSystem: matchSystem || null
            });
            selectedWorkspacePhaseId = phaseId;
            selectedWorkspaceStructureId = null;
            selectedWorkspacePhaseGroupId = null;
            phaseGroupConfigurationMode = null;
            navigateCompetitionSection("overview", { replace: true });
            editingPhaseGroupId = null;
            selectedWorkspaceRoundId = null;
            selectedWorkspaceMatchId = null;
            phaseConfigurationMode = null;
            return updatedEvent;
          });
        });

        page.querySelectorAll("[data-move-competition-phase]").forEach((button) => {
          button.addEventListener("click", () => runCompetitionSetupChange(() => moveCompetitionPhaseConfiguration({
            tournamentId,
            eventId,
            event,
            phaseId: selectedWorkspacePhaseId,
            direction: button.dataset.moveCompetitionPhase
          })));
        });

        page.querySelector("[data-save-competition-structure]")?.addEventListener("submit", (submitEvent) => {
          submitEvent.preventDefault();
          const form = submitEvent.currentTarget;
          const name = form.elements.structureName.value;
          const type = form.elements.structureType.value;
          const structureId = editingStructureId || createCompetitionConfigurationId("structure");
          runCompetitionSetupChange(async () => {
            const updatedEvent = await saveCompetitionStructureConfiguration({
              tournamentId,
              eventId,
              event,
              phaseId: selectedWorkspacePhaseId,
              structureId,
              name,
              type
            });
            selectedWorkspaceStructureId = structureId;
            selectedWorkspaceRoundId = null;
            selectedWorkspaceMatchId = null;
            structureConfigurationModalOpen = false;
            editingStructureId = null;
            return updatedEvent;
          });
        });

        page.querySelectorAll("[data-move-competition-structure]").forEach((button) => {
          button.addEventListener("click", () => {
            const structureId = editingStructureId;
            runCompetitionSetupChange(() => moveCompetitionStructureConfiguration({
              tournamentId,
              eventId,
              event,
              phaseId: selectedWorkspacePhaseId,
              structureId,
              direction: button.dataset.moveCompetitionStructure
            }));
          });
        });

        page.querySelectorAll("[data-competition-view]").forEach((button) => {
          button.addEventListener("click", () => navigateCompetitionView(button.dataset.competitionView || "structure"));
        });

        page.querySelectorAll("[data-competition-section]").forEach((button) => {
          button.addEventListener("click", () => navigateCompetitionSection(button.dataset.competitionSection || "pools"));
        });

        page.querySelector("[data-run-competition-core-audit]")?.addEventListener("click", () => {
          if (competitionCoreAuditLoading) return;

          competitionCoreAuditLoading = true;
          competitionCoreAudit = null;
          competitionCoreMigrationDryRun = null;
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
            competitionCoreMigrationDryRun = result;
            render();
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

        page.querySelector("[data-persist-competition-core-migration]")?.addEventListener("click", async () => {
          if (!competitionCoreAudit || competitionCoreMigrationDryRun?.status !== "READY" ||
              competitionCoreMigrationDryRun?.validation?.valid !== true) return;

          const confirmed = window.confirm(
            "Esta acción reemplazará únicamente el bracket operativo del evento abierto. Úsala solo en el torneo de PRUEBA, en preparación. Se comprobarán otra vez el estado y el bracket antes de guardar. ¿Confirmas?"
          );
          if (!confirmed) return;

          const execution = executeCompetitionBracketMigration(event, {
            currentBracket: competitionCoreAudit.currentBracket,
            proposedBracket: competitionCoreMigrationDryRun.proposedBracket,
            readiness: competitionCoreAudit.readiness,
            reconciliation: competitionCoreAudit.reconciliation,
            validation: competitionCoreMigrationDryRun.validation,
            authorizePersistence: true
          });
          if (execution.status !== "READY" || execution.executable !== true ||
              execution.persistenceAllowed !== true) {
            window.alert("Migración detenida antes de guardar: " + execution.reasonCodes.join(" · "));
            return;
          }

          try {
            const result = await persistCompetitionBracketMigration({
              tournamentId, eventId,
              proposedBracket: competitionCoreMigrationDryRun.proposedBracket,
              expectedCurrentBracket: competitionCoreAudit.currentBracket,
              confirmPersistence: true
            });
            if (result.persisted === true && result.verified === true) {
              event = await getTournamentProEvent(tournamentId, eventId);
              pro = ensureTournamentProState(event || {});
              competitionCoreMigrationDryRun = null;
              competitionCoreAudit = auditTournamentProBracketAgainstCompetitionCore(event, {
                structureId: selectedWorkspaceStructureId || null,
                phaseId: selectedWorkspacePhaseId || null
              });
            }
            render();
            window.alert([
              "Migración: " + result.status,
              "Guardado: " + (result.persisted ? "sí" : "no"),
              "Verificación: " + (result.verified ? "correcta" : "no confirmada"),
              (result.reasonCodes || []).join(" · ")
            ].filter(Boolean).join("\n"));
          } catch (error) {
            window.alert("La migración no pudo completarse: " + (error?.message || "error desconocido"));
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

        page.querySelectorAll("[data-open-checkin]").forEach((button) => {
          button.addEventListener("click", async () => {
            const currentCheckInOpen = pro.checkIn?.status === "open";
            const currentCheckInCompleted = pro.checkIn?.status === "completed";
            if (currentCheckInOpen || currentCheckInCompleted) {
              return navigateWorkspace("checkin");
            }

            const currentCapacity = Number(event.capacity?.value ?? event.capacity ?? 0);
            const currentRegistered = Object.values(pro.participants || {})
              .filter((participant) => !["rejected", "withdrawn", "no_show"].includes(String(participant?.status || "").toLowerCase()))
              .length;
            const currentPrimaryPhase = [...(pro.phases || [])]
              .filter((phase) => phase?.legacy !== true)
              .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))[0] || null;
            const currentPrimaryStructure = [...(currentPrimaryPhase?.structures || [])]
              .filter((structure) => structure?.legacy !== true)
              .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))[0] || null;
            const currentStructureSlots = Array.isArray(currentPrimaryStructure?.slots) ? currentPrimaryStructure.slots : [];
            const currentPlaced = new Set(currentStructureSlots.filter((slot) => slot?.participantId).map((slot) => slot.participantId)).size;
            const currentStructurePrepared = Boolean(currentPrimaryStructure && (currentPrimaryStructure.rounds || []).length && currentStructureSlots.length);
            const currentReady = currentStructurePrepared
              ? currentCapacity >= 2 && currentRegistered >= currentCapacity && currentPlaced === currentRegistered
              : currentCapacity >= 2 && currentRegistered >= currentCapacity && Object.values(pro.bracket?.slots || {}).filter((slot) => slot?.participantId).length >= currentRegistered && pro.bracket?.generated;

            if (!currentReady) {
              return window.alert(currentStructurePrepared
                ? "Completa los participantes y colócalos en la estructura antes de abrir el check-in."
                : "Primero prepara la estructura y completa los participantes antes de abrir el check-in.");
            }

            await runOperation(() => setCheckInOpen({
              tournamentId,
              eventId,
              event,
              open: true
            }));
            navigateWorkspace("checkin", { replace: true });
          });
        });

        page.querySelectorAll("[data-workspace-phase]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedWorkspacePhaseId = button.dataset.workspacePhase || null;
            selectedWorkspaceStructureId = null;
            selectedWorkspacePhaseGroupId = null;
            phaseGroupConfigurationMode = null;
            editingPhaseGroupId = null;
            selectedWorkspaceRoundId = null;
            selectedWorkspaceMatchId = null;
            render();
          });
        });

        page.querySelectorAll("[data-workspace-structure]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedWorkspaceStructureId = button.dataset.workspaceStructure || null;
            selectedWorkspaceRoundId = null;
            navigateCompetitionSection("overview", { replace: true });
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
            const calledEntry = operationsModel.called.find((item) => item.matchId === matchId) || null;
            selectedWorkspaceMatchId = matchId || null;
            selectedOperationalStationId = calledEntry?.station?.id || null;
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
            selectedSlotId = null;
            replacementParticipantId = null;
            modalOpen = true;
            render();
            return requestAnimationFrame(() => page.querySelector("[data-slot-search-form] input")?.focus());
          }
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
          if (!canAddParticipant) return;
          selectedSlotId = null;
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
        try {
          if (replacementParticipantId && selectedSlotId) {
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
          } else if (selectedSlotId && hasPreparedDeclaredStructure) {
            const participantIdsBefore = new Set(Object.keys(pro.participants || {}));
            event = await addParticipant({
              tournamentId,
              eventId,
              event,
              entityType,
              entityId,
              displayName,
              manual
            });
            pro = ensureTournamentProState(event);
            const createdParticipant = Object.values(pro.participants || {})
              .find((item) => !participantIdsBefore.has(item.id));
            const targetSlot = declaredStructureSlots.find((slot) =>
              String(slot?.id) === String(selectedSlotId) ||
              (slot?.seed && `seed-${slot.seed}` === selectedSlotId)
            );
            const entry = createdParticipant
              ? Object.values(pro.entries || {}).find((item) => item?.legacyParticipantId === createdParticipant.id)
              : null;
            if (!targetSlot || targetSlot.participantId) {
              throw new Error("La posición seleccionada ya no está disponible.");
            }
            if (!entry) {
              throw new Error("No se pudo crear la entrada competitiva del participante.");
            }
            event = await assignCompetitionEntryToStructureSlot({
              tournamentId,
              eventId,
              event,
              phaseId: primaryDeclaredPhase.id,
              structureId: primaryDeclaredStructure.id,
              slotId: targetSlot.id,
              entryId: entry.id
            });
          } else if (selectedSlotId) {
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
          } else {
            const participantIdsBefore = new Set(Object.keys(pro.participants || {}));
            event = await addParticipant({
              tournamentId,
              eventId,
              event,
              entityType,
              entityId,
              displayName,
              manual
            });

            pro = ensureTournamentProState(event);
            const createdParticipant = Object.values(pro.participants || {})
              .find((item) => !participantIdsBefore.has(item.id));
            const preparedStructures = (pro.phases || [])
              .filter((phase) => phase?.legacy !== true)
              .flatMap((phase) => (phase?.structures || []).map((structure) => ({ phase, structure })))
              .filter(({ structure }) => (structure?.rounds || []).length && Array.isArray(structure?.slots) && structure.slots.length);

            if (preparedStructures.length === 1) {
              const [{ phase, structure }] = preparedStructures;
              const emptySlot = structure.slots
                .filter((slot) => !slot?.participantId)
                .sort((a, b) => Number(a?.position || 0) - Number(b?.position || 0))[0];
              const entry = createdParticipant
                ? Object.values(pro.entries || {}).find((item) => item?.legacyParticipantId === createdParticipant.id)
                : null;

              if (emptySlot && entry) {
                event = await assignCompetitionEntryToStructureSlot({
                  tournamentId,
                  eventId,
                  event,
                  phaseId: phase.id,
                  structureId: structure.id,
                  slotId: emptySlot.id,
                  entryId: entry.id
                });
              }
            }
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
        if (phaseGroupConfigurationMode) {
          phaseGroupConfigurationMode = null;
          editingPhaseGroupId = null;
          render();
          return;
        }
        if (structureConfigurationModalOpen) {
          structureConfigurationModalOpen = false;
          editingStructureId = null;
          render();
          return;
        }
        if (phaseConfigurationMode) {
          phaseConfigurationMode = null;
          render();
          return;
        }
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
