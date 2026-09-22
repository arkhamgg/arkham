// ========================================
// ARKHAM — Admin Capabilities
// ========================================
//
// Catálogo administrativo de capacidades.
//
// Esta vista consume las fuentes de verdad
// existentes:
// - capabilities.js
// - capabilityStatus.js
// - productCapabilities.js
// - planCapabilities.js
// - products.js
// - plans.js
//
// La edición persistente se implementará cuando
// el catálogo deje de ser estático. Esta pantalla
// no crea una segunda fuente de verdad.
// ========================================

import { requireAdminPermission } from "../services/adminAccess.js";
import { CAPABILITIES } from "../services/capabilities.js";
import {
  CAPABILITY_GLOBAL_STATUS,
  CAPABILITY_STATUS
} from "../services/capabilityStatus.js";
import { PRODUCT_CAPABILITIES } from "../services/productCapabilities.js";
import { PLAN_CAPABILITIES } from "../services/planCapabilities.js";
import { PRODUCTS } from "../services/products.js";
import { PLANS } from "../services/plans.js";


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

function getCapabilityLabel(capability) {
  const labels = {
    "account.profile.view": "Ver perfil de cuenta",
    "account.profile.edit": "Editar perfil de cuenta",
    "account.security.manage": "Gestionar seguridad",
    "account.notifications.view": "Ver notificaciones",
    "account.settings.manage": "Gestionar configuración",
    "account.entities.manage": "Gestionar entidades",
    game_selection: "Selección de juego",
    competitive_modes: "Modos competitivos",
    participation_selection: "Selección de participación",
    format_selection: "Selección de formato",
    match_selection: "Sistema de partida",
    capacity_selection: "Selección de capacidad",
    rules: "Reglas",
    location: "Ubicación",
    date_time: "Fecha y hora",
    prize: "Premios",
    registration_cost: "Costo de inscripción",
    public_landing: "Landing pública",
    global_calendar: "Calendario global",
    public_registration: "Registro público",
    participant_management: "Gestión de participantes",
    nexus_player_search: "Búsqueda de jugadores ARKHAM",
    nexus_team_search: "Búsqueda de equipos ARKHAM",
    participation_requests: "Solicitudes de participación",
    dynamic_bracket: "Bracket dinámico",
    check_in: "Check-in",
    match_management: "Gestión de partidas",
    result_management: "Gestión de resultados",
    statistics: "Estadísticas",
    advanced_statistics: "Estadísticas avanzadas",
    verified_titles: "Títulos verificados",
    integrations: "Integraciones",
    season_management: "Gestión de temporadas",
    division_management: "Gestión de divisiones",
    matchday_management: "Gestión de jornadas",
    standings: "Clasificaciones",
    playoffs: "Playoffs"
  };

  return labels[capability] || String(capability || "")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function getStatus(capability) {
  return CAPABILITY_GLOBAL_STATUS[capability] || null;
}

function getStatusLabel(status) {
  if (status === CAPABILITY_STATUS.ACTIVE) return "Activa";
  if (status === CAPABILITY_STATUS.INACTIVE) return "Inactiva";
  return "No definida";
}

function getStatusModifier(status) {
  if (status === CAPABILITY_STATUS.ACTIVE) return "active";
  if (status === CAPABILITY_STATUS.INACTIVE) return "inactive";
  return "undefined";
}

function getProductsForCapability(capability) {
  return Object.values(PRODUCTS)
    .filter(product =>
      (PRODUCT_CAPABILITIES[product.id] || []).includes(capability)
    );
}

function getPlansForCapability(capability) {
  return Object.values(PLANS)
    .filter(plan =>
      Object.values(PLAN_CAPABILITIES[plan.id] || {})
        .some(capabilities => capabilities.includes(capability))
    );
}

function getCapabilityGroup(capability) {
  if (capability.startsWith("account.")) return "Cuenta";
  if ([
    CAPABILITIES.GAME_SELECTION,
    CAPABILITIES.COMPETITIVE_MODES,
    CAPABILITIES.PARTICIPATION_SELECTION,
    CAPABILITIES.FORMAT_SELECTION,
    CAPABILITIES.MATCH_SELECTION,
    CAPABILITIES.CAPACITY_SELECTION,
    CAPABILITIES.RULES,
    CAPABILITIES.LOCATION,
    CAPABILITIES.DATE_TIME,
    CAPABILITIES.PRIZE,
    CAPABILITIES.REGISTRATION_COST
  ].includes(capability)) return "Configuración";
  if ([
    CAPABILITIES.PUBLIC_LANDING,
    CAPABILITIES.GLOBAL_CALENDAR,
    CAPABILITIES.PUBLIC_REGISTRATION
  ].includes(capability)) return "Publicación";
  if ([
    CAPABILITIES.PARTICIPANT_MANAGEMENT,
    CAPABILITIES.NEXUS_PLAYER_SEARCH,
    CAPABILITIES.NEXUS_TEAM_SEARCH,
    CAPABILITIES.PARTICIPATION_REQUESTS
  ].includes(capability)) return "Participantes";
  if ([
    CAPABILITIES.DYNAMIC_BRACKET,
    CAPABILITIES.CHECK_IN,
    CAPABILITIES.MATCH_MANAGEMENT,
    CAPABILITIES.RESULT_MANAGEMENT
  ].includes(capability)) return "Operación";
  if ([
    CAPABILITIES.STATISTICS,
    CAPABILITIES.ADVANCED_STATISTICS,
    CAPABILITIES.VERIFIED_TITLES
  ].includes(capability)) return "Datos competitivos";
  if (capability === CAPABILITIES.INTEGRATIONS) return "Extensiones";
  if ([
    CAPABILITIES.SEASON_MANAGEMENT,
    CAPABILITIES.DIVISION_MANAGEMENT,
    CAPABILITIES.MATCHDAY_MANAGEMENT,
    CAPABILITIES.STANDINGS,
    CAPABILITIES.PLAYOFFS
  ].includes(capability)) return "Liga";
  return "General";
}


// ========================================
// PAGE
// ========================================

export function AdminCapabilities() {
  const page = document.createElement("main");
  page.className = "admin-capabilities-page";

  const capabilities = Object.values(CAPABILITIES);
  const activeCount = capabilities.filter(
    capability => getStatus(capability) === CAPABILITY_STATUS.ACTIVE
  ).length;
  const inactiveCount = capabilities.filter(
    capability => getStatus(capability) === CAPABILITY_STATUS.INACTIVE
  ).length;
  const undefinedCount = capabilities.length - activeCount - inactiveCount;

  page.innerHTML = `
    <section class="admin-capabilities">

      <header class="admin-capabilities__header">
        <div>
          <span class="admin-capabilities__eyebrow">ARKHAM ADMIN</span>
          <h1>Capacidades</h1>
          <p>
            Consulta las funcionalidades disponibles en ARKHAM,
            su estado global y las relaciones con productos y planes.
          </p>
        </div>

        <button
          type="button"
          class="admin-capabilities__back"
          data-admin-back
        >
          Volver
        </button>
      </header>

      <div class="admin-capabilities__message" data-admin-message></div>

      <section class="admin-capabilities__summary">
        <article>
          <span>Total</span>
          <strong>${capabilities.length}</strong>
        </article>
        <article>
          <span>Activas</span>
          <strong>${activeCount}</strong>
        </article>
        <article>
          <span>Inactivas</span>
          <strong>${inactiveCount}</strong>
        </article>
        <article>
          <span>Sin estado</span>
          <strong>${undefinedCount}</strong>
        </article>
      </section>

      <section class="admin-capabilities__toolbar">
        <label class="admin-capabilities__search">
          <span>⌕</span>
          <input
            type="search"
            placeholder="Buscar capacidad..."
            data-capability-search
          >
        </label>

        <div class="admin-capabilities__filters" data-capability-filters>
          <button type="button" class="is-active" data-capability-filter="all">Todas</button>
          <button type="button" data-capability-filter="active">Activas</button>
          <button type="button" data-capability-filter="inactive">Inactivas</button>
          <button type="button" data-capability-filter="undefined">Sin estado</button>
        </div>
      </section>

      <section class="admin-capabilities__list" data-capability-list>
        ${capabilities.map(capability => {
          const status = getStatus(capability);
          const products = getProductsForCapability(capability);
          const plans = getPlansForCapability(capability);

          return `
            <article
              class="admin-capability-card"
              data-capability-card
              data-capability-id="${escapeHtml(capability)}"
              data-capability-name="${escapeHtml(`${capability} ${getCapabilityLabel(capability)}`.toLowerCase())}"
              data-capability-status="${escapeHtml(status || "undefined")}"
            >
              <div class="admin-capability-card__top">
                <span class="admin-capability-card__indicator" aria-hidden="true"></span>
                <span class="admin-capability-card__group">
                  ${escapeHtml(getCapabilityGroup(capability))}
                </span>
                <span class="admin-capability-card__status admin-capability-card__status--${getStatusModifier(status)}">
                  ${escapeHtml(getStatusLabel(status))}
                </span>
              </div>

              <div class="admin-capability-card__body">
                <span class="admin-capability-card__id">${escapeHtml(capability)}</span>
                <h2>${escapeHtml(getCapabilityLabel(capability))}</h2>
              </div>

              <div class="admin-capability-card__meta">
                <div>
                  <span>Productos</span>
                  <strong>${products.length}</strong>
                </div>
                <div>
                  <span>Planes</span>
                  <strong>${plans.length}</strong>
                </div>
              </div>

              <button
                type="button"
                class="admin-capability-card__action"
                data-capability-detail="${escapeHtml(capability)}"
              >
                Ver capacidad
                <span aria-hidden="true">→</span>
              </button>
            </article>
          `;
        }).join("")}
      </section>

      <div class="admin-capabilities__empty" data-capability-empty hidden>
        <h2>No encontramos capacidades</h2>
        <p>Prueba con otro término o cambia el filtro.</p>
      </div>

    </section>
  `;

  const message = page.querySelector("[data-admin-message]");
  const search = page.querySelector("[data-capability-search]");
  const cards = [...page.querySelectorAll("[data-capability-card]")];
  const empty = page.querySelector("[data-capability-empty]");
  let currentFilter = "all";

  function applyFilters() {
    const query = String(search.value || "").trim().toLowerCase();
    let visible = 0;

    cards.forEach(card => {
      const matchesSearch = !query || card.dataset.capabilityName.includes(query);
      const matchesFilter =
        currentFilter === "all" || card.dataset.capabilityStatus === currentFilter;

      const show = matchesSearch && matchesFilter;
      card.hidden = !show;
      if (show) visible += 1;
    });

    empty.hidden = visible !== 0;
  }

  search.addEventListener("input", applyFilters);

  page.querySelectorAll("[data-capability-filter]").forEach(button => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.capabilityFilter;

      page.querySelectorAll("[data-capability-filter]").forEach(item => {
        item.classList.toggle("is-active", item === button);
      });

      applyFilters();
    });
  });

  function openDetail(capability) {
    const status = getStatus(capability);
    const products = getProductsForCapability(capability);
    const plans = getPlansForCapability(capability);

    const overlay = document.createElement("div");
    overlay.className = "admin-capabilities__modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    overlay.innerHTML = `
      <div class="admin-capabilities__modal-backdrop" data-close-capability></div>

      <section class="admin-capabilities__modal-card">
        <header class="admin-capabilities__modal-header">
          <div>
            <span class="admin-capabilities__eyebrow">CAPACIDAD</span>
            <h2>${escapeHtml(getCapabilityLabel(capability))}</h2>
            <code>${escapeHtml(capability)}</code>
          </div>

          <button
            type="button"
            class="admin-capabilities__modal-close"
            data-close-capability
            aria-label="Cerrar"
          >×</button>
        </header>

        <div class="admin-capabilities__modal-summary">
          <div>
            <span>Estado global</span>
            <strong class="admin-capabilities__modal-status admin-capabilities__modal-status--${getStatusModifier(status)}">
              ${escapeHtml(getStatusLabel(status))}
            </strong>
          </div>
          <div>
            <span>Productos</span>
            <strong>${products.length}</strong>
          </div>
          <div>
            <span>Planes</span>
            <strong>${plans.length}</strong>
          </div>
        </div>

        <div class="admin-capabilities__modal-content">
          <section>
            <span class="admin-capabilities__section-label">PRODUCTOS</span>
            <div class="admin-capabilities__chips">
              ${products.length
                ? products.map(product => `<span>${escapeHtml(product.name)}</span>`).join("")
                : `<em>Ningún producto asociado.</em>`}
            </div>
          </section>

          <section>
            <span class="admin-capabilities__section-label">PLANES</span>
            <div class="admin-capabilities__chips">
              ${plans.length
                ? plans.map(plan => `<span>${escapeHtml(plan.name)}</span>`).join("")
                : `<em>Ningún plan asociado.</em>`}
            </div>
          </section>
        </div>

        <div class="admin-capabilities__modal-note">
          <strong>Configuración actual</strong>
          <p>
            Esta capacidad proviene del catálogo estático de ARKHAM.
            La administración persistente de estado, productos y planes
            se habilitará cuando exista una fuente administrativa persistente.
          </p>
        </div>
      </section>
    `;

    const close = () => overlay.remove();
    overlay.querySelectorAll("[data-close-capability]").forEach(button => {
      button.addEventListener("click", close);
    });

    document.body.appendChild(overlay);
  }

  page.addEventListener("click", event => {
    const button = event.target.closest("[data-capability-detail]");
    if (!button) return;
    openDetail(button.dataset.capabilityDetail);
  });

  async function loadAccess() {
    try {
      await requireAdminPermission("capabilities.view");
    } catch (error) {
      console.error("ARKHAM — Admin Capabilities:", error);
      message.textContent = error?.message || "No tienes acceso a este módulo.";
    }
  }

  loadAccess();

  return page;
}
