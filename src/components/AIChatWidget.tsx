import React, { useMemo, useRef, useState, useEffect } from 'react';
import { askAIPOS, UserRole } from '../services/ai';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { History, Plus, X, Search, Clock, MessageSquare, Minimize2, DollarSign, Package, Users, TrendingUp, Settings, HelpCircle } from 'lucide-react';
import { collection, addDoc, getDocs, query, orderBy, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface AIChatWidgetProps {
  page?: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  topic?: string;
  category?: string;
}

const AIChatWidget: React.FC<AIChatWidgetProps> = ({ page }) => {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user'|'assistant'; content: string; ts: number }>>([]);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const role: UserRole = useMemo(() => {
    const r = (currentUser?.role as string)?.toLowerCase();
    if (r === 'admin') return 'admin';
    if (r?.includes('manager')) return 'manager';
    return 'cashier';
  }, [currentUser?.role]);

  const shopId = currentUser?.shopId || '';
  const userId = currentUser?.uid || '';

  // Load chat sessions on mount
  useEffect(() => {
    if (currentUser?.shopId) {
      loadChatSessions();
    }
  }, [currentUser?.shopId]);

  // Create new chat when opening
  useEffect(() => {
    if (isOpen && !currentChatId) {
      createNewChat();
    }
  }, [isOpen, currentChatId]);

  // Auto-save current chat when component unmounts or when switching
  useEffect(() => {
    return () => {
      if (currentChatId && messages.length > 0) {
        saveCurrentChat();
      }
    };
  }, [currentChatId]);

  // Auto-save when messages change (debounced)
  useEffect(() => {
    if (currentChatId && messages.length > 0) {
      const timeoutId = setTimeout(() => {
        saveCurrentChat();
      }, 2000); // Save after 2 seconds of inactivity

      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentChatId]);

  const loadChatSessions = async () => {
    try {
      const chatsRef = collection(db, `shops/${currentUser?.shopId}/ai_chats`);
      const q = query(chatsRef, orderBy('updatedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const sessions: ChatSession[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        sessions.push({
          id: doc.id,
          title: data.title,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          messageCount: data.messageCount || 0,
          topic: data.topic || 'General',
          category: data.category || 'general'
        });
      });
      
      setChatSessions(sessions);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const createNewChat = async () => {
    try {
      if (!currentUser?.shopId || isCreatingChat) return;
      
      // Save current chat before creating new one
      if (currentChatId && messages.length > 0) {
        await saveCurrentChat();
      }
      
      setIsCreatingChat(true);
      const chatsRef = collection(db, `shops/${currentUser.shopId}/ai_chats`);
      const newChat = {
        title: 'New Chat',
        topic: 'General',
        category: 'general',
        employeeId: currentUser.uid,
        employeeName: currentUser.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        messageCount: 0,
        messages: []
      };
      
      const docRef = await addDoc(chatsRef, newChat);
      setCurrentChatId(docRef.id);
      setMessages([]);
      setShowChatHistory(false);
      
      // Reload chat sessions
      await loadChatSessions();
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const loadChat = async (chatId: string) => {
    try {
      if (!currentUser?.shopId || isLoadingChat) return;
      
      // Save current chat before switching
      if (currentChatId && messages.length > 0) {
        await saveCurrentChat();
      }
      
      setIsLoadingChat(true);
      const chatRef = doc(db, `shops/${currentUser.shopId}/ai_chats`, chatId);
      const chatDoc = await getDocs(collection(db, `shops/${currentUser.shopId}/ai_chats`));
      
      // Find the specific chat
      let chatData = null;
      chatDoc.forEach((doc) => {
        if (doc.id === chatId) {
          chatData = doc.data();
        }
      });
      
      if (chatData && chatData.messages) {
        setMessages(chatData.messages);
        setCurrentChatId(chatId);
        setShowChatHistory(false);
        
        // Scroll to bottom after loading messages
        setTimeout(() => {
          listRef.current?.scrollTo({ top: listRef.current?.scrollHeight, behavior: 'smooth' });
        }, 100);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Topic analysis function
  const analyzeChatTopic = (messages: Array<{ role: 'user'|'assistant'; content: string; ts: number }>): { topic: string; category: string; title: string } => {
    if (messages.length < 2) {
      return { topic: 'General', category: 'general', title: 'New Chat' };
    }

    const userMessages = messages.filter(m => m.role === 'user');
    const firstMessage = userMessages[0]?.content.toLowerCase() || '';
    
    // Topic detection based on keywords
    const topics = {
      sales: ['sales', 'revenue', 'profit', 'income', 'money', 'earnings', 'sold', 'orders', 'transaction', 'payment'],
      inventory: ['inventory', 'stock', 'products', 'items', 'low stock', 'out of stock', 'quantity', 'supply', 'warehouse'],
      customers: ['customers', 'client', 'loyal', 'repeat', 'visits', 'new customers', 'customer service', 'support'],
      employees: ['employees', 'staff', 'cashier', 'workers', 'team', 'performance', 'schedule', 'training'],
      reports: ['report', 'summary', 'analytics', 'data', 'chart', 'graph', 'statistics', 'metrics'],
      settings: ['settings', 'configuration', 'setup', 'preferences', 'options', 'admin'],
      help: ['help', 'how to', 'tutorial', 'guide', 'support', 'assistance', 'question']
    };

    // Find matching topic
    for (const [category, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => firstMessage.includes(keyword))) {
        const topic = category.charAt(0).toUpperCase() + category.slice(1);
        const title = firstMessage.length > 50 
          ? firstMessage.substring(0, 50) + '...' 
          : firstMessage;
        return { topic, category, title };
      }
    }

    // Default fallback
    const title = firstMessage.length > 50 
      ? firstMessage.substring(0, 50) + '...' 
      : firstMessage || 'New Chat';
    return { topic: 'General', category: 'general', title };
  };

  const saveCurrentChat = async () => {
    if (!currentChatId || !currentUser?.shopId || messages.length === 0) return;
    
    try {
      const chatRef = doc(db, `shops/${currentUser.shopId}/ai_chats`, currentChatId);
      const analysis = analyzeChatTopic(messages);
      
      const updateData = {
        messages: messages,
        messageCount: messages.length,
        title: analysis.title,
        topic: analysis.topic,
        category: analysis.category,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(chatRef, updateData);
    } catch (error) {
      console.error('Error saving current chat:', error);
    }
  };

  const saveMessage = async (message: { role: 'user'|'assistant'; content: string; ts: number }) => {
    if (!currentChatId || !currentUser?.shopId) return;
    
    try {
      const chatRef = doc(db, `shops/${currentUser.shopId}/ai_chats`, currentChatId);
      const updatedMessages = [...messages, message];
      
      // Analyze topic when first user message is added
      const updateData: any = {
        messages: updatedMessages,
        messageCount: updatedMessages.length,
        updatedAt: serverTimestamp()
      };

      if (updatedMessages.length === 2) {
        const analysis = analyzeChatTopic(updatedMessages);
        updateData.title = analysis.title;
        updateData.topic = analysis.topic;
        updateData.category = analysis.category;
      }
      
      await updateDoc(chatRef, updateData);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    const iconProps = { className: "w-4 h-4 flex-shrink-0" };
    switch (category) {
      case 'sales': return <DollarSign {...iconProps} />;
      case 'inventory': return <Package {...iconProps} />;
      case 'customers': return <Users {...iconProps} />;
      case 'employees': return <Users {...iconProps} />;
      case 'reports': return <TrendingUp {...iconProps} />;
      case 'settings': return <Settings {...iconProps} />;
      case 'help': return <HelpCircle {...iconProps} />;
      default: return <MessageSquare {...iconProps} />;
    }
  };

  // Filter chat sessions based on search query
  const filteredChatSessions = chatSessions.filter(session => 
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const send = async () => {
    const q = input.trim();
    if (!q || !shopId) return;
    setInput('');
    
    const userMessage = { role: 'user' as const, content: q, ts: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    
    // Save user message
    await saveMessage(userMessage);
    
    try {
      const res = await askAIPOS(q, role, userId, shopId, { page, conversationHistory: messages });
      const assistantMessage = { role: 'assistant' as const, content: res.answer, ts: Date.now() };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Save assistant message
      await saveMessage(assistantMessage);
    } catch (e) {
      const errorMessage = { role: 'assistant' as const, content: 'Sorry, something went wrong.', ts: Date.now() };
      setMessages(prev => [...prev, errorMessage]);
      await saveMessage(errorMessage);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 50);
    }
  };

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-40 rounded-full px-4 py-3 shadow-lg bg-white/80 dark:bg-gray-900/80 backdrop-blur border border-gray-200/60 dark:border-gray-700/60 hover:shadow-xl transition"
        onClick={() => setIsOpen(v => !v)}
      >
        {isOpen ? 'Close Assistant' : 'AI Assistant'}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-96 max-w-[95vw] rounded-2xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/60 dark:border-gray-700/60 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="text-sm font-semibold">AI POS Assistant</div>
            <button
              onClick={() => setShowChatHistory(!showChatHistory)}
              className={`p-1.5 rounded-lg transition-colors relative ${
                showChatHistory 
                  ? 'bg-[#4A90A4] text-white shadow-md' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
              title={showChatHistory ? "Hide Chat History" : "Show Chat History"}
            >
              <History className="w-4 h-4" />
              {showChatHistory && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"></div>
              )}
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-xs opacity-70">{role.toUpperCase()} • {page || 'App'}</div>
            <button
              onClick={createNewChat}
              disabled={isCreatingChat}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isCreatingChat ? "Creating..." : "New Chat"}
            >
              {isCreatingChat ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
              title="Close Assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Chat History Panel */}
        {showChatHistory && (
          <div className="border-b border-gray-200/60 dark:border-gray-700/60 p-4 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-[#4A90A4]" />
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Chat History</h4>
              </div>
              <button
                onClick={createNewChat}
                disabled={isCreatingChat}
                className="text-xs text-[#4A90A4] hover:text-[#3a7a8a] font-medium flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingChat ? (
                  <div className="w-3 h-3 border-2 border-[#4A90A4] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                <span>{isCreatingChat ? 'Creating...' : 'New Chat'}</span>
              </button>
            </div>
            
            {/* Search Bar */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              {filteredChatSessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative p-3 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
                    currentChatId === session.id
                      ? 'bg-[#4A90A4] text-white shadow-md'
                      : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white hover:shadow-sm'
                  } ${isLoadingChat ? 'opacity-50 cursor-wait' : ''}`}
                  onClick={() => !isLoadingChat && loadChat(session.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {getCategoryIcon(session.category || 'general')}
                        <span className="truncate font-medium">{session.title}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          currentChatId === session.id 
                            ? 'bg-white/20 text-white' 
                            : 'bg-[#4A90A4]/10 text-[#4A90A4]'
                        }`}>
                          {session.topic}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center space-x-2 text-xs opacity-70">
                          <Clock className="w-3 h-3" />
                          <span>{session.messageCount} messages</span>
                        </div>
                        <span className="text-xs opacity-70">
                          {session.updatedAt.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredChatSessions.length === 0 && chatSessions.length > 0 && (
                <div className="text-center py-6">
                  <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No chats found matching "{searchQuery}"
                  </p>
                </div>
              )}
              {chatSessions.length === 0 && (
                <div className="text-center py-6">
                  <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    No previous chats
                  </p>
                  <button
                    onClick={createNewChat}
                    disabled={isCreatingChat}
                    className="text-xs text-[#4A90A4] hover:text-[#3a7a8a] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingChat ? 'Creating...' : 'Start your first chat'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div ref={listRef} className="h-80 overflow-y-auto p-4 space-y-3">
            {messages.map(m => (
              <div key={m.ts} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <div className={(m.role === 'user' ? 'bg-[#4A90A4] text-white' : 'bg-gray-100 dark:bg-gray-800 dark:text-white') + ' inline-block px-3 py-2 rounded-xl max-w-[80%]'}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-xs opacity-70">Thinking…</div>}
          </div>
          <div className="p-3 border-t border-gray-200/60 dark:border-gray-700/60 flex items-center space-x-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="Ask anything…"
              className="flex-1 rounded-xl px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
            />
            <button onClick={send} disabled={loading || !input.trim()} className="px-3 py-2 rounded-xl bg-[#4A90A4] text-white text-sm disabled:opacity-50">Send</button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatWidget;


