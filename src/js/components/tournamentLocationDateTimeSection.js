import { LocationSelector } from "./locationSelector.js";
import { DateTimeSelector } from "./dateTimeSelector.js";

/** Panel independiente para ubicación y programación del evento. */
export function TournamentLocationDateTimeSection({ location = null, dateTime = null } = {}) {
  const section = document.createElement("section");
  section.className = "tournament-location-date-section";
  section.innerHTML = `
    <div class="tournament-location-date-section__grid">
      <article class="tournament-location-date-section__panel">
        <div class="tournament-location-date-section__heading">
          <span class="tournament-location-date-section__eyebrow">UBICACIÓN</span>
        </div>
        <div data-location-editor></div>
      </article>
      <article class="tournament-location-date-section__panel">
        <div class="tournament-location-date-section__heading">
          <span class="tournament-location-date-section__eyebrow">FECHA Y HORA</span>
        </div>
        <div data-date-time-editor></div>
      </article>
    </div>
  `;

  const locationEditor = LocationSelector({ value: location });
  const dateTimeEditor = DateTimeSelector({ value: dateTime });
  section.querySelector("[data-location-editor]").appendChild(locationEditor.element);
  section.querySelector("[data-date-time-editor]").appendChild(dateTimeEditor.element);

  return {
    element: section,
    getValue() {
      return {
        location: locationEditor.getValue(),
        dateTime: dateTimeEditor.getValue()
      };
    }
  };
}
