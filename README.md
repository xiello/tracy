<p align="center">
  <img src="https://img.icons8.com/3d-fluency/94/money-bag.png" alt="Tracy Logo" width="80" height="80">
</p>

<h1 align="center">Tracy</h1>

<p align="center">
  <strong>AI-powered expense tracking with voice input</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-33-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## Overview

Tracy is a modern, privacy-first expense tracking application that uses AI to make managing your finances effortless. Simply speak or type your transactions naturally — Tracy understands and categorizes them automatically.

```
"I spent €45 on groceries at Lidl yesterday"
→ Expense: €45.00 | Category: Groceries | Merchant: Lidl | Date: Yesterday
```

## Features

### 🎙️ Voice Input
Add transactions hands-free using natural language. Tracy's speech recognition understands context, amounts, categories, and dates from your voice.

### 🤖 AI-Powered Parsing
Powered by multiple AI providers (OpenAI, Anthropic, or local Ollama), Tracy intelligently extracts transaction details from natural language input with high accuracy.

### 💬 Financial Chat Assistant
Ask questions about your finances in plain English:
- *"How much did I spend this month?"*
- *"What's my budget status?"*
- *"Show me my top spending categories"*

### 📊 Visual Dashboard
Beautiful charts and insights at a glance:
- Monthly income vs. expenses trends
- Spending breakdown by category
- Budget progress tracking
- Savings rate visualization

### 💰 Budget Management
Set monthly budgets for categories and get real-time alerts when you're approaching limits.

### 🏦 Multi-Account Support
Track balances across multiple accounts — checking, savings, cash, and more.

### 🔐 Privacy First
All data stored locally on your device using SQLite. No cloud sync, no tracking.

## Screenshots

<p align="center">
  <i>Dashboard with spending analytics and budget tracking</i>
</p>

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Quick Start

```bash
# Clone the repository
git clone https://github.com/xiello/tracy.git
cd tracy

# Install dependencies
npm install

# Start development server
npm run dev

# In another terminal, launch the app
npm run start
```

### Build for Production

```bash
# Build the app
npm run build

# Create distributable
npm run dist
```

## Usage

### Adding Transactions

**Voice Input:**
1. Click the microphone icon
2. Say something like *"Spent 30 euros on dinner at Pizza Hut"*
3. Review and confirm the parsed transaction

**Quick Input:**
Type naturally in the quick input bar:
- `coffee 4.50` → Adds €4.50 expense in Dining
- `salary 3000` → Adds €3000 income
- `uber 15 yesterday` → Adds €15 transport expense dated yesterday

### AI Chat

Switch to the Chat view to ask questions:
- `What's my spending summary?`
- `Am I over budget on groceries?`
- `How much did I save this month?`

### AI Provider Setup

Tracy supports multiple AI backends. Configure in **Settings**:

| Provider | Setup |
|----------|-------|
| **Ollama** (Default) | Install [Ollama](https://ollama.ai), run `ollama pull llama3.2` |
| **OpenAI** | Add your API key in settings |
| **Anthropic** | Add your API key in settings |

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Electron 33 |
| **Frontend** | React 18, TypeScript |
| **Styling** | Tailwind CSS, Framer Motion |
| **State** | Zustand |
| **Database** | SQLite (better-sqlite3) |
| **AI** | Vercel AI SDK (OpenAI, Anthropic, Ollama) |
| **Charts** | Chart.js, react-chartjs-2 |

## Project Structure

```
tracy/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # App entry point
│   │   ├── database.ts # SQLite operations
│   │   ├── ai-service.ts # AI parsing & chat
│   │   └── ipc-handlers.ts
│   ├── renderer/       # React frontend
│   │   ├── components/ # UI components
│   │   ├── stores/     # Zustand state
│   │   └── styles/     # Global CSS
│   └── shared/         # Shared types
├── resources/          # App resources
└── dist/               # Build output
```

## Roadmap

- [ ] Recurring transactions
- [ ] Data export (CSV, PDF reports)
- [ ] Multiple currencies
- [ ] Bank sync integration
- [ ] Mobile companion app

## License

MIT © [xiello](https://github.com/xiello)

---

<p align="center">
  Made with ☕ and TypeScript
</p>
