// ========================================
// NEXUS — Player Dashboard Views
// ========================================

export function PlayerView({ view = "competitions" } = {}) {

  const page = document.createElement("main");
  page.className = "player-view-page";

  const views = {
    competitions: { eyebrow: "COMPETITIVO", title: "Mis competencias", text: "Aquí aparecerán las competencias en las que participes." },
    requests: { eyebrow: "COMPETITIVO", title: "Solicitudes a torneo", text: "Consulta el estado de tus solicitudes y gestiona nuevos intentos." },
    results: { eyebrow: "COMPETITIVO", title: "Mis resultados", text: "Tu historial de resultados competitivos se mostrará aquí." },
    stats: { eyebrow: "COMPETITIVO", title: "Estadísticas", text: "Tus estadísticas competitivas se construirán a partir de tus partidas registradas." },
    profile: { eyebrow: "CUENTA", title: "Mi perfil", text: "Gestiona la identidad pública de tu perfil Player en NEXUS." }
  };

  const current = views[view] || views.competitions;

  page.innerHTML = `
    <section class="player-view-page__content">
      <span class="player-view-page__eyebrow">${current.eyebrow}</span>
      <h1>${current.title}</h1>
      <p>${current.text}</p>
      <span class="player-view-page__status">MÓDULO PLAYER · EN CONSTRUCCIÓN</span>
    </section>
  `;

  return page;
}
