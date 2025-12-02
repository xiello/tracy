import { DEFAULT_CATEGORIES, ParsedTransaction, Category } from './types.js';

export function parseTransaction(text: string): ParsedTransaction {
  const lowerText = text.toLowerCase().trim();
  
  // Extract amount - support multiple formats
  // -30, +500, 30$, €45, 45 eur, $30, 30.50, 30,50
  const amountPatterns = [
    /([+-])\s*[$€£]?\s*(\d+(?:[.,]\d{1,2})?)/,  // -30, +$50
    /[$€£]\s*(\d+(?:[.,]\d{1,2})?)/,             // $30, €45
    /(\d+(?:[.,]\d{1,2})?)\s*[$€£]?/,            // 30$, 45€
    /(\d+(?:[.,]\d{1,2})?)\s*(?:eur|usd|euro|dollar)?/i,  // 30 eur
  ];
  
  let amount = 0;
  let explicitSign: '+' | '-' | null = null;
  
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1] === '+' || match[1] === '-') {
        explicitSign = match[1];
        amount = parseFloat(match[2].replace(',', '.'));
      } else {
        amount = parseFloat((match[1] || match[2] || '0').replace(',', '.'));
      }
      break;
    }
  }
  
  // Determine type from sign or keywords
  let type: 'income' | 'expense' = 'expense';
  
  if (explicitSign === '+') {
    type = 'income';
  } else if (explicitSign === '-') {
    type = 'expense';
  } else {
    // Check for income keywords
    const incomeKeywords = ['salary', 'paycheck', 'income', 'received', 'got paid', 'earned', 'bonus', 'refund', 'dividend', 'gift from', 'sent me'];
    if (incomeKeywords.some(kw => lowerText.includes(kw))) {
      type = 'income';
    }
  }
  
  // Extract date
  let date = new Date().toISOString().split('T')[0];
  if (/\byesterday\b/i.test(lowerText)) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  } else if (/\blast week\b/i.test(lowerText)) {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    date = lastWeek.toISOString().split('T')[0];
  }
  
  // Find matching category
  let matchedCategory: Category | undefined;
  let confidence = 0.5;
  
  const categoriesForType = DEFAULT_CATEGORIES.filter(c => c.type === type);
  
  for (const cat of categoriesForType) {
    for (const keyword of cat.keywords) {
      if (lowerText.includes(keyword)) {
        matchedCategory = cat;
        confidence = 0.85;
        break;
      }
    }
    if (matchedCategory) break;
  }
  
  if (!matchedCategory) {
    matchedCategory = DEFAULT_CATEGORIES.find(c => 
      c.id === (type === 'income' ? 'other-income' : 'other-expense')
    );
  }
  
  // Extract merchant/location (after @ or "at" or from comma-separated parts)
  let merchant: string | undefined;
  const atMatch = text.match(/@\s*([^,]+)/i) || text.match(/\bat\s+([^,]+)/i);
  if (atMatch) {
    merchant = atMatch[1].trim();
  } else {
    // Check comma-separated parts
    const parts = text.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      merchant = parts[2];
    }
  }
  
  // Build description
  let description = text
    .replace(/[+-]?\s*[$€£]?\s*\d+(?:[.,]\d{1,2})?\s*[$€£]?/g, '')
    .replace(/@\s*[^,]+/g, '')
    .replace(/\b(yesterday|today|last week)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (!description || description.length < 2) {
    description = matchedCategory?.name || 'Transaction';
  }
  
  return {
    amount: Math.abs(amount),
    type,
    category: matchedCategory?.name || 'Other',
    merchant,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    date,
    confidence,
  };
}

export function formatTransaction(parsed: ParsedTransaction): string {
  const sign = parsed.type === 'income' ? '+' : '-';
  const emoji = parsed.type === 'income' ? '💰' : '💸';
  
  let msg = `${emoji} *${sign}€${parsed.amount.toFixed(2)}*\n`;
  msg += `📁 ${parsed.category}\n`;
  msg += `📝 ${parsed.description}`;
  if (parsed.merchant) {
    msg += `\n📍 ${parsed.merchant}`;
  }
  msg += `\n📅 ${parsed.date}`;
  
  return msg;
}
