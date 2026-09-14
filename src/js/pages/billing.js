// ========================================
// NEXUS — Billing Page
// ========================================

import {
  getCurrentAccountContext
} from "../services/account.js";

import {
  getBillingSummary,
  BILLING_STATUS
} from "../services/billing.js";

import {
  PLAN_IDS
} from "../services/plans.js";

import {
  Navbar
} from "../components/navbar.js";


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


// ========================================
// PLAN LABEL
// ========================================

function getPlanLabel(planId) {

  switch (
    String(planId || "").toLowerCase()
  ) {

    case PLAN_IDS.PRO:
      return "Pro";

    case PLAN_IDS.CIRCUIT:
      return "Circuit";

    case PLAN_IDS.ENTERPRISE:
      return "Enterprise";

    case PLAN_IDS.FREE:
    default:
      return "Free";

  }

}


// ========================================
// BILLING STATUS LABEL
// ========================================

function getBillingStatusLabel(status) {

  switch (status) {

    case BILLING_STATUS.CURRENT:
      return "Activa";

    case BILLING_STATUS.PAYMENT_PENDING:
      return "Pago pendiente";

    case BILLING_STATUS.PAYMENT_UNDER_REVIEW:
      return "Pago en revisión";

    case BILLING_STATUS.PAYMENT_REJECTED:
      return "Pago rechazado";

    case BILLING_STATUS.PAST_DUE:
      return "Pago vencido";

    case BILLING_STATUS.GRACE_PERIOD:
      return "Período de gracia";

    case BILLING_STATUS.EXPIRED:
      return "Expirada";

    case BILLING_STATUS.SUSPENDED:
      return "Suspendida";

    case BILLING_STATUS.CANCELLED:
      return "Cancelada";

    default:
      return "Sin estado";

  }

}


// ========================================
// BILLING STATUS MODIFIER
// ========================================

function getBillingStatusModifier(status) {

  switch (status) {

    case BILLING_STATUS.CURRENT:
      return "active";

    case BILLING_STATUS.PAYMENT_PENDING:
      return "pending";

    case BILLING_STATUS.PAYMENT_UNDER_REVIEW:
      return "review";

    case BILLING_STATUS.PAYMENT_REJECTED:
      return "rejected";

    case BILLING_STATUS.PAST_DUE:
      return "past-due";

    case BILLING_STATUS.GRACE_PERIOD:
      return "grace";

    case BILLING_STATUS.EXPIRED:
      return "expired";

    case BILLING_STATUS.SUSPENDED:
      return "suspended";

    case BILLING_STATUS.CANCELLED:
      return "cancelled";

    default:
      return "default";

  }

}


// ========================================
// DATE FORMATTER
// ========================================

function formatDate(value) {

  if (!value) {

    return "—";

  }

  let date;

  if (
    value instanceof Date
  ) {

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


// ========================================
// CURRENCY FORMATTER
// ========================================

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

  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(
      numericAmount
    )
  ) {

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


// ========================================
// LOADING
// ========================================

function renderLoading() {

  return `
    <section class="billing-page">

      <div class="billing-page__container">

        <div class="billing-page__loading">

          <div class="billing-page__loading-icon">
            <i class="fa-solid fa-spinner fa-spin"></i>
          </div>

          <p>
            Cargando información de facturación...
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
    <section class="billing-page">

      <div class="billing-page__container">

        <div class="billing-page__error">

          <div class="billing-page__error-icon">
            <i class="fa-solid fa-circle-exclamation"></i>
          </div>

          <h1>
            No pudimos cargar Billing
          </h1>

          <p>
            ${escapeHtml(message)}
          </p>

          <button
            type="button"
            class="billing-page__retry"
            data-billing-retry
          >
            <i class="fa-solid fa-rotate-right"></i>
            Reintentar
          </button>

        </div>

      </div>

    </section>
  `;

}


// ========================================
// FREE PLAN
// ========================================

function renderFreePlan(
  account,
  summary
) {

  const planId =
    account?.planId ||
    summary?.planId ||
    PLAN_IDS.FREE;

  const planLabel =
    getPlanLabel(
      planId
    );

  const isRejected =
    summary?.status ===
    BILLING_STATUS.PAYMENT_REJECTED;

  const isUnderReview =
    summary?.status ===
    BILLING_STATUS.PAYMENT_UNDER_REVIEW;

  const statusLabel =
    isRejected
      ? "Pago rechazado"
      : isUnderReview
        ? "Pago en revisión"
        : "Activo";

  const statusModifier =
    isRejected
      ? "rejected"
      : isUnderReview
        ? "review"
        : "active";

  return `
    <section class="billing-page">

      <div class="billing-page__container">

        <!-- HEADER -->

        <header class="billing-page__header">

          <div>

            <span class="billing-page__eyebrow">
              BILLING
            </span>

            <h1>
              Suscripción
            </h1>

            <p>
              Administra el plan y la facturación
              de tu cuenta NEXUS.
            </p>

          </div>

        </header>


        <!-- CURRENT PLAN -->

        <section class="billing-page__section">

          <div class="billing-page__section-heading">

            <span>
              PLAN ACTUAL
            </span>

          </div>


          <article class="billing-page__plan-card">

            <div class="billing-page__plan-main">

              <div class="billing-page__plan-info">

                <div class="billing-page__plan-icon">
                  <i class="fa-solid fa-layer-group"></i>
                </div>

                <div>

                  <span class="billing-page__plan-label">
                    Plan actual
                  </span>

                  <h2>
                    ${escapeHtml(planLabel)}
                  </h2>

                  <p>
                    Acceso actual de tu cuenta NEXUS.
                  </p>

                </div>

              </div>


              <span
                class="
                  billing-page__status
                  billing-page__status--${statusModifier}
                "
              >
                ${escapeHtml(statusLabel)}
              </span>

            </div>


            <div class="billing-page__divider"></div>


            <div class="billing-page__plan-footer">

              <div>

                <strong>
                  Plan Free
                </strong>

                <span>
                  Comienza a utilizar NEXUS
                  sin una suscripción de pago.
                </span>

              </div>


              <button
                type="button"
                class="billing-page__upgrade-button"
                data-billing-upgrade
              >

                <span>
                  Actualizar a Pro
                </span>

                <i class="fa-solid fa-arrow-right"></i>

              </button>

            </div>

          </article>

        </section>


        ${
          summary?.status === BILLING_STATUS.PAYMENT_REJECTED
            ? `
              <section class="billing-page__section">

                <div class="billing-page__section-heading">

                  <span>
                    ESTADO DEL PAGO
                  </span>

                </div>

                <article class="billing-page__payment-alert billing-page__payment-alert--rejected">

                  <div class="billing-page__payment-alert-icon">
                    <i class="fa-solid fa-circle-xmark"></i>
                  </div>

                  <div class="billing-page__payment-alert-content">

                    <span class="billing-page__payment-alert-eyebrow">
                      PAGO RECHAZADO
                    </span>

                    <h2>
                      No pudimos aprobar tu pago.
                    </h2>

                    <p>
                      Tu solicitud para activar NEXUS Pro fue rechazada.
                      Revisa el motivo y, si lo deseas, realiza un nuevo intento.
                    </p>

                    <div class="billing-page__payment-alert-reason">

                      <span>
                        Motivo del rechazo
                      </span>

                      <strong>
                        ${escapeHtml(
                          summary?.rejectionReason ||
                          "No se proporcionó un motivo."
                        )}
                      </strong>

                    </div>

                    <div class="billing-page__payment-alert-actions">

                      <button
                        type="button"
                        class="billing-page__upgrade-button"
                        data-billing-retry-payment
                      >
                        <span>
                          Intentar nuevamente
                        </span>

                        <i class="fa-solid fa-arrow-right"></i>
                      </button>

                    </div>

                  </div>

                </article>

              </section>
            `
            : ""
        }


        <!-- PRO PREVIEW -->

        <section class="billing-page__section">

          <div class="billing-page__section-heading">

            <span>
              NEXUS PRO
            </span>

          </div>


          <article class="billing-page__pro-card">

            <div class="billing-page__pro-content">

              <span class="billing-page__pro-eyebrow">
                UPGRADE
              </span>

              <h2>
                Lleva tu operación
                al siguiente nivel.
              </h2>

              <p>
                Accede a las capacidades disponibles
                para organizaciones que necesitan
                operar sus competencias de forma
                profesional.
              </p>

              <button
                type="button"
                class="billing-page__pro-button"
                data-billing-upgrade
              >

                Actualizar a Pro

                <i class="fa-solid fa-arrow-right"></i>

              </button>

            </div>

          </article>

        </section>


        <!-- BILLING INFORMATION -->

        <section class="billing-page__section">

          <div class="billing-page__section-heading">

            <span>
              INFORMACIÓN DE BILLING
            </span>

          </div>


          <div class="billing-page__info-grid">

            <article class="billing-page__info-card">

              <div class="billing-page__info-icon">
                <i class="fa-solid fa-file-invoice-dollar"></i>
              </div>

              <div>

                <strong>
                  Estado
                </strong>

                <span>
                  ${escapeHtml(
                    getBillingStatusLabel(
                      summary?.status
                    )
                  )}
                </span>

              </div>

            </article>


            <article class="billing-page__info-card">

              <div class="billing-page__info-icon">
                <i class="fa-solid fa-calendar"></i>
              </div>

              <div>

                <strong>
                  Próximo billing
                </strong>

                <span>
                  ${formatDate(
                    summary?.nextBillingAt
                  )}
                </span>

              </div>

            </article>


            <article class="billing-page__info-card">

              <div class="billing-page__info-icon">
                <i class="fa-solid fa-money-bill"></i>
              </div>

              <div>

                <strong>
                  Último pago
                </strong>

                <span>
                  ${formatCurrency(
                    summary?.paymentAmount,
                    "GTQ"
                  )}
                </span>

              </div>

            </article>

          </div>

        </section>

      </div>

    </section>
  `;

}


// ========================================
// SUBSCRIBED PLAN
// ========================================

function renderSubscribedPlan(
  account,
  summary
) {

  const planLabel =
    getPlanLabel(
      summary?.planId ||
      account?.planId
    );

  const status =
    summary?.status;

  const statusLabel =
    getBillingStatusLabel(
      status
    );

  const statusModifier =
    getBillingStatusModifier(
      status
    );

  return `
    <section class="billing-page">

      <div class="billing-page__container">

        <!-- HEADER -->

        <header class="billing-page__header">

          <div>

            <span class="billing-page__eyebrow">
              BILLING
            </span>

            <h1>
              Suscripción
            </h1>

            <p>
              Consulta y administra el estado
              de tu suscripción NEXUS.
            </p>

          </div>

        </header>


        <!-- CURRENT PLAN -->

        <section class="billing-page__section">

          <div class="billing-page__section-heading">

            <span>
              PLAN ACTUAL
            </span>

          </div>


          <article class="billing-page__plan-card">

            <div class="billing-page__plan-main">

              <div class="billing-page__plan-info">

                <div class="billing-page__plan-icon">
                  <i class="fa-solid fa-crown"></i>
                </div>

                <div>

                  <span class="billing-page__plan-label">
                    Suscripción
                  </span>

                  <h2>
                    ${escapeHtml(planLabel)}
                  </h2>

                  <p>
                    Tu cuenta tiene una suscripción
                    asociada a este plan.
                  </p>

                </div>

              </div>


              <span
                class="
                  billing-page__status
                  billing-page__status--${statusModifier}
                "
              >
                ${escapeHtml(statusLabel)}
              </span>

            </div>


            <div class="billing-page__divider"></div>


            <div class="billing-page__subscription-grid">

              <div>

                <span>
                  Plan
                </span>

                <strong>
                  ${escapeHtml(planLabel)}
                </strong>

              </div>


              <div>

                <span>
                  Estado
                </span>

                <strong>
                  ${escapeHtml(statusLabel)}
                </strong>

              </div>


              <div>

                <span>
                  Período
                </span>

                <strong>
                  ${escapeHtml(
                    summary?.period ||
                    "monthly"
                  )}
                </strong>

              </div>


              <div>

                <span>
                  Próximo billing
                </span>

                <strong>
                  ${formatDate(
                    summary?.nextBillingAt
                  )}
                </strong>

              </div>

            </div>

          </article>

        </section>


        <!-- BILLING SUMMARY -->

        <section class="billing-page__section">

          <div class="billing-page__section-heading">

            <span>
              RESUMEN
            </span>

          </div>


          <div class="billing-page__info-grid">

            <article class="billing-page__info-card">

              <div class="billing-page__info-icon">
                <i class="fa-solid fa-shield-check"></i>
              </div>

              <div>

                <strong>
                  Acceso
                </strong>

                <span>
                  ${
                    summary?.hasAccess
                      ? "Acceso habilitado"
                      : "Acceso limitado"
                  }
                </span>

              </div>

            </article>


            <article class="billing-page__info-card">

              <div class="billing-page__info-icon">
                <i class="fa-solid fa-money-check-dollar"></i>
              </div>

              <div>

                <strong>
                  Pago
                </strong>

                <span>
                  ${
                    summary?.requiresPayment
                      ? "Pago requerido"
                      : "No requiere pago"
                  }
                </span>

              </div>

            </article>


            <article class="billing-page__info-card">

              <div class="billing-page__info-icon">
                <i class="fa-solid fa-receipt"></i>
              </div>

              <div>

                <strong>
                  Último pago
                </strong>

                <span>
                  ${formatCurrency(
                    summary?.paymentAmount,
                    "GTQ"
                  )}
                </span>

              </div>

            </article>

          </div>

        </section>

      </div>

    </section>
  `;

}


// ========================================
// EVENTS
// ========================================

function bindEvents(
  root
) {

  // ----------------------------------------
  // RETRY
  // ----------------------------------------

  const retryButton =
    root.querySelector(
      "[data-billing-retry]"
    );

  if (retryButton) {

    retryButton.addEventListener(
      "click",
      () => {

        renderBillingContent(
          root
        );

      }
    );

  }


  // ----------------------------------------
  // RETRY PAYMENT
  // ----------------------------------------

  const retryPaymentButton =
    root.querySelector(
      "[data-billing-retry-payment]"
    );

  if (retryPaymentButton) {

    retryPaymentButton.addEventListener(
      "click",
      () => {

        window.history.pushState(
          {},
          "",
          "/dashboard/billing/payment"
        );

        window.dispatchEvent(
          new PopStateEvent("popstate")
        );

      }
    );

  }


  // ----------------------------------------
  // UPGRADE
  // ----------------------------------------

  const upgradeButtons =
    root.querySelectorAll(
      "[data-billing-upgrade]"
    );

  upgradeButtons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          window.dispatchEvent(
            new CustomEvent(
              "nexus:billing-upgrade"
            )
          );

        }
      );

    }
  );

}


// ========================================
// LOAD CONTENT
// ========================================

async function renderBillingContent(
  root
) {

  root.innerHTML =
    renderLoading();

  try {

    // --------------------------------------
    // ACCOUNT
    // --------------------------------------

    const accountContext =
      await getCurrentAccountContext({
        includePayment: true
      });

    if (!accountContext) {

      root.innerHTML =
        renderError(
          "No fue posible obtener la información de tu cuenta."
        );

      bindEvents(
        root
      );

      return;

    }


    // --------------------------------------
    // ACCOUNT DATA
    // --------------------------------------

    const account =
      accountContext.account ||
      accountContext;


    // --------------------------------------
    // SUBSCRIPTION
    // --------------------------------------

    const subscription =
      accountContext.subscription ||
      account?.subscription ||
      null;


    // --------------------------------------
    // PAYMENT
    // --------------------------------------

    const payment =
      accountContext.payment ||
      null;


    // --------------------------------------
    // BILLING SUMMARY
    // --------------------------------------

    const summary =
      getBillingSummary(
        subscription,
        payment
      );


    // --------------------------------------
    // EFFECTIVE PLAN
    // --------------------------------------

    const planId =
      account?.planId ||
      summary?.planId ||
      PLAN_IDS.FREE;


    // --------------------------------------
    // RENDER
    // --------------------------------------

    if (
      String(planId).toLowerCase() ===
      PLAN_IDS.FREE
    ) {

      root.innerHTML =
        renderFreePlan(
          account,
          summary
        );

    } else {

      root.innerHTML =
        renderSubscribedPlan(
          account,
          summary
        );

    }


    // --------------------------------------
    // EVENTS
    // --------------------------------------

    bindEvents(
      root
    );

  } catch (error) {

    console.error(
      "NEXUS — Billing Page: error cargando información.",
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

export function Billing() {

  const root =
    document.createElement(
      "div"
    );

  root.className =
    "billing-page-root";

  // ========================================
  // HOME NAVIGATION
  // ========================================

  const navbar = Navbar();

  root.appendChild(navbar);

  /*
   * La página devuelve inmediatamente
   * el elemento al Router.
   *
   * La información se carga de forma
   * asíncrona dentro del mismo elemento.
   */

  renderBillingContent(
    root
  );

  return root;

}