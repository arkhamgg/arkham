import "@fortawesome/fontawesome-free/css/all.min.css";
import "./styles/main.scss";

import { Navbar } from "./js/components/navbar.js";
import { Hero } from "./js/components/hero.js";

const app = document.querySelector("#app");

const navbar = Navbar();
const hero = Hero();

app.appendChild(navbar);
app.appendChild(hero);