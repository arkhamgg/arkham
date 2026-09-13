export function CapacityAvailabilitySelector({
  value = null,
  capacity = null,
  onChange = null
} = {}) {
  const container = document.createElement("div");
  container.className = "capacity-availability-selector";

  let currentValue = {
    available: capacity !== null ? Number(capacity) : 0
  };

  if (value && typeof value === "object") {
    currentValue = {
      ...currentValue,
      ...value
    };
  }

  function getCapacity() {
    const numericCapacity = Number(capacity);

    if (!Number.isFinite(numericCapacity) || numericCapacity < 0) {
      return null;
    }

    return numericCapacity;
  }

  function normalizeAvailable(valueToNormalize) {
    const numericValue = Number(valueToNormalize);
    const currentCapacity = getCapacity();

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return 0;
    }

    if (currentCapacity !== null) {
      return Math.min(Math.floor(numericValue), currentCapacity);
    }

    return Math.floor(numericValue);
  }

  function emitChange() {
    currentValue.available = normalizeAvailable(currentValue.available);

    if (typeof onChange === "function") {
      onChange({
        ...currentValue
      });
    }
  }

  function render() {
    const currentCapacity = getCapacity();
    const available = normalizeAvailable(currentValue.available);

    currentValue.available = available;

    container.innerHTML = `
      <div class="capacity-availability-selector__header">
        <div>
          <span class="capacity-availability-selector__eyebrow">
            CAPACIDAD DEL TORNEO
          </span>

          <h3 class="capacity-availability-selector__title">
            Disponibilidad de cupos
          </h3>

          <p class="capacity-availability-selector__description">
            Define cuántos cupos están disponibles actualmente para el torneo.
          </p>
        </div>

        <div class="capacity-availability-selector__capacity">
          <span class="capacity-availability-selector__capacity-value">
            ${currentCapacity !== null ? currentCapacity : "—"}
          </span>

          <span class="capacity-availability-selector__capacity-label">
            ${currentCapacity === 1 ? "participante" : "participantes"}
          </span>
        </div>
      </div>

      <div class="capacity-availability-selector__field">
        <label
          class="capacity-availability-selector__label"
          for="capacity-availability-input"
        >
          CUPOS DISPONIBLES
        </label>

        <input
          id="capacity-availability-input"
          class="capacity-availability-selector__input"
          type="number"
          min="0"
          ${currentCapacity !== null ? `max="${currentCapacity}"` : ""}
          step="1"
          value="${available}"
          ${currentCapacity === null ? "disabled" : ""}
        />

        <span class="capacity-availability-selector__hint">
          ${currentCapacity !== null
            ? `Puedes establecer entre 0 y ${currentCapacity} ${currentCapacity === 1 ? "cupo" : "cupos"}.`
            : "Selecciona primero la capacidad del torneo."
          }
        </span>
      </div>

      <div class="capacity-availability-selector__summary">
        <div class="capacity-availability-selector__summary-item">
          <span class="capacity-availability-selector__summary-label">
            DISPONIBLES
          </span>

          <strong class="capacity-availability-selector__summary-value">
            ${available}
          </strong>
        </div>

        <div class="capacity-availability-selector__summary-divider"></div>

        <div class="capacity-availability-selector__summary-item">
          <span class="capacity-availability-selector__summary-label">
            OCUPADOS
          </span>

          <strong class="capacity-availability-selector__summary-value">
            ${currentCapacity !== null
              ? Math.max(currentCapacity - available, 0)
              : "—"
            }
          </strong>
        </div>

        <div class="capacity-availability-selector__summary-divider"></div>

        <div class="capacity-availability-selector__summary-item">
          <span class="capacity-availability-selector__summary-label">
            TOTAL
          </span>

          <strong class="capacity-availability-selector__summary-value">
            ${currentCapacity !== null ? currentCapacity : "—"}
          </strong>
        </div>
      </div>
    `;

    const input = container.querySelector(
      "#capacity-availability-input"
    );

    if (!input) {
      return;
    }

    input.addEventListener("input", (event) => {
      currentValue.available = normalizeAvailable(event.target.value);

      if (event.target.value !== "") {
        event.target.value = currentValue.available;
      }

      updateSummary();
      emitChange();
    });
  }

  function updateSummary() {
    const currentCapacity = getCapacity();
    const available = normalizeAvailable(currentValue.available);
    const occupied =
      currentCapacity !== null
        ? Math.max(currentCapacity - available, 0)
        : 0;

    currentValue.available = available;

    const availableElement = container.querySelector(
      ".capacity-availability-selector__summary-item:nth-of-type(1) .capacity-availability-selector__summary-value"
    );

    const occupiedElement = container.querySelector(
      ".capacity-availability-selector__summary-item:nth-of-type(2) .capacity-availability-selector__summary-value"
    );

    if (availableElement) {
      availableElement.textContent = available;
    }

    if (occupiedElement) {
      occupiedElement.textContent =
        currentCapacity !== null ? occupied : "—";
    }
  }

  function getValue() {
    return {
      ...currentValue
    };
  }

  function setValue(valueToSet = null) {
    if (valueToSet && typeof valueToSet === "object") {
      currentValue = {
        ...currentValue,
        ...valueToSet
      };
    } else {
      currentValue = {
        available: getCapacity() ?? 0
      };
    }

    currentValue.available = normalizeAvailable(
      currentValue.available
    );

    render();
  }

  function setCapacity(newCapacity = null) {
    capacity = newCapacity;

    currentValue.available = normalizeAvailable(
      currentValue.available
    );

    render();
    emitChange();
  }

  function refresh() {
    render();
  }

  render();

  return {
    element: container,
    getValue,
    setValue,
    setCapacity,
    refresh
  };
}