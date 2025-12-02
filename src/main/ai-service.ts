import { Database } from './database';
import type { ParsedTransaction, AIInsight, Settings } from '../shared/types';
import { generateText, generateObject } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

// Response cache for common queries
const responseCache = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Transaction parsing schema for structured output
const TransactionSchema = z.object({
  amount: z.number().describe('The transaction amount as a positive number'),
  type: z.enum(['income', 'expense']).describe('Whether this is income or expense'),
  category: z.string().describe('The category that best matches this transaction'),
  merchant: z.string().nullable().describe('The merchant or store name if mentioned'),
  description: z.string().describe('A brief description of the transaction'),
  date: z.string().describe('The date in YYYY-MM-DD format'),
  confidence: z.number().min(0).max(1).describe('Confidence score from 0 to 1'),
});

export class AIService {
  private db: Database;
  private settings: Settings | null = null;
  private ollamaProvider: ReturnType<typeof createOpenAICompatible> | null = null;

  constructor(db: Database) {
    this.db = db;
  }

  private getSettings(): Settings {
    if (!this.settings) {
      this.settings = this.db.getSettings();
    }
    return this.settings;
  }

  private getModel() {
    const settings = this.getSettings();
    
    if (settings.aiProvider === 'openai' && settings.openaiApiKey) {
      return openai(settings.ollamaModel || 'gpt-4o-mini');
    }
    
    if (settings.aiProvider === 'anthropic' && settings.anthropicApiKey) {
      return anthropic(settings.ollamaModel || 'claude-3-haiku-20240307');
    }
    
    // Default: Ollama via OpenAI-compatible API
    if (!this.ollamaProvider) {
      this.ollamaProvider = createOpenAICompatible({
        name: 'ollama',
        baseURL: `${settings.ollamaEndpoint || 'http://localhost:11434'}/v1`,
      });
    }
    return this.ollamaProvider(settings.ollamaModel || 'llama3.2');
  }

  async parseTransaction(text: string): Promise<ParsedTransaction> {
    // Try rule-based parsing first (fast)
    const rulesBased = this.parseWithRules(text);
    
    // If high confidence, return immediately
    if (rulesBased.confidence >= 0.75) {
      return rulesBased;
    }

    const settings = this.getSettings();
    
    // Try AI SDK for structured output
    try {
      const categories = this.db.getCategories();
      const categoryList = categories.map(c => c.name).slice(0, 15).join(', ');
      
      const result = await generateObject({
        model: this.getModel(),
        schema: TransactionSchema,
        prompt: `Parse this financial transaction: "${text}"
Available categories: ${categoryList}
Today's date: ${new Date().toISOString().split('T')[0]}
Return structured data.`,
        maxRetries: 1,
      });

      const parsed = result.object;
      return this.validateAndEnrich({
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        merchant: parsed.merchant || undefined,
        description: parsed.description,
        date: parsed.date,
        confidence: parsed.confidence,
      });
    } catch (error) {
      console.log('AI SDK parsing failed, using rule-based:', error);
    }

    return rulesBased;
  }

  private parseWithRules(text: string): ParsedTransaction {
    const lowerText = text.toLowerCase();
    const categories = this.db.getCategories();

    // Extract amount
    const amountMatch = text.match(/[$€£]?\s*(\d+(?:[.,]\d{1,2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0;

    // Determine type
    let type: 'income' | 'expense' = 'expense';
    const incomeKeywords = ['salary', 'paycheck', 'income', 'received', 'got paid', 'earned', 'bonus', 'refund', 'dividend'];
    const expenseKeywords = ['spent', 'paid', 'bought', 'cost', 'purchase', 'bill', 'expense'];
    
    if (incomeKeywords.some(kw => lowerText.includes(kw))) {
      type = 'income';
    } else if (expenseKeywords.some(kw => lowerText.includes(kw))) {
      type = 'expense';
    }

    // Extract date
    let date = new Date().toISOString().split('T')[0];
    if (lowerText.includes('yesterday')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      date = yesterday.toISOString().split('T')[0];
    }

    // Category detection
    const categoryKeywords: Record<string, string[]> = {
      'Groceries': ['grocery', 'groceries', 'supermarket', 'food', 'whole foods', 'trader', 'aldi', 'lidl'],
      'Dining Out': ['restaurant', 'lunch', 'dinner', 'coffee', 'cafe', 'starbucks', 'mcdonald'],
      'Transportation': ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'transit', 'metro', 'bus'],
      'Rent/Mortgage': ['rent', 'mortgage', 'lease'],
      'Utilities': ['electric', 'water', 'gas bill', 'utility', 'internet', 'phone'],
      'Entertainment': ['movie', 'netflix', 'spotify', 'game', 'concert', 'tickets'],
      'Shopping': ['amazon', 'shopping', 'clothes', 'target', 'walmart', 'ebay'],
      'Healthcare': ['doctor', 'pharmacy', 'medicine', 'hospital', 'dental'],
      'Salary': ['salary', 'paycheck', 'got paid', 'wage'],
      'Freelance': ['freelance', 'client', 'project', 'invoice'],
    };

    let category = type === 'income' ? 'Other Income' : 'Other';
    let confidence = 0.5;

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => lowerText.includes(kw))) {
        category = cat;
        confidence = 0.8;
        break;
      }
    }

    const matchedCategory = categories.find(c => 
      c.name.toLowerCase() === category.toLowerCase() && c.type === type
    );

    // Extract merchant
    const merchantPatterns = [/at\s+([A-Z][a-zA-Z\s]+)/i, /from\s+([A-Z][a-zA-Z\s]+)/i];
    let merchant: string | undefined;
    for (const pattern of merchantPatterns) {
      const match = text.match(pattern);
      if (match) {
        merchant = match[1].trim();
        break;
      }
    }

    return {
      amount,
      type,
      category: matchedCategory?.name || category,
      merchant,
      description: text,
      date,
      confidence,
    };
  }

  private validateAndEnrich(parsed: ParsedTransaction): ParsedTransaction {
    const categories = this.db.getCategories();
    
    const matchedCategory = categories.find(c => 
      c.name.toLowerCase() === (parsed.category || '').toLowerCase()
    );

    if (!matchedCategory) {
      const fuzzyMatch = categories.find(c =>
        c.name.toLowerCase().includes((parsed.category || '').toLowerCase())
      );
      parsed.category = fuzzyMatch?.name || (parsed.type === 'income' ? 'Other Income' : 'Other');
    } else {
      parsed.category = matchedCategory.name;
    }

    parsed.amount = Math.abs(parsed.amount);
    
    if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
      parsed.date = new Date().toISOString().split('T')[0];
    }

    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

    return parsed;
  }

  async processQuery(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase();

    // Check cache
    const cacheKey = lowerQuery.trim();
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.response;
    }

    // Get date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Handle common queries locally first
    let response = this.handleLocalQuery(lowerQuery, startOfMonth, endOfMonth);
    
    if (response) {
      responseCache.set(cacheKey, { response, timestamp: Date.now() });
      return response;
    }

    // For complex queries, use AI SDK
    try {
      const context = this.buildFinancialContext(startOfMonth, endOfMonth);
      
      const result = await generateText({
        model: this.getModel(),
        prompt: `You are Tracy, a helpful financial assistant. Answer concisely based on this data:

${context}

Question: ${query}

Answer in 1-3 sentences. Use € for currency.`,
        maxRetries: 1,
      });

      response = result.text.trim();
      responseCache.set(cacheKey, { response, timestamp: Date.now() });
      return response;
    } catch (error) {
      console.error('AI query failed:', error);
    }

    return "Ask me about: spending, income, balance, budgets, savings, or get a summary!";
  }

  private handleLocalQuery(query: string, startOfMonth: string, endOfMonth: string): string | null {
    if (query.includes('spent') || query.includes('spending') || query.includes('expense')) {
      const transactions = this.db.getTransactions({ startDate: startOfMonth, endDate: endOfMonth, type: 'expense' });
      const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      if (query.includes('category') || query.includes('where') || query.includes('top') || query.includes('most')) {
        const categories = this.db.getCategories();
        const categoryMap = new Map(categories.map(c => [c.id, c]));
        const spending = new Map<string, number>();
        
        for (const t of transactions) {
          spending.set(t.categoryId, (spending.get(t.categoryId) || 0) + Math.abs(t.amount));
        }
        
        const sorted = Array.from(spending.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        if (sorted.length === 0) return 'No expenses recorded this month.';
        
        const lines = sorted.map(([catId, amount], i) => 
          `${i + 1}. ${categoryMap.get(catId)?.name || 'Unknown'}: €${amount.toFixed(2)}`
        );
        return `Top spending this month:\n${lines.join('\n')}\n\nTotal: €${total.toFixed(2)}`;
      }
      return `You've spent €${total.toFixed(2)} this month.`;
    }

    if (query.includes('income') || query.includes('earn')) {
      const transactions = this.db.getTransactions({ startDate: startOfMonth, endDate: endOfMonth, type: 'income' });
      const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return `Your income this month: €${total.toFixed(2)}`;
    }

    if (query.includes('balance') || query.includes('have') || query.includes('total')) {
      const accounts = this.db.getAccounts();
      const total = accounts.reduce((sum, a) => sum + a.balance, 0);
      const breakdown = accounts.map(a => `${a.name}: €${a.balance.toFixed(2)}`).join('\n');
      return `Total balance: €${total.toFixed(2)}\n\n${breakdown}`;
    }

    if (query.includes('budget')) {
      const budgets = this.db.getBudgets();
      const categories = this.db.getCategories();
      const categoryMap = new Map(categories.map(c => [c.id, c]));
      const transactions = this.db.getTransactions({ startDate: startOfMonth, endDate: endOfMonth, type: 'expense' });

      if (budgets.length === 0) return "You haven't set up any budgets yet.";
      
      const status = budgets.map(b => {
        const spent = transactions
          .filter(t => t.categoryId === b.categoryId)
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        const pct = Math.round((spent / b.amount) * 100);
        const cat = categoryMap.get(b.categoryId);
        const emoji = spent > b.amount ? '🔴' : spent > b.amount * 0.8 ? '🟡' : '🟢';
        return `${emoji} ${cat?.name}: €${spent.toFixed(2)} / €${b.amount.toFixed(2)} (${pct}%)`;
      });
      return `Budget Status:\n${status.join('\n')}`;
    }

    if (query.includes('save') || query.includes('saving')) {
      const transactions = this.db.getTransactions({ startDate: startOfMonth, endDate: endOfMonth });
      const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
      const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
      const net = income - expenses;
      const rate = income > 0 ? (net / income) * 100 : 0;
      return net >= 0 
        ? `You've saved €${net.toFixed(2)} this month (${rate.toFixed(1)}% savings rate).`
        : `You're spending €${Math.abs(net).toFixed(2)} more than you earn this month.`;
    }

    if (query.includes('summary') || query.includes('overview')) {
      const transactions = this.db.getTransactions({ startDate: startOfMonth, endDate: endOfMonth });
      const accounts = this.db.getAccounts();
      const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
      const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
      const net = income - expenses;
      const balance = accounts.reduce((s, a) => s + a.balance, 0);
      
      return `📊 Monthly Summary:
💰 Income: €${income.toFixed(2)}
💸 Expenses: €${expenses.toFixed(2)}
${net >= 0 ? '✅' : '⚠️'} Net: ${net >= 0 ? '+' : ''}€${net.toFixed(2)}
🏦 Balance: €${balance.toFixed(2)}`;
    }

    return null;
  }

  private buildFinancialContext(startOfMonth: string, endOfMonth: string): string {
    const transactions = this.db.getTransactions({ startDate: startOfMonth, endDate: endOfMonth, limit: 20 });
    const accounts = this.db.getAccounts();
    const budgets = this.db.getBudgets();
    const categories = this.db.getCategories();
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const balance = accounts.reduce((s, a) => s + a.balance, 0);

    const topSpending = new Map<string, number>();
    transactions.filter(t => t.type === 'expense').forEach(t => {
      topSpending.set(t.categoryId, (topSpending.get(t.categoryId) || 0) + Math.abs(t.amount));
    });

    const topCategories = Array.from(topSpending.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, amt]) => `${categoryMap.get(id)?.name}: €${amt.toFixed(2)}`)
      .join(', ');

    return `Income: €${income.toFixed(2)}, Expenses: €${expenses.toFixed(2)}, Balance: €${balance.toFixed(2)}
Top categories: ${topCategories || 'None'}
Budgets: ${budgets.length}, Accounts: ${accounts.length}`;
  }

  async getInsights(): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const thisMonth = this.db.getTransactions({ startDate: startOfMonth, endDate: endOfMonth });
    const lastMonth = this.db.getTransactions({ startDate: lastMonthStart, endDate: lastMonthEnd });

    const thisMonthExpenses = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const lastMonthExpenses = lastMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);

    // Spending comparison
    if (lastMonthExpenses > 0) {
      const change = ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
      if (Math.abs(change) > 10) {
        insights.push({
          id: 'spending-change',
          type: change > 0 ? 'anomaly' : 'saving',
          title: change > 0 ? 'Spending Up' : 'Spending Down',
          description: `You're spending ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'more' : 'less'} than last month.`,
          priority: Math.abs(change) > 25 ? 'high' : 'medium',
          createdAt: now.toISOString(),
        });
      }
    }

    // Savings rate
    const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    if (income > 0) {
      const savingsRate = ((income - thisMonthExpenses) / income) * 100;
      if (savingsRate >= 20) {
        insights.push({
          id: 'great-savings',
          type: 'saving',
          title: 'Great Savings!',
          description: `You're saving ${savingsRate.toFixed(0)}% of your income.`,
          priority: 'low',
          createdAt: now.toISOString(),
        });
      } else if (savingsRate < 10 && savingsRate >= 0) {
        insights.push({
          id: 'low-savings',
          type: 'recommendation',
          title: 'Consider Saving More',
          description: `Your savings rate is ${savingsRate.toFixed(0)}%. Aim for 20%.`,
          priority: 'medium',
          createdAt: now.toISOString(),
        });
      }
    }

    // Budget alerts
    const budgets = this.db.getBudgets();
    const categories = this.db.getCategories();
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    for (const budget of budgets) {
      const spent = thisMonth
        .filter(t => t.categoryId === budget.categoryId && t.type === 'expense')
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      
      const percentage = (spent / budget.amount) * 100;
      const category = categoryMap.get(budget.categoryId);

      if (percentage >= 100) {
        insights.push({
          id: `budget-over-${budget.id}`,
          type: 'anomaly',
          title: `Over Budget: ${category?.name}`,
          description: `Exceeded by €${(spent - budget.amount).toFixed(2)}.`,
          priority: 'high',
          createdAt: now.toISOString(),
        });
      } else if (percentage >= 80) {
        insights.push({
          id: `budget-warning-${budget.id}`,
          type: 'spending',
          title: `Budget Alert: ${category?.name}`,
          description: `${percentage.toFixed(0)}% used.`,
          priority: 'medium',
          createdAt: now.toISOString(),
        });
      }
    }

    return insights;
  }
}
