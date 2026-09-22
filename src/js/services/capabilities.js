// ========================================
// ARKHAM — Capabilities Catalog
// ========================================
//
// Las capacidades representan funcionalidades
// que existen dentro de la plataforma.
//
// IMPORTANTE:
//
// - Las capacidades NO conocen los planes.
// - Las capacidades NO deciden permisos.
// - Los productos determinan dónde pueden utilizarse.
// - Los planes determinan qué capacidades recibe
//   cada nivel.
// - El Access Engine determina el acceso efectivo.
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
// CUENTA / USUARIO
//
// ========================================


// ========================================
// CAPABILITIES
// ========================================

export const CAPABILITIES = {


  // ======================================
  // ACCOUNT
  // ======================================
  //
  // Capacidades relacionadas con la cuenta
  // y el espacio "Mi ARKHAM".
  //
  // Estas capacidades permanecen separadas
  // de las capacidades competitivas.
  //

  ACCOUNT_PROFILE_VIEW:

    "account.profile.view",

  ACCOUNT_PROFILE_EDIT:

    "account.profile.edit",

  ACCOUNT_SECURITY_MANAGE:

    "account.security.manage",

  ACCOUNT_NOTIFICATIONS_VIEW:

    "account.notifications.view",

  ACCOUNT_SETTINGS_MANAGE:

    "account.settings.manage",

  ACCOUNT_ENTITIES_MANAGE:

    "account.entities.manage",


  // ======================================
  // COMPETITION CONFIGURATION
  // ======================================
  //
  // Capacidades utilizadas para configurar
  // una competencia.
  //

  GAME_SELECTION:

    "game_selection",

  COMPETITIVE_MODES:

    "competitive_modes",

  PARTICIPATION_SELECTION:

    "participation_selection",

  FORMAT_SELECTION:

    "format_selection",

  MATCH_SELECTION:

    "match_selection",

  CAPACITY_SELECTION:

    "capacity_selection",

  RULES:

    "rules",

  LOCATION:

    "location",

  DATE_TIME:

    "date_time",

  PRIZE:

    "prize",

  REGISTRATION_COST:

    "registration_cost",

  BENEFITS:

    "benefits",

  SUPPORT_CONTACT:

    "support_contact",

  SOCIAL_LINKS:

    "social_links",

  REGISTRATION_DEADLINE:

    "registration_deadline",


  // ======================================
  // PUBLICATION
  // ======================================
  //
  // Capacidades relacionadas con la
  // publicación y visibilidad pública.
  //

  PUBLIC_LANDING:

    "public_landing",

  GLOBAL_CALENDAR:

    "global_calendar",

  PUBLIC_REGISTRATION:

    "public_registration",


  // ======================================
  // PARTICIPANTS
  // ======================================
  //
  // Gestión y descubrimiento de participantes.
  //

  PARTICIPANT_MANAGEMENT:

    "participant_management",

  NEXUS_PLAYER_SEARCH:

    "nexus_player_search",

  NEXUS_TEAM_SEARCH:

    "nexus_team_search",

  PARTICIPATION_REQUESTS:

    "participation_requests",

  MANUAL_PARTICIPANTS:

    "manual_participants",


  // ======================================
  // COMPETITION OPERATION
  // ======================================
  //
  // Capacidades necesarias para operar
  // una competencia.
  //

  DYNAMIC_BRACKET:

    "dynamic_bracket",

  CHECK_IN:

    "check_in",

  MATCH_MANAGEMENT:

    "match_management",

  RESULT_MANAGEMENT:

    "result_management",

  RECOGNITION:

    "recognition",

  TOURNAMENT_CONTROL:

    "tournament_control",


  // ======================================
  // COMPETITIVE DATA
  // ======================================
  //
  // Resultados, estadísticas y reconocimiento.
  //

  STATISTICS:

    "statistics",

  ADVANCED_STATISTICS:

    "advanced_statistics",

  VERIFIED_TITLES:

    "verified_titles",


  // ======================================
  // EXTENSIONS
  // ======================================
  //
  // Integraciones y extensiones de plataforma.
  //

  INTEGRATIONS:

    "integrations",


  // ======================================
  // LEAGUE
  // ======================================
  //
  // Capacidades específicas de la estructura
  // competitiva de una Liga.
  //

  SEASON_MANAGEMENT:

    "season_management",

  DIVISION_MANAGEMENT:

    "division_management",

  MATCHDAY_MANAGEMENT:

    "matchday_management",

  STANDINGS:

    "standings",

  PLAYOFFS:

    "playoffs"

};