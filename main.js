const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fetch = require('electron-fetch').default;

let mainWindow;
let ws;

function setupWebSocket() {
  const WebSocket = require('ws');
  ws = new WebSocket("ws://localhost:8000/ws", {
    handshakeTimeout: 1000, // 1 second timeout
  });
  
  ws.on('message', (data) => {
    if (!mainWindow) return;
    
    try {
      const progress = JSON.parse(data.toString());
      mainWindow.webContents.send("websocket-message", progress);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      mainWindow.webContents.send("websocket-error", error.message);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    if (mainWindow) {
      mainWindow.webContents.send("websocket-error", error.message);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed. Retrying in 5 seconds...');
    if (mainWindow) {
      mainWindow.webContents.send("websocket-status", "disconnected");
    }
    setTimeout(setupWebSocket, 5000);
  });

  ws.on('open', () => {
    if (mainWindow) {
      mainWindow.webContents.send("websocket-status", "connected");
    }
  });
}

app.on("ready", () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("frontend/index.html");
  setupWebSocket();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.on("download-audio", async (event, url) => {
  try {
    const response = await fetch('http://localhost:5000/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url,
        downloadDir: path.join(__dirname, 'frontend', 'downloads')
      })
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      event.sender.send("download-complete", data.file_path);
    } else {
      throw new Error(data.message);
    }
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
