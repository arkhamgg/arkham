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
// ROUTE RESOLUTION
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
// ROUTER
// ========================================

export function Router(app) {

  function renderRoute() {

    const path =
      window.location.pathname;


    const Page =
      resolveRoute(path);


    app.innerHTML = "";


    const page =
      Page();


    app.appendChild(
      page
    );

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
  // INITIAL RENDER
  // ========================================

  renderRoute();


  return {
    navigate
  };

}