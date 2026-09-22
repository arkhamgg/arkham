export function FormatSelector({
  formats = [],
  value = "",
  onChange = null
} = {}) {
  const container = document.createElement("div");

  container.className = "format-selector";

  container.innerHTML = `
    <label
      class="format-selector__label"
      for="arkham-format-selector"
    >
      FORMATO
    </label>

    <select
      id="arkham-format-selector"
      class="format-selector__select"
    >
      <option value="">
        SELECCIONA UN FORMATO
      </option>
    </select>

    <p class="format-selector__message"></p>
  `;

  const select = container.querySelector(
    "#arkham-format-selector"
  );

  const message = container.querySelector(
    ".format-selector__message"
  );

  /**
   * Renderiza las opciones disponibles.
   */
  function renderFormats() {
    select.innerHTML = "";

    /**
     * Placeholder.
     */
    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = "SELECCIONA UN FORMATO";
    placeholder.disabled = false;
    placeholder.selected = true;

    select.appendChild(placeholder);

    /**
     * Sin formatos disponibles.
     */
    if (!Array.isArray(formats) || formats.length === 0) {
      select.disabled = true;

      message.textContent =
        "Selecciona una modalidad para ver los formatos disponibles.";

      return;
    }

    /**
     * Hay formatos:
     * el selector DEBE estar habilitado.
     */
    select.disabled = false;

    message.textContent = "";

    formats.forEach((format) => {
      const option = document.createElement("option");

      option.value = format;
      option.textContent = format;

      select.appendChild(option);
    });

    /**
     * Si existe un valor previo válido,
     * lo restauramos.
     */
    if (value && formats.includes(value)) {
      select.value = value;
    } else {
      value = "";
      select.value = "";
    }
  }

  /**
   * Usuario selecciona un formato.
   */
  select.addEventListener("change", (event) => {
    value = event.target.value;


    if (typeof onChange === "function") {
      onChange(value);
    }
  });

  /**
   * Render inicial.
   */
  renderFormats();

  return {
    element: container,

    /**
     * Obtiene el valor actual.
     */
    getValue() {
      return select.value;
    },

    /**
     * Establece un valor.
     */
    setValue(format = "") {
      value = format || "";

      if (
        value &&
        formats.includes(value)
      ) {
        select.value = value;
      } else {
        value = "";
        select.value = "";
      }
    },

    /**
     * Reemplaza las opciones disponibles.
     */
    setFormats(newFormats = []) {
      formats = Array.isArray(newFormats)
        ? [...newFormats]
        : [];

      value = "";

      renderFormats();
    },

    /**
     * Actualiza el componente.
     */
    refresh() {
      renderFormats();
    }
  };
}