// ========================================
// ARKHAM — Create Player Page
// ========================================

import { PlayerBasicInfo } from "../components/playerBasicInfo.js";
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
// CREATE PLAYER
// ========================================

export function CreatePlayer() {

  const page =
    document.createElement("main");

  page.className =
    "create-player-page";


  // ========================================
  // PAGE CONTENT
  // ========================================

  page.innerHTML = `

    <div class="create-player-page__container">


      <!-- ========================================
           HEADER
      ======================================== -->

      <header class="create-player-page__header">

        <div class="create-player-page__eyebrow">

          <span>
            01
          </span>

          <span>
            CREATE PLAYER
          </span>

        </div>


        <div class="create-player-page__heading">

          <h1>
            CREA TU
            <span>PERFIL.</span>
          </h1>

          <p>
            Define tu identidad y presencia
            dentro de ARKHAM.
          </p>

        </div>

      </header>


      <!-- ========================================
           FORM
      ======================================== -->

      <form
        class="create-player-page__form"
        novalidate
      >


        <!-- ========================================
             PLAYER BASIC INFO
        ======================================== -->

        <section
          class="create-player-page__basic-info"
        ></section>


        <!-- ========================================
             ACCOUNT
        ======================================== -->

        <section
          class="create-player-page__account"
        ></section>


        <!-- ========================================
             ACTIONS
        ======================================== -->

        <footer
          class="create-player-page__actions"
        >

          <button
            type="button"
            class="
              create-player-page__button
              create-player-page__button--cancel
            "
          >
            CANCELAR
          </button>


          <button
            type="submit"
            class="
              create-player-page__button
              create-player-page__button--primary
            "
          >

            <span>
              CREAR PERFIL
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
  // PLAYER BASIC INFO
  // ========================================

  const playerBasicInfo =
    PlayerBasicInfo();


  const basicInfoContainer =
    page.querySelector(
      ".create-player-page__basic-info"
    );


  basicInfoContainer.appendChild(
    playerBasicInfo
  );


  // ========================================
  // ACCOUNT CREDENTIALS
  // ========================================

  const accountCredentials =
    AccountCredentials();


  const accountContainer =
    page.querySelector(
      ".create-player-page__account"
    );


  accountContainer.appendChild(
    accountCredentials
  );


  // ========================================
  // FORM
  // ========================================

  const form =
    page.querySelector(
      ".create-player-page__form"
    );


  // ========================================
  // CANCEL
  // ========================================

  const cancelButton =
    page.querySelector(
      ".create-player-page__button--cancel"
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
      // PROFILE PHOTO
      // ========================================

      const photoInput =
        form.querySelector(
          "#player-photo"
        );


      const photoFile =
        photoInput?.files?.[0] ||
        null;


      try {

        // ========================================
        // CREATE FIREBASE ACCOUNT
        // ========================================



        const user =
          await createAccount(
            email,
            passwordValue
          );



        // ========================================
        // PLAYER DATA
        // ========================================

        const playerData = {

          name:
            formData.get("name"),

          lastName:
            formData.get("lastName"),

          gamertag:
            formData.get("gamertag"),

          birthDate:
            formData.get("birthDate"),

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

          roles:
            formData.getAll("roles"),

          ownerId:
            user.uid

        };


        // ========================================
        // CREATE PLAYER
        // ========================================

        const playerId =
          await createEntity(
            "players",
            playerData
          );




        // ========================================
        // UPLOAD PROFILE PHOTO
        // ========================================

        if (photoFile) {



          const photoResult =
            await uploadImage(
              photoFile,
              {
                folder:
                  "/nexus/players"
              }
            );




          // ========================================
          // SAVE PHOTO REFERENCE
          // ========================================

          await updateEntity(
            "players",
            playerId,
            {

              photo: {

                url:
                  photoResult.url,

                fileId:
                  photoResult.fileId,

                filePath:
                  photoResult.filePath

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
              "player",

            entityId:
              playerId

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
          "ARKHAM — Error creando Jugador:",
          error
        );

      }

    }
  );


  // ========================================
  // PAGE REVEAL
  // ========================================

  requestAnimationFrame(
    () => {

      page.classList.add(
        "create-player-page--visible"
      );

    }
  );


  return page;

}