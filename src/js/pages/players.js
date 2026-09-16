import { Players } from "../components/players.js";

export function PlayersPage() {
  const page = document.createElement("main");
  page.className = "players-public-page";
  page.appendChild(Players());
  return page;
}
