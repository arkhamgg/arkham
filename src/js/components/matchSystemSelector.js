export function MatchSystemSelector({
  systems = [],
  value = "",
  onChange = null
} = {}) {
  const container = document.createElement("div");

  container.className = "match-system-selector";

  container.innerHTML = `
    <label
      class="match-system-selector__label"
      for="arkham-match-system-selector"
    >
      SISTEMA DE PARTIDA
    </label>

    <select
      id="arkham-match-system-selector"
      class="match-system-selector__select"
    >
      <option value="">SELECCIONA UN SISTEMA</option>
    </select>

    <p class="match-system-selector__message"></p>
  `;

  const select = container.querySelector(
    "#arkham-match-system-selector"
  );

  const message = container.querySelector(
    ".match-system-selector__message"
  );

  function renderSystems() {
    select.innerHTML = "";

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = "SELECCIONA UN SISTEMA";
    placeholder.selected = true;

    select.appendChild(placeholder);

    if (!Array.isArray(systems) || systems.length === 0) {
      select.disabled = true;

      message.textContent =
        "Selecciona una modalidad para ver los sistemas disponibles.";

      return;
    }

    select.disabled = false;

    message.textContent = "";

    systems.forEach((system) => {
      const option = document.createElement("option");

      option.value = system;
      option.textContent = system;

      select.appendChild(option);
    });

    if (value && systems.includes(value)) {
      select.value = value;
    } else {
      value = "";
      select.value = "";
    }
  }

  select.addEventListener("change", (event) => {
    value = event.target.value;


    if (typeof onChange === "function") {
      onChange(value);
    }
  });

  renderSystems();

  return {
    element: container,

    getValue() {
      return select.value;
    },

    setValue(system = "") {
      value = system || "";

      if (value && systems.includes(value)) {
        select.value = value;
      } else {
        value = "";
        select.value = "";
      }
    },

    setSystems(newSystems = []) {
      systems = Array.isArray(newSystems)
        ? [...newSystems]
        : [];

      value = "";

      renderSystems();
    },

    refresh() {
      renderSystems();
    }
  };
}