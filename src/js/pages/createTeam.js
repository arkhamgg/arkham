// ========================================
// ARKHAM — Create Team Page
// ========================================

import { EntityBasicInfo } from "../components/entityBasicInfo.js";
import { AccountCredentials } from "../components/accountCredentials.js";

import { createAccount } from "../services/auth.js";

import {
  waitForAuthenticatedSession,
  refreshSession
} from "../services/session.js";

import {
  createEntity,
  updateEntity
} from "../services/firestore.js";

import {
  provisionCurrentAccount
} from "../services/account.js";

import {
  uploadImage
} from "../services/imagekit.js";


// ========================================
// CREATE TEAM
// ========================================

export function CreateTeam() {

  const page =
    document.createElement("main");

  page.className =
    "create-team-page";


  // ========================================
  // PAGE STRUCTURE
  // ========================================

  page.innerHTML = `

    <div class="create-team-page__container">

      <header class="create-team-page__header">

        <div class="create-team-page__eyebrow">

          <span>01</span>

          <span>CREATE TEAM</span>

        </div>


        <div class="create-team-page__heading">

          <h1>
            CREA TU
            <span>EQUIPO.</span>
          </h1>

          <p>
            Define la identidad y presencia
            oficial de tu equipo dentro de ARKHAM.
          </p>

        </div>

      </header>


      <form
        class="create-team-page__form"
        novalidate
      >

        <section
          class="create-team-page__basic-info"
        ></section>


        <section
          class="create-team-page__account"
        ></section>


        <footer
          class="create-team-page__actions"
        >

          <button
            type="button"
            class="
              create-team-page__button
              create-team-page__button--cancel
            "
          >
            CANCELAR
          </button>


          <button
            type="submit"
            class="
              create-team-page__button
              create-team-page__button--primary
            "
          >

            <span>
              CREAR EQUIPO
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
  // BASIC INFORMATION
  // ========================================

  const basicInfo =
    EntityBasicInfo({
      showFoundationYear: false,
      descriptionPlaceholder:
        "Describe brevemente tu equipo, su identidad y propuesta competitiva."
    });


  const basicInfoContainer =
    page.querySelector(
      ".create-team-page__basic-info"
    );


  basicInfoContainer.appendChild(
    basicInfo
  );


  // ========================================
  // ACCOUNT CREDENTIALS
  // ========================================

  const accountCredentials =
    AccountCredentials();


  const accountContainer =
    page.querySelector(
      ".create-team-page__account"
    );


  accountContainer.appendChild(
    accountCredentials
  );


  // ========================================
  // FORM
  // ========================================

  const form =
    page.querySelector(
      ".create-team-page__form"
    );


  // ========================================
  // CANCEL
  // ========================================

  const cancelButton =
    page.querySelector(
      ".create-team-page__button--cancel"
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
      // VALIDATION
      // ========================================

      const requiredFields =
        form.querySelectorAll(
          "[required]"
        );


      let isValid =
        true;


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


            isValid =
              false;

          }

        }
      );


      // ========================================
      // PASSWORD CONFIRMATION
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
        password.value !==
          passwordConfirm.value
      ) {

        passwordConfirm.setAttribute(
          "aria-invalid",
          "true"
        );


        isValid =
          false;

      }


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
      // LOGO
      // ========================================

      const logoInput =
        form.querySelector(
          "#entity-logo"
        );


      const logoFile =
        logoInput?.files?.[0] ||
        null;


      try {

        // ========================================
        // CREATE ACCOUNT
        // ========================================



        const user =
          await createAccount(
            email,
            passwordValue
          );




        // ========================================
        // TEAM DATA
        // ========================================

        const teamData = {

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
        // CREATE TEAM
        // ========================================

        const teamId =
          await createEntity(
            "teams",
            teamData
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
                  "/nexus/teams"
              }
            );



          // ========================================
          // SAVE LOGO REFERENCE
          // ========================================

          await updateEntity(
            "teams",
            teamId,
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
              "team",

            entityId:
              teamId

          },
          user.uid
        );




        // ========================================
        // PROVISION ACCOUNT
        // ========================================

        const accountProvision =
          await provisionCurrentAccount();





        // ========================================
        // WAIT FOR SESSION
        // ========================================

        const session =
          await waitForAuthenticatedSession();



        // ========================================
        // REFRESH SESSION PROFILE
        // ========================================

        const refreshedSession =
          await refreshSession();




        // ========================================
        // GO TO DASHBOARD
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
          "ARKHAM — Error creando Equipo:",
          error
        );

      }

    }
  );


  // ========================================
  // PAGE ANIMATION
  // ========================================

  requestAnimationFrame(
    () => {

      page.classList.add(
        "create-team-page--visible"
      );

    }
  );


  return page;

}