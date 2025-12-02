import 'dotenv/config';
import express from 'express';
import { parseTransaction, formatTransaction } from './parser.js';
import { addTransaction, getTransactionsSince, syncTransactions, getOrCreateUser } from './supabase.js';
import { v4 as uuid } from 'uuid';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3847;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Parse transaction (for Spotlight/Alfred)
app.post('/api/parse', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const parsed = parseTransaction(text);
    res.json(parsed);
  } catch (error) {
    console.error('Parse error:', error);
    res.status(500).json({ error: 'Failed to parse transaction' });
  }
});

// Add transaction from external source (Spotlight, Alfred, API)
app.post('/api/transactions', async (req, res) => {
  try {
    const { text, device_id, source = 'api' } = req.body;
    
    if (!text || !device_id) {
      return res.status(400).json({ error: 'Text and device_id are required' });
    }
    
    // Get or create user by device ID
    const userId = await getOrCreateUser(device_id);
    
    // Parse the text
    const parsed = parseTransaction(text);
    
    if (parsed.amount === 0) {
      return res.status(400).json({ error: 'Could not find amount in text' });
    }
    
    // Save transaction
    const transaction = await addTransaction({
      user_id: userId,
      date: parsed.date,
      amount: parsed.amount,
      type: parsed.type,
      category: parsed.category,
      merchant: parsed.merchant,
      description: parsed.description,
      tags: [],
      source: source as 'spotlight' | 'api',
    });
    
    res.json({ 
      success: true, 
      transaction,
      formatted: formatTransaction(parsed),
    });
    
  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

// Sync endpoint for Tracy desktop app
app.post('/api/sync', async (req, res) => {
  try {
    const { device_id, last_sync_at, transactions: clientTransactions } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }
    
    const userId = await getOrCreateUser(device_id);
    
    // Upload client transactions to server
    if (clientTransactions && clientTransactions.length > 0) {
      await syncTransactions(userId, clientTransactions);
    }
    
    // Get transactions updated since last sync
    const serverTransactions = await getTransactionsSince(
      userId, 
      last_sync_at || '1970-01-01T00:00:00Z'
    );
    
    res.json({
      success: true,
      transactions: serverTransactions,
      synced_at: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Get device ID (for new installations)
app.get('/api/device', (req, res) => {
  res.json({ device_id: uuid() });
});

app.listen(PORT, () => {
  console.log(`🚀 Tracy API server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Parse:  POST http://localhost:${PORT}/api/parse`);
  console.log(`   Add:    POST http://localhost:${PORT}/api/transactions`);
  console.log(`   Sync:   POST http://localhost:${PORT}/api/sync`);
});
