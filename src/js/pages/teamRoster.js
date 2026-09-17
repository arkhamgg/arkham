// ========================================
// NEXUS — Team Roster
// ========================================

export function TeamRoster() {
  const page = document.createElement("main");
  page.className = "team-page";
  page.innerHTML = `
    <section class="team-page__content">
      <header>
        <span>TEAM</span>
        <h1>Roster</h1>
        <p>Gestiona las divisiones, jugadores y solicitudes de incorporación de tu Team.</p>
      </header>
      <div class="team-page__placeholder">
        <i class="fa-solid fa-users" aria-hidden="true"></i>
        <strong>Roster en construcción</strong>
        <span>La estructura del Team ya está separada de Tournament. Aquí construiremos la gestión de divisiones, solicitudes y jugadores.</span>
      </div>
    </section>
  `;
  return page;
}
