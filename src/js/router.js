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
import { Players } from "./pages/players.js";
import {
  PlayerView,
  PlayerCompetitiveProfileView
} from "./pages/player.js";
import { TournamentBuilder } from "./pages/tournamentBuilder.js";
import { TournamentPro } from "./pages/tournamentPro.js";
import { CompetitionLanding } from "./pages/competitionLanding.js";
import { CompetitionDetail } from "./pages/competitionDetail.js";
import { Calendar } from "./pages/calendar.js";
import { Billing } from "./pages/billing.js";
import { Upgrade } from "./pages/upgrade.js";
import { Payment } from "./pages/payment.js";
import { TournamentRecognitions } from "./pages/tournamentRecognitions.js";
import { TeamRoster } from "./pages/teamRoster.js";
import { TeamDivisions } from "./pages/teamDivisions.js";
import { TeamCompetitions } from "./pages/teamCompetitions.js";
import { TeamLanding } from "./pages/teamLanding.js";
import { PublicTeamLanding } from "./pages/publicTeamLanding.js";

import { PublicShell } from "./components/publicShell.js";
import { DashboardShell } from "./components/dashboardShell.js";

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
import { AdminAccounts } from "./pages/adminAccounts.js";
import { AdminProducts } from "./pages/adminProducts.js";
import { AdminPlans } from "./pages/adminPlans.js";
import { AdminCapabilities } from "./pages/adminCapabilities.js";
import { AdminPayments } from "./pages/adminPayments.js";
import { AdminSubscriptions } from "./pages/adminSubscriptions.js";
import { AdminBilling } from "./pages/adminBilling.js";
import { AdminAudit } from "./pages/adminAudit.js";
import { AdminReloads } from "./pages/adminReloads.js";

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

  "/players":
    Players,


  // ======================================
  // PLAYER
  // ======================================

  "/dashboard/player/competitions":
    () =>
      PlayerView({
        view: "competitions"
      }),

  "/dashboard/player/requests":
    () =>
      PlayerView({
        view: "requests"
      }),

  "/dashboard/player/results":
    () =>
      PlayerView({
        view: "results"
      }),

  "/dashboard/player/stats":
    () =>
      PlayerView({
        view: "stats"
      }),

  "/dashboard/player/profile":
    () =>
      PlayerView({
        view: "profile"
      }),

  "/dashboard/player/competitive-profile":
    PlayerCompetitiveProfileView,


  // ======================================
  // TOURNAMENT RECOGNITIONS
  // ======================================

  "/dashboard/tournaments/recognitions":
    TournamentRecognitions,

  // ======================================
  // TEAM
  // ======================================

  "/dashboard/team/roster":
    TeamRoster,

  "/dashboard/team/divisions":
    TeamDivisions,

  "/dashboard/team/landing":
    TeamLanding,

  "/dashboard/team/competitions":
    () => TeamCompetitions({ view: "competitions" }),

  "/dashboard/team/requests":
    () => TeamCompetitions({ view: "requests" }),


  // ======================================
  // TOURNAMENT
  // ======================================

  "/dashboard/tournaments/new":
    TournamentBuilder,

  "/dashboard/tournaments/edit":
    TournamentBuilder,

  "/dashboard/tournaments/pro":
    TournamentPro,


  // ======================================
  // BILLING
  // ======================================

  "/dashboard/billing":
    Billing,

  "/dashboard/billing/upgrade":
    Upgrade,

  "/dashboard/billing/payment":
    Payment,


  // ======================================
  // CALENDAR
  // ======================================

  "/calendar":
    Calendar,


  // ======================================
  // ADMIN
  // ======================================

  "/dashboard/admin":
    Admin,

  "/dashboard/admin/accounts":
    AdminAccounts,

  "/dashboard/admin/products":
    AdminProducts,

  "/dashboard/admin/plans":
    AdminPlans,

  "/dashboard/admin/capabilities":
    AdminCapabilities,

  "/dashboard/admin/staff":
    AdminStaff,

  "/dashboard/admin/payments":
    AdminPayments,

  "/dashboard/admin/subscriptions":
    AdminSubscriptions,

  "/dashboard/admin/billing":
    AdminBilling,

  "/dashboard/admin/audit":
    AdminAudit,

  "/dashboard/admin/reloads":
    AdminReloads

};


// ========================================
// ADMIN ROUTES
// ========================================

const ADMIN_ROUTES = new Set([

  "/dashboard/admin",
  "/dashboard/admin/accounts",
  "/dashboard/admin/products",
  "/dashboard/admin/plans",
  "/dashboard/admin/capabilities",
  "/dashboard/admin/staff",
  "/dashboard/admin/payments",
  "/dashboard/admin/subscriptions",
  "/dashboard/admin/billing",
  "/dashboard/admin/audit",
  "/dashboard/admin/reloads"

]);


// ========================================
// CLIENT DASHBOARD ROUTES
// ========================================

const CLIENT_DASHBOARD_ROUTES = new Set([

  "/dashboard",

  // --------------------------------------
  // PLAYER
  // --------------------------------------

  "/dashboard/player/competitions",
  "/dashboard/player/requests",
  "/dashboard/player/results",
  "/dashboard/player/stats",
  "/dashboard/player/profile",
  "/dashboard/player/competitive-profile",

  // --------------------------------------
  // TOURNAMENT
  // --------------------------------------

  "/dashboard/tournaments/new",
  "/dashboard/tournaments/edit",
  "/dashboard/tournaments/pro",
  "/dashboard/tournaments/recognitions",

  // --------------------------------------
  // TEAM
  // --------------------------------------

  "/dashboard/team/roster",
  "/dashboard/team/divisions",
  "/dashboard/team/landing",
  "/dashboard/team/competitions",
  "/dashboard/team/requests",

  // --------------------------------------
  // BILLING
  // --------------------------------------

  "/dashboard/billing",
  "/dashboard/billing/upgrade",
  "/dashboard/billing/payment"

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
  // TEAM PUBLIC LANDING
  // ========================================

  if (
    segments.length === 2 &&
    segments[0] === "teams"
  ) {

    return PublicTeamLanding;

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


  // ========================================
  // RENDER ROUTE
  // ========================================

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
      // SHELL
      // ====================================

      const isClientDashboardRoute =
        CLIENT_DASHBOARD_ROUTES.has(
          resolvedPath
        );


      const shell =
        isClientDashboardRoute
          ? DashboardShell(Page)
          : PublicShell(Page);


      // ====================================
      // RENDER
      // ====================================

      app.innerHTML =
        "";

      app.appendChild(
        shell
      );


      // ====================================
      // RESET SCROLL POSITION
      // ========================================

      window.scrollTo(
        0,
        0
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
  // BILLING → UPGRADE
  // ========================================

  window.addEventListener(
    "nexus:billing-upgrade",
    () => {

      navigate(
        "/dashboard/billing/upgrade"
      );

    }
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