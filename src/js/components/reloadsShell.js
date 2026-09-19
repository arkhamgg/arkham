// ========================================
// ARKHAM — Reloads Shell
// ========================================

import { getCurrentSession, initializeSession } from "../services/session.js";

export function ReloadsShell(Page) {
  const shell = document.createElement("div");
  shell.className = "reloads-shell";

  shell.innerHTML = `
    <header class="reloads-nav">
      <div class="reloads-nav__container">
        <a href="/reloads" class="reloads-nav__brand" aria-label="ARKHAM Reloads">
          <span class="reloads-nav__mark" aria-hidden="true">A</span>
          <span class="reloads-nav__wordmark">
            <strong>ARKHAM</strong>
            <small>RELOADS</small>
          </span>
        </a>

        <nav class="reloads-nav__links" aria-label="Navegación de Reloads">
          <a class="is-active" href="/reloads">Recargas</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#juegos">Juegos</a>
          <a href="#soporte">Soporte</a>
        </nav>

        <div class="reloads-nav__actions">
          <a class="reloads-nav__icon" href="#juegos" aria-label="Buscar juego">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          </a>
          <a class="reloads-nav__icon" href="#orden" aria-label="Ver recarga">
            <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>
          </a>
          <a class="reloads-nav__login" href="/login">Iniciar sesión</a>
          <a class="reloads-nav__cta" href="/register">Crear cuenta</a>
          <button class="reloads-nav__menu" type="button" aria-label="Abrir menú" aria-expanded="false">
            <i class="fa-solid fa-bars" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div class="reloads-nav__mobile" hidden>
        <a href="/reloads">Recargas</a>
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#juegos">Juegos</a>
        <a href="#soporte">Soporte</a>
        <a href="/login">Iniciar sesión</a>
        <a href="/register">Crear cuenta</a>
      </div>
    </header>
  `;

  const page = Page();
  shell.appendChild(page);

  const menu = shell.querySelector(".reloads-nav__menu");
  const mobile = shell.querySelector(".reloads-nav__mobile");

  menu?.addEventListener("click", () => {
    const isOpen = !mobile.hidden;
    mobile.hidden = isOpen;
    menu.setAttribute("aria-expanded", String(!isOpen));
    menu.innerHTML = `<i class="fa-solid ${isOpen ? "fa-bars" : "fa-xmark"}" aria-hidden="true"></i>`;
  });

  shell.querySelectorAll(".reloads-nav__mobile a").forEach((link) => {
    link.addEventListener("click", () => {
      mobile.hidden = true;
      menu.setAttribute("aria-expanded", "false");
      menu.innerHTML = `<i class="fa-solid fa-bars" aria-hidden="true"></i>`;
    });
  });

  initializeSession().then(() => {
    const session = getCurrentSession();
    if (!session) return;

    shell.querySelectorAll(".reloads-nav__login").forEach((link) => {
      link.textContent = "Mi cuenta";
      link.href = "/dashboard";
    });

    const mobileLogin = [...shell.querySelectorAll(".reloads-nav__mobile a")]
      .find((link) => link.textContent.trim() === "Iniciar sesión");

    if (mobileLogin) {
      mobileLogin.textContent = "Mi cuenta";
      mobileLogin.href = "/dashboard";
    }
  }).catch(() => {});

  return shell;
}
