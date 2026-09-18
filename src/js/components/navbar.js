// ========================================
// NEXUS — Navbar Component
// ========================================

import {
  getCurrentSession,
  onSessionChange
} from "../services/session.js";


// ========================================
// NAVBAR
// ========================================

export function Navbar() {

  const navbar =
    document.createElement("header");

  navbar.className =
    "navbar";


  // ========================================
  // INITIAL CONTENT
  // ========================================

  navbar.innerHTML = `

    <div class="navbar__container">

      <a
        href="/"
        class="navbar__brand"
        aria-label="NEXUS — Inicio"
      >

        <span class="navbar__brand-mark">
          N
        </span>

        <span class="navbar__brand-name">
          ARKHAM
        </span>

      </a>


      <nav
        class="navbar__nav"
        aria-label="Navegación principal"
      >

        <a
          href="/"
          class="navbar__link navbar__link--active"
        >

          <i
            class="fa-solid fa-house"
            aria-hidden="true"
          ></i>

          <span>
            Inicio
          </span>

        </a>


        <a
          href="/competitions"
          class="navbar__link"
        >

          <i
            class="fa-solid fa-trophy"
            aria-hidden="true"
          ></i>

          <span>
            Competencias
          </span>

        </a>


        <a
          href="/teams"
          class="navbar__link"
        >

          <i
            class="fa-solid fa-shield-halved"
            aria-hidden="true"
          ></i>

          <span>
            Equipos
          </span>

        </a>


        <a
          href="/players"
          class="navbar__link"
        >

          <i
            class="fa-solid fa-users"
            aria-hidden="true"
          ></i>

          <span>
            Players
          </span>

        </a>


        <a
          href="/calendar"
          class="navbar__link"
        >

          <i
            class="fa-solid fa-calendar-days"
            aria-hidden="true"
          ></i>

          <span>
            Calendario
          </span>

        </a>

      </nav>


      <div class="navbar__actions">

        <!-- SESSION ACTION -->

        <a
          href="/login"
          class="navbar__login"
          data-navbar-session-action
        >

          <span>
            Iniciar sesión
          </span>

        </a>


        <!-- REGISTER -->

        <a
          href="/register"
          class="navbar__cta"
          data-navbar-register
        >

          <span>
            Crear cuenta
          </span>

          <i
            class="fa-solid fa-arrow-right"
            aria-hidden="true"
          ></i>

        </a>


        <!-- MOBILE TOGGLE -->

        <button
          class="navbar__menu-toggle"
          type="button"
          aria-label="Abrir menú"
          aria-expanded="false"
        >

          <i
            class="fa-solid fa-bars"
            aria-hidden="true"
          ></i>

        </button>

      </div>

    </div>


    <!-- ========================================
         MOBILE MENU
    ======================================== -->

    <div class="navbar__mobile-menu">

      <nav
        class="navbar__mobile-nav"
        aria-label="Navegación móvil"
      >

        <a
          href="/"
          class="navbar__mobile-link navbar__mobile-link--active"
        >

          <i
            class="fa-solid fa-house"
            aria-hidden="true"
          ></i>

          <span>
            Inicio
          </span>

        </a>


        <a
          href="/competitions"
          class="navbar__mobile-link"
        >

          <i
            class="fa-solid fa-trophy"
            aria-hidden="true"
          ></i>

          <span>
            Competencias
          </span>

        </a>


        <a
          href="#teams"
          class="navbar__mobile-link"
        >

          <i
            class="fa-solid fa-shield-halved"
            aria-hidden="true"
          ></i>

          <span>
            Equipos
          </span>

        </a>


        <a
          href="/players"
          class="navbar__mobile-link"
        >

          <i
            class="fa-solid fa-users"
            aria-hidden="true"
          ></i>

          <span>
            Players
          </span>

        </a>


        <a
          href="#calendar"
          class="navbar__mobile-link"
        >

          <i
            class="fa-solid fa-calendar-days"
            aria-hidden="true"
          ></i>

          <span>
            Calendario
          </span>

        </a>


        <!-- MOBILE SESSION ACTION -->

        <a
          href="/login"
          class="navbar__mobile-link"
          data-navbar-mobile-session-action
        >

          <i
            class="fa-solid fa-right-to-bracket"
            aria-hidden="true"
          ></i>

          <span>
            Iniciar sesión
          </span>

        </a>


        <!-- MOBILE REGISTER -->

        <a
          href="/register"
          class="navbar__mobile-cta"
          data-navbar-mobile-register
        >

          <span>
            Crear cuenta
          </span>

          <i
            class="fa-solid fa-arrow-right"
            aria-hidden="true"
          ></i>

        </a>

      </nav>

    </div>

  `;


  // ========================================
  // ELEMENTS
  // ========================================

  const menuToggle =
    navbar.querySelector(
      ".navbar__menu-toggle"
    );


  const mobileMenu =
    navbar.querySelector(
      ".navbar__mobile-menu"
    );


  const mobileLinks =
    navbar.querySelectorAll(
      ".navbar__mobile-link, .navbar__mobile-cta"
    );


  const sessionAction =
    navbar.querySelector(
      "[data-navbar-session-action]"
    );


  const mobileSessionAction =
    navbar.querySelector(
      "[data-navbar-mobile-session-action]"
    );


  // ========================================
  // SESSION UI
  // ========================================

  function updateSessionUI(
    session
  ) {

    // ========================================
    // AUTHENTICATED
    // ========================================

    if (session) {

      // ========================================
      // AUTHENTICATED STATE
      // ========================================

      navbar.classList.add(
        "navbar--authenticated"
      );


      // ========================================
      // DESKTOP
      // ========================================

      sessionAction.href =
        "/dashboard";

      sessionAction.innerHTML = `

        <i
          class="fa-solid fa-user"
          aria-hidden="true"
        ></i>

        <span>
          Mi ARKHAM
        </span>

      `;


      // "Crear cuenta" is hidden by
      // .navbar--authenticated


      // ========================================
      // MOBILE
      // ========================================

      mobileSessionAction.href =
        "/dashboard";

      mobileSessionAction.innerHTML = `

        <i
          class="fa-solid fa-user"
          aria-hidden="true"
        ></i>

        <span>
          Mi ARKHAM
        </span>

      `;


      return;

    }


    // ========================================
    // NO SESSION
    // ========================================

    navbar.classList.remove(
      "navbar--authenticated"
    );


    sessionAction.href =
      "/login";


    sessionAction.innerHTML = `

      <span>
        Iniciar sesión
      </span>

    `;


    mobileSessionAction.href =
      "/login";


    mobileSessionAction.innerHTML = `

      <i
        class="fa-solid fa-right-to-bracket"
        aria-hidden="true"
      ></i>

      <span>
        Iniciar sesión
      </span>

    `;

  }


  // ========================================
  // SESSION LISTENER
  // ========================================

  onSessionChange(
    updateSessionUI
  );


  // ========================================
  // APPLY CURRENT SESSION
  // ========================================

  updateSessionUI(
    getCurrentSession()
  );


  // ========================================
  // MOBILE MENU
  // ========================================

  function closeMenu() {

    navbar.classList.remove(
      "navbar--menu-open"
    );


    menuToggle.setAttribute(
      "aria-expanded",
      "false"
    );


    menuToggle.setAttribute(
      "aria-label",
      "Abrir menú"
    );


    menuToggle.innerHTML = `

      <i
        class="fa-solid fa-bars"
        aria-hidden="true"
      ></i>

    `;

  }


  function toggleMenu() {

    const isOpen =
      navbar.classList.toggle(
        "navbar--menu-open"
      );


    menuToggle.setAttribute(
      "aria-expanded",
      String(isOpen)
    );


    menuToggle.setAttribute(
      "aria-label",
      isOpen
        ? "Cerrar menú"
        : "Abrir menú"
    );


    menuToggle.innerHTML = `

      <i
        class="fa-solid ${
          isOpen
            ? "fa-xmark"
            : "fa-bars"
        }"
        aria-hidden="true"
      ></i>

    `;

  }


  menuToggle.addEventListener(
    "click",
    toggleMenu
  );


  mobileLinks.forEach(
    (link) => {

      link.addEventListener(
        "click",
        closeMenu
      );

    }
  );


  window.addEventListener(
    "resize",
    () => {

      if (
        window.innerWidth > 720
      ) {

        closeMenu();

      }

    }
  );


  return navbar;

}