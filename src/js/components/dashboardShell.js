// ========================================
// NEXUS — Dashboard Shell
// ========================================

import {
  DashboardSidebar
} from "./dashboardSidebar.js";

import {
  getCurrentAccountContext
} from "../services/account.js";

import {
  getCurrentEntityContext
} from "../services/entityContext.js";

import {
  createSubscriptionAccess
} from "../services/planService.js";


// ========================================
// ROUTES
// ========================================

const DASHBOARD_NAVIGATION_ROUTES = {
  overview:
    "/dashboard",

  "player-competitions":
    "/dashboard/player/competitions",

  "player-requests":
    "/dashboard/player/requests",

  "player-results":
    "/dashboard/player/results",

  "player-stats":
    "/dashboard/player/stats",

  competitions:
    "/competitions",

  teams:
    "/teams",

  players:
    "/players",

  calendar:
    "/calendar",

  billing:
    "/dashboard/billing",

  "upgrade-plan":
    "/dashboard/billing/upgrade"
};


function getActiveView(pathname) {

  const playerRoutes = {
    "/dashboard/player/competitions": "player-competitions",
    "/dashboard/player/requests": "player-requests",
    "/dashboard/player/results": "player-results",
    "/dashboard/player/stats": "player-stats",
    "/dashboard/player/profile": "profile"
  };

  if (playerRoutes[pathname]) {
    return playerRoutes[pathname];
  }

  if (
    pathname ===
    "/dashboard/billing/upgrade"
  ) {
    return "upgrade-plan";
  }

  if (
    pathname ===
      "/dashboard/billing" ||
    pathname ===
      "/dashboard/billing/payment"
  ) {
    return "billing";
  }

  if (
    pathname ===
    "/dashboard"
  ) {
    return "overview";
  }

  return "overview";

}


function navigate(path) {

  if (
    window.location.pathname ===
    path
  ) {
    return;
  }

  window.history.pushState(
    {},
    "",
    path
  );

  window.dispatchEvent(
    new PopStateEvent("popstate")
  );

}


// ========================================
// SHELL
// ========================================

export function DashboardShell(Page) {

  const shell =
    document.createElement("div");

  shell.className =
    "dashboard-shell";


  // ========================================
  // SIDEBAR
  // ========================================

  const sidebar =
    DashboardSidebar({
      activeView:
        getActiveView(
          window.location.pathname
        ),

      onNavigate: view => {

        const route =
          DASHBOARD_NAVIGATION_ROUTES[
            view
          ];

        if (!route) {
          console.warn(
            "NEXUS — Vista de Dashboard no configurada:",
            view
          );
          return;
        }

        navigate(route);

      }
    });


  shell.appendChild(
    sidebar.element
  );


  // ========================================
  // CONTENT
  // ========================================

  const content =
    document.createElement("div");

  content.className =
    "dashboard-shell__content";


  const page =
    Page({
      dashboardSidebar:
        sidebar
    });

  content.appendChild(
    page
  );

  shell.appendChild(
    content
  );


  // ========================================
  // CONTEXT
  // ========================================

  loadDashboardContext(
    sidebar
  );


  return shell;

}


// ========================================
// CONTEXT
// ========================================

async function loadDashboardContext(
  sidebar
) {

  try {

    const accountContext =
      await getCurrentAccountContext();

    const entityContext =
      await getCurrentEntityContext();


    let access =
      null;


    if (
      accountContext?.subscription?.status ===
        "active" &&
      entityContext?.productId
    ) {

      access =
        createSubscriptionAccess(
          accountContext.subscription,
          entityContext.productId
        );

    }


    if (entityContext) {

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

      return;

    }


    sidebar.setContext({
      type:
        null,
      name:
        "Mi NEXUS",
      accessContext:
        access
    });

  } catch (error) {

    console.error(
      "NEXUS — Error cargando contexto del Dashboard Shell:",
      error
    );

  }

}
