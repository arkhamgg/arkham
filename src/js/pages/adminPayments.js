// ========================================
// NEXUS — Admin Payments
// ========================================

import {
  requireAdminPermission
} from "../services/adminAccess.js";

import {
  getAdminBillingPayments,
  approveAdminBillingPayment,
  rejectAdminBillingPayment
} from "../services/adminBillingPayment.js";


// ========================================
// PAGE
// ========================================

export function AdminPayments() {

  const page =
    document.createElement("main");

  page.className =
    "admin-payments-page";


  page.innerHTML = `

    <section class="admin-payments">

      <header class="admin-payments__header">

        <div class="admin-payments__heading">

          <span class="admin-payments__eyebrow">
            NEXUS ADMIN
          </span>

          <h1>
            Pagos
          </h1>

          <p>
            Revisa y administra los pagos enviados
            por las cuentas NEXUS.
          </p>

        </div>

        <div class="admin-payments__header-actions">

          <button
            type="button"
            class="admin-payments__refresh"
            data-admin-payments-refresh
          >
            <i class="fa-solid fa-rotate" aria-hidden="true"></i>
            <span>Actualizar</span>
          </button>

        </div>

      </header>

      <div
        class="admin-payments__message"
        data-admin-payments-message
        aria-live="polite"
      ></div>

      <section class="admin-payments__summary">

        <article class="admin-payments__summary-card">
          <div class="admin-payments__summary-icon">
            <i class="fa-regular fa-clock" aria-hidden="true"></i>
          </div>
          <div>
            <span>PENDIENTES</span>
            <strong data-payment-count-pending>—</strong>
          </div>
        </article>

        <article class="admin-payments__summary-card">
          <div class="admin-payments__summary-icon">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          </div>
          <div>
            <span>EN REVISIÓN</span>
            <strong data-payment-count-review>—</strong>
          </div>
        </article>

        <article class="admin-payments__summary-card">
          <div class="admin-payments__summary-icon">
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
          </div>
          <div>
            <span>APROBADOS</span>
            <strong data-payment-count-approved>—</strong>
          </div>
        </article>

        <article class="admin-payments__summary-card">
          <div class="admin-payments__summary-icon">
            <i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>
          </div>
          <div>
            <span>RECHAZADOS</span>
            <strong data-payment-count-rejected>—</strong>
          </div>
        </article>

      </section>

      <section class="admin-payments__toolbar">

        <div class="admin-payments__filters">

          <button type="button" class="admin-payments__filter is-active" data-payment-filter="all">
            Todos
          </button>

          <button type="button" class="admin-payments__filter" data-payment-filter="pending">
            Pendientes
          </button>

          <button type="button" class="admin-payments__filter" data-payment-filter="under_review">
            En revisión
          </button>

          <button type="button" class="admin-payments__filter" data-payment-filter="approved">
            Aprobados
          </button>

          <button type="button" class="admin-payments__filter" data-payment-filter="rejected">
            Rechazados
          </button>

        </div>

        <div class="admin-payments__search">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input
            type="search"
            placeholder="Buscar pago, cuenta o referencia..."
            aria-label="Buscar pagos"
            data-payment-search
          />
        </div>

      </section>

      <section class="admin-payments__content">

        <div
          class="admin-payments__table-wrapper"
          data-admin-payments-table
        >
          <div class="admin-payments__loading">
            <div class="admin-payments__loading-icon">
              <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            </div>
            <strong>Cargando pagos</strong>
            <span>Estamos preparando la información de Billing.</span>
          </div>
        </div>

      </section>

    </section>

    <!-- ================================= -->
    <!-- PAYMENT DETAIL MODAL               -->
    <!-- ================================= -->

    <div
      class="admin-payments__modal"
      data-payment-modal
      hidden
    >

      <div
        class="admin-payments__modal-backdrop"
        data-payment-modal-close
      ></div>

      <section
        class="admin-payments__modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-payment-modal-title"
      >

        <header class="admin-payments__modal-header">

          <div>
            <span class="admin-payments__eyebrow">
              PAYMENT REVIEW
            </span>
            <h2 id="admin-payment-modal-title">
              Detalle del pago
            </h2>
          </div>

          <button
            type="button"
            class="admin-payments__modal-close"
            data-payment-modal-close
            aria-label="Cerrar"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>

        </header>

        <div
          class="admin-payments__modal-body"
          data-payment-modal-body
        ></div>

        <footer
          class="admin-payments__modal-actions"
          data-payment-modal-actions
        ></footer>

      </section>

    </div>

  `;


  // ========================================
  // ELEMENTS
  // ========================================

  const message =
    page.querySelector(
      "[data-admin-payments-message]"
    );

  const table =
    page.querySelector(
      "[data-admin-payments-table]"
    );

  const refreshButton =
    page.querySelector(
      "[data-admin-payments-refresh]"
    );

  const searchInput =
    page.querySelector(
      "[data-payment-search]"
    );

  const filterButtons =
    page.querySelectorAll(
      "[data-payment-filter]"
    );

  const modal =
    page.querySelector(
      "[data-payment-modal]"
    );

  const modalBody =
    page.querySelector(
      "[data-payment-modal-body]"
    );

  const modalActions =
    page.querySelector(
      "[data-payment-modal-actions]"
    );

  const modalCloseButtons =
    page.querySelectorAll(
      "[data-payment-modal-close]"
    );


  // ========================================
  // STATE
  // ========================================

  let activeFilter =
    "all";

  let searchTerm =
    "";

  let payments = [];

  let selectedPaymentId =
    null;

  let canApprove =
    false;

  let canReject =
    false;

  let isProcessing =
    false;


  // ========================================
  // HELPERS
  // ========================================

  function escapeHtml(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  function isSafeHttpsUrl(value) {

    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }

  }


  function getPaymentStatusLabel(status) {

    const labels = {
      pending: "Pendiente",
      under_review: "En revisión",
      approved: "Aprobado",
      rejected: "Rechazado",
      expired: "Expirado"
    };

    return labels[status] || status || "Desconocido";

  }


  function getPaymentMethodLabel(method) {

    const labels = {
      bank_transfer: "Transferencia bancaria",
      bank_deposit: "Depósito bancario"
    };

    return labels[method] || method || "—";

  }


  function getPlanLabel(planId) {

    const labels = {
      free: "Free",
      pro: "Pro",
      circuit: "Circuit",
      enterprise: "Enterprise"
    };

    return labels[planId] || planId || "—";

  }


  function formatAmount(payment) {

    const amount =
      Number(payment?.amount || 0);

    const currency =
      payment?.currency || "GTQ";

    return `${currency} ${amount.toFixed(2)}`;

  }


  function formatDate(value) {

    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString(
      "es-GT",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );

  }


  function formatPaymentDate(payment) {

    if (payment?.paymentDate) {

      const date =
        new Date(
          `${payment.paymentDate}T12:00:00`
        );

      if (!Number.isNaN(date.getTime())) {

        return date.toLocaleDateString(
          "es-GT",
          {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          }
        );

      }

    }

    return formatDate(payment?.createdAt);

  }


  function getFilteredPayments() {

    let result =
      [...payments];

    if (activeFilter !== "all") {

      result =
        result.filter(
          payment =>
            payment.status === activeFilter
        );

    }

    if (searchTerm) {

      result =
        result.filter(
          payment => {

            const account =
              payment.account || {};

            const text = [
              payment.id,
              payment.reference,
              payment.planId,
              payment.currentPlanId,
              payment.status,
              payment.method,
              payment.accountId,
              account.name,
              account.email
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return text.includes(
              searchTerm
            );

          }
        );

    }

    return result;

  }


  // ========================================
  // ACCESS
  // ========================================

  async function validateAccess() {

    try {

      const access =
        await requireAdminPermission(
          "payments.view"
        );

      canApprove =
        access.permissions?.includes(
          "payments.approve"
        ) || false;

      canReject =
        access.permissions?.includes(
          "payments.reject"
        ) || false;

      return true;

    } catch (error) {

      renderAccessDenied(error);
      return false;

    }

  }


  function renderAccessDenied(error) {

    const status =
      error?.status || 403;

    if (status !== 403) {

      message.innerHTML = `
        <div class="admin-payments__message-box admin-payments__message-box--error">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <span>No fue posible validar el acceso al módulo Payments.</span>
        </div>
      `;

    }

    table.innerHTML = `
      <div class="admin-payments__empty">
        <div class="admin-payments__empty-icon">
          <i class="fa-solid fa-lock" aria-hidden="true"></i>
        </div>
        <h2>Acceso restringido</h2>
        <p>No tienes permisos para consultar los pagos de NEXUS.</p>
      </div>
    `;

  }


  // ========================================
  // SUMMARY
  // ========================================

  function renderSummary(summary = {}) {

    const values = {
      pending: summary.pending || 0,
      underReview: summary.underReview || 0,
      approved: summary.approved || 0,
      rejected: summary.rejected || 0
    };

    const pending =
      page.querySelector(
        "[data-payment-count-pending]"
      );

    const review =
      page.querySelector(
        "[data-payment-count-review]"
      );

    const approved =
      page.querySelector(
        "[data-payment-count-approved]"
      );

    const rejected =
      page.querySelector(
        "[data-payment-count-rejected]"
      );

    if (pending) pending.textContent = values.pending;
    if (review) review.textContent = values.underReview;
    if (approved) approved.textContent = values.approved;
    if (rejected) rejected.textContent = values.rejected;

  }


  // ========================================
  // TABLE
  // ========================================

  function renderPayments() {

    const filteredPayments =
      getFilteredPayments();

    if (!filteredPayments.length) {

      table.innerHTML = `
        <div class="admin-payments__empty">
          <div class="admin-payments__empty-icon">
            <i class="fa-regular fa-credit-card" aria-hidden="true"></i>
          </div>
          <h2>No hay pagos para mostrar</h2>
          <p>No existen pagos que coincidan con los filtros actuales.</p>
        </div>
      `;

      return;

    }

    table.innerHTML = `

      <table class="admin-payments__table">

        <thead>
          <tr>
            <th>Cuenta</th>
            <th>Plan</th>
            <th>Monto</th>
            <th>Método</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>

          ${filteredPayments.map(payment => {

            const account =
              payment.account || {};

            const accountName =
              account.name ||
              account.email ||
              payment.accountId ||
              "Cuenta";

            const actionLabel =
              payment.status === "under_review"
                ? "Revisar"
                : "Ver detalle";

            return `

              <tr>

                <td>
                  <strong>${escapeHtml(accountName)}</strong>
                  ${account.email ? `<small>${escapeHtml(account.email)}</small>` : ""}
                </td>

                <td>
                  <strong>${escapeHtml(getPlanLabel(payment.planId))}</strong>
                  <small>${escapeHtml(getPlanLabel(payment.currentPlanId))} → ${escapeHtml(getPlanLabel(payment.planId))}</small>
                </td>

                <td>
                  <strong>${escapeHtml(formatAmount(payment))}</strong>
                </td>

                <td>
                  ${escapeHtml(getPaymentMethodLabel(payment.method))}
                </td>

                <td>
                  ${escapeHtml(formatPaymentDate(payment))}
                </td>

                <td>
                  <span class="admin-payments__status admin-payments__status--${escapeHtml(payment.status || "unknown")}">
                    ${escapeHtml(getPaymentStatusLabel(payment.status))}
                  </span>
                </td>

                <td>
                  <button
                    type="button"
                    class="admin-payments__action-button ${payment.status === "under_review" ? "admin-payments__action-button--primary" : ""}"
                    data-payment-review="${escapeHtml(payment.id)}"
                  >
                    <i class="fa-solid fa-eye" aria-hidden="true"></i>
                    ${actionLabel}
                  </button>
                </td>

              </tr>

            `;

          }).join("")}

        </tbody>

      </table>

    `;

    table
      .querySelectorAll("[data-payment-review]")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {
            openPaymentModal(
              button.dataset.paymentReview
            );
          }
        );

      });

  }


  // ========================================
  // PAYMENT MODAL
  // ========================================

  function openPaymentModal(paymentId) {

    const payment =
      payments.find(
        item => item.id === paymentId
      );

    if (!payment) {
      return;
    }

    selectedPaymentId =
      payment.id;

    const account =
      payment.account || {};

    const subscription =
      payment.subscription || {};

    const proof =
      payment.proof || null;

    const proofLink =
      proof?.url && isSafeHttpsUrl(proof.url)
        ? `
          <a
            class="admin-payments__proof-link"
            href="${escapeHtml(proof.url)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
            Ver comprobante
          </a>
        `
        : `
          <span class="admin-payments__proof-missing">
            Comprobante no disponible
          </span>
        `;

    modalBody.innerHTML = `

      <div class="admin-payments__detail-grid">

        <div class="admin-payments__detail-item admin-payments__detail-item--wide">
          <span>ID del pago</span>
          <strong>${escapeHtml(payment.id)}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Estado</span>
          <strong>
            <span class="admin-payments__status admin-payments__status--${escapeHtml(payment.status || "unknown")}">
              ${escapeHtml(getPaymentStatusLabel(payment.status))}
            </span>
          </strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Cuenta</span>
          <strong>${escapeHtml(account.name || account.email || payment.accountId || "—")}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Email</span>
          <strong>${escapeHtml(account.email || "—")}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Cuenta ID</span>
          <strong>${escapeHtml(payment.accountId || "—")}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Plan actual</span>
          <strong>${escapeHtml(getPlanLabel(payment.currentPlanId))}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Plan solicitado</span>
          <strong>${escapeHtml(getPlanLabel(payment.planId))}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Monto</span>
          <strong>${escapeHtml(formatAmount(payment))}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Período</span>
          <strong>${escapeHtml(payment.period || "monthly")}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Método</span>
          <strong>${escapeHtml(getPaymentMethodLabel(payment.method))}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Fecha del pago</span>
          <strong>${escapeHtml(formatPaymentDate(payment))}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Hora del pago</span>
          <strong>${escapeHtml(payment.paymentTime || "—")}</strong>
        </div>

        <div class="admin-payments__detail-item admin-payments__detail-item--wide">
          <span>Referencia</span>
          <strong>${escapeHtml(payment.reference || "—")}</strong>
        </div>

        <div class="admin-payments__detail-item admin-payments__detail-item--wide">
          <span>Comprobante</span>
          <div>${proofLink}</div>
        </div>

        <div class="admin-payments__detail-item admin-payments__detail-item--wide">
          <span>Suscripción</span>
          <strong>
            ${escapeHtml(
              payment.subscriptionId ||
              "Se creará al aprobar Free → Pro"
            )}
          </strong>
          ${subscription.status ? `<small>${escapeHtml(subscription.status)} · ${escapeHtml(subscription.period || "")}</small>` : ""}
        </div>

        <div class="admin-payments__detail-item">
          <span>Enviado</span>
          <strong>${escapeHtml(formatDate(payment.submittedAt))}</strong>
        </div>

        <div class="admin-payments__detail-item">
          <span>Creado</span>
          <strong>${escapeHtml(formatDate(payment.createdAt))}</strong>
        </div>

        ${payment.rejectionReason ? `
          <div class="admin-payments__detail-item admin-payments__detail-item--wide">
            <span>Motivo de rechazo</span>
            <strong>${escapeHtml(payment.rejectionReason)}</strong>
          </div>
        ` : ""}

      </div>

      ${payment.status === "under_review" && canReject ? `
        <div class="admin-payments__rejection-field">
          <label for="admin-payment-rejection-reason">
            Motivo de rechazo
          </label>
          <textarea
            id="admin-payment-rejection-reason"
            data-payment-rejection-reason
            rows="4"
            maxlength="1000"
            placeholder="Escribe el motivo si vas a rechazar este pago..."
          ></textarea>
        </div>
      ` : ""}

    `;

    renderModalActions(payment);

    modal.hidden = false;
    document.body.classList.add("nexus-modal-open");

  }


  function renderModalActions(payment) {

    if (payment.status !== "under_review") {

      modalActions.innerHTML = `
        <button
          type="button"
          class="admin-payments__modal-button admin-payments__modal-button--secondary"
          data-payment-modal-close
        >
          Cerrar
        </button>
      `;

      modalActions
        .querySelector("[data-payment-modal-close]")
        ?.addEventListener("click", closePaymentModal);

      return;

    }

    modalActions.innerHTML = `

      <button
        type="button"
        class="admin-payments__modal-button admin-payments__modal-button--secondary"
        data-payment-modal-close
      >
        Cerrar
      </button>

      ${canReject ? `
        <button
          type="button"
          class="admin-payments__modal-button admin-payments__modal-button--danger"
          data-payment-reject
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          Rechazar pago
        </button>
      ` : ""}

      ${canApprove ? `
        <button
          type="button"
          class="admin-payments__modal-button admin-payments__modal-button--primary"
          data-payment-approve
        >
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          Aprobar pago
        </button>
      ` : ""}

    `;

    modalActions
      .querySelector("[data-payment-modal-close]")
      ?.addEventListener("click", closePaymentModal);

    modalActions
      .querySelector("[data-payment-approve]")
      ?.addEventListener("click", handleApprove);

    modalActions
      .querySelector("[data-payment-reject]")
      ?.addEventListener("click", handleReject);

  }


  function closePaymentModal() {

    if (isProcessing) {
      return;
    }

    modal.hidden = true;
    selectedPaymentId = null;
    document.body.classList.remove("nexus-modal-open");

  }


  // ========================================
  // APPROVE
  // ========================================

  async function handleApprove() {

    if (!selectedPaymentId || isProcessing) {
      return;
    }

    const payment =
      payments.find(
        item => item.id === selectedPaymentId
      );

    if (!payment || payment.status !== "under_review") {
      return;
    }

    const confirmed =
      window.confirm(
        "¿Confirmas la aprobación de este pago? La cuenta será activada como Pro y se creará/activará su suscripción."
      );

    if (!confirmed) {
      return;
    }

    isProcessing = true;
    setModalButtonsDisabled(true);

    try {

      await requireAdminPermission(
        "payments.approve"
      );

      const response =
        await approveAdminBillingPayment(
          selectedPaymentId
        );

      message.innerHTML = `
        <div class="admin-payments__message-box admin-payments__message-box--success">
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
          <span>
            ${escapeHtml(
              response?.message ||
              "El pago fue aprobado correctamente."
            )}
          </span>
        </div>
      `;

      isProcessing = false;
      closePaymentModal();
      await loadPayments();

    } catch (error) {

      console.error(
        "NEXUS — Admin Payments: error aprobando pago.",
        error
      );

      showMessage(
        error?.message ||
        "No fue posible aprobar el pago.",
        "error"
      );

    } finally {

      isProcessing = false;
      setModalButtonsDisabled(false);

    }

  }


  // ========================================
  // REJECT
  // ========================================

  async function handleReject() {

    if (!selectedPaymentId || isProcessing) {
      return;
    }

    const reasonInput =
      modalBody.querySelector(
        "[data-payment-rejection-reason]"
      );

    const reason =
      String(
        reasonInput?.value || ""
      ).trim();

    if (!reason) {

      showMessage(
        "Debes indicar el motivo del rechazo.",
        "error"
      );

      reasonInput?.focus();
      return;

    }

    const confirmed =
      window.confirm(
        "¿Confirmas el rechazo de este pago?"
      );

    if (!confirmed) {
      return;
    }

    isProcessing = true;
    setModalButtonsDisabled(true);

    try {

      await requireAdminPermission(
        "payments.reject"
      );

      await rejectAdminBillingPayment(
        selectedPaymentId,
        reason
      );

      message.innerHTML = `
        <div class="admin-payments__message-box admin-payments__message-box--success">
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
          <span>El pago fue rechazado correctamente.</span>
        </div>
      `;

      isProcessing = false;
      closePaymentModal();
      await loadPayments();

    } catch (error) {

      console.error(
        "NEXUS — Admin Payments: error rechazando pago.",
        error
      );

      showMessage(
        error?.message ||
        "No fue posible rechazar el pago.",
        "error"
      );

    } finally {

      isProcessing = false;
      setModalButtonsDisabled(false);

    }

  }


  function setModalButtonsDisabled(disabled) {

    modalActions
      .querySelectorAll("button")
      .forEach(button => {
        button.disabled = disabled;
      });

  }


  // ========================================
  // MESSAGE
  // ========================================

  function showMessage(
    text,
    type = "error"
  ) {

    message.innerHTML = `
      <div class="admin-payments__message-box admin-payments__message-box--${escapeHtml(type)}">
        <i
          class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-triangle-exclamation"}"
          aria-hidden="true"
        ></i>
        <span>${escapeHtml(text)}</span>
      </div>
    `;

  }


  // ========================================
  // EVENTS
  // ========================================

  refreshButton?.addEventListener(
    "click",
    async () => {
      await loadPayments();
    }
  );

  searchInput?.addEventListener(
    "input",
    event => {

      searchTerm =
        String(
          event.target.value || ""
        )
          .trim()
          .toLowerCase();

      renderPayments();

    }
  );

  filterButtons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        activeFilter =
          button.dataset.paymentFilter ||
          "all";

        filterButtons.forEach(item => {
          item.classList.toggle(
            "is-active",
            item === button
          );
        });

        renderPayments();

      }
    );

  });

  modalCloseButtons.forEach(button => {
    button.addEventListener(
      "click",
      closePaymentModal
    );
  });

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape" &&
        !modal.hidden
      ) {
        closePaymentModal();
      }

    }
  );


  // ========================================
  // LOAD
  // ========================================

  async function loadPayments() {

    table.innerHTML = `
      <div class="admin-payments__loading">
        <div class="admin-payments__loading-icon">
          <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
        </div>
        <strong>Cargando pagos</strong>
        <span>Consultando Billing...</span>
      </div>
    `;

    const hasAccess =
      await validateAccess();

    if (!hasAccess) {
      return;
    }

    try {

      const data =
        await getAdminBillingPayments();

      payments =
        Array.isArray(data?.payments)
          ? data.payments
          : [];

      renderSummary(
        data?.summary || {}
      );

      renderPayments();

    } catch (error) {

      console.error(
        "NEXUS — Admin Payments:",
        error
      );

      table.innerHTML = `
        <div class="admin-payments__empty">
          <div class="admin-payments__empty-icon">
            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          </div>
          <h2>No fue posible cargar los pagos</h2>
          <p>${escapeHtml(error?.message || "Ocurrió un error inesperado.")}</p>
        </div>
      `;

    }

  }


  // ========================================
  // INITIALIZE
  // ========================================

  loadPayments();

  return page;

}
