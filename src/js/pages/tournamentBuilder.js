import { GameSelector } from "../components/gameSelector.js";
import { CompetitiveModeSelector } from "../components/competitiveModeSelector.js";
import { FormatSelector } from "../components/formatSelector.js";
import { MatchSystemSelector } from "../components/matchSystemSelector.js";
import { CapacitySelector } from "../components/capacitySelector.js";
import { CapacityAvailabilitySelector } from "../components/capacityAvailabilitySelector.js";
import { RulesEditor } from "../components/rulesEditor.js";
import { LocationSelector } from "../components/locationSelector.js";
import { DateTimeSelector } from "../components/dateTimeSelector.js";
import { PrizeEditor } from "../components/prizeEditor.js";
import { RegistrationCostSelector } from "../components/registrationCostSelector.js";
import { ContactSupportSelector } from "../components/contactSupportSelector.js";
import { RegistrationRequirementsEditor } from "../components/registrationRequirementsEditor.js";

import { getCurrentAccountContext } from "../services/account.js";
import { getCurrentEntityContext } from "../services/entityContext.js";
import { createSubscriptionAccess } from "../services/planService.js";
import { hasEffectiveSubscriptionAccess } from "../services/subscription.js";
import { ensureTournamentProState } from "../services/tournamentPro.js";
import {
  createMapEntity,
  updateMapEntity,
  getEntity
} from "../services/firestore.js";

import {
  syncCalendarEvent
} from "../services/calendarService.js";

export function TournamentBuilder({ dashboardSidebar = null } = {}) {
  const page = document.createElement("main");

  page.className = "tournament-builder-page";

  /*
   * --------------------------------------------------
   * STATE
   * --------------------------------------------------
   */

  let selectedGame = "";
  let selectedCompetitiveMode = null;
  let selectedFormat = "";
  let selectedMatchSystem = "";
  let selectedCapacity = null;
  let selectedRegistrationAvailability = null;
  let selectedRules = [];
  let selectedLocation = null;
  let selectedDateTime = null;
  let selectedPrizes = [];
  let selectedRegistrationCost = null;
  let selectedSupportContact = null;
  let selectedRegistrationRequirements = null;
  let selectedLandingTemplate = "template-1";

  const urlParams = new URLSearchParams(
    window.location.search
  );

  let tournamentId =
    urlParams.get("tournamentId") || null;

  let eventId =
    urlParams.get("eventId") || null;

  const isEditMode =
    Boolean(tournamentId && eventId);

  /*
   * --------------------------------------------------
   * CONTEXT INITIALIZATION
   * --------------------------------------------------
   * El Builder debe resolver el Tournament ID antes
   * de permitir cualquier operación de guardado.
   */
  let nexusContextReady = false;

  let nexusContextInitialization = null;

  // Contexto NEXUS disponible para todo el Builder.
  // Debe poder ser utilizado tanto por loadNexusContext()
  // como por el flujo de guardado.
  let accountContext = null;
  let entityContext = null;

  /*
   * --------------------------------------------------
   * PAGE STRUCTURE
   * --------------------------------------------------
   */

  page.innerHTML = `
    <div class="dashboard-layout">

      <section class="dashboard-main">

        <section class="tournament-builder">

          <!-- HEADER -->

          <header class="tournament-builder__header">

            <div class="tournament-builder__header-content">

              <span class="tournament-builder__eyebrow">
                ARKHAM // TOURNAMENT BUILDER
              </span>

              <h1
                class="tournament-builder__title"
                data-builder-title
              >
                CREAR TORNEO
              </h1>

              <p class="tournament-builder__description">
                Configura y publica tu competición.
              </p>

            </div>

          </header>


          <!-- CONFIGURACIÓN COMPETITIVA -->

          <section class="tournament-builder__section">

            <div class="tournament-builder__section-header">

              <div>

                <span class="tournament-builder__section-eyebrow">
                  CONFIGURACIÓN
                </span>

                <h2 class="tournament-builder__section-title">
                  Configuración competitiva
                </h2>

                <p class="tournament-builder__section-description">
                  Define la estructura competitiva de tu torneo.
                </p>

              </div>

            </div>


            <div class="tournament-builder__competitive-grid">

              <!-- JUEGO -->

              <article class="tournament-builder__card">

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    JUEGO
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="game"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-game
                ></div>

              </article>


              <!-- MODALIDAD -->

              <article class="tournament-builder__card">

                <div class="tournament-builder__card-header">

                  <div>

                    <span class="tournament-builder__card-label">
                      MODALIDAD
                    </span>

                    <span
                      class="tournament-builder__card-context"
                      data-tournament-participation
                    >
                      —
                    </span>

                  </div>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="mode"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-competitive-mode
                ></div>

              </article>


              <!-- FORMATO -->

              <article class="tournament-builder__card">

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    FORMATO
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="format"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-format
                ></div>

              </article>


              <!-- SISTEMA DE PARTIDA -->

              <article class="tournament-builder__card">

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    SISTEMA DE PARTIDA
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="match-system"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-match-system
                ></div>

              </article>


              <!-- CAPACIDAD -->

              <article
                class="tournament-builder__card tournament-builder__card--wide"
              >

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    CAPACIDAD
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="capacity"
                  ></span>

                </div>

                <div class="tournament-builder__capacity-layout">

                  <div
                    class="tournament-builder__field"
                    data-tournament-capacity
                  ></div>

                  <div
                    class="tournament-builder__availability"
                    data-tournament-capacity-availability
                  ></div>

                </div>

              </article>

            </div>

          </section>


          <!-- INFORMACIÓN DEL TORNEO -->

          <section class="tournament-builder__section">

            <div class="tournament-builder__section-header">

              <div>

                <span class="tournament-builder__section-eyebrow">
                  INFORMACIÓN
                </span>

                <h2 class="tournament-builder__section-title">
                  Información del torneo
                </h2>

                <p class="tournament-builder__section-description">
                  Completa la información que verán los participantes.
                </p>

              </div>

            </div>


            <div class="tournament-builder__information-grid">

              <!-- REGLAS -->

              <article
                class="tournament-builder__card tournament-builder__card--wide"
              >

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    REGLAS
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="rules"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-rules
                ></div>

              </article>


              <!-- UBICACIÓN -->

              <article class="tournament-builder__card">

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    UBICACIÓN
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="location"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-location
                ></div>

              </article>


              <!-- FECHA Y HORA -->

              <article class="tournament-builder__card">

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    FECHA Y HORA
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="date-time"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-date-time
                ></div>

              </article>


              <!-- PREMIOS -->

              <article
                class="tournament-builder__card tournament-builder__card--wide"
              >

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    PREMIOS
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="prizes"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-prizes
                ></div>

              </article>


              <!-- INSCRIPCIÓN -->

              <article class="tournament-builder__card">

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    INSCRIPCIÓN
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="registration-cost"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-registration-cost
                ></div>

              </article>


              <!-- REQUISITOS DE INSCRIPCIÓN -->

              <article
                class="tournament-builder__card tournament-builder__card--wide"
              >

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    REQUISITOS DE INSCRIPCIÓN
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="registration-requirements"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-registration-requirements
                ></div>

              </article>


              <!-- CONTACTO -->

              <article
                class="tournament-builder__card tournament-builder__card--wide"
              >

                <div class="tournament-builder__card-header">

                  <span class="tournament-builder__card-label">
                    CONTACTO
                  </span>

                  <span
                    class="tournament-builder__card-status"
                    data-builder-status="support"
                  ></span>

                </div>

                <div
                  class="tournament-builder__field"
                  data-tournament-support-contact
                ></div>

              </article>

            </div>

          </section>


          <!-- LANDING TEMPLATE -->

          <section class="tournament-builder__section">

            <div class="tournament-builder__section-header">

              <div>

                <span class="tournament-builder__section-eyebrow">
                  PRESENTACIÓN
                </span>

                <h2 class="tournament-builder__section-title">
                  Landing pública
                </h2>

                <p class="tournament-builder__section-description">
                  Selecciona la plantilla visual que utilizará la página pública de tu competencia.
                </p>

              </div>

            </div>

            <article class="tournament-builder__card tournament-builder__card--wide">

              <div class="tournament-builder__card-header">

                <div>

                  <span class="tournament-builder__card-label">
                    PLANTILLA
                  </span>

                  <span
                    class="tournament-builder__card-context"
                    data-landing-template-description
                  >
                    Experiencia cinematográfica y dominante del juego.
                  </span>

                </div>

              </div>

              <div class="tournament-builder__field">

                <label
                  for="tournament-landing-template"
                  class="tournament-builder__field-label"
                >
                  Diseño de landing
                </label>

                <select
                  id="tournament-landing-template"
                  class="tournament-builder__select"
                  data-tournament-landing-template
                >
                  <option value="template-1">
                    Landing 1 — Cinematic
                  </option>

                  <option value="template-2">
                    Landing 2 — Competitive
                  </option>

                  <option value="template-3">
                    Landing 3 — Game Showcase
                  </option>
                </select>

              </div>

            </article>

          </section>


          <!-- ACTIONS -->

          <footer class="tournament-builder__actions">

            <button
              type="button"
              class="tournament-builder__button tournament-builder__button--secondary"
              data-builder-save
            >
              GUARDAR TORNEO
            </button>

            <button
              type="button"
              class="tournament-builder__button tournament-builder__button--primary"
              data-builder-cancel
            >
              CANCELAR
            </button>

          </footer>

        </section>

      </section>

    </div>
  `;


  // ========================================
  // DASHBOARD SIDEBAR
  // ========================================
  // El Sidebar es responsabilidad de DashboardShell.
  // El Builder solo recibe la referencia para actualizar
  // su contexto cuando corresponde.

  const sidebar = dashboardSidebar;


  /*
   * --------------------------------------------------
   * CONTAINERS
   * --------------------------------------------------
   */

  const gameContainer = page.querySelector(
    "[data-tournament-game]"
  );

  const competitiveModeContainer = page.querySelector(
    "[data-tournament-competitive-mode]"
  );

  const formatContainer = page.querySelector(
    "[data-tournament-format]"
  );

  const matchSystemContainer = page.querySelector(
    "[data-tournament-match-system]"
  );

  const capacityContainer = page.querySelector(
    "[data-tournament-capacity]"
  );

  const capacityAvailabilityContainer = page.querySelector(
    "[data-tournament-capacity-availability]"
  );

  const rulesContainer = page.querySelector(
    "[data-tournament-rules]"
  );

  const locationContainer = page.querySelector(
    "[data-tournament-location]"
  );

  const dateTimeContainer = page.querySelector(
    "[data-tournament-date-time]"
  );

  const prizesContainer = page.querySelector(
    "[data-tournament-prizes]"
  );

  const registrationCostContainer = page.querySelector(
    "[data-tournament-registration-cost]"
  );

  const supportContactContainer = page.querySelector(
    "[data-tournament-support-contact]"
  );

  const registrationRequirementsContainer = page.querySelector(
    "[data-tournament-registration-requirements]"
  );

  const participationElement = page.querySelector(
    "[data-tournament-participation]"
  );

  const saveButton = page.querySelector(
    "[data-builder-save]"
  );

  const builderTitle = page.querySelector(
    "[data-builder-title]"
  );

  const cancelButton = page.querySelector(
    "[data-builder-cancel]"
  );

  const landingTemplateSelector = page.querySelector(
    "[data-tournament-landing-template]"
  );

  const landingTemplateDescription = page.querySelector(
    "[data-landing-template-description]"
  );


  /*
   * --------------------------------------------------
   * STATUS ELEMENTS
   * --------------------------------------------------
   */

  const statusElements = {
    game: page.querySelector(
      '[data-builder-status="game"]'
    ),

    mode: page.querySelector(
      '[data-builder-status="mode"]'
    ),

    format: page.querySelector(
      '[data-builder-status="format"]'
    ),

    matchSystem: page.querySelector(
      '[data-builder-status="match-system"]'
    ),

    capacity: page.querySelector(
      '[data-builder-status="capacity"]'
    ),

    rules: page.querySelector(
      '[data-builder-status="rules"]'
    ),

    location: page.querySelector(
      '[data-builder-status="location"]'
    ),

    dateTime: page.querySelector(
      '[data-builder-status="date-time"]'
    ),

    prizes: page.querySelector(
      '[data-builder-status="prizes"]'
    ),

    registrationCost: page.querySelector(
      '[data-builder-status="registration-cost"]'
    ),

    support: page.querySelector(
      '[data-builder-status="support"]'
    ),

    registrationRequirements: page.querySelector(
      '[data-builder-status="registration-requirements"]'
    )
  };


  /*
   * --------------------------------------------------
   * STATUS HELPER
   * --------------------------------------------------
   */

  function setStatus(element, completed) {
    if (!element) return;

    element.innerHTML = completed
      ? `<i class="fa-solid fa-check" aria-hidden="true"></i>`
      : "";

    element.classList.toggle(
      "tournament-builder__card-status--complete",
      completed
    );
  }


  /*
   * --------------------------------------------------
   * NEXT BUTTON
   * --------------------------------------------------
   */

  function updateNextButton() {
    const isComplete = Boolean(
      selectedGame &&
      selectedCompetitiveMode &&
      selectedFormat &&
      selectedMatchSystem &&
      selectedCapacity
    );

    saveButton.disabled = !isComplete;
  }


  /*
   * --------------------------------------------------
   * CAPACITY AVAILABILITY SELECTOR
   * --------------------------------------------------
   */

  const capacityAvailabilitySelector =
    CapacityAvailabilitySelector({
      onChange: (availability) => {

        selectedRegistrationAvailability =
          availability;

        const available =
          availability?.available ?? null;

        

        setStatus(
          statusElements.capacity,
          Boolean(selectedCapacity)
        );

        
      }
    });

  capacityAvailabilityContainer.appendChild(
    capacityAvailabilitySelector.element
  );


  /*
   * --------------------------------------------------
   * FORMAT SELECTOR
   * --------------------------------------------------
   */

  const formatSelector = FormatSelector({
    onChange: (format) => {

      selectedFormat = format;

      

      setStatus(
        statusElements.format,
        Boolean(selectedFormat)
      );

      updateNextButton();
    }
  });

  formatContainer.appendChild(
    formatSelector.element
  );


  /*
   * --------------------------------------------------
   * MATCH SYSTEM SELECTOR
   * --------------------------------------------------
   */

  const matchSystemSelector = MatchSystemSelector({
    onChange: (matchSystem) => {

      selectedMatchSystem =
        matchSystem;

      

      setStatus(
        statusElements.matchSystem,
        Boolean(selectedMatchSystem)
      );

      updateNextButton();
    }
  });

  matchSystemContainer.appendChild(
    matchSystemSelector.element
  );


  /*
   * --------------------------------------------------
   * CAPACITY SELECTOR
   * --------------------------------------------------
   */

  const capacitySelector = CapacitySelector({
    onChange: (capacity) => {

      selectedCapacity =
        capacity;

      capacityAvailabilitySelector.setCapacity(
        selectedCapacity
      );

      selectedRegistrationAvailability =
        capacityAvailabilitySelector.getValue();

      

      

      setStatus(
        statusElements.capacity,
        Boolean(selectedCapacity)
      );

      updateNextButton();
    }
  });

  capacityContainer.appendChild(
    capacitySelector.element
  );


  /*
   * --------------------------------------------------
   * RULES EDITOR
   * --------------------------------------------------
   */

  const rulesEditor = RulesEditor({
    onChange: (rules) => {

      selectedRules =
        rules;

      

      setStatus(
        statusElements.rules,
        selectedRules.length > 0
      );
    }
  });

  rulesContainer.appendChild(
    rulesEditor.element
  );


  /*
   * --------------------------------------------------
   * LOCATION SELECTOR
   * --------------------------------------------------
   */

  const locationSelector = LocationSelector({
    onChange: (location) => {

      selectedLocation =
        location;

      

      setStatus(
        statusElements.location,
        Boolean(selectedLocation?.type)
      );
    }
  });

  locationContainer.appendChild(
    locationSelector.element
  );


  /*
   * --------------------------------------------------
   * DATE TIME SELECTOR
   * --------------------------------------------------
   */

  const dateTimeSelector = DateTimeSelector({
    onChange: (dateTime) => {

      selectedDateTime =
        dateTime;

      

      setStatus(
        statusElements.dateTime,
        Boolean(
          selectedDateTime?.startDate &&
          selectedDateTime?.startTime
        )
      );
    }
  });

  dateTimeContainer.appendChild(
    dateTimeSelector.element
  );


  /*
   * --------------------------------------------------
   * PRIZE EDITOR
   * --------------------------------------------------
   */

  const prizeEditor = PrizeEditor({
    onChange: (prizes) => {

      selectedPrizes =
        prizes;

      

      setStatus(
        statusElements.prizes,
        selectedPrizes.length > 0
      );
    }
  });

  prizesContainer.appendChild(
    prizeEditor.element
  );


  /*
   * --------------------------------------------------
   * REGISTRATION COST SELECTOR
   * --------------------------------------------------
   */

  const registrationCostSelector =
    RegistrationCostSelector({

      participationType:
        selectedCompetitiveMode?.participationType || "",

      onChange: (registrationCost) => {

        selectedRegistrationCost =
          registrationCost;

      

        setStatus(
          statusElements.registrationCost,
          Boolean(
            selectedRegistrationCost?.type
          )
        );
      }

    });

  registrationCostContainer.appendChild(
    registrationCostSelector.element
  );


  /*
   * --------------------------------------------------
   * REGISTRATION REQUIREMENTS
   * --------------------------------------------------
   */

  const registrationRequirementsEditor =
    RegistrationRequirementsEditor({
      value: selectedRegistrationRequirements,
      onChange: (requirements) => {
        selectedRegistrationRequirements = requirements;

        setStatus(
          statusElements.registrationRequirements,
          Boolean(
            requirements?.enabled &&
            requirements?.requirements?.length
          )
        );
      }
    });

  registrationRequirementsContainer.appendChild(
    registrationRequirementsEditor.element
  );


  /*
   * --------------------------------------------------
   * CONTACT SUPPORT SELECTOR
   * --------------------------------------------------
   */

  const contactSupportSelector =
    ContactSupportSelector({

      onChange: (supportContact) => {

        selectedSupportContact =
          supportContact;

        

        setStatus(
          statusElements.support,
          Array.isArray(
            selectedSupportContact
          ) &&
          selectedSupportContact.length > 0
        );
      }

    });

  supportContactContainer.appendChild(
    contactSupportSelector.element
  );


  /*
   * --------------------------------------------------
   * COMPETITIVE MODE SELECTOR
   * --------------------------------------------------
   */

  const competitiveModeSelector =
    CompetitiveModeSelector({

      onChange: (mode) => {

        selectedCompetitiveMode =
          mode;

        selectedFormat = "";
        selectedMatchSystem = "";
        selectedCapacity = null;
        selectedRegistrationAvailability = null;

        const participationType =
          selectedCompetitiveMode?.participationType || "";

        const availableFormats =
          selectedCompetitiveMode?.formats || [];

        const availableMatchSystems =
          selectedCompetitiveMode?.matchSystem || [];

        const availableCapacityOptions =
          selectedCompetitiveMode?.capacityOptions || [];

        if (participationElement) {

          participationElement.textContent =
            participationType || "—";
        }

        formatSelector.setFormats(
          availableFormats
        );

        matchSystemSelector.setSystems(
          availableMatchSystems
        );

        capacitySelector.setParticipationType(
          participationType
        );

        capacitySelector.setOptions(
          availableCapacityOptions
        );

        capacityAvailabilitySelector.setCapacity(
          null
        );

        registrationCostSelector.setParticipationType(
          participationType
        );

        setStatus(
          statusElements.mode,
          Boolean(selectedCompetitiveMode)
        );

        setStatus(
          statusElements.format,
          false
        );

        setStatus(
          statusElements.matchSystem,
          false
        );

        setStatus(
          statusElements.capacity,
          false
        );

        

        updateNextButton();
      }

    });

  competitiveModeContainer.appendChild(
    competitiveModeSelector.element
  );


  /*
   * --------------------------------------------------
   * GAME SELECTOR
   * --------------------------------------------------
   */

  const gameSelector = GameSelector({

    onChange: async (gameId) => {

      selectedGame =
        gameId;

      selectedCompetitiveMode = null;
      selectedFormat = "";
      selectedMatchSystem = "";
      selectedCapacity = null;
      selectedRegistrationAvailability = null;
      selectedRules = [];
      selectedLocation = null;
      selectedDateTime = null;
      selectedPrizes = [];
      selectedRegistrationCost = null;
      selectedSupportContact = null;
      selectedRegistrationRequirements = null;
      registrationRequirementsEditor.setValue(null);

      if (participationElement) {
        participationElement.textContent =
          "—";
      }

      formatSelector.setFormats([]);

      matchSystemSelector.setSystems([]);

      capacitySelector.setOptions([]);

      capacityAvailabilitySelector.setCapacity(
        null
      );

      rulesEditor.setValue([]);

      locationSelector.setValue(
        null
      );

      dateTimeSelector.setValue(
        null
      );

      prizeEditor.setValue([]);

      registrationCostSelector.setValue(
        null
      );

      contactSupportSelector.setValue(
        null
      );


      /*
       * RESET DE ESTADOS VISUALES
       */

      setStatus(
        statusElements.game,
        Boolean(selectedGame)
      );

      setStatus(
        statusElements.mode,
        false
      );

      setStatus(
        statusElements.format,
        false
      );

      setStatus(
        statusElements.matchSystem,
        false
      );

      setStatus(
        statusElements.capacity,
        false
      );

      setStatus(
        statusElements.rules,
        false
      );

      setStatus(
        statusElements.location,
        false
      );

      setStatus(
        statusElements.dateTime,
        false
      );

      setStatus(
        statusElements.prizes,
        false
      );

      setStatus(
        statusElements.registrationCost,
        false
      );

      setStatus(
        statusElements.support,
        false
      );

      updateNextButton();

      

      await competitiveModeSelector.setGame(
        selectedGame
      );

    }

  });

  gameContainer.appendChild(
    gameSelector.element
  );


  /*
   * --------------------------------------------------
   * LANDING TEMPLATE
   * --------------------------------------------------
   */

  const landingTemplateDescriptions = {
    "template-1":
      "Experiencia cinematográfica y dominante del juego.",

    "template-2":
      "Diseño competitivo, limpio y centrado en la información.",

    "template-3":
      "Presentación enfocada en el juego, arte y experiencia visual."
  };

  function updateLandingTemplateDescription() {

    if (!landingTemplateDescription) {
      return;
    }

    landingTemplateDescription.textContent =
      landingTemplateDescriptions[selectedLandingTemplate] ||
      landingTemplateDescriptions["template-1"];
  }

  if (landingTemplateSelector) {

    landingTemplateSelector.addEventListener(
      "change",
      (event) => {

        selectedLandingTemplate =
          event.target.value || "template-1";

        updateLandingTemplateDescription();

      

      }
    );

    landingTemplateSelector.value =
      selectedLandingTemplate;

    updateLandingTemplateDescription();
  }


  /*
   * --------------------------------------------------
   * REVIEW
   * --------------------------------------------------
   */

  saveButton.addEventListener(
    "click",
    async () => {

      /*
       * El contexto debe estar completamente resuelto
       * antes de construir/guardar la configuración.
       */
      if (nexusContextInitialization) {
        await nexusContextInitialization;
      }

      if (!nexusContextReady || !tournamentId) {
        console.error(
          "ARKHAM — No se puede guardar: el Tournament ID actual todavía no está disponible."
        );
        return;
      }

      const tournamentConfiguration = {

        gameId:
          selectedGame,

        competitionOption:
          selectedCompetitiveMode.id,

        participationType:
          selectedCompetitiveMode.participationType || "",

        format:
          selectedFormat,

        matchSystem:
          selectedMatchSystem,

        capacity:
          selectedCapacity,

        registrationAvailability:
          selectedRegistrationAvailability,

        rules:
          selectedRules,

        location:
          selectedLocation,

        dateTime:
          selectedDateTime,

        prizes:
          selectedPrizes,

        registrationCost:
          selectedRegistrationCost,

        supportContact:
          selectedSupportContact,

        registrationRequirements:
          selectedRegistrationRequirements,

        landingTemplate:
          selectedLandingTemplate

      };

      // La configuración Pro se inicializa solamente si
      // la cuenta tiene entitlement efectivo en este momento.
      // Nunca se elimina al perder Pro.
      if (
        accountContext?.subscription &&
        hasEffectiveSubscriptionAccess(
          accountContext.subscription
        ) &&
        entityContext?.productId === "tournament"
      ) {
        tournamentConfiguration.pro =
          ensureTournamentProState({
            ...tournamentConfiguration,
            pro: undefined
          });
      }

      saveTournament(tournamentConfiguration);

    }
  );


  /*
   * --------------------------------------------------
   * SAVE TOURNAMENT / CANCEL
   * --------------------------------------------------
   */

  async function saveTournament(tournamentConfiguration) {

    /*
     * Protección adicional: incluso si esta función es
     * invocada desde otro flujo, no debe intentar escribir
     * hasta que el contexto haya terminado de resolverse.
     */
    if (nexusContextInitialization) {
      await nexusContextInitialization;
    }

    if (!nexusContextReady || !tournamentId) {
      console.error(
        "ARKHAM — No se encontró el Tournament ID actual."
      );
      return;
    }

    try {

      

      saveButton.disabled = true;

      if (isEditMode) {
        await updateMapEntity(
          "tournaments",
          tournamentId,
          "events",
          eventId,
          tournamentConfiguration
        );
      } else {
        eventId = await createMapEntity(
          "tournaments",
          tournamentId,
          "events",
          tournamentConfiguration
        );
      }

      // ========================================
      // CALENDAR SYNC
      // ========================================
      //
      // Calendar es un índice global de eventos.
      // El evento principal ya fue guardado arriba.
      //
      // Si Calendar falla, NO debemos considerar
      // fallido el guardado del evento.
      // ========================================

      try {

        await syncCalendarEvent({
          tournamentId,
          eventId,
          event: tournamentConfiguration
        });

      } catch (calendarError) {

        console.error(
          "ARKHAM — Error sincronizando Calendar:",
          calendarError
        );

      }


      // ========================================
      // SUCCESS
      // ========================================

      

      window.history.pushState(
        {},
        "",
        "/dashboard"
      );

      window.dispatchEvent(
        new PopStateEvent("popstate")
      );

    } catch (error) {

      console.error(
        "ARKHAM — Error guardando el torneo:",
        error
      );

    } finally {

      saveButton.disabled = false;

    }

  }


  cancelButton.addEventListener(
    "click",
    () => {

      window.history.pushState(
        {},
        "",
        "/dashboard"
      );

      window.dispatchEvent(
        new PopStateEvent("popstate")
      );

    }
  );


  /*
   * --------------------------------------------------
   * LOAD ARKHAM CONTEXT
   * --------------------------------------------------
   */

  async function loadNexusContext() {

    try {

      accountContext =
        await getCurrentAccountContext();

      entityContext =
        await getCurrentEntityContext();

      /*
       * Para CREAR una competencia (/new), el Entity Context
       * es la fuente de verdad del Tournament padre.
       *
       * El tournamentId de la URL se conserva únicamente para
       * el modo edición, donde la URL identifica explícitamente
       * el Tournament + Event que se está editando.
       */
      if (!isEditMode) {
        if (
          entityContext?.type === "tournament" &&
          entityContext?.id
        ) {
          tournamentId = entityContext.id;
        }
      }

      /*
       * El Builder queda listo únicamente cuando ya
       * conocemos el Tournament ID que será el documento
       * padre de events.
       */
      nexusContextReady = Boolean(tournamentId);

      

      if (!nexusContextReady) {
        console.error(
          "ARKHAM — El contexto actual no contiene un Tournament ID."
        );
      }

      let access = null;

      if (
        accountContext?.subscription &&
        hasEffectiveSubscriptionAccess(
          accountContext.subscription
        ) &&
        entityContext?.productId
      ) {

        access =
          createSubscriptionAccess(
            accountContext.subscription,
            entityContext.productId
          );

      }

      if (sidebar) {
        sidebar.setContext({

          type:
            entityContext?.type || null,

          name:
            "Nuevo torneo",

          accessContext:
            access

        });
      }


      
      

    } catch (error) {

      nexusContextReady = false;

      console.error(
        "ARKHAM — Error cargando contexto del Builder:",
        error
      );

    }

  }

  async function loadExistingEvent() {
    if (!isEditMode) {
      return;
    }

    try {
      const tournament =
        await getEntity(
          "tournaments",
          tournamentId
        );

      const event =
        tournament?.events?.[eventId];

      if (!event) {
        throw new Error(
          "No se encontró el evento solicitado."
        );
      }

      selectedGame = event.gameId || "";
      selectedFormat = event.format || "";
      selectedMatchSystem = event.matchSystem || "";
      selectedCapacity = event.capacity ?? null;
      selectedRegistrationAvailability =
        event.registrationAvailability ?? null;
      selectedRules = Array.isArray(event.rules)
        ? event.rules
        : [];
      selectedLocation = event.location || null;
      selectedDateTime = event.dateTime || null;
      selectedPrizes = Array.isArray(event.prizes)
        ? event.prizes
        : [];
      selectedRegistrationCost =
        event.registrationCost || null;
      selectedSupportContact =
        event.supportContact || null;

      selectedRegistrationRequirements =
        event.registrationRequirements || null;

      selectedLandingTemplate =
        event.landingTemplate || "template-1";

      if (landingTemplateSelector) {
        landingTemplateSelector.value =
          selectedLandingTemplate;

        updateLandingTemplateDescription();
      }

      gameSelector.setValue(selectedGame);

      await competitiveModeSelector.setGame(
        selectedGame
      );

      competitiveModeSelector.setValue(
        event.competitionOption || ""
      );

      selectedCompetitiveMode =
        competitiveModeSelector.getSelectedMode();

      const participationType =
        selectedCompetitiveMode?.participationType ||
        event.participationType ||
        "";

      if (participationElement) {
        participationElement.textContent =
          participationType || "—";
      }

      formatSelector.setFormats(
        selectedCompetitiveMode?.formats || []
      );
      matchSystemSelector.setSystems(
        selectedCompetitiveMode?.matchSystem || []
      );
      capacitySelector.setParticipationType(
        participationType
      );
      capacitySelector.setOptions(
        selectedCompetitiveMode?.capacityOptions || []
      );
      registrationCostSelector.setParticipationType(
        participationType
      );

      formatSelector.setValue(selectedFormat);
      matchSystemSelector.setValue(selectedMatchSystem);
      capacitySelector.setValue(selectedCapacity);
      capacityAvailabilitySelector.setCapacity(
        selectedCapacity
      );
      capacityAvailabilitySelector.setValue(
        selectedRegistrationAvailability
      );
      rulesEditor.setValue(selectedRules);
      locationSelector.setValue(selectedLocation);
      dateTimeSelector.setValue(selectedDateTime);
      prizeEditor.setValue(selectedPrizes);
      registrationCostSelector.setValue(
        selectedRegistrationCost
      );
      contactSupportSelector.setValue(
        selectedSupportContact
      );
      registrationRequirementsEditor.setValue(
        selectedRegistrationRequirements
      );

      setStatus(statusElements.game, Boolean(selectedGame));
      setStatus(
        statusElements.mode,
        Boolean(selectedCompetitiveMode)
      );
      setStatus(statusElements.format, Boolean(selectedFormat));
      setStatus(
        statusElements.matchSystem,
        Boolean(selectedMatchSystem)
      );
      setStatus(statusElements.capacity, Boolean(selectedCapacity));
      setStatus(statusElements.rules, selectedRules.length > 0);
      setStatus(
        statusElements.location,
        Boolean(selectedLocation?.type)
      );
      setStatus(
        statusElements.dateTime,
        Boolean(
          selectedDateTime?.startDate &&
          selectedDateTime?.startTime
        )
      );
      setStatus(statusElements.prizes, selectedPrizes.length > 0);
      setStatus(
        statusElements.registrationCost,
        Boolean(selectedRegistrationCost?.type)
      );
      setStatus(
        statusElements.support,
        Array.isArray(selectedSupportContact?.channels) &&
        selectedSupportContact.channels.length > 0
      );
      setStatus(
        statusElements.registrationRequirements,
        Boolean(
          selectedRegistrationRequirements?.enabled &&
          selectedRegistrationRequirements?.requirements?.length
        )
      );

      if (builderTitle) {
        builderTitle.textContent = "EDITAR TORNEO";
      }

      saveButton.textContent = "GUARDAR CAMBIOS";
      updateNextButton();

      
    } catch (error) {
      console.error(
        "ARKHAM — Error cargando evento para edición:",
        error
      );
    }
  }

  nexusContextInitialization =
    loadNexusContext();

  nexusContextInitialization.then(
    loadExistingEvent
  );


  /*
   * --------------------------------------------------
   * PAGE ANIMATION
   * --------------------------------------------------
   */

  requestAnimationFrame(
    () => {

      page.classList.add(
        "tournament-builder-page--visible"
      );

    }
  );


  return page;
}