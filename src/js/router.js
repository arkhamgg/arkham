// ========================================
// NEXUS — Router
// ========================================

import { Home } from "./pages/home.js";
import { Competitions } from "./pages/competitions.js";
import { Register } from "./pages/register.js";
import { CreateLeague } from "./pages/createLeague.js";
import { CreateTournament } from "./pages/createTournament.js";
import { Dashboard } from "./pages/dashboard.js";
import { Login } from "./pages/login.js";
import { CreateTeam } from "./pages/createTeam.js";
import { CreatePlayer } from "./pages/createPlayer.js";
import { Teams } from "./pages/teams.js";
import { TournamentBuilder } from "./pages/tournamentBuilder.js";
import { CompetitionLanding } from "./pages/competitionLanding.js";
import { CompetitionDetail } from "./pages/competitionDetail.js";
import { Calendar } from "./pages/calendar.js";


// ========================================
// SESSION
// ========================================

import {
  getCurrentSession,
  initializeSession
} from "./services/session.js";


// ========================================
// ADMIN ACCESS
// ========================================

import {
  getCurrentAdminAccess
} from "./services/adminAccess.js";


// ========================================
// ADMIN
// ========================================

import { Admin } from "./pages/admin.js";
import { AdminStaff } from "./pages/adminStaff.js";


// ========================================
// STATIC ROUTES
// ========================================

const routes = {

  "/":
    Home,

  "/competitions":
    Competitions,

  "/competitions/event":
    CompetitionLanding,

  "/register":
    Register,

  "/register/league":
    CreateLeague,

  "/register/tournament":
    CreateTournament,

  "/dashboard":
    Dashboard,

  "/login":
    Login,

  "/register/team":
    CreateTeam,

  "/register/player":
    CreatePlayer,

  "/teams":
    Teams,

  "/dashboard/tournaments/new":
    TournamentBuilder,

  "/dashboard/tournaments/edit":
    TournamentBuilder,

  "/calendar":
    Calendar,


  // ======================================
  // ADMIN
  // ======================================

  "/dashboard/admin":
    Admin,

  "/dashboard/admin/staff":
    AdminStaff

};


// ========================================
// ADMIN ROUTES
// ========================================

const ADMIN_ROUTES = new Set([

  "/dashboard/admin",
  "/dashboard/admin/staff"

]);


// ========================================
// CLIENT DASHBOARD ROUTES
// ========================================

const CLIENT_DASHBOARD_ROUTES = new Set([

  "/dashboard",
  "/dashboard/tournaments/new",
  "/dashboard/tournaments/edit"

]);


// ========================================
// RESOLVE ROUTE
// ========================================

function resolveRoute(path) {

  /*
   * Primero intentamos una ruta exacta.
   *
   * Esto es importante porque:
   *
   * /competitions/event
   *
   * debe seguir entrando a CompetitionLanding
   * y no ser interpretada como:
   *
   * /competitions/{id}
   */

  if (routes[path]) {

    return routes[path];

  }


  // ========================================
  // COMPETITION DETAIL
  // ========================================

  const segments =
    path
      .split("/")
      .filter(Boolean);


  if (
    segments.length === 2 &&
    segments[0] === "competitions"
  ) {

    return CompetitionDetail;

  }


  // ========================================
  // FALLBACK
  // ========================================

  return Home;

}


// ========================================
// ADMIN ROLE
// ========================================

function isAdministrativeAccess(
  adminAccess
) {

  if (!adminAccess) {

    return false;

  }


  return (
    adminAccess.roleId ===
      "administrator" ||
    adminAccess.roleId ===
      "agent"
  );

}


// ========================================
// ROUTE GUARD
// ========================================

async function resolveProtectedPath(
  path
) {

  // ----------------------------------------
  // SESSION
  // ----------------------------------------

  const session =
    getCurrentSession();


  // ----------------------------------------
  // ADMIN ROUTES
  // ----------------------------------------

  if (
    ADMIN_ROUTES.has(path)
  ) {

    /*
     * Las rutas administrativas requieren
     * una sesión autenticada.
     */

    if (!session) {

      console.warn(
        "NEXUS — Ruta administrativa sin sesión."
      );


      return "/login";

    }


    /*
     * Utilizamos el servicio central de
     * acceso administrativo.
     *
     * No duplicamos la lectura de
     * adminUsers/{uid} aquí.
     */

    const adminAccess =
      await getCurrentAdminAccess();


    if (
      !isAdministrativeAccess(
        adminAccess
      )
    ) {

      console.warn(
        "NEXUS — Acceso administrativo rechazado."
      );


      return "/dashboard";

    }


    /*
     * Usuario administrativo autorizado.
     */

    return path;

  }


  // ----------------------------------------
  // CLIENT DASHBOARD
  // ----------------------------------------

  if (
    CLIENT_DASHBOARD_ROUTES.has(path)
  ) {

    /*
     * El dashboard cliente también requiere
     * una sesión.
     */

    if (!session) {

      console.warn(
        "NEXUS — Dashboard cliente sin sesión."
      );


      return "/login";

    }


    /*
     * Comprobamos si realmente se trata de
     * una cuenta administrativa.
     */

    const adminAccess =
      await getCurrentAdminAccess();


    if (
      isAdministrativeAccess(
        adminAccess
      )
    ) {

      console.log(
        "NEXUS — Cuenta administrativa detectada. Redirigiendo al Admin Dashboard."
      );


      return "/dashboard/admin";

    }


    /*
     * Usuario cliente.
     */

    return path;

  }


  // ----------------------------------------
  // PUBLIC / NON-PROTECTED
  // ----------------------------------------

  return path;

}


// ========================================
// ROUTER
// ========================================

export function Router(app) {

  let isRendering =
    false;


  async function renderRoute() {

    /*
     * Evitamos renderizados simultáneos
     * provocados por navegaciones rápidas.
     */

    if (isRendering) {

      return;

    }


    isRendering =
      true;


    try {

      const requestedPath =
        window.location.pathname;


      // ====================================
      // ROUTE GUARD
      // ====================================

      const resolvedPath =
        await resolveProtectedPath(
          requestedPath
        );


      // ====================================
      // REDIRECT
      // ====================================

      if (
        resolvedPath !==
        requestedPath
      ) {

        console.log(
          "NEXUS — Redirección protegida:",
          {
            from:
              requestedPath,

            to:
              resolvedPath
          }
        );


        window.history.replaceState(
          {},
          "",
          resolvedPath
        );

      }


      // ====================================
      // PAGE
      // ====================================

      const Page =
        resolveRoute(
          resolvedPath
        );


      // ====================================
      // RENDER
      // ====================================

      app.innerHTML =
        "";


      const page =
        Page();


      app.appendChild(
        page
      );


    } catch (error) {

      console.error(
        "NEXUS — Error resolviendo ruta:",
        error
      );


      /*
       * En caso de error inesperado,
       * mostramos Home en lugar de dejar
       * la aplicación completamente vacía.
       */

      try {

        app.innerHTML =
          "";


        const page =
          Home();


        app.appendChild(
          page
        );

      } catch (fallbackError) {

        console.error(
          "NEXUS — Error renderizando fallback:",
          fallbackError
        );

      }

    } finally {

      isRendering =
        false;

    }

  }


  // ========================================
  // NAVIGATION
  // ========================================

  function navigate(path) {

    window.history.pushState(
      {},
      "",
      path
    );


    renderRoute();

  }


  // ========================================
  // BROWSER NAVIGATION
  // ========================================

  window.addEventListener(
    "popstate",
    renderRoute
  );


  // ========================================
  // INITIAL SESSION
  // ========================================

  initializeSession()
    .then(
      () => {

        renderRoute();

      }
    )
    .catch(
      (error) => {

        console.error(
          "NEXUS — Error inicializando sesión:",
          error
        );


        renderRoute();

      }
    );


  // ========================================
  // RETURN
  // ========================================

  return {

    navigate

  };

}