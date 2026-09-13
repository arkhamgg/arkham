// ========================================
// NEXUS — Competition Detail Page
// ========================================

import {
  getEntity,
  getMapEntities
} from "../services/firestore.js";


// ========================================
// HELPERS
// ========================================

function formatValue(value, fallback = "—") {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return fallback;

  }


  if (typeof value === "object") {

    return fallback;

  }


  return String(value);

}


// ========================================
// TYPE
// ========================================

function formatType(type) {

  if (type === "tournament") {

    return "TOURNAMENT";

  }


  if (type === "league") {

    return "LEAGUE";

  }


  return "COMPETITION";

}


// ========================================
// EVENT NAME
// ========================================

function formatEventName(event) {

  if (event.name) {

    return event.name;

  }


  if (event.gameName) {

    return event.gameName;

  }


  if (event.gameId) {

    return event.gameId
      .replaceAll("-", " ")
      .toUpperCase();

  }


  return "EVENT COMPETITIVO";

}


// ========================================
// GAME
// ========================================

function formatGameName(gameId) {

  if (!gameId) {

    return "—";

  }


  return String(gameId)
    .replaceAll("-", " ")
    .toUpperCase();

}


// ========================================
// COMPETITION OPTION
// ========================================

function formatCompetitionOption(value) {

  if (!value) {

    return "—";

  }


  const normalized =
    String(value)
      .trim()
      .toLowerCase();


  const labels = {

    "ranked": "RANKED",
    "casual": "CASUAL",
    "competitive": "COMPETITIVO",
    "tournament": "TORNEO",
    "league": "LIGA"

  };


  return (
    labels[normalized] ||
    String(value)
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .toUpperCase()
  );

}


// ========================================
// PARTICIPATION TYPE
// ========================================

function formatParticipationType(value) {

  if (!value) {

    return "—";

  }


  const normalized =
    String(value)
      .trim()
      .toLowerCase();


  const labels = {

    "solo": "INDIVIDUAL",
    "single": "INDIVIDUAL",
    "player": "INDIVIDUAL",
    "players": "INDIVIDUAL",

    "duo": "DÚO",
    "duos": "DÚOS",

    "trio": "TRÍOS",
    "trios": "TRÍOS",

    "squad": "SQUAD",
    "squads": "SQUADS",

    "team": "EQUIPOS",
    "teams": "EQUIPOS"

  };


  return (
    labels[normalized] ||
    String(value)
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .toUpperCase()
  );

}


// ========================================
// FORMAT
// ========================================

function formatCompetitionFormat(value) {

  if (!value) {

    return "—";

  }


  const normalized =
    String(value)
      .trim()
      .toLowerCase();


  const labels = {

    "single_elimination": "ELIMINACIÓN DIRECTA",
    "double_elimination": "DOBLE ELIMINACIÓN",
    "round_robin": "TODOS CONTRA TODOS",
    "swiss": "SISTEMA SUIZO",
    "groups": "FASE DE GRUPOS",
    "group_stage": "FASE DE GRUPOS",
    "bracket": "BRACKET",
    "league": "LIGA"

  };


  return (
    labels[normalized] ||
    String(value)
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .toUpperCase()
  );

}


// ========================================
// DATE / TIME
// ========================================

function formatDateTime(dateTime) {

  if (!dateTime) {

    return "—";

  }


  if (
    typeof dateTime === "string" ||
    typeof dateTime === "number"
  ) {

    const date =
      new Date(dateTime);


    if (!Number.isNaN(date.getTime())) {

      return date.toLocaleString(
        "es-GT",
        {
          dateStyle: "medium",
          timeStyle: "short"
        }
      );

    }

  }


  return "—";

}


// ========================================
// EVENT CARD
// ========================================

function CompetitionEventCard(
  event,
  competitionId,
  competitionType
) {

  const card =
    document.createElement("article");


  card.className =
    "competition-detail__event";


  const game =
    formatGameName(
      event.gameId
    );


  card.innerHTML = `

    <div class="competition-detail__event-top">

      <span class="competition-detail__event-game">
        ${game}
      </span>

      <span class="competition-detail__event-status">
        EVENT
      </span>

    </div>


    <div class="competition-detail__event-content">

      <h3>
        ${formatEventName(event)}
      </h3>


      <div class="competition-detail__event-data">

        <div>
          <span>MODALIDAD</span>

          <strong>
            ${formatCompetitionOption(
              event.competitionOption
            )}
          </strong>
        </div>


        <div>
          <span>PARTICIPACIÓN</span>

          <strong>
            ${formatParticipationType(
              event.participationType
            )}
          </strong>
        </div>


        <div>
          <span>FORMATO</span>

          <strong>
            ${formatCompetitionFormat(
              event.format
            )}
          </strong>
        </div>


        <div>
          <span>CAPACIDAD</span>

          <strong>
            ${formatValue(
              event.capacity
            )}
          </strong>
        </div>


        <div>
          <span>FECHA</span>

          <strong>
            ${formatDateTime(
              event.dateTime
            )}
          </strong>
        </div>

      </div>

    </div>


    <div class="competition-detail__event-action">

      <span>
        VER EVENTO
      </span>

      <i
        class="fa-solid fa-arrow-right"
        aria-hidden="true"
      ></i>

    </div>

  `;


  card.addEventListener(
    "click",
    () => {

      /*
       * Actualmente el Competition Landing
       * recibe tournamentId + eventId.
       *
       * No enviamos leagueId porque la estructura
       * pública de League todavía no está definida.
       */

      if (
        competitionType !== "tournament"
      ) {

        return;

      }


      window.history.pushState(
        {},
        "",
        `/competitions/event?tournamentId=${encodeURIComponent(
          competitionId
        )}&eventId=${encodeURIComponent(
          event.id
        )}`
      );


      window.dispatchEvent(
        new PopStateEvent("popstate")
      );

    }
  );


  return card;

}


// ========================================
// PAGE
// ========================================

export function CompetitionDetail() {

  const page =
    document.createElement("main");


  page.className =
    "competition-detail-page";


  page.innerHTML = `

    <div class="competition-detail-page__container">

      <!-- ========================================
           LOADING
      ======================================== -->

      <div class="competition-detail-page__loading">

        <span>
          CARGANDO COMPETENCIA...
        </span>

      </div>


      <!-- ========================================
           CONTENT
      ======================================== -->

      <div
        class="competition-detail-page__content"
        hidden
      >

        <header class="competition-detail__header">

          <div class="competition-detail__identity">

            <div class="competition-detail__logo">

              <img
                class="competition-detail__logo-image"
                alt=""
                hidden
              >

              <span
                class="competition-detail__logo-text"
              >
                NX
              </span>

            </div>


            <div class="competition-detail__heading">

              <span
                class="competition-detail__type"
              >
                COMPETITION
              </span>

              <h1
                class="competition-detail__name"
              >
                —
              </h1>

              <span
                class="competition-detail__short-name"
              >
                —
              </span>

            </div>

          </div>


          <div
            class="competition-detail__status"
          >
            REGISTRADA
          </div>

        </header>


        <section class="competition-detail__information">

          <div class="competition-detail__description">

            <span>
              DESCRIPCIÓN
            </span>

            <p
              class="competition-detail__description-text"
            >
              —
            </p>

          </div>


          <div class="competition-detail__meta">

            <div
              class="competition-detail__meta-item"
              data-foundation
              hidden
            >

              <span>
                FUNDACIÓN
              </span>

              <strong
                data-foundation-value
              >
                —
              </strong>

            </div>

          </div>

        </section>


        <section class="competition-detail__structure">

          <div class="competition-detail__section-heading">

            <span>
              02
            </span>

            <div>

              <span>
                EVENTS
              </span>

              <h2>
                EVENTOS.
              </h2>

            </div>

          </div>


          <div
            class="competition-detail__events"
          ></div>


          <div
            class="competition-detail__events-empty"
            hidden
          >

            <span>
              NO HAY EVENTOS DISPONIBLES
            </span>

            <p>
              Esta competencia todavía no tiene
              eventos disponibles.
            </p>

          </div>

        </section>


        <footer class="competition-detail__footer">

          <button
            type="button"
            class="competition-detail__back"
          >

            <i
              class="fa-solid fa-arrow-left"
              aria-hidden="true"
            ></i>

            <span>
              VOLVER A COMPETENCIAS
            </span>

          </button>

        </footer>

      </div>


      <!-- ========================================
           ERROR
      ======================================== -->

      <div
        class="competition-detail-page__error"
        hidden
      >

        <span>
          COMPETENCIA NO ENCONTRADA
        </span>

        <p>
          No pudimos encontrar la competencia solicitada.
        </p>

        <button
          type="button"
          class="competition-detail__back-error"
        >
          VOLVER A COMPETENCIAS
        </button>

      </div>

    </div>

  `;


  // ========================================
  // ELEMENT REFERENCES
  // ========================================

  const loading =
    page.querySelector(
      ".competition-detail-page__loading"
    );


  const content =
    page.querySelector(
      ".competition-detail-page__content"
    );


  const errorState =
    page.querySelector(
      ".competition-detail-page__error"
    );


  const nameElement =
    page.querySelector(
      ".competition-detail__name"
    );


  const shortNameElement =
    page.querySelector(
      ".competition-detail__short-name"
    );


  const typeElement =
    page.querySelector(
      ".competition-detail__type"
    );


  const statusElement =
    page.querySelector(
      ".competition-detail__status"
    );


  const descriptionElement =
    page.querySelector(
      ".competition-detail__description-text"
    );


  const logoImage =
    page.querySelector(
      ".competition-detail__logo-image"
    );


  const logoText =
    page.querySelector(
      ".competition-detail__logo-text"
    );


  const foundationContainer =
    page.querySelector(
      "[data-foundation]"
    );


  const foundationValue =
    page.querySelector(
      "[data-foundation-value]"
    );


  const eventsContainer =
    page.querySelector(
      ".competition-detail__events"
    );


  const eventsEmpty =
    page.querySelector(
      ".competition-detail__events-empty"
    );


  const backButtons =
    page.querySelectorAll(
      ".competition-detail__back, .competition-detail__back-error"
    );


  // ========================================
  // NAVIGATION BACK
  // ========================================

  backButtons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          window.history.pushState(
            {},
            "",
            "/competitions"
          );


          window.dispatchEvent(
            new PopStateEvent("popstate")
          );

        }
      );

    }
  );


  // ========================================
  // LOAD
  // ========================================

  async function loadCompetition() {

    let competitionId = null;

    try {

      const segments =
        window.location.pathname
          .split("/")
          .filter(Boolean);


      competitionId =
        segments[1];


      if (!competitionId) {

        throw new Error(
          "Competition ID missing"
        );

      }


      console.log(
        "NEXUS — Cargando competencia:",
        competitionId
      );


      /*
       * CompetitionCard actualmente utiliza:
       *
       * /competitions/{id}
       *
       * sin enviar el type.
       *
       * Por eso resolvemos el tipo consultando
       * ambas colecciones en paralelo.
       */

      const [
        tournament,
        league
      ] = await Promise.all([

        getEntity(
          "tournaments",
          competitionId
        ),

        getEntity(
          "leagues",
          competitionId
        )

      ]);


      let competition = null;
      let competitionType = null;


      if (tournament) {

        competition =
          tournament;

        competitionType =
          "tournament";

      } else if (league) {

        competition =
          league;

        competitionType =
          "league";

      }


      if (!competition) {

        throw new Error(
          "Competition not found"
        );

      }


      // ========================================
      // IDENTITY
      // ========================================

      nameElement.textContent =
        formatValue(
          competition.name,
          "SIN NOMBRE"
        );


      shortNameElement.textContent =
        formatValue(
          competition.shortName
        );


      /*
       * Si name y shortName son iguales,
       * no mostramos el mismo texto dos veces.
       */

      if (
        competition.name &&
        competition.shortName &&
        competition.name.trim().toLowerCase() ===
          competition.shortName.trim().toLowerCase()
      ) {

        shortNameElement.hidden =
          true;

      } else {

        shortNameElement.hidden =
          false;

      }


      typeElement.textContent =
        formatType(
          competitionType
        );


      statusElement.textContent =
        formatValue(
          competition.statusLabel ||
          competition.status,
          "REGISTRADA"
        ).toUpperCase();


      descriptionElement.textContent =
        formatValue(
          competition.description
        );


      // ========================================
      // LOGO
      // ========================================

      const logoUrl =
        competition.logo?.url;


      if (logoUrl) {

        logoImage.src =
          logoUrl;

        logoImage.alt =
          competition.name ||
          "Competition logo";

        logoImage.hidden =
          false;

        logoText.hidden =
          true;

      } else {

        logoImage.hidden =
          true;

        logoText.hidden =
          false;

        logoText.textContent =
          competition.shortName ||
          competition.name?.charAt(0) ||
          "NX";

      }


      // ========================================
      // LEAGUE-SPECIFIC INFORMATION
      // ========================================

      if (
        competitionType === "league" &&
        competition.foundationYear
      ) {

        foundationValue.textContent =
          competition.foundationYear;

        foundationContainer.hidden =
          false;

      }


      // ========================================
      // EVENTS
      // ========================================

      eventsContainer.innerHTML =
        "";

      eventsEmpty.hidden =
        true;


      let events = [];


      if (
        competitionType === "tournament"
      ) {

        events =
          await getMapEntities(
            "tournaments",
            competitionId,
            "events"
          );

      }


      if (events.length === 0) {

        eventsEmpty.hidden =
          false;

      } else {

        eventsEmpty.hidden =
          true;


        events.forEach(
          (event) => {

            eventsContainer.appendChild(
              CompetitionEventCard(
                event,
                competitionId,
                competitionType
              )
            );

          }
        );

      }


      // ========================================
      // SHOW CONTENT
      // ========================================

      loading.hidden =
        true;

      content.hidden =
        false;


      requestAnimationFrame(
        () => {

          page.classList.add(
            "competition-detail-page--visible"
          );

        }
      );


    } catch (loadError) {

      console.error(
        "NEXUS — Error cargando competencia:",
        {
          competitionId,
          error: loadError
        }
      );


      loading.hidden =
        true;

      content.hidden =
        true;

      errorState.hidden =
        false;

    }

  }


  loadCompetition();


  return page;

}