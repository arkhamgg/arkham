// ========================================
// NEXUS — Player Basic Info Component
// ========================================

export function PlayerBasicInfo() {

  const component =
    document.createElement("section");

  component.className =
    "player-basic-info";


  // ========================================
  // COMPONENT CONTENT
  // ========================================

  component.innerHTML = `

    <!-- ========================================
         PERSONAL INFORMATION
    ======================================== -->

    <section class="player-basic-info__section">

      <header class="player-basic-info__section-header">

        <div class="player-basic-info__section-number">
          01
        </div>

        <div class="player-basic-info__section-heading">

          <h2>
            INFORMACIÓN PERSONAL
          </h2>

          <p>
            Define la identidad con la que
            competirás dentro de ARKHAM.
          </p>

        </div>

      </header>


      <div class="player-basic-info__content">


        <!-- ========================================
             PROFILE PHOTO
        ======================================== -->

        <div class="player-basic-info__photo">

          <div class="player-basic-info__field">

            <label
              for="player-photo"
              class="player-basic-info__label"
            >
              FOTO DE PERFIL
              <span>OPCIONAL</span>
            </label>


            <div class="player-photo-upload">

              <label
                for="player-photo"
                class="player-photo-upload__preview"
              >

                <i
                  class="fa-solid fa-user"
                  aria-hidden="true"
                ></i>

              </label>


              <input
                type="file"
                id="player-photo"
                name="photo"
                accept="image/png,image/jpeg,image/webp"
                hidden
              />


              <div class="player-photo-upload__info">

                <strong>
                  SUBE TU FOTO
                </strong>

                <span>
                  PNG, JPG o WEBP
                </span>

                <span>
                  Puedes agregarla ahora
                  o posteriormente desde Mi ARKHAM.
                </span>

              </div>

            </div>

          </div>

        </div>


        <!-- ========================================
             NAME
        ======================================== -->

        <div class="player-basic-info__grid">


          <div class="player-basic-info__field">

            <label
              for="player-name"
              class="player-basic-info__label"
            >
              NOMBRE
            </label>

            <input
              type="text"
              id="player-name"
              name="name"
              class="player-basic-info__input"
              placeholder="Tu nombre"
              autocomplete="given-name"
              required
            />

          </div>


          <!-- ========================================
               LAST NAME
          ======================================== -->

          <div class="player-basic-info__field">

            <label
              for="player-last-name"
              class="player-basic-info__label"
            >
              APELLIDO
            </label>

            <input
              type="text"
              id="player-last-name"
              name="lastName"
              class="player-basic-info__input"
              placeholder="Tu apellido"
              autocomplete="family-name"
              required
            />

          </div>


        </div>


        <!-- ========================================
             GAMERTAG
        ======================================== -->

        <div class="player-basic-info__field">

          <label
            for="player-gamertag"
            class="player-basic-info__label"
          >
            GAMERTAG / NOMBRE COMPETITIVO
          </label>

          <input
            type="text"
            id="player-gamertag"
            name="gamertag"
            class="player-basic-info__input"
            placeholder="Ej. ARKHAMPlayer"
            autocomplete="nickname"
            required
          />

        </div>


        <!-- ========================================
             DATE OF BIRTH
        ======================================== -->

        <div class="player-basic-info__field">

          <label
            for="player-birth-date"
            class="player-basic-info__label"
          >
            FECHA DE NACIMIENTO
          </label>

          <input
            type="date"
            id="player-birth-date"
            name="birthDate"
            class="player-basic-info__input"
            autocomplete="bday"
            required
          />

        </div>


      </div>

    </section>


    <!-- ========================================
         SOCIAL MEDIA
    ======================================== -->

    <section class="player-basic-info__section">

      <header class="player-basic-info__section-header">

        <div class="player-basic-info__section-number">
          02
        </div>

        <div class="player-basic-info__section-heading">

          <h2>
            REDES SOCIALES
          </h2>

          <p>
            Conecta tus perfiles para construir
            tu presencia dentro de ARKHAM.
          </p>

        </div>

      </header>


      <div class="player-basic-info__socials">


        <!-- INSTAGRAM -->

        <div class="player-basic-info__field">

          <label
            for="player-instagram"
            class="player-basic-info__label"
          >
            INSTAGRAM
          </label>

          <div class="player-basic-info__social-input">

            <span>
              @
            </span>

            <input
              type="text"
              id="player-instagram"
              name="instagram"
              class="player-basic-info__input"
              placeholder="usuario"
              autocomplete="off"
            />

          </div>

        </div>


        <!-- FACEBOOK -->

        <div class="player-basic-info__field">

          <label
            for="player-facebook"
            class="player-basic-info__label"
          >
            FACEBOOK
          </label>

          <input
            type="text"
            id="player-facebook"
            name="facebook"
            class="player-basic-info__input"
            placeholder="Perfil o usuario"
            autocomplete="off"
          />

        </div>


        <!-- TIKTOK -->

        <div class="player-basic-info__field">

          <label
            for="player-tiktok"
            class="player-basic-info__label"
          >
            TIKTOK
          </label>

          <div class="player-basic-info__social-input">

            <span>
              @
            </span>

            <input
              type="text"
              id="player-tiktok"
              name="tiktok"
              class="player-basic-info__input"
              placeholder="usuario"
              autocomplete="off"
            />

          </div>

        </div>


        <!-- YOUTUBE -->

        <div class="player-basic-info__field">

          <label
            for="player-youtube"
            class="player-basic-info__label"
          >
            YOUTUBE
          </label>

          <input
            type="text"
            id="player-youtube"
            name="youtube"
            class="player-basic-info__input"
            placeholder="Canal o usuario"
            autocomplete="off"
          />

        </div>


        <!-- TWITCH -->

        <div class="player-basic-info__field">

          <label
            for="player-twitch"
            class="player-basic-info__label"
          >
            TWITCH
          </label>

          <input
            type="text"
            id="player-twitch"
            name="twitch"
            class="player-basic-info__input"
            placeholder="usuario"
            autocomplete="off"
          />

        </div>


        <!-- KICK -->

        <div class="player-basic-info__field">

          <label
            for="player-kick"
            class="player-basic-info__label"
          >
            KICK
          </label>

          <input
            type="text"
            id="player-kick"
            name="kick"
            class="player-basic-info__input"
            placeholder="usuario"
            autocomplete="off"
          />

        </div>


      </div>

    </section>


    <!-- ========================================
         ARKHAMS ROLES
    ======================================== -->

    <section class="player-basic-info__section">

      <header class="player-basic-info__section-header">

        <div class="player-basic-info__section-number">
          03
        </div>

        <div class="player-basic-info__section-heading">

          <h2>
            TU IDENTIDAD EN NEXUS
          </h2>

          <p>
            Selecciona todas las opciones que representen
            tu actividad dentro del gaming.
          </p>

        </div>

      </header>


      <div class="player-basic-info__roles">

        <label class="player-basic-info__role">
          <input type="checkbox" name="roles" value="streamer">
          <span class="player-basic-info__role-check" aria-hidden="true">
            <i class="fa-solid fa-check"></i>
          </span>
          <span class="player-basic-info__role-copy">
            <strong>STREAMER</strong>
            <small>Transmito contenido en vivo.</small>
          </span>
        </label>

        <label class="player-basic-info__role">
          <input type="checkbox" name="roles" value="content_creator">
          <span class="player-basic-info__role-check" aria-hidden="true">
            <i class="fa-solid fa-check"></i>
          </span>
          <span class="player-basic-info__role-copy">
            <strong>CREADOR DE CONTENIDO</strong>
            <small>Publico contenido relacionado con gaming.</small>
          </span>
        </label>

        <label class="player-basic-info__role">
          <input type="checkbox" name="roles" value="influencer">
          <span class="player-basic-info__role-check" aria-hidden="true">
            <i class="fa-solid fa-check"></i>
          </span>
          <span class="player-basic-info__role-copy">
            <strong>INFLUENCER</strong>
            <small>Construyo una comunidad alrededor de mi presencia.</small>
          </span>
        </label>

        <label class="player-basic-info__role">
          <input type="checkbox" name="roles" value="competitive_player">
          <span class="player-basic-info__role-check" aria-hidden="true">
            <i class="fa-solid fa-check"></i>
          </span>
          <span class="player-basic-info__role-copy">
            <strong>JUGADOR COMPETITIVO</strong>
            <small>Compito en torneos y competencias.</small>
          </span>
        </label>

      </div>

    </section>

  `;


  // ========================================
  // PROFILE PHOTO PREVIEW
  // ========================================

  const photoInput =
    component.querySelector(
      "#player-photo"
    );


  const photoPreview =
    component.querySelector(
      ".player-photo-upload__preview"
    );


  photoInput.addEventListener(
    "change",
    () => {

      const file =
        photoInput.files[0];


      if (!file) {

        photoPreview.innerHTML = `
          <i
            class="fa-solid fa-user"
            aria-hidden="true"
          ></i>
        `;

        return;

      }


      const imageUrl =
        URL.createObjectURL(file);


      photoPreview.innerHTML = `
        <img
          src="${imageUrl}"
          alt="Vista previa de la foto de perfil"
        >
      `;

    }
  );


  return component;

}