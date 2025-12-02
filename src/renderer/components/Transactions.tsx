import { useState, useMemo } from 'react';
import { Search, ArrowUpRight, ArrowDownRight, Trash2, X, Loader2 } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type { Transaction } from '../../shared/types';

export default function Transactions() {
  const { transactions, categories, accounts, deleteTransaction, loadTransactions, loadDashboardData } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'month' | '3months' | 'year'>('month');
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    const now = new Date();
    if (dateRange === 'month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      result = result.filter(t => {
        const date = parseISO(t.date);
        return date >= start && date <= end;
      });
    } else if (dateRange === '3months') {
      const start = subMonths(now, 3);
      result = result.filter(t => parseISO(t.date) >= start);
    } else if (dateRange === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      result = result.filter(t => parseISO(t.date) >= start);
    }

    if (selectedType !== 'all') {
      result = result.filter(t => t.type === selectedType);
    }

    if (selectedCategory) {
      result = result.filter(t => t.categoryId === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.description.toLowerCase().includes(query) ||
        t.merchant?.toLowerCase().includes(query) ||
        categoryMap.get(t.categoryId)?.name.toLowerCase().includes(query)
      );
    }

    return result;
  }, [transactions, dateRange, selectedType, selectedCategory, searchQuery, categoryMap]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const transaction of filteredTransactions) {
      const dateKey = transaction.date;
      const existing = groups.get(dateKey) || [];
      groups.set(dateKey, [...existing, transaction]);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  const totals = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const expenses = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return { income, expenses, net: income - expenses };
  }, [filteredTransactions]);

  const handleDelete = async (id: string) => {
    console.log('Transactions: handleDelete called', id);
    setDeletingId(id);
    try {
      await deleteTransaction(id);
      console.log('Transactions: deleteTransaction completed');
    } catch (error) {
      console.error('Transactions: delete failed', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearTransactions = async (count: number | 'all') => {
    console.log('Clear transactions:', count, 'Total available:', transactions.length);
    setIsClearing(true);
    try {
      const toDelete = count === 'all' 
        ? [...transactions] 
        : transactions.slice(0, Math.min(count as number, transactions.length));
      
      console.log('Deleting', toDelete.length, 'transactions');
      
      for (const t of toDelete) {
        console.log('Deleting:', t.id);
        await window.electronAPI.deleteTransaction(t.id);
      }
      
      console.log('All deleted, reloading...');
      await loadTransactions();
      await loadDashboardData();
      console.log('Reload complete');
    } catch (error) {
      console.error('Clear transactions failed:', error);
    } finally {
      setIsClearing(false);
      setShowClearModal(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Transactions</h1>
          <p className="text-white/50">{filteredTransactions.length} transactions</p>
        </div>
        <button
          onClick={() => setShowClearModal(true)}
          disabled={transactions.length === 0}
          className="px-4 py-2 text-mac-accent-red bg-mac-accent-red/10 hover:bg-mac-accent-red/20 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear Transactions
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 glass-card rounded-xl">
          <p className="text-sm text-white/50">Income</p>
          <p className="text-xl font-semibold text-mac-accent-green tabular-nums">+${totals.income.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="p-4 glass-card rounded-xl">
          <p className="text-sm text-white/50">Expenses</p>
          <p className="text-xl font-semibold text-mac-accent-red tabular-nums">-${totals.expenses.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="p-4 glass-card rounded-xl">
          <p className="text-sm text-white/50">Net</p>
          <p className={`text-xl font-semibold tabular-nums ${totals.net >= 0 ? 'text-mac-accent-green' : 'text-mac-accent-red'}`}>
            {totals.net >= 0 ? '+' : '-'}${Math.abs(totals.net).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-mac-accent-blue focus:outline-none"
          />
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white"
        >
          <option value="month">This Month</option>
          <option value="3months">Last 3 Months</option>
          <option value="year">This Year</option>
          <option value="all">All Time</option>
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as typeof selectedType)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white"
        >
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
        </select>

        <select
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Transactions List */}
      <div className="glass-card rounded-xl overflow-hidden">
        {groupedTransactions.length === 0 ? (
          <div className="p-8 text-center text-white/50">No transactions found</div>
        ) : (
          <div className="divide-y divide-white/5">
            {groupedTransactions.map(([date, dayTransactions]) => (
              <div key={date}>
                <div className="px-4 py-2 bg-white/5">
                  <span className="text-sm font-medium text-white/50">
                    {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>

                <div className="divide-y divide-white/5">
                  {dayTransactions.map((transaction) => {
                    const category = categoryMap.get(transaction.categoryId);
                    const account = accountMap.get(transaction.accountId);
                    const isIncome = transaction.type === 'income';
                    const isDeleting = deletingId === transaction.id;

                    return (
                      <div key={transaction.id} className={`px-4 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors group ${isDeleting ? 'opacity-50' : ''}`}>
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${category?.color}20` }}
                        >
                          {isIncome ? <ArrowUpRight size={18} className="text-mac-accent-green" /> : <ArrowDownRight size={18} className="text-mac-accent-red" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">{transaction.description}</p>
                            {transaction.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                {transaction.tags.slice(0, 2).map(tag => (
                                  <span key={tag} className="px-1.5 py-0.5 text-xs bg-white/10 rounded text-white/60">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-white/50">
                            <span style={{ color: category?.color }}>{category?.name}</span>
                            {transaction.merchant && <><span>•</span><span>{transaction.merchant}</span></>}
                            <span>•</span>
                            <span>{account?.name}</span>
                          </div>
                        </div>

                        <div className="text-right mr-2">
                          <p className={`font-medium tabular-nums ${isIncome ? 'text-mac-accent-green' : 'text-white'}`}>
                            {isIncome ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Delete clicked for:', transaction.id);
                            handleDelete(transaction.id);
                          }}
                          disabled={isDeleting}
                          className="p-2 text-mac-accent-red/70 hover:text-mac-accent-red hover:bg-mac-accent-red/10 rounded-lg transition-colors"
                        >
                          {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clear Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-sm glass-surface rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Clear Transactions</h3>
              <button onClick={() => !isClearing && setShowClearModal(false)} className="p-1 hover:bg-white/10 rounded" disabled={isClearing}>
                <X size={20} className="text-white/70" />
              </button>
            </div>
            <p className="text-white/60 mb-6">Choose how many recent transactions to delete:</p>
            <div className="space-y-2">
              <button
                onClick={() => handleClearTransactions(5)}
                disabled={isClearing || transactions.length === 0}
                className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isClearing ? <Loader2 size={16} className="animate-spin" /> : null}
                Last 5 transactions
              </button>
              <button
                onClick={() => handleClearTransactions(10)}
                disabled={isClearing || transactions.length === 0}
                className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isClearing ? <Loader2 size={16} className="animate-spin" /> : null}
                Last 10 transactions
              </button>
              <button
                onClick={() => handleClearTransactions('all')}
                disabled={isClearing || transactions.length === 0}
                className="w-full py-3 bg-mac-accent-red/20 hover:bg-mac-accent-red/30 rounded-xl text-mac-accent-red transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isClearing ? <Loader2 size={16} className="animate-spin" /> : null}
                Clear all ({transactions.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
