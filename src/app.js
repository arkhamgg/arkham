// ========================================
// NEXUS — Application Entry
// ========================================

import "@fortawesome/fontawesome-free/css/all.min.css";

import "./styles/main.scss";

import { Navbar } from "./js/components/navbar.js";

import { Router } from "./js/router.js";

import { initializeSession } from "./js/services/session.js";


// ========================================
// APP
// ========================================

const app =
  document.querySelector("#app");


// ========================================
// GLOBAL UI
// ========================================

const navbar =
  Navbar();

app.appendChild(
  navbar
);


// ========================================
// PAGE CONTAINER
// ========================================

const pageContainer =
  document.createElement("div");

pageContainer.id =
  "page-container";

app.appendChild(
  pageContainer
);


// ========================================
// ROUTER STATE
// ========================================

let routerInitialized =
  false;


// ========================================
// INITIAL SESSION STATE
// ========================================

let initialSessionResolved =
  false;


// ========================================
// SESSION
// ========================================

initializeSession(
  (session) => {

    // ========================================
    // SESSION ACTIVE
    // ========================================

    if (session) {

      console.log(
        "NEXUS — Sesión lista:",
        session
      );

    } else {

      console.log(
        "NEXUS — No hay sesión activa"
      );

    }


    // ========================================
    // INITIALIZE ROUTER ONCE
    // ========================================

    if (!routerInitialized) {

      routerInitialized =
        true;

      Router(
        pageContainer
      );

    }


    // ========================================
    // INITIAL SESSION RESOLVED
    // ========================================

    if (!initialSessionResolved) {

      initialSessionResolved =
        true;

      return;

    }


    // ========================================
    // SESSION CLOSED
    // ========================================

    if (
      !session &&
      window.location.pathname === "/dashboard"
    ) {

      window.history.pushState(
        {},
        "",
        "/login"
      );

      window.dispatchEvent(
        new PopStateEvent("popstate")
      );

    }

  }
);