// ========================================
// ARKHAM — Competition Configuration
// ========================================

export const COMPETITION_CONFIGURATION_STATUS = Object.freeze({
  SUPPORTED: "supported",
  UNSUPPORTED: "unsupported",
  WARNING: "warning",
  INVALID: "invalid"
});

export const COMPETITION_FORMAT_CAPABILITIES = Object.freeze({
  SINGLE_ELIMINATION: Object.freeze({
    id: "single_elimination",
    status: COMPETITION_CONFIGURATION_STATUS.SUPPORTED,
    engineFormat: "single_elimination"
  }),
  DOUBLE_ELIMINATION: Object.freeze({
    id: "double_elimination",
    status: COMPETITION_CONFIGURATION_STATUS.SUPPORTED,
    engineFormat: "double_elimination"
  }),
  ROUND_ROBIN: Object.freeze({
    id: "round_robin",
    status: COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED,
    engineFormat: null
  }),
  GROUPS: Object.freeze({
    id: "groups",
    status: COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED,
    engineFormat: null
  })
});

/**
 * Capacidades que ARKHAM puede ejecutar actualmente.
 *
 * Estas capacidades describen el motor de ARKHAM.
 * No describen lo que ofrece cada juego.
 */
export const COMPETITION_CAPABILITIES = Object.freeze({
  ENTRIES: Object.freeze({
    id: "entries",
    status: COMPETITION_CONFIGURATION_STATUS.SUPPORTED
  }),

  MATCH_FORMAT_BEST_OF: Object.freeze({
    id: "match_format_best_of",
    status: COMPETITION_CONFIGURATION_STATUS.SUPPORTED
  }),

  MATCH_EXECUTION: Object.freeze({
    id: "match_execution",
    status: COMPETITION_CONFIGURATION_STATUS.SUPPORTED
  }),

  MATCH_RESULTS: Object.freeze({
    id: "match_results",
    status: COMPETITION_CONFIGURATION_STATUS.SUPPORTED
  }),

  ADVANCEMENT: Object.freeze({
    id: "advancement",
    status: COMPETITION_CONFIGURATION_STATUS.SUPPORTED
  }),

  OPERATIONS: Object.freeze({
    id: "operations",
    status: COMPETITION_CONFIGURATION_STATUS.SUPPORTED
  })
});

export const MATCH_FORMAT_TYPES = Object.freeze({
  BEST_OF: "BEST_OF"
});

function normalizeToken(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Convierte la etiqueta de formato proveniente de Firebase
 * en una capacidad general del Competition Engine.
 *
 * Esta capa NO define qué formatos ofrece cada juego.
 * Firebase continúa siendo la fuente de verdad de esas opciones.
 */
export function normalizeCompetitionFormat(format = "") {
  const value = normalizeToken(format);

  if (
    [
      "single elimination",
      "single-elimination",
      "eliminacion",
      "eliminacion directa"
    ].includes(value)
  ) {
    return COMPETITION_FORMAT_CAPABILITIES.SINGLE_ELIMINATION;
  }

  if (
    [
      "double elimination",
      "double-elimination",
      "doble eliminacion",
      "doble eliminacion directa"
    ].includes(value)
  ) {
    return COMPETITION_FORMAT_CAPABILITIES.DOUBLE_ELIMINATION;
  }

  if (
    [
      "round robin",
      "todos contra todos"
    ].includes(value)
  ) {
    return COMPETITION_FORMAT_CAPABILITIES.ROUND_ROBIN;
  }

  if (
    [
      "groups",
      "grupos",
      "group stage",
      "fase de grupos"
    ].includes(value)
  ) {
    return COMPETITION_FORMAT_CAPABILITIES.GROUPS;
  }

  return Object.freeze({
    id: value || "unknown",
    status: COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED,
    engineFormat: null
  });
}

export function getCompetitionFormatCapability(format = "") {
  return normalizeCompetitionFormat(format);
}

/**
 * Normaliza el sistema de partida proveniente del Game Catalog
 * hacia un Match Format universal de ARKHAM.
 *
 * Ejemplos:
 * BO1       -> BEST_OF 1
 * BO3       -> BEST_OF 3
 * BO5       -> BEST_OF 5
 * Best of 7 -> BEST_OF 7
 *
 * El juego continúa definiendo qué opciones ofrece.
 * ARKHAM solamente interpreta el formato que puede ejecutar.
 */
export function normalizeCompetitionMatchFormat(matchSystem = "") {
  const value = normalizeToken(matchSystem);

  const boMatch = value.match(/^bo\s+(\d+)$/);
  const bestOfMatch = value.match(/^best of\s+(\d+)$/);
  const games = Number((boMatch || bestOfMatch)?.[1]);

  if (Number.isInteger(games) && games > 0) {
    return {
      type: MATCH_FORMAT_TYPES.BEST_OF,
      value: games,
      winsNeeded: Math.ceil(games / 2),
      status: COMPETITION_CONFIGURATION_STATUS.SUPPORTED,
      source: matchSystem
    };
  }

  return {
    type: null,
    value: null,
    winsNeeded: null,
    status: COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED,
    source: matchSystem || null
  };
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

/**
 * Valida una configuración competitiva sin introducir reglas específicas
 * de un juego. `availableOption` representa la configuración que Firebase
 * entregó para la modalidad seleccionada.
 */
export function validateCompetitionConfiguration({
  gameId = "",
  competitionOption = "",
  participationType = "",
  format = "",
  matchSystem = "",
  capacity = null,
  availableOption = null
} = {}) {
  const errors = [];
  const warnings = [];

  if (!gameId) errors.push("Falta el juego.");
  if (!competitionOption) errors.push("Falta la modalidad competitiva.");
  if (!format) errors.push("Falta el formato competitivo.");
  if (!matchSystem) errors.push("Falta el sistema de partida.");

  if (
    !hasValue(capacity) ||
    !Number.isFinite(Number(capacity)) ||
    Number(capacity) < 2
  ) {
    errors.push("La capacidad debe ser un valor numérico de al menos 2.");
  }

  if (availableOption) {
    const availableFormats = Array.isArray(availableOption.formats)
      ? availableOption.formats
      : [];

    const availableMatchSystems = Array.isArray(availableOption.matchSystem)
      ? availableOption.matchSystem
      : [];

    const availableCapacities = Array.isArray(availableOption.capacityOptions)
      ? availableOption.capacityOptions
      : [];

    if (format && !availableFormats.includes(format)) {
      errors.push(
        "El formato seleccionado no pertenece a las opciones disponibles para esta modalidad."
      );
    }

    if (matchSystem && !availableMatchSystems.includes(matchSystem)) {
      errors.push(
        "El sistema de partida seleccionado no pertenece a las opciones disponibles para esta modalidad."
      );
    }

    if (
      hasValue(capacity) &&
      availableCapacities.length > 0 &&
      !availableCapacities.some(
        (option) => Number(option) === Number(capacity)
      )
    ) {
      errors.push(
        "La capacidad seleccionada no pertenece a las opciones disponibles para esta modalidad."
      );
    }

    if (
      participationType &&
      availableOption.participationType &&
      participationType !== availableOption.participationType
    ) {
      errors.push(
        "El tipo de participación no coincide con la modalidad configurada."
      );
    }
  }

  const formatCapability = getCompetitionFormatCapability(format);

  let status = COMPETITION_CONFIGURATION_STATUS.SUPPORTED;

  if (errors.length > 0) {
    status = COMPETITION_CONFIGURATION_STATUS.INVALID;
  } else if (
    formatCapability.status === COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED
  ) {
    status = COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED;
  } else if (warnings.length > 0) {
    status = COMPETITION_CONFIGURATION_STATUS.WARNING;
  }

  return {
    status,
    available: errors.length === 0,
    supported:
      formatCapability.status ===
      COMPETITION_CONFIGURATION_STATUS.SUPPORTED,
    warnings,
    errors,
    format: formatCapability,
    engineFormat: formatCapability.engineFormat
  };
}

/**
 * Evalúa si ARKHAM puede ejecutar la combinación completa.
 *
 * Firebase define lo que el juego ofrece.
 * Esta capa define lo que ARKHAM sabe ejecutar actualmente.
 */
export function evaluateCompetitionCompatibility(configuration = {}) {
  const validation = validateCompetitionConfiguration(configuration);

  const matchFormat = normalizeCompetitionMatchFormat(
    configuration.matchSystem
  );

  const errors = [...validation.errors];
  const warnings = [...validation.warnings];

  if (
    validation.errors.length === 0 &&
    matchFormat.status === COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED
  ) {
    errors.push(
      `El sistema de partida "${configuration.matchSystem || "seleccionado"}" no tiene una implementación compatible en el motor competitivo.`
    );
  }

  const capabilities = {
    entries: COMPETITION_CAPABILITIES.ENTRIES.status,
    matchFormatBestOf:
      COMPETITION_CAPABILITIES.MATCH_FORMAT_BEST_OF.status,
    matchExecution: COMPETITION_CAPABILITIES.MATCH_EXECUTION.status,
    matchResults: COMPETITION_CAPABILITIES.MATCH_RESULTS.status,
    advancement: COMPETITION_CAPABILITIES.ADVANCEMENT.status,
    operations: COMPETITION_CAPABILITIES.OPERATIONS.status
  };

  const formatSupported =
    validation.format?.status ===
    COMPETITION_CONFIGURATION_STATUS.SUPPORTED;

  const matchFormatSupported =
    matchFormat.status ===
    COMPETITION_CONFIGURATION_STATUS.SUPPORTED;

  const executionCapabilitiesSupported = [
    capabilities.entries,
    capabilities.matchFormatBestOf,
    capabilities.matchExecution,
    capabilities.matchResults,
    capabilities.advancement,
    capabilities.operations
  ].every(
    (status) =>
      status === COMPETITION_CONFIGURATION_STATUS.SUPPORTED
  );

  let status = COMPETITION_CONFIGURATION_STATUS.SUPPORTED;

  if (errors.length > 0) {
    status = COMPETITION_CONFIGURATION_STATUS.INVALID;
  } else if (
    !formatSupported ||
    !matchFormatSupported ||
    !executionCapabilitiesSupported
  ) {
    status = COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED;
  } else if (warnings.length > 0) {
    status = COMPETITION_CONFIGURATION_STATUS.WARNING;
  }

  return {
    status,

    executable: [
      COMPETITION_CONFIGURATION_STATUS.SUPPORTED,
      COMPETITION_CONFIGURATION_STATUS.WARNING
    ].includes(status),

    available: validation.available,

    supported:
      status !== COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED &&
      status !== COMPETITION_CONFIGURATION_STATUS.INVALID,

    configuration: validation,

    capabilities,

    compatibility: {
      game: Boolean(configuration.gameId),

      competitionOption: Boolean(
        configuration.competitionOption
      ),

      participationType: Boolean(
        configuration.participationType
      ),

      format: formatSupported,

      matchFormat: matchFormatSupported,

      capacity:
        hasValue(configuration.capacity) &&
        Number.isFinite(Number(configuration.capacity)) &&
        Number(configuration.capacity) >= 2,

      structure: formatSupported
    },

    matchFormat,

    warnings,
    errors
  };
}

export function isCompetitionConfigurationExecutable(
  configuration = {}
) {
  return evaluateCompetitionCompatibility(configuration).executable;
}