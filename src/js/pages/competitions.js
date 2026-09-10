// ========================================
// NEXUS — Competitions Page
// ========================================

import { CompetitionCard } from "../components/competitionCard.js";

import {
  getEntities
} from "../services/firestore.js";


// ========================================
// NORMALIZE COMPETITION
// ========================================

function normalizeCompetition(
  competition,
  type,
  index
) {

  return {

    id:
      competition.id,

    index:
      String(index).padStart(2, "0"),

    type,

    name:
      competition.name || "SIN NOMBRE",

    game:
      competition.game || "—",

    logo:
      competition.logo?.url || null,

    logoText:
      competition.shortName ||
      competition.name?.charAt(0) ||
      "NX",

    status:
      competition.status || "registered",

    statusLabel:
      competition.statusLabel ||
      "REGISTRADA",

    startDate:
      competition.startDate || "—",

    dates:
      competition.dates || "—",

    location:
      competition.location || "—"

  };

}


// ========================================
// PAGE
// ========================================

export function Competitions() {

  const page =
    document.createElement("main");

  page.className =
    "competitions-page";

  page.id =
    "competitions-page";


  page.innerHTML = `
    <div class="competitions-page__container">

      <!-- ========================================
           HEADER
           ======================================== -->

      <header class="competitions-page__header">

        <div class="competitions-page__eyebrow">

          <span>01</span>

          <span>
            NEXUS COMPETITIONS
          </span>

        </div>


        <div class="competitions-page__heading">

          <h1>
            TODAS LAS
            <span>COMPETENCIAS.</span>
          </h1>

          <p>
            Explora las competencias que forman parte
            del ecosistema competitivo de NEXUS.
          </p>

        </div>

      </header>


      <!-- ========================================
           FILTERS
           ======================================== -->

      <nav
        class="competitions-page__filters"
        aria-label="Filtrar competencias"
      >

        <button
          class="
            competitions-filter
            competitions-filter--active
          "
          data-filter="all"
          type="button"
        >
          TODAS
        </button>

        <button
          class="competitions-filter"
          data-filter="active"
          type="button"
        >
          ACTIVAS
        </button>

        <button
          class="competitions-filter"
          data-filter="upcoming"
          type="button"
        >
          PRÓXIMAS
        </button>

        <button
          class="competitions-filter"
          data-filter="finished"
          type="button"
        >
          FINALIZADAS
        </button>

      </nav>


      <!-- ========================================
           COMPETITIONS GRID
           ======================================== -->

      <section
        class="competitions-page__grid"
        aria-label="Lista de competencias"
      ></section>


      <!-- ========================================
           LOADING
           ======================================== -->

      <div class="competitions-page__loading">

        <span>
          CARGANDO COMPETENCIAS...
        </span>

      </div>


      <!-- ========================================
           EMPTY STATE
           ======================================== -->

      <div class="competitions-page__empty" hidden>

        <span>
          NO HAY COMPETENCIAS DISPONIBLES
        </span>

      </div>

    </div>
  `;


  const grid =
    page.querySelector(
      ".competitions-page__grid"
    );


  const loadingState =
    page.querySelector(
      ".competitions-page__loading"
    );


  const emptyState =
    page.querySelector(
      ".competitions-page__empty"
    );


  const filterButtons =
    page.querySelectorAll(
      ".competitions-filter"
    );


  let competitions = [];


  // ========================================
  // RENDER
  // ========================================

  function renderCompetitions(
    filter = "all"
  ) {

    grid.innerHTML = "";


    const filteredCompetitions =
      filter === "all"
        ? competitions
        : competitions.filter(
            (competition) =>
              competition.status === filter
          );


    filteredCompetitions.forEach(
      (competition) => {

        const card =
          CompetitionCard(
            competition
          );

        grid.appendChild(card);

      }
    );


    emptyState.hidden =
      filteredCompetitions.length !== 0;

  }


  // ========================================
  // LOAD COMPETITIONS
  // ========================================

  async function loadCompetitions() {

    try {

      console.log(
        "NEXUS — Cargando competencias..."
      );


      const [
        leagues,
        tournaments
      ] = await Promise.all([

        getEntities(
          "leagues"
        ),

        getEntities(
          "tournaments"
        )

      ]);


      console.log(
        "NEXUS — Ligas:",
        leagues
      );


      console.log(
        "NEXUS — Torneos:",
        tournaments
      );


      const normalizedLeagues =
        leagues.map(
          (league, index) =>
            normalizeCompetition(
              league,
              "league",
              index + 1
            )
        );


      const normalizedTournaments =
        tournaments.map(
          (tournament, index) =>
            normalizeCompetition(
              tournament,
              "tournament",
              normalizedLeagues.length +
                index +
                1
            )
        );


      competitions = [
        ...normalizedLeagues,
        ...normalizedTournaments
      ];


      loadingState.hidden =
        true;


      renderCompetitions();


      console.log(
        "NEXUS — Competencias cargadas:",
        competitions
      );

    } catch (error) {

      console.error(
        "NEXUS — Error cargando competencias:",
        error
      );


      loadingState.hidden =
        true;


      emptyState.hidden =
        false;

    }

  }


  // ========================================
  // FILTERS
  // ========================================

  filterButtons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const filter =
            button.dataset.filter;


          filterButtons.forEach(
            (filterButton) => {

              filterButton.classList.remove(
                "competitions-filter--active"
              );

            }
          );


          button.classList.add(
            "competitions-filter--active"
          );


          renderCompetitions(
            filter
          );

        }
      );

    }
  );


  // ========================================
  // INITIAL LOAD
  // ========================================

  loadCompetitions();


  // ========================================
  // SCROLL REVEAL
  // ========================================

  const observer =
    new IntersectionObserver(
      (entries) => {

        entries.forEach(
          (entry) => {

            if (
              entry.isIntersecting
            ) {

              page.classList.add(
                "competitions-page--visible"
              );


              observer.unobserve(
                page
              );

            }

          }
        );

      },
      {
        threshold: 0.1
      }
    );


  observer.observe(
    page
  );


  return page;

}