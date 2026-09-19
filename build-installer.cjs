const electronInstaller = require('electron-winstaller');

async function buildInstaller() {
  try {
    await electronInstaller.createWindowsInstaller({
      appDirectory: 'PC Version/Stor Note-win32-x64',
      outputDirectory: 'PC Version/Installer',
      authors: 'Abir',
      description: 'Stor Note Desktop App',
      exe: 'Stor Note.exe'
    });
    console.log('It worked!');
  } catch (e) {
    console.log(`No dice: ${e.message}`);
  }
}

buildInstaller();
