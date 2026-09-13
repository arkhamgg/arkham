export function BuilderStep({
  number = "",
  label = "",
  title = "",
  description = "",
  summary = "",
  completed = false,
  active = false,
  optional = false,
  content = null,
  onOpen = null,
  onClose = null
} = {}) {
  const container = document.createElement("section");

  container.className = "builder-step";

  let isOpen = Boolean(active);
  let isCompleted = Boolean(completed);

  function normalizeContent() {
    if (!content) {
      return null;
    }

    if (content instanceof HTMLElement) {
      return content;
    }

    if (typeof content === "function") {
      const generatedContent = content();

      if (generatedContent instanceof HTMLElement) {
        return generatedContent;
      }
    }

    return null;
  }

  const contentElement = normalizeContent();

  container.innerHTML = `
    <button
      type="button"
      class="builder-step__header"
      aria-expanded="${isOpen}"
    >
      <span class="builder-step__number">
        ${number}
      </span>

      <span class="builder-step__main">

        <span class="builder-step__topline">

          <span class="builder-step__label">
            ${label}
          </span>

          ${
            optional
              ? `
                <span class="builder-step__optional">
                  OPCIONAL
                </span>
              `
              : ""
          }

        </span>

        <span class="builder-step__title">
          ${title}
        </span>

        <span
          class="builder-step__summary"
          data-builder-step-summary
        >
          ${summary || "Pendiente de configuración"}
        </span>

      </span>

      <span class="builder-step__status">

        <span
          class="builder-step__check"
          aria-hidden="true"
        >
          <i class="fa-solid fa-check"></i>
        </span>

        <span
          class="builder-step__icon"
          aria-hidden="true"
        >
          <i class="fa-solid fa-chevron-down"></i>
        </span>

      </span>
    </button>

    <div
      class="builder-step__body"
      aria-hidden="${!isOpen}"
    >
      <div class="builder-step__body-inner">
        <div class="builder-step__description">
          ${description}
        </div>

        <div
          class="builder-step__content"
          data-builder-step-content
        ></div>
      </div>
    </div>
  `;

  const header = container.querySelector(
    ".builder-step__header"
  );

  const body = container.querySelector(
    ".builder-step__body"
  );

  const summaryElement = container.querySelector(
    "[data-builder-step-summary]"
  );

  const contentContainer = container.querySelector(
    "[data-builder-step-content]"
  );

  function updateState() {
    container.classList.toggle(
      "builder-step--open",
      isOpen
    );

    container.classList.toggle(
      "builder-step--completed",
      isCompleted
    );

    header.setAttribute(
      "aria-expanded",
      String(isOpen)
    );

    body.setAttribute(
      "aria-hidden",
      String(!isOpen)
    );

    if (isOpen) {
      body.removeAttribute("hidden");
    } else {
      body.removeAttribute("hidden");
    }
  }

  function open() {
    if (isOpen) {
      return;
    }

    isOpen = true;

    updateState();

    if (typeof onOpen === "function") {
      onOpen();
    }
  }

  function close() {
    if (!isOpen) {
      return;
    }

    isOpen = false;

    updateState();

    if (typeof onClose === "function") {
      onClose();
    }
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  function setOpen(value) {
    isOpen = Boolean(value);

    updateState();
  }

  function setCompleted(value) {
    isCompleted = Boolean(value);

    updateState();
  }

  function setSummary(value = "") {
    summaryElement.textContent =
      value || "Pendiente de configuración";
  }

  function setContent(newContent = null) {
    contentContainer.innerHTML = "";

    if (!newContent) {
      return;
    }

    if (newContent instanceof HTMLElement) {
      contentContainer.appendChild(
        newContent
      );

      return;
    }

    if (typeof newContent === "function") {
      const generatedContent = newContent();

      if (generatedContent instanceof HTMLElement) {
        contentContainer.appendChild(
          generatedContent
        );
      }
    }
  }

  function getOpenState() {
    return isOpen;
  }

  function getCompletedState() {
    return isCompleted;
  }

  header.addEventListener(
    "click",
    () => {
      toggle();
    }
  );

  if (contentElement) {
    contentContainer.appendChild(
      contentElement
    );
  }

  updateState();

  return {
    element: container,

    open,
    close,
    toggle,

    setOpen,
    setCompleted,
    setSummary,
    setContent,

    isOpen: getOpenState,
    isCompleted: getCompletedState
  };
}