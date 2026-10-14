import { ContactSupportSelector } from "./contactSupportSelector.js";

/** Panel independiente para los canales de contacto del organizador. */
export function TournamentContactSection({ value = null } = {}) {
  const element = document.createElement("section");
  element.className = "tournament-contact-section";
  element.innerHTML = `
    <header class="tournament-contact-section__header">
      <span class="tournament-contact-section__eyebrow">CONTACTO</span>
      <h2>Contacto del organizador</h2>
    </header>
    <div data-contact-selector></div>
  `;
  const selector = ContactSupportSelector({ value });
  element.querySelector("[data-contact-selector]").appendChild(selector.element);
  return {
    element,
    getValue() { return selector.getValue(); }
  };
}
