// ========================================
// NEXUS — Upgrade to Pro Page
// ========================================


import {
  getCurrentAccountContext
} from "../services/account.js";

import {
  PLAN_IDS
} from "../services/plans.js";


// ========================================
// HELPERS
// ========================================

function escapeHtml(
  value = ""
) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// ========================================
// NAVIGATION
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


function goToPayment() {

  window.history.pushState(
    {},
    "",
    "/dashboard/billing/payment"
  );

  window.dispatchEvent(
    new PopStateEvent("popstate")
  );

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

          <span class="upgrade-page__eyebrow">
            NEXUS BILLING
          </span>

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
// HEADER
// ========================================

function renderHeader() {

  return `
    <header class="upgrade-page__header">

      <div>

        <span class="upgrade-page__eyebrow">
          NEXUS PRO
        </span>

        <h1>
          Evoluciona tu operación.
        </h1>

        <p>
          Compara los planes disponibles y descubre
          lo que obtienes al llevar tu operación
          competitiva a NEXUS Pro.
        </p>

      </div>

    </header>
  `;

}


// ========================================
// PLAN COMPARISON
// ========================================

function renderPlanComparison() {

  return `
    <section class="upgrade-page__section">

      <div class="upgrade-page__section-heading">

        <span>
          COMPARACIÓN DE PLANES
        </span>

      </div>


      <div class="upgrade-page__comparison">


        <!-- ==================================
             FREE
        =================================== -->

        <article
          class="
            upgrade-page__plan-card
            upgrade-page__plan-card--free
          "
        >

          <div class="upgrade-page__plan-top">

            <div>

              <span class="upgrade-page__plan-label">
                PLAN ACTUAL
              </span>

              <h2>
                Free
              </h2>

            </div>

            <div class="upgrade-page__plan-icon">

              <i class="fa-solid fa-user"></i>

            </div>

          </div>


          <p class="upgrade-page__plan-description">

            Comienza a utilizar NEXUS y construye
            tu presencia competitiva.

          </p>


          <div class="upgrade-page__divider"></div>


          <ul class="upgrade-page__feature-list">

            <li>

              <i class="fa-solid fa-check"></i>

              <span>
                Crear y administrar competencias
                disponibles para el plan Free.
              </span>

            </li>

            <li>

              <i class="fa-solid fa-check"></i>

              <span>
                Publicar tus competencias en NEXUS.
              </span>

            </li>

            <li>

              <i class="fa-solid fa-check"></i>

              <span>
                Construir tu presencia dentro
                del ecosistema NEXUS.
              </span>

            </li>

          </ul>


          <div class="upgrade-page__plan-footer">

            <span>
              Tu plan actual
            </span>

            <strong>
              Free
            </strong>

          </div>

        </article>


        <!-- ==================================
             PRO
        =================================== -->

        <article
          class="
            upgrade-page__plan-card
            upgrade-page__plan-card--pro
          "
        >

          <div class="upgrade-page__pro-badge">

            <i class="fa-solid fa-crown"></i>

            RECOMENDADO

          </div>


          <div class="upgrade-page__plan-top">

            <div>

              <span class="upgrade-page__plan-label">
                PLAN PROFESIONAL
              </span>

              <h2>
                Pro
              </h2>

            </div>

            <div class="upgrade-page__plan-icon">

              <i class="fa-solid fa-crown"></i>

            </div>

          </div>


          <p class="upgrade-page__plan-description">

            Diseñado para organizaciones que necesitan
            operar competencias de forma profesional,
            con mayor capacidad y control.

          </p>


          <div class="upgrade-page__divider"></div>


          <ul class="upgrade-page__feature-list">

            <li>

              <i class="fa-solid fa-check"></i>

              <span>
                Todas las capacidades disponibles
                del plan Free.
              </span>

            </li>

            <li>

              <i class="fa-solid fa-check"></i>

              <span>
                Capacidades operativas avanzadas
                para la gestión de competencias.
              </span>

            </li>

            <li>

              <i class="fa-solid fa-check"></i>

              <span>
                Mayor capacidad para administrar
                operaciones competitivas.
              </span>

            </li>

            <li>

              <i class="fa-solid fa-check"></i>

              <span>
                Acceso a capacidades Pro según
                la configuración de NEXUS.
              </span>

            </li>

          </ul>


          <div class="upgrade-page__plan-footer">

            <span>
              Disponible para actualizar
            </span>

            <strong>
              Pro
            </strong>

          </div>

        </article>


      </div>

    </section>
  `;

}


// ========================================
// VALUE PROPOSITION
// ========================================

function renderValueSection() {

  return `
    <section class="upgrade-page__section">

      <div class="upgrade-page__section-heading">

        <span>
          ¿POR QUÉ PRO?
        </span>

      </div>


      <div class="upgrade-page__value-grid">


        <article class="upgrade-page__value-card">

          <div class="upgrade-page__value-icon">

            <i class="fa-solid fa-sliders"></i>

          </div>

          <h3>
            Más control
          </h3>

          <p>
            Obtén acceso a capacidades diseñadas
            para administrar operaciones competitivas
            con mayor control.
          </p>

        </article>


        <article class="upgrade-page__value-card">

          <div class="upgrade-page__value-icon">

            <i class="fa-solid fa-chart-line"></i>

          </div>

          <h3>
            Operación profesional
          </h3>

          <p>
            Lleva tus competencias desde una gestión
            básica hacia una operación competitiva
            más estructurada.
          </p>

        </article>


        <article class="upgrade-page__value-card">

          <div class="upgrade-page__value-icon">

            <i class="fa-solid fa-bolt"></i>

          </div>

          <h3>
            Más capacidades
          </h3>

          <p>
            Activa las capacidades disponibles para
            Pro mediante el sistema central de
            entitlements de NEXUS.
          </p>

        </article>


      </div>

    </section>
  `;

}


// ========================================
// CTA
// ========================================

function renderCTA() {

  return `
    <section class="upgrade-page__cta">

      <div class="upgrade-page__cta-content">

        <span class="upgrade-page__eyebrow">
          NEXUS PRO
        </span>

        <h2>
          ¿Listo para continuar?
        </h2>

        <p>
          Selecciona tu método de pago y envía
          tu solicitud de activación.
        </p>

      </div>


      <div class="upgrade-page__cta-actions">

        <button
          type="button"
          class="upgrade-page__secondary-button"
          data-upgrade-back
        >

          <i class="fa-solid fa-arrow-left"></i>

          Volver

        </button>


        <button
          type="button"
          class="upgrade-page__primary-button"
          data-upgrade-payment
        >

          <span>
            Continuar con Pro
          </span>

          <i class="fa-solid fa-arrow-right"></i>

        </button>

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


  // --------------------------------------
  // BACK
  // --------------------------------------

  root
    .querySelectorAll(
      "[data-upgrade-back]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          goBackToBilling
        );

      }
    );


  // --------------------------------------
  // PAYMENT
  // --------------------------------------

  const paymentButton =
    root.querySelector(
      "[data-upgrade-payment]"
    );


  if (paymentButton) {

    paymentButton.addEventListener(
      "click",
      goToPayment
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
      currentPlanId !==
      PLAN_IDS.FREE
    ) {

      root.innerHTML =
        renderError(
          "Tu cuenta no está disponible para este Upgrade."
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

          ${renderPlanComparison()}

          ${renderValueSection()}

          ${renderCTA()}

        </div>

      </section>

    `;


    bindEvents(root);


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


    bindEvents(root);

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