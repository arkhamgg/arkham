// ========================================
// ARKHAM — Admin Reloads
// ========================================

import { requireAdminPermission } from "../services/adminAccess.js";
import {
  getAdminReloads,
  createReloadGame,
  updateReloadGame,
  createReloadProduct,
  updateReloadProduct,
  verifyReloadPayment,
  rejectReloadPayment,
  startReload,
  completeReload,
  failReload
} from "../services/adminReloads.js";

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

const PAYMENT_LABELS = {
  PENDING: "Pago pendiente",
  VERIFIED: "Pago verificado",
  REJECTED: "Pago rechazado"
};

const RELOAD_LABELS = {
  NOT_STARTED: "Sin procesar",
  PROCESSING: "Procesando",
  COMPLETED: "Completada",
  FAILED: "Fallida"
};

function statusClass(status) {
  return String(status || "").toLowerCase().replace(/_/g, "-");
}

function formatDate(value) {
  if (!value) return "—";
  let date = null;
  if (typeof value?.toDate === "function") date = value.toDate();
  else if (typeof value?._seconds === "number") date = new Date(value._seconds * 1000);
  else if (typeof value?.seconds === "number") date = new Date(value.seconds * 1000);
  else if (value instanceof Date) date = value;
  else date = new Date(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function whatsappLabel(value) {
  const phone = String(value || "").trim();
  return phone || "—";
}

export function AdminReloads() {
  const page = document.createElement("main");
  page.className = "admin-reloads-page";
  page.innerHTML = `
    <section class="admin-reloads">
      <header class="admin-reloads__header">
        <div>
          <span class="admin-reloads__eyebrow">ARKHAM ADMIN / RELOADS</span>
          <h1>Centro de recargas</h1>
          <p>Configura el catálogo y opera las órdenes de recarga de ARKHAM.</p>
        </div>
        <button type="button" class="admin-reloads__back" data-admin-back>Volver</button>
      </header>

      <div class="admin-reloads__message" data-message></div>

      <nav class="admin-reloads__tabs" aria-label="Secciones de Reloads">
        <button type="button" class="is-active" data-tab="games">Juegos</button>
        <button type="button" data-tab="products">Productos</button>
        <button type="button" data-tab="orders">Órdenes <span data-orders-count></span></button>
      </nav>

      <section class="admin-reloads__panel" data-panel="games">
        <div class="admin-reloads__section-head">
          <div><span>CATÁLOGO</span><h2>Juegos</h2><p>Define qué datos necesita cada juego para ejecutar una recarga.</p></div>
          <button type="button" data-new-game>Nuevo juego</button>
        </div>
        <div class="admin-reloads__grid" data-games></div>
      </section>

      <section class="admin-reloads__panel" data-panel="products" hidden>
        <div class="admin-reloads__section-head">
          <div><span>CATÁLOGO</span><h2>Productos</h2><p>Configura las denominaciones y precios disponibles por juego.</p></div>
          <button type="button" data-new-product>Nuevo producto</button>
        </div>
        <div class="admin-reloads__grid" data-products></div>
      </section>

      <section class="admin-reloads__panel" data-panel="orders" hidden>
        <div class="admin-reloads__section-head">
          <div><span>OPERACIÓN</span><h2>Órdenes</h2><p>Revisa pagos y ejecuta las operaciones de recarga.</p></div>
          <button type="button" class="admin-reloads__secondary" data-refresh-orders>Actualizar</button>
        </div>
        <div class="admin-reloads__orders" data-orders></div>
      </section>

      <div class="admin-reloads__modal" data-modal hidden>
        <div class="admin-reloads__modal-backdrop" data-close-modal></div>
        <section class="admin-reloads__modal-card" role="dialog" aria-modal="true">
          <header><div><span data-modal-eyebrow>CONFIGURACIÓN</span><h2 data-modal-title></h2></div><button type="button" data-close-modal aria-label="Cerrar">×</button></header>
          <form data-form></form>
        </section>
      </div>
    </section>`;

  const gamesEl = page.querySelector("[data-games]");
  const productsEl = page.querySelector("[data-products]");
  const ordersEl = page.querySelector("[data-orders]");
  const ordersCount = page.querySelector("[data-orders-count]");
  const message = page.querySelector("[data-message]");
  const modal = page.querySelector("[data-modal]");
  const form = page.querySelector("[data-form]");
  let games = [];
  let products = [];
  let orders = [];

  function showMessage(text = "", error = false) {
    message.textContent = text;
    message.className = `admin-reloads__message${error ? " is-error" : ""}`;
  }

  function renderGames() {
    gamesEl.innerHTML = games.length ? games.map(game => `
      <article class="admin-reloads__card">
        <div><span class="admin-reloads__status ${game.active ? "is-active" : ""}">${game.active ? "Activo" : "Inactivo"}</span><code>${escape(game.slug)}</code></div>
        <h3>${escape(game.name)}</h3>
        <p>${game.fields?.length || 0} campo(s) requerido(s) para el formulario.</p>
        <footer><span>${game.fields?.map(field => escape(field.label)).join(" · ") || "Sin campos configurados"}</span><button type="button" data-edit-game="${escape(game.id)}">Editar</button></footer>
      </article>`).join("") : `<div class="admin-reloads__empty"><h3>No hay juegos configurados.</h3><p>Crea el primer juego para comenzar.</p></div>`;
  }

  function renderProducts() {
    productsEl.innerHTML = products.length ? products.map(product => {
      const game = games.find(item => item.id === product.gameId);
      return `<article class="admin-reloads__card">
        <div><span class="admin-reloads__status ${product.active ? "is-active" : ""}">${product.active ? "Activo" : "Inactivo"}</span><code>${escape(product.gameId)}</code></div>
        <h3>${escape(product.name)}</h3>
        <p>${escape(game?.name || product.gameId)} · ${escape(product.amount)} unidades</p>
        <footer><strong>Q${Number(product.price).toFixed(2)}</strong><button type="button" data-edit-product="${escape(product.id)}">Editar</button></footer>
      </article>`;
    }).join("") : `<div class="admin-reloads__empty"><h3>No hay productos configurados.</h3><p>Crea una denominación para un juego activo.</p></div>`;
  }

  function renderOrders() {
    ordersCount.textContent = orders.length ? `(${orders.length})` : "";
    if (!orders.length) {
      ordersEl.innerHTML = `<div class="admin-reloads__empty"><h3>No hay órdenes.</h3><p>Las nuevas solicitudes de recarga aparecerán aquí.</p></div>`;
      return;
    }

    ordersEl.innerHTML = `
      <div class="admin-reloads__orders-list">
        ${orders.map(order => {
          const paymentStatus = order.payment?.status || "PENDING";
          const reloadStatus = order.reload?.status || "NOT_STARTED";
          return `<button type="button" class="admin-reloads__order" data-open-order="${escape(order.id)}">
            <div class="admin-reloads__order-main">
              <strong>${escape(order.orderNumber || order.id)}</strong>
              <span>${escape(order.game?.name || "Juego")}</span>
            </div>
            <div class="admin-reloads__order-product">
              <strong>${escape(order.product?.name || "Producto")}</strong>
              <span>Q${Number(order.product?.price || 0).toFixed(2)}</span>
            </div>
            <div class="admin-reloads__order-statuses">
              <span class="admin-reloads__status-badge is-${statusClass(paymentStatus)}">${escape(PAYMENT_LABELS[paymentStatus] || paymentStatus)}</span>
              <span class="admin-reloads__status-badge is-${statusClass(reloadStatus)}">${escape(RELOAD_LABELS[reloadStatus] || reloadStatus)}</span>
            </div>
            <time>${escape(formatDate(order.createdAt))}</time>
          </button>`;
        }).join("")}
      </div>`;
  }

  function closeModal() {
    modal.hidden = true;
    form.innerHTML = "";
    form.dataset.entity = "";
    form.dataset.id = "";
  }

  function openGame(game = null) {
    modal.hidden = false;
    page.querySelector("[data-modal-eyebrow]").textContent = game ? "EDITAR JUEGO" : "NUEVO JUEGO";
    page.querySelector("[data-modal-title]").textContent = game ? game.name : "Crear juego";
    const fields = game?.fields || [{ id: "playerId", label: "ID del jugador", type: "text", required: true, placeholder: "Ingresa el ID del jugador" }];
    form.innerHTML = `<label>Nombre<input name="name" required value="${escape(game?.name || "")}" placeholder="Free Fire"></label>
      <label>Slug<input name="slug" required value="${escape(game?.slug || "")}" placeholder="freefire"></label>
      <label class="admin-reloads__checkbox"><input type="checkbox" name="active" ${game?.active !== false ? "checked" : ""}> Juego activo</label>
      <fieldset><legend>Campos del juego</legend><div data-fields>${fields.map(field => `<div class="admin-reloads__field-row" data-field-row><input data-field-id value="${escape(field.id)}" placeholder="playerId" required><input data-field-label value="${escape(field.label)}" placeholder="Etiqueta" required><select data-field-type><option value="text" ${field.type === "text" ? "selected" : ""}>Texto</option><option value="number" ${field.type === "number" ? "selected" : ""}>Número</option></select><label><input type="checkbox" data-field-required ${field.required !== false ? "checked" : ""}> Requerido</label><button type="button" data-remove-field>×</button></div>`).join("")}</div><button type="button" class="admin-reloads__secondary" data-add-field>Agregar campo</button></fieldset>
      <div class="admin-reloads__form-actions"><button type="button" data-close-modal>Cancelar</button><button type="submit">Guardar juego</button></div>`;
    form.dataset.entity = "game";
    form.dataset.id = game?.id || "";
  }

  function openProduct(product = null) {
    modal.hidden = false;
    page.querySelector("[data-modal-eyebrow]").textContent = product ? "EDITAR PRODUCTO" : "NUEVO PRODUCTO";
    page.querySelector("[data-modal-title]").textContent = product ? product.name : "Crear producto";
    form.innerHTML = `<label>Juego<select name="gameId" required><option value="">Selecciona un juego</option>${games.map(game => `<option value="${escape(game.id)}" ${product?.gameId === game.id ? "selected" : ""}>${escape(game.name)}</option>`).join("")}</select></label>
      <label>Nombre<input name="name" required value="${escape(product?.name || "")}" placeholder="100 Diamonds"></label>
      <label>Cantidad<input name="amount" type="number" min="1" required value="${escape(product?.amount || "")}" placeholder="100"></label>
      <label>Precio (GTQ)<input name="price" type="number" min="0" step="0.01" required value="${escape(product?.price || "")}" placeholder="15"></label>
      <label class="admin-reloads__checkbox"><input type="checkbox" name="active" ${product?.active !== false ? "checked" : ""}> Producto activo</label>
      <div class="admin-reloads__form-actions"><button type="button" data-close-modal>Cancelar</button><button type="submit">Guardar producto</button></div>`;
    form.dataset.entity = "product";
    form.dataset.id = product?.id || "";
  }

  function openOrder(order) {
    modal.hidden = false;
    page.querySelector("[data-modal-eyebrow]").textContent = "OPERACIÓN / ORDEN";
    page.querySelector("[data-modal-title]").textContent = order.orderNumber || order.id;

    const paymentStatus = order.payment?.status || "PENDING";
    const reloadStatus = order.reload?.status || "NOT_STARTED";
    const gameData = Object.entries(order.gameData || {});
    const proofUrl = order.payment?.proofUrl || order.payment?.proof?.url || "";

    const paymentActions = paymentStatus === "PENDING" ? `
      <div class="admin-reloads__action-group">
        <button type="button" class="admin-reloads__danger-button" data-order-action="reject-payment" data-order-id="${escape(order.id)}">Rechazar pago</button>
        <button type="button" class="admin-reloads__primary-button" data-order-action="verify-payment" data-order-id="${escape(order.id)}">Verificar pago</button>
      </div>` : "";

    const reloadActions = paymentStatus === "VERIFIED" && reloadStatus === "NOT_STARTED" ? `
      <div class="admin-reloads__action-group">
        <button type="button" class="admin-reloads__primary-button" data-order-action="start-reload" data-order-id="${escape(order.id)}">Iniciar recarga</button>
      </div>` : "";

    const processingActions = paymentStatus === "VERIFIED" && reloadStatus === "PROCESSING" ? `
      <div class="admin-reloads__action-group">
        <button type="button" class="admin-reloads__danger-button" data-order-action="fail-reload" data-order-id="${escape(order.id)}">Marcar fallida</button>
        <button type="button" class="admin-reloads__primary-button" data-order-action="complete-reload" data-order-id="${escape(order.id)}">Marcar completada</button>
      </div>` : "";

    form.innerHTML = `
      <div class="admin-reloads__order-detail">
        <div class="admin-reloads__detail-grid">
          <section><span>JUEGO</span><strong>${escape(order.game?.name || "—")}</strong></section>
          <section><span>PRODUCTO</span><strong>${escape(order.product?.name || "—")}</strong><small>${escape(order.product?.amount ?? "—")} unidades · Q${Number(order.product?.price || 0).toFixed(2)} ${escape(order.product?.currency || "GTQ")}</small></section>
          <section><span>CREADA</span><strong>${escape(formatDate(order.createdAt))}</strong></section>
          <section><span>WHATSAPP</span><strong>${escape(whatsappLabel(order.whatsapp))}</strong></section>
        </div>

        <div class="admin-reloads__detail-block"><span>DATOS DEL JUEGO</span>${gameData.length ? gameData.map(([key, value]) => `<div class="admin-reloads__detail-row"><strong>${escape(key)}</strong><span>${escape(value)}</span></div>`).join("") : "<p>Sin datos adicionales.</p>"}</div>

        <div class="admin-reloads__detail-block"><span>COMPROBANTE DE PAGO</span>${proofUrl ? `<a href="${escape(proofUrl)}" target="_blank" rel="noopener noreferrer" class="admin-reloads__proof">Abrir comprobante</a>` : "<p>No se ha cargado un comprobante.</p>"}</div>

        <div class="admin-reloads__detail-block"><span>ESTADO</span><div class="admin-reloads__state-line"><span class="admin-reloads__status-badge is-${statusClass(paymentStatus)}">${escape(PAYMENT_LABELS[paymentStatus] || paymentStatus)}</span><span class="admin-reloads__status-badge is-${statusClass(reloadStatus)}">${escape(RELOAD_LABELS[reloadStatus] || reloadStatus)}</span></div></div>

        ${order.payment?.rejectionReason ? `<div class="admin-reloads__detail-block is-error"><span>MOTIVO DE RECHAZO</span><p>${escape(order.payment.rejectionReason)}</p></div>` : ""}
        ${order.reload?.failureReason ? `<div class="admin-reloads__detail-block is-error"><span>MOTIVO DEL FALLO</span><p>${escape(order.reload.failureReason)}</p></div>` : ""}
        ${paymentActions}${reloadActions}${processingActions}
      </div>`;
    form.dataset.entity = "order";
    form.dataset.id = order.id;
  }

  async function load() {
    showMessage("Cargando configuración…");
    try {
      const data = await getAdminReloads();
      games = data.games || [];
      products = data.products || [];
      orders = data.orders || [];
      renderGames();
      renderProducts();
      renderOrders();
      showMessage("");
    } catch (error) {
      showMessage(error?.message || "No fue posible cargar Reloads.", true);
    }
  }

  async function handleOrderAction(action, orderId) {
    const order = orders.find(item => item.id === orderId);
    if (!order) return;

    let reason = "";
    if (action === "reject-payment") {
      reason = window.prompt("Motivo del rechazo del pago:", "")?.trim() || "";
      if (!reason) return;
    }
    if (action === "fail-reload") {
      reason = window.prompt("Motivo del fallo de la recarga:", "")?.trim() || "";
      if (!reason) return;
    }

    try {
      showMessage("Actualizando orden…");
      if (action === "verify-payment") await verifyReloadPayment(orderId);
      if (action === "reject-payment") await rejectReloadPayment(orderId, reason);
      if (action === "start-reload") await startReload(orderId);
      if (action === "complete-reload") await completeReload(orderId);
      if (action === "fail-reload") await failReload(orderId, reason);
      closeModal();
      await load();
      showMessage("Orden actualizada correctamente.");
    } catch (error) {
      showMessage(error?.message || "No fue posible actualizar la orden.", true);
    }
  }

  page.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
    page.querySelectorAll("[data-tab]").forEach(item => item.classList.toggle("is-active", item === button));
    page.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== button.dataset.tab; });
  }));

  page.querySelector("[data-new-game]").addEventListener("click", () => openGame());
  page.querySelector("[data-new-product]").addEventListener("click", () => games.length ? openProduct() : showMessage("Primero crea al menos un juego.", true));
  page.querySelector("[data-refresh-orders]").addEventListener("click", load);

  page.addEventListener("click", event => {
    const editGame = event.target.closest("[data-edit-game]");
    const editProduct = event.target.closest("[data-edit-product]");
    const openOrderButton = event.target.closest("[data-open-order]");
    const orderAction = event.target.closest("[data-order-action]");

    if (editGame) openGame(games.find(item => item.id === editGame.dataset.editGame));
    if (editProduct) openProduct(products.find(item => item.id === editProduct.dataset.editProduct));
    if (openOrderButton) openOrder(orders.find(item => item.id === openOrderButton.dataset.openOrder));
    if (orderAction) handleOrderAction(orderAction.dataset.orderAction, orderAction.dataset.orderId);
    if (event.target.closest("[data-close-modal]")) closeModal();
    if (event.target.closest("[data-add-field]")) {
      const wrapper = form.querySelector("[data-fields]");
      const row = document.createElement("div");
      row.className = "admin-reloads__field-row";
      row.dataset.fieldRow = "";
      row.innerHTML = `<input data-field-id placeholder="fieldId" required><input data-field-label placeholder="Etiqueta" required><select data-field-type><option value="text">Texto</option><option value="number">Número</option></select><label><input type="checkbox" data-field-required checked> Requerido</label><button type="button" data-remove-field>×</button>`;
      wrapper.appendChild(row);
    }
    if (event.target.closest("[data-remove-field]")) event.target.closest("[data-field-row]")?.remove();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(form);
    const entity = form.dataset.entity;
    try {
      showMessage("Guardando…");
      if (entity === "game") {
        const fields = [...form.querySelectorAll("[data-field-row]")].map(row => ({ id: row.querySelector("[data-field-id]").value, label: row.querySelector("[data-field-label]").value, type: row.querySelector("[data-field-type]").value, required: row.querySelector("[data-field-required]").checked }));
        const payload = { id: form.dataset.id || undefined, name: data.get("name"), slug: data.get("slug"), active: data.has("active"), fields };
        form.dataset.id ? await updateReloadGame(payload) : await createReloadGame(payload);
      } else if (entity === "product") {
        const payload = { id: form.dataset.id || undefined, gameId: data.get("gameId"), name: data.get("name"), amount: Number(data.get("amount")), price: Number(data.get("price")), active: data.has("active") };
        form.dataset.id ? await updateReloadProduct(payload) : await createReloadProduct(payload);
      }
      closeModal();
      await load();
      showMessage("Cambios guardados correctamente.");
    } catch (error) {
      showMessage(error?.message || "No fue posible guardar.", true);
    }
  });

  page.querySelector("[data-admin-back]").addEventListener("click", () => { window.history.pushState({}, "", "/dashboard/admin"); window.dispatchEvent(new PopStateEvent("popstate")); });
  requireAdminPermission("reloads.view").then(load).catch(error => showMessage(error?.message || "Acceso denegado.", true));
  return page;
}
