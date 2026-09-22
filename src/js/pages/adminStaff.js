// ========================================
// ARKHAM — Admin Staff
// ========================================

import {
  requireAdminPermission
} from "../services/adminAccess.js";

import {
  getAdminUsers,
  updateAdminUserRole,
  activateAdminUser,
  deactivateAdminUser,
  getAdminRoleLabel,
  getAdminStatusLabel
} from "../services/adminUsers.js";


// ========================================
// PAGE
// ========================================

export function AdminStaff() {

  const page =
    document.createElement("main");

  page.className =
    "admin-staff-page";


  page.innerHTML = `

    <section class="admin-staff">

      <header class="admin-staff__header">

        <div>

          <span class="admin-staff__eyebrow">
            ARKHAM ADMIN
          </span>

          <h1>
            Staff
          </h1>

          <p>
            Administra los usuarios con acceso
            administrativo a ARKHAM.
          </p>

        </div>

        <button
          type="button"
          data-admin-back
        >
          Volver
        </button>

      </header>


      <div
        class="admin-staff__message"
        data-admin-message
      ></div>


      <div
        class="admin-staff__content"
        data-admin-staff
      >

        <div class="admin-staff__loading">
          Cargando staff...
        </div>

      </div>

    </section>

  `;


  const container =
    page.querySelector(
      "[data-admin-staff]"
    );

  const message =
    page.querySelector(
      "[data-admin-message]"
    );


  // ========================================
  // RENDER
  // ========================================

  function renderUsers(
    users
  ) {

    if (!users.length) {

      container.innerHTML = `

        <div class="admin-staff__empty">

          <h2>
            No hay usuarios administrativos.
          </h2>

          <p>
            Agrega los usuarios desde Firebase
            Authentication y Firestore.
          </p>

        </div>

      `;

      return;

    }


    container.innerHTML = `

      <div class="admin-staff__table-wrapper">

        <table class="admin-staff__table">

          <thead>

            <tr>

              <th>
                Usuario
              </th>

              <th>
                Rol
              </th>

              <th>
                Estado
              </th>

              <th>
                Acciones
              </th>

            </tr>

          </thead>

          <tbody>

            ${users.map(
              user => {

                const status =
                  user.status ||
                  "active";

                return `

                  <tr>

                    <td>

                      <strong>
                        ${
                          user.displayName ||
                          "Sin nombre"
                        }
                      </strong>

                      <small>
                        ${
                          user.email ||
                          "Sin correo"
                        }
                      </small>

                      <small>
                        UID:
                        ${
                          user.uid ||
                          user.id
                        }
                      </small>

                    </td>


                    <td>

                      <select
                        data-role-user="${
                          user.uid ||
                          user.id
                        }"
                      >

                        <option
                          value="administrator"
                          ${
                            user.roleId ===
                            "administrator"
                              ? "selected"
                              : ""
                          }
                        >
                          Administrator
                        </option>

                        <option
                          value="agent"
                          ${
                            user.roleId ===
                            "agent"
                              ? "selected"
                              : ""
                          }
                        >
                          Agent
                        </option>

                      </select>

                    </td>


                    <td>

                      <span
                        class="admin-staff__status"
                      >
                        ${
                          getAdminStatusLabel(
                            status
                          )
                        }
                      </span>

                    </td>


                    <td>

                      <div
                        class="admin-staff__actions"
                      >

                        <button
                          type="button"
                          data-save-role="${
                            user.uid ||
                            user.id
                          }"
                        >
                          Guardar rol
                        </button>

                        ${
                          status === "active"

                            ? `

                              <button
                                type="button"
                                data-deactivate="${
                                  user.uid ||
                                  user.id
                                }"
                              >
                                Desactivar
                              </button>

                            `

                            : `

                              <button
                                type="button"
                                data-activate="${
                                  user.uid ||
                                  user.id
                                }"
                              >
                                Activar
                              </button>

                            `
                        }

                      </div>

                    </td>

                  </tr>

                `;

              }
            ).join("")}

          </tbody>

        </table>

      </div>

    `;

  }


  // ========================================
  // LOAD
  // ========================================

  async function load() {

    try {

      await requireAdminPermission(
        "staff.view"
      );

      const users =
        await getAdminUsers();

      renderUsers(
        users
      );

    } catch (error) {

      console.error(
        "ARKHAM — Admin Staff:",
        error
      );

      container.innerHTML = `

        <div class="admin-staff__error">

          <h2>
            Acceso no autorizado
          </h2>

          <p>
            ${
              error.message ||
              "No tienes permisos para acceder."
            }
          </p>

        </div>

      `;

    }

  }


  // ========================================
  // EVENTS
  // ========================================

  page.addEventListener(
    "click",
    async event => {

      const saveButton =
        event.target.closest(
          "[data-save-role]"
        );

      const deactivateButton =
        event.target.closest(
          "[data-deactivate]"
        );

      const activateButton =
        event.target.closest(
          "[data-activate]"
        );

      const backButton =
        event.target.closest(
          "[data-admin-back]"
        );


      // ====================================
      // BACK
      // ====================================

      if (backButton) {

        window.history.back();

        return;

      }


      // ====================================
      // SAVE ROLE
      // ====================================

      if (saveButton) {

        const uid =
          saveButton.dataset.saveRole;

        const select =
          page.querySelector(
            `[data-role-user="${uid}"]`
          );

        const roleId =
          select?.value;

        try {

          saveButton.disabled =
            true;

          await updateAdminUserRole(
            uid,
            roleId
          );

          message.textContent =
            "Rol actualizado correctamente.";

          await load();

        } catch (error) {

          console.error(
            error
          );

          message.textContent =
            error.message ||
            "No se pudo actualizar el rol.";

        } finally {

          saveButton.disabled =
            false;

        }

        return;

      }


      // ====================================
      // DEACTIVATE
      // ====================================

      if (deactivateButton) {

        const uid =
          deactivateButton.dataset.deactivate;

        try {

          await deactivateAdminUser(
            uid
          );

          message.textContent =
            "Usuario desactivado.";

          await load();

        } catch (error) {

          console.error(
            error
          );

          message.textContent =
            error.message ||
            "No se pudo desactivar el usuario.";

        }

        return;

      }


      // ====================================
      // ACTIVATE
      // ====================================

      if (activateButton) {

        const uid =
          activateButton.dataset.activate;

        try {

          await activateAdminUser(
            uid
          );

          message.textContent =
            "Usuario activado.";

          await load();

        } catch (error) {

          console.error(
            error
          );

          message.textContent =
            error.message ||
            "No se pudo activar el usuario.";

        }

      }

    }
  );


  // ========================================
  // INITIAL LOAD
  // ========================================

  load();


  return page;

}