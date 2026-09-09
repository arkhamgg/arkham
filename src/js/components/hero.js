// ========================================
// NEXUS — Hero Component
// ========================================

import { HeroEffects } from "./heroEffects.js";
import avatar from "../../assets/nexus-avatar.png";

export function Hero() {
  const hero = document.createElement("section");

  hero.className = "hero";
  hero.id = "home";

  hero.innerHTML = `
    <div class="hero__background" aria-hidden="true">
      <div class="hero__grid"></div>
      <div class="hero__glow"></div>
    </div>

    <div class="hero__container">

      <div class="hero__content">

        <span class="hero__label">
          NEXUS
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
          <span>Explorar NEXUS</span>

          <i
            class="fa-solid fa-arrow-right"
            aria-hidden="true"
          ></i>
        </a>

      </div>


      <!-- ========================================
           HERO ARTWORK
           ======================================== -->

      <div class="hero__artwork" aria-hidden="true">

        <div class="hero__avatar">

          <img
            src="${avatar}"
            alt=""
            class="hero__avatar-image"
          />

        </div>

        <div class="hero__artwork-info">

          <span class="hero__status">
            <span class="hero__status-dot"></span>
            SISTEMA ACTIVO
          </span>

          <span class="hero__artwork-index">
            01 / 01
          </span>

        </div>

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


  // ========================================
  // HERO EFFECTS
  // ========================================

  const effects = HeroEffects();

  hero.appendChild(effects);


  return hero;
}