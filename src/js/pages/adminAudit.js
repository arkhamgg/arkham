// ========================================
// NEXUS — Admin Audit
// ========================================

import { getAdminAuditLogs, getAuditActionLabel } from "../services/adminAudit.js";

export function AdminAudit() {
  const page = document.createElement("main");
  page.className = "admin-audit-page";
  page.innerHTML = `
    <section class="admin-audit">
      <header class="admin-audit__header"><div><span class="admin-audit__eyebrow">NEXUS ADMIN</span><h1>Auditoría</h1><p>Registro de acciones administrativas y cambios sensibles.</p></div><button type="button" data-refresh><i class="fa-solid fa-rotate"></i> Actualizar</button></header>
      <div class="admin-audit__toolbar"><label><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Buscar acción, actor o entidad…" data-search></label></div>
      <div class="admin-audit__message" data-message></div>
      <section class="admin-audit__summary"><article><span>EVENTOS</span><strong data-total>—</strong></article><article><span>ÚLTIMAS 24H</span><strong data-day>—</strong></article></section>
      <section class="admin-audit__content" data-content><div class="admin-audit__loading">Cargando auditoría…</div></section>
    </section>`;

  let logs = [];
  const content = page.querySelector("[data-content]");
  const search = page.querySelector("[data-search]");
  const escape = value => String(value ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const date = value => value ? new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

  function render() {
    const query = search.value.trim().toLowerCase();
    const filtered = logs.filter(log => !query || [log.action, log.actorId, log.actorRole, log.targetType, log.targetId, log.reason].filter(Boolean).join(" ").toLowerCase().includes(query));
    if (!filtered.length) { content.innerHTML = `<div class="admin-audit__empty"><i class="fa-solid fa-list-check"></i><h2>No hay eventos</h2><p>No hay registros que coincidan con la búsqueda.</p></div>`; return; }
    content.innerHTML = `<div class="admin-audit__table-wrapper"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Actor</th><th>Objetivo</th><th>Motivo</th></tr></thead><tbody>${filtered.map(log => `<tr><td>${escape(date(log.createdAt))}</td><td><strong>${escape(getAuditActionLabel(log.action))}</strong><small>${escape(log.action)}</small></td><td><code>${escape(log.actorId || "—")}</code><small>${escape(log.actorRole || "—")}</small></td><td><span>${escape(log.targetType || "—")}</span><small>${escape(log.targetId || "—")}</small></td><td>${escape(log.reason || "—")}</td></tr>`).join("")}</tbody></table></div>`;
  }

  async function load() {
    page.querySelector("[data-message]").textContent = "Cargando…";
    try { const data = await getAdminAuditLogs(); logs = data.logs || []; page.querySelector("[data-total]").textContent = data.summary?.total ?? logs.length; page.querySelector("[data-day]").textContent = data.summary?.last24h ?? 0; page.querySelector("[data-message]").textContent = ""; render(); }
    catch (error) { page.querySelector("[data-message]").textContent = error?.message || "No fue posible cargar la auditoría."; content.innerHTML = ""; }
  }

  search.addEventListener("input", render);
  page.querySelector("[data-refresh]").addEventListener("click", load);
  load();
  return page;
}
