// ========================================
// ARKHAM — Public Shell
// ========================================

import { Navbar } from "./navbar.js";


// ========================================
// SHELL
// ========================================

export function PublicShell(Page) {

  const shell =
    document.createElement("div");

  shell.className =
    "public-shell";


  // ========================================
  // NAVBAR
  // ========================================

  shell.appendChild(
    Navbar()
  );


  // ========================================
  // PAGE
  // ========================================

  const page =
    Page();

  shell.appendChild(
    page
  );


  return shell;

}
