// ========================================
// ARKHAM — Teams Component
// ========================================

export function Teams() {
  const section = document.createElement("section");

  section.className = "teams";
  section.id = "teams";

  section.innerHTML = `
    <div class="teams__container">

      <!-- ========================================
           HEADER
           ======================================== -->

      <div class="teams__header">

        <div class="teams__eyebrow">
          <span>03</span>
          <span>ARKHAM TEAMS</span>
        </div>

        <div class="teams__heading">

          <h2>
            LOS EQUIPOS
            <span>DEL ECOSISTEMA.</span>
          </h2>

          <p>
            Equipos que compiten, representan y
            construyen la escena competitiva dentro
            de ARKHAM.
          </p>

        </div>

      </div>


      <!-- ========================================
           FEATURED TEAMS
           ======================================== -->

      <div class="teams__list">


        <!-- TEAM 01 -->

        <article class="team-card">

          <div class="team-card__top">

            <span class="team-card__index">
              01
            </span>

            <span class="team-card__status">
              AFILIADO
            </span>

          </div>


          <div class="team-card__identity">

            <div class="team-card__logo">
              <span>BN</span>
            </div>

            <div class="team-card__name">

              <span>
                GUATEMALA
              </span>

              <h3>
                PREDATORS
              </h3>

            </div>

          </div>


          <div class="team-card__meta">

            <div>
              <span>DIVISIÓN</span>
              <strong>CALL OF DUTY</strong>
            </div>

            <div>
              <span>ESTADO</span>
              <strong>ACTIVO</strong>
            </div>

          </div>


          <div class="team-card__footer">

            <span>
              ARKHAM VERIFIED
            </span>

            <span class="team-card__arrow">
              <i
                class="fa-solid fa-arrow-up-right-from-square"
                aria-hidden="true"
              ></i>
            </span>

          </div>

        </article>


        <!-- TEAM 02 -->

        <article class="team-card">

          <div class="team-card__top">

            <span class="team-card__index">
              02
            </span>

            <span class="team-card__status">
              AFILIADO
            </span>

          </div>


          <div class="team-card__identity">

            <div class="team-card__logo">
              <span>XX</span>
            </div>

            <div class="team-card__name">

              <span>
                GUATEMALA
              </span>

              <h3>
                TEAM X
              </h3>

            </div>

          </div>


          <div class="team-card__meta">

            <div>
              <span>DIVISIÓN</span>
              <strong>EA SPORTS FC</strong>
            </div>

            <div>
              <span>ESTADO</span>
              <strong>ACTIVO</strong>
            </div>

          </div>


          <div class="team-card__footer">

            <span>
              ARKHAM VERIFIED
            </span>

            <span class="team-card__arrow">
              <i
                class="fa-solid fa-arrow-up-right-from-square"
                aria-hidden="true"
              ></i>
            </span>

          </div>

        </article>


        <!-- TEAM 03 -->

        <article class="team-card">

          <div class="team-card__top">

            <span class="team-card__index">
              03
            </span>

            <span class="team-card__status">
              AFILIADO
            </span>

          </div>


          <div class="team-card__identity">

            <div class="team-card__logo">
              <span>NX</span>
            </div>

            <div class="team-card__name">

              <span>
                GUATEMALA
              </span>

              <h3>
                TEAM NX
              </h3>

            </div>

          </div>


          <div class="team-card__meta">

            <div>
              <span>DIVISIÓN</span>
              <strong>FREE FIRE</strong>
            </div>

            <div>
              <span>ESTADO</span>
              <strong>ACTIVO</strong>
            </div>

          </div>


          <div class="team-card__footer">

            <span>
              ARKHAM VERIFIED
            </span>

            <span class="team-card__arrow">
              <i
                class="fa-solid fa-arrow-up-right-from-square"
                aria-hidden="true"
              ></i>
            </span>

          </div>

        </article>

      </div>


      <!-- ========================================
           BOTTOM
           ======================================== -->

      <div class="teams__bottom">

        <span>
          VER TODOS LOS EQUIPOS
        </span>

        <i
          class="fa-solid fa-arrow-right"
          aria-hidden="true"
        ></i>

      </div>

    </div>
  `;


  // ========================================
  // SCROLL REVEAL
  // ========================================

  const observer = new IntersectionObserver(
    (entries) => {

      entries.forEach((entry) => {

        if (entry.isIntersecting) {

          section.classList.add("teams--visible");

          observer.unobserve(section);

        }

      });

    },
    {
      threshold: 0.15
    }
  );

  observer.observe(section);


  return section;
}