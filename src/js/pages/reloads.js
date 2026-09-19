// ========================================
// ARKHAM — Public Reloads
// ========================================

import { uploadReloadPaymentProof } from "../services/reloadProof.js";
import { auth, authReady } from "../services/firebase.js";

const API = "/api/admin?resource=public-reloads";
const WHATSAPP_NUMBER = "50255555555";
const PURCHASE_DRAFT_KEY = "arkham.reloads.purchaseDraft";

const state = {
  games: [],
  products: [],
  selectedGame: null,
  selectedProduct: null,
  gameData: {},
  whatsapp: "",
  order: null,
  step: 1,
  loading: false
};

export function Reloads() {
  Object.assign(state, {
    games: [],
    products: [],
    selectedGame: null,
    selectedProduct: null,
    gameData: {},
    whatsapp: "",
    order: null,
    step: 1,
    loading: false
  });

  const page = document.createElement("main");
  page.className = "reloads-page";
  page.id = "reloads-page";

  page.innerHTML = `
    <section class="reloads-hero" id="orden">
      <div class="reloads-hero__noise"></div>
      <div class="reloads-hero__orb reloads-hero__orb--one"></div>
      <div class="reloads-hero__orb reloads-hero__orb--two"></div>
      <div class="reloads-hero__grid"></div>

      <div class="reloads-hero__container">
        <div class="reloads-hero__copy">
          <span class="reloads-kicker">TU JUEGO / SIEMPRE CONECTADO</span>
          <h1>ARKHAM <span>RELOADS</span></h1>
          <p>Recarga tus juegos favoritos rápido, seguro y sin complicaciones.</p>
        </div>

        <div class="reloads-hero__emblem" aria-hidden="true">
          <div class="reloads-hero__emblem-ring"></div>
          <div class="reloads-hero__emblem-core">A</div>
        </div>

        <span class="reloads-hero__side-copy">PLAY<br>RECHARGE<br>KEEP GOING</span>
      </div>

      <div class="reloads-checkout" data-checkout>
        <div class="reloads-checkout__steps" aria-label="Proceso de recarga">
          ${stepMarkup(1, "Juego", "Selecciona")}
          ${stepMarkup(2, "Producto", "Elige tu recarga")}
          ${stepMarkup(3, "Datos", "Ingresa tu ID")}
          ${stepMarkup(4, "Pago", "Comprueba")}
        </div>

        <div class="reloads-checkout__body" data-checkout-body>
          <div class="reloads-state">
            <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
            <span>Cargando juegos...</span>
          </div>
        </div>
      </div>
    </section>

    <section class="reloads-benefits" id="como-funciona">
      <div class="reloads-section__container">
        <div class="reloads-section__intro">
          <span class="reloads-kicker">ARKHAM RELOADS</span>
          <h2>Recarga. Confirma. <span>Sigue jugando.</span></h2>
          <p>Un flujo directo para que no tengas que ingresar tu tarjeta dentro del juego.</p>
        </div>

        <div class="reloads-benefits__grid">
          ${benefitMarkup("bolt", "Entrega rápida", "Procesamos tu recarga en minutos.")}
          ${benefitMarkup("shield-halved", "Pago seguro", "Tu comprobante se valida antes de procesar la recarga.")}
          ${benefitMarkup("whatsapp", "Soporte por WhatsApp", "Te acompañamos durante todo el proceso.")}
        </div>
      </div>
    </section>

    <section class="reloads-games" id="juegos">
      <div class="reloads-section__container">
        <div class="reloads-section__heading">
          <div>
            <span class="reloads-kicker">CATÁLOGO</span>
            <h2>Más juegos. <span>Más momentos.</span></h2>
          </div>
          <p>Selecciona un juego para comenzar tu recarga.</p>
        </div>
        <div class="reloads-games__grid" data-game-preview></div>
      </div>
    </section>

    <section class="reloads-support" id="soporte">
      <div class="reloads-section__container">
        <div class="reloads-support__card">
          <div>
            <span class="reloads-kicker">¿NECESITAS AYUDA?</span>
            <h2>Tu recarga, <span>sin vueltas.</span></h2>
            <p>Si tienes dudas con tu ID, producto o comprobante, nuestro equipo puede ayudarte por WhatsApp.</p>
          </div>
          <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noreferrer" class="reloads-button reloads-button--secondary">
            <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
            Hablar por WhatsApp
          </a>
        </div>
      </div>
    </section>

    <footer class="reloads-footer">
      <div class="reloads-footer__container">
        <div class="reloads-footer__brand">
          <strong>ARKHAM</strong>
          <span>RELOADS</span>
        </div>
        <span>RECARGA HOY. SIGUE JUGANDO MAÑANA.</span>
        <span>© 2026 ARKHAM ENTERTAINMENT</span>
      </div>
    </footer>
  `;

  bindPage(page);
  loadGames(page);

  return page;
}

function stepMarkup(number, title, subtitle) {
  return `
    <div class="reloads-step ${number === 1 ? "is-active" : ""}" data-step="${number}">
      <span>${number}</span>
      <div>
        <strong>${title}</strong>
        <small>${subtitle}</small>
      </div>
    </div>
  `;
}

function benefitMarkup(icon, title, text) {
  return `
    <article class="reloads-benefit">
      <div class="reloads-benefit__icon"><i class="fa-solid fa-${icon}" aria-hidden="true"></i></div>
      <div>
        <h3>${title}</h3>
        <p>${text}</p>
      </div>
    </article>
  `;
}

function bindPage(page) {
  page.addEventListener("click", (event) => {
    const gameButton = event.target.closest("[data-game-id]");
    if (gameButton) {
      const game = state.games.find((item) => item.id === gameButton.dataset.gameId);
      if (game) selectGame(page, game);
      return;
    }

    const productButton = event.target.closest("[data-product-id]");
    if (productButton) {
      const product = state.products.find((item) => item.id === productButton.dataset.productId);
      if (product) selectProduct(page, product);
      return;
    }

    const action = event.target.closest("[data-reloads-action]")?.dataset.reloadsAction;
    if (action === "back") previousStep(page);
    if (action === "next") nextStep(page);
    if (action === "restart") restart(page);
  });

  page.addEventListener("input", (event) => {
    const input = event.target.closest("[data-game-field]");
    if (input) {
      state.gameData[input.name] = input.value.trim();
    }

    if (event.target.matches("[name=whatsapp]")) {
      state.whatsapp = event.target.value.trim();
    }
  });
}

async function loadGames(page) {
  try {
    const response = await fetch(`${API}&action=games`, {
      headers: { Accept: "application/json" }
    });
    const data = await readResponse(response);
    state.games = data.games || [];
    renderGamesPreview(page);
    renderStep(page);
    await restorePurchaseDraft(page);
  } catch (error) {
    renderState(page, error.message || "No fue posible cargar los juegos.", true);
  }
}

async function loadProducts(page, gameId) {
  setLoading(page, true);
  try {
    const response = await fetch(`${API}&action=products&gameId=${encodeURIComponent(gameId)}`, {
      headers: { Accept: "application/json" }
    });
    const data = await readResponse(response);
    state.products = data.products || [];
    renderStep(page);
  } catch (error) {
    renderState(page, error.message || "No fue posible cargar los productos.", true);
  } finally {
    setLoading(page, false);
  }
}

function selectGame(page, game) {
  state.selectedGame = game;
  state.selectedProduct = null;
  state.products = [];
  state.gameData = {};
  state.step = 2;
  updateSteps(page);
  renderStep(page);
  loadProducts(page, game.id);
  scrollToCheckout(page);
}

function selectProduct(page, product) {
  state.selectedProduct = product;
  state.step = 3;
  updateSteps(page);
  renderStep(page);
}

function nextStep(page) {
  if (state.step === 3) {
    if (!validateGameData(page)) return;
    state.step = 4;
    updateSteps(page);
    renderStep(page);
    return;
  }

  if (state.step === 4) submitOrder(page);
}

function previousStep(page) {
  if (state.step <= 1) return;
  state.step -= 1;
  updateSteps(page);
  renderStep(page);
}

function restart(page) {
  state.selectedGame = null;
  state.selectedProduct = null;
  state.products = [];
  state.gameData = {};
  state.whatsapp = "";
  state.order = null;
  state.step = 1;
  updateSteps(page);
  renderStep(page);
  scrollToCheckout(page);
}

function renderStep(page) {
  const body = page.querySelector("[data-checkout-body]");
  if (!body) return;

  if (state.step === 1) {
    body.innerHTML = `
      <div class="reloads-panel-heading">
        <div>
          <span class="reloads-kicker">PASO 01</span>
          <h2>Selecciona un juego</h2>
          <p>Elige dónde quieres recibir tu recarga.</p>
        </div>
        <div class="reloads-panel-tag"><i class="fa-solid fa-bolt"></i> Entrega directa</div>
      </div>
      <div class="reloads-search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input type="search" placeholder="Buscar juego..." aria-label="Buscar juego" data-game-search>
      </div>
      <div class="reloads-game-grid" data-game-grid>${gameCards(state.games)}</div>
    `;

    const search = body.querySelector("[data-game-search]");
    search?.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      body.querySelector("[data-game-grid]").innerHTML = gameCards(
        state.games.filter((game) => String(game.name || "").toLowerCase().includes(query))
      );
    });
    return;
  }

  if (state.step === 2) {
    body.innerHTML = `
      <div class="reloads-panel-heading">
        <div>
          <span class="reloads-kicker">PASO 02</span>
          <h2>Elige tu recarga</h2>
          <p>${escapeHtml(state.selectedGame?.name || "Juego seleccionado")}</p>
        </div>
        <button type="button" class="reloads-text-button" data-reloads-action="back">Cambiar juego</button>
      </div>
      <div class="reloads-product-grid">
        ${state.products.length ? productCards(state.products) : `<div class="reloads-empty"><i class="fa-solid fa-box-open"></i><p>No hay productos activos para este juego.</p></div>`}
      </div>
    `;
    return;
  }

  if (state.step === 3) {
    const fields = state.selectedGame?.fields || [];
    body.innerHTML = `
      <div class="reloads-panel-heading">
        <div>
          <span class="reloads-kicker">PASO 03</span>
          <h2>Datos de la cuenta</h2>
          <p>Escribe exactamente los datos que utiliza el juego.</p>
        </div>
      </div>
      <div class="reloads-selected-product">
        <span>${escapeHtml(state.selectedProduct?.name || "Recarga")}</span>
        <strong>${formatMoney(state.selectedProduct?.price, state.selectedProduct?.currency)}</strong>
      </div>
      <form class="reloads-form" data-reload-data-form>
        ${fields.map(fieldMarkup).join("")}
        <label>
          <span>WhatsApp de contacto</span>
          <div class="reloads-input-wrap">
            <i class="fa-brands fa-whatsapp"></i>
            <input name="whatsapp" type="tel" inputmode="tel" placeholder="50255555555" value="${escapeHtml(state.whatsapp)}" required>
          </div>
          <small>Lo utilizaremos para enviarte actualizaciones de la orden.</small>
        </label>
        <div class="reloads-form__actions">
          <button type="button" class="reloads-button reloads-button--ghost" data-reloads-action="back">Atrás</button>
          <button type="button" class="reloads-button" data-reloads-action="next">Continuar <i class="fa-solid fa-arrow-right"></i></button>
        </div>
      </form>
    `;
    return;
  }

  body.innerHTML = `
    <div class="reloads-panel-heading">
      <div>
        <span class="reloads-kicker">PASO 04</span>
        <h2>Confirma tu recarga</h2>
        <p>Realiza el pago y luego adjunta tu comprobante.</p>
      </div>
    </div>
    <div class="reloads-payment-layout">
      <div class="reloads-order-summary">
        <span class="reloads-order-summary__label">RESUMEN</span>
        <div class="reloads-order-summary__game">
          <span class="reloads-game-avatar">${initials(state.selectedGame?.name)}</span>
          <div><strong>${escapeHtml(state.selectedGame?.name || "Juego")}</strong><small>${escapeHtml(state.selectedProduct?.name || "Recarga")}</small></div>
        </div>
        <dl>
          ${Object.entries(state.gameData).map(([key, value]) => `<div><dt>${escapeHtml(labelForField(state.selectedGame, key))}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
          <div><dt>WhatsApp</dt><dd>${escapeHtml(state.whatsapp)}</dd></div>
        </dl>
        <div class="reloads-order-summary__total"><span>Total</span><strong>${formatMoney(state.selectedProduct?.price, state.selectedProduct?.currency)}</strong></div>
      </div>

      <div class="reloads-payment-box">
        <div class="reloads-payment-box__icon"><i class="fa-solid fa-shield-halved"></i></div>
        <h3>Realiza el pago</h3>
        <p>Solicita los datos de pago por WhatsApp y luego crea la orden para adjuntar tu comprobante.</p>
        <a class="reloads-button reloads-button--secondary" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hola ARKHAM, necesito los datos de pago para una recarga.")}" target="_blank" rel="noreferrer">
          <i class="fa-brands fa-whatsapp"></i> Solicitar datos de pago
        </a>
        <div class="reloads-payment-box__note"><i class="fa-solid fa-circle-info"></i> La recarga solo se procesa después de verificar el pago.</div>
        <div class="reloads-form__actions">
          <button type="button" class="reloads-button reloads-button--ghost" data-reloads-action="back">Atrás</button>
          <button type="button" class="reloads-button" data-reloads-action="next">Crear orden <i class="fa-solid fa-arrow-right"></i></button>
        </div>
      </div>
    </div>
  `;
}

function fieldMarkup(field) {
  const value = state.gameData[field.id] || "";
  const type = field.type === "number" ? "number" : "text";
  return `
    <label>
      <span>${escapeHtml(field.label || field.id)}${field.required === false ? "" : " *"}</span>
      <div class="reloads-input-wrap">
        <i class="fa-solid ${type === "number" ? "fa-hashtag" : "fa-gamepad"}"></i>
        <input data-game-field name="${escapeHtml(field.id)}" type="${type}" placeholder="${escapeHtml(field.placeholder || "")}" value="${escapeHtml(value)}" ${field.required === false ? "" : "required"}>
      </div>
    </label>
  `;
}

function validateGameData(page) {
  const fields = state.selectedGame?.fields || [];
  for (const field of fields) {
    if (field.required !== false && !String(state.gameData[field.id] || "").trim()) {
      renderInlineError(page, `Completa el campo “${field.label || field.id}”.`);
      return false;
    }
  }

  if (!state.whatsapp) {
    renderInlineError(page, "Ingresa un número de WhatsApp para continuar.");
    return false;
  }

  return true;
}

async function getAuthenticatedUser() {
  await authReady;
  return auth.currentUser;
}

function savePurchaseDraft() {
  try {
    sessionStorage.setItem(PURCHASE_DRAFT_KEY, JSON.stringify({
      gameId: state.selectedGame?.id || null,
      productId: state.selectedProduct?.id || null,
      gameData: state.gameData,
      whatsapp: state.whatsapp,
      step: 4
    }));
  } catch (error) {
    console.warn("ARKHAM — No fue posible guardar el borrador de Reloads:", error);
  }
}

function clearPurchaseDraft() {
  try {
    sessionStorage.removeItem(PURCHASE_DRAFT_KEY);
  } catch {
    // Ignorar errores de almacenamiento.
  }
}

async function restorePurchaseDraft(page) {
  let raw = null;
  try {
    raw = sessionStorage.getItem(PURCHASE_DRAFT_KEY);
  } catch {
    return;
  }

  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    if (!draft?.gameId || !draft?.productId) return;

    const user = await getAuthenticatedUser();
    if (!user) return;

    const game = state.games.find((item) => item.id === draft.gameId);
    if (!game) {
      clearPurchaseDraft();
      return;
    }

    state.selectedGame = game;
    state.selectedProduct = null;
    state.gameData = draft.gameData && typeof draft.gameData === "object" ? draft.gameData : {};
    state.whatsapp = String(draft.whatsapp || "");
    state.step = 2;
    updateSteps(page);
    await loadProducts(page, game.id);

    const product = state.products.find((item) => item.id === draft.productId);
    if (!product) {
      clearPurchaseDraft();
      state.selectedGame = null;
      state.selectedProduct = null;
      state.gameData = {};
      state.whatsapp = "";
      state.step = 1;
      updateSteps(page);
      renderStep(page);
      return;
    }

    state.selectedProduct = product;
    state.step = 4;
    updateSteps(page);
    renderStep(page);
    clearPurchaseDraft();
    scrollToCheckout(page);
  } catch (error) {
    console.warn("ARKHAM — No fue posible restaurar el borrador de Reloads:", error);
    clearPurchaseDraft();
  }
}

function renderLoginRequired(page) {
  const body = page.querySelector("[data-checkout-body]");
  if (!body) return;

  body.innerHTML = `
    <div class="reloads-state reloads-state--auth">
      <div class="reloads-success__icon"><i class="fa-solid fa-lock"></i></div>
      <span class="reloads-kicker">CUENTA ARKHAM</span>
      <h2>Inicia sesión para continuar</h2>
      <p>Necesitas una cuenta ARKHAM para crear una orden, realizar el pago y consultar el estado de tu recarga.</p>
      <div class="reloads-form__actions">
        <button type="button" class="reloads-button reloads-button--ghost" data-reloads-action="back">Volver</button>
        <a class="reloads-button" href="/login?returnTo=%2Freloads">Iniciar sesión <i class="fa-solid fa-arrow-right"></i></a>
      </div>
      <small>Conservaremos los datos de esta recarga para que puedas continuar después de iniciar sesión.</small>
    </div>
  `;
}

async function submitOrder(page) {
  if (!validateGameData(page) || state.loading) return;

  const user = await getAuthenticatedUser();

  if (!user) {
    savePurchaseDraft();
    renderLoginRequired(page);
    return;
  }

  setLoading(page, true);

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        action: "create-order",
        gameId: state.selectedGame.id,
        productId: state.selectedProduct.id,
        gameData: state.gameData,
        whatsapp: state.whatsapp
      })
    });

    const data = await readResponse(response);
    state.order = data.order || null;
    clearPurchaseDraft();
    renderSuccess(page);
  } catch (error) {
    renderInlineError(page, error.message || "No fue posible crear la orden.");
  } finally {
    setLoading(page, false);
  }
}

function renderSuccess(page) {
  const body = page.querySelector("[data-checkout-body]");
  if (!body) return;

  body.innerHTML = `
    <div class="reloads-success">
      <div class="reloads-success__icon"><i class="fa-solid fa-check"></i></div>
      <span class="reloads-kicker">ORDEN CREADA</span>
      <h2>${escapeHtml(state.order?.orderNumber || "Orden ARKHAM")}</h2>
      <p>Tu orden fue registrada. Realiza el pago y adjunta el comprobante para que nuestro equipo pueda verificarlo.</p>

      <div class="reloads-success__summary">
        <div><span>Juego</span><strong>${escapeHtml(state.selectedGame?.name || "-")}</strong></div>
        <div><span>Producto</span><strong>${escapeHtml(state.selectedProduct?.name || "-")}</strong></div>
        <div><span>Total</span><strong>${formatMoney(state.selectedProduct?.price, state.selectedProduct?.currency)}</strong></div>
      </div>

      <div class="reloads-proof" data-proof-box>
        <div class="reloads-proof__head">
          <div>
            <span class="reloads-kicker">COMPROBANTE</span>
            <h3>Adjunta tu comprobante de pago</h3>
          </div>
          <span class="reloads-proof__status" data-proof-status>PENDIENTE</span>
        </div>

        <label class="reloads-proof__dropzone">
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" data-proof-file>
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <strong data-proof-file-name>Selecciona tu comprobante</strong>
          <span>JPG, PNG, WEBP o PDF · máximo 5 MB</span>
        </label>

        <div class="reloads-proof__message" data-proof-message></div>

        <button type="button" class="reloads-button" data-upload-proof>
          <i class="fa-solid fa-upload"></i>
          Enviar comprobante
        </button>
      </div>

      <div class="reloads-success__actions">
        <a class="reloads-button reloads-button--ghost" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hola ARKHAM, quiero continuar con mi orden ${state.order?.orderNumber || ""}.`)}" target="_blank" rel="noreferrer">
          <i class="fa-brands fa-whatsapp"></i> Soporte por WhatsApp
        </a>
        <button class="reloads-button reloads-button--ghost" type="button" data-reloads-action="restart">Nueva recarga</button>
      </div>
    </div>
  `;

  const fileInput = body.querySelector("[data-proof-file]");
  const fileName = body.querySelector("[data-proof-file-name]");
  const uploadButton = body.querySelector("[data-upload-proof]");
  const message = body.querySelector("[data-proof-message]");
  const status = body.querySelector("[data-proof-status]");

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileName.textContent = file ? file.name : "Selecciona tu comprobante";
    message.textContent = "";
  });

  uploadButton?.addEventListener("click", async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      message.textContent = "Selecciona un archivo antes de enviarlo.";
      message.classList.add("is-error");
      return;
    }

    uploadButton.disabled = true;
    uploadButton.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Subiendo...`;
    message.textContent = "Preparando comprobante...";
    message.classList.remove("is-error");

    try {
      await uploadReloadPaymentProof(
        file,
        state.order.id,
        state.order.proofToken
      );

      status.textContent = "ENVIADO";
      status.classList.add("is-submitted");
      message.textContent = "Comprobante enviado correctamente. Nuestro equipo revisará el pago.";
      message.classList.add("is-success");
      uploadButton.innerHTML = `<i class="fa-solid fa-check"></i> Comprobante enviado`;
    } catch (error) {
      message.textContent = error?.message || "No fue posible enviar el comprobante.";
      message.classList.add("is-error");
      uploadButton.disabled = false;
      uploadButton.innerHTML = `<i class="fa-solid fa-upload"></i> Enviar comprobante`;
    }
  });

  state.step = 4;
  updateSteps(page);
}
function renderGamesPreview(page) {
  const mount = page.querySelector("[data-game-preview]");
  if (!mount) return;
  mount.innerHTML = state.games.length
    ? state.games.slice(0, 8).map((game) => `
      <button type="button" class="reloads-game-preview" data-game-id="${escapeHtml(game.id)}">
        <span>${initials(game.name)}</span>
        <strong>${escapeHtml(game.name)}</strong>
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
      </button>
    `).join("")
    : `<div class="reloads-empty"><p>Los juegos aparecerán aquí cuando estén activos en el catálogo.</p></div>`;
}

function gameCards(games) {
  return games.length
    ? games.map((game, index) => `
      <button type="button" class="reloads-game-card ${state.selectedGame?.id === game.id ? "is-selected" : ""}" data-game-id="${escapeHtml(game.id)}">
        <span class="reloads-game-card__badge">${String(index + 1).padStart(2, "0")}</span>
        <span class="reloads-game-card__logo">${initials(game.name)}</span>
        <span class="reloads-game-card__name">${escapeHtml(game.name)}</span>
        <i class="fa-solid fa-arrow-right"></i>
      </button>
    `).join("")
    : `<div class="reloads-empty"><i class="fa-solid fa-gamepad"></i><p>No hay juegos disponibles en este momento.</p></div>`;
}

function productCards(products) {
  return products.map((product) => `
    <button type="button" class="reloads-product-card ${state.selectedProduct?.id === product.id ? "is-selected" : ""}" data-product-id="${escapeHtml(product.id)}">
      <span class="reloads-product-card__amount">${escapeHtml(product.amount ?? "-")}</span>
      <span class="reloads-product-card__name">${escapeHtml(product.name)}</span>
      <strong>${formatMoney(product.price, product.currency)}</strong>
      <i class="fa-solid fa-arrow-right"></i>
    </button>
  `).join("");
}

function updateSteps(page) {
  page.querySelectorAll("[data-step]").forEach((item) => {
    const number = Number(item.dataset.step);
    item.classList.toggle("is-active", number === state.step);
    item.classList.toggle("is-complete", number < state.step || Boolean(state.order && number === 4));
  });
}

function renderInlineError(page, message) {
  const body = page.querySelector("[data-checkout-body]");
  if (!body) return;
  let error = body.querySelector("[data-inline-error]");
  if (!error) {
    error = document.createElement("div");
    error.dataset.inlineError = "";
    error.className = "reloads-inline-error";
    body.prepend(error);
  }
  error.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${escapeHtml(message)}</span>`;
}

function renderState(page, message, error = false) {
  const body = page.querySelector("[data-checkout-body]");
  if (!body) return;
  body.innerHTML = `<div class="reloads-state ${error ? "is-error" : ""}"><i class="fa-solid ${error ? "fa-triangle-exclamation" : "fa-circle-notch fa-spin"}"></i><span>${escapeHtml(message)}</span></div>`;
}

function setLoading(page, loading) {
  state.loading = loading;
  const checkout = page.querySelector("[data-checkout]");
  checkout?.classList.toggle("is-loading", loading);
}

function scrollToCheckout(page) {
  page.querySelector("[data-checkout]")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function readResponse(response) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta no válida.");
  }
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "No fue posible completar la solicitud.");
  }
  return data;
}

function formatMoney(value, currency = "GTQ") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: currency || "GTQ",
    maximumFractionDigits: 2
  }).format(amount);
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function labelForField(game, key) {
  return game?.fields?.find((field) => field.id === key)?.label || key;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
