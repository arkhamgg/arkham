// ========================================
// NEXUS — Dashboard
// ========================================

import {
  getCurrentSession
} from "../services/session.js";

import {
  logout
} from "../services/auth.js";

import {
  getCurrentAccountContext
} from "../services/account.js";

import {
  getCurrentEntityContext
} from "../services/entityContext.js";

import {
  createSubscriptionAccess
} from "../services/planService.js";

import {
  DashboardSidebar
} from "../components/dashboardSidebar.js";

import {
  getEntity,
  deleteMapEntity
} from "../services/firestore.js";


// ========================================
// PAGE
// ========================================

export function Dashboard() {

  const page =
    document.createElement("main");

  page.className =
    "dashboard-page";


  // ========================================
  // SESSION
  // ========================================

  const session =
    getCurrentSession();


  // ========================================
  // NO SESSION
  // ========================================

  if (!session) {

    page.innerHTML = `
      <div class="dashboard-page__empty">

        <span
          class="dashboard-page__eyebrow"
        >
          NEXUS
        </span>

        <h1>
          SIN SESIÓN
        </h1>

        <p>
          No hay una sesión activa
          en NEXUS.
        </p>

      </div>
    `;

    return page;
  }


  // ========================================
  // INITIAL STATE
  // ========================================

  page.innerHTML = `
    <div class="dashboard-layout">

      <section class="dashboard-main">

        <!-- ================================= -->
        <!-- HEADER -->
        <!-- ================================= -->

        <header class="dashboard-header">

          <div>

            <span
              class="dashboard-header__eyebrow"
            >
              MI NEXUS
            </span>

            <h1>
              Overview
            </h1>

            <p
              data-dashboard-description
            >
              Cargando tu espacio NEXUS...
            </p>

          </div>


          <div
            class="dashboard-header__actions"
          >

            <button
              type="button"
              class="dashboard-header__notification"
              aria-label="Notificaciones"
            >

              <i
                class="fa-solid fa-bell"
                aria-hidden="true"
              ></i>

            </button>


            <div
              class="dashboard-header__account"
            >

              <span>
                CUENTA
              </span>

              <strong>
                ${
                  session.user?.email ||
                  "Cuenta NEXUS"
                }
              </strong>

            </div>

          </div>

        </header>


        <!-- ================================= -->
        <!-- WORKSPACE -->
        <!-- ================================= -->

        <div class="dashboard-workspace">

          <!-- ================================= -->
          <!-- CREATE -->
          <!-- ================================= -->

          <section
            class="dashboard-create"
          >

            <div
              class="dashboard-create__content"
            >

              <span
                class="dashboard-section__eyebrow"
              >
                NEXUS COMPETITIONS
              </span>

              <h2>
                Crea tu próxima competencia.
              </h2>

              <p>
                Configura, publica y administra
                tus competencias desde un solo
                lugar.
              </p>

            </div>


            <button
              type="button"
              class="dashboard-create__button"
              data-create-tournament
            >

              <i
                class="fa-solid fa-plus"
                aria-hidden="true"
              ></i>

              <span>
                Crear torneo
              </span>

            </button>

          </section>


          <!-- ================================= -->
          <!-- COMPETITIONS -->
          <!-- ================================= -->

          <section
            class="dashboard-section"
          >

            <header
              class="dashboard-section__header"
            >

              <div>

                <span
                  class="dashboard-section__eyebrow"
                >
                  COMPETENCIAS
                </span>

                <h2>
                  Mis competencias
                </h2>

              </div>


              <span
                class="dashboard-section__count"
                data-competition-count
              >
                0
              </span>

            </header>


            <div
              class="dashboard-competitions"
              data-competitions
            >

              <div
                class="dashboard-empty"
              >

                <div
                  class="dashboard-empty__icon"
                >

                  <i
                    class="fa-solid fa-trophy"
                    aria-hidden="true"
                  ></i>

                </div>


                <h3>
                  Todavía no tienes competencias.
                </h3>


                <p>
                  Crea tu primer torneo para
                  comenzar a construir tu
                  competencia en NEXUS.
                </p>

              </div>

            </div>

          </section>

        </div>

      </section>

    </div>
  `;


  // ========================================
  // ELEMENTS
  // ========================================

  let currentTournamentId = null;

  const main =
    page.querySelector(
      ".dashboard-main"
    );

  const headerDescription =
    page.querySelector(
      "[data-dashboard-description]"
    );

  const createTournamentButton =
    page.querySelector(
      "[data-create-tournament]"
    );

  const competitionsContainer =
    page.querySelector(
      "[data-competitions]"
    );

  const competitionCount =
    page.querySelector(
      "[data-competition-count]"
    );


  // ========================================
  // SIDEBAR
  // ========================================

  const sidebar =
    DashboardSidebar({
      onNavigate: view => {

        console.log(
          "NEXUS — Dashboard view:",
          view
        );

      }
    });


  main.parentElement.prepend(
    sidebar.element
  );


  // ========================================
  // COMPETITIONS
  // ========================================

  function escapeHtml(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  function formatDate(dateValue) {

    if (!dateValue) {
      return "";
    }

    const date =
      new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return new Intl.DateTimeFormat(
      "es-GT",
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    ).format(date);

  }


  function getGameLabel(gameId) {

    const labels = {
      "call-of-duty": "CALL OF DUTY"
    };

    return (
      labels[gameId] ||
      String(gameId || "COMPETENCIA")
        .replace(/-/g, " ")
        .toUpperCase()
    );

  }


  function renderCompetitions(events) {

    if (!competitionsContainer || !competitionCount) {
      return;
    }

    const entries =
      Object.entries(events || {});

    competitionCount.textContent =
      entries.length;

    if (!entries.length) {

      competitionsContainer.innerHTML = `
        <div class="dashboard-empty">

          <div class="dashboard-empty__icon">

            <i
              class="fa-solid fa-trophy"
              aria-hidden="true"
            ></i>

          </div>

          <h3>
            Todavía no tienes competencias.
          </h3>

          <p>
            Crea tu primer torneo para comenzar
            a construir tu competencia en NEXUS.
          </p>

        </div>
      `;

      return;
    }


    competitionsContainer.innerHTML =
      entries.map(
        ([eventId, event]) => {

          const game =
            getGameLabel(event?.gameId);

          const participation =
            event?.participationType ||
            "—";

          const format =
            event?.format ||
            "—";

          const matchSystem =
            event?.matchSystem ||
            "—";

          const capacity =
            event?.capacity ??
            "—";

          const startDate =
            formatDate(
              event?.dateTime?.startDate
            );

          const location =
            event?.location?.type === "presencial"
              ? event?.location?.venue || "Presencial"
              : event?.location?.platform || "Online";


          return `
            <article
              class="dashboard-competition-card"
              data-competition-card
              data-event-id="${escapeHtml(eventId)}"
            >

              <div class="dashboard-competition-card__top">

                <span
                  class="dashboard-competition-card__eyebrow"
                >
                  ${escapeHtml(game)}
                </span>

                <span
                  class="dashboard-competition-card__id"
                >
                  EVENTO
                </span>

              </div>


              <div class="dashboard-competition-card__body">

                <h3>
                  ${escapeHtml(
                    `${game} · ${participation}`
                  )}
                </h3>


                <div
                  class="dashboard-competition-card__meta"
                >

                  <span>

                    <i
                      class="fa-solid fa-sitemap"
                      aria-hidden="true"
                    ></i>

                    ${escapeHtml(format)}

                  </span>


                  <span>

                    <i
                      class="fa-solid fa-gamepad"
                      aria-hidden="true"
                    ></i>

                    ${escapeHtml(matchSystem)}

                  </span>


                  <span>

                    <i
                      class="fa-solid fa-users"
                      aria-hidden="true"
                    ></i>

                    ${escapeHtml(capacity)}

                  </span>


                  ${
                    startDate
                      ? `
                        <span>

                          <i
                            class="fa-regular fa-calendar"
                            aria-hidden="true"
                          ></i>

                          ${escapeHtml(startDate)}

                        </span>
                      `
                      : ""
                  }


                  ${
                    location
                      ? `
                        <span>

                          <i
                            class="fa-solid fa-location-dot"
                            aria-hidden="true"
                          ></i>

                          ${escapeHtml(location)}

                        </span>
                      `
                      : ""
                  }

                </div>

              </div>


              <footer
                class="dashboard-competition-card__actions"
              >

                <button
                  type="button"
                  class="dashboard-competition-card__button dashboard-competition-card__button--primary"
                  data-manage-event
                  data-event-id="${escapeHtml(eventId)}"
                >

                  <i
                    class="fa-solid fa-sliders"
                    aria-hidden="true"
                  ></i>

                  Administrar evento

                </button>


                <button
                  type="button"
                  class="dashboard-competition-card__button dashboard-competition-card__button--danger"
                  data-delete-event
                  data-event-id="${escapeHtml(eventId)}"
                >

                  <i
                    class="fa-solid fa-trash"
                    aria-hidden="true"
                  ></i>

                  Eliminar

                </button>


                <button
                  type="button"
                  class="dashboard-competition-card__button"
                  data-view-event
                  data-event-id="${escapeHtml(eventId)}"
                >

                  <i
                    class="fa-solid fa-arrow-up-right-from-square"
                    aria-hidden="true"
                  ></i>

                  Ver evento

                </button>

              </footer>

            </article>
          `;

        }
      ).join("");

  }


  async function loadCompetitions(tournamentId) {

    if (
      !tournamentId ||
      !competitionsContainer
    ) {
      return;
    }

    try {

      competitionsContainer.innerHTML = `
        <div class="dashboard-empty">

          <div class="dashboard-empty__icon">

            <i
              class="fa-solid fa-spinner fa-spin"
              aria-hidden="true"
            ></i>

          </div>

          <h3>
            Cargando competencias...
          </h3>

        </div>
      `;


      const tournament =
        await getEntity(
          "tournaments",
          tournamentId
        );


      renderCompetitions(
        tournament?.events || {}
      );


      console.log(
        "NEXUS — Competencias cargadas:",
        tournament?.events || {}
      );

    } catch (error) {

      console.error(
        "NEXUS — Error cargando competencias:",
        error
      );


      competitionCount.textContent = "0";


      competitionsContainer.innerHTML = `
        <div class="dashboard-empty">

          <div class="dashboard-empty__icon">

            <i
              class="fa-solid fa-triangle-exclamation"
              aria-hidden="true"
            ></i>

          </div>

          <h3>
            No pudimos cargar tus competencias.
          </h3>

          <p>
            Intenta actualizar el Dashboard.
          </p>

        </div>
      `;

    }

  }


  // ========================================
  // EVENT ACTIONS
  // ========================================

  competitionsContainer.addEventListener(
    "click",
    async event => {

      const manageButton =
        event.target.closest(
          "[data-manage-event]"
        );


      if (manageButton) {

        const eventId =
          manageButton.dataset.eventId;

        const tournamentId =
          currentTournamentId;


        if (!tournamentId || !eventId) {

          console.error(
            "NEXUS — No se pudo abrir el evento para administrar.",
            { tournamentId, eventId }
          );

          return;
        }


        window.history.pushState(
          {},
          "",
          `/dashboard/tournaments/edit?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}`
        );


        window.dispatchEvent(
          new PopStateEvent("popstate")
        );


        return;
      }


      const deleteButton =
        event.target.closest(
          "[data-delete-event]"
        );


      if (deleteButton) {

        const eventId =
          deleteButton.dataset.eventId;

        const tournamentId =
          currentTournamentId;


        if (!tournamentId || !eventId) {

          console.error(
            "NEXUS — No se pudo eliminar la competencia.",
            { tournamentId, eventId }
          );

          return;
        }


        const confirmed =
          window.confirm(
            "¿Estás seguro de eliminar esta competencia?\n\nSe eliminará del torneo actual y esta acción no se puede deshacer."
          );


        if (!confirmed) {
          return;
        }


        deleteButton.disabled =
          true;


        try {

          await deleteMapEntity(
            "tournaments",
            tournamentId,
            "events",
            eventId
          );


          console.log(
            "NEXUS — Competencia eliminada correctamente:",
            { tournamentId, eventId }
          );


          await loadCompetitions(
            tournamentId
          );

        } catch (error) {

          console.error(
            "NEXUS — Error eliminando la competencia:",
            error
          );


          deleteButton.disabled =
            false;


          window.alert(
            "No pudimos eliminar la competencia. Intenta nuevamente."
          );

        }


        return;
      }


      const viewButton =
        event.target.closest(
          "[data-view-event]"
        );


      if (viewButton) {

        const eventId =
          viewButton.dataset.eventId;

        const tournamentId =
          currentTournamentId;


        if (!tournamentId || !eventId) {

          console.error(
            "NEXUS — No se pudo abrir la competencia pública.",
            { tournamentId, eventId }
          );

          return;
        }


        window.history.pushState(
          {},
          "",
          `/competitions/event?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}`
        );


        window.dispatchEvent(
          new PopStateEvent("popstate")
        );

      }

    }
  );


  // ========================================
  // LOAD NEXUS CONTEXT
  // ========================================

  async function loadNexusContext() {

    try {

      const accountContext =
        await getCurrentAccountContext();

      const entityContext =
        await getCurrentEntityContext();


      currentTournamentId =
        entityContext?.id || null;


      // ====================================
      // ACCOUNT
      // ====================================

      let access = null;


      if (
        accountContext &&
        accountContext.subscription &&
        accountContext.subscription.status ===
          "active" &&
        entityContext?.productId
      ) {

        access =
          createSubscriptionAccess(
            accountContext.subscription,
            entityContext.productId
          );


        console.log(
          "NEXUS — Access Context:",
          access
        );


        console.log(
          "NEXUS — Plan:",
          accountContext.subscription.planId
        );


        console.log(
          "NEXUS — Product:",
          entityContext.productId
        );


        console.log(
          "NEXUS — Capabilities:",
          access.getCapabilities()
        );

      }


      // ====================================
      // ENTITY
      // ====================================

      if (entityContext) {

        if (
          entityContext.type === "tournament" &&
          entityContext.id
        ) {

          await loadCompetitions(
            entityContext.id
          );

        }


        const entityName =
          entityContext.entity?.name ||
          entityContext.type ||
          "Mi NEXUS";


        sidebar.setContext({

          type:
            entityContext.type,

          name:
            entityName,

          accessContext:
            access

        });


        headerDescription.textContent =
          `Gestionando ${entityName}.`;


        console.log(
          "NEXUS — Entity Context:",
          entityContext
        );

      } else {

        sidebar.setContext({

          type: null,

          name: "Mi NEXUS",

          accessContext:
            access

        });


        headerDescription.textContent =
          "Bienvenido a tu espacio NEXUS.";

      }


      // ====================================
      // ACCOUNT LOG
      // ====================================

      console.log(
        "NEXUS — Account Context:",
        accountContext
      );

    } catch (error) {

      console.error(
        "NEXUS — Error cargando contexto NEXUS:",
        error
      );


      headerDescription.textContent =
        "Ocurrió un error cargando el contexto de NEXUS.";

    }

  }


  // ========================================
  // CREATE TOURNAMENT
  // ========================================

  createTournamentButton.addEventListener(
    "click",
    () => {

      console.log(
        "NEXUS — Crear torneo"
      );


      window.history.pushState(
        {},
        "",
        "/dashboard/tournaments/new"
      );


      window.dispatchEvent(
        new PopStateEvent("popstate")
      );

    }
  );


  // ========================================
  // LOGOUT
  // ========================================

  const logoutButton =
    () =>
      page.querySelector(
        "[data-dashboard-logout]"
      );


  page.addEventListener(
    "click",
    async event => {

      const button =
        event.target.closest(
          "[data-dashboard-logout]"
        );


      if (!button) {
        return;
      }


      try {

        button.disabled =
          true;


        button.innerHTML = `
          <i
            class="fa-solid fa-spinner fa-spin"
            aria-hidden="true"
          ></i>

          <span>
            Cerrando sesión...
          </span>
        `;


        await logout();


        console.log(
          "NEXUS — Sesión cerrada correctamente"
        );

      } catch (error) {

        console.error(
          "NEXUS — Error cerrando sesión:",
          error
        );


        button.disabled =
          false;


        button.innerHTML = `
          <i
            class="fa-solid fa-arrow-right-from-bracket"
            aria-hidden="true"
          ></i>

          <span>
            Cerrar sesión
          </span>
        `;

      }

    }
  );


  // ========================================
  // LOAD
  // ========================================

  loadNexusContext();


  // ========================================
  // RETURN
  // ========================================

  return page;

}