// ========================================
// NEXUS — Competition Landing / Landing 2
// Competitive
// ========================================

import {
  escapeHtml,
  getDateRange,
  getTimeRange,
  getLocationLabel,
  getRegistrationLabel,
  getPrizeSummary,
  getFirstPrizeDescription,
  normalizeSupportChannels,
  renderSupportContact
} from "../utils/landingUtils.js";


// ========================================
// RENDER
// ========================================

export function renderLanding2({
  page,
  tournament,
  event,
  game,
  resources = {},
  tournamentId,
  eventId,
  registrationAccess = {}
}) {
  const palette = resources.paletteColor || {};

  const primaryColor =
    palette.primary ||
    "#E30613";

  const accentColor =
    palette.accent ||
    palette.primary ||
    primaryColor;


  // ========================================
  // EVENT DATA
  // ========================================

  const eventName =
    tournament?.name ||
    "COMPETENCIA NEXUS";

  const gameName =
    game?.name ||
    "CALL OF DUTY";

  const dateRange =
    getDateRange(event?.dateTime);

  const timeRange =
    getTimeRange(event?.dateTime);

  const location =
    getLocationLabel(event?.location);

  const prizeSummary =
    getPrizeSummary(event?.prizes);

  const prizeDescription =
    getFirstPrizeDescription(event?.prizes);

  const registration =
    getRegistrationLabel(event?.registrationCost);

  const participation =
    event?.participationType ||
    "—";

  const format =
    event?.format ||
    "—";

  const matchSystem =
    event?.matchSystem ||
    "—";

  const capacity =
    event?.capacity ?? "—";

  const available =
    event?.registrationAvailability?.available;

  const canRegister =
    Boolean(registrationAccess?.canRegister);


  // ========================================
  // RESOURCES
  // ========================================

  const backgroundImage =
    resources.backgroundImage ||
    "";

  const heroImage =
    resources.heroImage ||
    backgroundImage;

  const logoImage =
    resources.logoImage ||
    "";

  const overviewImage =
    resources.overviewImage ||
    "";

  const detailsImage =
    resources.detailsImage ||
    "";

  const ctaImage =
    resources.ctaImage ||
    "";


  // ========================================
  // SUPPORT
  // ========================================

  const supportChannels =
    normalizeSupportChannels(
      event?.supportContact
    );


  // ========================================
  // THEME
  // ========================================

  page.style.setProperty(
    "--competition-primary",
    primaryColor
  );

  page.style.setProperty(
    "--competition-accent",
    accentColor
  );


  // ========================================
  // PAGE
  // ========================================

  page.innerHTML = `
    <div
      class="competition-landing competition-landing--competitive"
      style="--competition-bg-image: url('${escapeHtml(backgroundImage)}')"
    >

      <!-- ================================= -->
      <!-- HERO                              -->
      <!-- ================================= -->

      <section
        class="competition-landing__competitive-hero"
        style="--competition-hero-image: url('${escapeHtml(heroImage)}')"
      >

        <div
          class="competition-landing__competitive-hero-overlay"
        ></div>


        <div
          class="competition-landing__competitive-hero-content"
        >

          <div
            class="competition-landing__competitive-hero-top"
          >

            <span
              class="competition-landing__competitive-eyebrow"
            >
              NEXUS // COMPETITIVE EVENT
            </span>

          </div>


          <div
            class="competition-landing__competitive-game"
          >

            ${
              logoImage
                ? `
                  <img
                    src="${escapeHtml(logoImage)}"
                    alt="${escapeHtml(gameName)}"
                  >
                `
                : `
                  <span>
                    ${escapeHtml(gameName)}
                  </span>
                `
            }

          </div>


          <p
            class="competition-landing__competitive-game-name"
          >
            ${escapeHtml(gameName)}
          </p>


          <h1
            class="competition-landing__competitive-title"
          >
            ${escapeHtml(eventName)}
          </h1>


          <div
            class="competition-landing__competitive-meta"
          >

            <span>
              <i
                class="fa-regular fa-calendar"
                aria-hidden="true"
              ></i>

              ${escapeHtml(dateRange)}
            </span>


            ${
              timeRange
                ? `
                  <span>
                    <i
                      class="fa-regular fa-clock"
                      aria-hidden="true"
                    ></i>

                    ${escapeHtml(timeRange)}
                  </span>
                `
                : ""
            }


            <span>
              <i
                class="fa-solid fa-location-dot"
                aria-hidden="true"
              ></i>

              ${escapeHtml(location)}
            </span>

          </div>


          <div
            class="competition-landing__competitive-hero-stats"
          >

            <article>
              <span>MODALIDAD</span>
              <strong>
                ${escapeHtml(participation)}
              </strong>
            </article>


            <article>
              <span>FORMATO</span>
              <strong>
                ${escapeHtml(format)}
              </strong>
            </article>


            <article>
              <span>PREMIO</span>
              <strong>
                ${escapeHtml(prizeSummary)}
              </strong>
            </article>

          </div>


          <a
            class="competition-landing__competitive-hero-cta"
            href="#competitive-overview"
          >
            <span>VER COMPETENCIA</span>

            <i
              class="fa-solid fa-arrow-down"
              aria-hidden="true"
            ></i>
          </a>

        </div>


        <div
          class="competition-landing__competitive-hero-scroll"
        >
          <span>SCROLL</span>
          <span></span>
        </div>

      </section>


      <!-- ================================= -->
      <!-- COMPETITION SNAPSHOT               -->
      <!-- ================================= -->

      <section
        class="competition-landing__competitive-section competition-landing__competitive-section--snapshot"
        id="competitive-overview"
      >

        <div
          class="competition-landing__competitive-container"
        >

          <div
            class="competition-landing__competitive-heading"
          >

            <span
              class="competition-landing__competitive-index"
            >
              01
            </span>

            <div>

              <span
                class="competition-landing__competitive-eyebrow"
              >
                COMPETITION SNAPSHOT
              </span>

              <h2>
                LA COMPETENCIA<br>
                EN NÚMEROS.
              </h2>

            </div>

          </div>


          <div
            class="competition-landing__competitive-snapshot-grid"
          >

            <article
              class="competition-landing__competitive-snapshot-card"
            >

              <span>FORMATO</span>

              <strong>
                ${escapeHtml(format)}
              </strong>

            </article>


            <article
              class="competition-landing__competitive-snapshot-card"
            >

              <span>SISTEMA DE PARTIDA</span>

              <strong>
                ${escapeHtml(matchSystem)}
              </strong>

            </article>


            <article
              class="competition-landing__competitive-snapshot-card"
            >

              <span>PARTICIPACIÓN</span>

              <strong>
                ${escapeHtml(participation)}
              </strong>

            </article>


            <article
              class="competition-landing__competitive-snapshot-card"
            >

              <span>INSCRIPCIÓN</span>

              <strong>
                ${escapeHtml(registration)}
              </strong>

            </article>

          </div>

        </div>

      </section>


      <!-- ================================= -->
      <!-- OVERVIEW                          -->
      <!-- ================================= -->

      <section
        class="competition-landing__competitive-section competition-landing__competitive-section--overview"
      >

        <div
          class="competition-landing__competitive-container"
        >

          <div
            class="competition-landing__competitive-overview-grid"
          >

            <div
              class="competition-landing__competitive-overview-copy"
            >

              <span
                class="competition-landing__competitive-eyebrow"
              >
                02 // OVERVIEW
              </span>


              <h2>
                COMPITE<br>
                <em>EN SERIO.</em>
              </h2>


              <p
                class="competition-landing__competitive-lead"
              >
                ${escapeHtml(
                  tournament?.description ||
                  `Compite en ${eventName} y demuestra tu nivel en ${gameName}.`
                )}
              </p>


              <div
                class="competition-landing__competitive-overview-meta"
              >

                <span>
                  <i
                    class="fa-solid fa-users"
                    aria-hidden="true"
                  ></i>

                  ${escapeHtml(participation)}
                </span>


                <span>
                  <i
                    class="fa-solid fa-sitemap"
                    aria-hidden="true"
                  ></i>

                  ${escapeHtml(format)}
                </span>

              </div>

            </div>


            ${
              overviewImage
                ? `
                  <figure
                    class="competition-landing__competitive-image"
                  >

                    <img
                      src="${escapeHtml(overviewImage)}"
                      alt=""
                    >

                  </figure>
                `
                : ""
            }

          </div>

        </div>

      </section>


      <!-- ================================= -->
      <!-- DETAILS                           -->
      <!-- ================================= -->

      <section
        class="competition-landing__competitive-section competition-landing__competitive-section--details"
      >

        <div
          class="competition-landing__competitive-container"
        >

          <div
            class="competition-landing__competitive-heading"
          >

            <span
              class="competition-landing__competitive-index"
            >
              03
            </span>

            <div>

              <span
                class="competition-landing__competitive-eyebrow"
              >
                EVENT DETAILS
              </span>

              <h2>
                TODO<br>
                CLARO.
              </h2>

            </div>

          </div>


          <div
            class="competition-landing__competitive-details-layout"
          >

            <div
              class="competition-landing__competitive-details-grid"
            >

              <article>

                <span>
                  <i
                    class="fa-regular fa-calendar-days"
                    aria-hidden="true"
                  ></i>

                  FECHA
                </span>

                <strong>
                  ${escapeHtml(dateRange)}
                </strong>

              </article>


              <article>

                <span>
                  <i
                    class="fa-regular fa-clock"
                    aria-hidden="true"
                  ></i>

                  HORA
                </span>

                <strong>
                  ${escapeHtml(timeRange || "POR DEFINIR")}
                </strong>

              </article>


              <article>

                <span>
                  <i
                    class="fa-solid fa-location-dot"
                    aria-hidden="true"
                  ></i>

                  UBICACIÓN
                </span>

                <strong>
                  ${escapeHtml(location)}
                </strong>

              </article>


              <article>

                <span>
                  <i
                    class="fa-solid fa-users"
                    aria-hidden="true"
                  ></i>

                  CAPACIDAD
                </span>

                <strong>
                  ${escapeHtml(String(capacity))}
                  PARTICIPANTES
                </strong>

              </article>


              <article>

                <span>
                  <i
                    class="fa-solid fa-sitemap"
                    aria-hidden="true"
                  ></i>

                  FORMATO
                </span>

                <strong>
                  ${escapeHtml(format)}
                </strong>

              </article>


              <article>

                <span>
                  <i
                    class="fa-solid fa-gamepad"
                    aria-hidden="true"
                  ></i>

                  SISTEMA
                </span>

                <strong>
                  ${escapeHtml(matchSystem)}
                </strong>

              </article>

            </div>


            ${
              detailsImage
                ? `
                  <figure
                    class="competition-landing__competitive-details-image"
                  >

                    <img
                      src="${escapeHtml(detailsImage)}"
                      alt=""
                    >

                  </figure>
                `
                : ""
            }

          </div>

        </div>

      </section>


      <!-- ================================= -->
      <!-- PRIZE                              -->
      <!-- ================================= -->

      <section
        class="competition-landing__competitive-prize"
      >

        <div
          class="competition-landing__competitive-container"
        >

          <div
            class="competition-landing__competitive-prize-inner"
          >

            <div>

              <span
                class="competition-landing__competitive-eyebrow"
              >
                04 // PRIZE POOL
              </span>


              <h2>
                JUEGA<br>
                <em>POR EL PREMIO.</em>
              </h2>


              <p>
                ${
                  escapeHtml(
                    prizeDescription ||
                    "Los premios forman parte de la competencia y serán entregados según las condiciones establecidas por la organización."
                  )
                }
              </p>

            </div>


            <strong
              class="competition-landing__competitive-prize-value"
            >
              ${escapeHtml(prizeSummary)}
            </strong>

          </div>

        </div>

      </section>


      <!-- ================================= -->
      <!-- REGISTRATION / CONTACT             -->
      <!-- ================================= -->

      <section
        class="competition-landing__competitive-cta"
      >

        ${
          ctaImage
            ? `
              <div
                class="competition-landing__competitive-cta-image"
              >

                <img
                  src="${escapeHtml(ctaImage)}"
                  alt=""
                >

              </div>
            `
            : ""
        }


        <div
          class="competition-landing__competitive-cta-overlay"
        ></div>


        <div
          class="competition-landing__competitive-cta-content"
        >

          <span
            class="competition-landing__competitive-eyebrow"
          >
            05 // ${canRegister ? "REGISTRATION" : "CONTACT"}
          </span>


          <h2>
            ${
              canRegister
                ? "¿ESTÁS LISTO?"
                : "¿QUIERES COMPETIR?"
            }
          </h2>


          <p>

            ${
              canRegister
                ? (
                    available !== undefined
                      ? `${escapeHtml(String(available))} cupos disponibles.`
                      : "La inscripción está habilitada para esta competencia."
                  )
                : "Esta competencia gestiona sus inscripciones directamente con la organización."
            }

          </p>


          <div
            class="competition-landing__competitive-cta-meta"
          >

            <span>
              ${escapeHtml(participation)}
            </span>

            <span>
              ${escapeHtml(registration)}
            </span>

          </div>


          ${
            canRegister
              ? `
                <button
                  type="button"
                  class="competition-landing__competitive-registration-button"
                  data-registration-cta
                  data-tournament-id="${escapeHtml(tournamentId)}"
                  data-event-id="${escapeHtml(eventId)}"
                >

                  <span>
                    REGISTRARSE
                  </span>

                  <i
                    class="fa-solid fa-arrow-right"
                    aria-hidden="true"
                  ></i>

                </button>


                <small
                  class="competition-landing__competitive-registration-note"
                >
                  La gestión de inscripción se habilitará en una etapa posterior.
                </small>
              `
              : renderSupportContact(supportChannels)
          }

        </div>

      </section>


      <!-- ================================= -->
      <!-- FOOTER                             -->
      <!-- ================================= -->

      <footer
        class="competition-landing__competitive-footer"
      >

        <div
          class="competition-landing__competitive-container"
        >

          <div
            class="competition-landing__competitive-footer-inner"
          >

            <span>
              NEXUS ENTERTAINMENT
            </span>


            <span>
              ${escapeHtml(gameName)}
              //
              ${escapeHtml(eventName)}
            </span>

          </div>

        </div>

      </footer>

    </div>
  `;


  // ========================================
  // REGISTRATION CTA
  // ========================================

  const registrationButton =
    page.querySelector(
      "[data-registration-cta]"
    );

  if (registrationButton) {

    registrationButton.addEventListener(
      "click",
      () => {

        console.log(
          "NEXUS — Registro público pendiente de implementación.",
          {
            tournamentId,
            eventId
          }
        );

      }
    );

  }
}