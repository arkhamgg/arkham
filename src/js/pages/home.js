// ========================================
// ARKHAM — Home Page
// ========================================

import { Hero } from "../components/hero.js";
import { Competitions } from "../components/competitions.js";
import { Teams } from "../components/teams.js";
import { Players } from "../components/players.js";
import { Infrastructure } from "../components/infrastructure.js";
import { Footer } from "../components/footer.js";

export function Home() {
  const page = document.createElement("main");

  page.className = "home";
  page.id = "home-page";


  // ========================================
  // HERO
  // ========================================

  const hero = Hero();

  page.appendChild(hero);


  // ========================================
  // COMPETITIONS
  // ========================================

  const competitions = Competitions();

  page.appendChild(competitions);


  // ========================================
  // TEAMS
  // ========================================

  const teams = Teams();

  page.appendChild(teams);


  // ========================================
  // PLAYERS
  // ========================================

  const players = Players();

  page.appendChild(players);
    // ========================================
// INFRASTRUCTURE
// ========================================

const infrastructure = Infrastructure();

page.appendChild(infrastructure);
// ========================================
// FOOTER
// ========================================

const footer = Footer();

page.appendChild(footer);

  return page;
}