export function CapacitySelector({
  options = [],
  participationType = "",
  value = "",
  onChange = null
} = {}) {
  const container = document.createElement("div");

  container.className = "capacity-selector";

  container.innerHTML = `
    <label
      class="capacity-selector__label"
      for="nexus-capacity-selector"
    >
      CAPACIDAD
    </label>

    <select
      id="nexus-capacity-selector"
      class="capacity-selector__select"
    >
      <option value="">SELECCIONA UNA CAPACIDAD</option>
    </select>

    <p class="capacity-selector__message"></p>
  `;

  const select = container.querySelector(
    "#nexus-capacity-selector"
  );

  const message = container.querySelector(
    ".capacity-selector__message"
  );

  function getParticipantLabel() {
    switch (participationType) {
      case "Individual":
        return "participantes";

      case "Duo":
        return "duos";

      case "Team":
        return "equipos";

      default:
        return "participantes";
    }
  }

  function renderOptions() {
    select.innerHTML = "";

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = "SELECCIONA UNA CAPACIDAD";
    placeholder.selected = true;

    select.appendChild(placeholder);

    if (!Array.isArray(options) || options.length === 0) {
      select.disabled = true;

      message.textContent =
        "Selecciona una modalidad para ver las capacidades disponibles.";

      return;
    }

    select.disabled = false;

    message.textContent = "";

    const participantLabel = getParticipantLabel();

    options.forEach((capacity) => {
      const option = document.createElement("option");

      option.value = capacity;
      option.textContent = `${capacity} ${participantLabel}`;

      select.appendChild(option);
    });

    if (value && options.includes(Number(value))) {
      select.value = String(value);
    } else {
      value = "";
      select.value = "";
    }
  }

  select.addEventListener("change", (event) => {
    value = Number(event.target.value);

    console.log(
      "NEXUS — Capacidad seleccionada:",
      value
    );

    if (typeof onChange === "function") {
      onChange(value);
    }
  });

  renderOptions();

  return {
    element: container,

    getValue() {
      return select.value
        ? Number(select.value)
        : null;
    },

    setValue(capacity = "") {
      value = capacity;

      if (
        capacity !== "" &&
        options.includes(Number(capacity))
      ) {
        select.value = String(capacity);
      } else {
        value = "";
        select.value = "";
      }
    },

    setOptions(newOptions = []) {
      options = Array.isArray(newOptions)
        ? [...newOptions]
        : [];

      value = "";

      renderOptions();
    },

    setParticipationType(type = "") {
      participationType = type || "";

      renderOptions();
    },

    refresh() {
      renderOptions();
    }
  };
}