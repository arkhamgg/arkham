// ========================================
// ARKHAM — Public Competition Landing
// ========================================

import { getEntity, getMapEntity, subscribeMapEntity } from "../services/firestore.js";
import { getGame } from "../services/gameCatalog.js";

import { renderLanding1 } from "./competitionLanding/templates/landing-1.js";
import { renderLanding2 } from "./competitionLanding/templates/landing-2.js";
import { renderLanding3 } from "./competitionLanding/templates/landing-3.js";
import { getTemplateResources } from "./competitionLanding/utils/landingUtils.js";
import { updatePublicTournamentBracket } from "../components/publicTournamentBracket.js";
import { openPublicTournamentRegistration } from "../components/publicTournamentRegistration.js";
import { getMyTournamentRegistrationStatus } from "../services/tournamentRegistration.js";
import { getCurrentSession, initializeSession } from "../services/session.js";
import { getMyRecognitionStatus, requestTournamentRecognition } from "../services/tournamentRecognition.js";


// ========================================
// PAGE
// ========================================

export function CompetitionLanding() {
  const page = document.createElement("main");

  page.className = "competition-landing-page";
  page.id = "competition-landing-page";

  const urlParams = new URLSearchParams(window.location.search);

  const tournamentId = urlParams.get("tournamentId");
  const eventId = urlParams.get("eventId");

  page.innerHTML = `
    <div class="competition-landing-page__state" data-landing-state>
      <div class="competition-landing-page__state-icon">
        <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
      </div>

      <p>CARGANDO COMPETENCIA...</p>
    </div>
  `;

  if (!tournamentId || !eventId) {
    renderError(
      page,
      "No pudimos identificar la competencia solicitada."
    );

    return page;
  }

  loadCompetition({
    page,
    tournamentId,
    eventId
  });

  return page;
}


// ========================================
// LOAD
// ========================================

async function loadCompetition({
  page,
  tournamentId,
  eventId
}) {
  try {
    // ======================================
    // TOURNAMENT + EVENT
    // ======================================

    const [tournament, event] = await Promise.all([
      getEntity(
        "tournaments",
        tournamentId
      ),

      getMapEntity(
        "tournaments",
        tournamentId,
        "events",
        eventId
      )
    ]);


    // ======================================
    // VALIDATION
    // ======================================

    if (!tournament) {
      throw new Error(
        "No se encontró el torneo."
      );
    }

    if (!event) {
      throw new Error(
        "No se encontró el evento."
      );
    }


    // ======================================
    // GAME
    // ======================================

    const game =
      await getGame(event.gameId);

    if (!game) {
      throw new Error(
        "No se encontró el juego de la competencia."
      );
    }


    // ======================================
    // PUBLIC REGISTRATION ACCESS
    // ======================================

    /*
     * La Landing pública NO debe consultar
     * información privada de:
     *
     * accounts/{ownerId}
     * subscriptions/{subscriptionId}
     *
     * únicamente para determinar si puede
     * renderizar la competencia.
     *
     * El estado de registro público deberá
     * resolverse posteriormente mediante un
     * dato público derivado del torneo.
     */

    const registrationAccess =
      resolvePublicRegistrationAccess(event);


    // ======================================
    // LANDING TEMPLATE
    // ======================================

    const templateId =
      event.landingTemplate || "template-1";

    const resources =
      getTemplateResources(
        game,
        templateId
      );


    // ======================================
    // TEMPLATE RENDERERS
    // ======================================

    const renderers = {
      "template-1": renderLanding1,
      "template-2": renderLanding2,
      "template-3": renderLanding3
    };

    const renderer =
      renderers[templateId] ||
      renderLanding1;


    // ======================================
    // RENDER
    // ======================================

    let registrationState = {
      canRegister: registrationAccess.canRegister,
      request: null,
      recognition: null
    };

    renderer({
      page,
      tournament,
      event,
      game,
      resources,
      tournamentId,
      eventId,
      registrationAccess: registrationState
    });

    const bindRecognition = () => {
      page.querySelectorAll("[data-public-bracket-mount] [data-recognition-cta]").forEach((button) => {
        if (button.dataset.recognitionBound === "true") return;
        button.dataset.recognitionBound = "true";
        button.addEventListener("click", async () => {
          if (registrationState.recognition?.status === "requested" || registrationState.recognition?.status === "approved") return;
          try {
            await initializeSession();
            if (!getCurrentSession()) {
              const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
              const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;
              window.history.pushState({}, "", loginUrl);
              window.dispatchEvent(new PopStateEvent("popstate"));
              return;
            }
            const response = await requestTournamentRecognition({ tournamentId, eventId });
            registrationState = { ...registrationState, recognition: response?.recognition || registrationState.recognition };
            updatePublicTournamentBracket(page, event, registrationState);
            bindRecognition();
          } catch (error) {
            window.alert(error?.message || "No fue posible reclamar el reconocimiento.");
          }
        });
      });
    };

    const bindRegistration = () => {
      page.querySelectorAll("[data-public-bracket-mount] [data-registration-cta]").forEach((button) => {
        if (button.dataset.registrationBound === "true") return;
        button.dataset.registrationBound = "true";
        button.addEventListener("click", async () => {
          if (registrationState.request?.status === "pending" || registrationState.request?.status === "approved") return;
          try {
            await initializeSession();
            if (!getCurrentSession()) {
              const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
              const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;
              window.history.pushState({}, "", loginUrl);
              window.dispatchEvent(new PopStateEvent("popstate"));
              return;
            }
            await openPublicTournamentRegistration({ page, tournament, event, tournamentId, eventId });
          } catch (error) {
            console.error("ARKHAM — Error abriendo registro público:", error);
          }
        });
      });
    };

    page.addEventListener("arkham:registration-submitted", async () => {
      try {
        const statusResponse = await getMyTournamentRegistrationStatus({ tournamentId, eventId });
        let recognitionResponse = null;
        try { recognitionResponse = await getMyRecognitionStatus({ tournamentId, eventId }); } catch (recognitionError) { console.warn("ARKHAM — No fue posible resolver el reconocimiento:", recognitionError); }
        registrationState = { ...registrationState, request: statusResponse?.request || null, recognition: recognitionResponse?.eligible ? recognitionResponse.recognition : null };
        updatePublicTournamentBracket(page, event, registrationState);
        bindRegistration();
        bindRecognition();
      } catch (error) {
        console.warn("ARKHAM — No fue posible actualizar el estado de inscripción:", error);
      }
    });

    bindRegistration();
    bindRecognition();

    try {
      await initializeSession();
      if (getCurrentSession()) {
        const statusResponse = await getMyTournamentRegistrationStatus({ tournamentId, eventId });
        let recognitionResponse = null;
        try { recognitionResponse = await getMyRecognitionStatus({ tournamentId, eventId }); } catch (recognitionError) { console.warn("ARKHAM — No fue posible resolver el reconocimiento:", recognitionError); }
        registrationState = { ...registrationState, request: statusResponse?.request || null, recognition: recognitionResponse?.eligible ? recognitionResponse.recognition : null };
        updatePublicTournamentBracket(page, event, registrationState);
        bindRegistration();
        bindRecognition();
      }
    } catch (error) {
      console.warn("ARKHAM — No fue posible resolver el estado de inscripción pública:", error);
    }


    // Public real-time sync: the landing listens only to the public
    // tournament event document. No account/subscription data is read.
    subscribeMapEntity(
      "tournaments",
      tournamentId,
      "events",
      eventId,
      (updatedEvent) => {
        if (!updatedEvent) return;
        updatePublicTournamentBracket(page, updatedEvent, registrationState);
        bindRegistration();
        bindRecognition();
      }
    );

  } catch (error) {

    console.error(
      "ARKHAM — Error cargando competencia pública:",
      error
    );

    renderError(
      page,
      "No pudimos cargar esta competencia. Intenta nuevamente."
    );
  }
}


// ========================================
// PUBLIC REGISTRATION ACCESS
// ========================================

function resolvePublicRegistrationAccess(event) {
  return {
    canRegister: Boolean(event?.pro),
    planId: event?.pro ? "pro" : null
  };
}


// ========================================
// ERROR
// ========================================

function renderError(
  page,
  message
) {
  page.innerHTML = `
    <div class="competition-landing-page__state competition-landing-page__state--error">

      <div class="competition-landing-page__state-icon">
        <i
          class="fa-solid fa-triangle-exclamation"
          aria-hidden="true"
        ></i>
      </div>

      <h1>
        COMPETENCIA NO DISPONIBLE
      </h1>

      <p>
        ${escapeHtml(message)}
      </p>

      <button
        type="button"
        class="competition-landing-page__state-button"
        data-back
      >
        VOLVER
      </button>

    </div>
  `;


  page
    .querySelector("[data-back]")
    ?.addEventListener(
      "click",
      () => {
        window.history.back();
      }
    );
}


// ========================================
// SAFE HTML
// ========================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}