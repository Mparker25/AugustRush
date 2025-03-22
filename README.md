# Getting the App Running

Start the electron app

``` shell
npm start
```

# Building and Deploying Electron App

## Prerequisites
- Node.js and npm
- Python 3.x
- PyInstaller (`pip install pyinstaller`)
- electron-builder (`npm install -D electron-builder`)

## Build Process

### 1. Package Python Application
First, package the Python backend into an executable:

```shell
# Windows
# Need to have Windows installed with 
pyinstaller --noconsole --onefile --name Youtube-Downloader python_scripts/youtube_downloader.py

# Mac
pyinstaller --onefile --name Youtube-Downloader python_scripts/youtube_downloader.py
```

### 2. Configure electron-builder
Add the following to your package.json:

```json
{
  "build": {
    "appId": "your.app.id",
    "mac": {
      "category": "public.app-category.utilities",
      "target": ["dmg", "zip"]
    },
    "win": {
      "target": ["nsis", "portable"]
    },
    "files": [
      "**/*",
      "dist/backend*"
    ],
    "extraResources": [
      {
        "from": "dist/backend",
        "to": "backend",
        "filter": ["**/*"]
      }
    ]
  },
  "scripts": {
    "build": "electron-builder build --mac --win",
    "build:mac": "electron-builder build --mac",
    "build:win": "electron-builder build --win"
  }
}
```

### 3. Build Distribution

```shell
# Build for both platforms
npm run build

# Build for specific platform
npm run build:mac
npm run build:win
```

The packaged applications will be available in the `dist` folder:
- Windows: `dist/your-app-setup.exe` (installer) and `dist/your-app.exe` (portable)
- Mac: `dist/your-app.dmg` and `dist/your-app.app`

## Notes
- For code signing on macOS, you'll need an Apple Developer account
- For Windows builds on macOS, you'll need Wine installed
- Cross-platform builds might require additional configuration

# Future Ideas

1. Audio Recording Integration
   - Add a record button to capture audio from multiple sources
   - Integrate web browser capabilities for seamless audio recording from browser tabs
   - Implement audio router passthrough to:
     - Route audio between different applications
     - Record system audio
     - Support virtual audio devices
     - Enable mixing of multiple audio sources in real-time
   - Features could include:
     - Source selection dropdown (microphone, system audio, browser tabs)
     - Audio visualization during recording
     - Basic audio editing capabilities (trim, normalize)
     - Export in multiple formats (MP3, WAV, FLAC)

If you'd like, I can provide detailed examples of how to style the UI, handle errors, or even set up drag-and-drop functionality more comprehensively. Let me know!
