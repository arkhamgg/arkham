export function ContactSupportSelector({
  value = null,
  onChange = null
} = {}) {
  const container = document.createElement("div");

  container.className = "contact-support-selector";

  let currentValue = {
    channels: []
  };

  if (value && typeof value === "object") {
    currentValue = {
      ...currentValue,
      ...value
    };
  }

  const channelTypes = [
    {
      type: "email",
      label: "CORREO ELECTRÓNICO",
      placeholder: "correo@ejemplo.com",
      inputType: "email"
    },
    {
      type: "whatsapp",
      label: "WHATSAPP",
      placeholder: "+502 0000-0000",
      inputType: "tel"
    },
    {
      type: "discord",
      label: "DISCORD",
      placeholder: "https://discord.gg/...",
      inputType: "url"
    },
    {
      type: "instagram",
      label: "INSTAGRAM",
      placeholder: "@usuario",
      inputType: "text"
    },
    {
      type: "facebook",
      label: "FACEBOOK",
      placeholder: "https://facebook.com/...",
      inputType: "url"
    },
    {
      type: "telegram",
      label: "TELEGRAM",
      placeholder: "https://t.me/...",
      inputType: "url"
    },
    {
      type: "tiktok",
      label: "TIKTOK",
      placeholder: "@usuario",
      inputType: "text"
    },
    {
      type: "other",
      label: "OTRO",
      placeholder: "Información de contacto",
      inputType: "text"
    }
  ];

  function emitChange() {
    if (typeof onChange === "function") {
      onChange({
        channels: currentValue.channels.map((channel) => ({
          ...channel
        }))
      });
    }
  }

  function getChannel(type) {
    return currentValue.channels.find(
      (channel) => channel.type === type
    );
  }

  function addChannel(type) {
    if (getChannel(type)) return;

    currentValue.channels.push({
      type,
      value: ""
    });

    render();
    emitChange();
  }

  function removeChannel(type) {
    currentValue.channels =
      currentValue.channels.filter(
        (channel) => channel.type !== type
      );

    render();
    emitChange();
  }

  function render() {
    container.innerHTML = "";

    const description =
      document.createElement("p");

    description.className =
      "contact-support-selector__description";

    description.textContent =
      "Selecciona los medios mediante los cuales los participantes pueden comunicarse para resolver dudas sobre el torneo.";

    container.appendChild(description);

    const channelsSelector =
      document.createElement("div");

    channelsSelector.className =
      "contact-support-selector__channels";

    channelTypes.forEach((channel) => {
      const isSelected =
        Boolean(getChannel(channel.type));

      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "contact-support-selector__channel";

      if (isSelected) {
        button.classList.add(
          "contact-support-selector__channel--active"
        );
      }

      button.textContent = channel.label;

      button.addEventListener("click", () => {
        if (getChannel(channel.type)) {
          removeChannel(channel.type);
        } else {
          addChannel(channel.type);
        }
      });

      channelsSelector.appendChild(button);
    });

    container.appendChild(channelsSelector);

    const fields =
      document.createElement("div");

    fields.className =
      "contact-support-selector__fields";

    currentValue.channels.forEach(
      (channel) => {
        const configuration =
          channelTypes.find(
            (item) =>
              item.type === channel.type
          );

        if (!configuration) return;

        const field =
          document.createElement("div");

        field.className =
          "contact-support-selector__field";

        field.innerHTML = `
          <div class="contact-support-selector__field-header">
            <label
              class="contact-support-selector__label"
            >
              ${configuration.label}
            </label>

            <button
              type="button"
              class="contact-support-selector__remove"
              data-remove-channel
            >
              ELIMINAR
            </button>
          </div>

          <input
            class="contact-support-selector__input"
            type="${configuration.inputType}"
            placeholder="${configuration.placeholder}"
          />
        `;

        const input =
          field.querySelector(
            ".contact-support-selector__input"
          );

        input.value =
          channel.value || "";

        input.addEventListener(
          "input",
          (event) => {
            channel.value =
              event.target.value;

            emitChange();
          }
        );

        const removeButton =
          field.querySelector(
            "[data-remove-channel]"
          );

        removeButton.addEventListener(
          "click",
          () => {
            removeChannel(channel.type);
          }
        );

        fields.appendChild(field);
      }
    );

    container.appendChild(fields);
  }

  render();

  return {
    element: container,

    getValue() {
      return {
        channels:
          currentValue.channels.map(
            (channel) => ({
              ...channel
            })
          )
      };
    },

    setValue(newValue = null) {
      currentValue = {
        channels: []
      };

      if (
        newValue &&
        Array.isArray(newValue.channels)
      ) {
        currentValue.channels =
          newValue.channels.map(
            (channel) => ({
              type: channel.type || "other",
              value: channel.value || ""
            })
          );
      }

      render();
    },

    addChannel(type) {
      addChannel(type);
    },

    removeChannel(type) {
      removeChannel(type);
    },

    refresh() {
      render();
    }
  };
}