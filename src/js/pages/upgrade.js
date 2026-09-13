// ========================================
// NEXUS — Upgrade to Pro Page
// ========================================

import {
  getCurrentAccountContext
} from "../services/account.js";

import {
  PLAN_IDS
} from "../services/plans.js";

import {
  createBillingPayment,
  uploadBillingPaymentProof,
  submitBillingPayment
} from "../services/billingPayment.js";


// ========================================
// CONSTANTS
// ========================================

const MAX_PROOF_SIZE = 5 * 1024 * 1024;

const ALLOWED_PROOF_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];


// ========================================
// HELPERS
// ========================================

function escapeHtml(value = "") {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function formatCurrency(
  amount,
  currency = "GTQ"
) {

  if (
    amount === null ||
    amount === undefined ||
    amount === ""
  ) {

    return "—";

  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {

    return "—";

  }

  return new Intl.NumberFormat(
    "es-GT",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 2
    }
  ).format(numericAmount);

}


function formatDate(value) {

  if (!value) {

    return "—";

  }

  let date;

  if (value instanceof Date) {

    date = value;

  } else if (
    typeof value?.toDate === "function"
  ) {

    date = value.toDate();

  } else {

    date = new Date(value);

  }

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";

  }

  return new Intl.DateTimeFormat(
    "es-GT",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(date);

}


function formatTime(value) {

  if (!value) {

    return "—";

  }

  return String(value);

}


// ========================================
// LOADING
// ========================================

function renderLoading() {

  return `
    <section class="upgrade-page">

      <div class="upgrade-page__container">

        <div class="upgrade-page__loading">

          <div class="upgrade-page__loading-icon">

            <i class="fa-solid fa-spinner fa-spin"></i>

          </div>

          <p>
            Cargando información de Upgrade...
          </p>

        </div>

      </div>

    </section>
  `;

}


// ========================================
// ERROR
// ========================================

function renderError(
  message
) {

  return `
    <section class="upgrade-page">

      <div class="upgrade-page__container">

        <div class="upgrade-page__error">

          <div class="upgrade-page__error-icon">

            <i class="fa-solid fa-circle-exclamation"></i>

          </div>

          <h1>
            No pudimos cargar Upgrade
          </h1>

          <p>
            ${escapeHtml(message)}
          </p>

          <button
            type="button"
            class="upgrade-page__secondary-button"
            data-upgrade-back
          >

            <i class="fa-solid fa-arrow-left"></i>

            Volver a Billing

          </button>

        </div>

      </div>

    </section>
  `;

}


// ========================================
// PAGE HEADER
// ========================================

function renderHeader() {

  return `
    <header class="upgrade-page__header">

      <div>

        <span class="upgrade-page__eyebrow">
          NEXUS PRO
        </span>

        <h1>
          Actualizar a Pro
        </h1>

        <p>
          Completa la información de tu pago
          para solicitar la activación de tu
          suscripción Pro.
        </p>

      </div>

    </header>
  `;

}


// ========================================
// PRO SUMMARY
// ========================================

function renderProSummary(
  price = null
) {

  return `
    <section class="upgrade-page__section">

      <div class="upgrade-page__section-heading">

        <span>
          PLAN SELECCIONADO
        </span>

      </div>


      <article class="upgrade-page__pro-card">

        <div class="upgrade-page__pro-card-top">

          <div class="upgrade-page__pro-icon">

            <i class="fa-solid fa-crown"></i>

          </div>

          <div>

            <span class="upgrade-page__plan-label">
              NEXUS
            </span>

            <h2>
              Pro
            </h2>

            <p>
              Plan profesional para operar
              competencias en NEXUS.
            </p>

          </div>

        </div>


        <div class="upgrade-page__divider"></div>


        <div class="upgrade-page__price">

          <span>
            Precio mensual
          </span>

          <strong>
            ${
              price === null
                ? "Consultar"
                : formatCurrency(price, "GTQ")
            }
          </strong>

        </div>

      </article>

    </section>
  `;

}


// ========================================
// PAYMENT INSTRUCTIONS
// ========================================

function renderPaymentInstructions() {

  return `
    <section class="upgrade-page__section">

      <div class="upgrade-page__section-heading">

        <span>
          MÉTODO DE PAGO
        </span>

      </div>


      <article class="upgrade-page__instructions">

        <div class="upgrade-page__instruction-icon">

          <i class="fa-solid fa-building-columns"></i>

        </div>

        <div>

          <h3>
            Transferencia o depósito bancario
          </h3>

          <p>
            Realiza el pago utilizando los datos
            bancarios oficiales proporcionados
            por NEXUS.
          </p>

          <div class="upgrade-page__notice">

            <i class="fa-solid fa-circle-info"></i>

            <span>
              Los datos bancarios oficiales se
              configurarán próximamente en esta
              sección.
            </span>

          </div>

        </div>

      </article>

    </section>
  `;

}


// ========================================
// PAYMENT FORM
// ========================================

function renderPaymentForm() {

  return `
    <section class="upgrade-page__section">

      <div class="upgrade-page__section-heading">

        <span>
          INFORMACIÓN DEL PAGO
        </span>

      </div>


      <form
        class="upgrade-page__form"
        data-upgrade-form
      >

        <!-- PAYMENT METHOD -->

        <div class="upgrade-page__field">

          <label for="upgrade-payment-method">
            Método de pago
          </label>

          <select
            id="upgrade-payment-method"
            name="paymentMethod"
            required
          >

            <option value="">
              Selecciona un método
            </option>

            <option value="bank_transfer">
              Transferencia bancaria
            </option>

            <option value="bank_deposit">
              Depósito bancario
            </option>

          </select>

        </div>


        <!-- DATE + TIME -->

        <div class="upgrade-page__field-grid">

          <div class="upgrade-page__field">

            <label for="upgrade-payment-date">
              Fecha del pago
            </label>

            <input
              id="upgrade-payment-date"
              name="paymentDate"
              type="date"
              required
            />

          </div>


          <div class="upgrade-page__field">

            <label for="upgrade-payment-time">
              Hora del pago
            </label>

            <input
              id="upgrade-payment-time"
              name="paymentTime"
              type="time"
              required
            />

          </div>

        </div>


        <!-- REFERENCE -->

        <div class="upgrade-page__field">

          <label for="upgrade-payment-reference">
            Referencia
          </label>

          <input
            id="upgrade-payment-reference"
            name="reference"
            type="text"
            maxlength="120"
            placeholder="Número de referencia o boleta"
          />

          <span class="upgrade-page__field-help">
            Opcional, pero recomendado.
          </span>

        </div>


        <!-- PROOF -->

        <div class="upgrade-page__field">

          <label for="upgrade-payment-proof">
            Comprobante de pago
          </label>

          <input
            id="upgrade-payment-proof"
            name="proof"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            required
          />

          <span class="upgrade-page__field-help">
            JPG, PNG, WEBP o PDF. Máximo 5 MB.
          </span>

        </div>


        <!-- ERROR -->

        <div
          class="upgrade-page__form-error"
          data-upgrade-error
          hidden
        ></div>


        <!-- ACTIONS -->

        <div class="upgrade-page__actions">

          <button
            type="button"
            class="upgrade-page__secondary-button"
            data-upgrade-back
          >

            <i class="fa-solid fa-arrow-left"></i>

            Volver

          </button>


          <button
            type="submit"
            class="upgrade-page__primary-button"
            data-upgrade-submit
          >

            <span data-upgrade-submit-label>
              Enviar solicitud
            </span>

            <i class="fa-solid fa-arrow-right"></i>

          </button>

        </div>

      </form>

    </section>
  `;

}


// ========================================
// SUCCESS
// ========================================

function renderSuccess() {

  return `
    <section class="upgrade-page">

      <div class="upgrade-page__container">

        <div class="upgrade-page__success">

          <div class="upgrade-page__success-icon">

            <i class="fa-solid fa-check"></i>

          </div>

          <span class="upgrade-page__eyebrow">
            SOLICITUD ENVIADA
          </span>

          <h1>
            Pago enviado a revisión
          </h1>

          <p>
            Recibimos tu solicitud correctamente.
            Un administrador de NEXUS revisará
            el comprobante y procesará la activación
            de tu plan Pro.
          </p>

          <div class="upgrade-page__success-status">

            <i class="fa-solid fa-clock"></i>

            <span>
              Estado: Pago en revisión
            </span>

          </div>

          <button
            type="button"
            class="upgrade-page__primary-button"
            data-upgrade-success-back
          >

            Ir a Billing

            <i class="fa-solid fa-arrow-right"></i>

          </button>

        </div>

      </div>

    </section>
  `;

}


// ========================================
// VALIDATION
// ========================================

function validateProofFile(
  file
) {

  if (!file) {

    return "Debes seleccionar un comprobante de pago.";

  }

  if (
    !ALLOWED_PROOF_TYPES.includes(
      file.type
    )
  ) {

    return "El comprobante debe ser JPG, PNG, WEBP o PDF.";

  }

  if (
    file.size > MAX_PROOF_SIZE
  ) {

    return "El comprobante no puede superar los 5 MB.";

  }

  return null;

}


// ========================================
// FORM ERROR
// ========================================

function showFormError(
  root,
  message
) {

  const errorElement =
    root.querySelector(
      "[data-upgrade-error]"
    );

  if (!errorElement) {

    return;

  }

  errorElement.textContent =
    message || "Ocurrió un error.";

  errorElement.hidden = false;

}


function clearFormError(
  root
) {

  const errorElement =
    root.querySelector(
      "[data-upgrade-error]"
    );

  if (!errorElement) {

    return;

  }

  errorElement.textContent = "";

  errorElement.hidden = true;

}


// ========================================
// SUBMIT STATE
// ========================================

function setSubmittingState(
  root,
  submitting
) {

  const button =
    root.querySelector(
      "[data-upgrade-submit]"
    );

  const label =
    root.querySelector(
      "[data-upgrade-submit-label]"
    );

  if (!button) {

    return;

  }

  button.disabled =
    submitting;

  if (submitting) {

    if (label) {

      label.textContent =
        "Procesando...";

    }

    button.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span>Procesando...</span>
    `;

  } else {

    button.innerHTML = `
      <span>
        Enviar solicitud
      </span>

      <i class="fa-solid fa-arrow-right"></i>
    `;

  }

}


// ========================================
// BACK NAVIGATION
// ========================================

function goBackToBilling() {

  window.history.pushState(
    {},
    "",
    "/dashboard/billing"
  );

  window.dispatchEvent(
    new PopStateEvent("popstate")
  );

}


// ========================================
// PAYMENT FLOW
// ========================================

async function handleSubmit(
  root,
  form
) {

  clearFormError(root);

  const formData =
    new FormData(form);

  const paymentMethod =
    String(
      formData.get("paymentMethod") || ""
    ).trim();

  const paymentDate =
    String(
      formData.get("paymentDate") || ""
    ).trim();

  const paymentTime =
    String(
      formData.get("paymentTime") || ""
    ).trim();

  const reference =
    String(
      formData.get("reference") || ""
    ).trim();

  const proofFile =
    formData.get("proof");


  // --------------------------------------
  // BASIC VALIDATION
  // --------------------------------------

  if (!paymentMethod) {

    showFormError(
      root,
      "Selecciona el método de pago."
    );

    return;

  }


  if (!paymentDate) {

    showFormError(
      root,
      "Selecciona la fecha del pago."
    );

    return;

  }


  if (!paymentTime) {

    showFormError(
      root,
      "Selecciona la hora del pago."
    );

    return;

  }


  const proofError =
    validateProofFile(
      proofFile
    );

  if (proofError) {

    showFormError(
      root,
      proofError
    );

    return;

  }


  setSubmittingState(
    root,
    true
  );


  try {

    // ------------------------------------
    // ACCOUNT
    // ------------------------------------

    const accountContext =
      await getCurrentAccountContext();

    if (!accountContext) {

      throw new Error(
        "No fue posible obtener la información de tu cuenta."
      );

    }


    const account =
      accountContext.account ||
      accountContext;


    const currentPlanId =
      String(
        account?.planId ||
        PLAN_IDS.FREE
      ).toLowerCase();


    // ------------------------------------
    // ONLY FREE → PRO
    // ------------------------------------

    if (
      currentPlanId !== PLAN_IDS.FREE
    ) {

      throw new Error(
        "Tu cuenta no está disponible para este Upgrade."
      );

    }


    // ------------------------------------
    // CREATE PAYMENT
    // ------------------------------------

    const paymentResponse =
      await createBillingPayment({

        subscriptionId: null,

        currentPlanId: PLAN_IDS.FREE,

        planId: PLAN_IDS.PRO,

        period: "monthly",

        method: paymentMethod,

        paymentDate,

        paymentTime,

        reference

      });


    const payment =
      paymentResponse?.payment;


    const paymentId =
      payment?.id ||
      paymentResponse?.id;


    if (!paymentId) {

      throw new Error(
        "El pago fue creado, pero no recibimos su identificador."
      );

    }


    // ------------------------------------
    // UPLOAD PROOF
    // ------------------------------------

    await uploadBillingPaymentProof(
      proofFile,
      paymentId
    );


    // ------------------------------------
    // SUBMIT PAYMENT
    // ------------------------------------

    await submitBillingPayment(
      paymentId
    );


    // ------------------------------------
    // SUCCESS
    // ------------------------------------

    root.innerHTML =
      renderSuccess();


    bindSuccessEvents(
      root
    );


  } catch (error) {

    console.error(
      "NEXUS — Upgrade: error procesando solicitud.",
      error
    );

    showFormError(
      root,
      error?.message ||
      "No fue posible procesar la solicitud."
    );

    setSubmittingState(
      root,
      false
    );

  }

}


// ========================================
// EVENTS
// ========================================

function bindSuccessEvents(
  root
) {

  const button =
    root.querySelector(
      "[data-upgrade-success-back]"
    );

  if (!button) {

    return;

  }

  button.addEventListener(
    "click",
    goBackToBilling
  );

}


function bindEvents(
  root
) {

  // --------------------------------------
  // BACK
  // --------------------------------------

  const backButtons =
    root.querySelectorAll(
      "[data-upgrade-back]"
    );

  backButtons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        goBackToBilling
      );

    }
  );


  // --------------------------------------
  // FORM
  // --------------------------------------

  const form =
    root.querySelector(
      "[data-upgrade-form]"
    );

  if (!form) {

    return;

  }

  form.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();

      handleSubmit(
        root,
        form
      );

    }
  );


  // --------------------------------------
  // FILE VALIDATION
  // --------------------------------------

  const proofInput =
    root.querySelector(
      "#upgrade-payment-proof"
    );

  if (proofInput) {

    proofInput.addEventListener(
      "change",
      () => {

        clearFormError(root);

        const file =
          proofInput.files?.[0];

        if (!file) {

          return;

        }

        const error =
          validateProofFile(
            file
          );

        if (error) {

          proofInput.value = "";

          showFormError(
            root,
            error
          );

        }

      }
    );

  }

}


// ========================================
// LOAD PAGE
// ========================================

async function renderUpgradeContent(
  root
) {

  root.innerHTML =
    renderLoading();


  try {

    // ------------------------------------
    // ACCOUNT
    // ------------------------------------

    const accountContext =
      await getCurrentAccountContext();


    if (!accountContext) {

      root.innerHTML =
        renderError(
          "No fue posible obtener la información de tu cuenta."
        );

      bindEvents(root);

      return;

    }


    const account =
      accountContext.account ||
      accountContext;


    // ------------------------------------
    // PLAN
    // ------------------------------------

    const currentPlanId =
      String(
        account?.planId ||
        PLAN_IDS.FREE
      ).toLowerCase();


    // ------------------------------------
    // ONLY FREE → PRO
    // ------------------------------------

    if (
      currentPlanId !== PLAN_IDS.FREE
    ) {

      root.innerHTML =
        renderError(
          "Tu cuenta ya tiene un plan de pago o no puede solicitar este Upgrade."
        );

      bindEvents(root);

      return;

    }


    // ------------------------------------
    // RENDER
    // ------------------------------------

    root.innerHTML = `

      <section class="upgrade-page">

        <div class="upgrade-page__container">

          ${renderHeader()}

          ${renderProSummary()}

          ${renderPaymentInstructions()}

          ${renderPaymentForm()}

        </div>

      </section>

    `;


    bindEvents(
      root
    );


  } catch (error) {

    console.error(
      "NEXUS — Upgrade Page: error cargando información.",
      error
    );

    root.innerHTML =
      renderError(
        error?.message ||
        "Ocurrió un error inesperado."
      );

    bindEvents(
      root
    );

  }

}


// ========================================
// PAGE
// ========================================

export function Upgrade() {

  const root =
    document.createElement(
      "div"
    );

  root.className =
    "upgrade-page-root";


  renderUpgradeContent(
    root
  );


  return root;

}