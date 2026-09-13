export function PrizeEditor({
  prizes = [],
  onChange = null
} = {}) {
  const container = document.createElement("div");

  container.className = "prize-editor";

  let currentPrizes = Array.isArray(prizes)
    ? prizes.map(normalizePrizeGroup)
    : [];

  function createId() {
    return crypto.randomUUID();
  }

  /*
   * NORMALIZE REWARD
   */

  function normalizeReward(reward = {}) {
    return {
      id: reward.id || createId(),

      type: reward.type || "cash",

      name: reward.name || "",

      description: reward.description || "",

      amount:
        reward.amount !== undefined &&
        reward.amount !== null
          ? reward.amount
          : null,

      currency: reward.currency || "GTQ"
    };
  }

  /*
   * NORMALIZE PRIZE GROUP
   */

  function normalizePrizeGroup(prize = {}) {
    return {
      id: prize.id || createId(),

      position:
        prize.position !== undefined &&
        prize.position !== null
          ? prize.position
          : null,

      title: prize.title || "",

      rewards: Array.isArray(prize.rewards)
        ? prize.rewards.map(normalizeReward)
        : []
    };
  }

  /*
   * EMIT CHANGE
   */

  function emitChange() {
    if (typeof onChange === "function") {
      onChange(
        currentPrizes.map((prize) => ({
          ...prize,

          rewards: prize.rewards.map((reward) => ({
            ...reward
          }))
        }))
      );
    }
  }

  /*
   * REWARD TYPE LABEL
   */

  function getRewardTypeLabel(type) {
    const labels = {
      cash: "EFECTIVO",
      product: "PRODUCTO",
      gift_card: "GIFT CARD",
      trophy: "TROFEO",
      medal: "MEDALLA",
      sponsor: "PATROCINADOR",
      other: "OTRO"
    };

    return labels[type] || "PREMIO";
  }

  /*
   * CREATE REWARD
   */

  function createRewardElement(prize, reward) {
    const rewardElement = document.createElement("div");

    rewardElement.className =
      "prize-editor__reward";

    rewardElement.innerHTML = `
      <div class="prize-editor__reward-header">

        <span class="prize-editor__reward-type">
          ${getRewardTypeLabel(reward.type)}
        </span>

        <button
          type="button"
          class="prize-editor__remove-reward"
          data-remove-reward
        >
          ELIMINAR
        </button>

      </div>

      <div class="prize-editor__field">

        <label class="prize-editor__label">
          TIPO DE PREMIO
        </label>

        <select
          class="prize-editor__select"
          data-reward-type
        >
          <option value="cash">
            EFECTIVO
          </option>

          <option value="product">
            PRODUCTO
          </option>

          <option value="gift_card">
            GIFT CARD
          </option>

          <option value="trophy">
            TROFEO
          </option>

          <option value="medal">
            MEDALLA
          </option>

          <option value="sponsor">
            PATROCINADOR
          </option>

          <option value="other">
            OTRO
          </option>
        </select>

      </div>

      <div
        class="prize-editor__reward-fields"
        data-reward-fields
      ></div>
    `;

    const typeSelect =
      rewardElement.querySelector(
        "[data-reward-type]"
      );

    const fieldsContainer =
      rewardElement.querySelector(
        "[data-reward-fields]"
      );

    typeSelect.value = reward.type;

    /*
     * RENDER REWARD FIELDS
     */

    function renderRewardFields() {
      const type = reward.type;

      /*
       * CASH
       */

      if (type === "cash") {
        fieldsContainer.innerHTML = `
          <div class="prize-editor__field">

            <label class="prize-editor__label">
              MONTO
            </label>

            <input
              class="prize-editor__input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              data-reward-amount
            />

          </div>

          <div class="prize-editor__field">

            <label class="prize-editor__label">
              MONEDA
            </label>

            <select
              class="prize-editor__select"
              data-reward-currency
            >
              <option value="GTQ">
                GTQ — Quetzales
              </option>

              <option value="USD">
                USD — Dólares
              </option>
            </select>

          </div>

          <div class="prize-editor__field">

            <label class="prize-editor__label">
              DESCRIPCIÓN
            </label>

            <textarea
              class="prize-editor__textarea"
              rows="3"
              placeholder="Información adicional..."
              data-reward-description
            ></textarea>

          </div>
        `;
      }

      /*
       * OTHER REWARD TYPES
       */

      else {
        fieldsContainer.innerHTML = `
          <div class="prize-editor__field">

            <label class="prize-editor__label">
              NOMBRE
            </label>

            <input
              class="prize-editor__input"
              type="text"
              placeholder="Nombre del premio"
              data-reward-name
            />

          </div>

          <div class="prize-editor__field">

            <label class="prize-editor__label">
              DESCRIPCIÓN
            </label>

            <textarea
              class="prize-editor__textarea"
              rows="3"
              placeholder="Describe el premio..."
              data-reward-description
            ></textarea>

          </div>
        `;
      }

      const amountInput =
        fieldsContainer.querySelector(
          "[data-reward-amount]"
        );

      const currencySelect =
        fieldsContainer.querySelector(
          "[data-reward-currency]"
        );

      const nameInput =
        fieldsContainer.querySelector(
          "[data-reward-name]"
        );

      const descriptionInput =
        fieldsContainer.querySelector(
          "[data-reward-description]"
        );

      /*
       * AMOUNT
       */

      if (amountInput) {
        amountInput.value =
          reward.amount !== null
            ? reward.amount
            : "";

        amountInput.addEventListener(
          "input",
          (event) => {
            reward.amount =
              event.target.value === ""
                ? null
                : Number(event.target.value);

            emitChange();
          }
        );
      }

      /*
       * CURRENCY
       */

      if (currencySelect) {
        currencySelect.value =
          reward.currency || "GTQ";

        currencySelect.addEventListener(
          "change",
          (event) => {
            reward.currency =
              event.target.value;

            emitChange();
          }
        );
      }

      /*
       * NAME
       */

      if (nameInput) {
        nameInput.value =
          reward.name || "";

        nameInput.addEventListener(
          "input",
          (event) => {
            reward.name =
              event.target.value;

            emitChange();
          }
        );
      }

      /*
       * DESCRIPTION
       */

      if (descriptionInput) {
        descriptionInput.value =
          reward.description || "";

        descriptionInput.addEventListener(
          "input",
          (event) => {
            reward.description =
              event.target.value;

            emitChange();
          }
        );
      }
    }

    /*
     * CHANGE REWARD TYPE
     */

    typeSelect.addEventListener(
      "change",
      (event) => {
        reward.type =
          event.target.value;

        reward.name = "";

        reward.description = "";

        reward.amount = null;

        renderRewardFields();

        emitChange();
      }
    );

    /*
     * REMOVE REWARD
     */

    const removeButton =
      rewardElement.querySelector(
        "[data-remove-reward]"
      );

    removeButton.addEventListener(
      "click",
      () => {
        prize.rewards =
          prize.rewards.filter(
            (currentReward) =>
              currentReward.id !== reward.id
          );

        render();

        emitChange();
      }
    );

    renderRewardFields();

    return rewardElement;
  }

  /*
   * CREATE PRIZE GROUP
   */

  function createPrizeElement(prize) {
    const prizeElement =
      document.createElement("div");

    prizeElement.className =
      "prize-editor__group";

    const defaultTitle =
      prize.position !== null
        ? `${prize.position}º LUGAR`
        : "PREMIO ESPECIAL";

    prizeElement.innerHTML = `
      <div class="prize-editor__group-header">

        <div>

          <span class="prize-editor__group-number">
            ${defaultTitle}
          </span>

          <input
            class="prize-editor__title-input"
            type="text"
            placeholder="Nombre de la posición o premio"
            data-prize-title
          />

        </div>

        <button
          type="button"
          class="prize-editor__remove-group"
          data-remove-group
        >
          ELIMINAR
        </button>

      </div>

      <div
        class="prize-editor__rewards"
        data-prize-rewards
      ></div>

      <button
        type="button"
        class="prize-editor__add-reward"
        data-add-reward
      >
        + AGREGAR PREMIO
      </button>
    `;

    const titleInput =
      prizeElement.querySelector(
        "[data-prize-title]"
      );

    const rewardsContainer =
      prizeElement.querySelector(
        "[data-prize-rewards]"
      );

    titleInput.value =
      prize.title || "";

    titleInput.addEventListener(
      "input",
      (event) => {
        prize.title =
          event.target.value;

        emitChange();
      }
    );

    /*
     * RENDER REWARDS
     */

    function renderRewards() {
      rewardsContainer.innerHTML = "";

      prize.rewards.forEach(
        (reward) => {
          rewardsContainer.appendChild(
            createRewardElement(
              prize,
              reward
            )
          );
        }
      );
    }

    /*
     * ADD REWARD
     */

    const addRewardButton =
      prizeElement.querySelector(
        "[data-add-reward]"
      );

    addRewardButton.addEventListener(
      "click",
      () => {
        prize.rewards.push(
          normalizeReward()
        );

        renderRewards();

        emitChange();
      }
    );

    /*
     * REMOVE PRIZE GROUP
     */

    const removeGroupButton =
      prizeElement.querySelector(
        "[data-remove-group]"
      );

    removeGroupButton.addEventListener(
      "click",
      () => {
        currentPrizes =
          currentPrizes.filter(
            (currentPrize) =>
              currentPrize.id !== prize.id
          );

        render();

        emitChange();
      }
    );

    renderRewards();

    return prizeElement;
  }

  /*
   * RENDER EDITOR
   */

  function render() {
    container.innerHTML = "";

    const groupsContainer =
      document.createElement("div");

    groupsContainer.className =
      "prize-editor__groups";

    currentPrizes.forEach(
      (prize) => {
        groupsContainer.appendChild(
          createPrizeElement(prize)
        );
      }
    );

    container.appendChild(
      groupsContainer
    );

    /*
     * ADD POSITION / SPECIAL PRIZE
     */

    const addPositionButton =
      document.createElement("button");

    addPositionButton.type = "button";

    addPositionButton.className =
      "prize-editor__add-group";

    addPositionButton.textContent =
      "+ AGREGAR POSICIÓN / PREMIO ESPECIAL";

    addPositionButton.addEventListener(
      "click",
      () => {
        const positionPrizes =
          currentPrizes.filter(
            (prize) =>
              prize.position !== null
          );

        const nextPosition =
          positionPrizes.length > 0
            ? Math.max(
                ...positionPrizes.map(
                  (prize) =>
                    Number(prize.position)
                )
              ) + 1
            : 1;

        currentPrizes.push(
          normalizePrizeGroup({
            position: nextPosition,
            title: `${nextPosition}º lugar`
          })
        );

        render();

        emitChange();
      }
    );

    container.appendChild(
      addPositionButton
    );
  }

  render();

  return {
    element: container,

    getValue() {
      return currentPrizes.map(
        (prize) => ({
          ...prize,

          rewards: prize.rewards.map(
            (reward) => ({
              ...reward
            })
          )
        })
      );
    },

    setValue(newPrizes = []) {
      currentPrizes =
        Array.isArray(newPrizes)
          ? newPrizes.map(
              normalizePrizeGroup
            )
          : [];

      render();
    },

    addPrizeGroup({
      position = null,
      title = ""
    } = {}) {
      currentPrizes.push(
        normalizePrizeGroup({
          position,
          title
        })
      );

      render();

      emitChange();
    },

    refresh() {
      render();
    }
  };
}