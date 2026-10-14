import { PrizeEditor } from "./prizeEditor.js";
import { RegistrationCostSelector } from "./registrationCostSelector.js";

/** Panel independiente para premios y costo de inscripción. */
export function TournamentPrizesRegistrationSection({ prizes = [], registrationCost = null, participationType = "" } = {}) {
  const element = document.createElement("section");
  element.className = "tournament-prizes-registration-section";
  element.innerHTML = `
    <article class="tournament-prizes-registration-section__panel tournament-prizes-registration-section__panel--prizes">
      <div class="tournament-prizes-registration-section__heading"><span>PREMIOS</span></div>
      <div data-prize-editor></div>
    </article>
    <article class="tournament-prizes-registration-section__panel tournament-prizes-registration-section__panel--cost">
      <div class="tournament-prizes-registration-section__heading"><span>INSCRIPCIÓN</span></div>
      <div data-registration-cost-editor></div>
    </article>
  `;

  const prizeEditor = PrizeEditor({ prizes });
  const registrationCostEditor = RegistrationCostSelector({ value: registrationCost, participationType });
  element.querySelector("[data-prize-editor]").appendChild(prizeEditor.element);
  element.querySelector("[data-registration-cost-editor]").appendChild(registrationCostEditor.element);

  return {
    element,
    getValue() {
      return { prizes: prizeEditor.getValue(), registrationCost: registrationCostEditor.getValue() };
    }
  };
}
