// ========================================
// ARKHAM — Game Selector
// ========================================

import {
  getGames
} from "../services/gameCatalog.js";


// ========================================
// COMPONENT
// ========================================

export function GameSelector({
  value = "",
  onChange = null
} = {}) {

  const container =
    document.createElement("div");

  container.className =
    "game-selector";


  // ========================================
  // INITIAL STATE
  // ========================================

  container.innerHTML = `

    <label
      class="game-selector__label"
      for="nexus-game-selector"
    >
      JUEGO
    </label>

    <select
      id="nexus-game-selector"
      class="game-selector__select"
    >

      <option value="">
        CARGANDO JUEGOS...
      </option>

    </select>

    <p
      class="game-selector__message"
      aria-live="polite"
    ></p>

  `;


  // ========================================
  // ELEMENTS
  // ========================================

  const select =
    container.querySelector(
      ".game-selector__select"
    );


  const message =
    container.querySelector(
      ".game-selector__message"
    );


  // ========================================
  // LOAD GAMES
  // ========================================

  async function loadGames() {

    try {

      const games =
        await getGames();


      // ================================
      // EMPTY
      // ================================

      if (!games.length) {

        select.innerHTML = `
          <option value="">
            NO HAY JUEGOS DISPONIBLES
          </option>
        `;

        select.disabled = true;

        return;

      }


      // ================================
      // OPTIONS
      // ================================

      select.innerHTML = `

        <option value="">
          SELECCIONA UN JUEGO
        </option>

      `;


      games.forEach(
        game => {

          const option =
            document.createElement(
              "option"
            );

          option.value =
            game.id;

          option.textContent =
            game.name;

          if (
            game.id === value
          ) {

            option.selected =
              true;

          }

          select.appendChild(
            option
          );

        }
      );


      select.disabled =
        false;


    } catch (error) {

      console.error(
        "ARKHAM — Error cargando juegos:",
        error
      );


      select.innerHTML = `
        <option value="">
          ERROR CARGANDO JUEGOS
        </option>
      `;

      select.disabled =
        true;


      message.textContent =
        "No fue posible cargar el catálogo de juegos.";

    }

  }


  // ========================================
  // CHANGE
  // ========================================

  select.addEventListener(
    "change",
    event => {

      const gameId =
        event.target.value;


      if (typeof onChange === "function") {

        onChange(
          gameId
        );

      }

    }
  );


  // ========================================
  // LOAD
  // ========================================

  loadGames();


  // ========================================
  // PUBLIC API
  // ========================================

  return {

    element: container,

    getValue() {

      return select.value;

    },

    setValue(gameId) {

      select.value =
        gameId || "";

    },

    refresh() {

      return loadGames();

    }

  };

}