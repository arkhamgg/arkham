// ========================================
// NEXUS — Team Divisions
// ========================================

export function TeamDivisions() {
  const page = document.createElement("main");
  page.className = "team-page";
  page.innerHTML = `
    <section class="team-page__content">
      <header>
        <span>TEAM</span>
        <h1>Divisiones</h1>
        <p>Las divisiones se organizarán por juego utilizando la información competitiva existente en NEXUS.</p>
      </header>
      <div class="team-page__placeholder">
        <i class="fa-solid fa-gamepad" aria-hidden="true"></i>
        <strong>Divisiones en construcción</strong>
        <span>Esta sección queda preparada para conectar los juegos y roles competitivos de Firestore.</span>
      </div>
    </section>
  `;
  return page;
}
