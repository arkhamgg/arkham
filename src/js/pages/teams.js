// ========================================
// ARKHAM — Teams Page
// ========================================

import { TeamCard } from "../components/teamCard.js";
import { getEntities } from "../services/firestore.js";


// ========================================
// PAGE
// ========================================

export function Teams() {

  const page =
    document.createElement("main");

  page.className =
    "teams-page";

  page.id =
    "teams-page";


  // ========================================
  // PAGE STRUCTURE
  // ========================================

  page.innerHTML = `

    <div class="teams-page__container">


      <!-- ========================================
           HEADER
           ======================================== -->

      <header class="teams-page__header">

        <div class="teams-page__eyebrow">

          <span>
            01
          </span>

          <span>
            ARKHAM TEAMS
          </span>

        </div>


        <div class="teams-page__heading">

          <h1>

            LOS EQUIPOS

            <span>
              QUE HAY QUE VENCER.
            </span>

          </h1>


          <p>

            Conoce a los equipos que forman
            parte del ecosistema competitivo
            de ARKHAM.

          </p>

        </div>

      </header>


      <!-- ========================================
           HALL OF FAME
           ======================================== -->

      <section
        class="teams-page__hall"
        aria-labelledby="teams-hall-title"
      >

        <header class="teams-page__section-header">

          <div>

            <span class="teams-page__section-label">
              02
            </span>

            <h2 id="teams-hall-title">
              SALÓN DE LA FAMA
            </h2>

          </div>


          <p>
            Los equipos que representan
            el nivel competitivo de ARKHAM.
          </p>

        </header>


        <div class="teams-page__hall-grid"></div>

      </section>


      <!-- ========================================
           ALL TEAMS
           ======================================== -->

      <section
        class="teams-page__all"
        aria-labelledby="teams-all-title"
      >

        <header class="teams-page__section-header">

          <div>

            <span class="teams-page__section-label">
              03
            </span>

            <h2 id="teams-all-title">
              TODOS LOS EQUIPOS
            </h2>

          </div>


          <p>
            Todos los equipos registrados
            dentro de ARKHAM.
          </p>

        </header>


        <!-- ========================================
             SEARCH
             ======================================== -->

        <div class="teams-page__search">

          <div class="teams-page__search-icon">

            <i
              class="fa-solid fa-magnifying-glass"
              aria-hidden="true"
            ></i>

          </div>


          <input
            type="search"
            class="teams-page__search-input"
            placeholder="BUSCAR EQUIPO O TAG..."
            aria-label="Buscar equipo o tag"
            autocomplete="off"
          />

        </div>


        <!-- ========================================
             TEAMS GRID
             ======================================== -->

        <div class="teams-page__grid"></div>


        <!-- ========================================
             NO RESULTS
             ======================================== -->

        <div
          class="teams-page__empty"
          hidden
        >

          <span class="teams-page__empty-code">
            00
          </span>

          <h3>
            NO SE ENCONTRARON EQUIPOS
          </h3>

          <p>
            Prueba con otro nombre o TAG.
          </p>

        </div>

      </section>


    </div>

  `;


  // ========================================
  // ELEMENTS
  // ========================================

  const hallGrid =
    page.querySelector(
      ".teams-page__hall-grid"
    );


  const teamsGrid =
    page.querySelector(
      ".teams-page__grid"
    );


  const searchInput =
    page.querySelector(
      ".teams-page__search-input"
    );


  const emptyState =
    page.querySelector(
      ".teams-page__empty"
    );


  // ========================================
  // LOAD TEAMS
  // ========================================

  async function loadTeams() {

    try {

      


      const teams =
        await getEntities(
          "teams"
        );


      


      // ========================================
      // HALL OF FAME
      // ========================================

      const featuredTeams =
        teams
          .filter(
            (team) =>
              team.hallOfFame === true
          )
          .slice(0, 5);


      featuredTeams.forEach(
        (team, index) => {

          const card =
            TeamCard(
              team,
              {
                featured: true,
                rank: index + 1
              }
            );


          hallGrid.appendChild(
            card
          );

        }
      );


      // ========================================
      // ALL TEAMS
      // ========================================

      const remainingTeams =
        teams.filter(
          (team) =>
            team.hallOfFame !== true
        );


      // ========================================
      // RENDER TEAMS
      // ========================================

      function renderTeams(
        teamList
      ) {

        teamsGrid.innerHTML = "";


        if (
          teamList.length === 0
        ) {

          emptyState.hidden =
            false;

          return;

        }


        emptyState.hidden =
          true;


        teamList.forEach(
          (team) => {

            const card =
              TeamCard(
                team
              );


            teamsGrid.appendChild(
              card
            );

          }
        );

      }


      // ========================================
      // INITIAL RENDER
      // ========================================

      renderTeams(
        remainingTeams
      );


      // ========================================
      // SEARCH
      // ========================================

      searchInput.addEventListener(
        "input",
        (event) => {

          const query =
            event.target.value
              .trim()
              .toLowerCase();


          if (!query) {

            renderTeams(
              remainingTeams
            );

            return;

          }


          const filteredTeams =
            remainingTeams.filter(
              (team) => {

                const name =
                  team.name
                    ?.toLowerCase() || "";


                const shortName =
                  team.shortName
                    ?.toLowerCase() || "";


                return (
                  name.includes(query) ||
                  shortName.includes(query)
                );

              }
            );


          renderTeams(
            filteredTeams
          );

        }
      );


    } catch (error) {

      console.error(
        "ARKHAM — Error cargando equipos:",
        error
      );

    }

  }


  // ========================================
  // LOAD
  // ========================================

  loadTeams();


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
                "teams-page--visible"
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