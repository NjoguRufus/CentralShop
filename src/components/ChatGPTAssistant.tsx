import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Download, Trash2, Settings, Bot, User, Minimize2, Maximize2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatGPTAssistant } from '../contexts/ChatGPTAssistantContext';
import { useTheme } from '../contexts/ThemeContext';

interface ChatGPTAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
}

const ChatGPTAssistant: React.FC<ChatGPTAssistantProps> = ({ isOpen, onClose, onMinimize, isMinimized }) => {
  const { 
    messages, 
    isLoading, 
    isTyping, 
    sendMessage, 
    clearChat, 
    exportChat, 
    settings,
    updateSettings 
  } = useChatGPTAssistant();
  
  const { theme } = useTheme();
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageVariants = (role: 'user' | 'assistant') => ({
    hidden: { 
      opacity: 0, 
      y: 20,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  });

  const typingVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        duration: 0.5,
        repeat: Infinity,
        repeatType: "reverse" as const
      }
    }
  };

  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <button
          onClick={onMinimize}
          className="bg-blue-500/90 backdrop-blur-sm border border-blue-400/30 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        >
          <Bot className="w-6 h-6" />
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-4 right-4 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-blue-500/90 backdrop-blur-sm border-b border-blue-400/30 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">AI Assistant</h3>
                  <p className="text-sm text-blue-100">Your intelligent business companion</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Export chat"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={clearChat}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onMinimize}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-blue-500/90 backdrop-blur-sm border border-blue-400/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Welcome to AI Assistant
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Ask me about sales, inventory, customers, or employees
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => sendMessage("How much did we sell today?")}
                    className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-left text-sm"
                  >
                    <div className="font-medium text-blue-900 dark:text-blue-100">Today's Sales</div>
                    <div className="text-xs text-blue-600 dark:text-blue-300">Check revenue</div>
                  </button>
                  <button
                    onClick={() => sendMessage("Show me low stock items")}
                    className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-left text-sm"
                  >
                    <div className="font-medium text-green-900 dark:text-green-100">Low Stock</div>
                    <div className="text-xs text-green-600 dark:text-green-300">Inventory alerts</div>
                  </button>
                  <button
                    onClick={() => sendMessage("How many customers do we have?")}
                    className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors text-left text-sm"
                  >
                    <div className="font-medium text-purple-900 dark:text-purple-100">Customers</div>
                    <div className="text-xs text-purple-600 dark:text-purple-300">Customer data</div>
                  </button>
                  <button
                    onClick={() => sendMessage("Show me today's summary")}
                    className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors text-left text-sm"
                  >
                    <div className="font-medium text-orange-900 dark:text-orange-100">Summary</div>
                    <div className="text-xs text-orange-600 dark:text-orange-300">Business overview</div>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    variants={getMessageVariants(message.role)}
                    initial="hidden"
                    animate="visible"
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start space-x-2 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user' 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-blue-500/90 backdrop-blur-sm border border-blue-400/30 text-white'
                      }`}>
                        {message.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                      </div>
                      
                      <div className={`rounded-lg px-3 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}>
                        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                        <div className={`text-xs mt-1 ${
                          message.role === 'user' 
                            ? 'text-blue-100' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {/* Typing Indicator */}
                {isTyping && (
                  <motion.div
                    variants={getMessageVariants('assistant')}
                    initial="hidden"
                    animate="visible"
                    className="flex justify-start"
                  >
                    <div className="flex items-start space-x-2 max-w-[85%]">
                      <div className="w-6 h-6 rounded-full bg-blue-500/90 backdrop-blur-sm border border-blue-400/30 text-white flex items-center justify-center flex-shrink-0">
                        <Bot className="w-3 h-3" />
                      </div>
                      
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                        <div className="flex items-center space-x-1">
                          <motion.div
                            variants={typingVariants}
                            initial="hidden"
                            animate="visible"
                            className="w-2 h-2 bg-gray-400 rounded-full"
                          />
                          <motion.div
                            variants={typingVariants}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: 0.2 }}
                            className="w-2 h-2 bg-gray-400 rounded-full"
                          />
                          <motion.div
                            variants={typingVariants}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: 0.4 }}
                            className="w-2 h-2 bg-gray-400 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <form onSubmit={handleSubmit} className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about your business..."
                  disabled={isLoading}
                  className="w-full px-3 py-2 pr-10 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </form>
          </div>

          {/* Export Menu */}
          {showExportMenu && (
            <div className="absolute top-16 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-10">
              <button
                onClick={() => {
                  exportChat('csv');
                  setShowExportMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Export as CSV
              </button>
              <button
                onClick={() => {
                  exportChat('pdf');
                  setShowExportMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Export as PDF
              </button>
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <div className="absolute top-16 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-72 z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Assistant Settings</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Typing Indicator
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.enableTypingIndicator}
                    onChange={(e) => updateSettings({ enableTypingIndicator: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Response Variation
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.responseVariation}
                    onChange={(e) => updateSettings({ responseVariation: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Context Memory
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.enableContextMemory}
                    onChange={(e) => updateSettings({ enableContextMemory: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Context Messages: {settings.maxContextMessages}
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={settings.maxContextMessages}
                    onChange={(e) => updateSettings({ maxContextMessages: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatGPTAssistant;



































