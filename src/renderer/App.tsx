import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Budgets from './components/Budgets';
import Accounts from './components/Accounts';
import Settings from './components/Settings';
import Crypto from './components/Crypto';
import AIChat from './components/AIChat';
import AddTransactionModal from './components/AddTransactionModal';

export default function App() {
  const { 
    currentView, 
    initialize, 
    showAddTransaction,
    setShowAddTransaction 
  } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'transactions':
        return <Transactions />;
      case 'budgets':
        return <Budgets />;
      case 'accounts':
        return <Accounts />;
      case 'crypto':
        return <Crypto />;
      case 'chat':
        return <AIChat />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Title Bar */}
        <div className="titlebar h-12 flex items-center justify-center px-4 border-b border-white/5">
          <div className="flex-1" /> {/* Spacer for traffic lights */}
          <h1 className="text-sm font-medium text-white/50">
            Tracy
          </h1>
          <div className="flex-1" />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {renderView()}
        </div>
      </main>

      {/* Modals */}
      {showAddTransaction && (
        <AddTransactionModal onClose={() => setShowAddTransaction(false)} />
      )}
    </div>
  );
}
