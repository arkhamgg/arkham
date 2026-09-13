export function DateTimeSelector({
  value = null,
  onChange = null
} = {}) {
  const container = document.createElement("div");

  container.className = "date-time-selector";

  let currentValue = {
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    timezone: "America/Guatemala"
  };

  if (value && typeof value === "object") {
    currentValue = {
      ...currentValue,
      ...value
    };
  }

  container.innerHTML = `
    <div class="date-time-selector__fields">

      <div class="date-time-selector__field">
        <label
          class="date-time-selector__label"
          for="nexus-start-date"
        >
          FECHA DE INICIO
        </label>

        <input
          id="nexus-start-date"
          class="date-time-selector__input"
          type="date"
        />
      </div>

      <div class="date-time-selector__field">
        <label
          class="date-time-selector__label"
          for="nexus-start-time"
        >
          HORA DE INICIO
        </label>

        <input
          id="nexus-start-time"
          class="date-time-selector__input"
          type="time"
        />
      </div>

      <div class="date-time-selector__field">
        <label
          class="date-time-selector__label"
          for="nexus-end-date"
        >
          FECHA DE FINALIZACIÓN
        </label>

        <input
          id="nexus-end-date"
          class="date-time-selector__input"
          type="date"
        />
      </div>

      <div class="date-time-selector__field">
        <label
          class="date-time-selector__label"
          for="nexus-end-time"
        >
          HORA DE FINALIZACIÓN
        </label>

        <input
          id="nexus-end-time"
          class="date-time-selector__input"
          type="time"
        />
      </div>

      <div class="date-time-selector__field date-time-selector__field--timezone">
        <label
          class="date-time-selector__label"
          for="nexus-timezone"
        >
          ZONA HORARIA
        </label>

        <select
          id="nexus-timezone"
          class="date-time-selector__select"
        >
          <option value="America/Guatemala">
            Guatemala (GMT-6)
          </option>
        </select>
      </div>

    </div>

    <p
      class="date-time-selector__message"
      data-date-time-message
    ></p>
  `;

  const startDate = container.querySelector("#nexus-start-date");
  const startTime = container.querySelector("#nexus-start-time");
  const endDate = container.querySelector("#nexus-end-date");
  const endTime = container.querySelector("#nexus-end-time");
  const timezone = container.querySelector("#nexus-timezone");
  const message = container.querySelector("[data-date-time-message]");

  function emitChange() {
    if (typeof onChange === "function") {
      onChange({ ...currentValue });
    }
  }

  function validateDates() {
    if (
      currentValue.startDate &&
      currentValue.endDate &&
      currentValue.endDate < currentValue.startDate
    ) {
      message.textContent =
        "La fecha de finalización no puede ser anterior a la fecha de inicio.";

      return false;
    }

    if (
      currentValue.startDate &&
      currentValue.endDate &&
      currentValue.startDate === currentValue.endDate &&
      currentValue.startTime &&
      currentValue.endTime &&
      currentValue.endTime <= currentValue.startTime
    ) {
      message.textContent =
        "La hora de finalización debe ser posterior a la hora de inicio.";

      return false;
    }

    message.textContent = "";

    return true;
  }

  function updateValue() {
    currentValue.startDate = startDate.value;
    currentValue.startTime = startTime.value;
    currentValue.endDate = endDate.value;
    currentValue.endTime = endTime.value;
    currentValue.timezone = timezone.value;

    validateDates();
    emitChange();
  }

  startDate.addEventListener("change", updateValue);
  startTime.addEventListener("change", updateValue);
  endDate.addEventListener("change", updateValue);
  endTime.addEventListener("change", updateValue);
  timezone.addEventListener("change", updateValue);

  function render() {
    startDate.value = currentValue.startDate || "";
    startTime.value = currentValue.startTime || "";
    endDate.value = currentValue.endDate || "";
    endTime.value = currentValue.endTime || "";
    timezone.value = currentValue.timezone || "America/Guatemala";

    validateDates();
  }

  render();

  return {
    element: container,

    getValue() {
      return {
        ...currentValue
      };
    },

    isValid() {
      return validateDates();
    },

    setValue(newValue = null) {
      currentValue = {
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        timezone: "America/Guatemala",
        ...(newValue || {})
      };

      render();
    },

    refresh() {
      render();
    }
  };
}