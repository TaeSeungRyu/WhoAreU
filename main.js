const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { listProcesses } = require('./src/system');

const ICON_PATH = path.join(__dirname, 'assets', 'tray-icon.png');

let mainWindow = null;
let windowLoaded = false;
let tray = null;
let isQuitting = false;

// Window is created lazily — on first 확인하기 click — so that nothing in the
// renderer runs (and no PowerShell is spawned) until the user actually asks
// to see the dashboard. Cuts background activity to zero while idling in tray.
function ensureWindow() {
  if (mainWindow) return mainWindow;
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

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Renderer pauses its auto-refresh timer while the window is hidden, so we
  // stay quiet in tray mode. The 'visible' event fires on show; 'hide' on hide.
  mainWindow.on('show', () => {
    if (mainWindow.webContents) mainWindow.webContents.send('whoAreU:visible', true);
  });
  mainWindow.on('hide', () => {
    if (mainWindow.webContents) mainWindow.webContents.send('whoAreU:visible', false);
  });

  return mainWindow;
}

function showDashboard() {
  const w = ensureWindow();
  if (!windowLoaded) {
    w.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
    windowLoaded = true;
  }
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
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
    ipcMain.handle('system:list', (_e, opts) => listProcesses(opts || {}));
  });

  // Tray keeps the app alive — don't quit when the window closes.
  app.on('window-all-closed', () => {});
}
