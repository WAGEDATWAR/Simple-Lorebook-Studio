const dialog = document.querySelector("#confirm-dialog");
const titleElement = document.querySelector("#confirm-title");
const messageElement = document.querySelector("#confirm-message");
const acceptButton = document.querySelector("#confirm-accept");
const cancelButton = document.querySelector("#confirm-cancel");
const toastStack = document.querySelector("#toast-stack");

let settleConfirmation = null;

if (dialog) {
  dialog.addEventListener("close", () => {
    if (!settleConfirmation) {
      return;
    }

    const accepted = dialog.returnValue === "confirm";
    const settle = settleConfirmation;
    settleConfirmation = null;
    settle(accepted);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close("cancel");
    }
  });

  cancelButton.addEventListener("click", () => dialog.close("cancel"));
  acceptButton.addEventListener("click", () => dialog.close("confirm"));
}

export function confirmAction({
  title = "Confirm action",
  message = "",
  confirmLabel = "Confirm",
  tone = "danger"
} = {}) {
  if (!dialog) {
    return Promise.resolve(false);
  }

  if (settleConfirmation) {
    const settle = settleConfirmation;
    settleConfirmation = null;
    settle(false);
  }

  titleElement.textContent = title;
  messageElement.textContent = message;
  acceptButton.textContent = confirmLabel;
  acceptButton.className = tone === "primary" ? "btn btn-primary" : "btn btn-danger";
  dialog.returnValue = "cancel";

  return new Promise((resolve) => {
    settleConfirmation = resolve;
    dialog.showModal();
    acceptButton.focus();
  });
}

export function toast(message, tone = "default") {
  if (!toastStack) {
    return;
  }

  const element = document.createElement("div");
  element.className = `toast toast-${tone}`;
  element.textContent = message;
  toastStack.append(element);

  requestAnimationFrame(() => element.classList.add("is-visible"));

  window.setTimeout(() => {
    element.classList.remove("is-visible");
    window.setTimeout(() => element.remove(), 250);
  }, 3000);
}
