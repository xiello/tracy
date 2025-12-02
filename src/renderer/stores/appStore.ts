import { create } from 'zustand';
import type { 
  Transaction, 
  Account, 
  Category, 
  Budget, 
  Settings, 
  DashboardData,
  ParsedTransaction,
  AIInsight,
  TransactionFilters
} from '../../shared/types';

type View = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'crypto' | 'chat' | 'settings';

interface AppState {
  // Navigation
  currentView: View;
  setCurrentView: (view: View) => void;

  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Data
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets: Budget[];
  dashboardData: DashboardData | null;
  insights: AIInsight[];

  // Loading states
  isLoading: boolean;
  isProcessingVoice: boolean;

  // Modals
  showAddTransaction: boolean;
  setShowAddTransaction: (show: boolean) => void;
  editingTransaction: Transaction | null;
  setEditingTransaction: (transaction: Transaction | null) => void;

  // Voice/AI
  voiceTranscript: string;
  setVoiceTranscript: (transcript: string) => void;
  parsedTransaction: ParsedTransaction | null;
  setParsedTransaction: (parsed: ParsedTransaction | null) => void;

  // Actions
  initialize: () => Promise<void>;
  loadTransactions: (filters?: TransactionFilters) => Promise<void>;
  loadDashboardData: () => Promise<void>;
  loadInsights: () => Promise<void>;
  
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Transaction>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  addAccount: (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  addBudget: (budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Budget>;
  updateBudget: (budget: Budget) => Promise<void>;

  parseVoiceInput: (text: string) => Promise<ParsedTransaction>;
  processQuery: (query: string) => Promise<string>;

  // Settings
  settings: Settings | null;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  
  // Reset all data
  resetAllData: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  currentView: 'dashboard',
  theme: 'system',
  transactions: [],
  accounts: [],
  categories: [],
  budgets: [],
  dashboardData: null,
  insights: [],
  isLoading: true,
  isProcessingVoice: false,
  showAddTransaction: false,
  editingTransaction: null,
  voiceTranscript: '',
  parsedTransaction: null,
  settings: null,

  // Navigation
  setCurrentView: (view) => set({ currentView: view }),
  setTheme: (theme) => {
    set({ theme });
    get().updateSettings({ theme });
  },

  // Modals
  setShowAddTransaction: (show) => set({ showAddTransaction: show, parsedTransaction: null }),
  setEditingTransaction: (transaction) => set({ editingTransaction: transaction }),

  // Voice
  setVoiceTranscript: (transcript) => set({ voiceTranscript: transcript }),
  setParsedTransaction: (parsed) => set({ parsedTransaction: parsed }),

  // Initialize
  initialize: async () => {
    set({ isLoading: true });
    try {
      const [accounts, categories, budgets, settings] = await Promise.all([
        window.electronAPI.getAccounts(),
        window.electronAPI.getCategories(),
        window.electronAPI.getBudgets(),
        window.electronAPI.getSettings(),
      ]);

      set({
        accounts: accounts as Account[],
        categories: categories as Category[],
        budgets: budgets as Budget[],
        settings: settings as Settings,
        theme: (settings as Settings).theme,
      });

      await Promise.all([
        get().loadTransactions(),
        get().loadDashboardData(),
        get().loadInsights(),
      ]);
    } catch (error) {
      console.error('Failed to initialize:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // Load transactions
  loadTransactions: async (filters = {}) => {
    try {
      const transactions = await window.electronAPI.getTransactions(filters);
      set({ transactions: transactions as Transaction[] });
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  },

  // Load dashboard data
  loadDashboardData: async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const data = await window.electronAPI.getDashboardData({ startDate: startOfMonth, endDate: endOfMonth });
      set({ dashboardData: data as DashboardData });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  },

  // Load insights
  loadInsights: async () => {
    try {
      const insights = await window.electronAPI.getInsights();
      set({ insights: insights as AIInsight[] });
    } catch (error) {
      console.error('Failed to load insights:', error);
    }
  },

  // Transaction actions
  addTransaction: async (transaction) => {
    console.log('[Store] Adding transaction:', transaction);
    const newTransaction = await window.electronAPI.addTransaction(transaction) as Transaction;
    console.log('[Store] New transaction created:', newTransaction);
    // Reload from database to ensure consistency
    await get().loadTransactions();
    console.log('[Store] Transactions reloaded:', get().transactions.length);
    await get().loadDashboardData();
    get().loadInsights();
    return newTransaction;
  },

  updateTransaction: async (transaction) => {
    await window.electronAPI.updateTransaction(transaction);
    set((state) => ({
      transactions: state.transactions.map((t) => 
        t.id === transaction.id ? transaction : t
      ),
    }));
    get().loadDashboardData();
  },

  deleteTransaction: async (id) => {
    console.log('[Store] Deleting transaction:', id);
    try {
      const result = await window.electronAPI.deleteTransaction(id);
      console.log('[Store] Delete result:', result);
      if (result) {
        set((state) => {
          const filtered = state.transactions.filter((t) => t.id !== id);
          console.log('[Store] Transactions after filter:', filtered.length);
          return { transactions: filtered };
        });
        await get().loadDashboardData();
        console.log('[Store] Dashboard reloaded');
      }
    } catch (error) {
      console.error('[Store] Failed to delete transaction:', error);
    }
  },

  // Account actions
  addAccount: async (account) => {
    const newAccount = await window.electronAPI.addAccount(account) as Account;
    set((state) => ({
      accounts: [...state.accounts, newAccount],
    }));
    return newAccount;
  },

  updateAccount: async (account) => {
    await window.electronAPI.updateAccount(account);
    set((state) => ({
      accounts: state.accounts.map((a) => 
        a.id === account.id ? account : a
      ),
    }));
  },

  deleteAccount: async (id) => {
    await window.electronAPI.deleteAccount(id);
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    }));
  },

  // Budget actions
  addBudget: async (budget) => {
    const newBudget = await window.electronAPI.addBudget(budget) as Budget;
    set((state) => ({
      budgets: [...state.budgets, newBudget],
    }));
    return newBudget;
  },

  updateBudget: async (budget) => {
    await window.electronAPI.updateBudget(budget);
    set((state) => ({
      budgets: state.budgets.map((b) => 
        b.id === budget.id ? budget : b
      ),
    }));
  },

  // AI actions
  parseVoiceInput: async (text) => {
    set({ isProcessingVoice: true });
    try {
      const parsed = await window.electronAPI.parseTransaction(text) as ParsedTransaction;
      set({ parsedTransaction: parsed });
      return parsed;
    } finally {
      set({ isProcessingVoice: false });
    }
  },

  processQuery: async (query) => {
    set({ isProcessingVoice: true });
    try {
      return await window.electronAPI.processQuery(query);
    } finally {
      set({ isProcessingVoice: false });
    }
  },

  // Settings
  loadSettings: async () => {
    const settings = await window.electronAPI.getSettings() as Settings;
    set({ settings, theme: settings.theme });
  },

  updateSettings: async (updates) => {
    const settings = await window.electronAPI.setSettings(updates) as Settings;
    set({ settings });
  },

  resetAllData: async () => {
    try {
      await window.electronAPI.resetAllData();
      set({ transactions: [], budgets: [] });
      await get().loadTransactions();
      await get().loadDashboardData();
      await get().loadInsights();
    } catch (error) {
      console.error('Failed to reset data:', error);
    }
  },
}));
