// ========================================
// ARKHAM — Access Service
// ========================================

import {
  MODULES
} from "./modules.js";


// ========================================
// NORMALIZE CAPABILITIES
// ========================================

function normalizeCapabilities(
  capabilities = []
) {

  return new Set(
    capabilities.filter(Boolean)
  );

}


// ========================================
// CREATE ACCESS CONTEXT
// ========================================

export function createAccessContext(
  capabilities = []
) {

  const capabilitySet =
    normalizeCapabilities(
      capabilities
    );


  return {

    // ====================================
    // HAS CAPABILITY
    // ====================================

    hasCapability(
      capability
    ) {

      return capabilitySet.has(
        capability
      );

    },


    // ====================================
    // HAS ANY CAPABILITY
    // ====================================

    hasAnyCapability(
      capabilitiesToCheck = []
    ) {

      return capabilitiesToCheck.some(
        capability =>
          capabilitySet.has(
            capability
          )
      );

    },


    // ====================================
    // HAS ALL CAPABILITIES
    // ====================================

    hasAllCapabilities(
      capabilitiesToCheck = []
    ) {

      return capabilitiesToCheck.every(
        capability =>
          capabilitySet.has(
            capability
          )
      );

    },


    // ====================================
    // HAS MODULE
    // ====================================

    hasModule(
      moduleId
    ) {

      const module =
        Object.values(MODULES)
          .find(
            currentModule =>
              currentModule.id === moduleId
          );


      if (!module) {

        return false;

      }


      return module.capabilities.some(
        capability =>
          capabilitySet.has(
            capability
          )
      );

    },


    // ====================================
    // GET AVAILABLE MODULES
    // ====================================

    getAvailableModules() {

      return Object.values(MODULES)
        .filter(
          module =>
            module.capabilities.some(
              capability =>
                capabilitySet.has(
                  capability
                )
            )
        );

    },


    // ====================================
    // GET CAPABILITIES
    // ====================================

    getCapabilities() {

      return [
        ...capabilitySet
      ];

    }

  };

}