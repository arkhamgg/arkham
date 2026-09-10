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
// ========================================
// ROUTES
// ========================================

const routes = {
  "/": Home,
  "/competitions": Competitions,
  "/register": Register,
  "/register/league": CreateLeague,
  "/register/tournament": CreateTournament,
  "/dashboard": Dashboard,
  "/login": Login,
};


// ========================================
// ROUTER
// ========================================

export function Router(app) {

  function renderRoute() {

    const path = window.location.pathname;

    const Page = routes[path] || Home;

    app.innerHTML = "";

    const page = Page();

    app.appendChild(page);
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