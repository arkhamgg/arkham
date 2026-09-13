export function RulesEditor({
  rules = [],
  onChange = null
} = {}) {
  const container = document.createElement("div");

  container.className = "rules-editor";

  let currentRules = Array.isArray(rules)
    ? [...rules]
    : [];

  function createRuleId() {
    return crypto.randomUUID();
  }

  function emitChange() {
    if (typeof onChange === "function") {
      onChange([...currentRules]);
    }
  }

  function render() {
    container.innerHTML = "";

    const list = document.createElement("div");
    list.className = "rules-editor__list";

    currentRules.forEach((rule, index) => {
      const item = document.createElement("div");

      item.className = "rules-editor__item";

      item.dataset.ruleId = rule.id;

      item.innerHTML = `
        <div class="rules-editor__item-header">

          <span class="rules-editor__item-number">
            REGLA ${index + 1}
          </span>

          <button
            type="button"
            class="rules-editor__remove"
            data-remove-rule
            aria-label="Eliminar regla ${index + 1}"
          >
            ELIMINAR
          </button>

        </div>

        <textarea
          class="rules-editor__textarea"
          data-rule-text
          placeholder="Escribe la regla..."
          rows="3"
        ></textarea>
      `;

      const textarea = item.querySelector(
        "[data-rule-text]"
      );

      textarea.value = rule.text || "";

      textarea.addEventListener("input", (event) => {
        rule.text = event.target.value;

        emitChange();
      });

      const removeButton = item.querySelector(
        "[data-remove-rule]"
      );

      removeButton.addEventListener("click", () => {
        currentRules = currentRules.filter(
          (currentRule) =>
            currentRule.id !== rule.id
        );

        render();
        emitChange();
      });

      list.appendChild(item);
    });

    container.appendChild(list);

    const addButton = document.createElement("button");

    addButton.type = "button";
    addButton.className = "rules-editor__add";
    addButton.textContent = "+ AGREGAR REGLA";

    addButton.addEventListener("click", () => {
      currentRules.push({
        id: createRuleId(),
        order: currentRules.length + 1,
        text: ""
      });

      render();
      emitChange();
    });

    container.appendChild(addButton);
  }

  function normalizeOrder() {
    currentRules = currentRules.map(
      (rule, index) => ({
        ...rule,
        order: index + 1
      })
    );
  }

  render();

  return {
    element: container,

    getValue() {
      normalizeOrder();

      return [...currentRules];
    },

    setValue(newRules = []) {
      currentRules = Array.isArray(newRules)
        ? newRules.map((rule, index) => ({
            id: rule.id || createRuleId(),
            order: index + 1,
            text: rule.text || ""
          }))
        : [];

      render();
    },

    addRule(text = "") {
      currentRules.push({
        id: createRuleId(),
        order: currentRules.length + 1,
        text
      });

      render();
      emitChange();
    },

    refresh() {
      render();
    }
  };
}