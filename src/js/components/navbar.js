// ========================================
// NEXUS — Navbar Component
// ========================================

export function Navbar() {
  const navbar = document.createElement("header");

  navbar.className = "navbar";

  navbar.innerHTML = `
    <div class="navbar__container">

      <a href="/" class="navbar__brand" aria-label="NEXUS — Inicio">
        <span class="navbar__brand-mark">N</span>
        <span class="navbar__brand-name">NEXUS</span>
      </a>

      <nav class="navbar__nav" aria-label="Navegación principal">

        <a href="/" class="navbar__link navbar__link--active">
          <i class="fa-solid fa-house" aria-hidden="true"></i>
          <span>Inicio</span>
        </a>

        <a href="#competitions" class="navbar__link">
          <i class="fa-solid fa-trophy" aria-hidden="true"></i>
          <span>Competencias</span>
        </a>

        <a href="#teams" class="navbar__link">
          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
          <span>Equipos</span>
        </a>

        <a href="#players" class="navbar__link">
          <i class="fa-solid fa-users" aria-hidden="true"></i>
          <span>Players</span>
        </a>

        <a href="#calendar" class="navbar__link">
          <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
          <span>Calendario</span>
        </a>

      </nav>

      <div class="navbar__actions">

        <a href="/login" class="navbar__login">
          <span>Iniciar sesión</span>
        </a>

        <a href="/register" class="navbar__cta">
          <span>Crear cuenta</span>
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </a>

        <button
          class="navbar__menu-toggle"
          type="button"
          aria-label="Abrir menú"
          aria-expanded="false"
        >
          <i class="fa-solid fa-bars" aria-hidden="true"></i>
        </button>

      </div>

    </div>

    <div class="navbar__mobile-menu">

      <nav class="navbar__mobile-nav" aria-label="Navegación móvil">

        <a href="/" class="navbar__mobile-link navbar__mobile-link--active">
          <i class="fa-solid fa-house" aria-hidden="true"></i>
          <span>Inicio</span>
        </a>

        <a href="#competitions" class="navbar__mobile-link">
          <i class="fa-solid fa-trophy" aria-hidden="true"></i>
          <span>Competencias</span>
        </a>

        <a href="#teams" class="navbar__mobile-link">
          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
          <span>Equipos</span>
        </a>

        <a href="#players" class="navbar__mobile-link">
          <i class="fa-solid fa-users" aria-hidden="true"></i>
          <span>Players</span>
        </a>

        <a href="#calendar" class="navbar__mobile-link">
          <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
          <span>Calendario</span>
        </a>

        <a href="/login" class="navbar__mobile-link">
          <i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i>
          <span>Iniciar sesión</span>
        </a>

        <a href="/register" class="navbar__mobile-cta">
          <span>Crear cuenta</span>
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </a>

      </nav>

    </div>
  `;

  const menuToggle = navbar.querySelector(".navbar__menu-toggle");
  const mobileMenu = navbar.querySelector(".navbar__mobile-menu");
  const mobileLinks = navbar.querySelectorAll(
    ".navbar__mobile-link, .navbar__mobile-cta"
  );

  function closeMenu() {
    navbar.classList.remove("navbar--menu-open");

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Abrir menú");

    menuToggle.innerHTML = `
      <i class="fa-solid fa-bars" aria-hidden="true"></i>
    `;
  }

  function toggleMenu() {
    const isOpen = navbar.classList.toggle("navbar--menu-open");

    menuToggle.setAttribute("aria-expanded", String(isOpen));

    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Cerrar menú" : "Abrir menú"
    );

    menuToggle.innerHTML = `
      <i class="fa-solid ${isOpen ? "fa-xmark" : "fa-bars"}" aria-hidden="true"></i>
    `;
  }

  menuToggle.addEventListener("click", toggleMenu);

  mobileLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) {
      closeMenu();
    }
  });

  return navbar;
}