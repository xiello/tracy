import 'dotenv/config';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { parseTransaction, formatTransaction } from './parser.js';
import { addTransaction, getOrCreateUser } from './supabase.js';
import { transcribeFromUrl } from './whisper.js';
import { ParsedTransaction } from './types.js';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
const ALLOWED_USER_ID = process.env.TELEGRAM_ALLOWED_USER_ID;

// Store pending transactions for confirmation
const pendingTransactions = new Map<number, { parsed: ParsedTransaction; messageId: number }>();

// Security: only allow your user ID
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id.toString();
  if (ALLOWED_USER_ID && userId !== ALLOWED_USER_ID) {
    console.log(`Unauthorized access attempt from user ${userId}`);
    await ctx.reply('⛔ Unauthorized. This bot is private.');
    return;
  }
  await next();
});

// Start command
bot.command('start', async (ctx) => {
  await ctx.reply(
    `👋 *Welcome to Tracy!*\n\n` +
    `I'm your personal expense tracker. Just send me:\n\n` +
    `💬 *Text:* \`-30 gas\` or \`lunch 15€ at Pizza Hut\`\n` +
    `🎤 *Voice:* Record a voice message about your expense\n\n` +
    `*Quick format:*\n` +
    `\`amount, description, location\`\n` +
    `\`-45, groceries, Lidl\`\n` +
    `\`+3000, salary\`\n\n` +
    `Use /help for more commands.`,
    { parse_mode: 'Markdown' }
  );
});

// Help command
bot.command('help', async (ctx) => {
  await ctx.reply(
    `*Tracy Commands:*\n\n` +
    `/start - Welcome message\n` +
    `/summary - This month's summary\n` +
    `/help - Show this help\n\n` +
    `*Adding transactions:*\n` +
    `• \`-30 gas\` - €30 expense for gas\n` +
    `• \`+500 freelance\` - €500 income\n` +
    `• \`lunch 12.50 at cafe\` - expense with location\n` +
    `• \`-25, groceries, Lidl\` - comma-separated format\n` +
    `• 🎤 Send a voice note describing the expense\n\n` +
    `*Tips:*\n` +
    `• Use + for income, - for expenses\n` +
    `• Add "yesterday" for past transactions\n` +
    `• Categories are auto-detected from keywords`,
    { parse_mode: 'Markdown' }
  );
});

// Summary command
bot.command('summary', async (ctx) => {
  // TODO: Fetch from Supabase and show summary
  await ctx.reply(
    `📊 *This Month's Summary*\n\n` +
    `Coming soon! Open Tracy app for full dashboard.`,
    { parse_mode: 'Markdown' }
  );
});

// Handle text messages
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  
  // Skip commands
  if (text.startsWith('/')) return;
  
  try {
    const parsed = parseTransaction(text);
    
    if (parsed.amount === 0) {
      await ctx.reply(
        `❓ I couldn't find an amount in your message.\n\n` +
        `Try: \`-30 gas\` or \`lunch 15€\``,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Show parsed transaction with confirm/cancel buttons
    const keyboard = new InlineKeyboard()
      .text('✅ Confirm', 'confirm')
      .text('❌ Cancel', 'cancel');
    
    const msg = await ctx.reply(
      `${formatTransaction(parsed)}\n\n_Confidence: ${Math.round(parsed.confidence * 100)}%_`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
    
    // Store for confirmation
    pendingTransactions.set(ctx.from.id, { parsed, messageId: msg.message_id });
    
  } catch (error) {
    console.error('Parse error:', error);
    await ctx.reply('❌ Error parsing transaction. Please try again.');
  }
});

// Handle voice messages
bot.on('message:voice', async (ctx) => {
  const voice = ctx.message.voice;
  
  await ctx.reply('🎤 Transcribing voice message...');
  
  try {
    // Get file URL from Telegram
    const file = await ctx.api.getFile(voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    // Transcribe with Whisper
    const transcription = await transcribeFromUrl(fileUrl);
    
    if (!transcription || transcription.trim().length === 0) {
      await ctx.reply('❓ Could not understand the voice message. Please try again.');
      return;
    }
    
    await ctx.reply(`📝 Heard: "${transcription}"`);
    
    // Parse the transcription
    const parsed = parseTransaction(transcription);
    
    if (parsed.amount === 0) {
      await ctx.reply(
        `❓ I couldn't find an amount in your message.\n\n` +
        `Try saying something like "spent 30 euros on gas"`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Show parsed transaction with confirm/cancel buttons
    const keyboard = new InlineKeyboard()
      .text('✅ Confirm', 'confirm')
      .text('❌ Cancel', 'cancel');
    
    const msg = await ctx.reply(
      `${formatTransaction(parsed)}\n\n_Confidence: ${Math.round(parsed.confidence * 100)}%_`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
    
    pendingTransactions.set(ctx.from.id, { parsed, messageId: msg.message_id });
    
  } catch (error) {
    console.error('Voice processing error:', error);
    await ctx.reply('❌ Error processing voice message. Please try again or send text.');
  }
});

// Handle audio files (for voice notes sent as audio)
bot.on('message:audio', async (ctx) => {
  await ctx.reply('🎤 Please send as a voice message (hold the mic button), not as an audio file.');
});

// Handle button callbacks
bot.callbackQuery('confirm', async (ctx) => {
  const userId = ctx.from.id;
  const pending = pendingTransactions.get(userId);
  
  if (!pending) {
    await ctx.answerCallbackQuery({ text: 'Transaction expired. Send a new one.' });
    return;
  }
  
  try {
    // Get or create user in Supabase
    const dbUserId = await getOrCreateUser(userId.toString());
    
    // Add transaction to Supabase
    await addTransaction({
      user_id: dbUserId,
      date: pending.parsed.date,
      amount: pending.parsed.amount,
      type: pending.parsed.type,
      category: pending.parsed.category,
      merchant: pending.parsed.merchant,
      description: pending.parsed.description,
      tags: [],
      source: 'telegram',
    });
    
    // Update message
    await ctx.editMessageText(
      `✅ *Added!*\n\n${formatTransaction(pending.parsed)}`,
      { parse_mode: 'Markdown' }
    );
    
    pendingTransactions.delete(userId);
    await ctx.answerCallbackQuery({ text: '✅ Transaction saved!' });
    
  } catch (error) {
    console.error('Save error:', error);
    await ctx.answerCallbackQuery({ text: '❌ Error saving. Try again.' });
  }
});

bot.callbackQuery('cancel', async (ctx) => {
  const userId = ctx.from.id;
  pendingTransactions.delete(userId);
  
  await ctx.editMessageText('❌ _Cancelled_', { parse_mode: 'Markdown' });
  await ctx.answerCallbackQuery({ text: 'Cancelled' });
});

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start bot
console.log('🤖 Tracy Telegram Bot starting...');
bot.start();
