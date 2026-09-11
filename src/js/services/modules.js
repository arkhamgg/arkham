// ========================================
// NEXUS — Modules Catalog
// ========================================

import {
  CAPABILITIES
} from "./capabilities.js";


// ========================================
// MODULES
// ========================================

export const MODULES = {

  // ======================================
  // ACCOUNT
  // ======================================

  ACCOUNT: {

    id:
      "account",

    name:
      "Cuenta",

    capabilities: [

      CAPABILITIES.ACCOUNT_PROFILE_VIEW,
      CAPABILITIES.ACCOUNT_PROFILE_EDIT,

      CAPABILITIES.ACCOUNT_SECURITY_MANAGE,

      CAPABILITIES.ACCOUNT_NOTIFICATIONS_VIEW,

      CAPABILITIES.ACCOUNT_SETTINGS_MANAGE,

      CAPABILITIES.ACCOUNT_ENTITIES_MANAGE

    ]

  },


  // ======================================
  // ENTITY
  // ======================================

  ENTITY: {

    id:
      "entity",

    name:
      "Entidad",

    capabilities: [

      CAPABILITIES.ENTITY_VIEW,
      CAPABILITIES.ENTITY_EDIT

    ]

  },


  // ======================================
  // TEAM
  // ======================================

  TEAM: {

    id:
      "team",

    name:
      "Equipo",

    capabilities: [

      CAPABILITIES.TEAM_VIEW,
      CAPABILITIES.TEAM_EDIT,

      CAPABILITIES.TEAM_ROSTER_VIEW,
      CAPABILITIES.TEAM_ROSTER_MANAGE

    ]

  },


  // ======================================
  // PLAYER
  // ======================================

  PLAYER: {

    id:
      "player",

    name:
      "Jugador",

    capabilities: [

      CAPABILITIES.PLAYER_VIEW,
      CAPABILITIES.PLAYER_EDIT

    ]

  },


  // ======================================
  // TOURNAMENT
  // ======================================

  TOURNAMENT: {

    id:
      "tournament",

    name:
      "Torneo",

    capabilities: [

      CAPABILITIES.TOURNAMENT_VIEW,
      CAPABILITIES.TOURNAMENT_CREATE,
      CAPABILITIES.TOURNAMENT_EDIT,
      CAPABILITIES.TOURNAMENT_MANAGE,

      CAPABILITIES.TOURNAMENT_PARTICIPANTS_MANAGE,
      CAPABILITIES.TOURNAMENT_ROSTER_MANAGE,

      CAPABILITIES.TOURNAMENT_SEEDING_MANAGE,
      CAPABILITIES.TOURNAMENT_BRACKET_MANAGE,

      CAPABILITIES.TOURNAMENT_CHECKIN_MANAGE

    ]

  },


  // ======================================
  // LEAGUE
  // ======================================

  LEAGUE: {

    id:
      "league",

    name:
      "Liga",

    capabilities: [

      CAPABILITIES.LEAGUE_VIEW,
      CAPABILITIES.LEAGUE_CREATE,
      CAPABILITIES.LEAGUE_EDIT,
      CAPABILITIES.LEAGUE_MANAGE,

      CAPABILITIES.LEAGUE_SEASON_MANAGE,
      CAPABILITIES.LEAGUE_DIVISION_MANAGE,
      CAPABILITIES.LEAGUE_MATCHDAY_MANAGE,

      CAPABILITIES.LEAGUE_STANDINGS_MANAGE,
      CAPABILITIES.LEAGUE_PLAYOFFS_MANAGE

    ]

  },


  // ======================================
  // MATCHES
  // ======================================

  MATCHES: {

    id:
      "matches",

    name:
      "Partidas",

    capabilities: [

      CAPABILITIES.MATCH_VIEW,
      CAPABILITIES.MATCH_MANAGE,

      CAPABILITIES.MATCH_RESULT_MANAGE,
      CAPABILITIES.MATCH_EVIDENCE_MANAGE

    ]

  },


  // ======================================
  // STATISTICS
  // ======================================

  STATISTICS: {

    id:
      "statistics",

    name:
      "Estadísticas",

    capabilities: [

      CAPABILITIES.STATISTICS_VIEW,
      CAPABILITIES.STATISTICS_ADVANCED_VIEW,
      CAPABILITIES.ANALYTICS_VIEW

    ]

  },


  // ======================================
  // CUSTOMIZATION
  // ======================================

  CUSTOMIZATION: {

    id:
      "customization",

    name:
      "Personalización",

    capabilities: [

      CAPABILITIES.CUSTOM_BRANDING

    ]

  },


  // ======================================
  // INTEGRATIONS
  // ======================================

  INTEGRATIONS: {

    id:
      "integrations",

    name:
      "Integraciones",

    capabilities: [

      CAPABILITIES.INTEGRATIONS_VIEW,
      CAPABILITIES.INTEGRATIONS_MANAGE

    ]

  }

};