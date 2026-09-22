// ========================================
// ARKHAM — Team Landing Configuration
// ========================================

import { getCurrentEntityContext } from "../services/entityContext.js";
import { getCurrentTeamBilling } from "../services/billingPayment.js";
import { createSubscriptionAccess } from "../services/planService.js";
import { hasEffectiveSubscriptionAccess } from "../services/subscription.js";
import { CAPABILITIES } from "../services/capabilities.js";
import {
  getTeamLandingConfig,
  saveTeamLandingConfig,
  uploadTeamLandingBackground,
  uploadTeamSponsorLogo
} from "../services/teamLanding.js";

const DEFAULT_PRIMARY_COLOR = "#E30613";
const MAX_SPONSORS = 8;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function normalizeColor(value) {
  return /^#[0-9A-Fa-f]{6}$/.test(String(value || ""))
    ? String(value).toUpperCase()
    : DEFAULT_PRIMARY_COLOR;
}

export function TeamLanding() {
  const page = document.createElement("main");
  page.className = "team-page team-landing-page";
  page.innerHTML = `
    <section class="team-page__content">
      <header class="team-page__header">
        <span>TEAM</span>
        <h1>Landing</h1>
        <p>Configura la presencia pública de tu Team con un solo template ARKHAM.</p>
      </header>
      <div class="team-landing__state" data-landing-state>
        <span>Cargando configuración...</span>
      </div>
    </section>
  `;

  loadLanding(page);
  return page;
}

async function loadLanding(page) {
  const state = page.querySelector("[data-landing-state]");

  try {
    const context = await getCurrentEntityContext();
    if (context?.type !== "team" || !context.id) {
      renderError(state, "Team no disponible", "No se encontró el Team activo de esta sesión.");
      return;
    }

    const [teamBilling, landingData] = await Promise.all([
      getCurrentTeamBilling(context.id),
      getTeamLandingConfig(context.id)
    ]);

    // Team Billing is entity-scoped. Do not use the account-level
    // subscription here because older accounts may still have a
    // different/legacy subscription associated with the account.
    const teamSubscription =
      teamBilling?.subscription || null;

    const access = createSubscriptionAccess(
      teamSubscription,
      context.productId
    );

    const hasLanding =
      hasEffectiveSubscriptionAccess(teamSubscription) &&
      access.hasCapability(CAPABILITIES.PUBLIC_LANDING);

    if (!landingData?.team) {
      renderError(state, "Team no disponible", "No se encontró la información del Team.");
      return;
    }

    renderEditor(state, {
      teamId: context.id,
      team: landingData.team,
      landing: landingData.landing,
      hasLanding
    });
  } catch (error) {
    console.error("ARKHAM — Error cargando configuración de Landing:", error);
    renderError(state, "No se pudo cargar Landing", error?.message || "Intenta nuevamente.");
  }
}

function renderEditor(state, { teamId, team, landing, hasLanding }) {
  const primaryColor = normalizeColor(landing.primaryColor);
  const backgroundUrl = landing.background?.url || "";
  const sponsors = Array.isArray(landing.sponsors) ? landing.sponsors : [];

  if (!hasLanding) {
    state.innerHTML = `
      <section class="team-landing__locked">
        <div class="team-landing__locked-icon">
          <i class="fa-solid fa-lock" aria-hidden="true"></i>
        </div>
        <span>TEAM PRO</span>
        <h2>Tu Landing pública está bloqueada.</h2>
        <p>El plan Pro habilita la presencia pública completa del Team con divisiones, roster, identidad visual y patrocinadores.</p>
        <a href="/dashboard/billing/upgrade" data-team-landing-upgrade>ACTIVAR TEAM PRO <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </section>
    `;

    bindNavigation(state);
    return;
  }

  state.innerHTML = `
    <div class="team-landing__toolbar">
      <div>
        <span>PUBLIC PRESENCE</span>
        <h2>${escapeHtml(team.name || "Team")}</h2>
        <small>/teams/${escapeHtml(teamId)}</small>
      </div>
      <a href="/teams/${encodeURIComponent(teamId)}" target="_blank" rel="noopener" class="team-landing__view">
        VER LANDING <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>
    </div>

    <form class="team-landing__editor" data-landing-form>
      <section class="team-landing__panel">
        <header>
          <span>01</span>
          <div>
            <strong>Identidad</strong>
            <small>La información base viene de tu Team.</small>
          </div>
        </header>
        <div class="team-landing__identity">
          <div class="team-landing__logo">
            ${team.logo?.url ? `<img src="${escapeHtml(team.logo.url)}" alt="">` : `<span>${escapeHtml(team.shortName || team.name?.charAt(0) || "NX")}</span>`}
          </div>
          <div>
            <strong>${escapeHtml(team.name || "Team")}</strong>
            <span>${escapeHtml(team.shortName || "SIN TAG")}</span>
          </div>
        </div>
        <p class="team-landing__hint">Para cambiar nombre, TAG, descripción o logo, utiliza la información general de tu Team. Esta sección no duplica esos datos.</p>
      </section>

      <section class="team-landing__panel">
        <header>
          <span>02</span>
          <div>
            <strong>Color principal</strong>
            <small>ARKHAM controla el template; tú defines el acento visual.</small>
          </div>
        </header>
        <div class="team-landing__color-field">
          <input type="color" value="${primaryColor}" data-primary-color aria-label="Color principal">
          <input type="text" value="${primaryColor}" maxlength="7" pattern="#[0-9A-Fa-f]{6}" data-primary-hex aria-label="Código hexadecimal">
        </div>
      </section>

      <section class="team-landing__panel">
        <header>
          <span>03</span>
          <div>
            <strong>Fondo</strong>
            <small>Una imagen para el hero de tu Landing.</small>
          </div>
        </header>
        <div class="team-landing__upload">
          <div class="team-landing__background-preview" data-background-preview style="${backgroundUrl ? `background-image:url('${escapeHtml(backgroundUrl)}')` : ""}">
            ${backgroundUrl ? "" : `<i class="fa-solid fa-image" aria-hidden="true"></i><span>SIN FONDO</span>`}
          </div>
          <label class="team-landing__upload-button">
            <i class="fa-solid fa-upload" aria-hidden="true"></i>
            CAMBIAR FONDO
            <input type="file" accept="image/jpeg,image/png,image/webp" data-background-file hidden>
          </label>
          <span data-background-status>JPG, PNG o WEBP</span>
        </div>
      </section>

      <section class="team-landing__panel">
        <header>
          <span>04</span>
          <div>
            <strong>Patrocinadores</strong>
            <small>Sube únicamente sus logos. ARKHAM se encarga de la composición.</small>
          </div>
        </header>
        <div class="team-landing__sponsors" data-sponsors>
          ${renderSponsors(sponsors)}
        </div>
        <label class="team-landing__upload-button team-landing__upload-button--sponsor" ${sponsors.length >= MAX_SPONSORS ? "hidden" : ""}>
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          AGREGAR PATROCINADOR
          <input type="file" accept="image/jpeg,image/png,image/webp" data-sponsor-file hidden>
        </label>
        <span class="team-landing__hint">Máximo ${MAX_SPONSORS} logos.</span>
      </section>

      <footer class="team-landing__actions">
        <span data-save-status>Los cambios se guardan en tu Team.</span>
        <button type="submit" class="team-landing__save" data-save-landing>
          GUARDAR LANDING <i class="fa-solid fa-check" aria-hidden="true"></i>
        </button>
      </footer>
    </form>
  `;

  bindEditor(state, { teamId, landing });
}

function renderSponsors(sponsors) {
  if (!sponsors.length) {
    return `<div class="team-landing__sponsors-empty"><i class="fa-solid fa-handshake" aria-hidden="true"></i><span>Aún no hay patrocinadores.</span></div>`;
  }

  return sponsors.map((sponsor, index) => `
    <div class="team-landing__sponsor" data-sponsor data-sponsor-id="${escapeHtml(sponsor.id || String(index))}">
      <div class="team-landing__sponsor-logo"><img src="${escapeHtml(sponsor.logo?.url || "")}" alt="Patrocinador ${index + 1}"></div>
      <span>PATROCINADOR ${String(index + 1).padStart(2, "0")}</span>
      <button type="button" data-remove-sponsor="${escapeHtml(sponsor.id || String(index))}" aria-label="Eliminar patrocinador"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
    </div>
  `).join("");
}

function bindEditor(state, { teamId, landing }) {
  const form = state.querySelector("[data-landing-form]");
  const colorInput = state.querySelector("[data-primary-color]");
  const hexInput = state.querySelector("[data-primary-hex]");
  const backgroundFile = state.querySelector("[data-background-file]");
  const backgroundPreview = state.querySelector("[data-background-preview]");
  const backgroundStatus = state.querySelector("[data-background-status]");
  const sponsorFile = state.querySelector("[data-sponsor-file]");
  const sponsorsContainer = state.querySelector("[data-sponsors]");
  const sponsorAdd = state.querySelector(".team-landing__upload-button--sponsor");
  const saveStatus = state.querySelector("[data-save-status]");
  const saveButton = state.querySelector("[data-save-landing]");

  let currentBackground = landing.background || null;
  let currentSponsors = Array.isArray(landing.sponsors) ? [...landing.sponsors] : [];

  colorInput.addEventListener("input", () => {
    const value = normalizeColor(colorInput.value);
    hexInput.value = value;
  });

  hexInput.addEventListener("input", () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hexInput.value)) {
      colorInput.value = hexInput.value;
    }
  });

  backgroundFile.addEventListener("change", async () => {
    const file = backgroundFile.files?.[0];
    if (!file) return;

    backgroundFile.disabled = true;
    backgroundStatus.textContent = "SUBIENDO...";

    try {
      const result = await uploadTeamLandingBackground(file);
      currentBackground = {
        url: result.url,
        fileId: result.fileId,
        filePath: result.filePath
      };
      backgroundPreview.style.backgroundImage = `url('${result.url}')`;
      backgroundPreview.innerHTML = "";
      backgroundStatus.textContent = "FONDO LISTO PARA GUARDAR";
    } catch (error) {
      console.error("ARKHAM — Error subiendo fondo:", error);
      backgroundStatus.textContent = error?.message || "No fue posible subir el fondo.";
    } finally {
      backgroundFile.disabled = false;
    }
  });

  sponsorFile.addEventListener("change", async () => {
    const file = sponsorFile.files?.[0];
    if (!file || currentSponsors.length >= MAX_SPONSORS) return;

    sponsorFile.disabled = true;
    sponsorAdd.classList.add("is-loading");

    try {
      const result = await uploadTeamSponsorLogo(file);
      currentSponsors.push({
        id: `sponsor-${Date.now()}`,
        logo: {
          url: result.url,
          fileId: result.fileId,
          filePath: result.filePath
        }
      });
      sponsorsContainer.innerHTML = renderSponsors(currentSponsors);
      bindSponsorRemoveEvents(sponsorsContainer, currentSponsors, renderSponsorsState);
      renderSponsorsState();
    } catch (error) {
      console.error("ARKHAM — Error subiendo patrocinador:", error);
      saveStatus.textContent = error?.message || "No fue posible subir el logo.";
    } finally {
      sponsorFile.disabled = false;
      sponsorAdd.classList.remove("is-loading");
      sponsorFile.value = "";
    }
  });

  function renderSponsorsState() {
    sponsorsContainer.innerHTML = renderSponsors(currentSponsors);
    bindSponsorRemoveEvents(sponsorsContainer, currentSponsors, renderSponsorsState);
    sponsorAdd.hidden = currentSponsors.length >= MAX_SPONSORS;
  }

  bindSponsorRemoveEvents(sponsorsContainer, currentSponsors, renderSponsorsState);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    saveStatus.textContent = "GUARDANDO...";

    try {
      const saved = await saveTeamLandingConfig(teamId, {
        primaryColor: normalizeColor(hexInput.value || colorInput.value),
        background: currentBackground,
        sponsors: currentSponsors
      });
      currentBackground = saved.background;
      currentSponsors = saved.sponsors;
      saveStatus.textContent = "LANDING GUARDADA CORRECTAMENTE.";
    } catch (error) {
      console.error("ARKHAM — Error guardando Landing:", error);
      saveStatus.textContent = error?.message || "No fue posible guardar la Landing.";
    } finally {
      saveButton.disabled = false;
    }
  });
}

function bindSponsorRemoveEvents(container, sponsors, refresh) {
  container.querySelectorAll("[data-remove-sponsor]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.removeSponsor;
      const index = sponsors.findIndex((sponsor, sponsorIndex) => String(sponsor.id || sponsorIndex) === id);
      if (index >= 0) {
        sponsors.splice(index, 1);
        refresh();
      }
    });
  });
}

function bindNavigation(state) {
  state.querySelector("[data-team-landing-upgrade]")?.addEventListener("click", (event) => {
    event.preventDefault();
    window.history.pushState({}, "", "/dashboard/billing/upgrade");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

function renderError(state, title, message) {
  state.innerHTML = `
    <div class="team-landing__error">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}
