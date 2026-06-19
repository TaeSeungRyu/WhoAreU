const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { listProcesses } = require('./src/system');

const ICON_PATH = path.join(__dirname, 'assets', 'tray-icon.png');

let mainWindow = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 650,
    show: false,
    autoHideMenuBar: true,
    icon: ICON_PATH,
    title: 'WhoAreU',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  // X button hides to tray; only the tray's 종료 menu truly quits.
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function showDashboard() {
  if (!mainWindow) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH);
  tray = new Tray(icon);
  tray.setToolTip('WhoAreU');
  const menu = Menu.buildFromTemplate([
    { label: '확인하기', click: showDashboard },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showDashboard);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showDashboard());

  app.whenReady().then(() => {
    createTray();
    createWindow();
    ipcMain.handle('system:list', () => listProcesses());
  });

  // Tray keeps the app alive — don't quit when the window closes.
  app.on('window-all-closed', () => {});
}
