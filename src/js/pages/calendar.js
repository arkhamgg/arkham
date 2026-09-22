import { getEntity } from "../services/firestore.js";
import { getCalendarEvents } from "../services/calendarService.js";

export function Calendar() {
  const page = document.createElement("main");
  page.className = "calendar-page";
  page.id = "calendar-page";

  page.innerHTML = `
    <section class="calendar-page__header">
      <div class="calendar-page__container">
        <div class="calendar-page__eyebrow">
          ARKHAM // COMPETITIVE CALENDAR
        </div>

        <div class="calendar-page__heading">
          <div>
            <h1>CALENDAR</h1>
            <p>Consulta las próximas competencias y eventos de ARKHAM.</p>
          </div>

          <div class="calendar-page__controls">
            <button type="button" class="calendar-page__nav" data-prev-month aria-label="Mes anterior">
              <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>

            <strong data-month-label></strong>

            <button type="button" class="calendar-page__nav" data-next-month aria-label="Mes siguiente">
              <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div class="calendar-page__filters" role="group" aria-label="Filtros del calendario">
          <button type="button" class="calendar-page__filter is-active" data-filter="all">TODOS</button>
          <button type="button" class="calendar-page__filter" data-filter="upcoming">PRÓXIMOS</button>
          <button type="button" class="calendar-page__filter" data-filter="past">PASADOS</button>
        </div>
      </div>
    </section>

    <section class="calendar-page__body">
      <div class="calendar-page__container">
        <div class="calendar-page__state" data-calendar-state>
          <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <span>CARGANDO CALENDAR...</span>
        </div>

        <div class="calendar-page__grid" data-calendar-grid hidden></div>

        <div class="calendar-page__legend">
          <span><i class="calendar-page__dot"></i> EVENTO COMPETITIVO</span>
        </div>
      </div>
    </section>
  `;

  const state = page.querySelector("[data-calendar-state]");
  const grid = page.querySelector("[data-calendar-grid]");
  const monthLabel = page.querySelector("[data-month-label]");
  const prevButton = page.querySelector("[data-prev-month]");
  const nextButton = page.querySelector("[data-next-month]");
  const filters = page.querySelectorAll("[data-filter]");

  const now = new Date();
  let currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let activeFilter = "all";
  let calendarEntries = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getEntryDate(entry) {
    const date = new Date(entry.date);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function isPast(entry) {
    const date = getEntryDate(entry);
    if (!date) return false;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return date < today;
  }

  function getEntriesForCurrentView() {
    return calendarEntries.filter((entry) => {
      if (activeFilter === "upcoming") return !isPast(entry);
      if (activeFilter === "past") return isPast(entry);
      return true;
    });
  }

  function formatMonth(date) {
    return new Intl.DateTimeFormat("es-GT", {
      month: "long",
      year: "numeric"
    }).format(date).toUpperCase();
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat("es-GT", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function getEntriesForDay(dayDate) {
    return getEntriesForCurrentView().filter((entry) => {
      const date = getEntryDate(entry);
      return date && sameDay(date, dayDate);
    });
  }

  function renderEventCard(entry) {
    const date = getEntryDate(entry);
    const eventTitle = entry.event?.name || entry.event?.gameName || "EVENTO COMPETITIVO";
    const gameName = entry.game?.name || entry.event?.gameId || "COMPETENCIA";
    const tournamentName = entry.tournament?.name || "TORNEO";
    const time = date ? formatTime(date) : "—";

    return `
      <button
        type="button"
        class="calendar-page__event"
        data-event-link
        data-tournament-id="${escapeHtml(entry.tournamentId)}"
        data-event-id="${escapeHtml(entry.eventId)}"
      >
        <span class="calendar-page__event-game">${escapeHtml(gameName).replaceAll("-", " ").toUpperCase()}</span>
        <strong>${escapeHtml(eventTitle)}</strong>
        <span class="calendar-page__event-meta">
          ${escapeHtml(tournamentName)} · ${escapeHtml(time)}
        </span>
      </button>
    `;
  }

  function renderCalendar() {
    monthLabel.textContent = formatMonth(currentMonth);

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Monday = 0 ... Sunday = 6
    const leadingDays = (firstDay.getDay() + 6) % 7;

    let html = `
      <div class="calendar-page__weekdays">
        ${["LUN","MAR","MIÉ","JUE","VIE","SÁB","DOM"]
          .map((day) => `<span>${day}</span>`)
          .join("")}
      </div>

      <div class="calendar-page__days">
    `;

    for (let i = 0; i < leadingDays; i += 1) {
      html += `<div class="calendar-page__day calendar-page__day--empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const entries = getEntriesForDay(date);
      const isToday = sameDay(date, now);

      html += `
        <div class="calendar-page__day${isToday ? " calendar-page__day--today" : ""}${entries.length ? " calendar-page__day--has-events" : ""}">
          <div class="calendar-page__day-number">${day}</div>
          <div class="calendar-page__events">
            ${entries.map(renderEventCard).join("")}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    grid.innerHTML = html;
    grid.hidden = false;
    state.hidden = true;
  }

  function renderEmpty() {
    state.innerHTML = `
      <i class="fa-regular fa-calendar-xmark" aria-hidden="true"></i>
      <strong>NO HAY EVENTOS PROGRAMADOS</strong>
      <span>No existen competencias para mostrar con este filtro.</span>
    `;
    state.hidden = false;
    grid.hidden = true;
  }

  async function hydrateEntries() {
    const rawEntries = await getCalendarEvents();

    calendarEntries = await Promise.all(
      rawEntries.map(async (entry) => {
        try {
          const tournament = await getEntity("tournaments", entry.tournamentId);
          const event = tournament?.events?.[entry.eventId] || null;

          return {
            ...entry,
            tournament,
            event,
            game: null
          };
        } catch (error) {
          console.error("ARKHAM — Error cargando evento de Calendar:", error);
          return {
            ...entry,
            tournament: null,
            event: null,
            game: null
          };
        }
      })
    );

    calendarEntries = calendarEntries.filter((entry) => entry.event);

    if (!calendarEntries.length) {
      renderEmpty();
      return;
    }

    renderCalendar();
  }

  function navigateToEvent(tournamentId, eventId) {
    if (!tournamentId || !eventId) return;

    window.history.pushState(
      {},
      "",
      `/competitions/event?tournamentId=${encodeURIComponent(tournamentId)}&eventId=${encodeURIComponent(eventId)}`
    );

    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  prevButton.addEventListener("click", () => {
    currentMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    );
    renderCalendar();
  });

  nextButton.addEventListener("click", () => {
    currentMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
    );
    renderCalendar();
  });

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "all";

      filters.forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });

      const hasVisibleEvents = getEntriesForCurrentView().some((entry) => {
        const date = getEntryDate(entry);
        return (
          date &&
          date.getFullYear() === currentMonth.getFullYear() &&
          date.getMonth() === currentMonth.getMonth()
        );
      });

      if (!hasVisibleEvents) {
        renderEmpty();
      } else {
        renderCalendar();
      }
    });
  });

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-event-link]");
    if (!button) return;

    navigateToEvent(
      button.dataset.tournamentId,
      button.dataset.eventId
    );
  });

  hydrateEntries().catch((error) => {
    console.error("ARKHAM — Error cargando Calendar:", error);

    state.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      <strong>NO PUDIMOS CARGAR CALENDAR</strong>
      <span>Intenta nuevamente.</span>
    `;

    state.hidden = false;
    grid.hidden = true;
  });

  return page;
}
