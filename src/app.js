// ========================================
// NEXUS — Application Entry
// ========================================

import "@fortawesome/fontawesome-free/css/all.min.css";

import "./styles/main.scss";

import { Navbar } from "./js/components/navbar.js";
import { Router } from "./js/router.js";
import { db } from "./js/services/firebase.js";
console.log("NEXUS — Firestore conectado:", db);

const app = document.querySelector("#app");

// ========================================
// GLOBAL UI
// ========================================

const navbar = Navbar();

app.appendChild(navbar);


// ========================================
// ROUTER
// ========================================

const pageContainer = document.createElement("div");

pageContainer.id = "page-container";

app.appendChild(pageContainer);

const router = Router(pageContainer);