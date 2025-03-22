const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { PythonShell } = require("python-shell");
const Store = require("electron-store");
const store = new Store();
const fs = require("fs");

let mainWindow;

// Add this near the top of your main.js file to redirect main process logs to the renderer
ipcMain.on("ready", () => {
  const oldConsoleLog = console.log;
  console.log = (...args) => {
    oldConsoleLog(...args);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("main-process-log", args);
    }
  };

  // Do the same for console.error
  const oldConsoleError = console.error;
  console.error = (...args) => {
    oldConsoleError(...args);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("main-process-error", args);
    }
  };
});

app.on("ready", () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 750,
    minWidth: 800,
    minHeight: 750,
    // Use preload.js scripts and contextBridge.exposeInMainWorld()
    // to safely expose specific IPC functions to the renderer.
    // This is the recommended secure approach, creating a controlled
    //  bridge between main and renderer processes.

    // Chat: I want to ready this for production using the following advice:
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("frontend/index.html");
  mainWindow.webContents.openDevTools();
});

app.on("window-all-closed", () => {
  app.quit();
});

function runExecutable(args) {
  return new Promise((resolve, reject) => {
    let executablePath;

    if (process.env.NODE_ENV === "development") {
      executablePath =
        process.platform === "darwin"
          ? path.join(__dirname, "dist", "Youtube-Downloader")
          : path.join(__dirname, "dist", "Youtube-Downloader.exe");
    } else {
      executablePath =
        process.platform === "darwin"
          ? path.join(process.resourcesPath, "Youtube-Downloader")
          : path.join(process.resourcesPath, "Youtube-Downloader.exe");
    }

    console.log("[DEBUG] Environment:", process.env.NODE_ENV);
    console.log("[DEBUG] Platform:", process.platform);
    console.log("[DEBUG] Executable Path:", executablePath);
    console.log("[DEBUG] __dirname:", __dirname);
    console.log("[DEBUG] resourcesPath:", process.resourcesPath);

    // Check if executable exists
    if (!fs.existsSync(executablePath)) {
      console.error(`[ERROR] Executable not found at path: ${executablePath}`);
      reject(new Error(`Executable not found at path: ${executablePath}`));
      return;
    }

    const { spawn } = require("child_process");

    // Create environment with proper PATH to find ffmpeg
    const env = { ...process.env };

    // Add common ffmpeg locations to PATH based on platform
    if (process.platform === "darwin") {
      // macOS common ffmpeg locations
      env.PATH = [
        env.PATH,
        "/usr/local/bin",
        "/opt/homebrew/bin",
        "/opt/local/bin",
        path.dirname(executablePath), // Look in same directory as executable
      ].join(":");

      // If bundled with app, make it accessible
      if (process.env.NODE_ENV !== "development") {
        // Check resource path for bundled ffmpeg
        const resourceFfmpeg = path.join(process.resourcesPath, "ffmpeg");
        if (fs.existsSync(resourceFfmpeg)) {
          env.PATH = `${path.dirname(resourceFfmpeg)}:${env.PATH}`;
        }
      }
    } else if (process.platform === "win32") {
      // Windows paths use semicolons
      env.PATH = [
        env.PATH,
        "C:\\ffmpeg\\bin",
        path.dirname(executablePath),
      ].join(";");

      // If bundled, look in resources
      if (process.env.NODE_ENV !== "development") {
        const resourceFfmpeg = path.join(process.resourcesPath, "ffmpeg.exe");
        if (fs.existsSync(resourceFfmpeg)) {
          env.PATH = `${path.dirname(resourceFfmpeg)};${env.PATH}`;
        }
      }
    }

    console.log("[DEBUG] PATH for subprocess:", env.PATH);

    const childProcess = spawn(executablePath, args, {
      // Add stdio configuration for better error capture
      stdio: ["pipe", "pipe", "pipe"],
      env: env,
    });

    let stdoutData = [];
    let stderrData = [];

    childProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log("[Executable stdout]:", output);
      stdoutData.push(output);
    });

    childProcess.stderr.on("data", (data) => {
      const error = data.toString();
      console.error("[Executable stderr]:", error);
      stderrData.push(error);
    });

    childProcess.on("close", (code) => {
      console.log("[DEBUG] Process exited with code:", code);
      if (code === 0) {
        resolve(stdoutData);
      } else {
        const errorMessage =
          stderrData.join("\n") || `Process exited with code ${code}`;
        console.error("[ERROR] Process failed:", errorMessage);
        reject(new Error(errorMessage));
      }
    });

    childProcess.on("error", (err) => {
      console.error("[ERROR] Failed to start process:", err);
      reject(err);
    });
  });
}

ipcMain.on("download-audio", async (event, url) => {
  try {
    const downloadFolder =
      store.get("downloadFolder") ||
      path.join(__dirname, "frontend", "downloads");

    console.log("[DEBUG] Download attempt:", {
      url,
      downloadFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await runExecutable([url, downloadFolder]);
    console.log("[DEBUG] Download success:", result);
    event.sender.send("download-complete", result);
  } catch (err) {
    // Log detailed error to console
    console.error("[ERROR] Download failed:", {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });

    // // Also log the raw error for better debugging
    // console.error("[ERROR] Raw error output:", err);

    // Send the error to the frontend
    event.sender.send("download-error", err.message);
  }
});

ipcMain.on("drag-file", (event, filePath) => {
  console.log("[DEBUG] Dragging file:", filePath);
  event.sender.startDrag({
    file: filePath,
    icon: path.join(__dirname, "frontend", "src", "drag-icon.png"),
  });
});

ipcMain.on("select-folder", async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose Download Folder",
    defaultPath:
      store.get("downloadFolder") || path.join(__dirname, "downloads"),
    properties: ["openDirectory", "createDirectory"],
  });

  if (!result.canceled) {
    event.sender.send("folder-selected", result.filePaths[0]);
  }
});


