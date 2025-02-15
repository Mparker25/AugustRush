const { ipcRenderer } = require("electron");
const path = require("path");
const fs = require("fs");
const { parseFile } = require("music-metadata");
const Store = require("electron-store");
const store = new Store();

// Load files when the page loads
document.addEventListener("DOMContentLoaded", loadDownloadedFiles);

document.getElementById("download").addEventListener("click", () => {
  const url = document.getElementById("url").value;
  const statusMessage = document.getElementById("status-message");
  statusMessage.className = "status-message started";
  statusMessage.textContent = "Download started...";
  statusMessage.style.display = "block";
  ipcRenderer.send("download-audio", url);
});

document.getElementById("select-folder").addEventListener("click", () => {
  ipcRenderer.send("select-folder");
});

document.getElementById("reset-folder").addEventListener("click", () => {
  // Clear the stored folder setting
  store.delete("downloadFolder");
  // Update display and reload files
  updateCurrentFolderDisplay();
  loadDownloadedFiles();
});

ipcRenderer.on("folder-selected", (event, folderPath) => {
  if (folderPath) {
    store.set("downloadFolder", folderPath);
    updateCurrentFolderDisplay();
    loadDownloadedFiles();
  }
});

ipcRenderer.on("download-complete", (event, filePath) => {
  // Just reload the files table
  console.log("Download complete", filePath);
  const statusMessage = document.getElementById("status-message");
  statusMessage.className = "status-message finished";
  statusMessage.textContent = "Download complete!";
  setTimeout(() => {
    statusMessage.style.display = "none";
  }, 5000);
  loadDownloadedFiles();
});

ipcRenderer.on("download-error", (event, errorMessage) => {
  const statusMessage = document.getElementById("status-message");
  statusMessage.className = "status-message error";
  statusMessage.textContent = `Error: ${errorMessage}`;
  // Hide error after 5 seconds
  setTimeout(() => {
    statusMessage.style.display = "none";
  }, 5000);
});

// Function to format duration in seconds to MM:SS
function formatDuration(seconds) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Audio player functionality
let currentAudio = null;
let currentPlayButton = null;
let currentPauseButton = null;

// Add click handlers after creating the table rows
function addAudioHandlers() {
  document.querySelectorAll(".play-button").forEach((button) => {
    button.addEventListener("click", () => {
      const filePath = button.dataset.path;
      const pauseButton = button.nextElementSibling;

      // If there's already something playing, stop it
      if (currentAudio) {
        currentAudio.pause();
        if (currentPlayButton) currentPlayButton.style.display = "inline";
        if (currentPauseButton) currentPauseButton.style.display = "none";
      }

      // If we're clicking the same button that was playing, just stop
      if (currentPlayButton === button) {
        currentAudio = null;
        currentPlayButton = null;
        currentPauseButton = null;
        return;
      }

      // Play the new audio
      currentAudio = new Audio(filePath);
      currentAudio.play();
      currentPlayButton = button;
      currentPauseButton = pauseButton;

      // Show/hide appropriate buttons
      button.style.display = "none";
      pauseButton.style.display = "inline";

      // When audio ends
      currentAudio.onended = () => {
        button.style.display = "inline";
        pauseButton.style.display = "none";
        currentAudio = null;
        currentPlayButton = null;
        currentPauseButton = null;
      };
    });
  });

  document.querySelectorAll(".pause-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (currentAudio) {
        currentAudio.pause();
        button.style.display = "none";
        button.previousElementSibling.style.display = "inline";
        currentAudio = null;
        currentPlayButton = null;
        currentPauseButton = null;
      }
    });
  });
}

// Helper function to create row HTML
function createRowHTML(filePath, metadata = null) {
    const fileName = path.parse(filePath).name;
    const escapedPath = filePath.replace(/'/g, "\\'");
    
    const buttonControls = `
        <button class="play-button" data-path="${escapedPath}">Play</button>
        <button class="pause-button" style="display: none;" data-path="${escapedPath}">Pause</button>
        <button class="delete-button" data-path="${filePath}">Delete</button>
    `;

    if (metadata) {
        return `
            <td>${metadata.common.artist || ""}</td>
            <td>${metadata.common.title || fileName}</td>
            <td>${formatDuration(metadata.format.duration)}</td>
            <td>${metadata.common.key || ""}</td>
            <td>${metadata.common.bpm || ""}</td>
            <td>${buttonControls}</td>
        `;
    }

    return `
        <td></td>
        <td>${fileName}</td>
        <td></td>
        <td></td>
        <td></td>
        <td>${buttonControls}</td>
    `;
}

// Helper function to create and setup a table row
function createTableRow(filePath) {
    const row = document.createElement("tr");
    row.draggable = true;
    row.dataset.path = filePath.replace(/'/g, "\\'");
    return row;
}

// Function to load and display downloaded files
async function loadDownloadedFiles() {
  const downloadsPath =
    store.get("downloadFolder") || path.join(__dirname, "downloads");
  const tableBody = document.getElementById("downloads-body");
  tableBody.innerHTML = ""; // Clear existing rows

  try {
    // Create downloads directory if it doesn't exist
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
      return;
    }

    const files = fs
      .readdirSync(downloadsPath)
      .filter((file) => file.endsWith(".mp3")); // Filter for MP3 files

    for (const file of files) {
      const filePath = path.join(downloadsPath, file);
      const row = createTableRow(filePath);

      try {
        // Parse metadata from the audio file
        const metadata = await parseFile(filePath);
        row.innerHTML = createRowHTML(filePath, metadata);
      } catch (err) {
        console.error(`Error parsing metadata for ${file}:`, err);
        row.innerHTML = createRowHTML(filePath);
      }

      tableBody.appendChild(row);
    }

    // After all rows are added, add the audio handlers
    addAudioHandlers();

    // Replace the drag-handle event listeners with row drag events
    document.querySelectorAll("#downloads-body tr").forEach((row) => {
      row.addEventListener("dragstart", (event) => {
        event.preventDefault();
        const filePath = row.dataset.path;
        ipcRenderer.send("drag-file", filePath);
      });

      // Prevent drag interference from buttons
      row.querySelectorAll("button").forEach((button) => {
        button.addEventListener("mousedown", (e) => {
          e.stopPropagation();
        });
      });
    });

    // Add delete handlers
    document.querySelectorAll(".delete-button").forEach((button) => {
      button.addEventListener("click", () => {
        const filePath = button.dataset.path;
        if (confirm("Are you sure you want to delete this file?")) {
          try {
            // If this file is currently playing, stop it
            if (currentAudio && currentAudio.src.includes(filePath)) {
              currentAudio.pause();
              currentAudio = null;
              currentPlayButton = null;
              currentPauseButton = null;
            }
            fs.unlinkSync(filePath);
            button.closest("tr").remove();
          } catch (err) {
            console.error("Error deleting file:", err);
            alert("Error deleting file");
          }
        }
      });
    });
  } catch (err) {
    console.error("Error loading downloaded files:", err);
  }
}

// Reload files when a new download completes
ipcRenderer.on("download-complete", (event, filePath) => {
  loadDownloadedFiles();
});

// Add new function to display current folder
function updateCurrentFolderDisplay() {
  const currentFolder =
    store.get("downloadFolder") || path.join(__dirname, "downloads");
  const folderElement = document.getElementById("current-folder");
  const selectButton = document.getElementById("select-folder");

  // Prepare the display text
  let displayPath = currentFolder;
  if (displayPath.length > 50) {
    displayPath = "..." + displayPath.slice(-50);
  }

  // Update the tooltip text
  folderElement.textContent = `Current Folder: ${displayPath}`;
  // Also set as button title for native tooltip
  selectButton.title = `Current Folder: ${currentFolder}`;
}

// Initialize folder display when page loads
updateCurrentFolderDisplay();

