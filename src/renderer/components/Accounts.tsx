import { useState } from 'react';
import { Plus, Wallet, CreditCard, PiggyBank, Landmark, Coins, Edit, Trash2, X } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import type { Account } from '../../shared/types';

const accountIcons = {
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Coins,
  investment: Wallet,
};

const accountColors = ['#0071e3', '#34c759', '#ff9500', '#ff3b30', '#af52de', '#5856d6', '#ff2d55', '#30b0c7', '#ffcc00', '#8e8e93'];

export default function Accounts() {
  const { accounts, addAccount, updateAccount, deleteAccount, transactions } = useAppStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalAssets = accounts.filter(a => a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.balance < 0).reduce((sum, a) => sum + Math.abs(a.balance), 0);

  const handleDelete = async (id: string) => {
    const hasTransactions = transactions.some(t => t.accountId === id);
    if (hasTransactions) {
      alert('Cannot delete account with transactions.');
      return;
    }
    if (confirm('Delete this account?')) {
      await deleteAccount(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Accounts</h1>
          <p className="text-white/50">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-mac-accent-blue text-white rounded-xl font-medium hover:bg-blue-500 transition-colors">
          <Plus size={18} />
          Add Account
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 glass-card rounded-xl">
          <p className="text-sm text-white/50">Net Worth</p>
          <p className={`text-2xl font-semibold tabular-nums ${totalBalance >= 0 ? 'text-mac-accent-green' : 'text-mac-accent-red'}`}>
            ${totalBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 glass-card rounded-xl">
          <p className="text-sm text-white/50">Assets</p>
          <p className="text-2xl font-semibold tabular-nums text-mac-accent-green">${totalAssets.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="p-4 glass-card rounded-xl">
          <p className="text-sm text-white/50">Liabilities</p>
          <p className="text-2xl font-semibold tabular-nums text-mac-accent-red">${totalLiabilities.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Accounts List */}
      <div className="glass-card rounded-xl overflow-hidden">
        {accounts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-white/50 mb-4">No accounts yet</p>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-mac-accent-blue text-white rounded-xl font-medium">Add Your First Account</button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {accounts.map((account) => {
              const Icon = accountIcons[account.type];
              
              return (
                <div key={account.id} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors group">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${account.color}20` }}>
                    <Icon size={24} style={{ color: account.color }} />
                  </div>

                  <div className="flex-1">
                    <h4 className="font-medium text-white">{account.name}</h4>
                    <p className="text-sm text-white/50 capitalize">{account.type} • {account.currency}</p>
                  </div>

                  <div className="text-right mr-4">
                    <p className={`text-lg font-semibold tabular-nums ${account.balance < 0 ? 'text-mac-accent-red' : 'text-white'}`}>
                      ${account.balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <button onClick={() => setEditingAccount(account)} className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => handleDelete(account.id)} className="p-2 text-white/30 hover:text-mac-accent-red hover:bg-mac-accent-red/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {(showAddModal || editingAccount) && (
          <AccountModal
            account={editingAccount}
            onSave={async (data) => {
              if (editingAccount) {
                await updateAccount({ ...editingAccount, ...data });
              } else {
                await addAccount({ ...data, isActive: true });
              }
              setShowAddModal(false);
              setEditingAccount(null);
            }}
            onClose={() => { setShowAddModal(false); setEditingAccount(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface AccountModalProps {
  account?: Account | null;
  onSave: (data: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) => Promise<void>;
  onClose: () => void;
}

function AccountModal({ account, onClose, onSave }: AccountModalProps) {
  const [formData, setFormData] = useState({
    name: account?.name || '',
    type: account?.type || 'checking' as Account['type'],
    balance: account?.balance.toString() || '0',
    currency: account?.currency || 'USD',
    color: account?.color || accountColors[0],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);
    try {
      await onSave({ name: formData.name, type: formData.type, balance: parseFloat(formData.balance) || 0, currency: formData.currency, color: formData.color });
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md glass-surface rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">{account ? 'Edit Account' : 'Add Account'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-white/70"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Name</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Account name" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as Account['type'] })} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white">
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
              <option value="cash">Cash</option>
              <option value="investment">Investment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Current Balance</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">$</span>
              <input type="number" step="0.01" value={formData.balance} onChange={(e) => setFormData({ ...formData, balance: e.target.value })} placeholder="0.00" className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30" />
            </div>
            <p className="text-xs text-white/40 mt-1">Use negative for credit card debt</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {accountColors.map((color) => (
                <button key={color} type="button" onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${formData.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-white/70 hover:bg-white/5 rounded-xl">Cancel</button>
            <button type="submit" disabled={isSubmitting || !formData.name} className="px-4 py-2 bg-mac-accent-blue text-white rounded-xl font-medium disabled:opacity-50">
              {isSubmitting ? 'Saving...' : account ? 'Update' : 'Add Account'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
