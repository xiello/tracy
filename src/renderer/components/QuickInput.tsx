import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Check, Mic, MicOff, AlertCircle } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface ParsedQuickInput {
  amount: number;
  type: 'income' | 'expense';
  description: string;
  location?: string;
  date: string;
}

export default function QuickInput() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<ParsedQuickInput | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const { addTransaction, categories, accounts, loadTransactions, loadDashboardData } = useAppStore();

  useEffect(() => {
    initSpeechRecognition();
  }, []);

  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
      setMicError(null);
    };

    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = (event: Event & { error?: string }) => {
      setIsListening(false);
      const error = event.error || 'unknown';
      if (error === 'not-allowed') {
        setMicError('Microphone permission denied. Go to System Preferences > Privacy & Security > Microphone and enable for Tracy.');
      } else if (error === 'no-speech') {
        setMicError('No speech detected. Try again.');
      } else {
        setMicError(`Mic error: ${error}`);
      }
    };

    recognitionRef.current = recognition;
  };

  useEffect(() => {
    if (input.trim()) {
      setPreview(parseQuickInput(input));
    } else {
      setPreview(null);
    }
  }, [input]);

  const parseQuickInput = (text: string): ParsedQuickInput | null => {
    if (!text.trim()) return null;

    const amountMatch = text.match(/([+-])?[$€£]?\s*(\d+(?:[.,]\d{1,2})?)\s*[$€£]?/);
    if (!amountMatch) return null;

    const sign = amountMatch[1];
    const amount = parseFloat(amountMatch[2].replace(',', '.'));
    const type: 'income' | 'expense' = sign === '+' ? 'income' : 'expense';

    let remaining = text.replace(amountMatch[0], '').trim();
    
    let date = format(new Date(), 'yyyy-MM-dd');
    if (/\byesterday\b/i.test(remaining)) {
      date = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
      remaining = remaining.replace(/\byesterday\b/i, '').trim();
    } else if (/\btoday\b/i.test(remaining)) {
      remaining = remaining.replace(/\btoday\b/i, '').trim();
    }

    const parts = remaining.split(',').map(p => p.trim()).filter(Boolean);
    const description = parts[0] || 'Transaction';
    const location = parts[1];

    return { amount, type, description, location, date };
  };

  const toggleVoice = async () => {
    if (!recognitionRef.current) {
      setMicError('Speech recognition not available');
      return;
    }
    
    setMicError(null);
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setInput('');
        setPreview(null);
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        setMicError('Failed to start microphone');
        setIsListening(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!preview || isProcessing) return;
    
    // Check if we have required data
    if (!categories || categories.length === 0) {
      console.error('No categories available');
      setMicError('App not ready. Please wait...');
      return;
    }
    if (!accounts || accounts.length === 0) {
      console.error('No accounts available');
      setMicError('No accounts. Create one first.');
      return;
    }

    setIsProcessing(true);
    setMicError(null);

    try {
      const lowerDesc = preview.description.toLowerCase();
      let category = categories.find(c => c.type === preview.type);
      
      const categoryKeywords: Record<string, string[]> = {
        'Groceries': ['grocery', 'food', 'supermarket', 'market'],
        'Dining Out': ['lunch', 'dinner', 'breakfast', 'restaurant', 'cafe', 'coffee', 'eat'],
        'Transportation': ['uber', 'taxi', 'bus', 'train', 'gas', 'fuel', 'parking'],
        'Entertainment': ['movie', 'netflix', 'game', 'concert', 'bar', 'club'],
        'Shopping': ['amazon', 'shop', 'clothes', 'buy'],
        'Utilities': ['electric', 'water', 'internet', 'phone', 'bill'],
        'Salary': ['salary', 'paycheck', 'wage'],
        'Freelance': ['freelance', 'project', 'client'],
      };

      for (const [catName, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => lowerDesc.includes(kw))) {
          const found = categories.find(c => c.name === catName && c.type === preview.type);
          if (found) { category = found; break; }
        }
      }

      if (!category) {
        category = categories.find(c => c.name === 'Other' && c.type === preview.type) || categories[0];
      }

      const account = accounts[0];
      
      console.log('QuickInput: Adding transaction', { category: category.name, account: account.name, amount: preview.amount });

      await addTransaction({
        date: preview.date,
        amount: preview.type === 'expense' ? -Math.abs(preview.amount) : Math.abs(preview.amount),
        type: preview.type,
        categoryId: category.id,
        accountId: account.id,
        merchant: preview.location,
        description: preview.description,
        tags: preview.location ? [preview.location] : [],
        isReconciled: false,
      });

      console.log('QuickInput: Transaction added successfully');
      setShowSuccess(true);
      setInput('');
      setPreview(null);
      
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error('QuickInput: Failed to add transaction', error);
      setMicError('Failed to add. Try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && preview && !isProcessing) handleSubmit();
    if (e.key === 'Escape') { setInput(''); setPreview(null); }
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-mac-accent-green text-white rounded-xl text-sm font-medium shadow-lg z-10"
          >
            <Check size={16} />
            Added!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative glass-dark rounded-xl border border-white/10 overflow-hidden">
        <div className="flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="-24, lunch, Bratislava"
            className="flex-1 px-4 py-3 bg-transparent text-white placeholder-white/40 focus:outline-none"
          />
          
          <button
            onClick={toggleVoice}
            className={`p-2 mr-1 rounded-lg transition-all ${
              isListening ? 'bg-mac-accent-red text-white animate-pulse' : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title={micError || 'Click to speak'}
          >
            {isListening ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          <button
            onClick={handleSubmit}
            disabled={!preview || isProcessing}
            className={`p-2 mr-2 rounded-lg transition-all ${
              preview && !isProcessing ? 'bg-mac-accent-blue text-white hover:bg-blue-500' : 'text-white/30 cursor-not-allowed'
            }`}
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>

        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/10 overflow-hidden"
            >
              <div className="px-4 py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className={`font-semibold tabular-nums ${preview.type === 'income' ? 'text-mac-accent-green' : 'text-mac-accent-red'}`}>
                    {preview.type === 'income' ? '+' : '-'}€{preview.amount.toFixed(2)}
                  </span>
                  <span className="text-white/70">{preview.description}</span>
                  {preview.location && <span className="text-white/50">@ {preview.location}</span>}
                </div>
                <span className="text-white/40 text-xs">{preview.date}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {micError && (
          <div className="px-4 py-2 border-t border-white/10 bg-mac-accent-red/10 flex items-center gap-2 text-xs text-mac-accent-red">
            <AlertCircle size={14} />
            {micError}
          </div>
        )}
      </div>

      {!input && !micError && <p className="mt-2 text-xs text-white/40 text-center">Type amount, description, location • Enter to add</p>}
    </div>
  );
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList { length: number; [index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionResult { isFinal: boolean; [index: number]: SpeechRecognitionAlternative; }
interface SpeechRecognitionAlternative { transcript: string; confidence: number; }
interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null; onerror: ((event: Event & { error?: string }) => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
