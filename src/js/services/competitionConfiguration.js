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
  if (!hasValue(capacity) || !Number.isFinite(Number(capacity)) || Number(capacity) < 2) {
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
      errors.push("El formato seleccionado no pertenece a las opciones disponibles para esta modalidad.");
    }

    if (matchSystem && !availableMatchSystems.includes(matchSystem)) {
      errors.push("El sistema de partida seleccionado no pertenece a las opciones disponibles para esta modalidad.");
    }

    if (
      hasValue(capacity) &&
      availableCapacities.length > 0 &&
      !availableCapacities.some((option) => Number(option) === Number(capacity))
    ) {
      errors.push("La capacidad seleccionada no pertenece a las opciones disponibles para esta modalidad.");
    }

    if (
      participationType &&
      availableOption.participationType &&
      participationType !== availableOption.participationType
    ) {
      errors.push("El tipo de participación no coincide con la modalidad configurada.");
    }
  }

  const formatCapability = getCompetitionFormatCapability(format);

  let status = COMPETITION_CONFIGURATION_STATUS.SUPPORTED;

  if (errors.length > 0) {
    status = COMPETITION_CONFIGURATION_STATUS.INVALID;
  } else if (formatCapability.status === COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED) {
    status = COMPETITION_CONFIGURATION_STATUS.UNSUPPORTED;
  } else if (warnings.length > 0) {
    status = COMPETITION_CONFIGURATION_STATUS.WARNING;
  }

  return {
    status,
    available: errors.length === 0,
    supported: formatCapability.status === COMPETITION_CONFIGURATION_STATUS.SUPPORTED,
    warnings,
    errors,
    format: formatCapability,
    engineFormat: formatCapability.engineFormat
  };
}

export function isCompetitionConfigurationExecutable(configuration = {}) {
  const validation = validateCompetitionConfiguration(configuration);
  return [
    COMPETITION_CONFIGURATION_STATUS.SUPPORTED,
    COMPETITION_CONFIGURATION_STATUS.WARNING
  ].includes(validation.status);
}
