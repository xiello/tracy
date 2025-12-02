import { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PiggyBank,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  X
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler);

ChartJS.defaults.color = 'rgba(255, 255, 255, 0.6)';
ChartJS.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

export default function Dashboard() {
  const { dashboardData, insights, isLoading, loadDashboardData, categories, resetAllData } = useAppStore();
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleReset = async () => {
    if (confirmText !== 'RESET') return;
    setIsResetting(true);
    try {
      await resetAllData();
      setShowResetModal(false);
      setConfirmText('');
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading || !dashboardData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mac-accent-blue" />
      </div>
    );
  }

  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const spendingChartData = {
    labels: dashboardData.topCategories.map(c => c.category.name),
    datasets: [{
      data: dashboardData.topCategories.map(c => c.amount),
      backgroundColor: dashboardData.topCategories.map(c => c.category.color),
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  const trendChartData = {
    labels: dashboardData.monthlyTrend.map(m => format(new Date(m.month + '-01'), 'MMM')),
    datasets: [
      {
        label: 'Income',
        data: dashboardData.monthlyTrend.map(m => m.income),
        backgroundColor: 'rgba(52, 199, 89, 0.8)',
        borderRadius: 4,
      },
      {
        label: 'Expenses',
        data: dashboardData.monthlyTrend.map(m => m.expenses),
        backgroundColor: 'rgba(255, 59, 48, 0.8)',
        borderRadius: 4,
      },
    ],
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-white/50">{format(new Date(), 'MMMM yyyy')} Overview</p>
        </div>
        <button
          onClick={() => setShowResetModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-mac-accent-red bg-mac-accent-red/10 hover:bg-mac-accent-red/20 rounded-xl font-medium transition-colors"
        >
          <Trash2 size={18} />
          Reset All Data
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Income" value={dashboardData.totalIncome} icon={TrendingUp} color="green" />
        <StatCard title="Expenses" value={dashboardData.totalExpenses} icon={TrendingDown} color="red" />
        <StatCard title="Net Savings" value={dashboardData.netSavings} icon={PiggyBank} color={dashboardData.netSavings >= 0 ? 'green' : 'red'} />
        <StatCard title="Savings Rate" value={dashboardData.savingsRate} icon={Wallet} color="blue" isPercentage />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.slice(0, 3).map((insight) => (
            <div 
              key={insight.id}
              className={`p-4 rounded-xl glass-card ${
                insight.priority === 'high' ? 'border-mac-accent-red/50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertCircle 
                  size={20} 
                  className={
                    insight.priority === 'high' ? 'text-mac-accent-red' : 
                    insight.priority === 'medium' ? 'text-mac-accent-orange' : 'text-mac-accent-blue'
                  }
                />
                <div>
                  <h4 className="font-medium text-white">{insight.title}</h4>
                  <p className="text-sm text-white/50">{insight.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="p-6 glass-card rounded-xl">
          <h3 className="text-lg font-medium text-white mb-4">Spending by Category</h3>
          <div className="h-64 flex items-center justify-center">
            {dashboardData.topCategories.length > 0 ? (
              <Doughnut 
                data={spendingChartData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: { usePointStyle: true, padding: 16, color: 'rgba(255,255,255,0.7)' },
                    },
                  },
                  cutout: '65%',
                }}
              />
            ) : (
              <p className="text-white/50">No spending data yet</p>
            )}
          </div>
        </div>

        <div className="p-6 glass-card rounded-xl">
          <h3 className="text-lg font-medium text-white mb-4">Monthly Trend</h3>
          <div className="h-64">
            <Bar 
              data={trendChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                    align: 'end',
                    labels: { usePointStyle: true, padding: 16, color: 'rgba(255,255,255,0.7)' },
                  },
                },
                scales: {
                  x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } },
                  y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)' } },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Budget Progress */}
      {dashboardData.budgetProgress.length > 0 && (
        <div className="p-6 glass-card rounded-xl">
          <h3 className="text-lg font-medium text-white mb-4">Budget Progress</h3>
          <div className="space-y-4">
            {dashboardData.budgetProgress.map((item) => {
              const percentage = Math.min((item.spent / item.budget.amount) * 100, 100);
              const isOver = item.spent > item.budget.amount;
              
              return (
                <div key={item.budget.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.category.color }} />
                      <span className="font-medium text-white">{item.category.name}</span>
                    </div>
                    <div className="text-sm">
                      <span className={isOver ? 'text-mac-accent-red' : 'text-white'}>${item.spent.toFixed(2)}</span>
                      <span className="text-white/50"> / ${item.budget.amount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${isOver ? 'bg-mac-accent-red' : 'bg-mac-accent-green'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="p-6 glass-card rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Recent Transactions</h3>
          <button 
            onClick={() => useAppStore.getState().setCurrentView('transactions')}
            className="text-sm text-mac-accent-blue hover:underline"
          >
            View All
          </button>
        </div>
        <div className="space-y-3">
          {dashboardData.recentTransactions.slice(0, 5).map((transaction) => {
            const category = categoryMap.get(transaction.categoryId);
            const isIncome = transaction.type === 'income';

            return (
              <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${category?.color}20` }}>
                    {isIncome ? <ArrowUpRight size={18} className="text-mac-accent-green" /> : <ArrowDownRight size={18} className="text-mac-accent-red" />}
                  </div>
                  <div>
                    <p className="font-medium text-white">{transaction.description}</p>
                    <p className="text-sm text-white/50">{category?.name} • {format(new Date(transaction.date), 'MMM d')}</p>
                  </div>
                </div>
                <span className={`font-medium tabular-nums ${isIncome ? 'text-mac-accent-green' : 'text-white'}`}>
                  {isIncome ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                </span>
              </div>
            );
          })}
          {dashboardData.recentTransactions.length === 0 && (
            <p className="text-center text-white/50 py-8">No transactions yet. Add your first one!</p>
          )}
        </div>
      </div>

      {/* Reset Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-surface rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertCircle size={20} className="text-mac-accent-red" />
                  Reset All Data
                </h3>
                <button onClick={() => { setShowResetModal(false); setConfirmText(''); }} className="p-1 hover:bg-white/10 rounded">
                  <X size={20} className="text-white/70" />
                </button>
              </div>
              
              <p className="text-white/70 mb-4">
                This will permanently delete all your transactions and budgets, and reset all account balances to $0. This action cannot be undone.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm text-white/50 mb-2">Type <span className="font-mono text-mac-accent-red">RESET</span> to confirm:</label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type RESET"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-mac-accent-red focus:outline-none"
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowResetModal(false); setConfirmText(''); }}
                  className="px-4 py-2 text-white/70 hover:bg-white/5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={confirmText !== 'RESET' || isResetting}
                  className="px-4 py-2 bg-mac-accent-red text-white rounded-xl font-medium disabled:opacity-50 hover:bg-red-600 transition-colors"
                >
                  {isResetting ? 'Resetting...' : 'Reset Everything'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, isPercentage = false }: { 
  title: string; value: number; icon: React.ElementType; color: string; isPercentage?: boolean;
}) {
  const colorClasses = {
    green: 'text-mac-accent-green bg-mac-accent-green/20',
    red: 'text-mac-accent-red bg-mac-accent-red/20',
    blue: 'text-mac-accent-blue bg-mac-accent-blue/20',
  };
  
  return (
    <div className="p-4 glass-card rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/50">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-white">
        {isPercentage ? `${value.toFixed(1)}%` : `€${value.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
      </p>
    </div>
  );
}
