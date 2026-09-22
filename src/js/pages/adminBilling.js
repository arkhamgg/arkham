// ========================================
// ARKHAM — Admin Billing
// ========================================

import { getAdminBilling } from "../services/adminBilling.js";

export function AdminBilling() {
  const page = document.createElement("main");
  page.className = "admin-billing-page";
  page.innerHTML = `
    <section class="admin-billing">
      <header class="admin-billing__header">
        <div><span class="admin-billing__eyebrow">ARKHAM ADMIN</span><h1>Billing</h1><p>Visión financiera de pagos, suscripciones e ingresos de ARKHAM.</p></div>
        <button type="button" class="admin-billing__refresh" data-refresh><i class="fa-solid fa-rotate"></i> Actualizar</button>
      </header>
      <div class="admin-billing__message" data-message></div>
      <section class="admin-billing__metrics">
        <article><span>INGRESOS APROBADOS</span><strong data-approved>—</strong><small>GTQ acumulado</small></article>
        <article><span>EN REVISIÓN</span><strong data-review>—</strong><small>GTQ pendiente</small></article>
        <article><span>SUBSCRIPCIONES ACTIVAS</span><strong data-active>—</strong><small>cuentas activas</small></article>
        <article><span>MRR ESTIMADO</span><strong data-mrr>—</strong><small>GTQ / mes</small></article>
      </section>
      <section class="admin-billing__grid">
        <article class="admin-billing__card"><div class="admin-billing__card-head"><h2>Estado de Payments</h2></div><div class="admin-billing__stats" data-payment-stats></div></article>
        <article class="admin-billing__card"><div class="admin-billing__card-head"><h2>Suscripciones por plan</h2></div><div class="admin-billing__stats" data-plan-stats></div></article>
      </section>
      <section class="admin-billing__card admin-billing__recent"><div class="admin-billing__card-head"><h2>Payments recientes</h2></div><div data-recent></div></section>
    </section>`;

  const money = value => new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 2 }).format(Number(value) || 0);
  const date = value => value ? new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
  const escape = value => String(value ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  function render(data) {
    const summary = data.summary || {};
    page.querySelector("[data-approved]").textContent = money(summary.approvedRevenue);
    page.querySelector("[data-review]").textContent = money(summary.underReviewAmount);
    page.querySelector("[data-active]").textContent = summary.activeSubscriptions ?? 0;
    page.querySelector("[data-mrr]").textContent = money(summary.monthlyRecurringRevenue);

    page.querySelector("[data-payment-stats]").innerHTML = [
      ["Total", summary.totalPayments], ["Aprobados", summary.approvedPayments], ["En revisión", summary.underReviewPayments], ["Pendientes", summary.pendingPayments], ["Rechazados", summary.rejectedPayments]
    ].map(([label,value]) => `<div><span>${label}</span><strong>${value ?? 0}</strong></div>`).join("");

    const plans = data.breakdown?.subscriptionsByPlan || {};
    page.querySelector("[data-plan-stats]").innerHTML = Object.keys(plans).length
      ? Object.entries(plans).map(([plan,value]) => `<div><span>${escape(plan)}</span><strong>${value}</strong></div>`).join("")
      : `<p class="admin-billing__muted">No hay suscripciones activas.</p>`;

    const recent = data.recentPayments || [];
    page.querySelector("[data-recent]").innerHTML = recent.length ? `<div class="admin-billing__table-wrapper"><table><thead><tr><th>Payment</th><th>Cuenta</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>${recent.map(payment => `<tr><td><strong>${escape(payment.id)}</strong></td><td><code>${escape(payment.accountId || "—")}</code></td><td>${money(payment.amount)}</td><td><span class="admin-billing__status admin-billing__status--${escape(payment.status)}">${escape(payment.status || "—")}</span></td><td>${escape(date(payment.createdAt))}</td></tr>`).join("")}</tbody></table></div>` : `<p class="admin-billing__muted">No hay payments registrados.</p>`;
  }

  async function load() {
    page.querySelector("[data-message]").textContent = "Cargando Billing…";
    try { render(await getAdminBilling()); page.querySelector("[data-message]").textContent = ""; }
    catch (error) { page.querySelector("[data-message]").textContent = error?.message || "No fue posible cargar Billing."; }
  }

  page.querySelector("[data-refresh]").addEventListener("click", load);
  load();
  return page;
}
