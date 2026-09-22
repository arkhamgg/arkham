// ========================================
// ARKHAM — Competition Card Component
// ========================================

export function CompetitionCard(competition) {

  const card =
    document.createElement("a");

  card.className =
    "competition-card";

  card.href =
    `/competitions/${competition.id}`;


  card.innerHTML = `

    <div class="competition-card__top">

      <span class="competition-card__index">
        ${competition.index}
      </span>

      <span class="
        competition-card__status
        competition-card__status--${competition.status}
      ">

        <span></span>

        ${competition.statusLabel}

      </span>

    </div>


    <!-- ========================================
         LOGO
         ======================================== -->

    <div class="competition-card__logo">

      ${
        competition.logo
          ? `
            <img
              src="${competition.logo}"
              alt="${competition.name}"
            >
          `
          : `
            <span>
              ${competition.logoText || "NX"}
            </span>
          `
      }

    </div>


    <!-- ========================================
         IDENTITY
         ======================================== -->

    <div class="competition-card__identity">

      <span class="competition-card__game">
        ${competition.game}
      </span>

      <h3>
        ${competition.name}
      </h3>

    </div>


    <!-- ========================================
         INFORMATION
         ======================================== -->

    <div class="competition-card__information">

      <div class="competition-card__data">

        <span>
          INICIO
        </span>

        <strong>
          ${competition.startDate}
        </strong>

      </div>


      <div class="competition-card__data">

        <span>
          FECHAS
        </span>

        <strong>
          ${competition.dates}
        </strong>

      </div>


      <div class="competition-card__data">

        <span>
          UBICACIÓN
        </span>

        <strong>
          ${competition.location}
        </strong>

      </div>

    </div>


    <!-- ========================================
         ACTION
         ======================================== -->

    <div class="competition-card__action">

      <span>
        VER COMPETENCIA
      </span>

      <i
        class="fa-solid fa-arrow-right"
        aria-hidden="true"
      ></i>

    </div>

  `;


  return card;

}