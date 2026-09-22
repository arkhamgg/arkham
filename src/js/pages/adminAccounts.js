// ========================================
// ARKHAM — Admin Accounts
// ========================================

import { requireAdminPermission } from "../services/adminAccess.js";
import {
  getAdminAccounts,
  suspendAccount,
  activateAccount,
  getAccountStatusLabel,
  getAccountPlanLabel,
  getSubscriptionStatusLabel
} from "../services/adminAccounts.js";

export function AdminAccounts() {
  const page = document.createElement("main");
  page.className = "admin-accounts-page";

  page.innerHTML = `
    <section class="admin-accounts">

      <header class="admin-accounts__header">
        <div>
          <span class="admin-accounts__eyebrow">ARKHAM ADMIN</span>
          <h1>Accounts</h1>
          <p>
            Consulta y administra las cuentas registradas en ARKHAM.
          </p>
        </div>

        <div class="admin-accounts__header-actions">
          <button type="button" data-admin-back>
            Volver
          </button>
          <button type="button" data-accounts-refresh>
            <i class="fa-solid fa-rotate" aria-hidden="true"></i>
            Actualizar
          </button>
        </div>
      </header>

      <div class="admin-accounts__message" data-admin-message></div>

      <section class="admin-accounts__summary">
        <article>
          <span>Total</span>
          <strong data-count-total>—</strong>
        </article>
        <article>
          <span>Activas</span>
          <strong data-count-active>—</strong>
        </article>
        <article>
          <span>Suspendidas</span>
          <strong data-count-suspended>—</strong>
        </article>
        <article>
          <span>Pro</span>
          <strong data-count-pro>—</strong>
        </article>
      </section>

      <section class="admin-accounts__toolbar">
        <div class="admin-accounts__filters">
          <button type="button" class="is-active" data-account-filter="all">Todas</button>
          <button type="button" data-account-filter="active">Activas</button>
          <button type="button" data-account-filter="suspended">Suspendidas</button>
          <button type="button" data-account-filter="pro">Pro</button>
        </div>

        <label class="admin-accounts__search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input
            type="search"
            placeholder="Buscar cuenta, correo o UID..."
            aria-label="Buscar cuentas"
            data-account-search
          />
        </label>
      </section>

      <section class="admin-accounts__content" data-admin-accounts>
        <div class="admin-accounts__loading">
          <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <strong>Cargando cuentas</strong>
          <span>Estamos preparando la información de las cuentas.</span>
        </div>
      </section>

    </section>
  `;

  const container = page.querySelector("[data-admin-accounts]");
  const message = page.querySelector("[data-admin-message]");
  const searchInput = page.querySelector("[data-account-search]");
  const refreshButton = page.querySelector("[data-accounts-refresh]");
  const filterButtons = page.querySelectorAll("[data-account-filter]");

  let accounts = [];
  let activeFilter = "all";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderSummary() {
    page.querySelector("[data-count-total]").textContent = accounts.length;
    page.querySelector("[data-count-active]").textContent =
      accounts.filter(account => account.accountStatus === "active").length;
    page.querySelector("[data-count-suspended]").textContent =
      accounts.filter(account => account.accountStatus === "suspended").length;
    page.querySelector("[data-count-pro]").textContent =
      accounts.filter(account => account.planId === "pro").length;
  }

  function getFilteredAccounts() {
    const query = String(searchInput.value || "")
      .trim()
      .toLowerCase();

    return accounts.filter(account => {
      const matchesFilter =
        activeFilter === "all" ||
        account.accountStatus === activeFilter ||
        (activeFilter === "pro" && account.planId === "pro");

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        account.displayName,
        account.email,
        account.uid,
        account.planId,
        account.accountStatus
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  function renderAccounts() {
    const filtered = getFilteredAccounts();

    if (!filtered.length) {
      container.innerHTML = `
        <div class="admin-accounts__empty">
          <i class="fa-solid fa-users-slash" aria-hidden="true"></i>
          <h2>No hay cuentas que mostrar.</h2>
          <p>Prueba con otro filtro o término de búsqueda.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="admin-accounts__table-wrapper">
        <table class="admin-accounts__table">
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>Plan</th>
              <th>Suscripción</th>
              <th>Estado</th>
              <th>Creada</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(account => {
              const status = account.accountStatus || "active";
              const subscription = account.subscription;

              return `
                <tr>
                  <td>
                    <div class="admin-accounts__account">
                      <strong>${escapeHtml(account.displayName || "Sin nombre")}</strong>
                      <span>${escapeHtml(account.email || "Sin correo")}</span>
                      <small>${escapeHtml(account.uid)}</small>
                    </div>
                  </td>

                  <td>
                    <span class="admin-accounts__badge admin-accounts__badge--plan">
                      ${escapeHtml(getAccountPlanLabel(account.planId))}
                    </span>
                  </td>

                  <td>
                    <div class="admin-accounts__subscription">
                      <strong>
                        ${escapeHtml(
                          subscription
                            ? getSubscriptionStatusLabel(subscription.status)
                            : "Sin suscripción"
                        )}
                      </strong>
                      ${subscription?.period
                        ? `<span>${escapeHtml(subscription.period)}</span>`
                        : ""}
                    </div>
                  </td>

                  <td>
                    <span class="admin-accounts__status admin-accounts__status--${escapeHtml(status)}">
                      ${escapeHtml(getAccountStatusLabel(status))}
                    </span>
                  </td>

                  <td>
                    <span class="admin-accounts__date">
                      ${escapeHtml(formatDate(account.createdAt))}
                    </span>
                  </td>

                  <td>
                    <div class="admin-accounts__actions">
                      <button type="button" data-account-details="${escapeHtml(account.uid)}">
                        Ver
                      </button>
                      ${status === "active"
                        ? `<button type="button" class="is-danger" data-account-suspend="${escapeHtml(account.uid)}">Suspender</button>`
                        : `<button type="button" data-account-activate="${escapeHtml(account.uid)}">Activar</button>`}
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("es-GT", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function showDetails(uid) {
    const account = accounts.find(item => item.uid === uid);

    if (!account) {
      return;
    }

    const subscription = account.subscription;

    container.insertAdjacentHTML(
      "beforeend",
      `
        <div class="admin-accounts__modal" data-account-modal>
          <div class="admin-accounts__modal-backdrop" data-account-modal-close></div>
          <section class="admin-accounts__modal-card" role="dialog" aria-modal="true">
            <header class="admin-accounts__modal-header">
              <div>
                <span>ACCOUNT DETAIL</span>
                <h2>${escapeHtml(account.displayName || "Sin nombre")}</h2>
              </div>
              <button type="button" data-account-modal-close aria-label="Cerrar">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </header>

            <div class="admin-accounts__modal-body">
              <div><span>Correo</span><strong>${escapeHtml(account.email || "—")}</strong></div>
              <div><span>UID</span><strong>${escapeHtml(account.uid)}</strong></div>
              <div><span>Plan</span><strong>${escapeHtml(getAccountPlanLabel(account.planId))}</strong></div>
              <div><span>Estado</span><strong>${escapeHtml(getAccountStatusLabel(account.accountStatus))}</strong></div>
              <div><span>Email verificado</span><strong>${account.emailVerified ? "Sí" : "No"}</strong></div>
              <div><span>Último acceso</span><strong>${escapeHtml(formatDateTime(account.lastSignInAt))}</strong></div>
              <div><span>Suscripción</span><strong>${escapeHtml(subscription ? getSubscriptionStatusLabel(subscription.status) : "Sin suscripción")}</strong></div>
              <div><span>Periodo</span><strong>${escapeHtml(subscription?.period || "—")}</strong></div>
              <div><span>Fin de periodo</span><strong>${escapeHtml(formatDateTime(subscription?.currentPeriodEnd))}</strong></div>
            </div>
          </section>
        </div>
      `
    );
  }

  function formatDateTime(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("es-GT", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  async function load() {
    try {
      refreshButton.disabled = true;
      accounts = await getAdminAccounts();
      renderSummary();
      renderAccounts();
      message.textContent = "";
    } catch (error) {
      console.error("ARKHAM — Admin Accounts:", error);

      container.innerHTML = `
        <div class="admin-accounts__error">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <h2>No se pudieron cargar las cuentas.</h2>
          <p>${escapeHtml(error.message || "No tienes permisos para acceder.")}</p>
        </div>
      `;
    } finally {
      refreshButton.disabled = false;
    }
  }

  filterButtons.forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.accountFilter;

      filterButtons.forEach(item => item.classList.remove("is-active"));
      button.classList.add("is-active");

      renderAccounts();
    });
  });

  searchInput.addEventListener("input", renderAccounts);

  refreshButton.addEventListener("click", load);

  page.addEventListener("click", async event => {
    const backButton = event.target.closest("[data-admin-back]");
    const detailsButton = event.target.closest("[data-account-details]");
    const suspendButton = event.target.closest("[data-account-suspend]");
    const activateButton = event.target.closest("[data-account-activate]");
    const modalClose = event.target.closest("[data-account-modal-close]");

    if (backButton) {
      window.history.back();
      return;
    }

    if (modalClose) {
      page.querySelector("[data-account-modal]")?.remove();
      return;
    }

    if (detailsButton) {
      showDetails(detailsButton.dataset.accountDetails);
      return;
    }

    if (suspendButton) {
      const uid = suspendButton.dataset.accountSuspend;

      if (!window.confirm("¿Seguro que deseas suspender esta cuenta? El usuario perderá el acceso a ARKHAM.")) {
        return;
      }

      try {
        suspendButton.disabled = true;
        await suspendAccount(uid);
        message.textContent = "Cuenta suspendida correctamente.";
        await load();
      } catch (error) {
        console.error(error);
        message.textContent = error.message || "No se pudo suspender la cuenta.";
      }

      return;
    }

    if (activateButton) {
      const uid = activateButton.dataset.accountActivate;

      try {
        activateButton.disabled = true;
        await activateAccount(uid);
        message.textContent = "Cuenta activada correctamente.";
        await load();
      } catch (error) {
        console.error(error);
        message.textContent = error.message || "No se pudo activar la cuenta.";
      }
    }
  });

  load();

  return page;
}
