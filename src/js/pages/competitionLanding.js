// ========================================
// NEXUS — Public Competition Landing
// ========================================

import { getEntity, getMapEntity, subscribeMapEntity } from "../services/firestore.js";
import { getGame } from "../services/gameCatalog.js";

import { renderLanding1 } from "./competitionLanding/templates/landing-1.js";
import { renderLanding2 } from "./competitionLanding/templates/landing-2.js";
import { renderLanding3 } from "./competitionLanding/templates/landing-3.js";
import { getTemplateResources } from "./competitionLanding/utils/landingUtils.js";
import { updatePublicTournamentBracket } from "../components/publicTournamentBracket.js";


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
      resolvePublicRegistrationAccess(
        tournament
      );


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

    renderer({
      page,
      tournament,
      event,
      game,
      resources,
      tournamentId,
      eventId,
      registrationAccess
    });


    // Public real-time sync: the landing listens only to the public
    // tournament event document. No account/subscription data is read.
    subscribeMapEntity(
      "tournaments",
      tournamentId,
      "events",
      eventId,
      (updatedEvent) => {
        if (!updatedEvent) return;
        updatePublicTournamentBracket(page, updatedEvent);
      }
    );

  } catch (error) {

    console.error(
      "NEXUS — Error cargando competencia pública:",
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

function resolvePublicRegistrationAccess(tournament) {

  /*
   * IMPORTANTE
   *
   * La Landing pública no debe intentar
   * leer:
   *
   * accounts/{ownerId}
   * subscriptions/{subscriptionId}
   *
   * porque esos datos pertenecen al ámbito
   * privado de la cuenta del organizador.
   *
   * Actualmente el registro público todavía
   * no está implementado.
   *
   * Por seguridad y compatibilidad con las
   * reglas actuales de Firestore, devolvemos
   * acceso cerrado de forma explícita.
   *
   * Más adelante esta función podrá utilizar
   * una propiedad pública derivada del torneo,
   * por ejemplo:
   *
   * tournament.publicRegistration
   *
   * sin exponer información privada de la
   * cuenta o de la suscripción.
   */

  return {
    canRegister: false,
    planId: null
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