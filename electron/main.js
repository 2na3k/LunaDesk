// Electron main process for LunaDesk.
//
// In production the packaged app ships the Next.js "standalone" server bundle.
// We spawn that Node server as a child process on a free port and load it in a
// BrowserWindow. In dev (`npm run electron:dev`) we simply attach to the running
// `next dev` server on port 3000.

const { app, BrowserWindow, shell, utilityProcess } = require("electron");
const path = require("node:path");
const http = require("node:http");
const net = require("node:net");

const isDev = !app.isPackaged;
let serverProcess = null;
let mainWindow = null;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error("Server did not start in time"));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

async function startNextServer() {
  if (isDev) {
    return "http://localhost:3000";
  }
  const port = await getFreePort();
  // The standalone build lives next to the packaged resources.
  const serverEntry = path.join(process.resourcesPath, "app", "server.js");
  // The Electron helper stays out of the Dock. Launching process.execPath
  // here registers another copy of the main app with macOS Launch Services.
  serverProcess = utilityProcess.fork(serverEntry, [], {
    serviceName: "LunaDesk Server",
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      NEXT_PUBLIC_DESKTOP: "1",
      LUNA_WORKSPACE_STORE: path.join(app.getPath("userData"), "workspace.json"),
    },
    stdio: "inherit",
  });
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

async function createWindow() {
  const icon = path.join(__dirname, "assets", "icon.png");
  // Set the running Dock icon too, including development and cached macOS installs.
  if (process.platform === "darwin") app.dock.setIcon(icon);
  mainWindow = new BrowserWindow({
    icon,
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#151515",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Open external links in the user's browser (important for OAuth URLs).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const url = await startNextServer();
  await mainWindow.loadURL(url);
  mainWindow.on("closed", () => (mainWindow = null));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      /* ignore */
    }
  }
});
