import { RegistrationRequirementsEditor } from "./registrationRequirementsEditor.js";

/** Panel independiente para requisitos previos a la inscripción. */
export function TournamentRegistrationRequirementsSection({ value = null } = {}) {
  const element = document.createElement("section");
  element.className = "tournament-registration-requirements-section";
  element.innerHTML = `<div data-registration-requirements-editor></div>`;

  const editor = RegistrationRequirementsEditor({ value });
  element.querySelector("[data-registration-requirements-editor]").appendChild(editor.element);

  return {
    element,
    getValue() { return { registrationRequirements: editor.getValue() }; }
  };
}
