import { app, BrowserWindow, ipcMain, nativeTheme, systemPreferences } from 'electron';
import path from 'path';
import { Database } from './database';
import { AIService } from './ai-service';
import { SyncService } from './sync-service';
import { setupIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let database: Database | null = null;
let aiService: AIService | null = null;
let syncService: SyncService | null = null;

const isDev = process.env.NODE_ENV === 'development';

async function createWindow() {
  // Request microphone permission on macOS
  if (process.platform === 'darwin') {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    if (micStatus !== 'granted') {
      try {
        await systemPreferences.askForMediaAccess('microphone');
      } catch (err) {
        console.log('Microphone permission request failed:', err);
      }
    }
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 18 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1d1d1f' : '#f5f5f7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Initialize services
  database = new Database();
  aiService = new AIService(database);
  syncService = new SyncService(database);

  // Setup IPC handlers
  setupIpcHandlers(ipcMain, database, aiService, syncService);
  
  // Start auto-sync if enabled
  const syncConfig = syncService.getConfig();
  if (syncConfig.syncEnabled) {
    syncService.startAutoSync(60000); // Sync every minute
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  
  // Always open devtools for debugging
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle theme changes
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  database?.close();
});
