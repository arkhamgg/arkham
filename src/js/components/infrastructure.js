// ========================================
// ARKHAM — Infrastructure Component
// ========================================

export function Infrastructure() {
  const section = document.createElement("section");

  section.className = "infrastructure";
  section.id = "infrastructure";

  section.innerHTML = `
    <div class="infrastructure__container">

      <!-- ========================================
           HEADER
           ======================================== -->

      <div class="infrastructure__header">

        <div class="infrastructure__eyebrow">
          <span>05</span>
          <span>ARKHAM INFRASTRUCTURE</span>
        </div>

        <div class="infrastructure__heading">

          <h2>
            HARDWARE.
            <span>EXPERIENCIA.</span>
            COMPETENCIA.
          </h2>

          <p>
            La infraestructura y experiencia gaming
            que necesitas para crear torneos y eventos.
          </p>

        </div>

      </div>


      <!-- ========================================
           VISUAL / STATEMENT
           ======================================== -->

      <div class="infrastructure__visual">

        <div class="infrastructure__visual-grid"></div>

        <div class="infrastructure__visual-content">

          <span class="infrastructure__visual-label">
            CREA TU EVENTO
          </span>

          <strong>
            TU EVENTO.
            <br>
            NUESTRA INFRAESTRUCTURA.
          </strong>

        </div>

        <div class="infrastructure__visual-index">
          ARKHAM / 05
        </div>

      </div>


      <!-- ========================================
           CTA
           ======================================== -->

      <a
        class="infrastructure__cta"
        href="/infrastructure"
      >

        <span>
          EXPLORAR ARKHAM INFRASTRUCTURE
        </span>

        <i
          class="fa-solid fa-arrow-right"
          aria-hidden="true"
        ></i>

      </a>

    </div>
  `;


  // ========================================
  // SCROLL REVEAL
  // ========================================

  const observer = new IntersectionObserver(
    (entries) => {

      entries.forEach((entry) => {

        if (entry.isIntersecting) {

          section.classList.add(
            "infrastructure--visible"
          );

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