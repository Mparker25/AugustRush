const { ipcRenderer } = require("electron");
const path = require("path");
const fs = require("fs");
const { parseFile } = require("music-metadata");
const Store = require("electron-store");
const store = new Store();

// Load files when the page loads
document.addEventListener("DOMContentLoaded", loadDownloadedFiles);

// Tell the main process we're ready to receive logs
ipcRenderer.send('ready');

// Listen for forwarded logs
ipcRenderer.on('main-process-log', (event, args) => {
  console.log('[Main Process]', ...args);
});

ipcRenderer.on('main-process-error', (event, args) => {
  console.error('[Main Process]', ...args);
});


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
  }, 2000);
  loadDownloadedFiles();
});

ipcRenderer.on("download-error", (event, errorMessage) => {
  const statusMessage = document.getElementById("status-message");
  statusMessage.className = "status-message error";
  statusMessage.textContent = `Error: ${errorMessage}`;
  // Hide error after 5 seconds
  setTimeout(() => {
    statusMessage.style.display = "none";
  }, 2000);
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

// Add these variables at the top of the file
let audioPlayer = new Audio();
let currentTrackData = null;
let isDragging = false;

// Replace the old audio handler functions with this new one
function setupTableRowHandlers() {
  document.querySelectorAll("#downloads-body tr").forEach((row) => {
    row.addEventListener("click", async () => {
      const filePath = row.dataset.path;
      console.log("Clicked row", filePath);

      try {
        // Use parseFile from promises
        const metadata = null; //await parseFile(filePath);

        // Update mini player display
        document.getElementById("current-track-title").textContent =
          path.parse(filePath).name;
        document.getElementById("current-track-artist").textContent = "";

        // Show mini player
        document.getElementById("mini-player").classList.remove("hidden");

        // If it's a different track, load and play it
        if (currentTrackData?.filePath !== filePath) {
          currentTrackData = {
            filePath,
            metadata,
            row,
          };

          audioPlayer.src = filePath;
          audioPlayer.play();
          updatePlayPauseButton(true);
        }
      } catch (err) {
        console.error("Error loading track:", err);
      }
    });
  });
}

// Add mini player control functions
function setupMiniPlayer() {
  const playPauseButton = document.getElementById("play-pause-button");
  const timeline = document.getElementById("timeline");
  const playhead = document.getElementById("playhead");

  // Play/Pause button handler
  playPauseButton.addEventListener("click", () => {
    if (audioPlayer.paused) {
      audioPlayer.play();
      updatePlayPauseButton(true);
    } else {
      audioPlayer.pause();
      updatePlayPauseButton(false);
    }
  });

  // Timeline click handler
  timeline.addEventListener("click", (e) => {
    if (!currentTrackData) return;

    const rect = timeline.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = pos * audioPlayer.duration;
  });

  // Playhead drag handlers
  playhead.addEventListener("mousedown", () => {
    isDragging = true;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging || !currentTrackData) return;

    const rect = timeline.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(1, pos));

    audioPlayer.currentTime = pos * audioPlayer.duration;
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  // Audio player event handlers
  audioPlayer.addEventListener("timeupdate", updateProgress);
  audioPlayer.addEventListener("ended", () => {
    updatePlayPauseButton(false);
    audioPlayer.currentTime = 0;
  });
}

function updatePlayPauseButton(isPlaying) {
  const playIcon = document.querySelector(".play-icon");
  const pauseIcon = document.querySelector(".pause-icon");

  if (isPlaying) {
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
  } else {
    playIcon.classList.remove("hidden");
    pauseIcon.classList.add("hidden");
  }
}

function updateProgress() {
  if (!currentTrackData) return;

  const timeline = document.getElementById("timeline");
  const playhead = document.getElementById("playhead");
  const currentTimeEl = document.getElementById("current-time");
  const durationEl = document.getElementById("duration");

  const progress = audioPlayer.currentTime / audioPlayer.duration;
  playhead.style.left = `${progress * 100}%`;

  currentTimeEl.textContent = formatDuration(audioPlayer.currentTime);
  durationEl.textContent = formatDuration(audioPlayer.duration);
}

// Helper function to create row HTML
function createRowHTML(filePath, metadata = null) {
  const fileName = path.parse(filePath).name;
  return `
        <td style="width: 80%">${fileName}</td>
        <!-- <td>${
          metadata?.format?.duration
            ? formatDuration(metadata.format.duration)
            : ""
        }</td> -->
        <!-- <td>${metadata?.common?.key || ""}</td> -->
        <!-- <td>${metadata?.common?.bpm || ""}</td> -->
        <td style="width: 20%">
            <button class="delete-button" data-path="${filePath}">Delete</button>
        </td>
    `;
}

// Helper function to create and setup a table row
function createTableRow(filePath) {
  const row = document.createElement("tr");
  row.draggable = true;
  row.dataset.path = filePath;
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
        // Use parseFile from promises
        const metadata = await parseFile(filePath);
        row.innerHTML = createRowHTML(filePath, metadata);
      } catch (err) {
        console.error(`Error parsing metadata for ${file}:`, err);
        row.innerHTML = createRowHTML(filePath);
      }

      tableBody.appendChild(row);
    }

    // After all rows are added:
    setupTableRowHandlers();
    setupMiniPlayer();

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
      button.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent the row click event from firing
        const filePath = button.dataset.path;
        if (confirm("Are you sure you want to delete this file?")) {
          try {
            // If this file is currently playing, stop it and hide mini player
            if (currentTrackData && currentTrackData.filePath === filePath) {
              audioPlayer.pause();
              audioPlayer.src = ""; // Clear the audio source
              currentTrackData = null;
              document.getElementById("mini-player").classList.add("hidden");
              updatePlayPauseButton(false);
              // Reset the display text
              document.getElementById("current-track-title").textContent =
                "No track selected";
              document.getElementById("current-track-artist").textContent = "";
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
