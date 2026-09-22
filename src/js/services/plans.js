// ========================================
// ARKHAM — Plans
// ========================================
//
// Este archivo define únicamente la identidad
// y metadata comercial de los planes.
//
// Las capacidades NO se definen aquí.
//
// La relación:
//
// PLAN × PRODUCTO × CAPACIDAD
//
// vive en:
//
// services/planCapabilities.js
//
// ========================================

export const PLAN_IDS = {
  FREE: "free",
  PRO: "pro",
  CIRCUIT: "circuit",
  ENTERPRISE: "enterprise"
};


// ========================================
// PLAN STATUS
// ========================================

export const PLAN_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive"
};


// ========================================
// PLANS
// ========================================

export const PLANS = {

  [PLAN_IDS.FREE]: {

    id: PLAN_IDS.FREE,

    name: "Free",

    description:
      "Publica y da visibilidad a tus competencias.",

    status:
      PLAN_STATUS.ACTIVE

  },


  [PLAN_IDS.PRO]: {

    id: PLAN_IDS.PRO,

    name: "Pro",

    description:
      "Opera tus competencias y gestiona la experiencia competitiva.",

    status:
      PLAN_STATUS.ACTIVE

  },


  [PLAN_IDS.CIRCUIT]: {

    id: PLAN_IDS.CIRCUIT,

    name: "Circuit",

    description:
      "Gestiona competencias y estructuras competitivas a mayor escala.",

    status:
      PLAN_STATUS.ACTIVE

  },


  [PLAN_IDS.ENTERPRISE]: {

    id: PLAN_IDS.ENTERPRISE,

    name: "Enterprise",

    description:
      "Infraestructura avanzada para organizaciones y operaciones a gran escala.",

    status:
      PLAN_STATUS.ACTIVE

  }

};