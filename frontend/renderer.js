const { ipcRenderer } = require("electron");
const path = require('path');
const fs = require('fs');
const { parseFile } = require('music-metadata');

document.getElementById("download").addEventListener("click", () => {
  const url = document.getElementById("url").value;
  ipcRenderer.send("download-audio", url);
});

ipcRenderer.on("download-complete", (event, filePath) => {
    // Just reload the files table
    loadDownloadedFiles();
});

ipcRenderer.on("download-error", (event, errorMessage) => {
  const statusMessage = document.getElementById("status-message");
  statusMessage.className = "status-message error";
  statusMessage.textContent = `Error: ${errorMessage}`;
  // Hide error after 5 seconds
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 5000);
});

// Function to format duration in seconds to MM:SS
function formatDuration(seconds) {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Audio player functionality
let currentAudio = null;
let currentPlayButton = null;
let currentPauseButton = null;

// Add click handlers after creating the table rows
function addAudioHandlers() {
    document.querySelectorAll('.play-button').forEach(button => {
        button.addEventListener('click', () => {
            const filePath = button.dataset.path;
            const pauseButton = button.nextElementSibling;
            
            // If there's already something playing, stop it
            if (currentAudio) {
                currentAudio.pause();
                if (currentPlayButton) currentPlayButton.style.display = 'inline';
                if (currentPauseButton) currentPauseButton.style.display = 'none';
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
            button.style.display = 'none';
            pauseButton.style.display = 'inline';
            
            // When audio ends
            currentAudio.onended = () => {
                button.style.display = 'inline';
                pauseButton.style.display = 'none';
                currentAudio = null;
                currentPlayButton = null;
                currentPauseButton = null;
            };
        });
    });

    document.querySelectorAll('.pause-button').forEach(button => {
        button.addEventListener('click', () => {
            if (currentAudio) {
                currentAudio.pause();
                button.style.display = 'none';
                button.previousElementSibling.style.display = 'inline';
                currentAudio = null;
                currentPlayButton = null;
                currentPauseButton = null;
            }
        });
    });
}

// Function to load and display downloaded files
async function loadDownloadedFiles() {
    const downloadsPath = path.join(__dirname, 'downloads');
    const tableBody = document.getElementById('downloads-body');
    tableBody.innerHTML = ''; // Clear existing rows

    try {
        // Create downloads directory if it doesn't exist
        if (!fs.existsSync(downloadsPath)) {
            fs.mkdirSync(downloadsPath, { recursive: true });
            return;
        }

        const files = fs.readdirSync(downloadsPath)
            .filter(file => file.endsWith('.mp3')); // Filter for MP3 files

        for (const file of files) {
            const filePath = path.join(downloadsPath, file);
            try {
                // Parse metadata from the audio file
                const metadata = await parseFile(filePath);
                
                // Create table row
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${metadata.common.artist || ''}</td>
                    <td>${metadata.common.title || path.parse(file).name}</td>
                    <td>${formatDuration(metadata.format.duration)}</td>
                    <td>${metadata.common.key || ''}</td>
                    <td>${metadata.common.bpm || ''}</td>
                    <td>
                        <button class="play-button" data-path="${filePath.replace(/'/g, "\\'")}">Play</button>
                        <button class="pause-button" data-path="${filePath.replace(/'/g, "\\'")}" style="display: none;">Pause</button>
                        <button class="drag-handle" data-path="${filePath}">Drag</button>
                        <button class="delete-button" data-path="${filePath}">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            } catch (err) {
                console.error(`Error parsing metadata for ${file}:`, err);
                // Add row with just filename if metadata parsing fails
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td></td>
                    <td>${path.parse(file).name}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>
                        <button class="play-button" data-path="${filePath.replace(/'/g, "\\'")}">Play</button>
                        <button class="pause-button" data-path="${filePath.replace(/'/g, "\\'")}" style="display: none;">Pause</button>
                        <button class="drag-handle" data-path="${filePath}">Drag</button>
                        <button class="delete-button" data-path="${filePath}">Delete</button>
                    </td>
                `;
                tableBody.appendChild(row);
            }
        }

        // After all rows are added, add the audio handlers
        addAudioHandlers();
        
        // Add drag handlers
        document.querySelectorAll('.drag-handle').forEach(button => {
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                ipcRenderer.send('drag-file', button.dataset.path);
            });
        });

        // Add delete handlers
        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', () => {
                const filePath = button.dataset.path;
                if (confirm('Are you sure you want to delete this file?')) {
                    try {
                        // If this file is currently playing, stop it
                        if (currentAudio && currentAudio.src.includes(filePath)) {
                            currentAudio.pause();
                            currentAudio = null;
                            currentPlayButton = null;
                            currentPauseButton = null;
                        }
                        fs.unlinkSync(filePath);
                        button.closest('tr').remove();
                    } catch (err) {
                        console.error('Error deleting file:', err);
                        alert('Error deleting file');
                    }
                }
            });
        });

    } catch (err) {
        console.error('Error loading downloaded files:', err);
    }
}

// Load files when the page loads
document.addEventListener('DOMContentLoaded', loadDownloadedFiles);

// Reload files when a new download completes
ipcRenderer.on('download-complete', (event, filePath) => {
    loadDownloadedFiles();
});

ipcRenderer.on("websocket-message", (event, data) => {
  const statusMessage = document.getElementById("status-message");
  statusMessage.className = "status-message " + data.status;
  
  switch(data.status) {
    case 'started':
      statusMessage.textContent = 'Download started...';
      statusMessage.style.display = 'block';
      break;
    case 'converting':
      statusMessage.textContent = 'Converting File...';
      statusMessage.style.display = 'block';
      break;
    case 'finished':
      statusMessage.textContent = 'Download completed successfully!';
      statusMessage.style.display = 'block';
      // Hide the message after 3 seconds
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 7000);
      break;
  }
});

ipcRenderer.on("websocket-error", (event, error) => {
  const statusMessage = document.getElementById("status-message");
  statusMessage.className = "status-message error";
  statusMessage.textContent = `WebSocket Error: ${error}`;
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 5000);
});

ipcRenderer.on("websocket-status", (event, status) => {
  const statusMessage = document.getElementById("status-message");
  statusMessage.className = `status-message ${status}`;
  statusMessage.textContent = `WebSocket ${status}`;
  if (status === "disconnected") {
    statusMessage.style.display = 'block';
  } else {
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }
});
