import { RulesEditor } from "./rulesEditor.js";

/**
 * Sección independiente para administrar las reglas generales del evento.
 * Mantiene RulesEditor como componente reutilizable y expone el mismo
 * contrato getValue() que utilizan las demás secciones de información.
 */
export function TournamentGeneralRulesSection({ rules = [] } = {}) {
  const section = document.createElement("section");
  section.className = "tournament-rules-section tournament-pro-page__information-section";
  section.innerHTML = `
    <div class="tournament-rules-section__editor"></div>
  `;

  const editor = RulesEditor({ rules });
  section.querySelector(".tournament-rules-section__editor").appendChild(editor.element);

  return {
    element: section,
    getValue() {
      return editor.getValue();
    },
    setValue(nextRules) {
      editor.setValue(nextRules);
    }
  };
}
