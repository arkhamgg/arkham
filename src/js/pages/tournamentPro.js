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
import { TournamentGeneralRulesSection } from "../components/tournamentGeneralRulesSection.js";
import { TournamentLocationDateTimeSection } from "../components/tournamentLocationDateTimeSection.js";
import { TournamentPrizesRegistrationSection } from "../components/tournamentPrizesRegistrationSection.js";
import { TournamentRegistrationRequirementsSection } from "../components/tournamentRegistrationRequirementsSection.js";
import { TournamentContactSection } from "../components/tournamentContactSection.js";
import { showSuccessModal } from "../components/successModal.js";
import { updateMapEntity } from "../services/firestore.js";
import { syncCalendarEvent } from "../services/calendarService.js";
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
  const workspaceViewIds = new Set(["dashboard", "participants", "pools", "configuration", "information", "location-date", "prizes-registration", "registration-requirements", "contact", "bracket", "matches", "competition", "checkin", "results"]);
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
    const currentWorkspace = getWorkspaceView();
    const targetWorkspace = currentWorkspace === "pools" ? "pools" : "competition";
    const url = new URL(window.location.href);
    url.searchParams.set("proView", targetWorkspace);
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
      if (["bracket", "matches", "information", "location-date", "prizes-registration", "registration-requirements", "contact"].includes(view)) url.searchParams.delete("competitionSection");
      if (view === "pools") {
        url.searchParams.delete("competitionView");
        url.searchParams.delete("competitionSection");
      }
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
      let informationEditors = null;
      let informationSaving = false;
      let locationDateTimeEditor = null;
      let locationDateTimeSaving = false;
      let prizesRegistrationEditor = null;
      let prizesRegistrationSaving = false;
      let registrationRequirementsEditor = null;
      let registrationRequirementsSaving = false;
      let contactEditor = null;
      let contactSaving = false;
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
        const legacyType = bracketType === "double_elimination"
          ? "DOUBLE_ELIMINATION"
          : "SINGLE_ELIMINATION";

        // A persisted declarative Competition is authoritative for the workspace.
        // Once pro.phases exists, Main Competition and its initial Structure are
        // real domain entities created by Builder. Never inject a synthetic
        // legacy phase/structure beside them, even if a legacy operational
        // bracket still exists as a compatibility projection.
        if (configuredPhases.length > 0) {
          return configuredPhases
            .map((phase, phaseIndex) => {
              const phaseStructures = structures
                .filter((structure) => structure?.phaseId === phase.id)
                .sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0));

              const normalizedStructures = phaseStructures.map((structure, structureIndex) => {
                const declaredRounds = Array.isArray(structure?.rounds)
                  ? structure.rounds
                  : [];
                const hasLinkedOperationalStages = stages.some((stage) =>
                  stage?.structureId === structure.id ||
                  (stage?.matches || []).some((match) => match?.structureId === structure.id)
                );
                const operationalRounds = declaredRounds.length && hasLinkedOperationalStages
                  ? getCompetitionRounds(event, {
                      structureId: structure.id,
                      phaseId: phase.id
                    })
                  : [];

                return {
                  ...structure,
                  order: Number.isFinite(Number(structure?.order))
                    ? Number(structure.order)
                    : structureIndex + 1,
                  rounds: operationalRounds.length
                    ? operationalRounds
                    : declaredRounds,
                  legacy: false
                };
              });

              return {
                ...phase,
                id: phase.id || `phase-${phaseIndex + 1}`,
                name: phase.name || `Phase ${phaseIndex + 1}`,
                order: Number.isFinite(Number(phase.order))
                  ? Number(phase.order)
                  : phaseIndex + 1,
                status: phase.status || "configured",
                legacy: false,
                structures: normalizedStructures
              };
            })
            .sort((a, b) => a.order - b.order);
        }

        // No declarative phases means this is an old Tournament Pro event.
        // Only here do we expose the compatibility projection as Main Competition.
        return [{
          id: "legacy-main",
          name: "Main Competition",
          order: 1,
          status: pro.status || "configured",
          matchFormat: pro.matchSystem || event.matchSystem || null,
          legacy: true,
          structures: [{
            id: "legacy-main-structure",
            name: bracketType === "double_elimination"
              ? "Double Elimination"
              : "Single Elimination",
            type: legacyType,
            order: 1,
            legacy: true,
            rounds: getCompetitionRounds(event, { bracket: null })
          }]
        }];
      };

      const getParticipantFlowState = () => {
        const workspacePhases = getCompetitionWorkspaceModel();
        const legacySlots = Object.values(pro.bracket?.slots || {}).sort(
          (a, b) => Number(a.seed || 0) - Number(b.seed || 0)
        );
        const participants = Object.values(pro.participants || {});
        const activeParticipants = participants.filter((participant) =>
          !["rejected", "withdrawn", "no_show"].includes(
            String(participant?.status || "").toLowerCase()
          )
        );
        const checkInOpen = pro.checkIn?.status === "open";
        const checkInCompleted = pro.checkIn?.status === "completed";
        const eventLive = pro.status === "live";
        const eventFinished = pro.status === "finished";
        const primaryDeclaredPhase = [...workspacePhases]
          .filter((phase) => phase?.legacy !== true)
          .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))[0] || null;
        const primaryDeclaredStructure = [...(primaryDeclaredPhase?.structures || [])]
          .filter((structure) => structure?.legacy !== true)
          .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))[0] || null;
        const declaredStructureSlots = Array.isArray(primaryDeclaredStructure?.slots)
          ? primaryDeclaredStructure.slots
          : [];
        const declaredAssignedParticipantIds = new Set(
          declaredStructureSlots
            .filter((slot) => slot?.participantId)
            .map((slot) => slot.participantId)
        );
        const hasPreparedDeclaredStructure = Boolean(
          primaryDeclaredStructure &&
          Array.isArray(primaryDeclaredStructure.rounds) &&
          primaryDeclaredStructure.rounds.length > 0 &&
          declaredStructureSlots.length > 0
        );
        const registered = activeParticipants.length;
        const assigned = hasPreparedDeclaredStructure
          ? declaredAssignedParticipantIds.size
          : legacySlots.filter((slot) => slot?.participantId).length;
        const placementComplete = hasPreparedDeclaredStructure
          ? declaredAssignedParticipantIds.size === registered && registered > 0
          : legacySlots.filter((slot) => slot?.participantId).length === registered && registered > 0;
        const canAddParticipant =
          !eventLive &&
          !eventFinished &&
          !checkInOpen &&
          !checkInCompleted &&
          registered < Number(capacity || 0);

        return {
          workspacePhases,
          legacySlots,
          activeParticipants,
          primaryDeclaredPhase,
          primaryDeclaredStructure,
          declaredStructureSlots,
          declaredAssignedParticipantIds,
          hasPreparedDeclaredStructure,
          registered,
          assigned,
          placementComplete,
          eventLive,
          eventFinished,
          checkInOpen,
          checkInCompleted,
          canAddParticipant
        };
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
            : ["configuration", "pools"].includes(currentView)
              ? "structure"
              : competitionView;
        const isStandaloneCompetitionWorkspace = ["configuration", "pools", "bracket", "matches"].includes(currentView);
        const competitionSection = getCompetitionSection();
        const viewMeta = {
          dashboard: { title: game, subtitle: "" },
          participants: { title: "PARTICIPANTES", subtitle: "Administra solicitudes y completa la lista de participantes" },
          pools: { title: "POOLS", subtitle: "Organiza participantes por grupos y administra su estructura competitiva" },
          configuration: { title: "CONFIGURACIÓN", subtitle: "Fases, estructuras, pools y reglas de la competición" },
          information: { title: "REGLAS GENERALES", subtitle: "" },
          "location-date": { title: "UBICACIÓN Y FECHA", subtitle: "" },
          "prizes-registration": { title: "PREMIOS E INSCRIPCIÓN", subtitle: "" },
          "registration-requirements": { title: "REQUISITOS DE INSCRIPCIÓN", subtitle: "" },
          contact: { title: "CONTACTO", subtitle: "" },
          bracket: { title: "BRACKET", subtitle: "Visualiza el cuadro competitivo y sus rutas" },
          matches: { title: "MATCHES", subtitle: "Administra los matches y su operación" },
          competition: { title: "COMPETITION", subtitle: "Estructura competitiva" },
          checkin: { title: "CHECK-IN", subtitle: "Confirma asistencia y prepara el inicio del torneo" },
          results: { title: "RESULTS", subtitle: "Resultados oficiales" }
        }[currentView] || { title: "TOURNAMENT PRO", subtitle: "" };
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
        const selectedWorkspacePhaseGroup = declaredPhaseGroups.find((group) => group?.id === selectedWorkspacePhaseGroupId && group?.structureId === selectedWorkspaceStructureId) || null;
        const modalEditingPhaseGroup = declaredPhaseGroups.find((group) => group?.id === editingPhaseGroupId) || null;
        const groupParticipantIds = Array.isArray(selectedWorkspacePhaseGroup?.participants)
          ? selectedWorkspacePhaseGroup.participants.map((item) => typeof item === "string" ? item : item?.entryId || item?.id).filter(Boolean)
          : selectedWorkspacePhaseGroup?.participants && typeof selectedWorkspacePhaseGroup.participants === "object"
            ? Object.keys(selectedWorkspacePhaseGroup.participants)
            : [];
        const assignedToSiblingPools = new Set(declaredPhaseGroups
          .filter((group) => group?.structureId === selectedWorkspaceStructureId && group?.id !== selectedWorkspacePhaseGroup?.id)
          .flatMap((group) => Array.isArray(group?.participants)
            ? group.participants.map((item) => typeof item === "string" ? item : item?.entryId || item?.id).filter(Boolean)
            : group?.participants && typeof group.participants === "object" ? Object.keys(group.participants) : []));
        const poolAssignmentCandidates = Object.values(pro.entries || {})
          .filter((entry) => entry?.id && !["rejected", "withdrawn", "no_show", "eliminated", "dq"].includes(String(entry.status || "").toLowerCase()))
          .filter((entry) => !assignedToSiblingPools.has(entry.id) || groupParticipantIds.includes(entry.id))
          .sort((a, b) => String(a.displayName || "").localeCompare(String(b.displayName || ""), "es"));
        const selectedDeclaredStructure = declaredStructures.find((structure) => structure?.id === selectedWorkspaceStructure?.id) || null;
        const modalEditingStructure = declaredStructures.find((structure) => structure?.id === editingStructureId) || null;

        const participantFlowState = getParticipantFlowState();
        const {
          primaryDeclaredPhase,
          primaryDeclaredStructure,
          declaredStructureSlots,
          declaredAssignedParticipantIds,
          hasPreparedDeclaredStructure,
          registered,
          assigned,
          placementComplete,
          canAddParticipant
        } = participantFlowState;
        const selectedSlot = hasPreparedDeclaredStructure
          ? declaredStructureSlots.find((slot) =>
              String(slot?.id) === String(selectedSlotId) ||
              (slot?.seed && `seed-${slot.seed}` === selectedSlotId)
            ) || null
          : legacySlots.find((slot) => slot.seed && `seed-${slot.seed}` === selectedSlotId) || null;
        const selectedParticipantName = selectedSlot?.participantId
          ? getParticipantName(selectedSlot.participantId)
          : "";
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
        // The operations modal must read the operational bracket as its source of truth.
        // Declarative workspace rounds can retain a READY blueprint copy after the
        // operational match has already transitioned to LIVE, which hides result entry.
        const selectedOperationalBracketMatch = selectedOperationalStation?.currentMatchId
          ? legacyStages
            .flatMap((stage) => Array.isArray(stage?.matches) ? stage.matches : [])
            .find((match) => match?.id === selectedOperationalStation.currentMatchId) || null
          : null;
        const selectedOperationalMatch = selectedOperationalBracketMatch
          || selectedOperationalCalledEntry?.match
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

                <button type="button" class="tournament-pro-page__workspace-entry" data-workspace-view="pools">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-people-group" aria-hidden="true"></i></span>
                  <span>
                    <strong>Pools</strong>
                    <small>Distribución de participantes, jornadas y clasificación por grupos.</small>
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

                <button type="button" class="tournament-pro-page__workspace-entry" data-workspace-view="information">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i></span>
                  <span>
                    <strong>Reglas generales</strong>
                    <small>Define y administra las reglas generales del torneo.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry" data-workspace-view="location-date">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-calendar-days" aria-hidden="true"></i></span>
                  <span>
                    <strong>Ubicación y fecha</strong>
                    <small>Administra dónde y cuándo se realizará el torneo.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry" data-workspace-view="prizes-registration">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-trophy" aria-hidden="true"></i></span>
                  <span>
                    <strong>Premios e inscripción</strong>
                    <small>Define los premios y el costo de participar.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry" data-workspace-view="contact">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-address-book" aria-hidden="true"></i></span>
                  <span>
                    <strong>Contacto</strong>
                    <small>Configura los canales para comunicarse con la organización.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>

                <button type="button" class="tournament-pro-page__workspace-entry" data-workspace-view="registration-requirements">
                  <span class="tournament-pro-page__workspace-entry-icon"><i class="fa-solid fa-clipboard-check" aria-hidden="true"></i></span>
                  <span>
                    <strong>Requisitos de inscripción</strong>
                    <small>Configura depósitos y comprobantes solicitados.</small>
                  </span>
                  <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>
              </div>
            </section>



          </section>
          ${mobileExperienceModalMarkup}
        `;

        const informationMarkup = `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__information-workspace tournament-pro-page__information-workspace--compact">
            <div class="tournament-pro-page__information-grid tournament-pro-page__information-grid--rules-only">
              <div data-event-rules-section></div>
            </div>
            <footer class="tournament-pro-page__information-actions">
              <span>Los cambios se guardan en este evento.</span>
              <button type="button" class="tournament-pro-page__primary-action" data-save-event-information ${informationSaving ? "disabled" : ""}>
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> ${informationSaving ? "Guardando…" : "Guardar reglas"}
              </button>
            </footer>
          </section>
        `;

        const locationDateTimeMarkup = `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__location-date-workspace">
            <div class="tournament-location-date-section" data-location-date-section></div>
            <footer class="tournament-pro-page__information-actions">
              <span>Los cambios se guardan en este evento.</span>
              <button type="button" class="tournament-pro-page__primary-action" data-save-location-date ${locationDateTimeSaving ? "disabled" : ""}>
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> ${locationDateTimeSaving ? "Guardando…" : "Guardar ubicación y fecha"}
              </button>
            </footer>
          </section>
        `;

        const prizesRegistrationMarkup = `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__prizes-registration-workspace">
            <div data-prizes-registration-section></div>
            <footer class="tournament-pro-page__information-actions">
              <span>Los cambios se guardan en este evento.</span>
              <button type="button" class="tournament-pro-page__primary-action" data-save-prizes-registration ${prizesRegistrationSaving ? "disabled" : ""}>
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> ${prizesRegistrationSaving ? "Guardando…" : "Guardar premios e inscripción"}
              </button>
            </footer>
          </section>
        `;

        const registrationRequirementsMarkup = `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__registration-requirements-workspace">
            <div data-registration-requirements-section></div>
            <footer class="tournament-pro-page__information-actions">
              <span>Los cambios se guardan en este evento.</span>
              <button type="button" class="tournament-pro-page__primary-action" data-save-registration-requirements ${registrationRequirementsSaving ? "disabled" : ""}>
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> ${registrationRequirementsSaving ? "Guardando…" : "Guardar requisitos"}
              </button>
            </footer>
          </section>
        `;

        const contactMarkup = `
          <section class="tournament-pro-page__card tournament-pro-page__card--wide tournament-pro-page__contact-workspace">
            <div data-tournament-contact-section></div>
            <footer class="tournament-pro-page__information-actions">
              <span>Los cambios se guardan en este evento.</span>
              <button type="button" class="tournament-pro-page__primary-action" data-save-contact ${contactSaving ? "disabled" : ""}>
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> ${contactSaving ? "Guardando…" : "Guardar contacto"}
              </button>
            </footer>
          </section>
        `;

        if (currentView === "dashboard") {
          content.innerHTML = dashboardMarkup;
        } else if (currentView === "participants") {
          content.innerHTML = operationsMarkup;
        } else if (["configuration", "pools", "bracket", "matches", "competition"].includes(currentView)) {
          content.innerHTML = competitionMarkup;
        } else if (currentView === "information") {
          content.innerHTML = informationMarkup;
          const generalRulesSection = TournamentGeneralRulesSection({
            rules: event.rules || []
          });
          const rulesSectionContainer = content.querySelector("[data-event-rules-section]");
          if (rulesSectionContainer) {
            rulesSectionContainer.replaceWith(generalRulesSection.element);
          }
          informationEditors = {
            rules: generalRulesSection
          };
        } else if (currentView === "location-date") {
          content.innerHTML = locationDateTimeMarkup;
          locationDateTimeEditor = TournamentLocationDateTimeSection({
            location: event.location || null,
            dateTime: event.dateTime || null
          });
          const sectionContainer = content.querySelector("[data-location-date-section]");
          if (sectionContainer) sectionContainer.replaceWith(locationDateTimeEditor.element);

        } else if (currentView === "prizes-registration") {
          content.innerHTML = prizesRegistrationMarkup;
          prizesRegistrationEditor = TournamentPrizesRegistrationSection({
            prizes: event.prizes || [],
            registrationCost: event.registrationCost || null,
            participationType: event.participationType || ""
          });
          const sectionContainer = content.querySelector("[data-prizes-registration-section]");
          if (sectionContainer) sectionContainer.replaceWith(prizesRegistrationEditor.element);

        } else if (currentView === "registration-requirements") {
          content.innerHTML = registrationRequirementsMarkup;
          registrationRequirementsEditor = TournamentRegistrationRequirementsSection({
            value: event.registrationRequirements || null
          });
          const sectionContainer = content.querySelector("[data-registration-requirements-section]");
          if (sectionContainer) sectionContainer.replaceWith(registrationRequirementsEditor.element);

        } else if (currentView === "contact") {
          content.innerHTML = contactMarkup;
          contactEditor = TournamentContactSection({ value: event.supportContact || null });
          const contactContainer = content.querySelector("[data-tournament-contact-section]");
          if (contactContainer) contactContainer.replaceWith(contactEditor.element);

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

        page.querySelector("[data-save-event-information]")?.addEventListener("click", async (clickEvent) => {
          const button = clickEvent.currentTarget;
          if (!informationEditors || informationSaving) return;

          const updates = {
            rules: informationEditors.rules.getValue()
          };

          informationSaving = true;
          button.disabled = true;
          button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Guardando…';

          try {
            await updateMapEntity("tournaments", tournamentId, "events", eventId, updates);
            event = { ...event, ...updates };

            informationSaving = false;
            render();
            showSuccessModal({ root: page, title: "Reglas guardadas", message: "Las reglas generales se actualizaron correctamente." });
          } catch (error) {
            informationSaving = false;
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar información';
            window.alert(error?.message || "No fue posible guardar la información del torneo.");
          }
        });

        page.querySelector("[data-save-prizes-registration]")?.addEventListener("click", async (clickEvent) => {
          const button = clickEvent.currentTarget;
          if (!prizesRegistrationEditor || prizesRegistrationSaving) return;
          const updates = prizesRegistrationEditor.getValue();
          prizesRegistrationSaving = true;
          button.disabled = true;
          button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Guardando…';
          try {
            await updateMapEntity("tournaments", tournamentId, "events", eventId, updates);
            event = { ...event, ...updates };
            prizesRegistrationSaving = false;
            render();
            showSuccessModal({ root: page, title: "Cambios guardados", message: "Los premios y el costo de inscripción se actualizaron correctamente." });
          } catch (error) {
            prizesRegistrationSaving = false;
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar premios e inscripción';
            window.alert(error?.message || "No fue posible guardar premios e inscripción.");
          }
        });

        page.querySelector("[data-save-registration-requirements]")?.addEventListener("click", async (clickEvent) => {
          const button = clickEvent.currentTarget;
          if (!registrationRequirementsEditor || registrationRequirementsSaving) return;
          const updates = registrationRequirementsEditor.getValue();
          registrationRequirementsSaving = true;
          button.disabled = true;
          button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Guardando…';
          try {
            await updateMapEntity("tournaments", tournamentId, "events", eventId, updates);
            event = { ...event, ...updates };
            registrationRequirementsSaving = false;
            render();
            showSuccessModal({ root: page, title: "Requisitos guardados", message: "Los requisitos de inscripción se actualizaron correctamente." });
          } catch (error) {
            registrationRequirementsSaving = false;
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar requisitos';
            window.alert(error?.message || "No fue posible guardar los requisitos de inscripción.");
          }
        });

        page.querySelector("[data-save-contact]")?.addEventListener("click", async (clickEvent) => {
          const button = clickEvent.currentTarget;
          if (!contactEditor || contactSaving) return;
          const updates = { supportContact: contactEditor.getValue() };
          contactSaving = true;
          button.disabled = true;
          button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Guardando…';
          try {
            await updateMapEntity("tournaments", tournamentId, "events", eventId, updates);
            event = { ...event, ...updates };
            contactSaving = false;
            render();
            showSuccessModal({ root: page, title: "Contacto guardado", message: "Los medios de contacto se actualizaron correctamente." });
          } catch (error) {
            contactSaving = false;
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar contacto';
            window.alert(error?.message || "No fue posible guardar el contacto del torneo.");
          }
        });

        page.querySelector("[data-save-location-date]")?.addEventListener("click", async (clickEvent) => {
          const button = clickEvent.currentTarget;
          if (!locationDateTimeEditor || locationDateTimeSaving) return;
          const updates = locationDateTimeEditor.getValue();
          locationDateTimeSaving = true;
          button.disabled = true;
          button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Guardando…';
          try {
            await updateMapEntity("tournaments", tournamentId, "events", eventId, updates);
            event = { ...event, ...updates };
            try {
              await syncCalendarEvent({ tournamentId, eventId, event });
            } catch (calendarError) {
              console.error("ARKHAM — No fue posible sincronizar la fecha con Calendar:", calendarError);
            }
            locationDateTimeSaving = false;
            render();
            showSuccessModal({ root: page, title: "Ubicación y fecha guardadas", message: "La ubicación y los horarios del torneo se actualizaron correctamente." });
          } catch (error) {
            locationDateTimeSaving = false;
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar ubicación y fecha';
            window.alert(error?.message || "No fue posible guardar la ubicación y fecha del torneo.");
          }
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
          const rules = {
            version: 1,
            competition: { rounds: Number(form.elements.phaseGroupRounds.value || 1) },
            scoring: {
              win: Number(form.elements.phaseGroupWinPoints.value),
              draw: Number(form.elements.phaseGroupDrawPoints.value),
              loss: Number(form.elements.phaseGroupLossPoints.value)
            },
            standings: { enabled: true },
            tiebreakers: [form.elements.phaseGroupTiebreaker.value || "head_to_head"],
            qualification: { qualifiers: Number(form.elements.phaseGroupQualifiers.value || 2) }
          };
          runCompetitionSetupChange(async () => {
            const updatedEvent = await saveCompetitionPhaseGroupConfiguration({
              tournamentId,
              eventId,
              event,
              phaseId: selectedWorkspacePhaseId,
              phaseGroupId,
              name,
              structureId,
              rules
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
          const currentPhase = (pro.phases || []).find((item) => item?.id === selectedWorkspacePhaseId);
          const currentPhaseGroups = Array.isArray(currentPhase?.phaseGroups) ? currentPhase.phaseGroups : [];
          const group = currentPhaseGroups.find((item) => item?.id === selectedWorkspacePhaseGroupId);
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

        page.querySelector("[data-save-pool-participants]")?.addEventListener("submit", (submitEvent) => {
          submitEvent.preventDefault();
          const currentPhase = (pro.phases || []).find((item) => item?.id === selectedWorkspacePhaseId);
          const currentPhaseGroups = Array.isArray(currentPhase?.phaseGroups) ? currentPhase.phaseGroups : [];
          const currentPhaseGroup = currentPhaseGroups.find((group) =>
            group?.id === selectedWorkspacePhaseGroupId && group?.structureId === selectedWorkspaceStructureId
          );
          if (!currentPhase || !currentPhaseGroup) return;
          const form = submitEvent.currentTarget;
          const entryIds = [...form.querySelectorAll('input[name="entryIds"]:checked')].map((input) => input.value);
          runCompetitionSetupChange(async () => {
            const updatedEvent = await saveCompetitionPhaseGroupConfiguration({
              tournamentId,
              eventId,
              event,
              phaseId: selectedWorkspacePhaseId,
              phaseGroupId: currentPhaseGroup.id,
              name: currentPhaseGroup.name,
              structureId: selectedWorkspaceStructureId,
              participants: entryIds
            });
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

        page.querySelectorAll("[data-pools-search]").forEach((input) => {
          input.addEventListener("input", () => {
            const kind = input.dataset.poolsSearch;
            const query = input.value.trim().toLocaleLowerCase();
            const items = [...page.querySelectorAll(`[data-pools-search-item="${kind}"]`)];
            let visibleCount = 0;
            items.forEach((item) => {
              const matches = (item.dataset.poolsSearchText || item.textContent || "").toLocaleLowerCase().includes(query);
              item.hidden = !matches;
              if (matches) visibleCount += 1;
            });
            const empty = page.querySelector(`[data-pools-search-empty="${kind}"]`);
            if (empty) empty.hidden = !items.length || visibleCount > 0;
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

            if (!participant) {
              return window.alert("No se encontró el participante seleccionado.");
            }

            const legacySlot = Object.values(pro.bracket?.slots || {})
              .find((item) => item?.participantId === participant.id)
              || Object.values(pro.bracket?.slots || {})
                .find((item) => participant.seed != null && Number(item?.seed) === Number(participant.seed))
              || null;

            const declaredSlot = (pro.phases || [])
              .filter((phase) => phase?.legacy !== true)
              .flatMap((phase) => Array.isArray(phase?.structures) ? phase.structures : [])
              .filter((structure) => structure?.legacy !== true)
              .flatMap((structure) => Array.isArray(structure?.slots) ? structure.slots : [])
              .find((slot) => slot?.participantId === participant.id)
              || null;

            const slot = declaredSlot || legacySlot;

            if (!slot) {
              return window.alert("No se encontró la posición de este participante.");
            }

            selectedSlotId = declaredSlot?.id
              ? declaredSlot.id
              : legacySlot?.seed != null
                ? `seed-${legacySlot.seed}`
                : null;

            if (!selectedSlotId) {
              return window.alert("No se pudo determinar la posición de este participante.");
            }

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
          const { canAddParticipant } = getParticipantFlowState();
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
          const {
            primaryDeclaredPhase,
            primaryDeclaredStructure,
            declaredStructureSlots,
            hasPreparedDeclaredStructure
          } = getParticipantFlowState();
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
              manual,
              autoPlace: true
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
console.log("app basic success")