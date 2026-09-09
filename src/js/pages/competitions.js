// ========================================
// NEXUS — Competitions Page
// ========================================

import { CompetitionCard } from "../components/competitionCard.js";


// ========================================
// MOCK DATA
// ========================================

const competitions = [
  {
    id: "master",
    index: "01",
    name: "MASTER LEGENDS",
    game: "Smash Bros",
    logo: "public/logo-1.png",
    logoText: "M",
    status: "active",
    statusLabel: "ACTIVA",
    startDate: "12 SEP 2026",
    dates: "6 FECHAS",
    location: "GUATEMALA"
  },

  {
    id: "chapin",
    index: "02",
    name: "Chapin Leagues",
    game: "FREE FIRE",
    logo: "public/logo-2.png",
    logoText: "C",
    status: "upcoming",
    statusLabel: "PRÓXIMA",
    startDate: "OCT 2026",
    dates: "1 FECHA",
    location: "GUATEMALA"
  },

  {
    id: "lgd",
    index: "03",
    name: "LGD2",
    game: "DOTA2",
    logo: "public/logo-3.png",
    logoText: "O",
    status: "upcoming",
    statusLabel: "PRÓXIMA",
    startDate: "NOV 2026",
    dates: "1 FECHA",
    location: "GUATEMALA"
  },

  {
    id: "dominion",
    index: "04",
    name: "Dominion",
    game: "Call Of Duty",
    logo: "public/logo-4.png",
    logoText: "S",
    status: "finished",
    statusLabel: "FINALIZADA",
    startDate: "JUN 2026",
    dates: "4 FECHAS",
    location: "GUATEMALA"
  }
];


// ========================================
// PAGE
// ========================================

export function Competitions() {

  const page = document.createElement("main");

  page.className = "competitions-page";
  page.id = "competitions-page";


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
          class="competitions-filter competitions-filter--active"
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
           EMPTY STATE
           ======================================== -->

      <div class="competitions-page__empty">

        <span>
          NO HAY COMPETENCIAS DISPONIBLES
        </span>

      </div>

    </div>
  `;


  const grid = page.querySelector(
    ".competitions-page__grid"
  );

  const emptyState = page.querySelector(
    ".competitions-page__empty"
  );

  const filterButtons = page.querySelectorAll(
    ".competitions-filter"
  );


  // ========================================
  // RENDER
  // ========================================

  function renderCompetitions(filter = "all") {

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

        const card = CompetitionCard(
          competition
        );

        grid.appendChild(card);

      }
    );


    emptyState.hidden =
      filteredCompetitions.length !== 0;
  }


  // ========================================
  // FILTERS
  // ========================================

  filterButtons.forEach((button) => {

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


        renderCompetitions(filter);

      }
    );

  });


  // ========================================
  // INITIAL RENDER
  // ========================================

  renderCompetitions();


  // ========================================
  // SCROLL REVEAL
  // ========================================

  const observer = new IntersectionObserver(
    (entries) => {

      entries.forEach((entry) => {

        if (entry.isIntersecting) {

          page.classList.add(
            "competitions-page--visible"
          );

          observer.unobserve(page);

        }

      });

    },
    {
      threshold: 0.1
    }
  );


  observer.observe(page);


  return page;
}