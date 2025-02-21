const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { PythonShell } = require("python-shell");
const Store = require("electron-store");
const store = new Store();

let mainWindow;

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
});

app.on("window-all-closed", () => {
  app.quit();
});

function runPythonScript(scriptPath, args) {
  let options = {
    mode: "text",
    pythonPath: "python",
    pythonOptions: ["-u"], // unbuffered output
    scriptPath: path.join(__dirname, "python_scripts"),
    args: args,
  };

  return new Promise((resolve, reject) => {
    let pyshell = new PythonShell(scriptPath, options);
    let output = [];

    pyshell.on("message", function (message) {
      output.push(message);
    });

    pyshell.on("error", function (err) {
      reject(err);
    });

    pyshell.end(function (err) {
      if (err) reject(err);
      resolve(output);
    });
  });
}

ipcMain.on("download-audio", async (event, url) => {
  try {
    const downloadFolder =
      store.get("downloadFolder") ||
      path.join(__dirname, "frontend", "downloads");
    const result = await runPythonScript("youtube_downloader.py", [
      url,
      downloadFolder,
    ]);
    event.sender.send("download-complete", result);
  } catch (err) {
    console.error(err);
    event.sender.send("download-error", err.message);
  }
});

ipcMain.on("drag-file", (event, filePath) => {
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
