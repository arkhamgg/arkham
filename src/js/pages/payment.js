// ========================================
// NEXUS — Billing Payment Page
// ========================================

import {
  getCurrentAccountContext
} from "../services/account.js";

import {
  PLAN_IDS
} from "../services/plans.js";

import {
  createBillingPayment
} from "../services/billingPayment.js";


// ========================================
// CONSTANTS
// ========================================

const PAYMENT_METHODS = {
  BANK_TRANSFER: "bank_transfer",
  BANK_DEPOSIT: "bank_deposit",
  CARD: "card"
};


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
  const numericAmount =
    Number(amount);

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


function formatDateForDisplay(
  dateValue
) {
  if (!dateValue) {
    return "—";
  }

  const date =
    new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-GT",
    {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }
  ).format(date);
}


function getTodayDateInputValue() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


// ========================================
// LOADING
// ========================================

function renderLoading() {
  return `
    <section class="payment-page">

      <div class="payment-page__container">

        <div class="payment-page__loading">

          <div class="payment-page__loading-icon">
            <i class="fa-solid fa-spinner fa-spin"></i>
          </div>

          <p>
            Cargando información de pago...
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
    <section class="payment-page">

      <div class="payment-page__container">

        <div class="payment-page__error">

          <div class="payment-page__error-icon">
            <i class="fa-solid fa-circle-exclamation"></i>
          </div>

          <span class="payment-page__eyebrow">
            NEXUS BILLING
          </span>

          <h1>
            No pudimos cargar el pago
          </h1>

          <p>
            ${escapeHtml(message)}
          </p>

          <button
            type="button"
            class="payment-page__button payment-page__button--secondary"
            data-payment-back
          >
            <i class="fa-solid fa-arrow-left"></i>

            <span>
              Volver
            </span>
          </button>

        </div>

      </div>

    </section>
  `;
}


// ========================================
// SUCCESS
// ========================================

function renderSuccess(
  payment
) {
  const paymentId =
    payment?.id ||
    "—";

  const amount =
    payment?.amount;

  const currency =
    payment?.currency ||
    "GTQ";

  return `
    <section class="payment-page">

      <div class="payment-page__container">

        <div class="payment-page__success">

          <div class="payment-page__success-icon">
            <i class="fa-solid fa-circle-check"></i>
          </div>

          <span class="payment-page__eyebrow">
            NEXUS BILLING
          </span>

          <h1>
            Solicitud creada
          </h1>

          <p class="payment-page__success-description">
            Tu solicitud de pago fue registrada correctamente.
            Ahora podrás continuar con el proceso de revisión.
          </p>

          <div class="payment-page__success-card">

            <div class="payment-page__success-row">

              <span>
                Solicitud
              </span>

              <strong>
                ${escapeHtml(paymentId)}
              </strong>

            </div>

            <div class="payment-page__success-row">

              <span>
                Plan
              </span>

              <strong>
                Pro
              </strong>

            </div>

            <div class="payment-page__success-row">

              <span>
                Periodo
              </span>

              <strong>
                Mensual
              </strong>

            </div>

            <div class="payment-page__success-row">

              <span>
                Importe
              </span>

              <strong>
                ${formatCurrency(amount, currency)}
              </strong>

            </div>

            <div class="payment-page__success-row">

              <span>
                Estado
              </span>

              <strong>
                Pendiente
              </strong>

            </div>

          </div>

          <div class="payment-page__success-actions">

            <button
              type="button"
              class="payment-page__button payment-page__button--primary"
              data-payment-billing
            >
              <span>
                Ir a Billing
              </span>

              <i class="fa-solid fa-arrow-right"></i>
            </button>

          </div>

        </div>

      </div>

    </section>
  `;
}


// ========================================
// PAYMENT PAGE
// ========================================

function renderPaymentForm(
  billingData
) {
  const price =
    billingData?.price;

  const currency =
    billingData?.currency ||
    "GTQ";

  const today =
    getTodayDateInputValue();

  return `
    <section class="payment-page">

      <div class="payment-page__container">

        <div class="payment-page__header">

          <button
            type="button"
            class="payment-page__back"
            data-payment-back
          >
            <i class="fa-solid fa-arrow-left"></i>

            <span>
              Volver a planes
            </span>
          </button>

          <span class="payment-page__eyebrow">
            NEXUS BILLING
          </span>

          <h1>
            Activar Pro
          </h1>

          <p>
            Completa la información de tu pago para
            enviar la solicitud de activación.
          </p>

        </div>


        <!-- ================================== -->
        <!-- PLAN SUMMARY -->
        <!-- ================================== -->

        <div class="payment-page__summary">

          <div class="payment-page__summary-header">

            <div>

              <span class="payment-page__summary-label">
                PLAN
              </span>

              <h2>
                Pro
              </h2>

            </div>

            <div class="payment-page__summary-price">

              ${
                price !== null &&
                price !== undefined
                  ? formatCurrency(
                      price,
                      currency
                    )
                  : "Precio oficial"
              }

              <span>
                / mes
              </span>

            </div>

          </div>

          <p>
            Acceso a las capacidades profesionales
            disponibles para tu cuenta.
          </p>

        </div>


        <!-- ================================== -->
        <!-- PAYMENT METHOD -->
        <!-- ================================== -->

        <div class="payment-page__section">

          <div class="payment-page__section-header">

            <span class="payment-page__section-number">
              01
            </span>

            <div>

              <h2>
                Método de pago
              </h2>

              <p>
                Selecciona cómo realizaste el pago.
              </p>

            </div>

          </div>


          <div class="payment-page__methods">


            <!-- BANK TRANSFER -->

            <label
              class="payment-page__method payment-page__method--selected"
              data-payment-method-card
            >

              <input
                type="radio"
                name="paymentMethod"
                value="${PAYMENT_METHODS.BANK_TRANSFER}"
                checked
              />

              <div class="payment-page__method-icon">
                <i class="fa-solid fa-building-columns"></i>
              </div>

              <div class="payment-page__method-content">

                <strong>
                  Transferencia bancaria
                </strong>

                <span>
                  Transferencia desde tu cuenta bancaria.
                </span>

              </div>

              <div class="payment-page__method-check">
                <i class="fa-solid fa-check"></i>
              </div>

            </label>


            <!-- BANK DEPOSIT -->

            <label
              class="payment-page__method"
              data-payment-method-card
            >

              <input
                type="radio"
                name="paymentMethod"
                value="${PAYMENT_METHODS.BANK_DEPOSIT}"
              />

              <div class="payment-page__method-icon">
                <i class="fa-solid fa-money-bill-transfer"></i>
              </div>

              <div class="payment-page__method-content">

                <strong>
                  Depósito bancario
                </strong>

                <span>
                  Depósito realizado directamente en banco.
                </span>

              </div>

              <div class="payment-page__method-check">
                <i class="fa-solid fa-check"></i>
              </div>

            </label>


            <!-- CARD -->

            <label
              class="payment-page__method payment-page__method--disabled"
              data-payment-method-card
            >

              <input
                type="radio"
                name="paymentMethod"
                value="${PAYMENT_METHODS.CARD}"
                disabled
              />

              <div class="payment-page__method-icon">
                <i class="fa-solid fa-credit-card"></i>
              </div>

              <div class="payment-page__method-content">

                <strong>
                  Tarjeta
                </strong>

                <span>
                  Próximamente.
                </span>

              </div>

              <div class="payment-page__method-badge">
                Próximamente
              </div>

            </label>

          </div>

        </div>


        <!-- ================================== -->
        <!-- PAYMENT DETAILS -->
        <!-- ================================== -->

        <div class="payment-page__section">

          <div class="payment-page__section-header">

            <span class="payment-page__section-number">
              02
            </span>

            <div>

              <h2>
                Información del pago
              </h2>

              <p>
                Indica cuándo realizaste el pago y,
                si existe, su referencia.
              </p>

            </div>

          </div>


          <div class="payment-page__form">


            <!-- DATE -->

            <div class="payment-page__field">

              <label
                for="paymentDate"
              >
                Fecha del pago
              </label>

              <input
                id="paymentDate"
                name="paymentDate"
                type="date"
                value="${today}"
                max="${today}"
                autocomplete="off"
              />

              <span class="payment-page__field-help">
                Fecha en la que realizaste la transferencia
                o depósito.
              </span>

            </div>


            <!-- TIME -->

            <div class="payment-page__field">

              <label
                for="paymentTime"
              >
                Hora del pago
              </label>

              <input
                id="paymentTime"
                name="paymentTime"
                type="time"
                autocomplete="off"
              />

              <span class="payment-page__field-help">
                Hora aproximada en la que realizaste el pago.
              </span>

            </div>


            <!-- REFERENCE -->

            <div class="payment-page__field">

              <label
                for="paymentReference"
              >
                Referencia del pago
                <span>
                  Opcional
                </span>
              </label>

              <input
                id="paymentReference"
                name="paymentReference"
                type="text"
                maxlength="120"
                placeholder="Ej. 123456789"
                autocomplete="off"
              />

              <span class="payment-page__field-help">
                Número de operación, boleta o referencia
                proporcionada por el banco.
              </span>

            </div>

          </div>

        </div>


        <!-- ================================== -->
        <!-- PROCESS -->
        <!-- ================================== -->

        <div class="payment-page__info">

          <div class="payment-page__info-icon">
            <i class="fa-solid fa-shield-halved"></i>
          </div>

          <div>

            <strong>
              Activación manual
            </strong>

            <p>
              Esta solicitud será revisada por NEXUS.
              Tu plan no cambiará hasta que el pago
              sea aprobado.
            </p>

          </div>

        </div>


        <!-- ================================== -->
        <!-- CTA -->
        <!-- ================================== -->

        <div class="payment-page__cta">

          <button
            type="button"
            class="payment-page__button payment-page__button--primary"
            data-payment-confirm
          >

            <span>
              Enviar solicitud de pago
            </span>

            <i class="fa-solid fa-arrow-right"></i>

          </button>

          <p>
            Al continuar se creará una solicitud
            pendiente de revisión.
          </p>

        </div>

      </div>

    </section>
  `;
}


// ========================================
// NAVIGATION
// ========================================

function navigateTo(
  path
) {
  window.history.pushState(
    {},
    "",
    path
  );

  window.dispatchEvent(
    new PopStateEvent("popstate")
  );
}


function goBackToUpgrade() {
  navigateTo(
    "/dashboard/billing/upgrade"
  );
}


function goToBilling() {
  navigateTo(
    "/dashboard/billing"
  );
}


// ========================================
// VALIDATION
// ========================================

function validatePaymentForm(
  root
) {
  const selectedMethod =
    root.querySelector(
      'input[name="paymentMethod"]:checked'
    );

  if (!selectedMethod) {
    return {
      valid: false,
      message:
        "Selecciona un método de pago para continuar."
    };
  }


  const dateInput =
    root.querySelector(
      "#paymentDate"
    );

  const timeInput =
    root.querySelector(
      "#paymentTime"
    );

  const referenceInput =
    root.querySelector(
      "#paymentReference"
    );


  const paymentDate =
    String(
      dateInput?.value ||
      ""
    ).trim();

  const paymentTime =
    String(
      timeInput?.value ||
      ""
    ).trim();

  const reference =
    String(
      referenceInput?.value ||
      ""
    ).trim();


  if (!paymentDate) {
    return {
      valid: false,
      message:
        "Selecciona la fecha en la que realizaste el pago."
    };
  }


  if (!paymentTime) {
    return {
      valid: false,
      message:
        "Indica la hora aproximada en la que realizaste el pago."
    };
  }


  const today =
    getTodayDateInputValue();


  if (paymentDate > today) {
    return {
      valid: false,
      message:
        "La fecha del pago no puede ser posterior a hoy."
    };
  }


  if (reference.length > 120) {
    return {
      valid: false,
      message:
        "La referencia del pago es demasiado larga."
    };
  }


  return {
    valid: true,
    method:
      selectedMethod.value,
    paymentDate,
    paymentTime,
    reference:
      reference || null
  };
}


// ========================================
// FEEDBACK
// ========================================

function showError(
  root,
  message
) {
  const existing =
    root.querySelector(
      "[data-payment-error]"
    );

  if (existing) {
    existing.remove();
  }


  const error =
    document.createElement(
      "div"
    );

  error.className =
    "payment-page__form-error";

  error.dataset.paymentError =
    "";

  error.innerHTML = `
    <i class="fa-solid fa-circle-exclamation"></i>

    <span>
      ${escapeHtml(message)}
    </span>
  `;


  const cta =
    root.querySelector(
      ".payment-page__cta"
    );

  if (cta) {
    cta.before(error);
  }
}


// ========================================
// SUBMITTING STATE
// ========================================

function setSubmittingState(
  root,
  isSubmitting
) {
  const confirmButton =
    root.querySelector(
      "[data-payment-confirm]"
    );

  if (!confirmButton) {
    return;
  }


  confirmButton.disabled =
    isSubmitting;


  if (isSubmitting) {

    confirmButton.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>

      <span>
        Creando solicitud...
      </span>
    `;

    return;
  }


  confirmButton.innerHTML = `
    <span>
      Enviar solicitud de pago
    </span>

    <i class="fa-solid fa-arrow-right"></i>
  `;
}


// ========================================
// CREATE PAYMENT
// ========================================

async function handlePaymentConfirmation(
  root,
  billingData
) {
  const validation =
    validatePaymentForm(
      root
    );


  if (!validation.valid) {
    showError(
      root,
      validation.message
    );

    return;
  }


  setSubmittingState(
    root,
    true
  );


  try {

    /*
     * ======================================
     * IMPORTANT
     * ======================================
     *
     * El frontend NO define:
     *
     * - precio
     * - moneda oficial
     * - permisos
     * - estado final
     *
     * El backend es la autoridad.
     *
     * paymentDate y paymentTime representan
     * cuándo realizó el usuario el pago.
     *
     * createdAt representa automáticamente
     * cuándo NEXUS recibió la solicitud.
     */

    const payment =
      await createBillingPayment({

        subscriptionId:
          null,

        currentPlanId:
          PLAN_IDS.FREE,

        planId:
          PLAN_IDS.PRO,

        period:
          "monthly",

        method:
          validation.method,

        paymentDate:
          validation.paymentDate,

        paymentTime:
          validation.paymentTime,

        reference:
          validation.reference

      });


    if (!payment) {
      throw new Error(
        "No fue posible crear la solicitud de pago."
      );
    }


    root.innerHTML =
      renderSuccess(
        payment
      );


    bindSuccessEvents(
      root
    );

  } catch (error) {

    console.error(
      "NEXUS — Payment Page: error creando payment.",
      error
    );


    setSubmittingState(
      root,
      false
    );


    showError(
      root,
      error?.message ||
        "No fue posible crear la solicitud de pago."
    );
  }
}


// ========================================
// EVENTS
// ========================================

function bindPaymentMethodEvents(
  root
) {
  root
    .querySelectorAll(
      "[data-payment-method-card]"
    )
    .forEach(
      (card) => {

        const input =
          card.querySelector(
            'input[name="paymentMethod"]'
          );


        if (
          !input ||
          input.disabled
        ) {
          return;
        }


        input.addEventListener(
          "change",
          () => {

            root
              .querySelectorAll(
                "[data-payment-method-card]"
              )
              .forEach(
                (item) => {

                  item.classList.remove(
                    "payment-page__method--selected"
                  );

                }
              );


            if (input.checked) {

              card.classList.add(
                "payment-page__method--selected"
              );

            }

          }
        );

      }
    );
}


function bindPaymentEvents(
  root,
  billingData
) {
  root
    .querySelectorAll(
      "[data-payment-back]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          goBackToUpgrade
        );

      }
    );


  bindPaymentMethodEvents(
    root
  );


  const confirmButton =
    root.querySelector(
      "[data-payment-confirm]"
    );


  if (confirmButton) {

    confirmButton.addEventListener(
      "click",
      () => {

        handlePaymentConfirmation(
          root,
          billingData
        );

      }
    );

  }
}


function bindSuccessEvents(
  root
) {
  root
    .querySelectorAll(
      "[data-payment-billing]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          goToBilling
        );

      }
    );
}


// ========================================
// LOAD PAGE
// ========================================

async function renderPaymentContent(
  root
) {
  root.innerHTML =
    renderLoading();


  try {

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


    /*
     * ======================================
     * PAYMENT PAGE ONLY SUPPORTS FREE → PRO
     * ======================================
     */

    if (
      currentPlanId !==
      PLAN_IDS.FREE
    ) {

      root.innerHTML =
        renderError(
          "Esta página solo está disponible para cuentas Free que desean activar Pro."
        );


      root
        .querySelectorAll(
          "[data-payment-back]"
        )
        .forEach(
          (button) => {

            button.addEventListener(
              "click",
              goBackToBilling
            );

          }
        );


      return;
    }


    /*
     * ======================================
     * BILLING DATA
     * ======================================
     *
     * El precio puede no estar disponible
     * todavía en frontend.
     *
     * El backend continúa siendo la autoridad.
     */

    const billingData = {
      price:
        null,

      currency:
        "GTQ"
    };


    root.innerHTML =
      renderPaymentForm(
        billingData
      );


    bindPaymentEvents(
      root,
      billingData
    );

  } catch (error) {

    console.error(
      "NEXUS — Payment Page: error cargando página.",
      error
    );


    root.innerHTML =
      renderError(
        error?.message ||
          "No fue posible cargar la información de pago."
      );


    root
      .querySelectorAll(
        "[data-payment-back]"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            goBackToBilling
          );

        }
      );
  }
}


// ========================================
// BACK FROM ERROR
// ========================================

function goBackToBilling() {
  navigateTo(
    "/dashboard/billing"
  );
}


// ========================================
// PUBLIC PAGE
// ========================================

export function Payment() {

  const root =
    document.createElement(
      "div"
    );

  root.className =
    "payment-page-root";


  renderPaymentContent(
    root
  );


  return root;
}