// ========================================
// NEXUS — Competitions Component
// ========================================

export function Competitions() {
  const section = document.createElement("section");

  section.className = "competitions";
  section.id = "competitions";

  section.innerHTML = `
    <div class="competitions__container">

      <div class="competitions__header">

        <div class="competitions__eyebrow">
          <span>02</span>
          <span>ARKHAM COMPETITIONS</span>
        </div>

        <div class="competitions__heading">

          <h2>
            DONDE COMIENZA
            <span>LA COMPETENCIA.</span>
          </h2>

          <p>
            Descubre las competencias que forman parte
            del ecosistema competitivo de ARKHAM.
          </p>

        </div>

      </div>


      <div class="competitions__list">

        <article class="competition-card">

          <div class="competition-card__top">
            <span>01</span>
            <span>ACTIVA</span>
          </div>

          <div class="competition-card__content">

            <span class="competition-card__game">
              CALL OF DUTY
            </span>

            <h3>DOMINION</h3>

            <p>
              Competencia competitiva de equipos
              dentro del ecosistema ARKHAM.
            </p>

          </div>

          <div class="competition-card__footer">

            <span>
              12 EQUIPOS
            </span>

            <span>
              48 PLAYERS
            </span>

            <span class="competition-card__arrow">
              <i
                class="fa-solid fa-arrow-up-right-from-square"
                aria-hidden="true"
              ></i>
            </span>

          </div>

        </article>


        <article class="competition-card competition-card--empty">

          <div class="competition-card__top">
            <span>02</span>
            <span>PRÓXIMAMENTE</span>
          </div>

          <div class="competition-card__content">

            <span class="competition-card__game">
              ARKHAM EVENT
            </span>

            <h3>COMING SOON</h3>

            <p>
              Nuevas competencias serán anunciadas
              próximamente.
            </p>

          </div>

          <div class="competition-card__footer">

            <span>
              ARKHAM
            </span>

            <span>
              2026
            </span>

            <span class="competition-card__arrow">
              <i
                class="fa-solid fa-plus"
                aria-hidden="true"
              ></i>
            </span>

          </div>

        </article>

      </div>


      <div class="competitions__bottom">

        <span>
          EXPLORAR TODAS LAS COMPETENCIAS
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

          section.classList.add("competitions--visible");

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