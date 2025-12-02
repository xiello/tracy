import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  getTransactions: (filters: unknown) => ipcRenderer.invoke('db:getTransactions', filters),
  addTransaction: (transaction: unknown) => ipcRenderer.invoke('db:addTransaction', transaction),
  updateTransaction: (transaction: unknown) => ipcRenderer.invoke('db:updateTransaction', transaction),
  deleteTransaction: (id: string) => ipcRenderer.invoke('db:deleteTransaction', id),
  
  getAccounts: () => ipcRenderer.invoke('db:getAccounts'),
  addAccount: (account: unknown) => ipcRenderer.invoke('db:addAccount', account),
  updateAccount: (account: unknown) => ipcRenderer.invoke('db:updateAccount', account),
  deleteAccount: (id: string) => ipcRenderer.invoke('db:deleteAccount', id),
  
  getCategories: () => ipcRenderer.invoke('db:getCategories'),
  addCategory: (category: unknown) => ipcRenderer.invoke('db:addCategory', category),
  
  getBudgets: () => ipcRenderer.invoke('db:getBudgets'),
  addBudget: (budget: unknown) => ipcRenderer.invoke('db:addBudget', budget),
  updateBudget: (budget: unknown) => ipcRenderer.invoke('db:updateBudget', budget),
  
  getRecurring: () => ipcRenderer.invoke('db:getRecurring'),
  addRecurring: (recurring: unknown) => ipcRenderer.invoke('db:addRecurring', recurring),
  
  getDashboardData: (period: unknown) => ipcRenderer.invoke('db:getDashboardData', period),
  
  // AI operations
  parseTransaction: (text: string) => ipcRenderer.invoke('ai:parseTransaction', text),
  processQuery: (query: string) => ipcRenderer.invoke('ai:processQuery', query),
  getInsights: () => ipcRenderer.invoke('ai:getInsights'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: unknown) => ipcRenderer.invoke('settings:set', settings),
  
  // System
  getSystemTheme: () => ipcRenderer.invoke('system:getTheme'),
  onThemeChange: (callback: (theme: string) => void) => {
    const handler = (_event: IpcRendererEvent, theme: string) => callback(theme);
    ipcRenderer.on('theme-changed', handler);
    return () => ipcRenderer.removeListener('theme-changed', handler);
  },
  
  // File operations
  selectFile: (options: unknown) => ipcRenderer.invoke('file:select', options),
  saveReceipt: (data: unknown) => ipcRenderer.invoke('file:saveReceipt', data),
  
  // Export/Import
  exportData: (format: string) => ipcRenderer.invoke('data:export', format),
  importData: (filePath: string) => ipcRenderer.invoke('data:import', filePath),
  
  // Reset all data
  resetAllData: () => ipcRenderer.invoke('db:resetAllData'),
  
  // Sync operations
  getSyncConfig: () => ipcRenderer.invoke('sync:getConfig'),
  setSyncConfig: (config: unknown) => ipcRenderer.invoke('sync:setConfig', config),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  startAutoSync: (intervalMs: number) => ipcRenderer.invoke('sync:startAuto', intervalMs),
  stopAutoSync: () => ipcRenderer.invoke('sync:stopAuto'),
});

// Type declarations for renderer
export interface ElectronAPI {
  getTransactions: (filters: unknown) => Promise<unknown>;
  addTransaction: (transaction: unknown) => Promise<unknown>;
  updateTransaction: (transaction: unknown) => Promise<unknown>;
  deleteTransaction: (id: string) => Promise<boolean>;
  getAccounts: () => Promise<unknown>;
  addAccount: (account: unknown) => Promise<unknown>;
  updateAccount: (account: unknown) => Promise<unknown>;
  deleteAccount: (id: string) => Promise<boolean>;
  getCategories: () => Promise<unknown>;
  addCategory: (category: unknown) => Promise<unknown>;
  getBudgets: () => Promise<unknown>;
  addBudget: (budget: unknown) => Promise<unknown>;
  updateBudget: (budget: unknown) => Promise<unknown>;
  getRecurring: () => Promise<unknown>;
  addRecurring: (recurring: unknown) => Promise<unknown>;
  getDashboardData: (period: unknown) => Promise<unknown>;
  parseTransaction: (text: string) => Promise<unknown>;
  processQuery: (query: string) => Promise<string>;
  getInsights: () => Promise<unknown>;
  getSettings: () => Promise<unknown>;
  setSettings: (settings: unknown) => Promise<unknown>;
  getSystemTheme: () => Promise<string>;
  onThemeChange: (callback: (theme: string) => void) => () => void;
  selectFile: (options: unknown) => Promise<string | null>;
  saveReceipt: (data: unknown) => Promise<string>;
  exportData: (format: string) => Promise<string>;
  importData: (filePath: string) => Promise<boolean>;
  resetAllData: () => Promise<boolean>;
  getSyncConfig: () => Promise<unknown>;
  setSyncConfig: (config: unknown) => Promise<unknown>;
  syncNow: () => Promise<{ added: number; updated: number }>;
  startAutoSync: (intervalMs: number) => Promise<boolean>;
  stopAutoSync: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
