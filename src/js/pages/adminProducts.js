// ========================================
// NEXUS — Admin Products
// ========================================
//
// Catálogo administrativo de productos.
// Los productos son las unidades principales
// de NEXUS: Tournament, League, Team y Player.
//
// La relación Producto × Capacidad vive en
// productCapabilities.js. Esta pantalla no
// modifica planes ni capacidades.
// ========================================

import { requireAdminPermission } from "../services/adminAccess.js";
import { PRODUCTS } from "../services/products.js";
import { PRODUCT_CAPABILITIES } from "../services/productCapabilities.js";


// ========================================
// HELPERS
// ========================================

function getProductDescription(productId) {
  const descriptions = {
    tournament: "Creación y gestión de torneos competitivos.",
    league: "Creación y gestión de ligas y estructuras competitivas.",
    team: "Perfil y estructura competitiva de equipos.",
    player: "Perfil y presencia competitiva de jugadores."
  };

  return descriptions[productId] || "Producto disponible en NEXUS.";
}

function getCapabilityLabel(capability) {
  return String(capability || "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function getCapabilityGroups(productId) {
  const capabilities = PRODUCT_CAPABILITIES[productId] || [];

  return [
    {
      title: "Capacidades",
      items: capabilities
    }
  ];
}

function getStatusLabel(status) {
  return status === "active" ? "Activo" : "Inactivo";
}


// ========================================
// PAGE
// ========================================

export function AdminProducts() {
  const page = document.createElement("main");
  page.className = "admin-products-page";

  page.innerHTML = `
    <section class="admin-products">

      <header class="admin-products__header">
        <div>
          <span class="admin-products__eyebrow">
            NEXUS ADMIN
          </span>

          <h1>Productos</h1>

          <p>
            Administra las unidades principales de NEXUS
            y consulta las capacidades disponibles para cada una.
          </p>
        </div>

        <button
          type="button"
          class="admin-products__back"
          data-admin-back
        >
          Volver
        </button>
      </header>

      <div class="admin-products__message" data-admin-message></div>

      <section class="admin-products__intro">
        <div>
          <span class="admin-products__section-label">CATÁLOGO</span>
          <h2>Productos NEXUS</h2>
          <p>
            Un producto define dónde puede utilizarse una capacidad.
            Los planes determinan posteriormente qué capacidades recibe cada cuenta.
          </p>
        </div>

        <div class="admin-products__count">
          <strong>${Object.keys(PRODUCTS).length}</strong>
          <span>Productos</span>
        </div>
      </section>

      <section class="admin-products__grid" data-admin-products>
        <div class="admin-products__loading">
          Cargando productos...
        </div>
      </section>

    </section>
  `;

  const grid = page.querySelector("[data-admin-products]");
  const message = page.querySelector("[data-admin-message]");

  function renderProducts() {
    const products = Object.values(PRODUCTS);

    if (!products.length) {
      grid.innerHTML = `
        <div class="admin-products__empty">
          <h2>No hay productos configurados.</h2>
          <p>El catálogo de productos de NEXUS está vacío.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(product => {
      const capabilities = PRODUCT_CAPABILITIES[product.id] || [];

      return `
        <article class="admin-product-card">
          <div class="admin-product-card__top">
            <span class="admin-product-card__indicator"></span>

            <span class="admin-product-card__status ${
              product.status === "active"
                ? "admin-product-card__status--active"
                : "admin-product-card__status--inactive"
            }">
              ${getStatusLabel(product.status)}
            </span>
          </div>

          <div class="admin-product-card__body">
            <span class="admin-product-card__id">
              ${product.id}
            </span>

            <h2>${product.name}</h2>

            <p>
              ${getProductDescription(product.id)}
            </p>
          </div>

          <div class="admin-product-card__meta">
            <div>
              <strong>${capabilities.length}</strong>
              <span>Capacidades</span>
            </div>

            <button
              type="button"
              data-product-detail="${product.id}"
            >
              Ver producto
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  function openDetail(productId) {
    const product = PRODUCTS[productId];
    if (!product) return;

    const capabilities = PRODUCT_CAPABILITIES[productId] || [];
    const groups = getCapabilityGroups(productId);

    const overlay = document.createElement("div");
    overlay.className = "admin-products__modal";
    overlay.innerHTML = `
      <div class="admin-products__modal-backdrop" data-close-product></div>

      <section
        class="admin-products__modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-product-modal-title"
      >
        <header class="admin-products__modal-header">
          <div>
            <span class="admin-products__eyebrow">PRODUCTO</span>
            <h2 id="admin-product-modal-title">${product.name}</h2>
            <p>${getProductDescription(product.id)}</p>
          </div>

          <button
            type="button"
            class="admin-products__modal-close"
            data-close-product
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div class="admin-products__modal-summary">
          <div>
            <span>ID</span>
            <strong>${product.id}</strong>
          </div>

          <div>
            <span>Estado</span>
            <strong>${getStatusLabel(product.status)}</strong>
          </div>

          <div>
            <span>Capacidades</span>
            <strong>${capabilities.length}</strong>
          </div>
        </div>

        <div class="admin-products__modal-content">
          ${groups.map(group => `
            <section>
              <span class="admin-products__section-label">
                ${group.title}
              </span>

              <div class="admin-products__capability-list">
                ${group.items.map(capability => `
                  <div class="admin-products__capability">
                    <span class="admin-products__capability-dot"></span>
                    <span>${getCapabilityLabel(capability)}</span>
                    <code>${capability}</code>
                  </div>
                `).join("")}
              </div>
            </section>
          `).join("")}
        </div>

        <footer class="admin-products__modal-footer">
          <p>
            Las asociaciones Producto × Capacidad se definen en el catálogo
            de capacidades de NEXUS. Los planes se administran por separado.
          </p>
        </footer>
      </section>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();

    overlay.querySelectorAll("[data-close-product]").forEach(element => {
      element.addEventListener("click", close);
    });

    document.addEventListener("keydown", function handleEscape(event) {
      if (event.key !== "Escape") return;
      close();
      document.removeEventListener("keydown", handleEscape);
    });
  }

  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-product-detail]");
    if (!button) return;

    openDetail(button.dataset.productDetail);
  });

  page.querySelector("[data-admin-back]")?.addEventListener("click", () => {
    window.history.pushState({}, "", "/dashboard/admin");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  async function load() {
    try {
      await requireAdminPermission("products.view");
      renderProducts();
    } catch (error) {
      console.error("NEXUS — Admin Products:", error);
      message.textContent = error?.message || "No tienes permisos para consultar productos.";
      grid.innerHTML = `
        <div class="admin-products__error">
          <h2>Acceso no autorizado</h2>
          <p>
            No tienes permisos para consultar el catálogo de productos.
          </p>
        </div>
      `;
    }
  }

  load();

  return page;
}
