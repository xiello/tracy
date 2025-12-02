import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { v4 as uuid } from 'uuid';
import type { 
  Transaction, 
  Account, 
  Category, 
  Budget, 
  RecurringTransaction,
  TransactionFilters,
  DashboardData,
  Settings
} from '../shared/types';

export class Database {
  private db: BetterSqlite3.Database;
  
  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'tracy.db');
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('checking', 'savings', 'credit', 'cash', 'investment')),
        balance REAL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        color TEXT DEFAULT '#0071e3',
        icon TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES categories(id),
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        group_name TEXT NOT NULL CHECK(group_name IN ('essential', 'lifestyle', 'transportation', 'income', 'savings', 'other')),
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        budget_amount REAL,
        is_system INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
        category_id TEXT REFERENCES categories(id),
        account_id TEXT NOT NULL REFERENCES accounts(id),
        to_account_id TEXT REFERENCES accounts(id),
        merchant TEXT,
        description TEXT NOT NULL,
        notes TEXT,
        tags TEXT DEFAULT '[]',
        receipt_path TEXT,
        recurring_id TEXT REFERENCES recurring_transactions(id),
        is_reconciled INTEGER DEFAULT 0,
        confidence REAL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL REFERENCES categories(id),
        amount REAL NOT NULL,
        period TEXT NOT NULL CHECK(period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
        start_date TEXT NOT NULL,
        is_rolling INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id TEXT PRIMARY KEY,
        template_data TEXT NOT NULL,
        frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
        next_date TEXT NOT NULL,
        end_date TEXT,
        last_processed TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#6e6e73'
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    `);

    this.seedDefaultData();
  }

  private seedDefaultData() {
    const hasCategories = this.db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
    
    if (hasCategories.count === 0) {
      const defaultCategories = [
        // Essential
        { id: uuid(), name: 'Rent/Mortgage', type: 'expense', group_name: 'essential', icon: 'home', color: '#ff9500' },
        { id: uuid(), name: 'Utilities', type: 'expense', group_name: 'essential', icon: 'zap', color: '#ffcc00' },
        { id: uuid(), name: 'Groceries', type: 'expense', group_name: 'essential', icon: 'shopping-cart', color: '#34c759' },
        { id: uuid(), name: 'Healthcare', type: 'expense', group_name: 'essential', icon: 'heart', color: '#ff2d55' },
        { id: uuid(), name: 'Insurance', type: 'expense', group_name: 'essential', icon: 'shield', color: '#5856d6' },
        
        // Lifestyle
        { id: uuid(), name: 'Dining Out', type: 'expense', group_name: 'lifestyle', icon: 'utensils', color: '#ff6b6b' },
        { id: uuid(), name: 'Entertainment', type: 'expense', group_name: 'lifestyle', icon: 'film', color: '#af52de' },
        { id: uuid(), name: 'Shopping', type: 'expense', group_name: 'lifestyle', icon: 'shopping-bag', color: '#ff9500' },
        { id: uuid(), name: 'Subscriptions', type: 'expense', group_name: 'lifestyle', icon: 'repeat', color: '#0071e3' },
        
        // Transportation
        { id: uuid(), name: 'Gas', type: 'expense', group_name: 'transportation', icon: 'fuel', color: '#8e8e93' },
        { id: uuid(), name: 'Public Transit', type: 'expense', group_name: 'transportation', icon: 'bus', color: '#30b0c7' },
        { id: uuid(), name: 'Parking', type: 'expense', group_name: 'transportation', icon: 'square', color: '#636366' },
        { id: uuid(), name: 'Car Maintenance', type: 'expense', group_name: 'transportation', icon: 'wrench', color: '#48484a' },
        
        // Income
        { id: uuid(), name: 'Salary', type: 'income', group_name: 'income', icon: 'briefcase', color: '#34c759' },
        { id: uuid(), name: 'Freelance', type: 'income', group_name: 'income', icon: 'laptop', color: '#30d158' },
        { id: uuid(), name: 'Investments', type: 'income', group_name: 'income', icon: 'trending-up', color: '#32ade6' },
        { id: uuid(), name: 'Gifts', type: 'income', group_name: 'income', icon: 'gift', color: '#ff2d55' },
        { id: uuid(), name: 'Refund', type: 'income', group_name: 'income', icon: 'rotate-ccw', color: '#ff9f0a' },
        
        // Savings
        { id: uuid(), name: 'Savings Transfer', type: 'expense', group_name: 'savings', icon: 'piggy-bank', color: '#34c759' },
        { id: uuid(), name: 'Investments', type: 'expense', group_name: 'savings', icon: 'bar-chart-2', color: '#0071e3' },
        
        // Other
        { id: uuid(), name: 'Other', type: 'expense', group_name: 'other', icon: 'more-horizontal', color: '#8e8e93' },
        { id: uuid(), name: 'Other Income', type: 'income', group_name: 'other', icon: 'plus-circle', color: '#34c759' },
      ];

      const insertCategory = this.db.prepare(`
        INSERT INTO categories (id, name, type, group_name, icon, color, is_system)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `);

      for (const cat of defaultCategories) {
        insertCategory.run(cat.id, cat.name, cat.type, cat.group_name, cat.icon, cat.color);
      }
    }

    const hasAccounts = this.db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    
    if (hasAccounts.count === 0) {
      const defaultAccount = {
        id: uuid(),
        name: 'Cash',
        type: 'cash',
        balance: 0,
        currency: 'EUR',
        color: '#34c759',
      };

      this.db.prepare(`
        INSERT INTO accounts (id, name, type, balance, currency, color)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(defaultAccount.id, defaultAccount.name, defaultAccount.type, defaultAccount.balance, defaultAccount.currency, defaultAccount.color);
    }

    // Initialize default settings
    const hasSettings = this.db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
    
    if (hasSettings.count === 0) {
      const defaultSettings: Settings = {
        theme: 'system',
        currency: 'EUR',
        locale: 'de-DE',
        voiceEnabled: true,
        aiProvider: 'ollama',
        ollamaModel: 'llama3.2',
        ollamaEndpoint: 'http://localhost:11434',
        autoBackup: true,
        biometricEnabled: false,
        autoLockMinutes: 5,
      };

      const insertSetting = this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
      for (const [key, value] of Object.entries(defaultSettings)) {
        insertSetting.run(key, JSON.stringify(value));
      }
    }
  }

  // Transaction methods
  getTransactions(filters: TransactionFilters = {}): Transaction[] {
    let query = `
      SELECT 
        id, date, amount, type, category_id as categoryId, account_id as accountId,
        to_account_id as toAccountId, merchant, description, notes, tags,
        receipt_path as receiptPath, recurring_id as recurringId,
        is_reconciled as isReconciled, confidence, created_at as createdAt, updated_at as updatedAt
      FROM transactions
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters.startDate) {
      query += ' AND date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND date <= ?';
      params.push(filters.endDate);
    }
    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters.categoryIds?.length) {
      query += ` AND category_id IN (${filters.categoryIds.map(() => '?').join(',')})`;
      params.push(...filters.categoryIds);
    }
    if (filters.accountIds?.length) {
      query += ` AND account_id IN (${filters.accountIds.map(() => '?').join(',')})`;
      params.push(...filters.accountIds);
    }
    if (filters.search) {
      query += ' AND (description LIKE ? OR merchant LIKE ? OR notes LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY date DESC, created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const rows = this.db.prepare(query).all(...params) as Array<Transaction & { tags: string }>;
    return rows.map(row => ({
      ...row,
      tags: JSON.parse(row.tags || '[]'),
      isReconciled: Boolean(row.isReconciled),
    }));
  }

  addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Transaction {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO transactions (
        id, date, amount, type, category_id, account_id, to_account_id,
        merchant, description, notes, tags, receipt_path, recurring_id,
        is_reconciled, confidence, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, transaction.date, transaction.amount, transaction.type,
      transaction.categoryId, transaction.accountId, transaction.toAccountId || null,
      transaction.merchant || null, transaction.description, transaction.notes || null,
      JSON.stringify(transaction.tags || []), transaction.receiptPath || null,
      transaction.recurringId || null, transaction.isReconciled ? 1 : 0,
      transaction.confidence || null, now, now
    );

    // Update account balance
    this.updateAccountBalance(transaction.accountId, transaction.amount, transaction.type);
    if (transaction.toAccountId) {
      this.updateAccountBalance(transaction.toAccountId, Math.abs(transaction.amount), 'income');
    }

    return { ...transaction, id, createdAt: now, updatedAt: now };
  }

  updateTransaction(transaction: Transaction): Transaction {
    const now = new Date().toISOString();

    // Get old transaction to reverse balance
    const oldTx = this.db.prepare('SELECT amount, type, account_id, to_account_id FROM transactions WHERE id = ?')
      .get(transaction.id) as { amount: number; type: string; account_id: string; to_account_id: string | null } | undefined;

    if (oldTx) {
      // Reverse old balance
      this.updateAccountBalance(oldTx.account_id, -oldTx.amount, oldTx.type as 'income' | 'expense' | 'transfer');
      if (oldTx.to_account_id) {
        this.updateAccountBalance(oldTx.to_account_id, -Math.abs(oldTx.amount), 'income');
      }
    }

    this.db.prepare(`
      UPDATE transactions SET
        date = ?, amount = ?, type = ?, category_id = ?, account_id = ?,
        to_account_id = ?, merchant = ?, description = ?, notes = ?,
        tags = ?, receipt_path = ?, is_reconciled = ?, updated_at = ?
      WHERE id = ?
    `).run(
      transaction.date, transaction.amount, transaction.type,
      transaction.categoryId, transaction.accountId, transaction.toAccountId || null,
      transaction.merchant || null, transaction.description, transaction.notes || null,
      JSON.stringify(transaction.tags || []), transaction.receiptPath || null,
      transaction.isReconciled ? 1 : 0, now, transaction.id
    );

    // Apply new balance
    this.updateAccountBalance(transaction.accountId, transaction.amount, transaction.type);
    if (transaction.toAccountId) {
      this.updateAccountBalance(transaction.toAccountId, Math.abs(transaction.amount), 'income');
    }

    return { ...transaction, updatedAt: now };
  }

  deleteTransaction(id: string): boolean {
    const tx = this.db.prepare('SELECT amount, type, account_id, to_account_id FROM transactions WHERE id = ?')
      .get(id) as { amount: number; type: string; account_id: string; to_account_id: string | null } | undefined;

    if (tx) {
      this.updateAccountBalance(tx.account_id, -tx.amount, tx.type as 'income' | 'expense' | 'transfer');
      if (tx.to_account_id) {
        this.updateAccountBalance(tx.to_account_id, -Math.abs(tx.amount), 'income');
      }
    }

    const result = this.db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private updateAccountBalance(accountId: string, amount: number, type: string) {
    let delta = amount;
    if (type === 'expense') {
      delta = -Math.abs(amount);
    } else if (type === 'income') {
      delta = Math.abs(amount);
    }

    const now = new Date().toISOString();
    this.db.prepare('UPDATE accounts SET balance = balance + ?, updated_at = ? WHERE id = ?')
      .run(delta, now, accountId);
  }

  // Account methods
  getAccounts(): Account[] {
    return this.db.prepare(`
      SELECT id, name, type, balance, currency, color, icon, 
             is_active as isActive, created_at as createdAt, updated_at as updatedAt
      FROM accounts WHERE is_active = 1 ORDER BY name
    `).all() as Account[];
  }

  addAccount(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Account {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO accounts (id, name, type, balance, currency, color, icon, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, account.name, account.type, account.balance, account.currency, account.color, account.icon || null, account.isActive ? 1 : 0, now, now);

    return { ...account, id, createdAt: now, updatedAt: now };
  }

  updateAccount(account: Account): Account {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE accounts SET name = ?, type = ?, balance = ?, currency = ?, color = ?, icon = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(account.name, account.type, account.balance, account.currency, account.color, account.icon || null, account.isActive ? 1 : 0, now, account.id);

    return { ...account, updatedAt: now };
  }

  deleteAccount(id: string): boolean {
    const now = new Date().toISOString();
    const result = this.db.prepare('UPDATE accounts SET is_active = 0, updated_at = ? WHERE id = ?').run(now, id);
    return result.changes > 0;
  }

  // Category methods
  getCategories(): Category[] {
    return this.db.prepare(`
      SELECT id, name, parent_id as parentId, type, group_name as "group", 
             icon, color, budget_amount as budgetAmount, is_system as isSystem, created_at as createdAt
      FROM categories ORDER BY group_name, name
    `).all() as Category[];
  }

  addCategory(category: Omit<Category, 'id' | 'createdAt'>): Category {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO categories (id, name, parent_id, type, group_name, icon, color, budget_amount, is_system, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, category.name, category.parentId || null, category.type, category.group, category.icon, category.color, category.budgetAmount || null, category.isSystem ? 1 : 0, now);

    return { ...category, id, createdAt: now };
  }

  // Budget methods
  getBudgets(): Budget[] {
    return this.db.prepare(`
      SELECT id, category_id as categoryId, amount, period, start_date as startDate,
             is_rolling as isRolling, created_at as createdAt, updated_at as updatedAt
      FROM budgets ORDER BY category_id
    `).all() as Budget[];
  }

  addBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Budget {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO budgets (id, category_id, amount, period, start_date, is_rolling, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, budget.categoryId, budget.amount, budget.period, budget.startDate, budget.isRolling ? 1 : 0, now, now);

    return { ...budget, id, createdAt: now, updatedAt: now };
  }

  updateBudget(budget: Budget): Budget {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE budgets SET amount = ?, period = ?, start_date = ?, is_rolling = ?, updated_at = ?
      WHERE id = ?
    `).run(budget.amount, budget.period, budget.startDate, budget.isRolling ? 1 : 0, now, budget.id);

    return { ...budget, updatedAt: now };
  }

  // Recurring transactions
  getRecurringTransactions(): RecurringTransaction[] {
    const rows = this.db.prepare(`
      SELECT id, template_data, frequency, next_date as nextDate, end_date as endDate,
             last_processed as lastProcessed, is_active as isActive, created_at as createdAt
      FROM recurring_transactions WHERE is_active = 1 ORDER BY next_date
    `).all() as Array<{ template_data: string } & Omit<RecurringTransaction, 'templateTransaction'>>;

    return rows.map(row => ({
      ...row,
      templateTransaction: JSON.parse(row.template_data),
      isActive: Boolean(row.isActive),
    }));
  }

  addRecurringTransaction(recurring: Omit<RecurringTransaction, 'id' | 'createdAt'>): RecurringTransaction {
    const id = uuid();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO recurring_transactions (id, template_data, frequency, next_date, end_date, last_processed, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, JSON.stringify(recurring.templateTransaction), recurring.frequency, recurring.nextDate, recurring.endDate || null, recurring.lastProcessed || null, recurring.isActive ? 1 : 0, now);

    return { ...recurring, id, createdAt: now };
  }

  // Dashboard data
  getDashboardData(period: { startDate: string; endDate: string }): DashboardData {
    const transactions = this.getTransactions({
      startDate: period.startDate,
      endDate: period.endDate,
    });

    const categories = this.getCategories();
    const budgets = this.getBudgets();
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // Top categories by spending
    const categorySpending = new Map<string, number>();
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const current = categorySpending.get(t.categoryId) || 0;
        categorySpending.set(t.categoryId, current + Math.abs(t.amount));
      });

    const topCategories = Array.from(categorySpending.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoryId, amount]) => ({
        category: categoryMap.get(categoryId)!,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }))
      .filter(c => c.category);

    // Budget progress
    const budgetProgress = budgets.map(budget => {
      const spent = transactions
        .filter(t => t.type === 'expense' && t.categoryId === budget.categoryId)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        budget,
        category: categoryMap.get(budget.categoryId)!,
        spent,
        remaining: budget.amount - spent,
      };
    }).filter(b => b.category);

    // Monthly trend (last 6 months)
    const monthlyTrend: { month: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toISOString().slice(0, 7);
      
      const monthTransactions = transactions.filter(t => t.date.startsWith(month));
      monthlyTrend.push({
        month,
        income: monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0),
        expenses: monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0),
      });
    }

    return {
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
      topCategories,
      recentTransactions: transactions.slice(0, 10),
      budgetProgress,
      monthlyTrend,
      upcomingBills: this.getRecurringTransactions().slice(0, 5),
    };
  }

  // Settings
  getSettings(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const settings: Partial<Settings> = {};
    
    for (const row of rows) {
      settings[row.key as keyof Settings] = JSON.parse(row.value);
    }

    return settings as unknown as Settings;
  }

  setSettings(updates: Partial<Settings>): Settings {
    const upsert = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    
    for (const [key, value] of Object.entries(updates)) {
      upsert.run(key, JSON.stringify(value));
    }

    return this.getSettings();
  }

  resetAllData(): boolean {
    try {
      this.db.exec('DELETE FROM transactions');
      this.db.exec('DELETE FROM budgets');
      // Reset account balances to 0
      this.db.exec('UPDATE accounts SET balance = 0');
      return true;
    } catch (error) {
      console.error('Failed to reset data:', error);
      return false;
    }
  }

  close() {
    this.db.close();
  }
}
