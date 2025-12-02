export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  merchant?: string;
  description: string;
  tags: string[];
  source: 'app' | 'telegram' | 'spotlight' | 'api';
  synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  group: string;
  icon: string;
  color: string;
  keywords: string[];
}

export interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  merchant?: string;
  description: string;
  date: string;
  confidence: number;
}

export interface SyncPayload {
  transactions: Transaction[];
  lastSyncAt: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  // Transportation
  { id: 'gas', name: 'Gas', type: 'expense', group: 'transportation', icon: 'fuel', color: '#8e8e93', keywords: ['gas', 'fuel', 'petrol', 'diesel', 'gasoline', 'shell', 'bp', 'esso', 'tank'] },
  { id: 'transit', name: 'Public Transit', type: 'expense', group: 'transportation', icon: 'bus', color: '#30b0c7', keywords: ['bus', 'train', 'metro', 'subway', 'tram', 'transit', 'ticket'] },
  { id: 'parking', name: 'Parking', type: 'expense', group: 'transportation', icon: 'square', color: '#636366', keywords: ['parking', 'park'] },
  { id: 'uber', name: 'Rideshare', type: 'expense', group: 'transportation', icon: 'car', color: '#000000', keywords: ['uber', 'lyft', 'bolt', 'taxi', 'cab'] },
  { id: 'car', name: 'Car Maintenance', type: 'expense', group: 'transportation', icon: 'wrench', color: '#48484a', keywords: ['car wash', 'oil change', 'tire', 'mechanic', 'repair', 'service'] },
  
  // Essential
  { id: 'rent', name: 'Rent/Mortgage', type: 'expense', group: 'essential', icon: 'home', color: '#ff9500', keywords: ['rent', 'mortgage', 'lease', 'housing'] },
  { id: 'utilities', name: 'Utilities', type: 'expense', group: 'essential', icon: 'zap', color: '#ffcc00', keywords: ['electric', 'electricity', 'water', 'utility', 'internet', 'phone', 'bill'] },
  { id: 'groceries', name: 'Groceries', type: 'expense', group: 'essential', icon: 'shopping-cart', color: '#34c759', keywords: ['grocery', 'groceries', 'supermarket', 'lidl', 'aldi', 'tesco', 'kaufland', 'billa', 'whole foods'] },
  { id: 'healthcare', name: 'Healthcare', type: 'expense', group: 'essential', icon: 'heart', color: '#ff2d55', keywords: ['doctor', 'pharmacy', 'medicine', 'hospital', 'dental', 'dentist', 'health'] },
  { id: 'insurance', name: 'Insurance', type: 'expense', group: 'essential', icon: 'shield', color: '#5856d6', keywords: ['insurance'] },
  
  // Lifestyle
  { id: 'dining', name: 'Dining Out', type: 'expense', group: 'lifestyle', icon: 'utensils', color: '#ff6b6b', keywords: ['restaurant', 'lunch', 'dinner', 'breakfast', 'coffee', 'cafe', 'starbucks', 'mcdonald', 'pizza', 'burger', 'food', 'eat'] },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', group: 'lifestyle', icon: 'film', color: '#af52de', keywords: ['movie', 'netflix', 'spotify', 'game', 'concert', 'tickets', 'cinema', 'theater', 'bar', 'club'] },
  { id: 'shopping', name: 'Shopping', type: 'expense', group: 'lifestyle', icon: 'shopping-bag', color: '#ff9500', keywords: ['amazon', 'shopping', 'clothes', 'target', 'walmart', 'ebay', 'ikea', 'zara'] },
  { id: 'subscriptions', name: 'Subscriptions', type: 'expense', group: 'lifestyle', icon: 'repeat', color: '#0071e3', keywords: ['subscription', 'membership', 'premium', 'plan', 'netflix', 'spotify'] },
  
  // Income
  { id: 'salary', name: 'Salary', type: 'income', group: 'income', icon: 'briefcase', color: '#34c759', keywords: ['salary', 'paycheck', 'wage', 'income', 'pay'] },
  { id: 'freelance', name: 'Freelance', type: 'income', group: 'income', icon: 'laptop', color: '#30d158', keywords: ['freelance', 'client', 'project', 'invoice', 'gig'] },
  { id: 'investments', name: 'Investments', type: 'income', group: 'income', icon: 'trending-up', color: '#32ade6', keywords: ['invest', 'dividend', 'stock', 'crypto', 'trading', 'interest'] },
  { id: 'gifts', name: 'Gifts', type: 'income', group: 'income', icon: 'gift', color: '#ff2d55', keywords: ['gift', 'present', 'birthday', 'received'] },
  { id: 'refund', name: 'Refund', type: 'income', group: 'income', icon: 'rotate-ccw', color: '#ff9f0a', keywords: ['refund', 'return', 'cashback', 'reimbursement'] },
  
  // Other
  { id: 'other-expense', name: 'Other', type: 'expense', group: 'other', icon: 'more-horizontal', color: '#8e8e93', keywords: [] },
  { id: 'other-income', name: 'Other Income', type: 'income', group: 'other', icon: 'plus-circle', color: '#34c759', keywords: [] },
];
