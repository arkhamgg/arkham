// ========================================
// ARKHAM — Login Page
// ========================================

import { login } from "../services/auth.js";

import {
  getCurrentSession,
  initializeSession,
  waitForAuthenticatedSession
} from "../services/session.js";

import {
  getCurrentAdminAccess
} from "../services/adminAccess.js";


// ========================================
// PAGE
// ========================================

export function Login() {

  const page =
    document.createElement("main");

  page.className =
    "login-page";


  // ========================================
  // RESOLVE DASHBOARD
  // ========================================

  async function resolveDashboardPath() {

    // ----------------------------------------
    // ADMIN ACCESS
    // ----------------------------------------

    const adminAccess =
      await getCurrentAdminAccess();


    if (
      adminAccess &&
      (
        adminAccess.roleId === "administrator" ||
        adminAccess.roleId === "agent"
      )
    ) {

      return "/dashboard/admin";

    }


    // ----------------------------------------
    // CLIENT DASHBOARD
    // ----------------------------------------

    return "/dashboard";

  }


  // ========================================
  // NAVIGATE
  // ========================================

  async function navigateAuthenticatedUser(
    replace = false
  ) {

    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    if (returnTo && returnTo.startsWith("/")) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", returnTo);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }

    const destination =
      await resolveDashboardPath();


    


    const currentPath =
      window.location.pathname;


    if (
      currentPath ===
      destination
    ) {

      return;

    }


    if (replace) {

      window.history.replaceState(
        {},
        "",
        destination
      );

    } else {

      window.history.pushState(
        {},
        "",
        destination
      );

    }


    window.dispatchEvent(
      new PopStateEvent("popstate")
    );

  }


  // ========================================
  // SESSION GUARD
  // ========================================

  initializeSession()
    .then(
      async () => {

        const currentSession =
          getCurrentSession();


        // ========================================
        // NO AUTHENTICATED SESSION
        // ========================================

        if (!currentSession) {

          return;

        }


        // ========================================
        // ALREADY AUTHENTICATED
        // ========================================

        try {

          await navigateAuthenticatedUser(
            true
          );

        } catch (error) {

          console.error(
            "ARKHAM — Error determinando dashboard:",
            error
          );

        }

      }
    )
    .catch(
      (error) => {

        console.error(
          "ARKHAM — Error verificando sesión:",
          error
        );

      }
    );


  // ========================================
  // PAGE CONTENT
  // ========================================

  page.innerHTML = `

    <div class="login-page__container">

      <section class="login-page__content">

        <!-- ========================================
             HEADER
        ======================================== -->

        <header class="login-page__header">

          <span class="login-page__eyebrow">
            ARKHAM ACCOUNT
          </span>

          <h1>
            INICIA
            <span>SESIÓN.</span>
          </h1>

          <p>
            Accede a tu espacio de gestión
            dentro de ARKHAM.
          </p>

        </header>


        <!-- ========================================
             FORM
        ======================================== -->

        <form
          class="login-page__form"
          novalidate
        >

          <!-- EMAIL -->

          <div class="login-page__field">

            <label
              for="login-email"
            >
              EMAIL
            </label>

            <input
              id="login-email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="tu@email.com"
              required
            >

          </div>


          <!-- PASSWORD -->

          <div class="login-page__field">

            <label
              for="login-password"
            >
              CONTRASEÑA
            </label>

            <input
              id="login-password"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="Tu contraseña"
              minlength="8"
              required
            >

          </div>


          <!-- ERROR -->

          <p
            class="login-page__error"
            role="alert"
            aria-live="polite"
            hidden
          ></p>


          <!-- SUBMIT -->

          <button
            type="submit"
            class="login-page__submit"
          >

            <span>
              INICIAR SESIÓN
            </span>

            <i
              class="fa-solid fa-arrow-right"
              aria-hidden="true"
            ></i>

          </button>

        </form>


        <!-- ========================================
             REGISTER
        ======================================== -->

        <div class="login-page__register">

          <span>
            ¿AÚN NO TIENES UNA CUENTA?
          </span>

          <a href="/register">
            CREAR CUENTA
          </a>

        </div>

      </section>

    </div>

  `;


  // ========================================
  // ELEMENTS
  // ========================================

  const form =
    page.querySelector(
      ".login-page__form"
    );


  const emailInput =
    page.querySelector(
      "#login-email"
    );


  const passwordInput =
    page.querySelector(
      "#login-password"
    );


  const errorMessage =
    page.querySelector(
      ".login-page__error"
    );


  const submitButton =
    page.querySelector(
      ".login-page__submit"
    );


  // ========================================
  // SUBMIT
  // ========================================

  form.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      // ========================================
      // CLEAR ERROR
      // ========================================

      errorMessage.hidden =
        true;

      errorMessage.textContent =
        "";

      emailInput.removeAttribute(
        "aria-invalid"
      );

      passwordInput.removeAttribute(
        "aria-invalid"
      );


      // ========================================
      // VALUES
      // ========================================

      const email =
        emailInput.value.trim();

      const password =
        passwordInput.value;


      // ========================================
      // VALIDATION
      // ========================================

      let isValid =
        true;


      if (!email) {

        emailInput.setAttribute(
          "aria-invalid",
          "true"
        );

        isValid =
          false;

      }


      if (!password) {

        passwordInput.setAttribute(
          "aria-invalid",
          "true"
        );

        isValid =
          false;

      }


      if (!isValid) {

        errorMessage.textContent =
          "Completa todos los campos.";

        errorMessage.hidden =
          false;

        return;

      }


      // ========================================
      // LOGIN
      // ========================================

      try {

        submitButton.disabled =
          true;

        submitButton.querySelector(
          "span"
        ).textContent =
          "INICIANDO SESIÓN...";


        // ========================================
        // FIREBASE LOGIN
        // ========================================

        const user =
          await login(
            email,
            password
          );


        


        // ========================================
        // WAIT FOR ARKHAM SESSION
        // ========================================

        const session =
          await waitForAuthenticatedSession();


        


        // ========================================
        // NAVIGATE TO CORRECT DASHBOARD
        // ========================================

        await navigateAuthenticatedUser();


      } catch (error) {

        console.error(
          "ARKHAM — Error iniciando sesión:",
          error
        );


        // ========================================
        // FIREBASE ERRORS
        // ========================================

        if (
          error.code ===
          "auth/invalid-credential"
        ) {

          errorMessage.textContent =
            "El email o la contraseña no son correctos.";

        } else if (
          error.code ===
          "auth/too-many-requests"
        ) {

          errorMessage.textContent =
            "Demasiados intentos. Intenta nuevamente más tarde.";

        } else {

          errorMessage.textContent =
            "No fue posible iniciar sesión. Intenta nuevamente.";

        }


        errorMessage.hidden =
          false;


        submitButton.disabled =
          false;


        submitButton.querySelector(
          "span"
        ).textContent =
          "INICIAR SESIÓN";

      }

    }
  );


  // ========================================
  // PAGE REVEAL
  // ========================================

  requestAnimationFrame(() => {

    page.classList.add(
      "login-page--visible"
    );

  });


  return page;

}