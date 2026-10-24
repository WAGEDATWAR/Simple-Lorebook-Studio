import { isRegexKey, parseRegexKey } from "../keys.js";

function splitKeys(text) {
  return String(text ?? "")
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function createKeyChips({ container, input, onChange, label = "key", regex = true }) {
  let keys = [];
  let editingIndex = -1;

  function emit() {
    onChange([...keys]);
  }

  function focusInput() {
    input.focus();
  }

  function commitText(text) {
    const additions = splitKeys(text);
    let changed = false;

    for (const value of additions) {
      if (keys.includes(value)) {
        continue;
      }

      keys.push(value);
      changed = true;
    }

    if (changed) {
      editingIndex = -1;
      render();
      emit();
    }

    return changed;
  }

  function removeAt(index) {
    if (index < 0 || index >= keys.length) {
      return;
    }

    keys.splice(index, 1);
    editingIndex = -1;
    render();
    emit();
  }

  function commitEdit(index, value) {
    const next = value.trim();

    if (!next) {
      removeAt(index);
      return;
    }

    const withoutCurrent = keys.filter((key, keyIndex) => keyIndex !== index);

    if (withoutCurrent.includes(next)) {
      keys = withoutCurrent;
    } else {
      keys = [...withoutCurrent];
      keys.splice(index, 0, next);
    }

    editingIndex = -1;
    render();
    emit();
    focusInput();
  }

  function createChip(key, index) {
    const chip = document.createElement("span");
    const text = document.createElement("span");
    const remove = document.createElement("button");

    chip.className = "key-chip";

    if (regex && isRegexKey(key)) {
      const parsed = parseRegexKey(key);
      chip.classList.add(parsed.ok ? "is-regex" : "is-regex-invalid");
      chip.title = parsed.ok
        ? `Regular expression: /${parsed.pattern}/${parsed.flags}`
        : `Invalid regex, treated as plain text: ${parsed.error}`;
    }

    text.className = "key-chip-text";
    text.textContent = key;
    remove.type = "button";
    remove.className = "key-chip-remove";
    remove.setAttribute("aria-label", `Remove ${label} ${key}`);
    remove.textContent = "\u00d7";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      removeAt(index);
      focusInput();
    });

    chip.append(text, remove);
    chip.addEventListener("dblclick", () => {
      editingIndex = index;
      render();
    });

    return chip;
  }

  function createEditor(key, index) {
    const editor = document.createElement("input");
    editor.type = "text";
    editor.className = "key-chip-editor";
    editor.value = key;
    editor.setAttribute("aria-label", `Edit ${label}`);

    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdit(index, editor.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        editingIndex = -1;
        render();
        focusInput();
      }
    });

    editor.addEventListener("blur", () => {
      if (editingIndex === index) {
        commitEdit(index, editor.value);
      }
    });

    return editor;
  }

  function render() {
    container.replaceChildren();
    let editor = null;

    keys.forEach((key, index) => {
      if (index === editingIndex) {
        editor = createEditor(key, index);
        container.append(editor);
      } else {
        container.append(createChip(key, index));
      }
    });

    container.append(input);

    if (editor) {
      editor.focus();
      editor.select();
    }
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();

      if (commitText(input.value)) {
        input.value = "";
      }

      return;
    }

    if (event.key === "Backspace" && !input.value && keys.length) {
      event.preventDefault();
      removeAt(keys.length - 1);
      focusInput();
      return;
    }

    if (event.key === "Escape") {
      input.value = "";
    }
  });

  input.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text");

    if (!text) {
      return;
    }

    event.preventDefault();

    if (commitText(text)) {
      input.value = "";
    }
  });

  input.addEventListener("blur", () => {
    if (input.value.trim()) {
      commitText(input.value);
      input.value = "";
    }
  });

  container.addEventListener("click", (event) => {
    if (event.target === container) {
      focusInput();
    }
  });

  return {
    setKeys(next) {
      keys = Array.isArray(next) ? [...next] : [];
      editingIndex = -1;
      render();
    },
    getKeys() {
      return [...keys];
    },
    focus: focusInput
  };
}
