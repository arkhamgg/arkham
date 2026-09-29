// ========================================
// ARKHAM — Competition Landing / Landing 2
// Cinematic
// ========================================

import {
  escapeHtml,
  getDateRange,
  getTimeRange,
  getLocationLabel,
  getRegistrationLabel
} from "../utils/landingUtils.js";

import { getPublicTournamentBracketMarkup } from "../../../components/publicTournamentBracket.js";

function toRoman(number) {

  let value = Number(number);

  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }

  const pairs = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];

  let result = "";

  for (const [unit, symbol] of pairs) {

    while (value >= unit) {
      result += symbol;
      value -= unit;
    }

  }

  return result;

}


export function renderLanding2({
  page,
  tournament,
  event,
  game,
  resources,
  tournamentId,
  eventId,
  registrationAccess
}) {
  // ========================================
  // COMPETITION COLOR
  // ========================================

  const palette = resources.paletteColor || {};
  const primaryColor = palette.primary || "#7B3FF2";

  // ========================================
  // BASIC DATA
  // ========================================

  const eventName = tournament.name || "COMPETENCIA ARKHAM";
  const tournamentLogo = tournament.logo?.url || "";

  const gameName = game.name || "CALL OF DUTY";

  const dateRange = getDateRange(event.dateTime);
  const startDate = dateRange.split("—")[0].trim();

  const timeRange = getTimeRange(event.dateTime);
  const location = getLocationLabel(event.location);

  const registration = getRegistrationLabel(event.registrationCost);

  const participation = event.participationType || "—";
  const format = event.format || "—";
  const matchSystem = event.matchSystem || "—";
  const capacity = event.capacity ?? "—";
  const available = event.registrationAvailability?.available;

  const rules = Array.isArray(event.rules)
    ? [...event.rules]
        .filter((rule) => rule && rule.text)
        .sort(
          (a, b) =>
            Number(a.order || 0) -
            Number(b.order || 0)
        )
    : [];

  const rulePages = [];

  if (rules.length) {

    rulePages.push(
      rules.slice(0, 3)
    );

    for (
      let index = 3;
      index < rules.length;
      index += 7
    ) {

      rulePages.push(
        rules.slice(
          index,
          index + 7
        )
      );

    }

  }


  // ========================================
  // ========================================
  // REWARDS / PODIUM
  // ========================================
  //
  // Firestore structure:
  //
  // tournaments/{tournamentId}
  //   └── events/{eventId}
  //       └── prizes [array]
  //            └── [0] {
  //                 rewards: [ ... ]
  //               }
  //
  // `prizes` is an array. The rewards array is
  // inside the first map.
  // ========================================

  const rawRewards =
    Array.isArray(event?.prizes)
      ? Array.isArray(event.prizes[0]?.rewards)
        ? event.prizes[0].rewards
        : []
      : [];

  const prizes = rawRewards
    .filter(
      (reward) =>
        reward &&
        typeof reward === "object"
    )
    .sort(
      (a, b) =>
        Number(a.position || 0) -
        Number(b.position || 0)
    )
    .map((reward, index) => ({
      ...reward,
      position:
        Number(reward.position) > 0
          ? Number(reward.position)
          : index + 1
    }));


  // ========================================
  // ORGANIZER CONTACT
  // ========================================

  const supportContact = event?.supportContact || {};
  const supportChannels = Array.isArray(supportContact.channels)
    ? supportContact.channels
        .filter(
          (channel) =>
            channel &&
            typeof channel === "object" &&
            String(channel.value || "").trim()
        )
        .map((channel) => ({
          ...channel,
          type: String(channel.type || "").trim().toLowerCase(),
          value: String(channel.value || "").trim()
        }))
    : [];

  const contactChannelConfig = {
    whatsapp: {
      label: "WHATSAPP",
      icon: "fa-brands fa-whatsapp",
      buildHref: (value) => {
        const phone = value.replace(/[^0-9]/g, "");
        return phone ? `https://wa.me/${phone}` : "";
      }
    },
    discord: {
      label: "DISCORD",
      icon: "fa-brands fa-discord",
      buildHref: (value) =>
        /^https?:\/\//i.test(value)
          ? value
          : `https://discord.gg/${value.replace(/^\/+/, "")}`
    },
    instagram: {
      label: "INSTAGRAM",
      icon: "fa-brands fa-instagram",
      buildHref: (value) =>
        /^https?:\/\//i.test(value)
          ? value
          : `https://instagram.com/${value.replace(/^@/, "")}`
    },
    facebook: {
      label: "FACEBOOK",
      icon: "fa-brands fa-facebook-f",
      buildHref: (value) =>
        /^https?:\/\//i.test(value)
          ? value
          : `https://facebook.com/${value.replace(/^\/+/, "")}`
    },
    kick: {
      label: "KICK",
      icon: "fa-brands fa-kickstarter-k",
      buildHref: (value) =>
        /^https?:\/\//i.test(value)
          ? value
          : `https://kick.com/${value.replace(/^@/, "")}`
    },
    twitter: {
      label: "X",
      icon: "fa-brands fa-x-twitter",
      buildHref: (value) =>
        /^https?:\/\//i.test(value)
          ? value
          : `https://x.com/${value.replace(/^@/, "")}`
    },
    x: {
      label: "X",
      icon: "fa-brands fa-x-twitter",
      buildHref: (value) =>
        /^https?:\/\//i.test(value)
          ? value
          : `https://x.com/${value.replace(/^@/, "")}`
    },
    email: {
      label: "CORREO",
      icon: "fa-regular fa-envelope",
      buildHref: (value) => `mailto:${value}`
    },
    mail: {
      label: "CORREO",
      icon: "fa-regular fa-envelope",
      buildHref: (value) => `mailto:${value}`
    },
    website: {
      label: "SITIO WEB",
      icon: "fa-solid fa-globe",
      buildHref: (value) =>
        /^https?:\/\//i.test(value)
          ? value
          : `https://${value}`
    }
  };

  const renderContactChannel = (channel) => {
    const config =
      contactChannelConfig[channel.type] || {
        label: channel.type
          ? channel.type.toUpperCase()
          : "CONTACTO",
        icon: "fa-solid fa-arrow-up-right-from-square",
        buildHref: (value) =>
          /^https?:\/\//i.test(value)
            ? value
            : `https://${value}`
      };

    const href = config.buildHref(channel.value);

    if (!href) {
      return "";
    }

    return `
      <a
        class="competition-landing__contact-card"
        href="${escapeHtml(href)}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar al organizador por ${escapeHtml(config.label)}"
      >
        <span class="competition-landing__contact-icon" aria-hidden="true">
          <i class="${escapeHtml(config.icon)}"></i>
        </span>

        <span class="competition-landing__contact-card-content">
          <span class="competition-landing__contact-card-label">
            ${escapeHtml(config.label)}
          </span>

          <span class="competition-landing__contact-card-value">
            ${escapeHtml(channel.value)}
          </span>
        </span>

        <span class="competition-landing__contact-arrow" aria-hidden="true">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </span>
      </a>
    `;
  };

  const contactChannelsMarkup = supportChannels
    .map(renderContactChannel)
    .filter(Boolean)
    .join("");


  const renderRuleCard = (
    rule,
    index
  ) => {

    const number =
      Number(
        rule.order ||
        index + 1
      );

    const roman =
      toRoman(number);

    const text =
      String(
        rule.text ||
        ""
      ).trim();

    return `
      <article
        class="competition-landing__rule-card"
        tabindex="0"
        role="button"
        aria-label="Abrir regla ${escapeHtml(roman)}"
        data-rule-card
        data-rule-index="${index}"
      >

        <div
          class="
            competition-landing__rule-card-inner
          "
        >

          <div
            class="
              competition-landing__rule-face
              competition-landing__rule-face--front
            "
          >

            <span>
              ${escapeHtml(roman)}
            </span>

          </div>


          <div
            class="
              competition-landing__rule-face
              competition-landing__rule-face--back
            "
          >

            <span
              class="
                competition-landing__rule-number
              "
            >
              ${escapeHtml(roman)}
            </span>

            <p
              class="
                competition-landing__rule-text
              "
            >
              ${escapeHtml(text)}
            </p>

          </div>

        </div>

      </article>
    `;

  };


  const renderRulePage = (
    pageRules,
    pageIndex
  ) => `

    <article
      class="
        competition-landing__rules-page
        ${
          pageIndex === 0
            ? "competition-landing__rules-page--intro"
            : ""
        }
      "
      data-rules-page
      data-page-index="${pageIndex}"
    >

      ${
        pageIndex === 0
          ? `
            <div
              class="
                competition-landing__rules-heading
              "
            >

              <span
                class="
                  competition-landing__section-eyebrow
                "
              >
                03 // REGLAS
              </span>

              <h2>
                REGLAS
              </h2>

            </div>
          `
          : ""
      }


      <div
        class="
          competition-landing__rules-cards
        "
      >

        ${pageRules
          .map(
            (rule, localIndex) =>
              renderRuleCard(
                rule,
                rules.indexOf(rule)
              )
          )
          .join("")}

      </div>

    </article>

  `;


  const renderPrize = (
    prize,
    fallbackPosition
  ) => {

    const position =
      Number(
        prize.position ||
        fallbackPosition
      );

    const rewardName =
      String(
        prize.name ||
        prize.title ||
        ""
      ).trim();

    const numericAmount =
      prize.amount === null ||
      prize.amount === undefined ||
      prize.amount === ""
        ? null
        : Number(prize.amount);

    const amount =
      Number.isFinite(numericAmount)
        ? numericAmount
        : null;

    const currency =
      String(
        prize.currency ||
        ""
      ).trim();

    const formattedAmount =
      amount !== null
        ? `${currency === "GTQ" ? "Q" : currency}${amount}`
        : "";

    const title =
      rewardName ||
      formattedAmount ||
      "PREMIO";

    const description =
      String(
        prize.description ||
        ""
      ).trim();

    return `
      <article
        class="
          competition-landing__podium-place
          competition-landing__podium-place--${position}
        "
        data-podium-place="${position}"
      >

        <span
          class="
            competition-landing__podium-position
          "
        >
          ${escapeHtml(
            position === 1
              ? "1st"
              : position === 2
                ? "2nd"
                : position === 3
                  ? "3rd"
                  : `${position}th`
          )}
        </span>

        <strong
          class="
            competition-landing__podium-title
          "
        >
          ${escapeHtml(title)}
        </strong>

        ${
          description
            ? `
              <p
                class="
                  competition-landing__podium-description
                "
              >
                ${escapeHtml(
                  description
                )}
              </p>
            `
            : ""
        }

      </article>
    `;
  };


  // ========================================
  // LANDING RESOURCES
  // ========================================

  const backgroundImage = resources.backgroundImage || "";

  const heroImage = resources.heroImage || backgroundImage;
  const heroImageMobile = resources.heroImageMobile || heroImage;

  const logoImage = resources.logoImage || "";

  const competitionIcons = resources.icons || {};

  const modalityIcon =
    competitionIcons.modalidad || "";

  const formatIcon =
    competitionIcons.formato || "";

  const systemIcon =
    competitionIcons.sistema || "";

  const teamsImage = resources.teamsImage || "";
  // ========================================
  // COMPETITION COLOR → CSS VARIABLE
  // ========================================

  page.style.setProperty(
    "--competition-primary",
    primaryColor
  );

  // ========================================
  // RENDER
  // ========================================

  page.innerHTML = `
    <div
      class="competition-landing competition-landing--landing-2"
      style="--competition-bg-image: url('${escapeHtml(backgroundImage)}')"
    >

      <!-- ==================================
           HERO
      =================================== -->

      <section
        class="competition-landing__hero competition-landing__hero--landing-2"
        style="
          --competition-hero-image: url('${escapeHtml(heroImage)}');
          --competition-hero-image-mobile: url('${escapeHtml(heroImageMobile)}')
        "
      >

        <div class="competition-landing__hero-overlay"></div>

        <div class="competition-landing__hero-content">

          <div class="competition-landing__hero-brand">

            <!-- GAME LOGO -->

            <div class="competition-landing__game-logo">

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

            <!-- TOURNAMENT LOGO / NAME -->

            <div class="competition-landing__tournament-logo">

              ${
                tournamentLogo
                  ? `
                    <img
                      src="${escapeHtml(tournamentLogo)}"
                      alt="${escapeHtml(eventName)}"
                    >
                  `
                  : `
                    <h1 class="competition-landing__title">
                      ${escapeHtml(eventName)}
                    </h1>
                  `
              }

            </div>

            <!-- START DATE -->

            <div class="competition-landing__hero-date">

              <i
                class="fa-regular fa-calendar"
                aria-hidden="true"
              ></i>

              <span>
                ${escapeHtml(startDate)}
              </span>

            </div>

          </div>

        </div>

      </section>


      <!-- ==================================
           COMPETITION SNAPSHOT
      =================================== -->

      <section
        class="
          competition-landing__section
          competition-landing__section--snapshot
        "
        id="competition-overview"
      >

        <div class="competition-landing__container">

          <div class="competition-landing__snapshot-grid">

            <!-- DATE -->

            <article
              class="competition-landing__snapshot-card"
            >

              <span
                class="competition-landing__snapshot-icon"
              >
                <i
                  class="fa-solid fa-calendar-days"
                  aria-hidden="true"
                ></i>
              </span>

              <span
                class="competition-landing__snapshot-label"
              >
                FECHA
              </span>

              <strong>
                ${escapeHtml(startDate)}
              </strong>

            </article>


            <!-- REGISTRATION -->

            <article
              class="competition-landing__snapshot-card"
            >

              <span
                class="competition-landing__snapshot-icon"
              >
                <i
                  class="fa-solid fa-ticket"
                  aria-hidden="true"
                ></i>
              </span>

              <span
                class="competition-landing__snapshot-label"
              >
                INSCRIPCIÓN
              </span>

              <strong>
                ${escapeHtml(registration)}
              </strong>

            </article>


            <!-- LOCATION -->

            <article
              class="competition-landing__snapshot-card"
            >

              <span
                class="competition-landing__snapshot-icon"
              >
                <i
                  class="fa-solid fa-location-dot"
                  aria-hidden="true"
                ></i>
              </span>

              <span
                class="competition-landing__snapshot-label"
              >
                UBICACIÓN
              </span>

              <strong>
                ${escapeHtml(location)}
              </strong>

            </article>

          </div>

        </div>

      </section>


      <!-- ==================================
           COMPETITION
      =================================== -->

      <section
        class="
          competition-landing__section
          competition-landing__section--competition
        "
      >

        <div class="competition-landing__container">

          <div class="competition-landing__competition-heading">

            <h2>
              COMPETENCIA
            </h2>

          </div>


          <div class="competition-landing__competition-grid">

            <!-- MODALIDAD -->

            <article
              class="competition-landing__competition-card"
            >

              <span
                class="competition-landing__competition-tag"
              >
                MODALIDAD
              </span>

              <div
                class="competition-landing__competition-icon"
              >

                ${
                  modalityIcon
                    ? `
                      <img
                        src="${escapeHtml(modalityIcon)}"
                        alt=""
                      >
                    `
                    : ""
                }

              </div>

              <strong>
                ${escapeHtml(participation)}
              </strong>

            </article>


            <!-- FORMATO -->

            <article
              class="competition-landing__competition-card"
            >

              <span
                class="competition-landing__competition-tag"
              >
                FORMATO
              </span>

              <div
                class="competition-landing__competition-icon"
              >

                ${
                  formatIcon
                    ? `
                      <img
                        src="${escapeHtml(formatIcon)}"
                        alt=""
                      >
                    `
                    : ""
                }

              </div>

              <strong>
                ${escapeHtml(format)}
              </strong>

            </article>


            <!-- SISTEMA -->

            <article
              class="competition-landing__competition-card"
            >

              <span
                class="competition-landing__competition-tag"
              >
                SISTEMA
              </span>

              <div
                class="competition-landing__competition-icon"
              >

                ${
                  systemIcon
                    ? `
                      <img
                        src="${escapeHtml(systemIcon)}"
                        alt=""
                      >
                    `
                    : ""
                }

              </div>

              <strong>
                ${escapeHtml(matchSystem)}
              </strong>

            </article>

          </div>

        </div>

      </section>


      <!-- ==================================
           BRACKET
           DO NOT MODIFY
      =================================== -->

      <div data-public-bracket-mount>
        ${getPublicTournamentBracketMarkup(event)}
      </div>


      <!-- ==================================
           TEAMS / VISUAL BREAK
      =================================== -->

      ${
        teamsImage
          ? `
            <section
              class="competition-landing__visual-break"
            >

              <img
                src="${escapeHtml(teamsImage)}"
                alt=""
              >

              <div
                class="
                  competition-landing__visual-break-overlay
                "
              ></div>

              <div
                class="
                  competition-landing__visual-break-content
                "
              >

                <span>
                  COMPETITION READY
                </span>

                <strong>
                  ENTRA. COMPITE. DOMINA.
                </strong>

              </div>

            </section>
          `
          : ""
      }


      <!-- ==================================
           RULES
      =================================== -->

      ${
        rulePages.length
          ? `
            <section
              class="
                competition-landing__rules
              "
              id="competition-rules"
            >

              <div
                class="
                  competition-landing__rules-shell
                "
              >

                <div
                  class="
                    competition-landing__rules-viewport
                  "
                  data-rules-viewport
                >

                  <div
                    class="
                      competition-landing__rules-track
                    "
                    data-rules-track
                  >

                    ${rulePages
                      .map(renderRulePage)
                      .join("")}

                  </div>

                </div>


                ${
                  rulePages.length > 1
                    ? `
                      <div
                        class="
                          competition-landing__rules-controls
                        "
                      >

                        <button
                          type="button"
                          class="
                            competition-landing__rules-arrow
                          "
                          data-rules-prev
                          aria-label="Reglas anteriores"
                        >

                          <i
                            class="fa-solid fa-arrow-left"
                            aria-hidden="true"
                          ></i>

                        </button>


                        <span
                          class="
                            competition-landing__rules-counter
                          "
                        >

                          <strong
                            data-rules-current
                          >
                            01
                          </strong>

                          <span>/</span>

                          <span
                            data-rules-total
                          >
                            ${String(
                              rulePages.length
                            ).padStart(2, "0")}
                          </span>

                        </span>


                        <button
                          type="button"
                          class="
                            competition-landing__rules-arrow
                          "
                          data-rules-next
                          aria-label="Siguiente grupo de reglas"
                        >

                          <i
                            class="fa-solid fa-arrow-right"
                            aria-hidden="true"
                          ></i>

                        </button>

                      </div>
                    `
                    : ""
                }

              </div>


              <div
                class="
                  competition-landing__rule-modal
                "
                data-rule-modal
                aria-hidden="true"
              >

                <div
                  class="
                    competition-landing__rule-modal-backdrop
                  "
                  data-rule-modal-close
                ></div>


                <div
                  class="
                    competition-landing__rule-modal-dialog
                  "
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="competition-rule-modal-title"
                >

                  <button
                    type="button"
                    class="
                      competition-landing__rule-modal-close
                    "
                    data-rule-modal-close
                    aria-label="Cerrar regla"
                  >

                    <i
                      class="fa-solid fa-xmark"
                      aria-hidden="true"
                    ></i>

                  </button>


                  <span
                    class="
                      competition-landing__section-eyebrow
                    "
                    id="competition-rule-modal-title"
                  >
                    REGLA
                  </span>


                  <strong
                    class="
                      competition-landing__rule-modal-number
                    "
                    data-rule-modal-number
                  ></strong>


                  <p
                    data-rule-modal-text
                  ></p>

                </div>

              </div>

            </section>
          `
          : ""
      }


      <!-- ==================================
           PRIZES / PODIUM
      =================================== -->

      ${
        prizes.length > 0
          ? `
            <section
              class="
                competition-landing__podium
              "
              id="competition-prizes"
            >

              <div
                class="
                  competition-landing__podium-container
                "
              >

                <div
                  class="
                    competition-landing__podium-heading
                  "
                >

                  <span
                    class="
                      competition-landing__section-eyebrow
                    "
                  >
                    04 // PREMIOS
                  </span>

                  <h2>
                    PREMIOS
                  </h2>

                </div>


                <div
                  class="
                    competition-landing__podium-stage
                    competition-landing__podium-stage--count-${Math.min(
                      prizes.length,
                      3
                    )}
                  "
                >

                  <div
                    class="
                      competition-landing__podium-places
                    "
                  >

                    ${prizes
                      .map(
                        (prize, index) =>
                          renderPrize(
                            prize,
                            index + 1
                          )
                      )
                      .join("")}

                  </div>

                </div>

              </div>

            </section>
          `
          : ""
      }


      <!-- ==================================
           CONTACT / ORGANIZER
      =================================== -->

      ${
        contactChannelsMarkup
          ? `
            <section
              class="competition-landing__contact"
              id="competition-contact"
            >

              <div class="competition-landing__container">

                <div class="competition-landing__contact-heading">
                  <span class="competition-landing__section-eyebrow">
                    05 // CONTACTO
                  </span>

                  <h2>
                    ¿TIENES ALGUNA DUDA?
                    <br>
                    HABLA CON EL ORGANIZADOR.
                  </h2>

                  <p>
                    ¿Tienes preguntas sobre la competencia, inscripción,
                    horarios o participación? Contacta directamente con el
                    organizador a través de sus canales disponibles.
                  </p>
                </div>

                <div class="competition-landing__contact-grid">
                  ${contactChannelsMarkup}
                </div>

              </div>

            </section>
          `
          : ""
      }


      <!-- ==================================
           FOOTER
      =================================== -->

      <footer
        class="competition-landing__footer"
      >

        <div
          class="
            competition-landing__container
            competition-landing__footer-inner
          "
        >

          <span>
            ARKHAM ENTERTAINMENT
          </span>

          <span>
            ${escapeHtml(gameName)}
            //
            ${escapeHtml(eventName)}
          </span>

        </div>

      </footer>

    </div>
  `;


  // ========================================
  // RULES SLIDER / FLIP / MODAL
  // ========================================

  const rulesTrack =
    page.querySelector(
      "[data-rules-track]"
    );

  const rulesPrev =
    page.querySelector(
      "[data-rules-prev]"
    );

  const rulesNext =
    page.querySelector(
      "[data-rules-next]"
    );

  const rulesCurrent =
    page.querySelector(
      "[data-rules-current]"
    );

  const ruleCards =
    page.querySelectorAll(
      "[data-rule-card]"
    );

  const ruleModal =
    page.querySelector(
      "[data-rule-modal]"
    );

  const ruleModalNumber =
    page.querySelector(
      "[data-rule-modal-number]"
    );

  const ruleModalText =
    page.querySelector(
      "[data-rule-modal-text]"
    );

  const rulesViewport =
    page.querySelector(
      "[data-rules-viewport]"
    );


  let currentRulePage = 0;

  let rulesPointerStartX =
    null;

  let lastRuleModalTrigger =
    null;


  const setRulesPage = (
    pageIndex
  ) => {

    if (
      !rulesTrack ||
      !rulePages.length
    ) {
      return;
    }

    currentRulePage =
      Math.max(
        0,
        Math.min(
          pageIndex,
          rulePages.length - 1
        )
      );

    rulesTrack.style.transform =
      `translate3d(
        -${currentRulePage * 100}%,
        0,
        0
      )`;


    if (rulesCurrent) {

      rulesCurrent.textContent =
        String(
          currentRulePage + 1
        ).padStart(
          2,
          "0"
        );

    }


    if (rulesPrev) {

      rulesPrev.disabled =
        currentRulePage === 0;

    }


    if (rulesNext) {

      rulesNext.disabled =
        currentRulePage ===
        rulePages.length - 1;

    }

  };


  const openRuleModal = (
    ruleIndex,
    trigger
  ) => {

    const rule =
      rules[ruleIndex];

    if (
      !rule ||
      !ruleModal
    ) {
      return;
    }


    lastRuleModalTrigger =
      trigger ||
      null;


    if (ruleModalNumber) {

      ruleModalNumber.textContent =
        toRoman(
          Number(
            rule.order ||
            ruleIndex + 1
          )
        );

    }


    if (ruleModalText) {

      ruleModalText.textContent =
        String(
          rule.text ||
          ""
        ).trim();

    }


    ruleModal.classList.add(
      "is-open"
    );

    ruleModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "competition-landing--modal-open"
    );

  };


  const closeRuleModal = () => {

    if (!ruleModal) {
      return;
    }


    ruleModal.classList.remove(
      "is-open"
    );

    ruleModal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "competition-landing--modal-open"
    );


    if (
      lastRuleModalTrigger
    ) {

      lastRuleModalTrigger.focus();

    }


    lastRuleModalTrigger =
      null;

  };


  if (
    rulesTrack &&
    rulePages.length
  ) {

    setRulesPage(0);

  }


  if (rulesPrev) {

    rulesPrev.addEventListener(
      "click",
      () => {

        setRulesPage(
          currentRulePage - 1
        );

      }
    );

  }


  if (rulesNext) {

    rulesNext.addEventListener(
      "click",
      () => {

        setRulesPage(
          currentRulePage + 1
        );

      }
    );

  }


  ruleCards.forEach(
    (card) => {

      // Hover/focus sigue mostrando el reverso con el texto.
      // Click/tap abre el modal con el texto completo.
      card.addEventListener(
        "click",
        () => {

          openRuleModal(
            Number(
              card.dataset.ruleIndex
            ),
            card
          );

        }
      );


      card.addEventListener(
        "keydown",
        (event) => {

          if (
            event.key !==
              "Enter" &&
            event.key !==
              " "
          ) {
            return;
          }

          event.preventDefault();

          openRuleModal(
            Number(
              card.dataset.ruleIndex
            ),
            card
          );

        }
      );

    }
  );


  page
    .querySelectorAll(
      "[data-rule-modal-close]"
    )
    .forEach(
      (element) => {

        element.addEventListener(
          "click",
          closeRuleModal
        );

      }
    );


  if (rulesViewport) {

    rulesViewport.addEventListener(
      "pointerdown",
      (event) => {

        rulesPointerStartX =
          event.clientX;

      }
    );


    rulesViewport.addEventListener(
      "pointerup",
      (event) => {

        if (
          rulesPointerStartX ===
          null
        ) {
          return;
        }


        const delta =
          event.clientX -
          rulesPointerStartX;


        rulesPointerStartX =
          null;


        if (
          Math.abs(delta) <
          50
        ) {
          return;
        }


        setRulesPage(
          currentRulePage +
          (
            delta < 0
              ? 1
              : -1
          )
        );

      }
    );


    rulesViewport.addEventListener(
      "pointercancel",
      () => {

        rulesPointerStartX =
          null;

      }
    );

  }


  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key ===
          "Escape" &&
        ruleModal?.classList.contains(
          "is-open"
        )
      ) {

        closeRuleModal();

      }

    }
  );


}
