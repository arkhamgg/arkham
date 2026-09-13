// ========================================
// NEXUS — Admin Dashboard
// ========================================
//
// Panel central de administración.
//
// Arquitectura:
//
// Authentication
//      ↓
// adminAccess
//      ↓
// Role
//      ↓
// Permissions
//      ↓
// Admin Dashboard
//
// ========================================

import {
  requireAdminAccess
} from "../services/adminAccess.js";


// ========================================
// ADMIN MODULES
// ========================================

const ADMIN_MODULES = [

  {
    id: "accounts",
    title: "Cuentas",
    description:
      "Consulta y administra las cuentas de NEXUS.",
    permission:
      "accounts.view",
    path:
      "/dashboard/admin/accounts"
  },

  {
    id: "staff",
    title: "Staff",
    description:
      "Administra los usuarios administrativos.",
    permission:
      "staff.view",
    path:
      "/dashboard/admin/staff"
  },

  {
    id: "products",
    title: "Productos",
    description:
      "Gestiona los productos disponibles en NEXUS.",
    permission:
      "products.view",
    path:
      "/dashboard/admin/products"
  },

  {
    id: "plans",
    title: "Planes",
    description:
      "Administra los planes comerciales.",
    permission:
      "plans.view",
    path:
      "/dashboard/admin/plans"
  },

  {
    id: "capabilities",
    title: "Capacidades",
    description:
      "Controla las capacidades globales del sistema.",
    permission:
      "capabilities.view",
    path:
      "/dashboard/admin/capabilities"
  },

  {
    id: "subscriptions",
    title: "Suscripciones",
    description:
      "Consulta y administra suscripciones.",
    permission:
      "subscriptions.view",
    path:
      "/dashboard/admin/subscriptions"
  },

  {
    id: "payments",
    title: "Payments",
    description:
      "Revisa y gestiona los pagos recibidos.",
    permission:
      "payments.view",
    path:
      "/dashboard/admin/payments"
  },

  {
    id: "billing",
    title: "Billing",
    description:
      "Configura y administra la facturación.",
    permission:
      "billing.view",
    path:
      "/dashboard/admin/billing"
  },

  {
    id: "audit",
    title: "Auditoría",
    description:
      "Consulta las acciones administrativas.",
    permission:
      "audit.view",
    path:
      "/dashboard/admin/audit"
  }

];


// ========================================
// PAGE
// ========================================

export function Admin() {

  const page =
    document.createElement("main");

  page.className =
    "admin-page";


  page.innerHTML = `

    <section class="admin">

      <header class="admin__header">

        <div class="admin__header-content">

          <span class="admin__eyebrow">
            NEXUS ADMIN
          </span>

          <h1 class="admin__title">
            Administración
          </h1>

          <p class="admin__description">
            Centro de control para gestionar
            cuentas, productos, planes,
            capacidades, suscripciones y billing.
          </p>

        </div>

        <div class="admin__header-actions">

          <button
            type="button"
            class="admin__back"
            data-admin-back
          >
            Volver al Dashboard
          </button>

        </div>

      </header>


      <div
        class="admin__status"
        data-admin-status
      ></div>


      <section
        class="admin__modules"
        data-admin-modules
      >

        <div class="admin__loading">
          Verificando acceso administrativo...
        </div>

      </section>

    </section>

  `;


  const modulesContainer =
    page.querySelector(
      "[data-admin-modules]"
    );

  const statusContainer =
    page.querySelector(
      "[data-admin-status]"
    );


  // ========================================
  // RENDER MODULES
  // ========================================

  function renderModules(
    access
  ) {

    const availableModules =
      ADMIN_MODULES.filter(
        module =>
          access.permissions?.includes(
            module.permission
          )
      );


    if (!availableModules.length) {

      modulesContainer.innerHTML = `

        <div class="admin__empty">

          <div class="admin__empty-icon">
            !
          </div>

          <h2>
            Sin módulos disponibles
          </h2>

          <p>
            Tu rol administrativo no tiene
            módulos disponibles actualmente.
          </p>

        </div>

      `;

      return;

    }


    modulesContainer.innerHTML = `

      <div class="admin__grid">

        ${
          availableModules
            .map(
              module => `

                <article
                  class="admin-card"
                  data-admin-module="${
                    module.id
                  }"
                  data-admin-path="${
                    module.path
                  }"
                >

                  <div class="admin-card__top">

                    <span
                      class="admin-card__indicator"
                    ></span>

                    <span
                      class="admin-card__status"
                    >
                      Disponible
                    </span>

                  </div>


                  <div class="admin-card__body">

                    <h2 class="admin-card__title">
                      ${
                        module.title
                      }
                    </h2>

                    <p class="admin-card__description">
                      ${
                        module.description
                      }
                    </p>

                  </div>


                  <div class="admin-card__footer">

                    <span>
                      Administrar
                    </span>

                    <span
                      class="admin-card__arrow"
                    >
                      →
                    </span>

                  </div>

                </article>

              `
            )
            .join("")
        }

      </div>

    `;

  }


  // ========================================
  // LOAD
  // ========================================

  async function load() {

    try {

      const access =
        await requireAdminAccess();


      // ------------------------------------
      // HEADER STATUS
      // ------------------------------------

      statusContainer.innerHTML = `

        <div class="admin__identity">

          <span class="admin__identity-label">
            Sesión administrativa
          </span>

          <strong>
            ${
              access.displayName ||
              access.email ||
              "Administrador"
            }
          </strong>

        </div>


        <div class="admin__role">

          <span class="admin__role-label">
            Rol
          </span>

          <strong>
            ${
              access.roleId ===
              "administrator"

                ? "Administrator"

                : "Agent"
            }
          </strong>

        </div>

      `;


      // ------------------------------------
      // MODULES
      // ------------------------------------

      renderModules(
        access
      );


    } catch (error) {

      console.error(
        "NEXUS — Admin Dashboard:",
        error
      );


      statusContainer.innerHTML = "";


      modulesContainer.innerHTML = `

        <div class="admin__error">

          <div class="admin__error-icon">
            !
          </div>

          <h2>
            Acceso no autorizado
          </h2>

          <p>
            ${
              error?.message ||
              "No tienes permisos para acceder al panel administrativo."
            }
          </p>

          <button
            type="button"
            data-admin-back
          >
            Volver
          </button>

        </div>

      `;

    }

  }


  // ========================================
  // EVENTS
  // ========================================

  page.addEventListener(
    "click",
    event => {

      // ------------------------------------
      // BACK
      // ------------------------------------

      const backButton =
        event.target.closest(
          "[data-admin-back]"
        );


      if (backButton) {

        window.history.back();

        return;

      }


      // ------------------------------------
      // MODULE
      // ------------------------------------

      const moduleCard =
        event.target.closest(
          "[data-admin-module]"
        );


      if (!moduleCard) {

        return;

      }


      const path =
        moduleCard.dataset.adminPath;


      if (!path) {

        return;

      }


      window.history.pushState(
        {},
        "",
        path
      );


      window.dispatchEvent(
        new PopStateEvent(
          "popstate"
        )
      );

    }
  );


  // ========================================
  // INITIAL LOAD
  // ========================================

  load();


  return page;

}