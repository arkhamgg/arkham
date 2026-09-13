// ========================================
// NEXUS — Competition Landing Utilities
// ========================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  return value;
}

function getDateRange(dateTime = {}) {
  const startDate = formatDate(dateTime.startDate);
  const endDate = dateTime.endDate
    ? formatDate(dateTime.endDate)
    : "";

  if (startDate === "—") {
    return "FECHA POR DEFINIR";
  }

  if (endDate && endDate !== startDate) {
    return `${startDate} — ${endDate}`;
  }

  return startDate;
}

function getTimeRange(dateTime = {}) {
  const startTime = formatTime(dateTime.startTime);
  const endTime = formatTime(dateTime.endTime);

  if (!startTime) {
    return "";
  }

  return endTime
    ? `${startTime} — ${endTime}`
    : startTime;
}

function getLocationLabel(location = {}) {
  if (!location || typeof location !== "object") {
    return "POR DEFINIR";
  }

  if (location.type === "presencial") {
    return [
      location.venue,
      location.city
    ]
      .filter(Boolean)
      .join(" · ") || "PRESENCIAL";
  }

  return location.platform || "ONLINE";
}

function getRegistrationLabel(registrationCost = {}) {
  if (!registrationCost || registrationCost.type === "free") {
    return "GRATIS";
  }

  const amount = Number(registrationCost.amount);

  if (!Number.isFinite(amount)) {
    return "DE PAGO";
  }

  const currency = registrationCost.currency || "GTQ";

  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

function getPrizeSummary(prizes = []) {
  if (!Array.isArray(prizes) || prizes.length === 0) {
    return "PREMIOS POR DEFINIR";
  }

  const rewards = prizes.flatMap((prize) =>
    Array.isArray(prize?.rewards) ? prize.rewards : []
  );

  const cashRewards = rewards.filter(
    (reward) =>
      reward?.type === "cash" &&
      Number(reward?.amount) > 0
  );

  if (cashRewards.length > 0) {
    const total = cashRewards.reduce(
      (sum, reward) => sum + Number(reward.amount),
      0
    );

    const currency = cashRewards[0].currency || "GTQ";

    return new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(total);
  }

  return "PREMIOS";
}

function getFirstPrizeDescription(prizes = []) {
  if (!Array.isArray(prizes)) {
    return "";
  }

  for (const prize of prizes) {
    const rewards = Array.isArray(prize?.rewards)
      ? prize.rewards
      : [];

    for (const reward of rewards) {
      if (reward?.description) {
        return reward.description;
      }

      if (reward?.title) {
        return reward.title;
      }
    }
  }

  return "";
}

function getTemplateResources(game, templateId) {
  const resources = game?.landingResources?.[templateId];

  if (!resources || typeof resources !== "object") {
    return {};
  }

  return resources;
}

function normalizeSupportChannels(supportContact) {
  if (!Array.isArray(supportContact?.channels)) {
    return [];
  }

  return supportContact.channels.filter(
    (channel) =>
      channel?.type &&
      channel?.value
  );
}

function getSupportIcon(type) {
  const icons = {
    email: "fa-envelope",
    whatsapp: "fa-whatsapp",
    discord: "fa-discord",
    instagram: "fa-instagram",
    facebook: "fa-facebook",
    telegram: "fa-telegram",
    tiktok: "fa-tiktok",
    other: "fa-circle-info"
  };

  return icons[type] || icons.other;
}

function getSupportLabel(type) {
  const labels = {
    email: "Correo electrónico",
    whatsapp: "WhatsApp",
    discord: "Discord",
    instagram: "Instagram",
    facebook: "Facebook",
    telegram: "Telegram",
    tiktok: "TikTok",
    other: "Contacto"
  };

  return labels[type] || labels.other;
}

function getSupportHref(channel) {
  const value = String(channel?.value || "").trim();

  if (!value) {
    return "#";
  }

  switch (channel.type) {
    case "email":
      return `mailto:${value}`;

    case "whatsapp": {
      const digits = value.replace(/\D/g, "");

      return digits
        ? `https://wa.me/${digits}`
        : "#";
    }

    default:
      if (/^https?:\/\//i.test(value)) {
        return value;
      }

      if (
        ["instagram", "tiktok"].includes(channel.type) &&
        value.startsWith("@")
      ) {
        const base =
          channel.type === "instagram"
            ? "https://instagram.com/"
            : "https://tiktok.com/@";

        return `${base}${value.slice(1)}`;
      }

      return "#";
  }
}

function renderSupportContact(channels) {
  if (channels.length === 0) {
    return `
      <div class="competition-landing__support-empty">
        <i
          class="fa-solid fa-circle-info"
          aria-hidden="true"
        ></i>

        <p>
          La organización no ha publicado un canal de contacto.
        </p>
      </div>
    `;
  }

  return `
    <div class="competition-landing__support">
      <span class="competition-landing__support-label">
        CONTACTA A LA ORGANIZACIÓN
      </span>

      <div class="competition-landing__support-list">
        ${channels.map((channel) => {
          const href = getSupportHref(channel);

          const external =
            !href.startsWith("mailto:") &&
            href !== "#";

          const iconFamily =
            ["email", "other"].includes(channel.type)
              ? "fa-solid"
              : "fa-brands";

          return `
            <a
              class="competition-landing__support-item"
              href="${escapeHtml(href)}"
              ${external
                ? 'target="_blank" rel="noopener noreferrer"'
                : ""}
            >
              <i
                class="${iconFamily} ${getSupportIcon(channel.type)}"
                aria-hidden="true"
              ></i>

              <span>
                ${escapeHtml(
                  getSupportLabel(channel.type)
                )}
              </span>

              <strong>
                ${escapeHtml(channel.value)}
              </strong>
            </a>
          `;
        }).join("")}
      </div>
    </div>
  `;
}


// ========================================
// EXPORTS
// ========================================

export {
  escapeHtml,
  formatDate,
  formatTime,
  getDateRange,
  getTimeRange,
  getLocationLabel,
  getRegistrationLabel,
  getPrizeSummary,
  getFirstPrizeDescription,
  getTemplateResources,
  normalizeSupportChannels,
  getSupportIcon,
  getSupportLabel,
  getSupportHref,
  renderSupportContact
};