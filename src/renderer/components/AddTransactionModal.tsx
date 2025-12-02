import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface Props {
  onClose: () => void;
}

export default function AddTransactionModal({ onClose }: Props) {
  const { categories, accounts, addTransaction, updateTransaction, editingTransaction, setEditingTransaction, parsedTransaction, setParsedTransaction, loadTransactions, loadDashboardData } = useAppStore();

  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    categoryId: '',
    accountId: accounts[0]?.id || '',
    description: '',
    merchant: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    tags: [] as string[],
  });

  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (parsedTransaction) {
      const category = categories.find(c => c.name.toLowerCase() === parsedTransaction.category?.toLowerCase());
      setFormData({
        type: parsedTransaction.type === 'transfer' ? 'expense' : parsedTransaction.type,
        amount: parsedTransaction.amount.toString(),
        categoryId: category?.id || '',
        accountId: accounts[0]?.id || '',
        description: parsedTransaction.description,
        merchant: parsedTransaction.merchant || '',
        date: parsedTransaction.date,
        notes: '',
        tags: parsedTransaction.tags || [],
      });
    } else if (editingTransaction) {
      setFormData({
        type: editingTransaction.type === 'transfer' ? 'expense' : editingTransaction.type,
        amount: Math.abs(editingTransaction.amount).toString(),
        categoryId: editingTransaction.categoryId,
        accountId: editingTransaction.accountId,
        description: editingTransaction.description,
        merchant: editingTransaction.merchant || '',
        date: editingTransaction.date,
        notes: editingTransaction.notes || '',
        tags: editingTransaction.tags,
      });
    }
  }, [parsedTransaction, editingTransaction, categories, accounts]);

  const filteredCategories = categories.filter(c => c.type === formData.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.categoryId || !formData.accountId) return;

    setIsSubmitting(true);
    try {
      const amount = parseFloat(formData.amount);
      
      if (editingTransaction) {
        await updateTransaction({
          ...editingTransaction,
          type: formData.type,
          amount: formData.type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
          categoryId: formData.categoryId,
          accountId: formData.accountId,
          description: formData.description || 'Transaction',
          merchant: formData.merchant || undefined,
          date: formData.date,
          notes: formData.notes || undefined,
          tags: formData.tags,
        });
      } else {
        await addTransaction({
          type: formData.type,
          amount: formData.type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
          categoryId: formData.categoryId,
          accountId: formData.accountId,
          description: formData.description || 'Transaction',
          merchant: formData.merchant || undefined,
          date: formData.date,
          notes: formData.notes || undefined,
          tags: formData.tags,
          isReconciled: false,
        });
      }

      await Promise.all([loadTransactions(), loadDashboardData()]);
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEditingTransaction(null);
    setParsedTransaction(null);
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-lg glass-surface rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded text-white/70"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Toggle */}
          <div className="flex bg-white/5 rounded-xl p-1">
            <button type="button" onClick={() => setFormData({ ...formData, type: 'expense', categoryId: '' })}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${formData.type === 'expense' ? 'bg-white/10 text-white' : 'text-white/50'}`}>
              Expense
            </button>
            <button type="button" onClick={() => setFormData({ ...formData, type: 'income', categoryId: '' })}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${formData.type === 'income' ? 'bg-white/10 text-white' : 'text-white/50'}`}>
              Income
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">$</span>
              <input type="number" step="0.01" min="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00" className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-2xl font-semibold text-white placeholder-white/30 tabular-nums" required />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Category</label>
            <select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" required>
              <option value="">Select a category</option>
              {filteredCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Account</label>
            <select value={formData.accountId} onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" required>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
            <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What was this for?" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30" />
          </div>

          {/* Merchant and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Merchant</label>
              <input type="text" value={formData.merchant} onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                placeholder="Optional" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Date</label>
              <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Tags</label>
            <div className="flex items-center gap-2 mb-2">
              <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add a tag" className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30" />
              <button type="button" onClick={addTag} className="p-2 bg-white/5 rounded-xl hover:bg-white/10"><Plus size={18} /></button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-mac-accent-blue/20 text-mac-accent-blue rounded-full text-sm">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-white"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-white/70 hover:bg-white/5 rounded-xl">Cancel</button>
            <button type="submit" disabled={isSubmitting || !formData.amount || !formData.categoryId}
              className="px-4 py-2 bg-mac-accent-blue text-white rounded-xl font-medium disabled:opacity-50 hover:bg-blue-500 transition-colors">
              {isSubmitting ? 'Saving...' : editingTransaction ? 'Update' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
