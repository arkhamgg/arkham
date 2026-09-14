// ========================================
// NEXUS — Dashboard Sidebar Component
// ========================================


import { logout } from "../services/auth.js";

// ========================================
// GLOBAL NAVIGATION
// ========================================

const GLOBAL_NAVIGATION = [
  {
    group: "PRINCIPAL",
    items: [
      {
        id: "overview",
        label: "Overview",
        icon: "fa-grid-2"
      }
    ]
  },

  {
    group: "EXPLORAR",
    items: [
      {
        id: "competitions",
        label: "Competencias",
        icon: "fa-trophy"
      },
      {
        id: "teams",
        label: "Equipos",
        icon: "fa-users"
      },
      {
        id: "players",
        label: "Jugadores",
        icon: "fa-user"
      },
      {
        id: "calendar",
        label: "Calendario",
        icon: "fa-calendar-days"
      }
    ]
  }
];


// ========================================
// ACCOUNT NAVIGATION
// ========================================

const ACCOUNT_NAVIGATION = [
  {
    id: "profile",
    label: "Perfil",
    icon: "fa-user-circle"
  },

  {
    id: "upgrade-plan",
    label: "Upgrade Plan",
    icon: "fa-bolt"
  }
];


// ========================================
// LOGOUT NAVIGATION
// ========================================

const LOGOUT_NAVIGATION = {
  label: "Cerrar sesión",
  icon: "fa-arrow-right-from-bracket"
};


// ========================================
// COMPONENT
// ========================================

export function DashboardSidebar({
  entityType = null,
  entityName = "Mi NEXUS",
  access = null,
  activeView = "overview",
  onNavigate = null
} = {}) {

  const container =
    document.createElement("aside");

  container.className =
    "dashboard-sidebar";


  // ========================================
  // MOBILE NAV STATE
  // ========================================

  let mobileNavOpen = false;


  // ========================================
  // FIND ACTIVE NAV ITEM
  // ========================================

  function getAllNavigationItems() {

    const globalItems =
      GLOBAL_NAVIGATION.flatMap(
        group => group.items
      );

    return [
      ...globalItems,
      ...ACCOUNT_NAVIGATION
    ];
  }


  function getActiveNavigationItem() {

    const items =
      getAllNavigationItems();

    return (
      items.find(
        item =>
          item.id === activeView
      ) ||
      items[0]
    );
  }


  // ========================================
  // RENDER
  // ========================================

  function render() {

    const activeItem =
      getActiveNavigationItem();


    container.innerHTML = `

      <!-- ================================= -->
      <!-- TOPBAR -->
      <!-- ================================= -->

      <div class="dashboard-sidebar__topbar">

        <div class="dashboard-sidebar__brand">
          NEXUS
        </div>


        <!-- MOBILE HAMBURGER -->

        <button
          type="button"
          class="dashboard-sidebar__mobile-toggle"
          aria-expanded="${mobileNavOpen}"
          aria-controls="nexus-mobile-navigation"
          aria-label="${
            mobileNavOpen
              ? "Cerrar navegación"
              : "Abrir navegación"
          }"
          data-mobile-nav-toggle
        >

          <i
            class="fa-solid ${
              mobileNavOpen
                ? "fa-xmark"
                : "fa-bars"
            }"
            aria-hidden="true"
          ></i>

        </button>

      </div>


      <!-- ================================= -->
      <!-- ACTIVE CONTEXT -->
      <!-- ================================= -->

      <div class="dashboard-sidebar__context">

        <span>
          ESPACIO ACTIVO
        </span>

        <strong>
          ${entityName}
        </strong>

      </div>


      <!-- ================================= -->
      <!-- DESKTOP NAV -->
      <!-- ================================= -->

      <nav
        class="dashboard-sidebar__nav"
        aria-label="Navegación de Mi NEXUS"
      >

        ${GLOBAL_NAVIGATION
          .map(
            group => `
              <div
                class="dashboard-sidebar__group"
              >

                <span
                  class="dashboard-sidebar__label"
                >
                  ${group.group}
                </span>


                ${group.items
                  .map(
                    item => `
                      <button
                        type="button"
                        class="
                          dashboard-sidebar__link
                          ${
                            item.id === activeView
                              ? "is-active"
                              : ""
                          }
                        "
                        data-dashboard-view="${item.id}"
                      >

                        <i
                          class="fa-solid ${item.icon}"
                          aria-hidden="true"
                        ></i>

                        <span>
                          ${item.label}
                        </span>

                      </button>
                    `
                  )
                  .join("")}

              </div>
            `
          )
          .join("")}


        <!-- ================================= -->
        <!-- ACCOUNT -->
        <!-- ================================= -->

        <div
          class="dashboard-sidebar__group"
        >

          <span
            class="dashboard-sidebar__label"
          >
            CUENTA
          </span>


          ${ACCOUNT_NAVIGATION
            .map(
              item => `
                <button
                  type="button"
                  class="
                    dashboard-sidebar__link
                    ${
                      item.id === activeView
                        ? "is-active"
                        : ""
                    }
                  "
                  data-dashboard-view="${item.id}"
                >

                  <i
                    class="fa-solid ${item.icon}"
                    aria-hidden="true"
                  ></i>

                  <span>
                    ${item.label}
                  </span>

                </button>
              `
            )
            .join("")}


          <!-- LOGOUT -->

          <button
            type="button"
            class="
              dashboard-sidebar__link
              dashboard-sidebar__link--logout
            "
            data-dashboard-logout
          >

            <i
              class="fa-solid ${LOGOUT_NAVIGATION.icon}"
              aria-hidden="true"
            ></i>

            <span>
              ${LOGOUT_NAVIGATION.label}
            </span>

          </button>

        </div>

      </nav>


      <!-- ================================= -->
      <!-- MOBILE NAVIGATION -->
      <!-- ================================= -->

      <nav
        id="nexus-mobile-navigation"
        class="
          dashboard-sidebar__mobile-menu
          ${mobileNavOpen ? "is-open" : ""}
        "
        aria-label="Navegación móvil de Mi NEXUS"
        aria-hidden="${!mobileNavOpen}"
      >

        <!-- ================================= -->
        <!-- PRINCIPAL / EXPLORAR -->
        <!-- ================================= -->

        ${GLOBAL_NAVIGATION
          .map(
            group => `
              <div
                class="dashboard-sidebar__mobile-group"
              >

                <span
                  class="dashboard-sidebar__mobile-label"
                >
                  ${group.group}
                </span>


                ${group.items
                  .map(
                    item => `
                      <button
                        type="button"
                        class="
                          dashboard-sidebar__mobile-link
                          ${
                            item.id === activeView
                              ? "is-active"
                              : ""
                          }
                        "
                        data-dashboard-mobile-view="${item.id}"
                      >

                        <i
                          class="fa-solid ${item.icon}"
                          aria-hidden="true"
                        ></i>

                        <span>
                          ${item.label}
                        </span>

                      </button>
                    `
                  )
                  .join("")}

              </div>
            `
          )
          .join("")}


        <!-- ================================= -->
        <!-- CUENTA -->
        <!-- ================================= -->

        <div
          class="dashboard-sidebar__mobile-group"
        >

          <span
            class="dashboard-sidebar__mobile-label"
          >
            CUENTA
          </span>


          ${ACCOUNT_NAVIGATION
            .map(
              item => `
                <button
                  type="button"
                  class="
                    dashboard-sidebar__mobile-link
                    ${
                      item.id === activeView
                        ? "is-active"
                        : ""
                    }
                  "
                  data-dashboard-mobile-view="${item.id}"
                >

                  <i
                    class="fa-solid ${item.icon}"
                    aria-hidden="true"
                  ></i>

                  <span>
                    ${item.label}
                  </span>

                </button>
              `
            )
            .join("")}


          <!-- LOGOUT -->

          <button
            type="button"
            class="
              dashboard-sidebar__mobile-link
              dashboard-sidebar__mobile-link--logout
            "
            data-dashboard-logout
          >

            <i
              class="fa-solid ${LOGOUT_NAVIGATION.icon}"
              aria-hidden="true"
            ></i>

            <span>
              ${LOGOUT_NAVIGATION.label}
            </span>

          </button>

        </div>

      </nav>

    `;


    bindEvents();
  }


  // ========================================
  // EVENTS
  // ========================================

  function bindEvents() {

    // --------------------------------------
    // DESKTOP NAV
    // --------------------------------------

    container
      .querySelectorAll(
        "[data-dashboard-view]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const view =
                button.dataset.dashboardView;

              selectView(view);

            }
          );

        }
      );


    // --------------------------------------
    // MOBILE TOGGLE
    // --------------------------------------

    const mobileToggle =
      container.querySelector(
        "[data-mobile-nav-toggle]"
      );


    if (mobileToggle) {

      mobileToggle.addEventListener(
        "click",
        () => {

          mobileNavOpen =
            !mobileNavOpen;

          render();

        }
      );

    }


    // --------------------------------------
    // MOBILE NAV
    // --------------------------------------

    container
      .querySelectorAll(
        "[data-dashboard-mobile-view]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const view =
                button.dataset.dashboardMobileView;

              selectView(view);

            }
          );

        }
      );


    // --------------------------------------
    // LOGOUT
    // --------------------------------------

    container
      .querySelectorAll(
        "[data-dashboard-logout]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              if (button.disabled) {
                return;
              }

              button.disabled = true;

              try {

                console.log(
                  "NEXUS — Cerrando sesión..."
                );

                await logout();

                console.log(
                  "NEXUS — Sesión cerrada correctamente."
                );

                window.history.pushState(
                  {},
                  "",
                  "/login"
                );

                window.dispatchEvent(
                  new PopStateEvent(
                    "popstate"
                  )
                );

              } catch (error) {

                console.error(
                  "NEXUS — Error cerrando sesión:",
                  error
                );

                button.disabled = false;

                window.alert(
                  "No pudimos cerrar la sesión. Intenta nuevamente."
                );

              }

            }
          );

        }
      );
  }



  // ========================================
  // SELECT VIEW
  // ========================================

  function selectView(view) {

    activeView =
      view;

    mobileNavOpen =
      false;

    render();


    if (
      typeof onNavigate ===
      "function"
    ) {

      onNavigate(view);

    }

  }


  // ========================================
  // ACTIVE VIEW
  // ========================================

  function setActiveView(view) {

    activeView =
      view;


    const activeItem =
      getActiveNavigationItem();


    container
      .querySelectorAll(
        "[data-dashboard-view]"
      )
      .forEach(
        button => {

          button.classList.toggle(
            "is-active",
            button.dataset.dashboardView ===
              activeView
          );

        }
      );


    container
      .querySelectorAll(
        "[data-dashboard-mobile-view]"
      )
      .forEach(
        button => {

          button.classList.toggle(
            "is-active",
            button.dataset.dashboardMobileView ===
              activeView
          );

        }
      );

  }


  // ========================================
  // UPDATE CONTEXT
  // ========================================

  function setContext({
    type = null,
    name = "Mi NEXUS",
    accessContext = null
  } = {}) {

    entityType =
      type;

    entityName =
      name;

    access =
      accessContext;

    render();

  }


  // ========================================
  // UPDATE ACCESS
  // ========================================

  function setAccess(accessContext) {

    access =
      accessContext;

    render();

  }


  // ========================================
  // INITIAL RENDER
  // ========================================

  render();


  // ========================================
  // PUBLIC API
  // ========================================

  return {
    element: container,
    setContext,
    setAccess,
    setActiveView
  };

}