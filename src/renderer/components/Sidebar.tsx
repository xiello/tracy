import { 
  LayoutDashboard, 
  Receipt, 
  PiggyBank, 
  Wallet, 
  Settings,
  Bitcoin,
  Bot
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import QuickInput from './QuickInput';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'crypto', label: 'Crypto', icon: Bitcoin },
  { id: 'chat', label: 'Tracy', icon: Bot },
] as const;

export default function Sidebar() {
  const { currentView, setCurrentView, accounts } = useAppStore();

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <aside className="w-72 h-full glass-sidebar border-r border-white/10 flex flex-col">
      {/* Header with drag region */}
      <div className="titlebar h-12 flex items-center px-4">
        <div className="w-20" /> {/* Space for traffic lights */}
      </div>

      {/* Quick Input Chat */}
      <div className="px-4 pb-4">
        <QuickInput />
      </div>

      {/* Balance Overview */}
      <div className="px-4 pb-4">
        <div className="p-4 glass-card rounded-xl">
          <p className="text-xs text-white/50 mb-1">
            Total Balance
          </p>
          <p className="text-2xl font-semibold tabular-nums text-white">
            ${totalBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2">
        <ul className="space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                onClick={() => setCurrentView(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  currentView === id
                    ? 'bg-white/10 text-white shadow-lg'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span className="font-medium">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Accounts Quick View */}
      <div className="px-4 py-4 border-t border-white/10">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2">
          Accounts
        </h3>
        <ul className="space-y-2">
          {accounts.slice(0, 4).map((account) => (
            <li key={account.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: account.color }}
                />
                <span className="truncate text-white/70">{account.name}</span>
              </div>
              <span className="tabular-nums font-medium text-white">
                ${account.balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Settings */}
      <div className="px-2 pb-4">
        <button
          onClick={() => setCurrentView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
            currentView === 'settings'
              ? 'bg-white/10 text-white'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Settings size={18} />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}
