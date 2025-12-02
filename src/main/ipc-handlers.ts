import { IpcMain, dialog, nativeTheme } from 'electron';
import { Database } from './database';
import { AIService } from './ai-service';
import { SyncService } from './sync-service';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export function setupIpcHandlers(ipcMain: IpcMain, db: Database, aiService: AIService, syncService?: SyncService) {
  // Transaction handlers
  ipcMain.handle('db:getTransactions', (_event, filters) => {
    return db.getTransactions(filters);
  });

  ipcMain.handle('db:addTransaction', (_event, transaction) => {
    return db.addTransaction(transaction);
  });

  ipcMain.handle('db:updateTransaction', (_event, transaction) => {
    return db.updateTransaction(transaction);
  });

  ipcMain.handle('db:deleteTransaction', (_event, id) => {
    return db.deleteTransaction(id);
  });

  // Account handlers
  ipcMain.handle('db:getAccounts', () => {
    return db.getAccounts();
  });

  ipcMain.handle('db:addAccount', (_event, account) => {
    return db.addAccount(account);
  });

  ipcMain.handle('db:updateAccount', (_event, account) => {
    return db.updateAccount(account);
  });

  ipcMain.handle('db:deleteAccount', (_event, id) => {
    return db.deleteAccount(id);
  });

  // Category handlers
  ipcMain.handle('db:getCategories', () => {
    return db.getCategories();
  });

  ipcMain.handle('db:addCategory', (_event, category) => {
    return db.addCategory(category);
  });

  // Budget handlers
  ipcMain.handle('db:getBudgets', () => {
    return db.getBudgets();
  });

  ipcMain.handle('db:addBudget', (_event, budget) => {
    return db.addBudget(budget);
  });

  ipcMain.handle('db:updateBudget', (_event, budget) => {
    return db.updateBudget(budget);
  });

  // Recurring transaction handlers
  ipcMain.handle('db:getRecurring', () => {
    return db.getRecurringTransactions();
  });

  ipcMain.handle('db:addRecurring', (_event, recurring) => {
    return db.addRecurringTransaction(recurring);
  });

  // Dashboard data
  ipcMain.handle('db:getDashboardData', (_event, period) => {
    return db.getDashboardData(period);
  });

  // Reset all data
  ipcMain.handle('db:resetAllData', () => {
    return db.resetAllData();
  });

  // AI handlers
  ipcMain.handle('ai:parseTransaction', async (_event, text) => {
    return await aiService.parseTransaction(text);
  });

  ipcMain.handle('ai:processQuery', async (_event, query) => {
    return await aiService.processQuery(query);
  });

  ipcMain.handle('ai:getInsights', async () => {
    return await aiService.getInsights();
  });

  // Settings handlers
  ipcMain.handle('settings:get', () => {
    return db.getSettings();
  });

  ipcMain.handle('settings:set', (_event, settings) => {
    return db.setSettings(settings);
  });

  // System handlers
  ipcMain.handle('system:getTheme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  // File handlers
  ipcMain.handle('file:select', async (_event, options) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options?.filters || [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
        { name: 'Documents', extensions: ['pdf'] },
      ],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('file:saveReceipt', async (_event, data: { filePath: string; transactionId: string }) => {
    const receiptsDir = path.join(app.getPath('userData'), 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const ext = path.extname(data.filePath);
    const newPath = path.join(receiptsDir, `${data.transactionId}${ext}`);
    fs.copyFileSync(data.filePath, newPath);
    return newPath;
  });

  // Export/Import handlers
  ipcMain.handle('data:export', async (_event, format: string) => {
    const transactions = db.getTransactions({});
    const accounts = db.getAccounts();
    const categories = db.getCategories();
    const budgets = db.getBudgets();

    const data = { transactions, accounts, categories, budgets, exportedAt: new Date().toISOString() };

    const result = await dialog.showSaveDialog({
      defaultPath: `tracy-export-${new Date().toISOString().split('T')[0]}`,
      filters: format === 'csv' 
        ? [{ name: 'CSV', extensions: ['csv'] }]
        : [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    if (format === 'csv') {
      const csvHeader = 'Date,Type,Amount,Category,Merchant,Description,Account,Tags,Notes\n';
      const csvRows = transactions.map(t => {
        const category = categories.find(c => c.id === t.categoryId);
        const account = accounts.find(a => a.id === t.accountId);
        return [
          t.date,
          t.type,
          t.amount,
          category?.name || '',
          t.merchant || '',
          `"${t.description.replace(/"/g, '""')}"`,
          account?.name || '',
          `"${t.tags.join(', ')}"`,
          `"${(t.notes || '').replace(/"/g, '""')}"`,
        ].join(',');
      }).join('\n');
      
      fs.writeFileSync(result.filePath, csvHeader + csvRows);
    } else {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
    }

    return result.filePath;
  });

  ipcMain.handle('data:import', async (_event, filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (filePath.endsWith('.json')) {
        const data = JSON.parse(content);
        
        // Import accounts first
        if (data.accounts) {
          for (const account of data.accounts) {
            try {
              db.addAccount(account);
            } catch {
              // Account might already exist
            }
          }
        }

        // Import transactions
        if (data.transactions) {
          for (const transaction of data.transactions) {
            try {
              db.addTransaction(transaction);
            } catch {
              // Transaction might already exist or have invalid references
            }
          }
        }
      } else if (filePath.endsWith('.csv')) {
        const lines = content.split('\n').slice(1); // Skip header
        const accounts = db.getAccounts();
        const categories = db.getCategories();
        const defaultAccount = accounts[0];

        for (const line of lines) {
          if (!line.trim()) continue;
          
          // Simple CSV parsing (doesn't handle all edge cases)
          const parts = line.match(/(".*?"|[^,]+)/g) || [];
          const [date, type, amount, categoryName, merchant, description] = parts.map(p => 
            p.replace(/^"|"$/g, '').replace(/""/g, '"')
          );

          const category = categories.find(c => c.name === categoryName);
          
          if (date && amount) {
            db.addTransaction({
              date,
              type: (type as 'income' | 'expense') || 'expense',
              amount: parseFloat(amount),
              categoryId: category?.id || categories[0].id,
              accountId: defaultAccount.id,
              merchant: merchant || undefined,
              description: description || 'Imported transaction',
              tags: [],
              isReconciled: false,
            });
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  });

  // Sync handlers
  if (syncService) {
    ipcMain.handle('sync:getConfig', () => {
      return syncService.getConfig();
    });

    ipcMain.handle('sync:setConfig', (_event, config) => {
      syncService.setConfig(config);
      return syncService.getConfig();
    });

    ipcMain.handle('sync:now', async () => {
      return await syncService.sync();
    });

    ipcMain.handle('sync:startAuto', (_event, intervalMs) => {
      syncService.startAutoSync(intervalMs || 60000);
      return true;
    });

    ipcMain.handle('sync:stopAuto', () => {
      syncService.stopAutoSync();
      return true;
    });
  }
}
