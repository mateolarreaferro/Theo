const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

let pythonProcess = null;
let mainWindow = null;

const BACKEND_PORT = 8420;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const isDev = !app.isPackaged;

function spawnBackend() {
  const serverPath = path.join(__dirname, "..", "backend", "server.py");
  pythonProcess = spawn("python3", [serverPath], {
    cwd: path.join(__dirname, "..", "backend"),
    stdio: ["pipe", "pipe", "pipe"],
  });

  pythonProcess.stdout.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`[backend] ${data.toString().trim()}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`[backend] exited with code ${code}`);
    pythonProcess = null;
  });
}

function waitForBackend(retries = 30) {
  return new Promise((resolve, reject) => {
    function check(n) {
      if (n <= 0) return reject(new Error("Backend failed to start"));
      http
        .get(`${BACKEND_URL}/health`, (res) => {
          if (res.statusCode === 200) resolve();
          else setTimeout(() => check(n - 1), 500);
        })
        .on("error", () => setTimeout(() => check(n - 1), 500));
    }
    check(retries);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Theo",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

// IPC handlers for file dialogs
ipcMain.handle("dialog:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: "Theo Files", extensions: ["theo"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, "utf-8");
  return { path: filePath, content };
});

ipcMain.handle("dialog:save", async (_, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: "Theo Files", extensions: ["theo"] }],
  });
  if (result.canceled) return null;
  fs.writeFileSync(result.filePath, content, "utf-8");
  return result.filePath;
});

app.whenReady().then(async () => {
  spawnBackend();
  try {
    await waitForBackend();
    console.log("[main] Backend ready");
  } catch (e) {
    console.error("[main] Backend failed to start:", e.message);
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
});
