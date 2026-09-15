// ========================================
// NEXUS — Capability Status
// ========================================
//
// Define el estado global de las capacidades
// dentro de la plataforma.
//
// IMPORTANTE:
//
// - No conoce los planes.
// - No conoce los productos.
// - No gestiona usuarios.
// - No ejecuta permisos.
// - No contiene lógica de componentes.
//
// Su única responsabilidad es definir si una
// capacidad está globalmente activa o inactiva.
//
// Arquitectura:
//
// CAPABILITY
//      ↓
// GLOBAL STATUS
//      ↓
// ACCESS ENGINE
//
// ========================================


import {
  CAPABILITIES
} from "./capabilities.js";


// ========================================
// CAPABILITY STATUS
// ========================================

export const CAPABILITY_STATUS = {

  ACTIVE:
    "active",

  INACTIVE:
    "inactive"

};


// ========================================
// CAPABILITY GLOBAL STATUS
// ========================================
//
// V1:
//
// Todas las capacidades actualmente
// registradas comienzan activas.
//
// Posteriormente este estado podrá ser
// administrado desde NEXUS Admin.
//
// ========================================

export const CAPABILITY_GLOBAL_STATUS = {

  // ======================================
  // ACCOUNT
  // ======================================

  [CAPABILITIES.ACCOUNT_PROFILE_VIEW]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.ACCOUNT_PROFILE_EDIT]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.ACCOUNT_SECURITY_MANAGE]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.ACCOUNT_NOTIFICATIONS_VIEW]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.ACCOUNT_SETTINGS_MANAGE]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.ACCOUNT_ENTITIES_MANAGE]:
    CAPABILITY_STATUS.ACTIVE,


  // ======================================
  // COMPETITION CONFIGURATION
  // ======================================

  [CAPABILITIES.GAME_SELECTION]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.COMPETITIVE_MODES]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.PARTICIPATION_SELECTION]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.FORMAT_SELECTION]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.MATCH_SELECTION]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.CAPACITY_SELECTION]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.RULES]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.LOCATION]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.DATE_TIME]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.PRIZE]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.REGISTRATION_COST]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.BENEFITS]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.SUPPORT_CONTACT]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.SOCIAL_LINKS]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.REGISTRATION_DEADLINE]:
    CAPABILITY_STATUS.ACTIVE,


  // ======================================
  // PUBLICATION
  // ======================================

  [CAPABILITIES.PUBLIC_LANDING]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.GLOBAL_CALENDAR]:
    CAPABILITY_STATUS.ACTIVE,


  // ======================================
  // PARTICIPANTS
  // ======================================

  [CAPABILITIES.PARTICIPANT_MANAGEMENT]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.NEXUS_PLAYER_SEARCH]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.NEXUS_TEAM_SEARCH]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.PARTICIPATION_REQUESTS]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.MANUAL_PARTICIPANTS]:
    CAPABILITY_STATUS.ACTIVE,


  // ======================================
  // COMPETITION OPERATION
  // ======================================

  [CAPABILITIES.DYNAMIC_BRACKET]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.CHECK_IN]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.MATCH_MANAGEMENT]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.RESULT_MANAGEMENT]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.RECOGNITION]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.TOURNAMENT_CONTROL]:
    CAPABILITY_STATUS.ACTIVE,


  // ======================================
  // COMPETITIVE DATA
  // ======================================

  [CAPABILITIES.STATISTICS]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.ADVANCED_STATISTICS]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.VERIFIED_TITLES]:
    CAPABILITY_STATUS.ACTIVE,


  // ======================================
  // EXTENSIONS
  // ======================================

  [CAPABILITIES.INTEGRATIONS]:
    CAPABILITY_STATUS.ACTIVE,


  // ======================================
  // LEAGUE
  // ======================================

  [CAPABILITIES.SEASON_MANAGEMENT]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.DIVISION_MANAGEMENT]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.MATCHDAY_MANAGEMENT]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.STANDINGS]:
    CAPABILITY_STATUS.ACTIVE,

  [CAPABILITIES.PLAYOFFS]:
    CAPABILITY_STATUS.ACTIVE

};