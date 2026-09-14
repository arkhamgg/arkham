// ========================================
// NEXUS — Admin Subscriptions
// ========================================

import {
  getAdminSubscriptions,
  getSubscriptionStatusLabel,
  getPlanLabel
} from "../services/adminSubscriptions.js";

export function AdminSubscriptions() {
  const page = document.createElement("main");
  page.className = "admin-subscriptions-page";

  page.innerHTML = `
    <section class="admin-subscriptions">
      <header class="admin-subscriptions__header">
        <div>
          <span class="admin-subscriptions__eyebrow">NEXUS ADMIN</span>
          <h1>Suscripciones</h1>
          <p>Consulta el estado de las suscripciones y sus ciclos de facturación.</p>
        </div>
        <div class="admin-subscriptions__header-actions">
          <button type="button" data-admin-back>Volver</button>
          <button type="button" data-subscriptions-refresh>
            <i class="fa-solid fa-rotate" aria-hidden="true"></i> Actualizar
          </button>
        </div>
      </header>

      <div class="admin-subscriptions__message" data-admin-message></div>

      <section class="admin-subscriptions__summary">
        <article><span>Total</span><strong data-count-total>—</strong></article>
        <article><span>Activas</span><strong data-count-active>—</strong></article>
        <article><span>Pendientes</span><strong data-count-pending>—</strong></article>
        <article><span>Problemáticas</span><strong data-count-problem>—</strong></article>
      </section>

      <section class="admin-subscriptions__toolbar">
        <div class="admin-subscriptions__filters">
          <button type="button" class="is-active" data-filter="all">Todas</button>
          <button type="button" data-filter="active">Activas</button>
          <button type="button" data-filter="pending">Pendientes</button>
          <button type="button" data-filter="past_due">Pago vencido</button>
          <button type="button" data-filter="suspended">Suspendidas</button>
          <button type="button" data-filter="cancelled">Canceladas</button>
          <button type="button" data-filter="expired">Expiradas</button>
        </div>
        <label class="admin-subscriptions__search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input type="search" placeholder="Buscar cuenta o suscripción..." data-search />
        </label>
      </section>

      <section class="admin-subscriptions__content" data-subscriptions>
        <div class="admin-subscriptions__loading">
          <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <strong>Cargando suscripciones</strong>
        </div>
      </section>
    </section>
  `;

  const container = page.querySelector("[data-subscriptions]");
  const message = page.querySelector("[data-admin-message]");
  const search = page.querySelector("[data-search]");
  const refresh = page.querySelector("[data-subscriptions-refresh]");
  const filters = page.querySelectorAll("[data-filter]");
  let subscriptions = [];
  let activeFilter = "all";

  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const formatDate = value => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  };

  function renderSummary() {
    page.querySelector("[data-count-total]").textContent = subscriptions.length;
    page.querySelector("[data-count-active]").textContent = subscriptions.filter(s => s.status === "active").length;
    page.querySelector("[data-count-pending]").textContent = subscriptions.filter(s => s.status === "pending").length;
    page.querySelector("[data-count-problem]").textContent = subscriptions.filter(s => ["past_due", "suspended", "cancelled", "expired"].includes(s.status)).length;
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const filtered = subscriptions.filter(subscription => {
      if (activeFilter !== "all" && subscription.status !== activeFilter) return false;
      if (!query) return true;
      return [subscription.id, subscription.accountId, subscription.planId, subscription.status, subscription.period]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    });

    if (!filtered.length) {
      container.innerHTML = `<div class="admin-subscriptions__empty"><i class="fa-solid fa-calendar-xmark"></i><h2>No hay suscripciones</h2><p>No hay registros que coincidan con el filtro actual.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div class="admin-subscriptions__table-wrapper">
        <table class="admin-subscriptions__table">
          <thead><tr>
            <th>Suscripción</th><th>Cuenta</th><th>Plan</th><th>Estado</th>
            <th>Periodo</th><th>Fin de periodo</th><th>Próximo cobro</th>
          </tr></thead>
          <tbody>
            ${filtered.map(s => `
              <tr>
                <td><div class="admin-subscriptions__primary"><strong>${escapeHtml(s.id)}</strong><span>${escapeHtml(formatDate(s.createdAt))}</span></div></td>
                <td><code>${escapeHtml(s.accountId || "—")}</code></td>
                <td><span class="admin-subscriptions__badge">${escapeHtml(getPlanLabel(s.planId))}</span></td>
                <td><span class="admin-subscriptions__status admin-subscriptions__status--${escapeHtml(s.status || "unknown")}">${escapeHtml(getSubscriptionStatusLabel(s.status))}</span></td>
                <td>${escapeHtml(s.period || "—")}</td>
                <td>${escapeHtml(formatDate(s.currentPeriodEnd))}</td>
                <td>${escapeHtml(formatDate(s.nextBillingAt))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }

  async function load() {
    try {
      message.textContent = "";
      subscriptions = await getAdminSubscriptions();
      renderSummary();
      render();
    } catch (error) {
      console.error("NEXUS — Admin Subscriptions:", error);
      message.textContent = error?.message || "No fue posible cargar las suscripciones.";
      container.innerHTML = `<div class="admin-subscriptions__error"><strong>No fue posible cargar las suscripciones.</strong><p>${escapeHtml(error?.message || "Intenta nuevamente.")}</p></div>`;
    }
  }

  filters.forEach(button => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filters.forEach(item => item.classList.toggle("is-active", item === button));
    render();
  }));
  search.addEventListener("input", render);
  refresh.addEventListener("click", load);

  load();
  return page;
}
