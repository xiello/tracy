import { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, X, Check, MessageSquare } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function VoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [mode, setMode] = useState<'transaction' | 'query'>('transaction');
  
  const { 
    parseVoiceInput, 
    processQuery,
    isProcessingVoice, 
    parsedTransaction,
    setParsedTransaction,
    addTransaction,
    categories,
    accounts,
    setShowAddTransaction,
  } = useAppStore();

  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        setTranscript(finalTranscript || interimTranscript);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'network') {
          alert('Speech recognition requires internet. Please check your connection.');
        }
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognition) {
      setTranscript('');
      setAiResponse('');
      setParsedTransaction(null);
      setShowPanel(true);
      recognition.start();
      setIsListening(true);
    }
  }, [recognition, setParsedTransaction]);

  const stopListening = useCallback(async () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);

      if (transcript.trim()) {
        if (mode === 'transaction') {
          await parseVoiceInput(transcript);
        } else {
          const response = await processQuery(transcript);
          setAiResponse(response);
        }
      }
    }
  }, [recognition, transcript, mode, parseVoiceInput, processQuery]);

  const handleConfirmTransaction = async () => {
    if (!parsedTransaction) return;

    const category = categories.find(c => 
      c.name.toLowerCase() === parsedTransaction.category?.toLowerCase()
    );
    const account = accounts[0];

    if (category && account) {
      await addTransaction({
        date: parsedTransaction.date,
        amount: parsedTransaction.type === 'expense' ? -Math.abs(parsedTransaction.amount) : Math.abs(parsedTransaction.amount),
        type: parsedTransaction.type,
        categoryId: category.id,
        accountId: account.id,
        merchant: parsedTransaction.merchant,
        description: parsedTransaction.description,
        tags: parsedTransaction.tags || [],
        isReconciled: false,
        confidence: parsedTransaction.confidence,
      });
    }

    setShowPanel(false);
    setTranscript('');
    setParsedTransaction(null);
  };

  const handleEdit = () => {
    setShowAddTransaction(true);
    setShowPanel(false);
  };

  if (!recognition) {
    return (
      <button 
        className="p-2 rounded-lg text-mac-text-secondary-light dark:text-mac-text-secondary-dark opacity-50 cursor-not-allowed"
        title="Voice input not supported in this browser"
      >
        <MicOff size={20} />
      </button>
    );
  }

  return (
    <>
      {/* Voice Button */}
      <button
        onClick={isListening ? stopListening : startListening}
        className={`relative p-2 rounded-lg transition-all ${
          isListening 
            ? 'bg-mac-accent-red text-white voice-indicator' 
            : 'hover:bg-black/5 dark:hover:bg-white/5 text-mac-text-secondary-light dark:text-mac-text-secondary-dark'
        }`}
        title={isListening ? 'Stop listening' : 'Start voice input'}
      >
        {isListening ? <Mic size={20} className="animate-pulse" /> : <Mic size={20} />}
      </button>

      {/* Voice Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-16 right-4 w-96 bg-mac-surface-light dark:bg-mac-surface-dark rounded-mac-lg shadow-mac-lg border border-mac-border-light dark:border-mac-border-dark z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-mac-border-light dark:border-mac-border-dark">
              <div className="flex items-center gap-2">
                {isListening && (
                  <span className="w-2 h-2 bg-mac-accent-red rounded-full animate-pulse" />
                )}
                <span className="font-medium">
                  {isListening ? 'Listening...' : 'Voice Input'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Mode Toggle */}
                <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-0.5">
                  <button
                    onClick={() => setMode('transaction')}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      mode === 'transaction' 
                        ? 'bg-mac-surface-light dark:bg-mac-surface-dark shadow-sm' 
                        : ''
                    }`}
                  >
                    Transaction
                  </button>
                  <button
                    onClick={() => setMode('query')}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      mode === 'query' 
                        ? 'bg-mac-surface-light dark:bg-mac-surface-dark shadow-sm' 
                        : ''
                    }`}
                  >
                    Ask
                  </button>
                </div>
                <button
                  onClick={() => setShowPanel(false)}
                  className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Transcript */}
              <div className="mb-4">
                <p className="text-sm text-mac-text-secondary-light dark:text-mac-text-secondary-dark mb-1">
                  {mode === 'transaction' ? 'Say something like:' : 'Ask a question:'}
                </p>
                <p className="text-xs text-mac-text-secondary-light/70 dark:text-mac-text-secondary-dark/70 mb-2">
                  {mode === 'transaction' 
                    ? '"I spent $45 on groceries at Whole Foods"'
                    : '"How much did I spend this month?"'
                  }
                </p>
                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-lg min-h-[60px]">
                  {transcript || (
                    <span className="text-mac-text-secondary-light dark:text-mac-text-secondary-dark">
                      {isListening ? 'Speak now...' : 'Click the mic to start'}
                    </span>
                  )}
                </div>
              </div>

              {/* Processing State */}
              {isProcessingVoice && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 size={20} className="animate-spin text-mac-accent-blue" />
                  <span className="text-sm">Processing...</span>
                </div>
              )}

              {/* Parsed Transaction Result */}
              {parsedTransaction && mode === 'transaction' && (
                <div className="mb-4 p-3 bg-mac-accent-green/10 dark:bg-mac-accent-green/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Parsed Transaction</span>
                    <span className="text-xs px-2 py-0.5 bg-mac-accent-green/20 rounded-full">
                      {Math.round(parsedTransaction.confidence * 100)}% confident
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-mac-text-secondary-light dark:text-mac-text-secondary-dark">Amount:</span>
                      <span className="ml-2 font-medium">
                        ${parsedTransaction.amount.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-mac-text-secondary-light dark:text-mac-text-secondary-dark">Type:</span>
                      <span className={`ml-2 font-medium ${
                        parsedTransaction.type === 'income' ? 'text-mac-accent-green' : 'text-mac-accent-red'
                      }`}>
                        {parsedTransaction.type}
                      </span>
                    </div>
                    <div>
                      <span className="text-mac-text-secondary-light dark:text-mac-text-secondary-dark">Category:</span>
                      <span className="ml-2">{parsedTransaction.category}</span>
                    </div>
                    <div>
                      <span className="text-mac-text-secondary-light dark:text-mac-text-secondary-dark">Date:</span>
                      <span className="ml-2">{parsedTransaction.date}</span>
                    </div>
                    {parsedTransaction.merchant && (
                      <div className="col-span-2">
                        <span className="text-mac-text-secondary-light dark:text-mac-text-secondary-dark">Merchant:</span>
                        <span className="ml-2">{parsedTransaction.merchant}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Response for Queries */}
              {aiResponse && mode === 'query' && (
                <div className="mb-4 p-3 bg-mac-accent-blue/10 dark:bg-mac-accent-blue/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <MessageSquare size={16} className="mt-0.5 text-mac-accent-blue" />
                    <p className="text-sm whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              {parsedTransaction && mode === 'transaction' && (
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmTransaction}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-mac-accent-green text-white rounded-lg font-medium"
                  >
                    <Check size={16} />
                    Confirm
                  </button>
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 bg-black/5 dark:bg-white/5 rounded-lg font-medium"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
