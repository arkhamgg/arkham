// ========================================
// NEXUS — Admin Plans
// ========================================
//
// Catálogo administrativo de planes.
// Los planes definen la agrupación comercial
// de capacidades dentro de cada producto.
//
// Esta pantalla consulta la configuración
// existente en plans.js y planCapabilities.js.
// No crea una segunda fuente de verdad.
// ========================================

import { requireAdminPermission } from "../services/adminAccess.js";
import { PLANS } from "../services/plans.js";
import { PLAN_CAPABILITIES } from "../services/planCapabilities.js";
import { PRODUCTS } from "../services/products.js";


// ========================================
// HELPERS
// ========================================

function getPlanDescription(planId) {
  return PLANS[planId]?.description || "Plan disponible en NEXUS.";
}

function getPlanStatusLabel(status) {
  return status === "active" ? "Activo" : "Inactivo";
}

function getCapabilityLabel(capability) {
  return String(capability || "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function getProductLabel(productId) {
  return PRODUCTS[productId]?.name || productId;
}

function getPlanProducts(planId) {
  const planProducts = PLAN_CAPABILITIES[planId] || {};

  return Object.entries(PRODUCTS)
    .map(([productId, product]) => ({
      id: productId,
      name: product.name,
      status: product.status,
      capabilities: planProducts[productId] || []
    }));
}

function getTotalCapabilities(planId) {
  return Object.values(PLAN_CAPABILITIES[planId] || {})
    .reduce((total, capabilities) => total + capabilities.length, 0);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ========================================
// PAGE
// ========================================

export async function AdminPlans() {
  const page = document.createElement("main");
  page.className = "admin-plans-page";

  page.innerHTML = `
    <section class="admin-plans">

      <header class="admin-plans__header">
        <div>
          <span class="admin-plans__eyebrow">
            NEXUS ADMIN
          </span>

          <h1>Planes</h1>

          <p>
            Administra la estructura comercial de NEXUS
            y consulta las capacidades incluidas en cada plan.
          </p>
        </div>

        <button
          type="button"
          class="admin-plans__back"
          data-admin-back
        >
          Volver
        </button>
      </header>

      <div class="admin-plans__message" data-admin-message></div>

      <section class="admin-plans__intro">
        <div>
          <span class="admin-plans__section-label">CATÁLOGO</span>
          <h2>Planes NEXUS</h2>
          <p>
            Un plan agrupa capacidades. La disponibilidad final
            se resuelve según el producto y la cuenta.
          </p>
        </div>

        <div class="admin-plans__count">
          <strong>${Object.keys(PLANS).length}</strong>
          <span>Planes</span>
        </div>
      </section>

      <section class="admin-plans__grid" data-admin-plans>
        ${Object.values(PLANS).map(plan => {
          const totalCapabilities = getTotalCapabilities(plan.id);
          const productCount = getPlanProducts(plan.id)
            .filter(product => product.capabilities.length > 0)
            .length;

          return `
            <article
              class="admin-plans__card"
              data-plan-id="${escapeHtml(plan.id)}"
            >
              <div class="admin-plans__card-top">
                <span class="admin-plans__indicator" aria-hidden="true"></span>
                <span class="admin-plans__status">
                  ${escapeHtml(getPlanStatusLabel(plan.status))}
                </span>
              </div>

              <div class="admin-plans__card-content">
                <span class="admin-plans__id">
                  ${escapeHtml(plan.id)}
                </span>

                <h3>${escapeHtml(plan.name)}</h3>

                <p>
                  ${escapeHtml(plan.description)}
                </p>
              </div>

              <div class="admin-plans__card-meta">
                <div>
                  <strong>${totalCapabilities}</strong>
                  <span>Capacidades</span>
                </div>

                <div>
                  <strong>${productCount}</strong>
                  <span>Productos</span>
                </div>
              </div>

              <button
                type="button"
                class="admin-plans__card-action"
                data-plan-detail="${escapeHtml(plan.id)}"
              >
                Ver plan
                <span aria-hidden="true">→</span>
              </button>
            </article>
          `;
        }).join("")}
      </section>

    </section>
  `;

  const message = page.querySelector("[data-admin-message]");

  function renderDetail(planId) {
    const plan = PLANS[planId];

    if (!plan) {
      return;
    }

    const products = getPlanProducts(planId);

    const overlay = document.createElement("div");
    overlay.className = "admin-plans__overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    overlay.innerHTML = `
      <div class="admin-plans__backdrop" data-plan-close></div>

      <section class="admin-plans__modal">
        <header class="admin-plans__modal-header">
          <div>
            <span class="admin-plans__section-label">PLAN</span>
            <h2>${escapeHtml(plan.name)}</h2>
            <p>${escapeHtml(plan.description)}</p>
          </div>

          <button
            type="button"
            class="admin-plans__modal-close"
            data-plan-close
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div class="admin-plans__modal-summary">
          <div>
            <span>Estado</span>
            <strong>${escapeHtml(getPlanStatusLabel(plan.status))}</strong>
          </div>

          <div>
            <span>Identificador</span>
            <strong>${escapeHtml(plan.id)}</strong>
          </div>

          <div>
            <span>Capacidades</span>
            <strong>${getTotalCapabilities(plan.id)}</strong>
          </div>
        </div>

        <div class="admin-plans__products">
          <div class="admin-plans__products-heading">
            <span class="admin-plans__section-label">PRODUCTOS</span>
            <h3>Capacidades por producto</h3>
          </div>

          ${products.map(product => `
            <article class="admin-plans__product">
              <div class="admin-plans__product-header">
                <div>
                  <span>${escapeHtml(product.id)}</span>
                  <h4>${escapeHtml(getProductLabel(product.id))}</h4>
                </div>

                <strong>
                  ${product.capabilities.length}
                  ${product.capabilities.length === 1 ? "capacidad" : "capacidades"}
                </strong>
              </div>

              ${product.capabilities.length > 0
                ? `
                  <div class="admin-plans__capabilities">
                    ${product.capabilities.map(capability => `
                      <span>${escapeHtml(getCapabilityLabel(capability))}</span>
                    `).join("")}
                  </div>
                `
                : `
                  <div class="admin-plans__product-empty">
                    No hay capacidades configuradas para este producto.
                  </div>
                `
              }
            </article>
          `).join("")}
        </div>
      </section>
    `;

    document.body.appendChild(overlay);

    overlay.querySelectorAll("[data-plan-close]").forEach(button => {
      button.addEventListener("click", () => overlay.remove());
    });

    const onKeyDown = event => {
      if (event.key === "Escape") {
        overlay.remove();
        document.removeEventListener("keydown", onKeyDown);
      }
    };

    document.addEventListener("keydown", onKeyDown);
  }

  page.querySelectorAll("[data-plan-detail]").forEach(button => {
    button.addEventListener("click", () => {
      renderDetail(button.dataset.planDetail);
    });
  });

  page.querySelector("[data-admin-back]")?.addEventListener("click", () => {
    window.history.pushState({}, "", "/dashboard/admin");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  try {
    await requireAdminPermission("plans.view");
  } catch (error) {
    message.textContent = error.message || "No tienes acceso a este módulo.";
    page.querySelector("[data-admin-plans]").innerHTML = `
      <div class="admin-plans__error">
        <strong>Acceso no autorizado</strong>
        <p>No tienes permisos para consultar los planes.</p>
      </div>
    `;
  }

  return page;
}
