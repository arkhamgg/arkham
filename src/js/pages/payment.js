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


function getCurrentDateTime() {

  return new Date();

}


function formatAutomaticDate(
  date
) {

  return new Intl.DateTimeFormat(
    "es-GT",
    {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }
  ).format(date);

}


function formatAutomaticTime(
  date
) {

  return new Intl.DateTimeFormat(
    "es-GT",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  ).format(date);

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
            class="payment-page__secondary-button"
            data-payment-back
          >

            <i class="fa-solid fa-arrow-left"></i>

            Volver a Upgrade

          </button>

        </div>

      </div>

    </section>
  `;

}


// ========================================
// HEADER
// ========================================

function renderHeader() {

  return `
    <header class="payment-page__header">

      <div>

        <span class="payment-page__eyebrow">
          NEXUS BILLING
        </span>

        <h1>
          Actualizar a Pro
        </h1>

        <p>
          Selecciona tu método de pago para
          solicitar la activación de NEXUS Pro.
        </p>

      </div>

    </header>
  `;

}


// ========================================
// PLAN SUMMARY
// ========================================

function renderPlanSummary(
  price,
  currency
) {

  return `
    <section class="payment-page__section">

      <div class="payment-page__section-heading">

        <span>
          RESUMEN
        </span>

      </div>


      <article class="payment-page__summary-card">

        <div class="payment-page__summary-main">

          <div class="payment-page__summary-icon">

            <i class="fa-solid fa-crown"></i>

          </div>


          <div>

            <span class="payment-page__summary-label">
              PLAN PROFESIONAL
            </span>

            <h2>
              NEXUS Pro
            </h2>

            <p>
              Suscripción mensual
            </p>

          </div>

        </div>


        <div class="payment-page__summary-price">

          <span>
            TOTAL
          </span>

          <strong>
            ${escapeHtml(
              formatCurrency(
                price,
                currency
              )
            )}
          </strong>

          <small>
            / mes
          </small>

        </div>

      </article>

    </section>
  `;

}


// ========================================
// PAYMENT METHODS
// ========================================

function renderPaymentMethods() {

  return `
    <section class="payment-page__section">

      <div class="payment-page__section-heading">

        <span>
          MÉTODO DE PAGO
        </span>

      </div>


      <div class="payment-page__methods">


        <!-- ==================================
             BANK TRANSFER
        =================================== -->

        <label
          class="payment-page__method"
          data-payment-method-card
        >

          <input
            type="radio"
            name="paymentMethod"
            value="${PAYMENT_METHODS.BANK_TRANSFER}"
          >

          <span class="payment-page__method-radio"></span>


          <span class="payment-page__method-content">

            <span class="payment-page__method-icon">

              <i class="fa-solid fa-building-columns"></i>

            </span>


            <span>

              <strong>
                Transferencia bancaria
              </strong>

              <small>
                Realiza una transferencia y adjunta
                tu comprobante.
              </small>

            </span>

          </span>

        </label>


        <!-- ==================================
             BANK DEPOSIT
        =================================== -->

        <label
          class="payment-page__method"
          data-payment-method-card
        >

          <input
            type="radio"
            name="paymentMethod"
            value="${PAYMENT_METHODS.BANK_DEPOSIT}"
          >

          <span class="payment-page__method-radio"></span>


          <span class="payment-page__method-content">

            <span class="payment-page__method-icon">

              <i class="fa-solid fa-money-bill-transfer"></i>

            </span>


            <span>

              <strong>
                Depósito bancario
              </strong>

              <small>
                Realiza el depósito y adjunta
                tu comprobante.
              </small>

            </span>

          </span>

        </label>


        <!-- ==================================
             CARD — FUTURE
        =================================== -->

        <label
          class="payment-page__method payment-page__method--disabled"
          data-payment-method-card
        >

          <input
            type="radio"
            name="paymentMethod"
            value="${PAYMENT_METHODS.CARD}"
            disabled
          >

          <span class="payment-page__method-radio"></span>


          <span class="payment-page__method-content">

            <span class="payment-page__method-icon">

              <i class="fa-regular fa-credit-card"></i>

            </span>


            <span>

              <strong>
                Tarjeta
              </strong>

              <small>
                Pago con tarjeta mediante Stripe.
                Próximamente.
              </small>

            </span>

          </span>


          <span class="payment-page__method-badge">
            PRÓXIMAMENTE
          </span>

        </label>


      </div>

    </section>
  `;

}


// ========================================
// AUTOMATIC TIMESTAMP
// ========================================

function renderAutomaticTimestamp(
  date
) {

  return `
    <section class="payment-page__section">

      <div class="payment-page__section-heading">

        <span>
          REGISTRO DE SOLICITUD
        </span>

      </div>


      <article class="payment-page__timestamp-card">

        <div class="payment-page__timestamp-icon">

          <i class="fa-solid fa-clock"></i>

        </div>


        <div>

          <span class="payment-page__timestamp-label">
            FECHA Y HORA
          </span>

          <strong>
            ${escapeHtml(
              formatAutomaticDate(date)
            )}
          </strong>

          <small>
            ${escapeHtml(
              formatAutomaticTime(date)
            )}
          </small>

          <p>
            Este momento se registra automáticamente
            al iniciar tu solicitud de pago.
          </p>

        </div>

      </article>

    </section>
  `;

}


// ========================================
// PAYMENT NOTE
// ========================================

function renderPaymentNote() {

  return `
    <div class="payment-page__notice">

      <div class="payment-page__notice-icon">

        <i class="fa-solid fa-circle-info"></i>

      </div>

      <div>

        <strong>
          Importante
        </strong>

        <p>
          La activación de Pro no es automática.
          Después de enviar tu solicitud, el pago
          quedará pendiente de revisión por NEXUS.
        </p>

      </div>

    </div>
  `;

}


// ========================================
// CTA
// ========================================

function renderCTA() {

  return `
    <section class="payment-page__cta">

      <div class="payment-page__cta-content">

        <span class="payment-page__eyebrow">
          CONFIRMAR SOLICITUD
        </span>

        <h2>
          Continúa con tu actualización.
        </h2>

        <p>
          Selecciona un método de pago para
          continuar.
        </p>

      </div>


      <div class="payment-page__cta-actions">

        <button
          type="button"
          class="payment-page__secondary-button"
          data-payment-back
        >

          <i class="fa-solid fa-arrow-left"></i>

          Volver

        </button>


        <button
          type="button"
          class="payment-page__primary-button"
          data-payment-confirm
        >

          <span>
            Continuar
          </span>

          <i class="fa-solid fa-arrow-right"></i>

        </button>

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

  return `
    <section class="payment-page">

      <div class="payment-page__container">

        <div class="payment-page__success">

          <div class="payment-page__success-icon">

            <i class="fa-solid fa-check"></i>

          </div>


          <span class="payment-page__eyebrow">
            NEXUS BILLING
          </span>


          <h1>
            Solicitud creada
          </h1>


          <p>
            Tu solicitud de actualización a Pro
            fue registrada correctamente.
          </p>


          <div class="payment-page__success-status">

            <span>
              ESTADO
            </span>

            <strong>
              PENDIENTE
            </strong>

          </div>


          <p class="payment-page__success-note">
            La activación de tu plan quedará sujeta
            a la revisión y aprobación del pago.
          </p>


          <button
            type="button"
            class="payment-page__primary-button"
            data-payment-billing
          >

            <span>
              Ir a Billing
            </span>

            <i class="fa-solid fa-arrow-right"></i>

          </button>

        </div>

      </div>

    </section>
  `;

}


// ========================================
// NAVIGATION
// ========================================

function goBackToUpgrade() {

  window.history.pushState(
    {},
    "",
    "/dashboard/billing/upgrade"
  );

  window.dispatchEvent(
    new PopStateEvent("popstate")
  );

}


function goToBilling() {

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
// VALIDATION
// ========================================

function validatePaymentMethod(
  root
) {

  const selected =
    root.querySelector(
      'input[name="paymentMethod"]:checked'
    );

  if (!selected) {

    return {
      valid: false,
      message:
        "Selecciona un método de pago para continuar."
    };

  }


  return {
    valid: true,
    method: selected.value
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
    document.createElement("div");

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
// CREATE PAYMENT
// ========================================

async function handlePaymentConfirmation(
  root,
  billingData
) {

  const validation =
    validatePaymentMethod(root);


  if (!validation.valid) {

    showError(
      root,
      validation.message
    );

    return;

  }


  const confirmButton =
    root.querySelector(
      "[data-payment-confirm]"
    );


  if (confirmButton) {

    confirmButton.disabled =
      true;

    confirmButton.innerHTML = `

      <i class="fa-solid fa-spinner fa-spin"></i>

      <span>
        Creando solicitud...
      </span>

    `;

  }


  try {

    const now =
      getCurrentDateTime();


    /*
     * El frontend NO define el precio.
     *
     * El backend determina el precio oficial
     * mediante billingConfig.
     */


    const payment =
      await createBillingPayment({

        planId:
          PLAN_IDS.PRO,

        period:
          "monthly",

        method:
          validation.method,

        paymentDate:
          now.toISOString(),

        paymentTime:
          now.toISOString(),

        subscriptionId:
          null

      });


    root.innerHTML =
      renderSuccess(
        payment
      );


    bindEvents(
      root,
      billingData
    );


  } catch (error) {

    console.error(
      "NEXUS — Payment Page: error creando payment.",
      error
    );


    if (confirmButton) {

      confirmButton.disabled =
        false;

      confirmButton.innerHTML = `

        <span>
          Intentar nuevamente
        </span>

        <i class="fa-solid fa-arrow-right"></i>

      `;

    }


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

function bindEvents(
  root,
  billingData
) {

  // --------------------------------------
  // BACK
  // --------------------------------------

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


  // --------------------------------------
  // BILLING
  // --------------------------------------

  const billingButton =
    root.querySelector(
      "[data-payment-billing]"
    );

  if (billingButton) {

    billingButton.addEventListener(
      "click",
      goToBilling
    );

  }


  // --------------------------------------
  // PAYMENT METHODS
  // --------------------------------------

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


        if (!input || input.disabled) {

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


  // --------------------------------------
  // CONFIRM
  // --------------------------------------

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


// ========================================
// LOAD PAGE
// ========================================

async function renderPaymentContent(
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
    // CURRENT PLAN
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
    // BILLING CONFIG
    // ------------------------------------

    /*
     * IMPORTANTE:
     *
     * El precio oficial NO se hardcodea aquí.
     *
     * En este paso mostramos un placeholder
     * hasta que conectemos el endpoint/config
     * de precio del backend.
     *
     * El Payment API sigue siendo la autoridad
     * final del precio.
     */

    const billingData = {

      price: null,

      currency: "GTQ"

    };


    const now =
      getCurrentDateTime();


    // ------------------------------------
    // RENDER
    // ------------------------------------

    root.innerHTML = `

      <section class="payment-page">

        <div class="payment-page__container">

          ${renderHeader()}

          ${renderPlanSummary(
            billingData.price,
            billingData.currency
          )}

          ${renderPaymentMethods()}

          ${renderAutomaticTimestamp(
            now
          )}

          ${renderPaymentNote()}

          ${renderCTA()}

        </div>

      </section>

    `;


    bindEvents(
      root,
      billingData
    );


  } catch (error) {

    console.error(
      "NEXUS — Payment Page: error cargando información.",
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