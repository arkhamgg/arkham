const DEFAULT_TITLE = "Cambios guardados";

/** Muestra una confirmación de éxito accesible y coherente con la UI de ARKHAM. */
export function showSuccessModal({
  root = document.body,
  title = DEFAULT_TITLE,
  message = "Los cambios se guardaron correctamente.",
  actionLabel = "Listo"
} = {}) {
  if (!root) return null;

  root.querySelector("[data-success-modal]")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "arkham-success-modal";
  overlay.dataset.successModal = "";
  overlay.innerHTML = `
    <div class="arkham-success-modal__backdrop" data-success-modal-dismiss></div>
    <section class="arkham-success-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="arkham-success-modal-title" aria-describedby="arkham-success-modal-message" tabindex="-1">
      <div class="arkham-success-modal__icon" aria-hidden="true">
        <i class="fa-solid fa-check"></i>
      </div>
      <span class="arkham-success-modal__eyebrow">ARKHAM · CONFIRMACIÓN</span>
      <h2 id="arkham-success-modal-title">${escapeHTML(title)}</h2>
      <p id="arkham-success-modal-message">${escapeHTML(message)}</p>
      <button class="arkham-success-modal__action" type="button" data-success-modal-dismiss>${escapeHTML(actionLabel)}</button>
    </section>
  `;

  const dialog = overlay.querySelector(".arkham-success-modal__dialog");
  const closeButton = overlay.querySelector("button[data-success-modal-dismiss]");
  const previousFocus = document.activeElement;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    overlay.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKeydown);
    overlay.remove();
    if (previousFocus?.isConnected && typeof previousFocus.focus === "function") previousFocus.focus();
  };

  function handleClick(event) {
    if (event.target.closest("[data-success-modal-dismiss]")) close();
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    event.preventDefault();
    closeButton?.focus();
  }

  overlay.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
  root.appendChild(overlay);
  closeButton?.focus();
  return { element: overlay, close };
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}
