// ========================================
// NEXUS — Players Component
// ========================================

export function Players() {
  const section = document.createElement("section");

  section.className = "players";
  section.id = "players";

  section.innerHTML = `
    <div class="players__container">

      <!-- ========================================
           HEADER
           ======================================== -->

      <div class="players__header">

        <div class="players__eyebrow">
          <span>04</span>
          <span>ARKHAM PLAYERS</span>
        </div>

        <div class="players__heading">

          <h2>
            LOS JUGADORES
            <span>QUE COMPITEN.</span>
          </h2>

          <p>
            Talento que forma parte del ecosistema
            competitivo de ARKHAM.
          </p>

        </div>

      </div>


      <!-- ========================================
           PLAYERS LIST
           ======================================== -->

      <div class="players__list">


        <!-- PLAYER 01 -->

        <article class="player-row">

          <div class="player-row__index">
            01
          </div>


          <div class="player-row__identity">

            <div class="player-row__avatar">
              <span>DR</span>
            </div>

            <div class="player-row__name">

              <span>
                PREDATORS
              </span>

              <h3>
                DARKRAY
              </h3>

            </div>

          </div>


          <div class="player-row__game">

            <span>
              GAME
            </span>

            <strong>
              CALL OF DUTY
            </strong>

          </div>


          <div class="player-row__role">

            <span>
              ROLE
            </span>

            <strong>
              SMG
            </strong>

          </div>


          <div class="player-row__status">

            <span class="player-row__country">
              GUATEMALA
            </span>

            <span class="player-row__verified">
              <span></span>
              VERIFIED
            </span>

          </div>


          <div class="player-row__arrow">

            <i
              class="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            ></i>

          </div>

        </article>


        <!-- PLAYER 02 -->

        <article class="player-row">

          <div class="player-row__index">
            02
          </div>


          <div class="player-row__identity">

            <div class="player-row__avatar">
              <span>NV</span>
            </div>

            <div class="player-row__name">

              <span>
                TEAM X
              </span>

              <h3>
                NOVA
              </h3>

            </div>

          </div>


          <div class="player-row__game">

            <span>
              GAME
            </span>

            <strong>
              VALORANT
            </strong>

          </div>


          <div class="player-row__role">

            <span>
              ROLE
            </span>

            <strong>
              DUELIST
            </strong>

          </div>


          <div class="player-row__status">

            <span class="player-row__country">
              GUATEMALA
            </span>

            <span class="player-row__verified">
              <span></span>
              VERIFIED
            </span>

          </div>


          <div class="player-row__arrow">

            <i
              class="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            ></i>

          </div>

        </article>


        <!-- PLAYER 03 -->

        <article class="player-row">

          <div class="player-row__index">
            03
          </div>


          <div class="player-row__identity">

            <div class="player-row__avatar">
              <span>KI</span>
            </div>

            <div class="player-row__name">

              <span>
                TEAM NX
              </span>

              <h3>
                KAI
              </h3>

            </div>

          </div>


          <div class="player-row__game">

            <span>
              GAME
            </span>

            <strong>
              POKÉMON UNITE
            </strong>

          </div>


          <div class="player-row__role">

            <span>
              ROLE
            </span>

            <strong>
              ATTACKER
            </strong>

          </div>


          <div class="player-row__status">

            <span class="player-row__country">
              GUATEMALA
            </span>

            <span class="player-row__verified">
              <span></span>
              VERIFIED
            </span>

          </div>


          <div class="player-row__arrow">

            <i
              class="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            ></i>

          </div>

        </article>


        <!-- PLAYER 04 -->

        <article class="player-row">

          <div class="player-row__index">
            04
          </div>


          <div class="player-row__identity">

            <div class="player-row__avatar">
              <span>AX</span>
            </div>

            <div class="player-row__name">

              <span>
                ARKHAM
              </span>

              <h3>
                APEX
              </h3>

            </div>

          </div>


          <div class="player-row__game">

            <span>
              GAME
            </span>

            <strong>
              EA SPORTS FC
            </strong>

          </div>


          <div class="player-row__role">

            <span>
              POSITION
            </span>

            <strong>
              ST
            </strong>

          </div>


          <div class="player-row__status">

            <span class="player-row__country">
              GUATEMALA
            </span>

            <span class="player-row__verified">
              <span></span>
              VERIFIED
            </span>

          </div>


          <div class="player-row__arrow">

            <i
              class="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            ></i>

          </div>

        </article>

      </div>


      <!-- ========================================
           BOTTOM
           ======================================== -->

      <a
        href="/players"
        class="players__bottom"
      >

        <span>
          VER TODOS LOS PLAYERS
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

          section.classList.add("players--visible");

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
console.log("error to deploy")