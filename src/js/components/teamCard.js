// ========================================
// ARKHAM — Team Card Component
// ========================================

export function TeamCard(
  team,
  options = {}
) {

  const {
    featured = false,
    rank = null
  } = options;


  const card =
    document.createElement("a");

  card.className =
    featured
      ? "team-card team-card--featured"
      : "team-card";


  card.href =
    `/teams/${team.id}`;


  card.innerHTML = `

    <div class="team-card__top">

      ${
        featured
          ? `
            <span class="team-card__rank">
              #${String(rank).padStart(2, "0")}
            </span>
          `
          : `
            <span class="team-card__rank">
              ${team.index || ""}
            </span>
          `
      }

      ${
        featured
          ? `
            <span class="team-card__featured">
              SALÓN DE LA FAMA
            </span>
          `
          : ""
      }

    </div>


    <!-- ========================================
         LOGO
         ======================================== -->

    <div class="team-card__logo">

      ${
        team.logo?.url || team.logo
          ? `
            <img
              src="${team.logo?.url || team.logo}"
              alt="${team.name}"
            >
          `
          : `
            <span>
              ${
                team.shortName ||
                team.name?.charAt(0) ||
                "NX"
              }
            </span>
          `
      }

    </div>


    <!-- ========================================
         IDENTITY
         ======================================== -->

    <div class="team-card__identity">

      <span class="team-card__short-name">
        ${team.shortName || "—"}
      </span>

      <h3>
        ${team.name || "SIN NOMBRE"}
      </h3>

    </div>


    <!-- ========================================
         ACTION
         ======================================== -->

    <div class="team-card__action">

      <span>
        VER EQUIPO
      </span>

      <i
        class="fa-solid fa-arrow-right"
        aria-hidden="true"
      ></i>

    </div>

  `;


  return card;

}