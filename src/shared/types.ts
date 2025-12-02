// Core financial types

export interface Transaction {
  id: string;
  date: string; // ISO date string
  amount: number; // positive for income, negative for expense
  type: 'income' | 'expense' | 'transfer';
  categoryId: string;
  accountId: string;
  toAccountId?: string; // for transfers
  merchant?: string;
  description: string;
  notes?: string;
  tags: string[];
  receiptPath?: string;
  recurringId?: string;
  isReconciled: boolean;
  confidence?: number; // AI confidence score
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment';
  balance: number;
  currency: string;
  color: string;
  icon?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  type: 'income' | 'expense';
  group: 'essential' | 'lifestyle' | 'transportation' | 'income' | 'savings' | 'other';
  icon: string;
  color: string;
  budgetAmount?: number;
  isSystem: boolean;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  isRolling: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  templateTransaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  nextDate: string;
  endDate?: string;
  lastProcessed?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

// AI-related types

export interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category?: string;
  merchant?: string;
  description: string;
  date: string;
  tags?: string[];
  confidence: number;
}

export interface AIQuery {
  type: 'transaction' | 'query' | 'command';
  intent?: string;
  entities?: Record<string, unknown>;
  rawText: string;
}

export interface AIInsight {
  id: string;
  type: 'spending' | 'saving' | 'trend' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  data?: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

// Settings and configuration

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  locale: string;
  voiceEnabled: boolean;
  voiceWakeWord?: string;
  aiProvider: 'ollama' | 'openai' | 'anthropic' | 'auto';
  ollamaModel: string;
  ollamaEndpoint: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  autoBackup: boolean;
  backupPath?: string;
  biometricEnabled: boolean;
  autoLockMinutes: number;
}

// IPC channel types

export interface IpcChannels {
  // Database operations
  'db:getTransactions': { params: TransactionFilters; result: Transaction[] };
  'db:addTransaction': { params: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>; result: Transaction };
  'db:updateTransaction': { params: Transaction; result: Transaction };
  'db:deleteTransaction': { params: string; result: boolean };
  
  'db:getAccounts': { params: void; result: Account[] };
  'db:addAccount': { params: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>; result: Account };
  'db:updateAccount': { params: Account; result: Account };
  
  'db:getCategories': { params: void; result: Category[] };
  'db:getBudgets': { params: void; result: Budget[] };
  
  // AI operations
  'ai:parseTransaction': { params: string; result: ParsedTransaction };
  'ai:processQuery': { params: string; result: string };
  'ai:getInsights': { params: void; result: AIInsight[] };
  
  // Settings
  'settings:get': { params: void; result: Settings };
  'settings:set': { params: Partial<Settings>; result: Settings };
}

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  categoryIds?: string[];
  accountIds?: string[];
  type?: 'income' | 'expense' | 'transfer';
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

// Dashboard data types

export interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  topCategories: { category: Category; amount: number; percentage: number }[];
  recentTransactions: Transaction[];
  budgetProgress: { budget: Budget; category: Category; spent: number; remaining: number }[];
  monthlyTrend: { month: string; income: number; expenses: number }[];
  upcomingBills: RecurringTransaction[];
}

export interface SpendingByCategory {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  color: string;
}
