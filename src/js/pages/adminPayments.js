// ========================================
// NEXUS — Admin Payments
// ========================================

import {
  requireAdminPermission
} from "../services/adminAccess.js";


// ========================================
// PAGE
// ========================================

export function AdminPayments() {

  const page =
    document.createElement("main");

  page.className =
    "admin-payments-page";


  // ========================================
  // INITIAL UI
  // ========================================

  page.innerHTML = `

    <section class="admin-payments">

      <!-- ================================= -->
      <!-- HEADER -->
      <!-- ================================= -->

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

            <i
              class="fa-solid fa-rotate"
              aria-hidden="true"
            ></i>

            <span>
              Actualizar
            </span>

          </button>

        </div>

      </header>


      <!-- ================================= -->
      <!-- MESSAGE -->
      <!-- ================================= -->

      <div
        class="admin-payments__message"
        data-admin-payments-message
        aria-live="polite"
      ></div>


      <!-- ================================= -->
      <!-- SUMMARY -->
      <!-- ================================= -->

      <section class="admin-payments__summary">

        <article class="admin-payments__summary-card">

          <div class="admin-payments__summary-icon">

            <i
              class="fa-regular fa-clock"
              aria-hidden="true"
            ></i>

          </div>

          <div>

            <span>
              PENDIENTES
            </span>

            <strong data-payment-count-pending>
              —
            </strong>

          </div>

        </article>


        <article class="admin-payments__summary-card">

          <div class="admin-payments__summary-icon">

            <i
              class="fa-solid fa-magnifying-glass"
              aria-hidden="true"
            ></i>

          </div>

          <div>

            <span>
              EN REVISIÓN
            </span>

            <strong data-payment-count-review>
              —
            </strong>

          </div>

        </article>


        <article class="admin-payments__summary-card">

          <div class="admin-payments__summary-icon">

            <i
              class="fa-solid fa-circle-check"
              aria-hidden="true"
            ></i>

          </div>

          <div>

            <span>
              APROBADOS
            </span>

            <strong data-payment-count-approved>
              —
            </strong>

          </div>

        </article>


        <article class="admin-payments__summary-card">

          <div class="admin-payments__summary-icon">

            <i
              class="fa-solid fa-circle-xmark"
              aria-hidden="true"
            ></i>

          </div>

          <div>

            <span>
              RECHAZADOS
            </span>

            <strong data-payment-count-rejected>
              —
            </strong>

          </div>

        </article>

      </section>


      <!-- ================================= -->
      <!-- FILTERS -->
      <!-- ================================= -->

      <section class="admin-payments__toolbar">

        <div class="admin-payments__filters">

          <button
            type="button"
            class="admin-payments__filter is-active"
            data-payment-filter="all"
          >
            Todos
          </button>

          <button
            type="button"
            class="admin-payments__filter"
            data-payment-filter="pending"
          >
            Pendientes
          </button>

          <button
            type="button"
            class="admin-payments__filter"
            data-payment-filter="under_review"
          >
            En revisión
          </button>

          <button
            type="button"
            class="admin-payments__filter"
            data-payment-filter="approved"
          >
            Aprobados
          </button>

          <button
            type="button"
            class="admin-payments__filter"
            data-payment-filter="rejected"
          >
            Rechazados
          </button>

        </div>


        <div class="admin-payments__search">

          <i
            class="fa-solid fa-magnifying-glass"
            aria-hidden="true"
          ></i>

          <input
            type="search"
            placeholder="Buscar pago, cuenta o referencia..."
            aria-label="Buscar pagos"
            data-payment-search
          />

        </div>

      </section>


      <!-- ================================= -->
      <!-- CONTENT -->
      <!-- ================================= -->

      <section class="admin-payments__content">

        <div
          class="admin-payments__table-wrapper"
          data-admin-payments-table
        >

          <!-- Loading -->

          <div class="admin-payments__loading">

            <div class="admin-payments__loading-icon">

              <i
                class="fa-solid fa-spinner fa-spin"
                aria-hidden="true"
              ></i>

            </div>

            <strong>
              Cargando pagos
            </strong>

            <span>
              Estamos preparando la información de Billing.
            </span>

          </div>

        </div>

      </section>


    </section>

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


  // ========================================
  // STATE
  // ========================================

  let activeFilter =
    "all";


  let searchTerm =
    "";


  // ========================================
  // PERMISSION
  // ========================================

  async function validateAccess() {

    try {

      await requireAdminPermission(
        "payments.view"
      );

      return true;

    } catch (error) {

      renderAccessDenied(
        error
      );

      return false;

    }

  }


  // ========================================
  // ACCESS DENIED
  // ========================================

  function renderAccessDenied(
    error
  ) {

    const status =
      error?.status ||
      403;


    if (
      status !== 403
    ) {

      message.innerHTML = `
        <div class="admin-payments__message-box admin-payments__message-box--error">

          <i
            class="fa-solid fa-triangle-exclamation"
            aria-hidden="true"
          ></i>

          <span>
            No fue posible validar el acceso al módulo Billing.
          </span>

        </div>
      `;

    } else {

      table.innerHTML = `

        <div class="admin-payments__empty">

          <div class="admin-payments__empty-icon">

            <i
              class="fa-solid fa-lock"
              aria-hidden="true"
            ></i>

          </div>

          <h2>
            Acceso restringido
          </h2>

          <p>
            No tienes permisos para consultar los pagos de NEXUS.
          </p>

        </div>

      `;

    }

  }


  // ========================================
  // DEMO EMPTY STATE
  // ========================================
  //
  // Temporalmente utilizamos este estado
  // mientras conectamos el GET de Payments.
  //
  // NO representa ausencia real de pagos.
  //

  function renderEmptyState() {

    table.innerHTML = `

      <div class="admin-payments__empty">

        <div class="admin-payments__empty-icon">

          <i
            class="fa-regular fa-credit-card"
            aria-hidden="true"
          ></i>

        </div>

        <h2>
          No hay pagos para mostrar
        </h2>

        <p>
          Los pagos enviados por las cuentas
          aparecerán aquí para su revisión.
        </p>

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
          event.target.value ||
          ""
        )
          .trim()
          .toLowerCase();

      // La búsqueda se conectará al
      // dataset real en el siguiente paso.

    }
  );


  filterButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          activeFilter =
            button.dataset.paymentFilter ||
            "all";


          filterButtons.forEach(
            item => {

              item.classList.toggle(
                "is-active",
                item === button
              );

            }
          );

          // El filtrado real se conectará
          // al dataset de Payments.

        }
      );

    }
  );

  // ========================================
  // SUMMARY
  // ========================================

  function renderSummary(
    summary = {}
  ) {

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


    if (pending) {

      pending.textContent =
        summary.pending ||
        0;

    }


    if (review) {

      review.textContent =
        summary.underReview ||
        0;

    }


    if (approved) {

      approved.textContent =
        summary.approved ||
        0;

    }


    if (rejected) {

      rejected.textContent =
        summary.rejected ||
        0;

    }

  }


  // ========================================
  // ESCAPE HTML
  // ========================================

  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }


  // ========================================
  // PAYMENT LABELS
  // ========================================

  function getPaymentStatusLabel(
    status
  ) {

    const labels = {

      pending:
        "Pendiente",

      under_review:
        "En revisión",

      approved:
        "Aprobado",

      rejected:
        "Rechazado",

      expired:
        "Expirado"

    };


    return (
      labels[status] ||
      status ||
      "Desconocido"
    );

  }


  function getPaymentMethodLabel(
    method
  ) {

    const labels = {

      bank_transfer:
        "Transferencia",

      bank_deposit:
        "Depósito bancario"

    };


    return (
      labels[method] ||
      method ||
      "—"
    );

  }


  // ========================================
  // PAYMENT DATE
  // ========================================

  function formatPaymentDate(
    payment
  ) {

    if (
      payment.paymentDate
    ) {

      const date =
        new Date(
          `${payment.paymentDate}T12:00:00`
        );


      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {

        return date.toLocaleDateString(
          "es-GT",
          {

            day:
              "2-digit",

            month:
              "2-digit",

            year:
              "numeric"

          }
        );

      }

    }


    if (
      payment.createdAt
    ) {

      const date =
        new Date(
          payment.createdAt
        );


      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {

        return date.toLocaleDateString(
          "es-GT",
          {

            day:
              "2-digit",

            month:
              "2-digit",

            year:
              "numeric"

          }
        );

      }

    }


    return "—";

  }


  // ========================================
  // PAYMENT ROW
  // ========================================

  function renderPayments(
    payments = []
  ) {

    let filteredPayments =
      [...payments];


    // ------------------------------------
    // FILTER
    // ------------------------------------

    if (
      activeFilter !==
      "all"
    ) {

      filteredPayments =
        filteredPayments.filter(
          payment =>
            payment.status ===
            activeFilter
        );

    }


    // ------------------------------------
    // SEARCH
    // ------------------------------------

    if (
      searchTerm
    ) {

      filteredPayments =
        filteredPayments.filter(
          payment => {

            const account =
              payment.account ||
              {};

            const searchableText = [

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
              .filter(
                Boolean
              )
              .join(
                " "
              )
              .toLowerCase();


            return searchableText.includes(
              searchTerm
            );

          }
        );

    }


    // ------------------------------------
    // EMPTY
    // ------------------------------------

    if (
      !filteredPayments.length
    ) {

      table.innerHTML = `

        <div class="admin-payments__empty">

          <div class="admin-payments__empty-icon">

            <i
              class="fa-regular fa-credit-card"
              aria-hidden="true"
            ></i>

          </div>

          <h2>
            No hay pagos para mostrar
          </h2>

          <p>
            No existen pagos que coincidan
            con los filtros actuales.
          </p>

        </div>

      `;

      return;

    }


    // ------------------------------------
    // TABLE
    // ------------------------------------

    table.innerHTML = `

      <table class="admin-payments__table">

        <thead>

          <tr>

            <th>
              Cuenta
            </th>

            <th>
              Plan
            </th>

            <th>
              Monto
            </th>

            <th>
              Método
            </th>

            <th>
              Fecha
            </th>

            <th>
              Estado
            </th>

            <th>
              Referencia
            </th>

          </tr>

        </thead>


        <tbody>

          ${filteredPayments
            .map(
              payment => {

                const account =
                  payment.account ||
                  {};

                const accountName =
                  account.name ||
                  account.email ||
                  payment.accountId ||
                  "Cuenta";


                const amount =
                  Number(
                    payment.amount ||
                    0
                  );


                return `

                  <tr>

                    <td>

                      <strong>
                        ${
                          escapeHtml(
                            accountName
                          )
                        }
                      </strong>

                      ${
                        account.email
                          ? `
                            <small>
                              ${
                                escapeHtml(
                                  account.email
                                )
                              }
                            </small>
                          `
                          : ""
                      }

                    </td>


                    <td>

                      <strong>
                        ${
                          escapeHtml(
                            payment.planId ||
                            "—"
                          )
                        }
                      </strong>

                    </td>


                    <td>

                      <strong>
                        Q${
                          amount.toFixed(
                            2
                          )
                        }
                      </strong>

                    </td>


                    <td>

                      ${
                        escapeHtml(
                          getPaymentMethodLabel(
                            payment.method
                          )
                        )
                      }

                    </td>


                    <td>

                      ${
                        escapeHtml(
                          formatPaymentDate(
                            payment
                          )
                        )
                      }

                    </td>


                    <td>

                      <span
                        class="admin-payments__status admin-payments__status--${escapeHtml(
                          payment.status ||
                          "unknown"
                        )}"
                      >

                        ${
                          escapeHtml(
                            getPaymentStatusLabel(
                              payment.status
                            )
                          )
                        }

                      </span>

                    </td>


                    <td>

                      ${
                        payment.reference
                          ? escapeHtml(
                              payment.reference
                            )
                          : "—"
                      }

                    </td>

                  </tr>

                `;

              }
            )
            .join("")}

        </tbody>

      </table>

    `;

  }
  // ========================================
  // LOAD
  // ========================================

  async function loadPayments() {

    table.innerHTML = `

      <div class="admin-payments__loading">

        <div class="admin-payments__loading-icon">

          <i
            class="fa-solid fa-spinner fa-spin"
            aria-hidden="true"
          ></i>

        </div>

        <strong>
          Cargando pagos
        </strong>

        <span>
          Consultando Billing...
        </span>

      </div>

    `;


    const hasAccess =
      await validateAccess();


    if (!hasAccess) {

      return;

    }


    try {

      const session =
        window.firebaseAuth
          ?.currentUser;


      if (!session) {

        throw new Error(
          "No hay una sesión de Firebase activa."
        );

      }


      const idToken =
        await session.getIdToken();


      const response =
        await fetch(
          "/api/admin-billing-payments",
          {

            method:
              "GET",

            headers: {

              Authorization:
                `Bearer ${idToken}`,

              Accept:
                "application/json"

            }

          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {

        throw new Error(
          data.error ||
          "No fue posible cargar los pagos."
        );

      }


      renderSummary(
        data.summary
      );


      renderPayments(
        data.payments
      );


    } catch (
      error
    ) {

      console.error(
        "NEXUS — Admin Payments:",
        error
      );


      table.innerHTML = `

        <div class="admin-payments__empty">

          <div class="admin-payments__empty-icon">

            <i
              class="fa-solid fa-triangle-exclamation"
              aria-hidden="true"
            ></i>

          </div>

          <h2>
            No fue posible cargar los pagos
          </h2>

          <p>
            ${
              error.message ||
              "Ocurrió un error inesperado."
            }
          </p>

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