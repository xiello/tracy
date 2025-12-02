import { useState } from 'react';
import { Plus, Edit, AlertCircle, X, Zap } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { Budget, Category } from '../../shared/types';

const BUDGET_PRESETS = [
  { name: 'Groceries', amount: 400, category: 'Groceries' },
  { name: 'Rent/Mortgage', amount: 1000, category: 'Rent/Mortgage' },
  { name: 'Gas', amount: 150, category: 'Gas' },
  { name: 'Dining Out', amount: 200, category: 'Dining Out' },
  { name: 'Entertainment', amount: 100, category: 'Entertainment' },
  { name: 'Utilities', amount: 150, category: 'Utilities' },
  { name: 'Shopping', amount: 200, category: 'Shopping' },
  { name: 'Healthcare', amount: 100, category: 'Healthcare' },
];

export default function Budgets() {
  const { budgets, categories, transactions, addBudget, updateBudget } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const categoryByName = new Map(categories.map(c => [c.name, c]));
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const existingBudgetCategories = new Set(budgets.map(b => b.categoryId));

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const budgetProgress = budgets.map(budget => {
    const spent = transactions
      .filter(t => t.categoryId === budget.categoryId && t.type === 'expense' && new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const percentage = (spent / budget.amount) * 100;
    const remaining = budget.amount - spent;
    const category = categoryMap.get(budget.categoryId);
    return { budget, spent, percentage, remaining, category };
  });

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgetProgress.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;

  const handleAddPreset = async (preset: typeof BUDGET_PRESETS[0]) => {
    const category = categoryByName.get(preset.category);
    if (!category || existingBudgetCategories.has(category.id)) return;
    
    await addBudget({
      categoryId: category.id,
      amount: preset.amount,
      period: 'monthly',
      startDate: format(monthStart, 'yyyy-MM-dd'),
      isRolling: false,
    });
  };

  const availablePresets = BUDGET_PRESETS.filter(p => {
    const cat = categoryByName.get(p.category);
    return cat && !existingBudgetCategories.has(cat.id);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Budgets</h1>
          <p className="text-white/50">{format(now, 'MMMM yyyy')}</p>
        </div>
        <div className="flex gap-2">
          {availablePresets.length > 0 && (
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-2 px-4 py-2 glass-card text-white/70 hover:text-white rounded-xl font-medium transition-colors"
            >
              <Zap size={18} />
              Quick Add
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-mac-accent-blue text-white rounded-xl font-medium hover:bg-blue-500 transition-colors">
            <Plus size={18} />
            Add Budget
          </button>
        </div>
      </div>

      {/* Quick Presets */}
      <AnimatePresence>
        {showPresets && availablePresets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 glass-card rounded-xl">
              <p className="text-sm text-white/50 mb-3">Quick budget presets:</p>
              <div className="flex flex-wrap gap-2">
                {availablePresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handleAddPreset(preset)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
                  >
                    <span>{preset.name}</span>
                    <span className="text-white/50">€{preset.amount}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overall Summary */}
      <div className="p-6 glass-card rounded-xl">
        <h3 className="text-lg font-medium text-white mb-4">Monthly Overview</h3>
        <div className="grid grid-cols-3 gap-8">
          <div>
            <p className="text-sm text-white/50">Total Budgeted</p>
            <p className="text-2xl font-semibold tabular-nums text-white">€{totalBudgeted.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-sm text-white/50">Spent</p>
            <p className="text-2xl font-semibold tabular-nums text-white">€{totalSpent.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-sm text-white/50">Remaining</p>
            <p className={`text-2xl font-semibold tabular-nums ${totalRemaining >= 0 ? 'text-mac-accent-green' : 'text-mac-accent-red'}`}>
              €{Math.abs(totalRemaining).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        
        {totalBudgeted > 0 && (
          <div className="mt-4">
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${totalSpent > totalBudgeted ? 'bg-mac-accent-red' : 'bg-mac-accent-blue'}`} style={{ width: `${Math.min((totalSpent / totalBudgeted) * 100, 100)}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-xs text-white/50">
              <span>{Math.round((totalSpent / totalBudgeted) * 100)}% used</span>
              <span>{Math.max(0, Math.round(100 - (totalSpent / totalBudgeted) * 100))}% remaining</span>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 bg-mac-accent-blue/10 border border-mac-accent-blue/20 rounded-xl">
        <p className="text-sm text-white/70">
          💡 Budgets track spending by category. When you add an expense, it automatically counts toward that category's budget.
        </p>
      </div>

      {/* Budget Cards */}
      <div className="grid grid-cols-2 gap-4">
        {budgetProgress.length === 0 ? (
          <div className="col-span-2 p-8 glass-card rounded-xl text-center">
            <p className="text-white/50 mb-4">No budgets set up yet</p>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-mac-accent-blue text-white rounded-xl font-medium">Create Your First Budget</button>
          </div>
        ) : (
          budgetProgress.map(({ budget, spent, percentage, remaining, category }) => {
            const isOver = spent > budget.amount;
            const isNearLimit = percentage >= 80 && !isOver;

            return (
              <div key={budget.id} className="p-4 glass-card rounded-xl">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${category?.color}20` }}>
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: category?.color }} />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{category?.name}</h4>
                      <p className="text-sm text-white/50 capitalize">{budget.period}</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingBudget(budget)} className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white">
                    <Edit size={16} />
                  </button>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className={isOver ? 'text-mac-accent-red' : 'text-white'}>€{spent.toFixed(2)}</span>
                    <span className="text-white/50">€{budget.amount.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isOver ? 'bg-mac-accent-red' : isNearLimit ? 'bg-mac-accent-orange' : 'bg-mac-accent-green'}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  {isOver ? (
                    <span className="flex items-center gap-1 text-mac-accent-red"><AlertCircle size={14} />Over by €{Math.abs(remaining).toFixed(2)}</span>
                  ) : (
                    <span className="text-white/50">€{remaining.toFixed(2)} left</span>
                  )}
                  <span className="text-white/50">{Math.round(percentage)}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {(showAddModal || editingBudget) && (
          <BudgetModal
            budget={editingBudget}
            categories={expenseCategories.filter(c => editingBudget?.categoryId === c.id || !existingBudgetCategories.has(c.id))}
            onSave={async (data) => {
              if (editingBudget) {
                await updateBudget({ ...editingBudget, ...data });
              } else {
                await addBudget({ ...data, period: 'monthly', startDate: format(monthStart, 'yyyy-MM-dd'), isRolling: false });
              }
              setShowAddModal(false);
              setEditingBudget(null);
            }}
            onClose={() => { setShowAddModal(false); setEditingBudget(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface BudgetModalProps {
  budget?: Budget | null;
  categories: Category[];
  onSave: (data: { categoryId: string; amount: number }) => Promise<void>;
  onClose: () => void;
}

function BudgetModal({ budget, categories, onSave, onClose }: BudgetModalProps) {
  const [categoryId, setCategoryId] = useState(budget?.categoryId || '');
  const [amount, setAmount] = useState(budget?.amount.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amount) return;
    setIsSubmitting(true);
    try { await onSave({ categoryId, amount: parseFloat(amount) }); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md glass-surface rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{budget ? 'Edit Budget' : 'Add Budget'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-white/70"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" required disabled={!!budget}>
              <option value="">Select a category</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Monthly Budget</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">€</span>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xl font-semibold text-white placeholder-white/30" required />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-white/70 hover:bg-white/5 rounded-xl">Cancel</button>
            <button type="submit" disabled={isSubmitting || !categoryId || !amount} className="px-4 py-2 bg-mac-accent-blue text-white rounded-xl font-medium disabled:opacity-50">
              {isSubmitting ? 'Saving...' : budget ? 'Update' : 'Add Budget'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
