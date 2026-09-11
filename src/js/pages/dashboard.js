// ========================================
// NEXUS — Dashboard
// ========================================

import { getCurrentSession } from "../services/session.js";
import { logout } from "../services/auth.js";

import {
  getCurrentAccountContext
} from "../services/account.js";


// ========================================
// PAGE
// ========================================

export function Dashboard() {

  const page =
    document.createElement("main");

  page.className =
    "dashboard-page";


  // ========================================
  // SESSION
  // ========================================

  const session =
    getCurrentSession();


  // ========================================
  // NO SESSION
  // ========================================

  if (!session) {

    console.log(
      "NEXUS — No hay sesión activa"
    );


    page.innerHTML = `

      <div class="dashboard-page__container">

        <h1>
          SIN SESIÓN
        </h1>

        <p>
          No hay una sesión activa en NEXUS.
        </p>

      </div>

    `;

    return page;

  }


  // ========================================
  // INITIAL STATE
  // ========================================

  page.innerHTML = `

    <div class="dashboard-page__container">

      <header class="dashboard-page__header">

        <span class="dashboard-page__status">
          ● SESIÓN ACTIVA
        </span>

        <h1>
          MI NEXUS
        </h1>

        <p>
          Cargando información de tu cuenta...
        </p>

      </header>


      <section class="dashboard-page__session">

        <div class="dashboard-page__item">

          <span>
            EMAIL
          </span>

          <strong>
            ${session.user.email}
          </strong>

        </div>


        <div class="dashboard-page__item">

          <span>
            UID
          </span>

          <strong>
            ${session.user.uid}
          </strong>

        </div>


        <div class="dashboard-page__item">

          <span>
            CUENTA
          </span>

          <strong>
            CARGANDO...
          </strong>

        </div>


        <div class="dashboard-page__item">

          <span>
            PLAN
          </span>

          <strong>
            CARGANDO...
          </strong>

        </div>


        <div class="dashboard-page__item">

          <span>
            SUSCRIPCIÓN
          </span>

          <strong>
            CARGANDO...
          </strong>

        </div>


        <div class="dashboard-page__item">

          <span>
            ESTADO
          </span>

          <strong>
            CARGANDO...
          </strong>

        </div>

      </section>


      <button
        type="button"
        class="dashboard-page__logout"
      >
        CERRAR SESIÓN
      </button>

    </div>

  `;


  // ========================================
  // ELEMENTS
  // ========================================

  const container =
    page.querySelector(
      ".dashboard-page__container"
    );

  const headerDescription =
    page.querySelector(
      ".dashboard-page__header p"
    );

  const items =
    page.querySelectorAll(
      ".dashboard-page__item strong"
    );


  const logoutButton =
    page.querySelector(
      ".dashboard-page__logout"
    );


  // ========================================
  // LOAD ACCOUNT CONTEXT
  // ========================================

  async function loadAccountContext() {

    try {

      const context =
        await getCurrentAccountContext();


      // ====================================
      // ACCOUNT NOT FOUND
      // ====================================

      if (!context) {

        console.error(
          "NEXUS — No fue posible cargar la cuenta."
        );


        headerDescription.textContent =
          "No fue posible cargar la información de tu cuenta.";

        items[2].textContent =
          "NO DISPONIBLE";

        items[3].textContent =
          "—";

        items[4].textContent =
          "—";

        items[5].textContent =
          "—";

        return;

      }


      const {
        account,
        subscription
      } = context;


      // ====================================
      // ACCOUNT
      // ====================================

      items[2].textContent =
        account.accountStatus ||
        "—";


      // ====================================
      // PLAN
      // ====================================

      items[3].textContent =
        account.planId ||
        "—";


      // ====================================
      // SUBSCRIPTION
      // ====================================

      items[4].textContent =
        subscription?.status ||
        "—";


      // ====================================
      // ACCOUNT STATUS
      // ====================================

      items[5].textContent =
        account.accountStatus ||
        "—";


      // ====================================
      // DESCRIPTION
      // ====================================

      headerDescription.textContent =
        "Cuenta NEXUS cargada correctamente.";


      // ====================================
      // DEBUG
      // ====================================

      console.log(
        "NEXUS — Account Context:",
        context
      );

    } catch (error) {

      console.error(
        "NEXUS — Error cargando Account Context:",
        error
      );


      headerDescription.textContent =
        "Ocurrió un error cargando la información de tu cuenta.";


      items[2].textContent =
        "ERROR";

      items[3].textContent =
        "—";

      items[4].textContent =
        "—";

      items[5].textContent =
        "—";

    }

  }


  // ========================================
  // LOAD
  // ========================================

  loadAccountContext();


  // ========================================
  // LOGOUT
  // ========================================

  logoutButton.addEventListener(
    "click",
    async () => {

      try {

        logoutButton.disabled =
          true;

        logoutButton.textContent =
          "CERRANDO SESIÓN...";


        await logout();


        console.log(
          "NEXUS — Sesión cerrada correctamente"
        );

      } catch (error) {

        console.error(
          "NEXUS — Error cerrando sesión:",
          error
        );


        logoutButton.disabled =
          false;

        logoutButton.textContent =
          "CERRAR SESIÓN";

      }

    }
  );


  return page;

}