import { Database } from './database';
import { v4 as uuid } from 'uuid';
import Store from 'electron-store';

interface SyncConfig {
  apiUrl: string;
  deviceId: string;
  lastSyncAt: string;
  syncEnabled: boolean;
}

const store = new Store<SyncConfig>({
  defaults: {
    apiUrl: 'http://localhost:3847',
    deviceId: uuid(),
    lastSyncAt: '1970-01-01T00:00:00Z',
    syncEnabled: false,
  }
});

export class SyncService {
  private db: Database;
  private syncInterval: NodeJS.Timeout | null = null;
  
  constructor(db: Database) {
    this.db = db;
  }
  
  getDeviceId(): string {
    return store.get('deviceId');
  }
  
  getConfig(): SyncConfig {
    return {
      apiUrl: store.get('apiUrl'),
      deviceId: store.get('deviceId'),
      lastSyncAt: store.get('lastSyncAt'),
      syncEnabled: store.get('syncEnabled'),
    };
  }
  
  setConfig(config: Partial<SyncConfig>): void {
    if (config.apiUrl !== undefined) store.set('apiUrl', config.apiUrl);
    if (config.syncEnabled !== undefined) store.set('syncEnabled', config.syncEnabled);
  }
  
  async sync(): Promise<{ added: number; updated: number }> {
    const config = this.getConfig();
    
    if (!config.syncEnabled) {
      return { added: 0, updated: 0 };
    }
    
    try {
      // Get local transactions since last sync
      const localTransactions = this.db.getTransactions({});
      
      // Convert to sync format
      const transactionsToSync = localTransactions.map(tx => ({
        id: tx.id,
        user_id: config.deviceId,
        date: tx.date,
        amount: Math.abs(tx.amount),
        type: tx.type,
        category: this.getCategoryName(tx.categoryId),
        merchant: tx.merchant,
        description: tx.description,
        tags: tx.tags,
        source: 'app' as const,
        created_at: tx.createdAt,
        updated_at: tx.updatedAt,
      }));
      
      // Call sync API
      const response = await fetch(`${config.apiUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: config.deviceId,
          last_sync_at: config.lastSyncAt,
          transactions: transactionsToSync,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Import new transactions from server
      let added = 0;
      let updated = 0;
      
      for (const serverTx of data.transactions) {
        // Check if we already have this transaction
        const existing = this.db.getTransactions({}).find(t => t.id === serverTx.id);
        
        if (!existing && serverTx.source !== 'app') {
          // New transaction from Telegram/Spotlight - add to local DB
          const categoryId = this.findCategoryId(serverTx.category, serverTx.type);
          const accounts = this.db.getAccounts();
          const accountId = accounts[0]?.id;
          
          if (categoryId && accountId) {
            this.db.addTransaction({
              date: serverTx.date,
              amount: serverTx.type === 'expense' ? -Math.abs(serverTx.amount) : Math.abs(serverTx.amount),
              type: serverTx.type,
              categoryId,
              accountId,
              merchant: serverTx.merchant,
              description: serverTx.description,
              tags: serverTx.tags || [],
              isReconciled: false,
            });
            added++;
          }
        }
      }
      
      // Update last sync time
      store.set('lastSyncAt', data.synced_at);
      
      console.log(`Sync complete: ${added} added, ${updated} updated`);
      return { added, updated };
      
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  }
  
  private getCategoryName(categoryId: string): string {
    const categories = this.db.getCategories();
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Other';
  }
  
  private findCategoryId(categoryName: string, type: 'income' | 'expense'): string | null {
    const categories = this.db.getCategories();
    
    // Exact match
    let category = categories.find(c => 
      c.name.toLowerCase() === categoryName.toLowerCase() && c.type === type
    );
    
    // Partial match
    if (!category) {
      category = categories.find(c => 
        c.name.toLowerCase().includes(categoryName.toLowerCase()) && c.type === type
      );
    }
    
    // Default
    if (!category) {
      category = categories.find(c => 
        c.name === (type === 'income' ? 'Other Income' : 'Other')
      );
    }
    
    return category?.id || null;
  }
  
  startAutoSync(intervalMs: number = 60000): void {
    this.stopAutoSync();
    
    // Initial sync
    this.sync().catch(console.error);
    
    // Schedule periodic syncs
    this.syncInterval = setInterval(() => {
      this.sync().catch(console.error);
    }, intervalMs);
    
    console.log(`Auto-sync started (every ${intervalMs / 1000}s)`);
  }
  
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync stopped');
    }
  }
}
