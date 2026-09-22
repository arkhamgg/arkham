// ========================================
// ARKHAM — Create League Page
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

export function CreateLeague() {

  const page =
    document.createElement("main");

  page.className =
    "create-league-page";


  // ========================================
  // PAGE CONTENT
  // ========================================

  page.innerHTML = `

    <div class="create-league-page__container">

      <!-- ========================================
           HEADER
      ======================================== -->

      <header class="create-league-page__header">

        <div class="create-league-page__eyebrow">

          <span>
            01
          </span>

          <span>
            CREATE LEAGUE
          </span>

        </div>


        <div class="create-league-page__heading">

          <h1>
            CREA TU
            <span>LIGA.</span>
          </h1>

          <p>
            Define la identidad y presencia
            oficial de tu liga dentro de ARKHAM.
          </p>

        </div>

      </header>


      <!-- ========================================
           FORM
      ======================================== -->

      <form
        class="create-league-page__form"
        novalidate
      >


        <!-- ========================================
             BASIC INFORMATION
        ======================================== -->

        <section
          class="create-league-page__basic-info"
        >

        </section>


        <!-- ========================================
             ACCOUNT
        ======================================== -->

        <section
          class="create-league-page__account"
        >

        </section>


        <!-- ========================================
             ACTIONS
        ======================================== -->

        <footer class="create-league-page__actions">

          <button
            type="button"
            class="create-league-page__button create-league-page__button--cancel"
          >
            CANCELAR
          </button>


          <button
            type="submit"
            class="create-league-page__button create-league-page__button--primary"
          >

            <span>
              CREAR LIGA
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
      showFoundationYear: true,
      descriptionPlaceholder:
        "Describe brevemente tu liga, su propósito y propuesta competitiva."
    });


  const basicInfoContainer =
    page.querySelector(
      ".create-league-page__basic-info"
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
      ".create-league-page__account"
    );


  accountContainer.appendChild(
    accountCredentials
  );


  // ========================================
  // FORM
  // ========================================

  const form =
    page.querySelector(
      ".create-league-page__form"
    );


  // ========================================
  // CANCEL
  // ========================================

  const cancelButton =
    page.querySelector(
      ".create-league-page__button--cancel"
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
        // LEAGUE DATA
        // ========================================

        const leagueData = {

          name:
            formData.get("name"),

          shortName:
            formData.get("shortName"),

          description:
            formData.get("description"),

          foundationYear:
            Number(
              formData.get(
                "foundationYear"
              )
            ),

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
        // CREATE LEAGUE
        // ========================================

        const leagueId =
          await createEntity(
            "leagues",
            leagueData
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
                  "/nexus/leagues"
              }
            );




          // ========================================
          // UPDATE LEAGUE WITH LOGO
          // ========================================

          await updateEntity(
            "leagues",
            leagueId,
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
              "league",

            entityId:
              leagueId

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
          "ARKHAM — Error creando Liga:",
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
      "create-league-page--visible"
    );

  });


  return page;

}