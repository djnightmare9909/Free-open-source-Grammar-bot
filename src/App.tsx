/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Upload, 
  History, 
  CheckCircle2, 
  Copy, 
  Trash2, 
  Loader2, 
  ChevronRight,
  Sparkles,
  AlertCircle,
  Clock,
  Settings,
  X,
  Key
} from 'lucide-react';
import { cn } from './lib/utils';
import { extractTextFromFile } from './lib/file-utils';
import { checkGrammar, resetAI, type GrammarResult } from './services/gemini';
import { saveToHistory, getHistory, clearHistory, deleteHistoryItem, getSetting, setSetting } from './lib/db';

interface HistoryItem {
  id: number;
  originalText: string;
  correctedText: string;
  changes: string[];
  timestamp: number;
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<GrammarResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [localAiUrl, setLocalAiUrl] = useState('');
  const [localAiModel, setLocalAiModel] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
    loadSettings();
  }, []);

  const loadHistory = async () => {
    const data = await getHistory();
    setHistory(data.sort((a, b) => b.timestamp - a.timestamp));
  };

  const loadSettings = async () => {
    const [savedKey, savedUrl, savedModel] = await Promise.all([
      getSetting<string>('gemini-api-key'),
      getSetting<string>('local-ai-url'),
      getSetting<string>('local-ai-model')
    ]);
    if (savedKey) setApiKeyInput(savedKey);
    if (savedUrl) setLocalAiUrl(savedUrl);
    if (savedModel) setLocalAiModel(savedModel);
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await Promise.all([
        setSetting('gemini-api-key', apiKeyInput.trim()),
        setSetting('local-ai-url', localAiUrl.trim()),
        setSetting('local-ai-model', localAiModel.trim())
      ]);
      resetAI();
      setShowSettings(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleClearWorkspace = () => {
    setInputText('');
    setResult(null);
    setError(null);
  };

  const handleCheck = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const data = await checkGrammar(inputText);
      setResult(data);
      await saveToHistory({
        originalText: inputText,
        correctedText: data.correctedText,
        changes: data.changes,
        timestamp: Date.now(),
      });
      loadHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to check grammar. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      const text = await extractTextFromFile(file);
      setInputText(text);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.correctedText);
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear all history?')) {
      await clearHistory();
      loadHistory();
    }
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await deleteHistoryItem(id);
    loadHistory();
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    setInputText(item.originalText);
    setResult({
      correctedText: item.correctedText,
      changes: item.changes,
    });
    setShowHistory(false);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar - History */}
      <AnimatePresence>
        {showHistory && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-80 border-r border-border bg-card/50 backdrop-blur-xl flex flex-col"
          >
            <div className="p-6 border-bottom border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className="w-5 h-5" />
                History
              </h2>
              <button
                onClick={handleClearHistory}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No history yet</p>
                </div>
              ) : (
                history.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    onClick={() => restoreHistoryItem(item)}
                    className="p-3 rounded-lg border border-border bg-background hover:border-primary/50 cursor-pointer group transition-all"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-sm line-clamp-2 text-muted-foreground group-hover:text-foreground transition-colors">
                      {item.originalText}
                    </p>
                  </motion.div>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-background/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "p-2 rounded-md hover:bg-accent transition-colors",
                showHistory && "bg-accent text-primary"
              )}
            >
              <History className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Grammar AI
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.pdf,.docx"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-border hover:bg-accent transition-all text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-md hover:bg-accent transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Settings
                  </h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-1 rounded-md hover:bg-accent transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Key className="w-3 h-3" />
                      Gemini API Key
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Enter your API key..."
                      className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none font-mono text-sm transition-all"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Your API key is stored locally in your browser. If left empty, the app will use the default system key.
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Local AI (OpenAI Compatible)</h3>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Server URL
                      </label>
                      <input
                        type="text"
                        value={localAiUrl}
                        onChange={(e) => setLocalAiUrl(e.target.value)}
                        placeholder="e.g., http://localhost:1234/v1"
                        className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none font-mono text-sm transition-all"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Leave empty to use Gemini. Connect to LM Studio, Ollama, etc.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Model ID
                      </label>
                      <input
                        type="text"
                        value={localAiModel}
                        onChange={(e) => setLocalAiModel(e.target.value)}
                        placeholder="e.g., local-model"
                        className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none font-mono text-sm transition-all"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-accent/50 flex justify-end gap-3">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 rounded-lg hover:bg-accent transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all text-sm font-medium flex items-center gap-2"
                  >
                    {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-full min-h-[600px]">
            {/* Input Section */}
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Original Text
                  </label>
                  {(inputText || result || error) && (
                    <button
                      onClick={handleClearWorkspace}
                      className="text-[10px] font-medium text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {inputText.length} characters
                </span>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your text here or upload a document..."
                className="flex-1 w-full p-6 rounded-2xl bg-card border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none resize-none font-mono text-sm leading-relaxed transition-all"
              />
              <button
                onClick={handleCheck}
                disabled={isLoading || !inputText.trim()}
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/10"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Check Grammar
                  </>
                )}
              </button>
            </div>

            {/* Result Section */}
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Corrected Version
                </label>
                {result && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[10px] font-medium hover:text-primary transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                )}
              </div>
              
              <div className="flex-1 relative">
                <AnimatePresence mode="wait">
                  {error ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-destructive/10 rounded-2xl border border-destructive/20"
                    >
                      <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                      <p className="text-sm font-medium text-destructive">{error}</p>
                    </motion.div>
                  ) : result ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-col h-full space-y-4"
                    >
                      <div className="flex-1 p-6 rounded-2xl bg-primary/5 border border-primary/20 font-mono text-sm leading-relaxed overflow-y-auto">
                        {result.correctedText}
                      </div>
                      
                      {/* Changes List */}
                      <div className="p-4 rounded-xl bg-card border border-border">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                          <ChevronRight className="w-3 h-3" />
                          Changes Made
                        </h3>
                        <ul className="space-y-2">
                          {result.changes.map((change, i) => (
                            <li key={i} className="text-xs flex items-start gap-2 text-muted-foreground">
                              <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                              {change}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center border border-dashed border-border rounded-2xl">
                      <FileText className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                      <p className="text-sm text-muted-foreground">
                        Your corrected text will appear here after checking.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="h-12 border-t border-border flex items-center justify-center px-8 text-[10px] text-muted-foreground tracking-widest uppercase">
          Powered by Gemini 3 Flash • Private Local History
        </footer>
      </main>
    </div>
  );
}
