// ========================================
// ARKHAM — Create Tournament Page
// ========================================

import { EntityBasicInfo } from "../components/entityBasicInfo.js";
import { AccountCredentials } from "../components/accountCredentials.js";

import { createAccount } from "../services/auth.js";

import {
  provisionCurrentAccount
} from "../services/account.js";

import {
  waitForAuthenticatedSession,
  refreshSession
} from "../services/session.js";

import {
  createEntity,
  updateEntity
} from "../services/firestore.js";

import {
  uploadImage
} from "../services/imagekit.js";


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
            oficial de tu torneo dentro de ARKHAM.
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
      // LOGO FILE
      // ========================================

      const logoInput =
        form.querySelector(
          "#entity-logo"
        );


      const logoFile =
        logoInput?.files?.[0] || null;


      // ========================================
      // CREATE FIREBASE ACCOUNT
      // ========================================

      try {



        const user =
          await createAccount(
            email,
            passwordValue
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




        // ========================================
        // UPLOAD LOGO
        // ========================================

        if (logoFile) {



          const logoResult =
            await uploadImage(
              logoFile,
              {
                folder:
                  "/arkham/tournaments"
              }
            );




          // ========================================
          // UPDATE TOURNAMENT WITH LOGO
          // ========================================

          await updateEntity(
            "tournaments",
            tournamentId,
            {
              logo: {

                url:
                  logoResult.url,

                fileId:
                  logoResult.fileId,

                filePath:
                  logoResult.filePath

              }
            }
          );


          

        } else {

          

        }


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


        


        // ========================================
        // PROVISION ACCOUNT
        // ========================================

        const accountProvision =
          await provisionCurrentAccount();




        // ========================================
        // WAIT FOR ARKHAM SESSION
        // ========================================

        const session =
          await waitForAuthenticatedSession();




        // ========================================
        // REFRESH ARKHAM SESSION
        // ========================================

        const refreshedSession =
          await refreshSession();




        // ========================================
        // NAVIGATE TO DASHBOARD
        // ========================================

        window.history.pushState(
          {},
          "",
          "/dashboard"
        );


        window.dispatchEvent(
          new PopStateEvent("popstate")
        );


      } catch (error) {

        console.error(
          "ARKHAM — Error creando Torneo:",
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