// ========================================
// ARKHAM — Competitive Mode Selector
// ========================================

import {
  getGameCompetitiveModes
} from "../services/gameCatalog.js";


// ========================================
// COMPONENT
// ========================================

export function CompetitiveModeSelector({
  gameId = "",
  value = "",
  onChange = null
} = {}) {

  const container =
    document.createElement("div");

  container.className =
    "competitive-mode-selector";


  // ========================================
  // STRUCTURE
  // ========================================

  container.innerHTML = `

    <label
      class="competitive-mode-selector__label"
      for="nexus-competitive-mode-selector"
    >
      MODALIDAD
    </label>

    <select
      id="nexus-competitive-mode-selector"
      class="competitive-mode-selector__select"
      disabled
    >

      <option value="">
        SELECCIONA UNA MODALIDAD
      </option>

    </select>

    <p
      class="competitive-mode-selector__message"
      aria-live="polite"
    ></p>

  `;


  // ========================================
  // ELEMENTS
  // ========================================

  const select =
    container.querySelector(
      ".competitive-mode-selector__select"
    );


  const message =
    container.querySelector(
      ".competitive-mode-selector__message"
    );


  // ========================================
  // STATE
  // ========================================

  let currentGameId =
    gameId;

  let currentModes =
    [];


  // ========================================
  // LOAD MODES
  // ========================================

  async function loadModes(
    selectedGameId = currentGameId
  ) {

    currentGameId =
      selectedGameId;

    currentModes =
      [];


    select.disabled =
      true;


    message.textContent =
      "";


    // ======================================
    // NO GAME
    // ======================================

    if (!selectedGameId) {

      select.innerHTML = `
        <option value="">
          SELECCIONA UN JUEGO PRIMERO
        </option>
      `;

      return;

    }


    select.innerHTML = `
      <option value="">
        CARGANDO MODALIDADES...
      </option>
    `;


    try {

      const modes =
        await getGameCompetitiveModes(
          selectedGameId
        );


      currentModes =
        modes;


      // ====================================
      // NO MODES
      // ====================================

      if (!modes.length) {

        select.innerHTML = `
          <option value="">
            NO HAY MODALIDADES DISPONIBLES
          </option>
        `;

        message.textContent =
          "Este juego todavía no tiene modalidades configuradas.";

        return;

      }


      // ====================================
      // BUILD OPTIONS
      // ====================================

      select.innerHTML = `
        <option value="">
          SELECCIONA UNA MODALIDAD
        </option>
      `;


      modes.forEach(
        (mode) => {

          const option =
            document.createElement(
              "option"
            );


          option.value =
            mode.id;


          option.textContent =
            mode.id;


          if (
            mode.id === value
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
        "ARKHAM — Error cargando modalidades:",
        error
      );


      select.innerHTML = `
        <option value="">
          ERROR CARGANDO MODALIDADES
        </option>
      `;


      message.textContent =
        "No fue posible cargar las modalidades.";

    }

  }


  // ========================================
  // CHANGE
  // ========================================

  select.addEventListener(
    "change",
    (event) => {

      const modeId =
        event.target.value;


      const mode =
        currentModes.find(
          (item) =>
            item.id === modeId
        ) || null;


      if (
        typeof onChange === "function"
      ) {

        onChange(
          mode
        );

      }

    }
  );


  // ========================================
  // INITIAL LOAD
  // ========================================

  loadModes();


  // ========================================
  // PUBLIC API
  // ========================================

  return {

    element:
      container,


    getValue() {

      return select.value;

    },


    getSelectedMode() {

      return (
        currentModes.find(
          (mode) =>
            mode.id === select.value
        ) || null
      );

    },


    setValue(modeId) {

      select.value =
        modeId || "";

    },


    setGame(gameId) {

      return loadModes(
        gameId
      );

    },


    refresh() {

      return loadModes(
        currentGameId
      );

    }

  };

}