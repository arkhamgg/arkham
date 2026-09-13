// ========================================
// NEXUS — Modules Catalog
// ========================================
//
// Los módulos representan áreas funcionales
// de la plataforma.
//
// IMPORTANTE:
// - Un módulo NO representa un producto.
// - Un módulo NO representa un plan.
// - Un módulo NO decide permisos.
// - Las capacidades determinan qué funcionalidad
//   está disponible.
//
// Arquitectura:
//
// COMPONENTE
//      ↓
// CAPACIDAD
//      ↓
// PRODUCTO
//      ↓
// PLAN
//      ↓
// ACCESS ENGINE
//
// MODULES solamente agrupa capacidades para
// facilitar la organización de la interfaz.
//
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
  //
  // Funciones relacionadas con la cuenta
  // y Mi NEXUS.
  //

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
  // CONFIGURATION
  // ======================================
  //
  // Configuración base de competencias.
  //
  // Estas capacidades pueden ser reutilizadas
  // por Tournament y League.
  //

  CONFIGURATION: {

    id:
      "configuration",

    name:
      "Configuración",

    capabilities: [

      CAPABILITIES.GAME_SELECTION,

      CAPABILITIES.COMPETITIVE_MODES,

      CAPABILITIES.PARTICIPATION_SELECTION,

      CAPABILITIES.FORMAT_SELECTION,

      CAPABILITIES.MATCH_SELECTION,

      CAPABILITIES.CAPACITY_SELECTION,

      CAPABILITIES.RULES,

      CAPABILITIES.LOCATION,

      CAPABILITIES.DATE_TIME,

      CAPABILITIES.PRIZE,

      CAPABILITIES.REGISTRATION_COST

    ]

  },


  // ======================================
  // PUBLICATION
  // ======================================
  //
  // Visibilidad pública de las competencias.
  //

  PUBLICATION: {

    id:
      "publication",

    name:
      "Publicación",

    capabilities: [

      CAPABILITIES.PUBLIC_LANDING,

      CAPABILITIES.GLOBAL_CALENDAR

    ]

  },


  // ======================================
  // PARTICIPANTS
  // ======================================
  //
  // Descubrimiento, registro y gestión
  // de participantes.
  //

  PARTICIPANTS: {

    id:
      "participants",

    name:
      "Participantes",

    capabilities: [

      CAPABILITIES.PARTICIPANT_MANAGEMENT,

      CAPABILITIES.NEXUS_PLAYER_SEARCH,

      CAPABILITIES.NEXUS_TEAM_SEARCH,

      CAPABILITIES.PARTICIPATION_REQUESTS

    ]

  },


  // ======================================
  // OPERATION
  // ======================================
  //
  // Operación competitiva.
  //

  OPERATION: {

    id:
      "operation",

    name:
      "Operación",

    capabilities: [

      CAPABILITIES.DYNAMIC_BRACKET,

      CAPABILITIES.CHECK_IN,

      CAPABILITIES.MATCH_MANAGEMENT,

      CAPABILITIES.RESULT_MANAGEMENT

    ]

  },


  // ======================================
  // COMPETITIVE DATA
  // ======================================
  //
  // Información generada a partir de la
  // actividad competitiva.
  //

  COMPETITIVE_DATA: {

    id:
      "competitive-data",

    name:
      "Datos competitivos",

    capabilities: [

      CAPABILITIES.STATISTICS,

      CAPABILITIES.ADVANCED_STATISTICS,

      CAPABILITIES.VERIFIED_TITLES

    ]

  },


  // ======================================
  // LEAGUE
  // ======================================
  //
  // Funciones específicas de la estructura
  // competitiva de una Liga.
  //

  LEAGUE: {

    id:
      "league",

    name:
      "Liga",

    capabilities: [

      CAPABILITIES.SEASON_MANAGEMENT,

      CAPABILITIES.DIVISION_MANAGEMENT,

      CAPABILITIES.MATCHDAY_MANAGEMENT,

      CAPABILITIES.STANDINGS,

      CAPABILITIES.PLAYOFFS

    ]

  },


  // ======================================
  // EXTENSIONS
  // ======================================
  //
  // Capacidades de extensión de la plataforma.
  //

  EXTENSIONS: {

    id:
      "extensions",

    name:
      "Extensiones",

    capabilities: [

      CAPABILITIES.INTEGRATIONS

    ]

  }

};