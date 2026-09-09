// ========================================
// NEXUS — Entity Basic Info Component
// ========================================

export function EntityBasicInfo(options = {}) {

  const {
    showFoundationYear = true,
    descriptionPlaceholder =
      "Describe brevemente tu entidad, su propósito y propuesta."
  } = options;


  const component =
    document.createElement("div");

  component.className =
    "entity-basic-info";


  component.innerHTML = `

    <!-- ========================================
         IDENTITY
    ======================================== -->

    <section
      class="entity-basic-info__section"
      aria-labelledby="entity-identity-title"
    >

      <div class="entity-basic-info__section-header">

        <div class="entity-basic-info__number">
          01
        </div>

        <div>

          <span class="entity-basic-info__eyebrow">
            ENTITY PROFILE
          </span>

          <h2 id="entity-identity-title">
            IDENTIDAD
          </h2>

          <p>
            Define la información principal
            de tu entidad.
          </p>

        </div>

      </div>


      <div class="entity-basic-info__section-body">


        <!-- LOGO -->

        <div
          class="
            entity-basic-info__field
            entity-basic-info__field--logo
          "
        >

          <label>
            LOGO
            <span>OPCIONAL</span>
          </label>


          <div class="entity-logo-upload">

            <input
              type="file"
              id="entity-logo"
              name="logo"
              accept="
                image/png,
                image/jpeg,
                image/webp,
                image/svg+xml
              "
              hidden
            >


            <label
              for="entity-logo"
              class="entity-logo-upload__area"
            >

              <div class="entity-logo-upload__preview">

                <i
                  class="fa-solid fa-image"
                  aria-hidden="true"
                ></i>

              </div>


              <div class="entity-logo-upload__content">

                <strong>
                  SUBIR LOGO
                </strong>

                <span>
                  PNG, JPG, WEBP o SVG
                </span>

              </div>


              <i
                class="fa-solid fa-arrow-up-from-bracket"
                aria-hidden="true"
              ></i>

            </label>

          </div>

        </div>


        <!-- NAME / SHORT NAME -->

        <div class="entity-basic-info__fields-grid">


          <!-- NAME -->

          <div class="entity-basic-info__field">

            <label for="entity-name">

              NOMBRE

              <span>
                REQUERIDO
              </span>

            </label>


            <input
              type="text"
              id="entity-name"
              name="name"
              placeholder="Ej. DOMINION"
              autocomplete="organization"
              required
            >

          </div>


          <!-- SHORT NAME -->

          <div class="entity-basic-info__field">

            <label for="entity-short-name">

              NOMBRE CORTO / ABREVIATURA

              <span>
                REQUERIDO
              </span>

            </label>


            <input
              type="text"
              id="entity-short-name"
              name="shortName"
              placeholder="Ej. DML"
              maxlength="12"
              required
            >

          </div>

        </div>


        <!-- DESCRIPTION -->

        <div class="entity-basic-info__field">

          <label for="entity-description">

            DESCRIPCIÓN

            <span>
              OPCIONAL
            </span>

          </label>


          <textarea
            id="entity-description"
            name="description"
            rows="5"
            maxlength="500"
            placeholder="${descriptionPlaceholder}"
          ></textarea>


          <span class="entity-basic-info__hint">
            Máximo 500 caracteres.
          </span>

        </div>


        ${
          showFoundationYear
            ? `
              <!-- FOUNDATION YEAR -->

              <div class="entity-basic-info__field">

                <label for="entity-foundation-year">

                  AÑO DE FUNDACIÓN

                  <span>
                    REQUERIDO
                  </span>

                </label>


                <input
                  type="number"
                  id="entity-foundation-year"
                  name="foundationYear"
                  placeholder="Ej. 2026"
                  min="1900"
                  max="2100"
                  required
                >

              </div>
            `
            : ""
        }

      </div>

    </section>


    <!-- ========================================
         DIGITAL PRESENCE
    ======================================== -->

    <section
      class="entity-basic-info__section"
      aria-labelledby="entity-social-title"
    >

      <div class="entity-basic-info__section-header">

        <div class="entity-basic-info__number">
          02
        </div>

        <div>

          <span class="entity-basic-info__eyebrow">
            DIGITAL PRESENCE
          </span>

          <h2 id="entity-social-title">
            PRESENCIA
          </h2>

          <p>
            Conecta las redes sociales
            oficiales de tu entidad.
          </p>

        </div>

      </div>


      <div class="entity-basic-info__section-body">

        <div class="entity-basic-info__social-grid">


          <!-- INSTAGRAM -->

          <div class="entity-basic-info__field">

            <label for="entity-instagram">

              INSTAGRAM

              <span>
                OPCIONAL
              </span>

            </label>


            <div class="entity-basic-info__input-icon">

              <i
                class="fa-brands fa-instagram"
                aria-hidden="true"
              ></i>


              <input
                type="url"
                id="entity-instagram"
                name="instagram"
                placeholder="https://instagram.com/"
              >

            </div>

          </div>


          <!-- FACEBOOK -->

          <div class="entity-basic-info__field">

            <label for="entity-facebook">

              FACEBOOK

              <span>
                OPCIONAL
              </span>

            </label>


            <div class="entity-basic-info__input-icon">

              <i
                class="fa-brands fa-facebook-f"
                aria-hidden="true"
              ></i>


              <input
                type="url"
                id="entity-facebook"
                name="facebook"
                placeholder="https://facebook.com/"
              >

            </div>

          </div>


          <!-- TIKTOK -->

          <div class="entity-basic-info__field">

            <label for="entity-tiktok">

              TIKTOK

              <span>
                OPCIONAL
              </span>

            </label>


            <div class="entity-basic-info__input-icon">

              <i
                class="fa-brands fa-tiktok"
                aria-hidden="true"
              ></i>


              <input
                type="url"
                id="entity-tiktok"
                name="tiktok"
                placeholder="https://tiktok.com/@"
              >

            </div>

          </div>


          <!-- YOUTUBE -->

          <div class="entity-basic-info__field">

            <label for="entity-youtube">

              YOUTUBE

              <span>
                OPCIONAL
              </span>

            </label>


            <div class="entity-basic-info__input-icon">

              <i
                class="fa-brands fa-youtube"
                aria-hidden="true"
              ></i>


              <input
                type="url"
                id="entity-youtube"
                name="youtube"
                placeholder="https://youtube.com/"
              >

            </div>

          </div>


          <!-- TWITCH -->

          <div class="entity-basic-info__field">

            <label for="entity-twitch">

              TWITCH

              <span>
                OPCIONAL
              </span>

            </label>


            <div class="entity-basic-info__input-icon">

              <i
                class="fa-brands fa-twitch"
                aria-hidden="true"
              ></i>


              <input
                type="url"
                id="entity-twitch"
                name="twitch"
                placeholder="https://twitch.tv/"
              >

            </div>

          </div>


          <!-- KICK -->

          <div class="entity-basic-info__field">

            <label for="entity-kick">

              KICK

              <span>
                OPCIONAL
              </span>

            </label>


            <div class="entity-basic-info__input-icon">

              <i
                class="fa-solid fa-play"
                aria-hidden="true"
              ></i>


              <input
                type="url"
                id="entity-kick"
                name="kick"
                placeholder="https://kick.com/"
              >

            </div>

          </div>

        </div>

      </div>

    </section>

  `;


  // ========================================
  // LOGO PREVIEW
  // ========================================

  const logoInput =
    component.querySelector("#entity-logo");

  const logoPreview =
    component.querySelector(
      ".entity-logo-upload__preview"
    );


  logoInput.addEventListener(
    "change",
    () => {

      const file =
        logoInput.files[0];


      if (!file) {

        logoPreview.innerHTML = `
          <i
            class="fa-solid fa-image"
            aria-hidden="true"
          ></i>
        `;

        return;
      }


      const imageUrl =
        URL.createObjectURL(file);


      logoPreview.innerHTML = `
        <img
          src="${imageUrl}"
          alt="Vista previa del logo"
        >
      `;

    }
  );


  return component;
}