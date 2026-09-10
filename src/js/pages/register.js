// ========================================
// NEXUS — Register Page
// ========================================

export function Register() {

  const page =
    document.createElement("main");

  page.className =
    "register-page";

  page.id =
    "register-page";


  page.innerHTML = `

    <div class="register-page__container">


      <!-- ========================================
           HEADER
      ======================================== -->

      <header class="register-page__header">

        <div class="register-page__heading">

          <h1>
            CREA TU <span>CUENTA.</span>
          </h1>

          <p>
            Elige qué quieres crear dentro de NEXUS
            para comenzar.
          </p>

        </div>

      </header>


      <!-- ========================================
           ACCOUNT TYPES
      ======================================== -->

      <section
        class="register-page__types"
        aria-labelledby="register-types-title"
      >

        <div class="register-page__section-heading">

          <span id="register-types-title">
            SELECCIONA UN TIPO
          </span>

          <span>
            ELIGE UNA OPCIÓN PARA CONTINUAR
          </span>

        </div>


        <div class="register-page__grid">


          <!-- ========================================
               LIGA
          ======================================== -->

          <button
            type="button"
            class="register-type"
            data-type="league"
          >

            <span class="register-type__number">
              01
            </span>

            <span class="register-type__icon">

              <i
                class="fa-solid fa-trophy"
                aria-hidden="true"
              ></i>

            </span>

            <span class="register-type__content">

              <strong>
                LIGA
              </strong>

              <span>
                Crea y administra una estructura
                competitiva recurrente.
              </span>

            </span>

            <span class="register-type__arrow">

              <i
                class="fa-solid fa-arrow-right"
                aria-hidden="true"
              ></i>

            </span>

          </button>


          <!-- ========================================
               TORNEO
          ======================================== -->

          <button
            type="button"
            class="register-type"
            data-type="tournament"
          >

            <span class="register-type__number">
              02
            </span>

            <span class="register-type__icon">

              <i
                class="fa-solid fa-bolt"
                aria-hidden="true"
              ></i>

            </span>

            <span class="register-type__content">

              <strong>
                TORNEO
              </strong>

              <span>
                Organiza una competencia
                individual.
              </span>

            </span>

            <span class="register-type__arrow">

              <i
                class="fa-solid fa-arrow-right"
                aria-hidden="true"
              ></i>

            </span>

          </button>


          <!-- ========================================
               JUGADOR
          ======================================== -->

          <button
            type="button"
            class="register-type"
            data-type="player"
          >

            <span class="register-type__number">
              03
            </span>

            <span class="register-type__icon">

              <i
                class="fa-solid fa-user"
                aria-hidden="true"
              ></i>

            </span>

            <span class="register-type__content">

              <strong>
                JUGADOR
              </strong>

              <span>
                Crea tu perfil competitivo
                dentro de NEXUS.
              </span>

            </span>

            <span class="register-type__arrow">

              <i
                class="fa-solid fa-arrow-right"
                aria-hidden="true"
              ></i>

            </span>

          </button>


          <!-- ========================================
               EQUIPO
          ======================================== -->

          <button
            type="button"
            class="register-type"
            data-type="team"
          >

            <span class="register-type__number">
              04
            </span>

            <span class="register-type__icon">

              <i
                class="fa-solid fa-shield-halved"
                aria-hidden="true"
              ></i>

            </span>

            <span class="register-type__content">

              <strong>
                EQUIPO
              </strong>

              <span>
                Crea y administra una organización
                competitiva.
              </span>

            </span>

            <span class="register-type__arrow">

              <i
                class="fa-solid fa-arrow-right"
                aria-hidden="true"
              ></i>

            </span>

          </button>

        </div>


        <!-- ========================================
             CONTINUE
        ======================================== -->

        <div class="register-page__continue">

          <span class="register-page__selection">
            SELECCIONA UNA OPCIÓN
          </span>

          <button
            type="button"
            class="register-page__continue-button"
            disabled
          >

            <span>
              CONTINUAR
            </span>

            <i
              class="fa-solid fa-arrow-right"
              aria-hidden="true"
            ></i>

          </button>

        </div>

      </section>


      <!-- ========================================
           LOGIN
      ======================================== -->

      <footer class="register-page__footer">

        <span>
          ¿YA TIENES UNA CUENTA?
        </span>

        <a href="/login">

          INICIAR SESIÓN

          <i
            class="fa-solid fa-arrow-right"
            aria-hidden="true"
          ></i>

        </a>

      </footer>

    </div>

  `;


  // ========================================
  // TYPE SELECTION
  // ========================================

  const typeButtons =
    page.querySelectorAll(
      ".register-type"
    );


  const continueButton =
    page.querySelector(
      ".register-page__continue-button"
    );


  const selectionLabel =
    page.querySelector(
      ".register-page__selection"
    );


  let selectedType =
    null;


  typeButtons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          // ========================================
          // REMOVE PREVIOUS SELECTION
          // ========================================

          typeButtons.forEach(
            (item) => {

              item.classList.remove(
                "register-type--selected"
              );

            }
          );


          // ========================================
          // SELECT CURRENT TYPE
          // ========================================

          button.classList.add(
            "register-type--selected"
          );


          // ========================================
          // SAVE SELECTED TYPE
          // ========================================

          selectedType =
            button.dataset.type;


          // ========================================
          // GET VISIBLE NAME
          // ========================================

          const selectedName =
            button
              .querySelector(
                ".register-type__content strong"
              )
              .textContent
              .trim();


          // ========================================
          // UPDATE SELECTION LABEL
          // ========================================

          selectionLabel.textContent =
            `SELECCIONADO: ${selectedName}`;


          // ========================================
          // ENABLE CONTINUE BUTTON
          // ========================================

          continueButton.disabled =
            false;

        }
      );

    }
  );


  // ========================================
  // CONTINUE
  // ========================================

  continueButton.addEventListener(
    "click",
    () => {

      if (!selectedType) {

        return;

      }


      console.log(
        "NEXUS — Tipo de cuenta seleccionado:",
        selectedType
      );


      // ========================================
      // LEAGUE
      // ========================================

      if (
        selectedType ===
        "league"
      ) {

        window.history.pushState(
          {},
          "",
          "/register/league"
        );


        window.dispatchEvent(
          new PopStateEvent(
            "popstate"
          )
        );


        return;

      }


      // ========================================
      // TOURNAMENT
      // ========================================

      if (
        selectedType ===
        "tournament"
      ) {

        window.history.pushState(
          {},
          "",
          "/register/tournament"
        );


        window.dispatchEvent(
          new PopStateEvent(
            "popstate"
          )
        );


        return;

      }


      // ========================================
      // TEAM
      // ========================================

      if (
        selectedType ===
        "team"
      ) {

        window.history.pushState(
          {},
          "",
          "/register/team"
        );


        window.dispatchEvent(
          new PopStateEvent(
            "popstate"
          )
        );


        return;

      }


      // ========================================
      // PLAYER
      // ========================================

      if (
        selectedType ===
        "player"
      ) {

        window.history.pushState(
          {},
          "",
          "/register/player"
        );


        window.dispatchEvent(
          new PopStateEvent(
            "popstate"
          )
        );


        return;

      }

    }
  );


  // ========================================
  // PAGE REVEAL
  // ========================================

  requestAnimationFrame(
    () => {

      page.classList.add(
        "register-page--visible"
      );

    }
  );


  return page;

}