// ========================================
// ARKHAM — Hero Component
// ========================================

import heroBackground from "../../assets/arkham-hero-bg.png";

export function Hero() {
  const hero = document.createElement("section");

  hero.className = "hero";
  hero.id = "home";

  hero.innerHTML = `
    <div
      class="hero__background"
      aria-hidden="true"
    ></div>

    <div class="hero__container">

      <div class="hero__content">

        <span class="hero__label">
          ARKHAM
        </span>

        <h1 class="hero__title">
          <span>EL FUTURO DEL</span>
          <span>GAMING</span>
          <span class="hero__title-accent">
            COMPETITIVO.
          </span>
        </h1>

        <div class="hero__description">
          <span class="hero__description-line"></span>

          <p>
            La infraestructura que conecta jugadores,
            equipos y competencias en Guatemala.
          </p>
        </div>

        <a href="#competitions" class="hero__cta">
          <span>Explorar ARKHAM</span>

          <i
            class="fa-solid fa-arrow-right"
            aria-hidden="true"
          ></i>
        </a>

      </div>

    </div>


    <!-- ========================================
         HERO FOOTER
         ======================================== -->

    <div class="hero__footer">

      <div class="hero__stats">

        <div class="hero__stat">
          <strong>—</strong>
          <span>EQUIPOS</span>
        </div>

        <div class="hero__stat">
          <strong>—</strong>
          <span>JUGADORES</span>
        </div>

        <div class="hero__stat">
          <strong>—</strong>
          <span>COMPETENCIAS</span>
        </div>

      </div>

      <div class="hero__scroll">

        <span>DESPLAZAR</span>

        <i
          class="fa-solid fa-arrow-down"
          aria-hidden="true"
        ></i>

      </div>

    </div>
  `;

  return hero;
}