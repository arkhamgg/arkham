// ========================================
// NEXUS — Plan × Product × Capability
// ========================================
//
// Define qué capacidades recibe cada PLAN
// dentro de cada PRODUCTO.
//
// IMPORTANTE:
//
// - capabilities.js define qué funcionalidades existen.
// - products.js define qué productos existen.
// - productCapabilities.js define qué capacidades
//   pueden utilizarse en cada producto.
// - ESTE ARCHIVO define qué capacidades están
//   incluidas según el plan.
//
// No contiene lógica de UI.
// No contiene lógica de componentes.
// No contiene lógica específica de usuarios.
//
// Arquitectura:
//
// CAPABILITY
//      ↓
// PRODUCT
//      ↓
// PLAN
//      ↓
// ACCESS
//
// ========================================

import {
  CAPABILITIES
} from "./capabilities.js";

import {
  PRODUCT_IDS
} from "./products.js";

import {
  PLAN_IDS
} from "./plans.js";


// ========================================
// SHARED TOURNAMENT / LEAGUE CONFIGURATION
// ========================================
//
// FREE puede definir y publicar la información
// completa de la competencia.
//
// FREE NO opera la competencia.
//

const PUBLICATION_CAPABILITIES = [

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

  CAPABILITIES.REGISTRATION_COST,

  CAPABILITIES.PUBLIC_LANDING,

  CAPABILITIES.GLOBAL_CALENDAR

];


// ========================================
// TOURNAMENT OPERATION
// ========================================
//
// Capacidades que convierten un torneo
// publicado en una competencia operable.
//

const TOURNAMENT_OPERATION_CAPABILITIES = [

  CAPABILITIES.PUBLIC_REGISTRATION,

  CAPABILITIES.BENEFITS,
  CAPABILITIES.SUPPORT_CONTACT,
  CAPABILITIES.SOCIAL_LINKS,
  CAPABILITIES.REGISTRATION_DEADLINE,

  CAPABILITIES.PARTICIPANT_MANAGEMENT,

  CAPABILITIES.NEXUS_PLAYER_SEARCH,

  CAPABILITIES.NEXUS_TEAM_SEARCH,

  CAPABILITIES.PARTICIPATION_REQUESTS,
  CAPABILITIES.MANUAL_PARTICIPANTS,

  CAPABILITIES.DYNAMIC_BRACKET,

  CAPABILITIES.CHECK_IN,

  CAPABILITIES.MATCH_MANAGEMENT,

  CAPABILITIES.RESULT_MANAGEMENT,

  CAPABILITIES.RECOGNITION,

  CAPABILITIES.TOURNAMENT_CONTROL,

  CAPABILITIES.STATISTICS,

  CAPABILITIES.VERIFIED_TITLES

];


// ========================================
// LEAGUE OPERATION
// ========================================
//
// Capacidades que permiten operar la estructura
// completa de una Liga.
//

const LEAGUE_OPERATION_CAPABILITIES = [

  CAPABILITIES.PARTICIPANT_MANAGEMENT,

  CAPABILITIES.NEXUS_PLAYER_SEARCH,

  CAPABILITIES.NEXUS_TEAM_SEARCH,

  CAPABILITIES.PARTICIPATION_REQUESTS,
  CAPABILITIES.DYNAMIC_BRACKET,

  CAPABILITIES.CHECK_IN,

  CAPABILITIES.MATCH_MANAGEMENT,

  CAPABILITIES.RESULT_MANAGEMENT,

  CAPABILITIES.STATISTICS,

  CAPABILITIES.VERIFIED_TITLES,

  CAPABILITIES.SEASON_MANAGEMENT,

  CAPABILITIES.DIVISION_MANAGEMENT,

  CAPABILITIES.MATCHDAY_MANAGEMENT,

  CAPABILITIES.STANDINGS,

  CAPABILITIES.PLAYOFFS

];


// ========================================
// PLAN × PRODUCT × CAPABILITY
// ========================================

export const PLAN_CAPABILITIES = {


  // ======================================
  // FREE
  // ======================================

  [PLAN_IDS.FREE]: {


    // ====================================
    // TOURNAMENT
    // ====================================

    [PRODUCT_IDS.TOURNAMENT]: [

      ...PUBLICATION_CAPABILITIES

    ],


    // ====================================
    // LEAGUE
    // ====================================

    [PRODUCT_IDS.LEAGUE]: [

      ...PUBLICATION_CAPABILITIES

    ],

    [PRODUCT_IDS.TEAM]: []

  },


  // ======================================
  // PRO
  // ======================================

  [PLAN_IDS.PRO]: {


    // ====================================
    // TOURNAMENT
    // ====================================

    [PRODUCT_IDS.TOURNAMENT]: [

      ...PUBLICATION_CAPABILITIES,

      ...TOURNAMENT_OPERATION_CAPABILITIES

    ],


    // ====================================
    // LEAGUE
    // ====================================

    [PRODUCT_IDS.LEAGUE]: [

      ...PUBLICATION_CAPABILITIES,

      ...LEAGUE_OPERATION_CAPABILITIES

    ],

    [PRODUCT_IDS.TEAM]: [

      CAPABILITIES.PUBLIC_LANDING

    ]

  },


  // ======================================
  // CIRCUIT
  // ======================================
  //
  // En V1 Circuit hereda las capacidades
  // operativas de Pro.
  //
  // Las capacidades específicas de ecosistema
  // se incorporarán cuando definamos formalmente
  // el modelo funcional de Circuit.
  //

  [PLAN_IDS.CIRCUIT]: {


    // ====================================
    // TOURNAMENT
    // ====================================

    [PRODUCT_IDS.TOURNAMENT]: [

      ...PUBLICATION_CAPABILITIES,

      ...TOURNAMENT_OPERATION_CAPABILITIES

    ],


    // ====================================
    // LEAGUE
    // ====================================

    [PRODUCT_IDS.LEAGUE]: [

      ...PUBLICATION_CAPABILITIES,

      ...LEAGUE_OPERATION_CAPABILITIES

    ],

    [PRODUCT_IDS.TEAM]: [

      CAPABILITIES.PUBLIC_LANDING

    ]

  }

};