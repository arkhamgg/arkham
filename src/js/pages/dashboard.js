// ========================================
// NEXUS — Dashboard
// ========================================

import {
  getCurrentSession
} from "../services/session.js";

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
  hasEffectiveSubscriptionAccess
} from "../services/subscription.js";

import {
  getEntity,
  deleteMapEntity
} from "../services/firestore.js";


// ========================================
// PAGE
// ========================================

export function Dashboard({ dashboardSidebar = null } = {}) {

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

            <!-- ================================= -->
            <!-- NOTIFICATIONS -->
            <!-- ================================= -->

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


            <!-- ================================= -->
            <!-- ACCOUNT -->
            <!-- ================================= -->

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

  `;


  // ========================================
  // ELEMENTS
  // ========================================

  let currentTournamentId =
    null;

  let currentAccountContext =
    null;

  let currentEntityContext =
    null;


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
  // DASHBOARD NAVIGATION
  // ========================================

  const sidebar =
    dashboardSidebar;


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
      new Date(
        `${dateValue}T00:00:00`
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

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

      "call-of-duty":
        "CALL OF DUTY"

    };


    return (
      labels[gameId] ||
      String(
        gameId ||
        "COMPETENCIA"
      )
        .replace(/-/g, " ")
        .toUpperCase()
    );

  }


  function renderCompetitions(events) {

    if (
      !competitionsContainer ||
      !competitionCount
    ) {

      return;

    }


    const entries =
      Object.entries(
        events || {}
      );


    competitionCount.textContent =
      entries.length;


    if (!entries.length) {

      competitionsContainer.innerHTML = `

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
            Crea tu primer torneo para comenzar
            a construir tu competencia en NEXUS.
          </p>

        </div>

      `;

      return;

    }


    competitionsContainer.innerHTML =
      entries
        .map(
          ([eventId, event]) => {

            const game =
              getGameLabel(
                event?.gameId
              );


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
              event?.location?.type ===
              "presencial"
                ? event?.location?.venue ||
                  "Presencial"
                : event?.location?.platform ||
                  "Online";


            // ========================================
            // EVENT STATUS
            // ========================================

            const isCompleted =
              event?.status === "completed";


            return `

              <article
                class="dashboard-competition-card"
                data-competition-card
                data-event-id="${escapeHtml(eventId)}"
              >

                <div
                  class="dashboard-competition-card__top"
                >

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


                <div
                  class="dashboard-competition-card__body"
                >

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

                  ${
                    isCompleted
                      ? `

                        <div
                          class="dashboard-competition-card__status"
                          aria-label="Evento terminado"
                        >

                          <i
                            class="fa-solid fa-circle-check"
                            aria-hidden="true"
                          ></i>

                          Evento terminado

                        </div>

                      `
                      : `

                        <button
                          type="button"
                          class="dashboard-competition-card__button dashboard-competition-card__button--primary"
                          data-configure-event
                          data-event-id="${escapeHtml(eventId)}"
                        >

                          <i
                            class="fa-solid fa-sliders"
                            aria-hidden="true"
                          ></i>

                          Configurar información

                        </button>


                        ${
                          currentEntityContext?.productId === "tournament" &&
                          currentAccountContext?.subscription?.planId === "pro" &&
                          hasEffectiveSubscriptionAccess(
                            currentAccountContext.subscription
                          )
                            ? `

                              <button
                                type="button"
                                class="dashboard-competition-card__button"
                                data-manage-event
                                data-event-id="${escapeHtml(eventId)}"
                              >

                                <i
                                  class="fa-solid fa-gamepad"
                                  aria-hidden="true"
                                ></i>

                                Administrar

                              </button>

                            `
                            : ""
                        }


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

                      `
                  }

                </footer>

              </article>

            `;

          }
        )
        .join("");

  }


  async function loadCompetitions(
    tournamentId
  ) {

    if (
      !tournamentId ||
      !competitionsContainer
    ) {

      return;

    }


    try {

      competitionsContainer.innerHTML = `

        <div
          class="dashboard-empty"
        >

          <div
            class="dashboard-empty__icon"
          >

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


      competitionCount.textContent =
        "0";


      competitionsContainer.innerHTML = `

        <div
          class="dashboard-empty"
        >

          <div
            class="dashboard-empty__icon"
          >

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

      const configureButton =
        event.target.closest(
          "[data-configure-event]"
        );


      if (configureButton) {

        const eventId =
          configureButton.dataset.eventId;

        const tournamentId =
          currentTournamentId;


        if (
          !tournamentId ||
          !eventId
        ) {

          console.error(
            "NEXUS — No se pudo abrir la configuración del evento.",
            {
              tournamentId,
              eventId
            }
          );

          return;

        }


        const targetUrl =
          `/dashboard/tournaments/edit?tournamentId=${encodeURIComponent(
            tournamentId
          )}&eventId=${encodeURIComponent(eventId)}`;


        window.history.pushState(
          {},
          "",
          targetUrl
        );


        window.dispatchEvent(
          new PopStateEvent(
            "popstate"
          )
        );


        return;

      }


      const manageButton =
        event.target.closest(
          "[data-manage-event]"
        );


      if (manageButton) {

        const eventId =
          manageButton.dataset.eventId;

        const tournamentId =
          currentTournamentId;

        const subscription =
          currentAccountContext?.subscription;

        const hasEffectivePro =
          currentEntityContext?.productId === "tournament" &&
          subscription?.planId === "pro" &&
          hasEffectiveSubscriptionAccess(
            subscription
          );


        if (
          !tournamentId ||
          !eventId ||
          !hasEffectivePro
        ) {

          console.error(
            "NEXUS — No se pudo abrir la administración Pro del evento.",
            {
              tournamentId,
              eventId,
              hasEffectivePro
            }
          );

          return;

        }


        const targetUrl =
          `/dashboard/tournaments/pro?tournamentId=${encodeURIComponent(
            tournamentId
          )}&eventId=${encodeURIComponent(eventId)}`;


        window.history.pushState(
          {},
          "",
          targetUrl
        );


        window.dispatchEvent(
          new PopStateEvent(
            "popstate"
          )
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


        if (
          !tournamentId ||
          !eventId
        ) {

          console.error(
            "NEXUS — No se pudo eliminar la competencia.",
            {
              tournamentId,
              eventId
            }
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
            {
              tournamentId,
              eventId
            }
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


        if (
          !tournamentId ||
          !eventId
        ) {

          console.error(
            "NEXUS — No se pudo abrir la competencia pública.",
            {
              tournamentId,
              eventId
            }
          );

          return;

        }


        window.history.pushState(
          {},
          "",
          `/competitions/event?tournamentId=${encodeURIComponent(
            tournamentId
          )}&eventId=${encodeURIComponent(
            eventId
          )}`
        );


        window.dispatchEvent(
          new PopStateEvent(
            "popstate"
          )
        );

      }

    }
  );


  // ========================================
  // PLAYER DASHBOARD
  // ========================================

  function renderPlayerDashboard(
    entityContext
  ) {

    const entity =
      entityContext?.entity || {};


    const gamertag =
      entity.gamertag ||
      entity.name ||
      "Jugador NEXUS";


    const roles =
      Array.isArray(entity.roles)
        ? entity.roles
        : [];


    const roleLabels = {

      streamer:
        "Streamer",

      content_creator:
        "Creador de contenido",

      influencer:
        "Influencer",

      competitive_player:
        "Jugador competitivo"

    };


    const rolesText =
      roles.length
        ? roles
            .map(
              role =>
                roleLabels[role] ||
                role
            )
            .join(" · ")
        : "Perfil NEXUS";


    const workspace =
      main?.querySelector(
        ".dashboard-workspace"
      );


    if (!workspace) return;


    workspace.innerHTML = `

      <section class="player-dashboard">

        <header
          class="player-dashboard__hero"
        >

          <div>

            <span
              class="player-dashboard__eyebrow"
            >
              PLAYER PROFILE
            </span>

            <h2>
              ${escapeHtml(gamertag)}
            </h2>

            <p>
              ${escapeHtml(rolesText)}
            </p>

          </div>


          <a
            class="player-dashboard__profile-link"
            href="/dashboard/player/profile"
            data-player-profile
          >

            <i
              class="fa-solid fa-user"
              aria-hidden="true"
            ></i>

            Mi perfil

          </a>

        </header>


        <div
          class="player-dashboard__grid"
        >

          <article
            class="player-dashboard__card player-dashboard__card--primary"
          >

            <span>
              COMPETENCIAS
            </span>

            <strong>
              0
            </strong>

            <p>
              Eventos en los que has participado.
            </p>

          </article>


          <article
            class="player-dashboard__card"
          >

            <span>
              SOLICITUDES
            </span>

            <strong>
              0
            </strong>

            <p>
              Solicitudes a torneos pendientes.
            </p>

          </article>


          <article
            class="player-dashboard__card"
          >

            <span>
              RESULTADOS
            </span>

            <strong>
              0
            </strong>

            <p>
              Resultados registrados en NEXUS.
            </p>

          </article>


          <article
            class="player-dashboard__card"
          >

            <span>
              TÍTULOS
            </span>

            <strong>
              0
            </strong>

            <p>
              Reconocimientos obtenidos.
            </p>

          </article>

        </div>


        <section
          class="player-dashboard__section"
        >

          <div
            class="player-dashboard__section-header"
          >

            <div>

              <span>
                COMPETITIVO
              </span>

              <h3>
                Tu actividad competitiva
              </h3>

            </div>

          </div>


          <div
            class="player-dashboard__empty"
          >

            <div
              class="player-dashboard__empty-icon"
            >

              <i
                class="fa-solid fa-crosshairs"
                aria-hidden="true"
              ></i>

            </div>

            <h4>
              Aún no tienes competencias.
            </h4>

            <p>
              Explora competencias disponibles
              y solicita tu lugar para comenzar
              tu historial competitivo.
            </p>

            <a
              href="/competitions"
              class="player-dashboard__action"
            >

              Explorar competencias

              <i
                class="fa-solid fa-arrow-right"
                aria-hidden="true"
              ></i>

            </a>

          </div>

        </section>

      </section>

    `;


    page
      .querySelectorAll(
        "[data-player-profile]"
      )
      .forEach(
        link => {

          link.addEventListener(
            "click",
            event => {

              event.preventDefault();


              window.history.pushState(
                {},
                "",
                "/dashboard/player/profile"
              );


              window.dispatchEvent(
                new PopStateEvent(
                  "popstate"
                )
              );

            }
          );

        }
      );

  }


  // ========================================
  // LOAD NEXUS CONTEXT
  // ========================================

  async function loadNexusContext() {

    try {

      const accountContext =
        await getCurrentAccountContext();


      const entityContext =
        await getCurrentEntityContext();


      currentAccountContext =
        accountContext || null;


      currentEntityContext =
        entityContext || null;


      currentTournamentId =
        entityContext?.id ||
        null;


      // ====================================
      // ACCOUNT
      // ====================================

      let access =
        null;


      if (
        accountContext &&
        accountContext.subscription &&
        entityContext?.productId &&
        hasEffectiveSubscriptionAccess(
          accountContext.subscription
        )
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
          entityContext.type ===
            "tournament" &&
          entityContext.id
        ) {

          await loadCompetitions(
            entityContext.id
          );

        }


        if (
          entityContext.type ===
            "player"
        ) {

          renderPlayerDashboard(
            entityContext
          );


          headerDescription.textContent =
            `Bienvenido, ${
              entityContext.entity?.gamertag ||
              entityContext.entity?.name ||
              "jugador"
            }.`;

        }


        const entityName =
          entityContext.entity?.name ||
          entityContext.type ||
          "Mi NEXUS";


        if (sidebar) {

          sidebar.setContext({

            type:
              entityContext.type,

            name:
              entityName,

            accessContext:
              access

          });

        }


        headerDescription.textContent =
          `Gestionando ${entityName}.`;


        console.log(
          "NEXUS — Entity Context:",
          entityContext
        );

      } else {

        if (sidebar) {

          sidebar.setContext({

            type:
              null,

            name:
              "Mi NEXUS",

            accessContext:
              access

          });

        }


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
    async () => {

      console.log(
        "NEXUS — Crear torneo"
      );


      /*
       * El Dashboard ya conoce el Tournament actual.
       * Lo enviamos explícitamente al Builder para que
       * la creación de una competencia no dependa de
       * una segunda lectura asíncrona del contexto.
       */

      if (!currentTournamentId) {

        console.error(
          "NEXUS — No se puede abrir el Builder: no hay Tournament ID actual."
        );

        return;

      }


      const builderUrl =
        `/dashboard/tournaments/new?tournamentId=${encodeURIComponent(
          currentTournamentId
        )}`;


      window.history.pushState(
        {},
        "",
        builderUrl
      );


      window.dispatchEvent(
        new PopStateEvent(
          "popstate"
        )
      );

    }
  );


  // ========================================
  // LOAD
  // ========================================

  const nexusContextInitialization =
    loadNexusContext();


  // ========================================
  // RETURN
  // ========================================

  return page;

}