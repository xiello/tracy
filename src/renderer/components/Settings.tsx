import { useState, useEffect } from 'react';
import { 
  Mic, 
  Cloud, 
  Database, 
  Download, 
  Upload,
  Shield,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export default function Settings() {
  const { settings, updateSettings } = useAppStore();
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Check Ollama status on mount
  useEffect(() => {
    checkOllamaStatus();
  }, [settings?.ollamaEndpoint]);

  async function checkOllamaStatus() {
    try {
      const endpoint = settings?.ollamaEndpoint || 'http://localhost:11434';
      const response = await fetch(`${endpoint}/api/tags`);
      if (response.ok) {
        setOllamaStatus('online');
        const data = await response.json();
        setOllamaModels(data.models || []);
      } else {
        setOllamaStatus('offline');
        setOllamaModels([]);
      }
    } catch {
      setOllamaStatus('offline');
      setOllamaModels([]);
    }
  }

  async function refreshModels() {
    setIsLoadingModels(true);
    await checkOllamaStatus();
    setIsLoadingModels(false);
  }

  function formatModelSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  }

  const handleExport = async (format: 'json' | 'csv') => {
    const result = await window.electronAPI.exportData(format);
    if (result) {
      alert(`Data exported successfully to ${result}`);
    }
  };

  const handleImport = async () => {
    const filePath = await window.electronAPI.selectFile({
      filters: [
        { name: 'Data Files', extensions: ['json', 'csv'] },
      ],
    });
    if (filePath) {
      const success = await window.electronAPI.importData(filePath);
      if (success) {
        alert('Data imported successfully!');
        window.location.reload();
      } else {
        alert('Failed to import data. Please check the file format.');
      }
    }
  };

  if (!settings) return null;

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Voice & AI */}
      <section className="p-6 glass-card rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <Mic size={20} className="text-mac-accent-blue" />
          <h2 className="text-lg font-medium">Voice & AI</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Voice Input</p>
              <p className="text-sm text-white/50">
                Enable voice commands and dictation
              </p>
            </div>
            <button
              onClick={() => updateSettings({ voiceEnabled: !settings.voiceEnabled })}
              className={`w-12 h-7 rounded-full transition-colors ${
                settings.voiceEnabled ? 'bg-mac-accent-green' : 'bg-white/20'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                settings.voiceEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">AI Provider</label>
            <select
              value={settings.aiProvider}
              onChange={(e) => updateSettings({ aiProvider: e.target.value as typeof settings.aiProvider })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI GPT</option>
              <option value="auto">Auto (Local first, then Cloud)</option>
            </select>
          </div>

          {/* Ollama Settings */}
          {(settings.aiProvider === 'ollama' || settings.aiProvider === 'auto') && (
            <div className="p-4 bg-white/5 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={16} />
                  <span className="font-medium">Ollama</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    ollamaStatus === 'online' ? 'bg-mac-accent-green' : 
                    ollamaStatus === 'offline' ? 'bg-mac-accent-red' : 'bg-mac-accent-orange'
                  }`} />
                  <span className="text-sm capitalize">{ollamaStatus}</span>
                  <button
                    onClick={refreshModels}
                    disabled={isLoadingModels}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <RefreshCw size={14} className={isLoadingModels ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Endpoint</label>
                <input
                  type="text"
                  value={settings.ollamaEndpoint}
                  onChange={(e) => updateSettings({ ollamaEndpoint: e.target.value })}
                  placeholder="http://localhost:11434"
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Model</label>
                {ollamaModels.length > 0 ? (
                  <select
                    value={settings.ollamaModel}
                    onChange={(e) => updateSettings({ ollamaModel: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                  >
                    {ollamaModels.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name} ({formatModelSize(model.size)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={settings.ollamaModel}
                      onChange={(e) => updateSettings({ ollamaModel: e.target.value })}
                      placeholder="llama3.2"
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30"
                    />
                    <p className="text-xs text-white/40">
                      {ollamaStatus === 'offline' 
                        ? 'Start Ollama to see available models' 
                        : 'No models found. Install with: ollama pull llama3.2'}
                    </p>
                  </div>
                )}
              </div>

              {ollamaModels.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-2">Installed Models ({ollamaModels.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {ollamaModels.map((model) => (
                      <span
                        key={model.name}
                        className={`px-2 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                          settings.ollamaModel === model.name
                            ? 'bg-mac-accent-blue text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                        onClick={() => updateSettings({ ollamaModel: model.name })}
                      >
                        {model.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cloud API Keys */}
          {(settings.aiProvider === 'anthropic' || settings.aiProvider === 'auto') && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Anthropic API Key</label>
              <input
                type="password"
                value={settings.anthropicApiKey || ''}
                onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })}
                placeholder="sk-ant-..."
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30"
              />
            </div>
          )}

          {(settings.aiProvider === 'openai' || settings.aiProvider === 'auto') && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">OpenAI API Key</label>
              <input
                type="password"
                value={settings.openaiApiKey || ''}
                onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30"
              />
            </div>
          )}
        </div>
      </section>

      {/* Data */}
      <section className="p-6 glass-card rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <Cloud size={20} className="text-mac-accent-green" />
          <h2 className="text-lg font-medium">Data</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto Backup</p>
              <p className="text-sm text-white/50">
                Automatically backup data daily
              </p>
            </div>
            <button
              onClick={() => updateSettings({ autoBackup: !settings.autoBackup })}
              className={`w-12 h-7 rounded-full transition-colors ${
                settings.autoBackup ? 'bg-mac-accent-green' : 'bg-white/20'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                settings.autoBackup ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleExport('json')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              <Download size={18} />
              Export JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button
              onClick={handleImport}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              <Upload size={18} />
              Import
            </button>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="p-6 glass-card rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-mac-accent-orange" />
          <h2 className="text-lg font-medium">Security</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Biometric Lock</p>
              <p className="text-sm text-white/50">
                Use Touch ID or Face ID to unlock
              </p>
            </div>
            <button
              onClick={() => updateSettings({ biometricEnabled: !settings.biometricEnabled })}
              className={`w-12 h-7 rounded-full transition-colors ${
                settings.biometricEnabled ? 'bg-mac-accent-green' : 'bg-white/20'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                settings.biometricEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Auto-lock after</label>
            <select
              value={settings.autoLockMinutes}
              onChange={(e) => updateSettings({ autoLockMinutes: parseInt(e.target.value) })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white"
            >
              <option value="1">1 minute</option>
              <option value="5">5 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="0">Never</option>
            </select>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="p-6 glass-card rounded-xl">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-1">Tracy</h2>
          <p className="text-sm text-white/50">
            AI-Powered Expense Tracker
          </p>
          <p className="text-xs text-white/30 mt-2">
            Version 1.0.0
          </p>
        </div>
      </section>
    </div>
  );
}
