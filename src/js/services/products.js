// ========================================
// NEXUS — Products Catalog
// ========================================
//
// Los productos representan los tipos de
// entidades/productos competitivos que NEXUS
// puede ofrecer.
//
// IMPORTANTE:
// - Los productos NO conocen los planes.
// - Los productos NO contienen lógica de acceso.
// - Los productos determinan dónde puede
//   utilizarse una capacidad.
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
// PRODUCT IDS
// ========================================

export const PRODUCT_IDS = {

  TOURNAMENT:
    "tournament",

  LEAGUE:
    "league",

  PLAYER:
    "player",

  TEAM:
    "team"

};


// ========================================
// PRODUCT STATUS
// ========================================

export const PRODUCT_STATUS = {

  ACTIVE:
    "active",

  INACTIVE:
    "inactive"

};


// ========================================
// PRODUCTS
// ========================================

export const PRODUCTS = {


  // ======================================
  // TOURNAMENT
  // ======================================

  [PRODUCT_IDS.TOURNAMENT]: {

    id:
      PRODUCT_IDS.TOURNAMENT,

    name:
      "Torneo",

    status:
      PRODUCT_STATUS.ACTIVE

  },


  // ======================================
  // LEAGUE
  // ======================================

  [PRODUCT_IDS.LEAGUE]: {

    id:
      PRODUCT_IDS.LEAGUE,

    name:
      "Liga",

    status:
      PRODUCT_STATUS.ACTIVE

  },


  // ======================================
  // PLAYER
  // ======================================

  [PRODUCT_IDS.PLAYER]: {

    id:
      PRODUCT_IDS.PLAYER,

    name:
      "Jugador",

    status:
      PRODUCT_STATUS.ACTIVE

  },


  // ======================================
  // TEAM
  // ======================================

  [PRODUCT_IDS.TEAM]: {

    id:
      PRODUCT_IDS.TEAM,

    name:
      "Equipo",

    status:
      PRODUCT_STATUS.ACTIVE

  }

};