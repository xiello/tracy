import { createClient } from '@supabase/supabase-js';
import { Transaction } from './types.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      ...transaction,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getTransactionsSince(userId: string, since: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('updated_at', since)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function syncTransactions(userId: string, transactions: Transaction[]): Promise<void> {
  for (const tx of transactions) {
    const { error } = await supabase
      .from('transactions')
      .upsert({
        ...tx,
        user_id: userId,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    
    if (error) console.error('Sync error:', error);
  }
}

export async function getOrCreateUser(telegramId: string): Promise<string> {
  // Check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .single();
  
  if (existing) return existing.id;
  
  // Create new user
  const userId = crypto.randomUUID();
  const { error } = await supabase
    .from('users')
    .insert({
      id: userId,
      telegram_id: telegramId,
      created_at: new Date().toISOString(),
    });
  
  if (error) throw error;
  return userId;
}

// SQL to create tables in Supabase:
/*
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id TEXT UNIQUE,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  merchant TEXT,
  description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'app' CHECK (source IN ('app', 'telegram', 'spotlight', 'api')),
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for sync queries
CREATE INDEX idx_transactions_user_updated ON transactions(user_id, updated_at);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies (adjust as needed)
CREATE POLICY "Users can manage own transactions" ON transactions
  FOR ALL USING (auth.uid()::text = user_id::text);
*/
