import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { LocalAIAssistant } from '../services/LocalAIAssistant';
import { askAI } from '../services/aiService';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  data?: any;
}

export interface ConversationContext {
  lastQuery: string;
  lastIntent: string;
  lastData: any;
  conversationHistory: ChatMessage[];
}

export interface ChatGPTAssistantSettings {
  useExternalAI: boolean;
  externalAIProvider: 'chatgpt' | 'gemini';
  openaiApiKey: string;
  geminiApiKey: string;
  model: string;
  enableContextMemory: boolean;
  maxContextMessages: number;
  enableTypingIndicator: boolean;
  responseVariation: boolean;
}

interface ChatGPTAssistantContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  isTyping: boolean;
  conversationContext: ConversationContext;
  settings: ChatGPTAssistantSettings;
  sendMessage: (message: string) => Promise<void>;
  clearChat: () => void;
  exportChat: (format: 'pdf' | 'csv') => void;
  updateSettings: (settings: Partial<ChatGPTAssistantSettings>) => void;
  generateDailySummary: () => Promise<string>;
}

const ChatGPTAssistantContext = createContext<ChatGPTAssistantContextType | undefined>(undefined);

export const useChatGPTAssistant = () => {
  const context = useContext(ChatGPTAssistantContext);
  if (context === undefined) {
    throw new Error('useChatGPTAssistant must be used within a ChatGPTAssistantProvider');
  }
  return context;
};

export const ChatGPTAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    lastQuery: '',
    lastIntent: '',
    lastData: null,
    conversationHistory: []
  });
  
  const [settings, setSettings] = useState<ChatGPTAssistantSettings>({
    useExternalAI: true,
    externalAIProvider: 'chatgpt',
    openaiApiKey: '',
    geminiApiKey: '',
    model: 'gpt-4o-mini',
    enableContextMemory: true,
    maxContextMessages: 20,
    enableTypingIndicator: true,
    responseVariation: true
  });

  // Initialize Local AI Assistant (kept for snapshot/fallback)
  const [localAI, setLocalAI] = useState<LocalAIAssistant | null>(null);
  useEffect(() => {
    if (currentUser?.shopId) setLocalAI(new LocalAIAssistant(currentUser.shopId));
    else setLocalAI(null);
  }, [currentUser?.shopId]);

  // Load settings/history
  useEffect(() => {
    const savedSettings = localStorage.getItem('chatgpt-assistant-settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);
  useEffect(() => {
    localStorage.setItem('chatgpt-assistant-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const request = indexedDB.open('POSAssistantDB', 1);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('chatHistory')) {
            db.createObjectStore('chatHistory', { keyPath: 'id' });
          }
        };
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['chatHistory'], 'readonly');
          const store = transaction.objectStore('chatHistory');
          const reqAll = store.getAll();
          reqAll.onsuccess = () => {
            const chatHistory = reqAll.result || [];
            setMessages(chatHistory);
            setConversationContext(prev => ({
              ...prev,
              conversationHistory: chatHistory.slice(-settings.maxContextMessages)
            }));
          };
        };
      } catch {}
    };
    loadChatHistory();
  }, [settings.maxContextMessages]);

  const saveMessage = useCallback(async (message: ChatMessage) => {
    try {
      const request = indexedDB.open('POSAssistantDB', 1);
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['chatHistory'], 'readwrite');
        const store = transaction.objectStore('chatHistory');
        store.add(message);
      };
    } catch {}
  }, []);

  const sendMessage = async (message: string): Promise<void> => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    await saveMessage(userMessage);

    setIsLoading(true);
    if (settings.enableTypingIndicator) setIsTyping(true);

    try {
      const role = (currentUser?.role as string) || 'employee';
      const shopId = currentUser?.shopId || 'global';
      const result = await askAI(message, role, { shopId, model: settings.model });

      if (settings.enableTypingIndicator) {
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.answer,
        timestamp: new Date(),
        intent: result.intent,
        data: result.context
      };

      setMessages(prev => [...prev, assistantMessage]);
      await saveMessage(assistantMessage);

      setConversationContext(prev => ({
        lastQuery: message,
        lastIntent: result.intent,
        lastData: result.context,
        conversationHistory: [...prev.conversationHistory, userMessage, assistantMessage].slice(-settings.maxContextMessages)
      }));
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      await saveMessage(errorMessage);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConversationContext({ lastQuery: '', lastIntent: '', lastData: null, conversationHistory: [] });
    const request = indexedDB.open('POSAssistantDB', 1);
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(['chatHistory'], 'readwrite');
      const store = transaction.objectStore('chatHistory');
      store.clear();
    };
  };

  const exportChat = (_format: 'pdf' | 'csv') => {};
  const generateDailySummary = async (): Promise<string> => '';
  const updateSettings = (s: Partial<ChatGPTAssistantSettings>) => setSettings(prev => ({ ...prev, ...s }));

  const value: ChatGPTAssistantContextType = {
    messages,
    isLoading,
    isTyping,
    conversationContext,
    settings,
    sendMessage,
    clearChat,
    exportChat,
    updateSettings,
    generateDailySummary
  };

  return (
    <ChatGPTAssistantContext.Provider value={value}>
      {children}
    </ChatGPTAssistantContext.Provider>
  );
};































