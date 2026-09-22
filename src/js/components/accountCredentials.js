// ========================================
// ARKHAM — Account Credentials Component
// ========================================

export function AccountCredentials() {

  const component =
    document.createElement("section");

  component.className =
    "account-credentials";


  // ========================================
  // CONTENT
  // ========================================

  component.innerHTML = `

    <div class="account-credentials__header">

      <div class="account-credentials__number">
        03
      </div>

      <div>

        <span class="account-credentials__eyebrow">
          ARKHAM ACCOUNT
        </span>

        <h2>
          CUENTA
        </h2>

        <p>
          Crea las credenciales que utilizarás
          para administrar tu entidad en ARKHAM.
        </p>

      </div>

    </div>


    <div class="account-credentials__body">


      <!-- ========================================
           EMAIL
      ======================================== -->

      <div class="account-credentials__field">

        <label for="account-email">

          CORREO ELECTRÓNICO

          <span>
            REQUERIDO
          </span>

        </label>


        <input
          type="email"
          id="account-email"
          name="email"
          placeholder="correo@ejemplo.com"
          autocomplete="email"
          required
        >

      </div>


      <!-- ========================================
           PASSWORD GRID
      ======================================== -->

      <div class="account-credentials__fields-grid">


        <!-- PASSWORD -->

        <div class="account-credentials__field">

          <label for="account-password">

            CONTRASEÑA

            <span>
              REQUERIDO
            </span>

          </label>


          <div class="account-credentials__password">

            <input
              type="password"
              id="account-password"
              name="password"
              placeholder="Crea una contraseña"
              autocomplete="new-password"
              minlength="8"
              required
            >


            <button
              type="button"
              class="account-credentials__toggle"
              aria-label="Mostrar contraseña"
              aria-pressed="false"
            >

              <i
                class="fa-solid fa-eye"
                aria-hidden="true"
              ></i>

            </button>

          </div>


          <span class="account-credentials__hint">
            Mínimo 8 caracteres.
          </span>

        </div>


        <!-- CONFIRM PASSWORD -->

        <div class="account-credentials__field">

          <label for="account-password-confirm">

            CONFIRMAR CONTRASEÑA

            <span>
              REQUERIDO
            </span>

          </label>


          <div class="account-credentials__password">

            <input
              type="password"
              id="account-password-confirm"
              name="passwordConfirm"
              placeholder="Repite tu contraseña"
              autocomplete="new-password"
              minlength="8"
              required
            >


            <button
              type="button"
              class="account-credentials__toggle"
              aria-label="Mostrar contraseña"
              aria-pressed="false"
            >

              <i
                class="fa-solid fa-eye"
                aria-hidden="true"
              ></i>

            </button>

          </div>

        </div>

      </div>


      <!-- ========================================
           PASSWORD STATUS
      ======================================== -->

      <div
        class="account-credentials__status"
        aria-live="polite"
      >

        <i
          class="fa-solid fa-shield-halved"
          aria-hidden="true"
        ></i>

        <span>
          Tu contraseña se protegerá mediante
          Firebase Authentication.
        </span>

      </div>

    </div>

  `;


  // ========================================
  // PASSWORD VISIBILITY
  // ========================================

  const toggleButtons =
    component.querySelectorAll(
      ".account-credentials__toggle"
    );


  toggleButtons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const passwordWrapper =
            button.parentElement;

          const input =
            passwordWrapper.querySelector(
              "input"
            );

          const icon =
            button.querySelector("i");


          const isPassword =
            input.type === "password";


          input.type =
            isPassword
              ? "text"
              : "password";


          icon.classList.toggle(
            "fa-eye",
            !isPassword
          );

          icon.classList.toggle(
            "fa-eye-slash",
            isPassword
          );


          button.setAttribute(
            "aria-label",
            isPassword
              ? "Ocultar contraseña"
              : "Mostrar contraseña"
          );


          button.setAttribute(
            "aria-pressed",
            String(isPassword)
          );

        }
      );

    }
  );


  return component;
}