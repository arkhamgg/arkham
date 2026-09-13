export function LocationSelector({
  value = null,
  onChange = null
} = {}) {
  const container = document.createElement("div");

  container.className = "location-selector";

  let currentValue = {
    type: "online",
    platform: "",
    url: "",
    venue: "",
    address: "",
    city: "",
    instructions: ""
  };

  if (value && typeof value === "object") {
    currentValue = {
      ...currentValue,
      ...value
    };
  }

  container.innerHTML = `
    <div class="location-selector__type">

      <label
        class="location-selector__label"
        for="nexus-location-type"
      >
        TIPO DE COMPETICIÓN
      </label>

      <select
        id="nexus-location-type"
        class="location-selector__select"
      >
        <option value="online">ONLINE</option>
        <option value="presencial">PRESENCIAL</option>
      </select>

    </div>

    <div
      class="location-selector__content"
      data-location-content
    ></div>
  `;

  const typeSelect = container.querySelector(
    "#nexus-location-type"
  );

  const content = container.querySelector(
    "[data-location-content]"
  );

  function emitChange() {
    if (typeof onChange === "function") {
      onChange({
        ...currentValue
      });
    }
  }

  function renderContent() {
    if (currentValue.type === "presencial") {
      content.innerHTML = `
        <div class="location-selector__fields">

          <div class="location-selector__field">
            <label
              class="location-selector__label"
              for="nexus-location-venue"
            >
              LUGAR
            </label>

            <input
              id="nexus-location-venue"
              class="location-selector__input"
              type="text"
              placeholder="Nombre del lugar"
            />
          </div>

          <div class="location-selector__field">
            <label
              class="location-selector__label"
              for="nexus-location-address"
            >
              DIRECCIÓN
            </label>

            <input
              id="nexus-location-address"
              class="location-selector__input"
              type="text"
              placeholder="Dirección del evento"
            />
          </div>

          <div class="location-selector__field">
            <label
              class="location-selector__label"
              for="nexus-location-city"
            >
              CIUDAD
            </label>

            <input
              id="nexus-location-city"
              class="location-selector__input"
              type="text"
              placeholder="Ciudad"
            />
          </div>

          <div class="location-selector__field">
            <label
              class="location-selector__label"
              for="nexus-location-instructions"
            >
              INDICACIONES
            </label>

            <textarea
              id="nexus-location-instructions"
              class="location-selector__textarea"
              rows="3"
              placeholder="Información adicional para los participantes..."
            ></textarea>
          </div>

        </div>
      `;

      const venue = content.querySelector(
        "#nexus-location-venue"
      );

      const address = content.querySelector(
        "#nexus-location-address"
      );

      const city = content.querySelector(
        "#nexus-location-city"
      );

      const instructions = content.querySelector(
        "#nexus-location-instructions"
      );

      venue.value = currentValue.venue || "";
      address.value = currentValue.address || "";
      city.value = currentValue.city || "";
      instructions.value = currentValue.instructions || "";

      venue.addEventListener("input", (event) => {
        currentValue.venue = event.target.value;
        emitChange();
      });

      address.addEventListener("input", (event) => {
        currentValue.address = event.target.value;
        emitChange();
      });

      city.addEventListener("input", (event) => {
        currentValue.city = event.target.value;
        emitChange();
      });

      instructions.addEventListener("input", (event) => {
        currentValue.instructions = event.target.value;
        emitChange();
      });

      return;
    }

    content.innerHTML = `
      <div class="location-selector__fields">

        <div class="location-selector__field">
          <label
            class="location-selector__label"
            for="nexus-location-platform"
          >
            PLATAFORMA
          </label>

          <input
            id="nexus-location-platform"
            class="location-selector__input"
            type="text"
            placeholder="Ej. Discord, Battle.net, PlayStation Network..."
          />
        </div>

        <div class="location-selector__field">
          <label
            class="location-selector__label"
            for="nexus-location-url"
          >
            ENLACE
          </label>

          <input
            id="nexus-location-url"
            class="location-selector__input"
            type="url"
            placeholder="https://..."
          />
        </div>

        <div class="location-selector__field">
          <label
            class="location-selector__label"
            for="nexus-location-instructions"
          >
            INDICACIONES
          </label>

          <textarea
            id="nexus-location-instructions"
            class="location-selector__textarea"
            rows="3"
            placeholder="Información adicional para los participantes..."
          ></textarea>
        </div>

      </div>
    `;

    const platform = content.querySelector(
      "#nexus-location-platform"
    );

    const url = content.querySelector(
      "#nexus-location-url"
    );

    const instructions = content.querySelector(
      "#nexus-location-instructions"
    );

    platform.value = currentValue.platform || "";
    url.value = currentValue.url || "";
    instructions.value = currentValue.instructions || "";

    platform.addEventListener("input", (event) => {
      currentValue.platform = event.target.value;
      emitChange();
    });

    url.addEventListener("input", (event) => {
      currentValue.url = event.target.value;
      emitChange();
    });

    instructions.addEventListener("input", (event) => {
      currentValue.instructions = event.target.value;
      emitChange();
    });
  }

  typeSelect.value = currentValue.type;

  typeSelect.addEventListener("change", (event) => {
    currentValue.type = event.target.value;

    renderContent();

    emitChange();
  });

  renderContent();

  return {
    element: container,

    getValue() {
      return {
        ...currentValue
      };
    },

    setValue(newValue = null) {
      currentValue = {
        type: "online",
        platform: "",
        url: "",
        venue: "",
        address: "",
        city: "",
        instructions: "",
        ...(newValue || {})
      };

      typeSelect.value = currentValue.type;

      renderContent();
    },

    refresh() {
      renderContent();
    }
  };
}