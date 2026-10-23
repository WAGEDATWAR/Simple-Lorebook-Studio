import { filterCommands } from "../commands.js";

const dialog = document.querySelector("#command-dialog");
const input = document.querySelector("#command-input");
const list = document.querySelector("#command-list");
const empty = document.querySelector("#command-empty");

let commands = [];
let filtered = [];
let activeIndex = 0;

function optionId(index) {
  return `command-option-${index}`;
}

function render() {
  list.replaceChildren();

  if (!filtered.length) {
    input.setAttribute("aria-activedescendant", "");
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  const fragment = document.createDocumentFragment();

  filtered.forEach((command, index) => {
    const option = document.createElement("button");
    const title = document.createElement("span");
    const hint = document.createElement("span");

    option.type = "button";
    option.className = "command-option";
    option.id = optionId(index);
    option.dataset.commandIndex = String(index);
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === activeIndex));

    if (index === activeIndex) {
      option.classList.add("is-active");
    }

    title.className = "command-option-title";
    title.textContent = command.title;
    option.append(title);

    if (command.hint) {
      hint.className = "command-option-hint";
      hint.textContent = command.hint;
      option.append(hint);
    }

    fragment.append(option);
  });

  list.append(fragment);
  input.setAttribute("aria-activedescendant", optionId(activeIndex));
  list.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
}

function setActive(index) {
  if (!filtered.length) {
    return;
  }

  activeIndex = (index + filtered.length) % filtered.length;
  render();
}

function applyFilter() {
  filtered = filterCommands(commands, input.value);
  activeIndex = 0;
  render();
}

function runAt(index) {
  const command = filtered[index];

  if (!command) {
    return;
  }

  dialog.close();
  command.run();
}

export function openCommandPalette(nextCommands) {
  if (!dialog) {
    return;
  }

  commands = Array.isArray(nextCommands) ? nextCommands.filter(Boolean) : [];
  input.value = "";
  applyFilter();

  if (!dialog.open) {
    dialog.showModal();
  }

  input.focus();
  input.select();
}

if (dialog) {
  input.addEventListener("input", applyFilter);

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(filtered.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      runAt(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
    }
  });

  list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-command-index]");

    if (option) {
      runAt(Number(option.dataset.commandIndex));
    }
  });

  list.addEventListener("mousemove", (event) => {
    const option = event.target.closest("[data-command-index]");

    if (option) {
      const index = Number(option.dataset.commandIndex);

      if (index !== activeIndex) {
        setActive(index);
      }
    }
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
}
