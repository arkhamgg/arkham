// ========================================
// NEXUS — Create Tournament Page
// ========================================

import { EntityBasicInfo } from "../components/entityBasicInfo.js";
import { AccountCredentials } from "../components/accountCredentials.js";

import { createAccount } from "../services/auth.js";
import { createEntity } from "../services/firestore.js";


// ========================================
// PAGE
// ========================================

export function CreateTournament() {

  const page =
    document.createElement("main");

  page.className =
    "create-tournament-page";


  // ========================================
  // PAGE CONTENT
  // ========================================

  page.innerHTML = `

    <div class="create-tournament-page__container">

      <!-- ========================================
           HEADER
      ======================================== -->

      <header class="create-tournament-page__header">

        <div class="create-tournament-page__eyebrow">

          <span>
            01
          </span>

          <span>
            CREATE TOURNAMENT
          </span>

        </div>


        <div class="create-tournament-page__heading">

          <h1>
            CREA TU
            <span>TORNEO.</span>
          </h1>

          <p>
            Define la identidad y presencia
            oficial de tu torneo dentro de NEXUS.
          </p>

        </div>

      </header>


      <!-- ========================================
           FORM
      ======================================== -->

      <form
        class="create-tournament-page__form"
        novalidate
      >

        <!-- ========================================
             BASIC INFORMATION
        ======================================== -->

        <section
          class="create-tournament-page__basic-info"
        >

        </section>


        <!-- ========================================
             ACCOUNT
        ======================================== -->

        <section
          class="create-tournament-page__account"
        >

        </section>


        <!-- ========================================
             ACTIONS
        ======================================== -->

        <footer class="create-tournament-page__actions">

          <button
            type="button"
            class="create-tournament-page__button create-tournament-page__button--cancel"
          >
            CANCELAR
          </button>


          <button
            type="submit"
            class="create-tournament-page__button create-tournament-page__button--primary"
          >

            <span>
              CREAR TORNEO
            </span>

            <i
              class="fa-solid fa-arrow-right"
              aria-hidden="true"
            ></i>

          </button>

        </footer>

      </form>

    </div>

  `;


  // ========================================
  // BASIC INFO COMPONENT
  // ========================================

  const basicInfo =
    EntityBasicInfo({
      showFoundationYear: false,
      descriptionPlaceholder:
        "Describe brevemente tu torneo, su concepto y propuesta competitiva."
    });


  const basicInfoContainer =
    page.querySelector(
      ".create-tournament-page__basic-info"
    );


  basicInfoContainer.appendChild(
    basicInfo
  );


  // ========================================
  // ACCOUNT COMPONENT
  // ========================================

  const accountCredentials =
    AccountCredentials();


  const accountContainer =
    page.querySelector(
      ".create-tournament-page__account"
    );


  accountContainer.appendChild(
    accountCredentials
  );


  // ========================================
  // FORM
  // ========================================

  const form =
    page.querySelector(
      ".create-tournament-page__form"
    );


  // ========================================
  // CANCEL
  // ========================================

  const cancelButton =
    page.querySelector(
      ".create-tournament-page__button--cancel"
    );


  cancelButton.addEventListener(
    "click",
    () => {

      window.history.pushState(
        {},
        "",
        "/register"
      );

      window.dispatchEvent(
        new PopStateEvent("popstate")
      );

    }
  );


  // ========================================
  // SUBMIT
  // ========================================

  form.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      // ========================================
      // REQUIRED FIELDS
      // ========================================

      const requiredFields =
        form.querySelectorAll(
          "[required]"
        );


      let isValid = true;


      requiredFields.forEach(
        (field) => {

          field.removeAttribute(
            "aria-invalid"
          );


          if (!field.value.trim()) {

            field.setAttribute(
              "aria-invalid",
              "true"
            );

            isValid = false;

          }

        }
      );


      // ========================================
      // PASSWORD MATCH
      // ========================================

      const password =
        form.querySelector(
          "#account-password"
        );


      const passwordConfirm =
        form.querySelector(
          "#account-password-confirm"
        );


      if (
        password &&
        passwordConfirm &&
        password.value !== passwordConfirm.value
      ) {

        passwordConfirm.setAttribute(
          "aria-invalid",
          "true"
        );

        isValid = false;

      }


      // ========================================
      // STOP IF INVALID
      // ========================================

      if (!isValid) {

        const firstInvalidField =
          form.querySelector(
            '[aria-invalid="true"]'
          );


        if (firstInvalidField) {

          firstInvalidField.focus();

        }

        return;

      }


      // ========================================
      // FORM DATA
      // ========================================

      const formData =
        new FormData(form);


      const email =
        formData.get("email");


      const passwordValue =
        formData.get("password");


      // ========================================
      // CREATE FIREBASE ACCOUNT
      // ========================================

      try {

        console.log(
          "NEXUS — Creando cuenta..."
        );


        const user =
          await createAccount(
            email,
            passwordValue
          );


        console.log(
          "NEXUS — Cuenta creada:",
          user.uid
        );


        // ========================================
        // TOURNAMENT DATA
        // ========================================

        const tournamentData = {

          name:
            formData.get("name"),

          shortName:
            formData.get("shortName"),

          description:
            formData.get("description"),

          instagram:
            formData.get("instagram"),

          facebook:
            formData.get("facebook"),

          tiktok:
            formData.get("tiktok"),

          youtube:
            formData.get("youtube"),

          twitch:
            formData.get("twitch"),

          kick:
            formData.get("kick"),

          ownerId:
            user.uid

        };


        // ========================================
        // CREATE TOURNAMENT
        // ========================================

        const tournamentId =
          await createEntity(
            "tournaments",
            tournamentData
          );


        console.log(
          "NEXUS — Torneo creado:",
          tournamentId
        );


        // ========================================
        // CREATE USER PROFILE
        // ========================================

        await createEntity(
          "users",
          {

            email:
              user.email,

            entityType:
              "tournament",

            entityId:
              tournamentId

          },
          user.uid
        );


        console.log(
          "NEXUS — Perfil de usuario creado:",
          user.uid
        );


      } catch (error) {

        console.error(
          "NEXUS — Error creando Torneo:",
          error
        );

      }

    }
  );


  // ========================================
  // PAGE REVEAL
  // ========================================

  requestAnimationFrame(() => {

    page.classList.add(
      "create-tournament-page--visible"
    );

  });


  return page;

}