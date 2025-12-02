# Tracy Backend

Sync server + Telegram bot for Tracy expense tracker.

## Features

- **Telegram Bot**: Add expenses via text or voice messages
- **Voice Transcription**: Uses OpenAI Whisper to transcribe voice notes  
- **Sync API**: Syncs transactions between devices
- **Spotlight CLI**: Quick add from terminal

## Quick Start

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase-schema.sql`
3. Get your API keys from Settings → API

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Supabase (from your dashboard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Telegram (from @BotFather)
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_ALLOWED_USER_ID=your-telegram-id

# OpenAI (for voice transcription)
OPENAI_API_KEY=sk-...

# Server
PORT=3847
```

### 3. Get Your Telegram User ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. Copy your ID to `TELEGRAM_ALLOWED_USER_ID`

### 4. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Choose a name (e.g., "Tracy Expense Bot")
4. Choose a username (e.g., "my_tracy_bot")
5. Copy the token to `TELEGRAM_BOT_TOKEN`

### 5. Run

```bash
# Install dependencies
npm install

# Start API server (for sync + CLI)
npm run dev

# In another terminal, start Telegram bot
npm run bot
```

## Usage

### Telegram Bot

Send messages to your bot:

```
-30 gas
+500 salary  
lunch 15€ at Pizza Hut
-25, groceries, Lidl
```

Or send a **voice message** describing the expense!

### CLI / Spotlight

```bash
# Install CLI
cd ../scripts && ./install-cli.sh

# Use from anywhere
tracy -30 gas
tracy +500 freelance
```

### API Endpoints

```
GET  /health              - Health check
POST /api/parse           - Parse transaction text
POST /api/transactions    - Add transaction  
POST /api/sync            - Sync transactions
GET  /api/device          - Get new device ID
```

## Architecture

```
Telegram Bot ─────┐
                  │
CLI/Spotlight ────┼──▶ Supabase ◀──▶ Tracy App
                  │
API Server ───────┘
```

## Development

```bash
# Run with auto-reload
npm run dev

# Build for production
npm run build
npm run start
```
