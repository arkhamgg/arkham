// ========================================
// NEXUS — Admin Reloads
// ========================================

import { requireAdminPermission } from "../services/adminAccess.js";
import {
  getAdminReloads,
  createReloadGame,
  updateReloadGame,
  createReloadProduct,
  updateReloadProduct
} from "../services/adminReloads.js";

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

export function AdminReloads() {
  const page = document.createElement("main");
  page.className = "admin-reloads-page";
  page.innerHTML = `
    <section class="admin-reloads">
      <header class="admin-reloads__header">
        <div>
          <span class="admin-reloads__eyebrow">ARKHAM ADMIN / RELOADS</span>
          <h1>Centro de recargas</h1>
          <p>Configura los juegos y productos que ARKHAM ofrecerá como recargas.</p>
        </div>
        <button type="button" class="admin-reloads__back" data-admin-back>Volver</button>
      </header>

      <div class="admin-reloads__message" data-message></div>

      <nav class="admin-reloads__tabs" aria-label="Secciones de Reloads">
        <button type="button" class="is-active" data-tab="games">Juegos</button>
        <button type="button" data-tab="products">Productos</button>
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
  const message = page.querySelector("[data-message]");
  const modal = page.querySelector("[data-modal]");
  const form = page.querySelector("[data-form]");
  let games = [];
  let products = [];

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

  function closeModal() { modal.hidden = true; form.innerHTML = ""; }

  function openGame(game = null) {
    modal.hidden = false;
    page.querySelector("[data-modal-eyebrow]").textContent = game ? "EDITAR JUEGO" : "NUEVO JUEGO";
    page.querySelector("[data-modal-title]").textContent = game ? game.name : "Crear juego";
    const fields = game?.fields || [{ id: "playerId", label: "ID del jugador", type: "text", required: true, placeholder: "Ingresa el ID del jugador" }];
    form.innerHTML = `<label>Nombre<input name="name" required value="${escape(game?.name || "")}" placeholder="Free Fire"></label>
      <label>Slug<input name="slug" required value="${escape(game?.slug || "")}" placeholder="freefire"></label>
      <label class="admin-reloads__checkbox"><input type="checkbox" name="active" ${game?.active !== false ? "checked" : ""}> Juego activo</label>
      <fieldset><legend>Campos del juego</legend><div data-fields>${fields.map((field, index) => `<div class="admin-reloads__field-row" data-field-row><input data-field-id value="${escape(field.id)}" placeholder="playerId" required><input data-field-label value="${escape(field.label)}" placeholder="Etiqueta" required><select data-field-type><option value="text" ${field.type === "text" ? "selected" : ""}>Texto</option><option value="number" ${field.type === "number" ? "selected" : ""}>Número</option></select><label><input type="checkbox" data-field-required ${field.required !== false ? "checked" : ""}> Requerido</label><button type="button" data-remove-field>×</button></div>`).join("")}</div><button type="button" class="admin-reloads__secondary" data-add-field>Agregar campo</button></fieldset>
      <div class="admin-reloads__form-actions"><button type="button" data-close-modal>Cancelar</button><button type="submit">Guardar juego</button></div>`;
    form.dataset.entity = "game"; form.dataset.id = game?.id || "";
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
    form.dataset.entity = "product"; form.dataset.id = product?.id || "";
  }

  async function load() {
    showMessage("Cargando configuración…");
    try { const data = await getAdminReloads(); games = data.games || []; products = data.products || []; renderGames(); renderProducts(); showMessage(""); }
    catch (error) { showMessage(error?.message || "No fue posible cargar Reloads.", true); }
  }

  page.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
    page.querySelectorAll("[data-tab]").forEach(item => item.classList.toggle("is-active", item === button));
    page.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== button.dataset.tab; });
  }));

  page.querySelector("[data-new-game]").addEventListener("click", () => openGame());
  page.querySelector("[data-new-product]").addEventListener("click", () => games.length ? openProduct() : showMessage("Primero crea al menos un juego.", true));
  page.addEventListener("click", event => {
    const editGame = event.target.closest("[data-edit-game]");
    const editProduct = event.target.closest("[data-edit-product]");
    if (editGame) openGame(games.find(item => item.id === editGame.dataset.editGame));
    if (editProduct) openProduct(products.find(item => item.id === editProduct.dataset.editProduct));
    if (event.target.closest("[data-close-modal]")) closeModal();
    if (event.target.closest("[data-add-field]")) {
      const wrapper = form.querySelector("[data-fields]");
      const row = document.createElement("div"); row.className = "admin-reloads__field-row"; row.dataset.fieldRow = "";
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
      } else {
        const payload = { id: form.dataset.id || undefined, gameId: data.get("gameId"), name: data.get("name"), amount: Number(data.get("amount")), price: Number(data.get("price")), active: data.has("active") };
        form.dataset.id ? await updateReloadProduct(payload) : await createReloadProduct(payload);
      }
      closeModal(); await load(); showMessage("Cambios guardados correctamente.");
    } catch (error) { showMessage(error?.message || "No fue posible guardar.", true); }
  });

  page.querySelector("[data-admin-back]").addEventListener("click", () => { window.history.pushState({}, "", "/dashboard/admin"); window.dispatchEvent(new PopStateEvent("popstate")); });
  requireAdminPermission("reloads.view").then(load).catch(error => showMessage(error?.message || "Acceso denegado.", true));
  return page;
}
