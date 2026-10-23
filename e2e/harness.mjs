import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function which(command) {
  const locator = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(locator, [command], { encoding: "utf8" });

  if (result.status !== 0) {
    return "";
  }

  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

const WINDOWS_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PROGRAMFILES ? join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe") : "",
  process.env["PROGRAMFILES(X86)"] ? join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe") : "",
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : "",
  process.env["PROGRAMFILES(X86)"] ? join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe") : "",
  process.env.PROGRAMFILES ? join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe") : ""
];

export function findBrowser() {
  const candidates = process.platform === "win32"
    ? WINDOWS_CANDIDATES
    : process.platform === "darwin"
      ? [
        process.env.CHROME_PATH,
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium"
      ]
      : [process.env.CHROME_PATH, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (candidate.includes("/") || candidate.includes("\\")) {
      if (existsSync(candidate)) {
        return candidate;
      }
    } else {
      const resolved = which(candidate);

      if (resolved) {
        return resolved;
      }
    }
  }

  throw new Error("Could not find Chrome or Chromium. Set the CHROME_PATH environment variable.");
}

async function waitForDevToolsPort(userDataDir, child) {
  const portFile = join(userDataDir, "DevToolsActivePort");

  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Browser exited before DevTools was ready (code ${child.exitCode}).`);
    }

    if (existsSync(portFile)) {
      const content = await readFile(portFile, "utf8");
      const port = Number(content.split("\n")[0]);

      if (Number.isInteger(port) && port > 0) {
        return port;
      }
    }

    await sleep(100);
  }

  throw new Error("Timed out waiting for the browser DevTools port.");
}

export async function launchBrowser({ browserPath, headless = true, args = [] } = {}) {
  const executable = browserPath ?? findBrowser();
  const userDataDir = await mkdtemp(join(tmpdir(), "lorebook-e2e-"));
  const browserArgs = [
    headless ? "--headless=new" : "",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--mute-audio",
    "--no-sandbox",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "--window-size=1440,900",
    ...args,
    "about:blank"
  ].filter(Boolean);
  const child = spawn(executable, browserArgs, { stdio: ["ignore", "ignore", "pipe"] });
  const port = await waitForDevToolsPort(userDataDir, child);

  return {
    child,
    port,
    userDataDir,
    async close() {
      if (child.exitCode === null) {
        child.kill();

        if (process.platform === "win32" && child.pid) {
          spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        }

        await sleep(200);
      }

      await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    }
  };
}

export class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
        return;
      }

      if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) {
          listener(message.params);
        }
      }
    });
  }

  static async connect(webSocketUrl) {
    const socket = new WebSocket(webSocketUrl);

    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", () => reject(new Error("Failed to connect to the browser DevTools socket.")), { once: true });
    });

    return new CdpClient(socket);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  on(method, listener) {
    if (!this.listeners.has(method)) {
      this.listeners.set(method, []);
    }

    this.listeners.get(method).push(listener);
  }

  off(method, listener) {
    const listeners = this.listeners.get(method);

    if (!listeners) {
      return;
    }

    const index = listeners.indexOf(listener);

    if (index >= 0) {
      listeners.splice(index, 1);
    }
  }

  once(method) {
    return new Promise((resolve) => {
      const listener = (params) => {
        this.off(method, listener);
        resolve(params);
      };

      this.on(method, listener);
    });
  }

  close() {
    this.socket.close();
  }
}

export class Page {
  constructor(client) {
    this.client = client;
    this.errors = [];
    this.consoleErrors = [];
    this.lastUrl = "about:blank";

    client.on("Runtime.exceptionThrown", (params) => {
      const details = params?.exceptionDetails;
      this.errors.push(details?.exception?.description || details?.text || "Uncaught exception");
    });

    client.on("Runtime.consoleAPICalled", (params) => {
      if (params?.type === "error") {
        this.consoleErrors.push((params.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" "));
      }
    });

    client.on("Page.javascriptDialogOpening", () => {
      client.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
    });
  }

  static async open(port) {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    const target = targets.find((item) => item.type === "page") ?? targets[0];

    if (!target?.webSocketDebuggerUrl) {
      throw new Error("The browser did not expose a page target.");
    }

    const client = await CdpClient.connect(target.webSocketDebuggerUrl);
    const page = new Page(client);
    await page.enable();
    return page;
  }

  async enable() {
    await this.client.send("Page.enable");
    await this.client.send("Runtime.enable");
    await this.client.send("DOM.enable");
  }

  async evaluate(expression) {
    const result = await this.client.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }

    return result.result.value;
  }

  async waitFor(expression, { timeout = 8000, interval = 50 } = {}) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (await this.evaluate(`Boolean(${expression})`)) {
        return true;
      }

      await sleep(interval);
    }

    throw new Error(`Timed out waiting for: ${expression}`);
  }

  async navigate(url) {
    const loaded = this.client.once("Page.loadEventFired");
    await this.client.send("Page.navigate", { url });
    await loaded;
    this.lastUrl = url;
    await this.waitFor("document.readyState === 'complete'");
  }

  async reload() {
    const loaded = this.client.once("Page.loadEventFired");
    await this.client.send("Page.reload", { ignoreCache: true });
    await loaded;
    await this.waitFor("document.readyState === 'complete'");
  }

  async setViewport(width, height) {
    await this.client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    });
  }

  async click(selector) {
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  }

  async setFileInput(selector, files) {
    const document = await this.client.send("DOM.getDocument", { depth: -1 });
    const node = await this.client.send("DOM.querySelector", { nodeId: document.root.nodeId, selector });
    await this.client.send("DOM.setFileInputFiles", { files, nodeId: node.nodeId });
  }

  async screenshot(path) {
    const result = await this.client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    await writeFile(path, Buffer.from(result.data, "base64"));
  }

  async resetStorage({ seed = null } = {}) {
    const appUrl = this.lastUrl;
    const origin = new URL(appUrl).origin;

    // Clear all origin storage (including IndexedDB) from a blank page so the
    // app's unload handlers cannot repopulate it during the navigation.
    await this.navigate("about:blank");

    try {
      await this.client.send("Storage.clearDataForOrigin", { origin, storageTypes: "all" });
    } catch {
      // Fall back to clearing localStorage only when the Storage domain is unavailable.
      await this.navigate(appUrl);
      await this.evaluate(`(() => {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("lorebook-studio:")) localStorage.removeItem(key);
        }
        return true;
      })()`);
      return;
    }

    if (!seed) {
      await this.navigate(appUrl);
      return;
    }

    const script = await this.client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        localStorage.setItem("lorebook-studio:project:v1", ${JSON.stringify(JSON.stringify(seed))});
      })();`
    });

    await this.navigate(appUrl);
    await this.client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: script.identifier });
  }

  clearErrors() {
    this.errors = [];
    this.consoleErrors = [];
  }

  close() {
    this.client.close();
  }
}

export { sleep };
