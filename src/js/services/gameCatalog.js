import { getEntities, getEntity } from "./firestore.js";

const GAMES_COLLECTION = "games";

/**
 * Obtiene todos los juegos activos.
 */
export async function getGames() {
  const games = await getEntities(GAMES_COLLECTION);

  return games
    .filter((game) => game.status === "active")
    .sort((a, b) => {
      const nameA = String(a.name || "").toLowerCase();
      const nameB = String(b.name || "").toLowerCase();

      return nameA.localeCompare(nameB);
    });
}

/**
 * Obtiene un juego específico.
 */
export async function getGame(gameId) {
  if (!gameId) {
    return null;
  }

  return await getEntity(GAMES_COLLECTION, gameId);
}

/**
 * Obtiene las Competition Options de un juego.
 *
 * Firestore:
 *
 * competitionOptions
 * ├── 1v1
 * ├── 2v2
 * ├── 3v3
 * ├── 4v4
 * └── 5v5
 *
 * Cada opción contiene:
 *
 * {
 *   formats: [],
 *   matchSystem: [],
 *   capacityOptions: [],
 *   participationType: ""
 * }
 */
export async function getGameCompetitionOptions(gameId) {
  const game = await getGame(gameId);

  if (!game) {
    return [];
  }

  const competitionOptions = game.competitionOptions;

  if (
    !competitionOptions ||
    typeof competitionOptions !== "object" ||
    Array.isArray(competitionOptions)
  ) {
    return [];
  }

  return Object.entries(competitionOptions).map(([id, option]) => ({
    id,
    ...option
  }));
}

/**
 * Obtiene una Competition Option específica.
 */
export async function getGameCompetitionOption(gameId, optionId) {
  if (!gameId || !optionId) {
    return null;
  }

  const options = await getGameCompetitionOptions(gameId);

  return options.find((option) => option.id === optionId) || null;
}

/**
 * Obtiene el tipo de participación determinado por la Competition Option.
 *
 * Ejemplo:
 *
 * 1v1 → Individual
 * 2v2 → Duo
 * 4v4 → Team
 */
export async function getGameParticipationType(gameId, optionId) {
  const option = await getGameCompetitionOption(gameId, optionId);

  return option?.participationType || "";
}

/**
 * Obtiene los formatos disponibles para una Competition Option.
 */
export async function getGameFormats(gameId, optionId) {
  const option = await getGameCompetitionOption(gameId, optionId);

  if (!option || !Array.isArray(option.formats)) {
    return [];
  }

  return option.formats;
}

/**
 * Obtiene los sistemas de Match disponibles para una Competition Option.
 */
export async function getGameMatchSystems(gameId, optionId) {
  const option = await getGameCompetitionOption(gameId, optionId);

  if (!option || !Array.isArray(option.matchSystem)) {
    return [];
  }

  return option.matchSystem;
}

/**
 * Obtiene las capacidades disponibles para una Competition Option.
 *
 * Ejemplo:
 *
 * 1v1 → [8, 16, 32, 64, 128]
 * 2v2 → [4, 8, 16, 32, 64]
 */
export async function getGameCapacityOptions(gameId, optionId) {
  const option = await getGameCompetitionOption(gameId, optionId);

  if (!option || !Array.isArray(option.capacityOptions)) {
    return [];
  }

  return option.capacityOptions;
}

/**
 * Compatibilidad con componentes existentes.
 *
 * CompetitiveModeSelector actualmente utiliza este nombre.
 *
 * Internamente ya no estamos trabajando con
 * "competitiveModes", sino con "competitionOptions".
 */
export async function getGameCompetitiveModes(gameId) {
  return await getGameCompetitionOptions(gameId);
}