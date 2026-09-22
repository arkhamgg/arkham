// ========================================
// ARKHAM — Competition Landing / Landing 3
// Game Showcase
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
import { getPublicTournamentBracketMarkup } from "../../../components/publicTournamentBracket.js";

export function renderLanding3({
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

  const primaryColor = palette.primary || "#E30613";
  const secondaryColor = palette.secondary || "#111111";
  const accentColor = palette.accent || primaryColor;

  const eventName = tournament?.name || "COMPETENCIA ARKHAM";
  const gameName = game?.name || "CALL OF DUTY";

  const dateRange = getDateRange(event?.dateTime);
  const timeRange = getTimeRange(event?.dateTime);
  const location = getLocationLabel(event?.location);
  const prizeSummary = getPrizeSummary(event?.prizes);
  const prizeDescription = getFirstPrizeDescription(event?.prizes);
  const registration = getRegistrationLabel(event?.registrationCost);

  const participation = event?.participationType || "—";
  const format = event?.format || "—";
  const matchSystem = event?.matchSystem || "—";
  const capacity = event?.capacity ?? "—";
  const available = event?.registrationAvailability?.available;

  const canRegister = registrationAccess?.canRegister === true;

  const backgroundImage = resources.backgroundImage || "";
  const heroImage = resources.heroImage || backgroundImage;
  const logoImage = resources.logoImage || "";
  const formatImage = resources.formatImage || "";

  const supportChannels = normalizeSupportChannels(
    event?.supportContact
  );

  page.style.setProperty("--competition-primary", primaryColor);
  page.style.setProperty("--competition-secondary", secondaryColor);
  page.style.setProperty("--competition-accent", accentColor);

  page.innerHTML = `
    <div
      class="competition-landing competition-landing--showcase"
      style="
        --competition-bg-image: ${toCssImage(backgroundImage)};
        --competition-hero-image: ${toCssImage(heroImage)};
      "
    >

      <!-- HERO -->
      <section class="competition-landing__showcase-hero">
        <div class="competition-landing__showcase-hero-media"></div>
        <div class="competition-landing__showcase-hero-overlay"></div>

        <div class="competition-landing__showcase-hero-content">
          ${
            logoImage
              ? `
                <div class="competition-landing__showcase-logo">
                  <img
                    src="${escapeHtml(logoImage)}"
                    alt="${escapeHtml(gameName)}"
                  />
                </div>
              `
              : ""
          }

          <p class="competition-landing__showcase-kicker">
            ${escapeHtml(gameName)}
          </p>

          <h1 class="competition-landing__showcase-title">
            ${escapeHtml(eventName)}
          </h1>

          <p class="competition-landing__showcase-lead">
            ${escapeHtml(format)}
            <span aria-hidden="true">•</span>
            ${escapeHtml(participation)}
          </p>

          <div class="competition-landing__showcase-actions">
            ${
              canRegister
                ? `
                  <button
                    type="button"
                    class="competition-landing__showcase-button"
                    data-registration-cta
                  >
                    INSCRÍBETE
                  </button>
                `
                : `
                  ${renderSupportContact(supportChannels)}
                `
            }
          </div>

          <div class="competition-landing__showcase-scroll">
            <span>EXPLORAR COMPETENCIA</span>
            <span aria-hidden="true">↓</span>
          </div>
        </div>
      </section>

      <!-- EVENT SNAPSHOT -->
      <section class="competition-landing__showcase-section competition-landing__showcase-section--intro">
        <div class="competition-landing__showcase-container">
          <div class="competition-landing__showcase-intro">
            <div class="competition-landing__showcase-intro-heading">
              <span class="competition-landing__showcase-index">01</span>
              <p class="competition-landing__showcase-eyebrow">
                ${escapeHtml(gameName)}
              </p>
              <h2>PREPÁRATE PARA COMPETIR</h2>
            </div>

            <div class="competition-landing__showcase-intro-copy">
              <p>
                ${escapeHtml(eventName)} reúne a los competidores
                para una experiencia enfocada en ${escapeHtml(format)}.
              </p>
            </div>
          </div>

          <div class="competition-landing__showcase-stats">
            <article class="competition-landing__showcase-stat">
              <span>FECHA</span>
              <strong>${escapeHtml(dateRange)}</strong>
              <small>${escapeHtml(timeRange)}</small>
            </article>

            <article class="competition-landing__showcase-stat">
              <span>FORMATO</span>
              <strong>${escapeHtml(format)}</strong>
              <small>${escapeHtml(matchSystem)}</small>
            </article>

            <article class="competition-landing__showcase-stat">
              <span>PREMIO</span>
              <strong>${escapeHtml(prizeSummary)}</strong>
              <small>${escapeHtml(prizeDescription)}</small>
            </article>

            <article class="competition-landing__showcase-stat">
              <span>INSCRIPCIÓN</span>
              <strong>${escapeHtml(registration)}</strong>
              <small>
                ${
                  available !== undefined && available !== null
                    ? `${escapeHtml(String(available))} cupos disponibles`
                    : `${escapeHtml(String(capacity))} cupos`
                }
              </small>
            </article>
          </div>
        </div>
      </section>

      <!-- GAME SHOWCASE -->
      <section class="competition-landing__showcase-section competition-landing__showcase-section--game">
        <div class="competition-landing__showcase-game-art">
          ${
            backgroundImage
              ? `
                <img
                  src="${escapeHtml(backgroundImage)}"
                  alt=""
                  aria-hidden="true"
                />
              `
              : ""
          }
        </div>

        <div class="competition-landing__showcase-game-overlay"></div>

        <div class="competition-landing__showcase-container">
          <div class="competition-landing__showcase-game-content">
            <span class="competition-landing__showcase-index">02</span>

            <p class="competition-landing__showcase-eyebrow">
              GAME SHOWCASE
            </p>

            <h2>${escapeHtml(gameName)}</h2>

            <p>
              Una competencia diseñada alrededor del juego,
              su identidad y la experiencia competitiva.
            </p>

            ${
              logoImage
                ? `
                  <img
                    class="competition-landing__showcase-game-logo"
                    src="${escapeHtml(logoImage)}"
                    alt="${escapeHtml(gameName)}"
                  />
                `
                : ""
            }
          </div>
        </div>
      </section>

      <!-- COMPETITION DETAILS -->
      <section class="competition-landing__showcase-section competition-landing__showcase-section--details">
        <div class="competition-landing__showcase-container">
          <div class="competition-landing__showcase-heading">
            <span class="competition-landing__showcase-index">03</span>
            <p class="competition-landing__showcase-eyebrow">
              COMPETENCIA
            </p>
            <h2>TODO LO QUE NECESITAS SABER</h2>
          </div>

          <div class="competition-landing__showcase-details">
            <article>
              <span>FECHA</span>
              <strong>${escapeHtml(dateRange)}</strong>
            </article>

            <article>
              <span>HORA</span>
              <strong>${escapeHtml(timeRange)}</strong>
            </article>

            <article>
              <span>UBICACIÓN</span>
              <strong>${escapeHtml(location)}</strong>
            </article>

            <article>
              <span>PARTICIPACIÓN</span>
              <strong>${escapeHtml(participation)}</strong>
            </article>

            <article>
              <span>FORMATO</span>
              <strong>${escapeHtml(format)}</strong>
            </article>

            <article>
              <span>SISTEMA DE PARTIDA</span>
              <strong>${escapeHtml(matchSystem)}</strong>
            </article>
          </div>
        </div>
      </section>

      <!-- PRO BRACKET -->
      <div data-public-bracket-mount>
        ${getPublicTournamentBracketMarkup(event)}
      </div>


      <!-- FORMAT -->
      ${
        formatImage
          ? `
            <section class="competition-landing__showcase-section competition-landing__showcase-section--format">
              <div class="competition-landing__showcase-format-image">
                <img
                  src="${escapeHtml(formatImage)}"
                  alt="${escapeHtml(format)}"
                />
              </div>

              <div class="competition-landing__showcase-format-overlay"></div>

              <div class="competition-landing__showcase-container">
                <div class="competition-landing__showcase-format-content">
                  <span class="competition-landing__showcase-index">04</span>
                  <p class="competition-landing__showcase-eyebrow">
                    FORMATO
                  </p>
                  <h2>${escapeHtml(format)}</h2>
                  <p>${escapeHtml(matchSystem)}</p>
                </div>
              </div>
            </section>
          `
          : ""
      }

      <!-- PRIZE -->
      <section class="competition-landing__showcase-section competition-landing__showcase-section--prize">
        <div class="competition-landing__showcase-container">
          <div class="competition-landing__showcase-prize">
            <span class="competition-landing__showcase-index">
              ${formatImage ? "05" : "04"}
            </span>

            <p class="competition-landing__showcase-eyebrow">
              PREMIO
            </p>

            <strong>${escapeHtml(prizeSummary)}</strong>

            ${
              prizeDescription
                ? `<p>${escapeHtml(prizeDescription)}</p>`
                : ""
            }
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="competition-landing__showcase-cta">
        <div class="competition-landing__showcase-cta-overlay"></div>

        <div class="competition-landing__showcase-container">
          <div class="competition-landing__showcase-cta-content">
            <p class="competition-landing__showcase-eyebrow">
              ${escapeHtml(gameName)}
            </p>

            <h2>¿LISTO PARA ENTRAR?</h2>

            <p>
              ${escapeHtml(eventName)}
            </p>

            ${
              canRegister
                ? `
                  <button
                    type="button"
                    class="competition-landing__showcase-button competition-landing__showcase-button--large"
                    data-registration-cta
                  >
                    INSCRÍBETE AHORA
                  </button>
                `
                : `
                  <div class="competition-landing__showcase-support">
                    ${renderSupportContact(supportChannels)}
                  </div>
                `
            }
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="competition-landing__showcase-footer">
        <div class="competition-landing__showcase-container">
          <div class="competition-landing__showcase-footer-inner">
            <span>ARKHAM</span>
            <span>${escapeHtml(gameName)}</span>
            <span>${escapeHtml(eventName)}</span>
          </div>
        </div>
      </footer>

    </div>
  `;

  page.querySelectorAll("[data-registration-cta]").forEach((button) => {
    button.addEventListener("click", () => {
    });
  });
}

function toCssImage(value) {
  if (!value) {
    return "none";
  }

  const safeValue = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "");

  return `url("${safeValue}")`;
}
