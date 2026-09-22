export function RegistrationCostSelector({
  value = null,
  participationType = "",
  onChange = null
} = {}) {
  const container = document.createElement("div");

  container.className = "registration-cost-selector";

  let currentValue = {
    type: "free",
    amount: 0,
    currency: "GTQ",
    unit: "",
    includedBenefit: ""
  };

  if (value && typeof value === "object") {
    currentValue = {
      ...currentValue,
      ...value
    };
  }

  function getUnit() {
    switch (participationType) {
      case "Individual":
        return "participant";

      case "Duo":
        return "duo";

      case "Team":
        return "team";

      default:
        return "";
    }
  }

  function getUnitLabel() {
    switch (participationType) {
      case "Individual":
        return "por participante";

      case "Duo":
        return "por duo";

      case "Team":
        return "por equipo";

      default:
        return "";
    }
  }

  function emitChange() {
    currentValue.unit = getUnit();

    if (typeof onChange === "function") {
      onChange({
        ...currentValue
      });
    }
  }

  container.innerHTML = `
    <div class="registration-cost-selector__field">
      <label
        class="registration-cost-selector__label"
        for="arkham-registration-cost-type"
      >
        COSTO DE INSCRIPCIÓN
      </label>

      <select
        id="arkham-registration-cost-type"
        class="registration-cost-selector__select"
      >
        <option value="free">GRATIS</option>
        <option value="paid">DE PAGO</option>
      </select>
    </div>

    <div
      class="registration-cost-selector__content"
      data-registration-cost-content
    ></div>

    <p
      class="registration-cost-selector__message"
      data-registration-cost-message
    ></p>
  `;

  const typeSelect = container.querySelector(
    "#arkham-registration-cost-type"
  );

  const content = container.querySelector(
    "[data-registration-cost-content]"
  );

  const message = container.querySelector(
    "[data-registration-cost-message]"
  );

  function renderContent() {
    if (currentValue.type === "paid") {
      content.innerHTML = `
        <div class="registration-cost-selector__fields">

          <div class="registration-cost-selector__field">
            <label
              class="registration-cost-selector__label"
              for="arkham-registration-cost-amount"
            >
              MONTO
            </label>

            <input
              id="arkham-registration-cost-amount"
              class="registration-cost-selector__input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div class="registration-cost-selector__field">
            <label
              class="registration-cost-selector__label"
              for="arkham-registration-cost-currency"
            >
              MONEDA
            </label>

            <select
              id="arkham-registration-cost-currency"
              class="registration-cost-selector__select"
            >
              <option value="GTQ">
                GTQ — Quetzales
              </option>

              <option value="USD">
                USD — Dólares
              </option>
            </select>
          </div>

          <div class="registration-cost-selector__field registration-cost-selector__field--benefit">
            <label
              class="registration-cost-selector__label"
              for="arkham-registration-cost-benefit"
            >
              BENEFICIO INCLUIDO
            </label>

            <textarea
              id="arkham-registration-cost-benefit"
              class="registration-cost-selector__textarea"
              rows="3"
              placeholder="Ej. Combo de comida y bebida..."
            ></textarea>
          </div>

        </div>
      `;

      const amountInput = content.querySelector(
        "#arkham-registration-cost-amount"
      );

      const currencySelect = content.querySelector(
        "#arkham-registration-cost-currency"
      );

      const benefitInput = content.querySelector(
        "#arkham-registration-cost-benefit"
      );

      amountInput.value =
        currentValue.amount > 0
          ? currentValue.amount
          : "";

      currencySelect.value =
        currentValue.currency || "GTQ";

      benefitInput.value =
        currentValue.includedBenefit || "";

      amountInput.addEventListener("input", (event) => {
        currentValue.amount =
          event.target.value === ""
            ? 0
            : Number(event.target.value);

        emitChange();
        updateMessage();
      });

      currencySelect.addEventListener("change", (event) => {
        currentValue.currency =
          event.target.value;

        emitChange();
        updateMessage();
      });

      benefitInput.addEventListener("input", (event) => {
        currentValue.includedBenefit =
          event.target.value;

        emitChange();
      });

      updateMessage();

      return;
    }

    content.innerHTML = "";

    currentValue.amount = 0;
    currentValue.currency = "GTQ";
    currentValue.includedBenefit = "";

    message.textContent = "";
  }

  function updateMessage() {
    if (currentValue.type !== "paid") {
      message.textContent = "";
      return;
    }

    const unitLabel = getUnitLabel();

    if (!unitLabel) {
      message.textContent =
        "La unidad de inscripción se determinará según la modalidad seleccionada.";

      return;
    }

    if (currentValue.amount > 0) {
      message.textContent =
        `${currentValue.amount.toFixed(2)} ${currentValue.currency} ${unitLabel}.`;
    } else {
      message.textContent =
        `El costo se cobrará ${unitLabel}.`;
    }
  }

  typeSelect.value = currentValue.type;

  typeSelect.addEventListener("change", (event) => {
    currentValue.type =
      event.target.value;

    if (currentValue.type === "free") {
      currentValue.amount = 0;
      currentValue.currency = "GTQ";
      currentValue.includedBenefit = "";
    }

    renderContent();
    emitChange();
  });

  currentValue.unit = getUnit();

  renderContent();

  return {
    element: container,

    getValue() {
      return {
        ...currentValue,
        unit: getUnit()
      };
    },

    setValue(newValue = null) {
      currentValue = {
        type: "free",
        amount: 0,
        currency: "GTQ",
        unit: "",
        includedBenefit: "",
        ...(newValue || {})
      };

      currentValue.unit = getUnit();

      typeSelect.value =
        currentValue.type;

      renderContent();
    },

    setParticipationType(type = "") {
      participationType = type || "";

      currentValue.unit = getUnit();

      updateMessage();
    },

    refresh() {
      currentValue.unit = getUnit();

      renderContent();
    }
  };
}