// ========================================
// NEXUS — Footer Component
// ========================================

export function Footer() {
  const footer = document.createElement("footer");

  footer.className = "footer";
  footer.id = "footer";

  footer.innerHTML = `
    <div class="footer__container">

      <!-- ========================================
           MAIN
           ======================================== -->

      <div class="footer__main">

        <div class="footer__brand">

          <span class="footer__eyebrow">
            NEXUS ENTERTAINMENT
          </span>

          <h2>
            EL ECOSISTEMA
            <span>COMPETITIVO</span>
            DEL FUTURO.
          </h2>

        </div>


        <!-- ========================================
             NAVIGATION
             ======================================== -->

        <div class="footer__navigation">

          <div class="footer__column">

            <span class="footer__column-title">
              NAVEGAR
            </span>

            <a href="/competitions">
              Competencias
            </a>

            <a href="/teams">
              Equipos
            </a>

            <a href="/players">
              Players
            </a>

            <a href="/calendar">
              Calendario
            </a>

          </div>


          <div class="footer__column">

            <span class="footer__column-title">
              NEXUS
            </span>

            <a href="/about">
              Sobre NEXUS
            </a>

            <a href="/affiliation">
              Afiliaciones
            </a>

            <a href="/infrastructure">
              Infrastructure
            </a>

            <a href="/contact">
              Contacto
            </a>

          </div>


          <div class="footer__column">

            <span class="footer__column-title">
              COMUNIDAD
            </span>

            <a
              href="#"
              aria-label="Instagram"
            >
              Instagram
            </a>

            <a
              href="#"
              aria-label="TikTok"
            >
              TikTok
            </a>

            <a
              href="#"
              aria-label="Discord"
            >
              Discord
            </a>

          </div>

        </div>

      </div>


      <!-- ========================================
           NEXUS WORDMARK
           ======================================== -->

      <div class="footer__wordmark">

        <span>
          NEXUS
        </span>

      </div>


      <!-- ========================================
           BOTTOM
           ======================================== -->

      <div class="footer__bottom">

        <span>
          © 2026 NEXUS
        </span>

        <span>
          GUATEMALA
        </span>

        <span>
          NEXUS ENTERTAINMENT
        </span>

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

          footer.classList.add("footer--visible");

          observer.unobserve(footer);

        }

      });

    },
    {
      threshold: 0.1
    }
  );

  observer.observe(footer);


  return footer;
}