// ========================================
// NEXUS — Dashboard
// ========================================

import { getCurrentSession } from "../services/session.js";
import { logout } from "../services/auth.js";

import {
  getCurrentAccount
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
  // ACCOUNT
  // ========================================

  const account =
    getCurrentAccount();


  console.log(
    "NEXUS — Account:",
    account
  );


  // ========================================
  // DASHBOARD
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
          Sesión autenticada correctamente.
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
            TIPO DE ENTIDAD
          </span>

          <strong>
            ${session.profile?.entityType || "—"}
          </strong>

        </div>


        <div class="dashboard-page__item">

          <span>
            ID DE ENTIDAD
          </span>

          <strong>
            ${session.profile?.entityId || "—"}
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
  // LOGOUT
  // ========================================

  const logoutButton =
    page.querySelector(
      ".dashboard-page__logout"
    );


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
