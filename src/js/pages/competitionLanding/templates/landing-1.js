// ========================================
// NEXUS — Competition Landing / Landing 1
// Cinematic
// ========================================

import {
  escapeHtml,
  getDateRange,
  getTimeRange,
  getLocationLabel,
  getRegistrationLabel,
  getPrizeSummary,
  getFirstPrizeDescription,
  renderSupportContact,
  normalizeSupportChannels
} from "../utils/landingUtils.js";

export function renderLanding1({
  page,
  tournament,
  event,
  game,
  resources,
  tournamentId,
  eventId,
  registrationAccess
}) {

  const palette = resources.paletteColor || {};
  const primaryColor = palette.primary || "#E30613";
  const accentColor = palette.accent || primaryColor;

  const eventName = tournament.name || "COMPETENCIA NEXUS";
  const gameName = game.name || "CALL OF DUTY";
  const dateRange = getDateRange(event.dateTime);
  const timeRange = getTimeRange(event.dateTime);
  const location = getLocationLabel(event.location);
  const prizeSummary = getPrizeSummary(event.prizes);
  const prizeDescription = getFirstPrizeDescription(event.prizes);
  const registration = getRegistrationLabel(event.registrationCost);
  const participation = event.participationType || "—";
  const format = event.format || "—";
  const matchSystem = event.matchSystem || "—";
  const capacity = event.capacity ?? "—";
  const available = event.registrationAvailability?.available;

  const backgroundImage = resources.backgroundImage || "";
  const heroImage = resources.heroImage || backgroundImage;
  const logoImage = resources.logoImage || "";
  const formatImage = resources.formatImage || "";
  const teamsImage = resources.teamsImage || "";
  const prizeImage = resources.prizeImage || "";
  const registrationImage = resources.registrationImage || "";
  const supportChannels = normalizeSupportChannels(event.supportContact);
  const canRegister = registrationAccess.canRegister;

  page.style.setProperty("--competition-primary", primaryColor);
  page.style.setProperty("--competition-accent", accentColor);

  page.innerHTML = `
    <div
      class="competition-landing"
      style="--competition-bg-image: url('${escapeHtml(backgroundImage)}')"
    >

      <!-- HERO -->
      <section
        class="competition-landing__hero"
        style="--competition-hero-image: url('${escapeHtml(heroImage)}')"
      >

        <div class="competition-landing__hero-overlay"></div>

        <div class="competition-landing__hero-content">

          <span class="competition-landing__eyebrow">
            NEXUS // OFFICIAL ESPORTS EVENT
          </span>

          <div class="competition-landing__game-logo">
            ${logoImage
              ? `<img src="${escapeHtml(logoImage)}" alt="${escapeHtml(gameName)}">`
              : `<span>${escapeHtml(gameName)}</span>`
            }
          </div>

          <p class="competition-landing__game-name">
            ${escapeHtml(gameName)}
          </p>

          <h1 class="competition-landing__title">
            ${escapeHtml(eventName)}
          </h1>

          <div class="competition-landing__hero-meta">
            <span>
              <i class="fa-regular fa-calendar" aria-hidden="true"></i>
              ${escapeHtml(dateRange)}
            </span>

            ${timeRange
              ? `
                <span>
                  <i class="fa-regular fa-clock" aria-hidden="true"></i>
                  ${escapeHtml(timeRange)}
                </span>
              `
              : ""
            }

            <span>
              <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
              ${escapeHtml(location)}
            </span>
          </div>

          <a
            class="competition-landing__hero-cta"
            href="#competition-overview"
          >
            <span>VER COMPETENCIA</span>
            <i class="fa-solid fa-arrow-down" aria-hidden="true"></i>
          </a>

        </div>

        <div class="competition-landing__hero-scroll">
          <span>SCROLL</span>
          <span></span>
        </div>

      </section>


      <!-- OVERVIEW -->
      <section
        class="competition-landing__section competition-landing__section--overview"
        id="competition-overview"
      >
        <div class="competition-landing__container">

          <div class="competition-landing__section-heading">
            <span class="competition-landing__section-index">01</span>
            <div>
              <span class="competition-landing__section-eyebrow">OVERVIEW</span>
              <h2>LA COMPETENCIA.</h2>
            </div>
          </div>

          <div class="competition-landing__overview-grid">

            <div class="competition-landing__overview-copy">
              <p class="competition-landing__lead">
                ${escapeHtml(tournament.description || `Compite en ${eventName} y forma parte del ecosistema competitivo de NEXUS.`)}
              </p>

              <div class="competition-landing__overview-stats">

                <article class="competition-landing__stat">
                  <span>MODALIDAD</span>
                  <strong>${escapeHtml(participation)}</strong>
                </article>

                <article class="competition-landing__stat">
                  <span>FORMATO</span>
                  <strong>${escapeHtml(format)}</strong>
                </article>

                <article class="competition-landing__stat">
                  <span>PREMIO</span>
                  <strong>${escapeHtml(prizeSummary)}</strong>
                </article>

              </div>
            </div>

            ${formatImage
              ? `
                <figure class="competition-landing__visual competition-landing__visual--format">
                  <img src="${escapeHtml(formatImage)}" alt="">
                  <figcaption>FORMATO DE COMPETENCIA</figcaption>
                </figure>
              `
              : ""
            }

          </div>
        </div>
      </section>


      <!-- EVENT INFORMATION -->
      <section class="competition-landing__section competition-landing__section--details">
        <div class="competition-landing__container">

          <div class="competition-landing__section-heading">
            <span class="competition-landing__section-index">02</span>
            <div>
              <span class="competition-landing__section-eyebrow">EVENT DETAILS</span>
              <h2>TODO LO QUE NECESITAS.</h2>
            </div>
          </div>

          <div class="competition-landing__details-grid">

            <article class="competition-landing__detail-card">
              <span class="competition-landing__detail-icon">
                <i class="fa-solid fa-sitemap" aria-hidden="true"></i>
              </span>
              <span>FORMATO</span>
              <strong>${escapeHtml(format)}</strong>
            </article>

            <article class="competition-landing__detail-card">
              <span class="competition-landing__detail-icon">
                <i class="fa-solid fa-gamepad" aria-hidden="true"></i>
              </span>
              <span>SISTEMA DE PARTIDA</span>
              <strong>${escapeHtml(matchSystem)}</strong>
            </article>

            <article class="competition-landing__detail-card">
              <span class="competition-landing__detail-icon">
                <i class="fa-solid fa-users" aria-hidden="true"></i>
              </span>
              <span>CAPACIDAD</span>
              <strong>${escapeHtml(capacity)} PARTICIPANTES</strong>
            </article>

            <article class="competition-landing__detail-card">
              <span class="competition-landing__detail-icon">
                <i class="fa-solid fa-ticket" aria-hidden="true"></i>
              </span>
              <span>INSCRIPCIÓN</span>
              <strong>${escapeHtml(registration)}</strong>
            </article>

            <article class="competition-landing__detail-card competition-landing__detail-card--wide">
              <span class="competition-landing__detail-icon">
                <i class="fa-regular fa-calendar-days" aria-hidden="true"></i>
              </span>
              <span>FECHA Y HORA</span>
              <strong>${escapeHtml(dateRange)}${timeRange ? ` · ${escapeHtml(timeRange)}` : ""}</strong>
            </article>

            <article class="competition-landing__detail-card competition-landing__detail-card--wide">
              <span class="competition-landing__detail-icon">
                <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
              </span>
              <span>UBICACIÓN</span>
              <strong>${escapeHtml(location)}</strong>
            </article>

          </div>
        </div>
      </section>


      <!-- TEAMS / VISUAL BREAK -->
      ${teamsImage
        ? `
          <section class="competition-landing__visual-break">
            <img src="${escapeHtml(teamsImage)}" alt="">
            <div class="competition-landing__visual-break-overlay"></div>
            <div class="competition-landing__visual-break-content">
              <span>COMPETITION READY</span>
              <strong>ENTRA. COMPITE. DOMINA.</strong>
            </div>
          </section>
        `
        : ""
      }


      <!-- PRIZES -->
      <section class="competition-landing__section competition-landing__section--prize">
        <div class="competition-landing__container">

          <div class="competition-landing__prize-grid">

            <div class="competition-landing__prize-copy">
              <span class="competition-landing__section-eyebrow">03 // PRIZES</span>
              <h2>JUEGA<br><em>POR TODO.</em></h2>
              <strong class="competition-landing__prize-value">
                ${escapeHtml(prizeSummary)}
              </strong>
              ${prizeDescription
                ? `<p>${escapeHtml(prizeDescription)}</p>`
                : `<p>Consulta las condiciones de premiación de esta competencia.</p>`
              }
            </div>

            ${prizeImage
              ? `
                <figure class="competition-landing__visual competition-landing__visual--prize">
                  <img src="${escapeHtml(prizeImage)}" alt="Premios de la competencia">
                </figure>
              `
              : ""
            }

          </div>
        </div>
      </section>


      <!-- REGISTRATION / CONTACT -->
      <section class="competition-landing__registration">
        <div class="competition-landing__registration-bg">
          ${registrationImage
            ? `<img src="${escapeHtml(registrationImage)}" alt="">`
            : ""
          }
        </div>

        <div class="competition-landing__registration-overlay"></div>

        <div class="competition-landing__registration-content">
          <span class="competition-landing__section-eyebrow">04 // ${canRegister ? "COMPETE" : "CONTACT"}</span>
          <h2>${canRegister ? "¿ESTÁS<br><em>LISTO?</em>" : "¿QUIERES<br><em>COMPETIR?</em>"}</h2>

          <p>
            ${canRegister
              ? (available !== undefined
                ? `${escapeHtml(String(available))} cupos disponibles.`
                : "La inscripción está habilitada para esta competencia.")
              : "Esta competencia gestiona sus inscripciones directamente con la organización."
            }
          </p>

          <div class="competition-landing__registration-meta">
            <span>${escapeHtml(participation)}</span>
            <span>${escapeHtml(registration)}</span>
          </div>

          ${canRegister
            ? `
              <button
                type="button"
                class="competition-landing__registration-button"
                data-registration-cta
                data-tournament-id="${escapeHtml(tournamentId)}"
                data-event-id="${escapeHtml(eventId)}"
              >
                <span>REGISTRO</span>
                <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>

              <small class="competition-landing__registration-note">
                La gestión de inscripción se habilitará en una etapa posterior.
              </small>
            `
            : renderSupportContact(supportChannels)
          }
        </div>
      </section>


      <!-- FOOTER -->
      <footer class="competition-landing__footer">
        <div class="competition-landing__container competition-landing__footer-inner">
          <span>NEXUS ENTERTAINMENT</span>
          <span>${escapeHtml(gameName)} // ${escapeHtml(eventName)}</span>
        </div>
      </footer>

    </div>
  `;

  const cta = page.querySelector("[data-registration-cta]");

  if (cta) {
    cta.addEventListener("click", () => {
      console.log("NEXUS — Registro público pendiente de implementación.", {
        tournamentId,
        eventId
      });
    });
  }
}
