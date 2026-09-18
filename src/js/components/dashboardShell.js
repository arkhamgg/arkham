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

import {
  hasEffectiveSubscriptionAccess
} from "../services/subscription.js";

import {
  getCurrentTeamBilling
} from "../services/billingPayment.js";


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

  profile:
    "/dashboard/player/profile",

  "competitive-profile":
    "/dashboard/player/competitive-profile",

  "tournament-recognitions":
    "/dashboard/tournaments/recognitions",

  "team-roster":
    "/dashboard/team/roster",

  "team-divisions":
    "/dashboard/team/divisions",

  "team-landing":
    "/dashboard/team/landing",

  "team-competitions":
    "/dashboard/team/competitions",

  "team-requests":
    "/dashboard/team/requests",

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


// ========================================
// ACTIVE VIEW
// ========================================

function getActiveView(pathname) {

  const playerRoutes = {
    "/dashboard/player/competitions":
      "player-competitions",

    "/dashboard/player/requests":
      "player-requests",

    "/dashboard/player/results":
      "player-results",

    "/dashboard/player/stats":
      "player-stats",

    "/dashboard/player/profile":
      "profile",

    "/dashboard/player/competitive-profile":
      "competitive-profile"
  };


  if (playerRoutes[pathname]) {
    return playerRoutes[pathname];
  }


  // ========================================
  // TEAM
  // ========================================

  const teamRoutes = {
    "/dashboard/team/roster":
      "team-roster",

    "/dashboard/team/divisions":
      "team-divisions",

    "/dashboard/team/landing":
      "team-landing",

    "/dashboard/team/competitions":
      "team-competitions",

    "/dashboard/team/requests":
      "team-requests"
  };


  if (teamRoutes[pathname]) {
    return teamRoutes[pathname];
  }


  // ========================================
  // TOURNAMENT RECOGNITIONS
  // ========================================

  if (
    pathname ===
    "/dashboard/tournaments/recognitions"
  ) {

    return "tournament-recognitions";

  }


  // ========================================
  // BILLING
  // ========================================

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


  // ========================================
  // OVERVIEW
  // ========================================

  if (
    pathname ===
    "/dashboard"
  ) {

    return "overview";

  }


  return "overview";

}


// ========================================
// NAVIGATION
// ========================================

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

        let route =
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


        // Reconocimientos pertenece a una competencia específica.
        // Conservamos sus identificadores al navegar desde Tournament Pro.
        if (
          view === "tournament-recognitions"
        ) {

          const params =
            new URLSearchParams(
              window.location.search
            );

          const tournamentId =
            params.get("tournamentId");

          const eventId =
            params.get("eventId");

          if (tournamentId && eventId) {

            route = `${route}?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}`;

          }

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


    // Team entitlements are entity-scoped.
    // Do not use the account-level subscription here because an older
    // account can have a different or legacy subscription attached to it.
    if (
      entityContext?.type === "team" &&
      entityContext?.id &&
      entityContext?.productId
    ) {

      const teamBilling =
        await getCurrentTeamBilling(
          entityContext.id
        );

      const teamSubscription =
        teamBilling?.subscription || null;

      access =
        createSubscriptionAccess(
          teamSubscription,
          entityContext.productId
        );

    } else if (
      hasEffectiveSubscriptionAccess(
        accountContext?.subscription
      ) &&
      entityContext?.productId
    ) {

      access =
        createSubscriptionAccess(
          accountContext.subscription,
          entityContext.productId
        );

    } else if (entityContext?.productId) {

      access =
        createSubscriptionAccess(
          accountContext?.subscription || null,
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