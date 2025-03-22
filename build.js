const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function runCommand(command, errorMessage) {
  try {
    console.log(`[BUILD] Executing: ${command}`);
    execSync(command, {
      stdio: "inherit",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
  } catch (error) {
    console.error(`[ERROR] ${errorMessage}:`, error.message);
    process.exit(1);
  }
}

// Ensure dist directory exists
if (!fs.existsSync("dist")) {
  console.log("[BUILD] Creating dist directory");
  fs.mkdirSync("dist");
}

// Ensure ffmpeg directory exists
if (!fs.existsSync("ffmpeg")) {
  console.log("[BUILD] Creating ffmpeg directory");
  fs.mkdirSync("ffmpeg");
}

// Build Python executable based on platform
if (process.platform === "darwin") {
  console.log("[BUILD] Building for macOS...");
  // First, ensure FFmpeg is installed
  try {
    execSync("which ffmpeg");
    // Get the actual path of ffmpeg
    const ffmpegPath = execSync("which ffmpeg").toString().trim();
    console.log(`[BUILD] Using ffmpeg from: ${ffmpegPath}`);

    // Copy ffmpeg to the ffmpeg directory
    console.log("[BUILD] Copying ffmpeg to bundled location");
    fs.copyFileSync(ffmpegPath, path.join("ffmpeg", "ffmpeg"));
    // Make it executable
    fs.chmodSync(path.join("ffmpeg", "ffmpeg"), 0o755);

    // Build without bundling ffmpeg - we'll include it as extraResources
    runCommand(
      `pyinstaller --onefile --name Youtube-Downloader python_scripts/youtube_downloader.py`,
      "Failed to build macOS executable"
    );
  } catch (error) {
    console.error(
      "[ERROR] FFmpeg not found. Please install it with: brew install ffmpeg"
    );
    process.exit(1);
  }
} else if (process.platform === "win32") {
  console.log("[BUILD] Building for Windows...");
  // Assuming FFmpeg is in PATH or in a known location
  const ffmpegPath = "C:\\ffmpeg\\bin\\ffmpeg.exe"; // Adjust this path

  // Copy ffmpeg to the ffmpeg directory
  console.log("[BUILD] Copying ffmpeg to bundled location");
  fs.copyFileSync(ffmpegPath, path.join("ffmpeg", "ffmpeg.exe"));

  runCommand(
    `pyinstaller --onefile --name Youtube-Downloader python_scripts/youtube_downloader.py`,
    "Failed to build Windows executable"
  );
}

// Verify the executable was created
const executableName =
  process.platform === "darwin"
    ? "Youtube-Downloader"
    : "Youtube-Downloader.exe";
const executablePath = path.join("dist", executableName);

if (!fs.existsSync(executablePath)) {
  console.error(`[ERROR] Executable not found at: ${executablePath}`);
  process.exit(1);
}

console.log(`[BUILD] Executable created successfully at: ${executablePath}`);

// Run electron-builder
console.log("[BUILD] Building Electron app...");
runCommand("electron-builder build", "Failed to build Electron app");

// Output reminder about code signing and notarization
console.log("\n[BUILD] IMPORTANT: For distribution on macOS:");
console.log("1. You need an Apple Developer account for code signing");
console.log('2. Set the identity in package.json "mac" section');
console.log("3. For distribution outside the App Store, notarize your app:");
console.log(
  "   xcrun notarytool submit <app-path> --apple-id <id> --password <pwd> --team-id <team>"
);
console.log(
  '4. Without proper signing and notarization, users will see "Disk Damaged" errors'
);
