import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Sparkles, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { transactions, categories, accounts, budgets, processQuery } = useAppStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getFinancialContext = () => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const last30Days = subDays(now, 30);

    const thisMonthTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    });

    const totalIncome = thisMonthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalExpenses = thisMonthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome * 100) : 0;

    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const categorySpending = new Map<string, number>();
    thisMonthTransactions.filter(t => t.type === 'expense').forEach(t => {
      categorySpending.set(t.categoryId, (categorySpending.get(t.categoryId) || 0) + Math.abs(t.amount));
    });

    const topCategories = Array.from(categorySpending.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, amount]) => ({ name: categoryMap.get(id)?.name || 'Unknown', amount }));

    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

    const budgetStatus = budgets.map(b => {
      const cat = categoryMap.get(b.categoryId);
      const spent = thisMonthTransactions
        .filter(t => t.categoryId === b.categoryId && t.type === 'expense')
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      return { category: cat?.name || 'Unknown', budget: b.amount, spent, remaining: b.amount - spent };
    });

    const recentTransactions = transactions
      .filter(t => new Date(t.date) >= last30Days)
      .slice(0, 10)
      .map(t => ({
        date: t.date,
        type: t.type,
        amount: Math.abs(t.amount),
        description: t.description,
        category: categoryMap.get(t.categoryId)?.name || 'Unknown'
      }));

    return {
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
      totalBalance,
      topCategories,
      budgetStatus,
      recentTransactions,
      transactionCount: transactions.length,
      accountCount: accounts.length,
      budgetCount: budgets.length
    };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const query = input;
    setInput('');
    setIsLoading(true);

    try {
      // Try to use the backend AI service first
      let response: string;
      
      try {
        response = await processQuery(query);
        // If response is generic fallback, use local analysis
        if (response.includes("I can help you with questions about")) {
          throw new Error('Use local');
        }
      } catch {
        // Fall back to local analysis
        const context = getFinancialContext();
        response = analyzeLocally(query, context);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, I couldn't process that. Try asking about spending, income, budgets, or savings.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeLocally = (query: string, context: ReturnType<typeof getFinancialContext>): string => {
    const q = query.toLowerCase();

    if (q.includes('spend') || q.includes('expense') || q.includes('spent')) {
      if (context.topCategories.length === 0) {
        return "You haven't recorded any expenses this month yet.";
      }
      const list = context.topCategories.map((c, i) => `${i + 1}. ${c.name}: €${c.amount.toFixed(2)}`).join('\n');
      return `Here's where you spent the most this month:\n\n${list}\n\nTotal expenses: €${context.totalExpenses.toFixed(2)}`;
    }

    if (q.includes('income') || q.includes('earn') || q.includes('made')) {
      return `Your total income this month is €${context.totalIncome.toFixed(2)}. ${
        context.savingsRate >= 20 
          ? `Great job! You're saving ${context.savingsRate.toFixed(1)}% of your income.` 
          : context.savingsRate > 0 
            ? `You're saving ${context.savingsRate.toFixed(1)}% of your income.`
            : `You're spending more than you earn.`
      }`;
    }

    if (q.includes('save') || q.includes('saving')) {
      if (context.netSavings < 0) {
        return `You're spending €${Math.abs(context.netSavings).toFixed(2)} more than you earn this month.`;
      }
      return `You've saved €${context.netSavings.toFixed(2)} this month (${context.savingsRate.toFixed(1)}% of income).`;
    }

    if (q.includes('balance') || q.includes('total') || q.includes('have')) {
      const breakdown = accounts.map(a => `• ${a.name}: €${a.balance.toFixed(2)}`).join('\n');
      return `Your total balance is €${context.totalBalance.toFixed(2)}.\n\n${breakdown}`;
    }

    if (q.includes('budget')) {
      if (context.budgetStatus.length === 0) {
        return "You haven't set up any budgets yet. Go to the Budgets section!";
      }
      const status = context.budgetStatus.map(b => {
        const pct = (b.spent / b.budget * 100).toFixed(0);
        const emoji = b.spent > b.budget ? '🔴' : b.spent > b.budget * 0.8 ? '🟡' : '🟢';
        return `${emoji} ${b.category}: €${b.spent.toFixed(2)} / €${b.budget.toFixed(2)} (${pct}%)`;
      }).join('\n');
      return `Budget status:\n\n${status}`;
    }

    if (q.includes('summary') || q.includes('overview')) {
      return `📊 ${format(new Date(), 'MMMM yyyy')} Summary:

💰 Income: €${context.totalIncome.toFixed(2)}
💸 Expenses: €${context.totalExpenses.toFixed(2)}
${context.netSavings >= 0 ? '✅' : '⚠️'} Net: ${context.netSavings >= 0 ? '+' : '-'}€${Math.abs(context.netSavings).toFixed(2)}
📈 Savings Rate: ${context.savingsRate.toFixed(1)}%
🏦 Balance: €${context.totalBalance.toFixed(2)}`;
    }

    if (q.includes('advice') || q.includes('suggest') || q.includes('tip')) {
      const tips: string[] = [];
      if (context.savingsRate < 10) tips.push("• Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.");
      if (context.budgetStatus.some(b => b.spent > b.budget)) {
        tips.push("• You're over budget in some categories. Review your spending.");
      }
      if (context.netSavings < 0) tips.push("• You're spending more than you earn. Cut non-essentials.");
      return tips.length > 0 ? `Tips:\n\n${tips.join('\n\n')}` : "You're doing great! Keep tracking.";
    }

    return `Quick stats:
• Balance: €${context.totalBalance.toFixed(2)}
• This Month: ${context.netSavings >= 0 ? 'Saved' : 'Overspent'} €${Math.abs(context.netSavings).toFixed(2)}
• Transactions: ${context.transactionCount}

Ask about spending, income, budgets, or savings!`;
  };

  const quickPrompts = [
    { icon: TrendingDown, text: "How much did I spend this month?" },
    { icon: TrendingUp, text: "What's my income summary?" },
    { icon: PiggyBank, text: "Show me my budget status" },
    { icon: Sparkles, text: "Give me a financial summary" },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mac-accent-purple to-mac-accent-blue flex items-center justify-center">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-white">Tracy</h2>
          <p className="text-sm text-white/50">Your financial assistant</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <Sparkles size={48} className="text-white/20 mb-4" />
            <p className="text-white/50 mb-6">Ask me anything about your finances</p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(prompt.text); inputRef.current?.focus(); }}
                  className="flex items-center gap-2 p-3 glass-card rounded-xl text-left text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <prompt.icon size={18} />
                  <span className="text-sm">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user' ? 'bg-mac-accent-blue' : 'bg-gradient-to-br from-mac-accent-purple to-mac-accent-blue'
                }`}>
                  {message.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
                </div>
                <div className={`max-w-[80%] p-3 rounded-2xl ${
                  message.role === 'user' ? 'bg-mac-accent-blue text-white rounded-br-md' : 'glass-card text-white rounded-bl-md'
                }`}>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  <p className="text-xs mt-1 opacity-50">{format(message.timestamp, 'HH:mm')}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-mac-accent-purple to-mac-accent-blue flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="glass-card p-3 rounded-2xl rounded-bl-md">
              <Loader2 size={18} className="animate-spin text-white/50" />
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="glass-card rounded-xl p-2 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your finances..."
          className="flex-1 px-3 py-2 bg-transparent text-white placeholder-white/40 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className={`p-2 rounded-lg transition-all ${
            input.trim() && !isLoading ? 'bg-mac-accent-blue text-white hover:bg-blue-500' : 'text-white/30 cursor-not-allowed'
          }`}
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
