// ========================================
// ARKHAM — Registration Requirements Editor
// ========================================

export function RegistrationRequirementsEditor({
  value = null,
  onChange = () => {}
} = {}) {
  const element = document.createElement("div");
  element.className = "registration-requirements-editor";

  let currentValue = normalize(value);

  element.innerHTML = `
    <div class="registration-requirements-editor__intro">
      <div>
        <strong>Requisitos de inscripción</strong>
        <p>Define la información que un participante deberá presentar antes de solicitar un asiento.</p>
      </div>
      <label class="registration-requirements-editor__toggle">
        <input type="checkbox" data-requirement-enabled>
        <span>Activar requisitos</span>
      </label>
    </div>

    <div class="registration-requirements-editor__panel" data-requirement-panel hidden>
      <div class="registration-requirements-editor__type-row">
        <span class="registration-requirements-editor__label">TIPO DE REQUISITO</span>
        <strong>Depósito previo</strong>
      </div>

      <div class="registration-requirements-editor__grid">
        <label>
          <span>Monto requerido</span>
          <div class="registration-requirements-editor__input-prefix">
            <span>Q</span>
            <input type="number" min="0" step="0.01" inputmode="decimal" data-requirement-amount placeholder="0.00">
          </div>
        </label>

        <label>
          <span>Banco / entidad</span>
          <input type="text" data-requirement-bank placeholder="Banco Industrial">
        </label>

        <label>
          <span>No. de cuenta</span>
          <input type="text" data-requirement-account placeholder="0000000000">
        </label>

        <label>
          <span>Nombre del titular</span>
          <input type="text" data-requirement-account-name placeholder="Nombre del titular">
        </label>
      </div>

      <label class="registration-requirements-editor__proof">
        <input type="checkbox" data-requirement-proof>
        <span>
          <strong>Solicitar comprobante</strong>
          <small>El participante deberá adjuntar un comprobante junto con su solicitud.</small>
        </span>
      </label>
    </div>
  `;

  const enabledInput = element.querySelector("[data-requirement-enabled]");
  const panel = element.querySelector("[data-requirement-panel]");
  const amountInput = element.querySelector("[data-requirement-amount]");
  const bankInput = element.querySelector("[data-requirement-bank]");
  const accountInput = element.querySelector("[data-requirement-account]");
  const accountNameInput = element.querySelector("[data-requirement-account-name]");
  const proofInput = element.querySelector("[data-requirement-proof]");

  function emitChange() {
    currentValue = {
      enabled: enabledInput.checked,
      requirements: enabledInput.checked
        ? [{
            id: "deposit",
            type: "payment",
            title: "Depósito previo",
            amount: Number(amountInput.value || 0),
            paymentInfo: {
              bank: bankInput.value.trim(),
              accountNumber: accountInput.value.trim(),
              accountName: accountNameInput.value.trim()
            },
            requiresProof: proofInput.checked
          }]
        : []
    };

    onChange(structuredClone(currentValue));
  }

  function syncPanel() {
    panel.hidden = !enabledInput.checked;
    emitChange();
  }

  function setValue(value) {
    currentValue = normalize(value);
    const requirement = currentValue.requirements[0] || {};
    const paymentInfo = requirement.paymentInfo || {};

    enabledInput.checked = Boolean(currentValue.enabled);
    amountInput.value = requirement.amount ?? "";
    bankInput.value = paymentInfo.bank || "";
    accountInput.value = paymentInfo.accountNumber || "";
    accountNameInput.value = paymentInfo.accountName || "";
    proofInput.checked = Boolean(requirement.requiresProof);
    panel.hidden = !enabledInput.checked;
  }

  enabledInput.addEventListener("change", syncPanel);
  [amountInput, bankInput, accountInput, accountNameInput, proofInput].forEach((input) => {
    input.addEventListener("input", emitChange);
    input.addEventListener("change", emitChange);
  });

  setValue(currentValue);

  return {
    element,
    setValue,
    getValue: () => structuredClone(currentValue)
  };
}

function normalize(value) {
  if (!value || typeof value !== "object") {
    return {
      enabled: false,
      requirements: []
    };
  }

  return {
    enabled: Boolean(value.enabled),
    requirements: Array.isArray(value.requirements)
      ? value.requirements
      : []
  };
}
