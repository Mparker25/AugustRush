const { exec } = require("child_process");
const path = require("path");

const buildPython = () => {
  const platform = process.platform;
  const pyinstaller = platform === "win32" ? "pyinstaller.exe" : "pyinstaller";

  const command = `${pyinstaller} --clean --onefile --distpath backend/dist backend/downloader.py`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error building Python: ${error}`);
      return;
    }
    console.log(`Python build complete: ${stdout}`);
  });
};

buildPython();
