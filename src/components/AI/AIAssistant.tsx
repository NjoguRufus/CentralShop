import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Minimize2, Maximize2, Plus, History, MessageSquare, Clock, Tag, Search, DollarSign, Package, Users, TrendingUp } from 'lucide-react';
import { generateResponse, ChatMessage } from '../../config/gemini';
import Button from '../UI/Button';
import Card from '../UI/Card';
import toast from 'react-hot-toast';
import { collection, getDocs, query, orderBy, where, doc, serverTimestamp } from 'firebase/firestore';
import { addDoc, updateDoc } from '../../offline/firestoreWrappers';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  topic?: string;
  category?: string;
}

const AIAssistant: React.FC = () => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Topic analysis function
  const analyzeChatTopic = (messages: ChatMessage[]): { topic: string; category: string } => {
    if (messages.length < 2) {
      return { topic: 'General', category: 'general' };
    }

    const userMessages = messages.filter(m => m.role === 'user');
    const firstMessage = userMessages[0]?.content.toLowerCase() || '';
    
    // Topic detection based on keywords
    const topics = {
      sales: ['sales', 'revenue', 'profit', 'income', 'money', 'earnings', 'sold', 'orders'],
      inventory: ['inventory', 'stock', 'products', 'items', 'low stock', 'out of stock', 'quantity'],
      customers: ['customers', 'client', 'loyal', 'repeat', 'visits', 'new customers'],
      employees: ['employees', 'staff', 'cashier', 'workers', 'team', 'performance'],
      reports: ['report', 'summary', 'analytics', 'data', 'chart', 'graph'],
      general: ['help', 'assistance', 'question', 'how', 'what', 'when', 'where']
    };

    let detectedCategory = 'general';
    let maxMatches = 0;

    for (const [category, keywords] of Object.entries(topics)) {
      const matches = keywords.filter(keyword => firstMessage.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedCategory = category;
      }
    }

    // Generate topic title
    let topic = 'General Chat';
    if (detectedCategory === 'sales') {
      topic = 'Sales Analysis';
    } else if (detectedCategory === 'inventory') {
      topic = 'Inventory Management';
    } else if (detectedCategory === 'customers') {
      topic = 'Customer Insights';
    } else if (detectedCategory === 'employees') {
      topic = 'Employee Performance';
    } else if (detectedCategory === 'reports') {
      topic = 'Reports & Analytics';
    }

    return { topic, category: detectedCategory };
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      if (!currentUser?.shopId) return;
      
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
      setMessages([
        {
          role: 'assistant',
          content: 'Hi! I\'m your AI assistant. I can help you with sales analysis, inventory management, and business insights. What would you like to know?',
          timestamp: new Date()
        }
      ]);
      setShowChatHistory(false);
      
      // Reload chat sessions
      loadChatSessions();
    } catch (error) {
      console.error('Error creating new chat:', error);
      toast.error('Failed to create new chat');
    }
  };

  const loadChat = async (chatId: string) => {
    try {
      const chatRef = doc(db, `shops/${currentUser?.shopId}/ai_chats`, chatId);
      const chatDoc = await getDocs(collection(db, `shops/${currentUser?.shopId}/ai_chats`));
      
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
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      toast.error('Failed to load chat');
    }
  };

  const saveMessage = async (message: ChatMessage) => {
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
        const { topic, category } = analyzeChatTopic(updatedMessages);
        updateData.title = updatedMessages[1].content.substring(0, 50) + '...';
        updateData.topic = topic;
        updateData.category = category;
      }
      
      await updateDoc(chatRef, updateData);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const suggestedPrompts = [
    "Show me today's sales summary",
    "Check low stock items",
    "Suggest product reorders",
    "Generate sales report"
  ];

  // Filter chat sessions based on search query
  const filteredChatSessions = chatSessions.filter(session => 
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sales': return <DollarSign className="w-4 h-4" />;
      case 'inventory': return <Package className="w-4 h-4" />;
      case 'customers': return <Users className="w-4 h-4" />;
      case 'employees': return <Users className="w-4 h-4" />;
      case 'reports': return <TrendingUp className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const handleSend = async (message?: string) => {
    const messageToSend = message || input.trim();
    if (!messageToSend) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Save user message to Firestore
    await saveMessage(userMessage);

    try {
      // Mock context data - in a real app, this would come from your actual data
      const context = {
        todaysSales: {
          total: 15420,
          orders: 45,
          topProducts: ['Coca Cola 500ml', 'Pepsi 500ml']
        },
        inventory: {
          lowStock: ['Product A', 'Product B'],
          totalProducts: 150
        }
      };

      const response = await generateResponse(messageToSend, context);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Save assistant message to Firestore
      await saveMessage(assistantMessage);
    } catch (error) {
      toast.error('Failed to get AI response');
      console.error('AI Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-primary backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
      >
        <Bot className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
      isMinimized && !showChatHistory ? 'w-80 h-16' : 'w-96 h-[32rem]'
    }`}>
      <Card className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-primary backdrop-blur-sm rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center space-x-2">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">AI Assistant</h3>
                <p className="text-xs text-gray-500">Online</p>
              </div>
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
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={createNewChat}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
              title="New Chat"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(!isMinimized || showChatHistory) && (
          <>
            {/* Chat History Panel */}
            {showChatHistory && (
              <div className="border-b border-gray-200 dark:border-gray-700 p-4 max-h-80 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-[#4A90A4]" />
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Chat History</h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={createNewChat}
                      className="text-xs text-[#4A90A4] hover:text-[#3a7a8a] font-medium flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Chat</span>
                    </button>
                    {isMinimized && (
                      <button
                        onClick={() => setShowChatHistory(false)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        title="Close History"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
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
                      }`}
                      onClick={() => loadChat(session.id)}
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
                        className="text-xs text-[#4A90A4] hover:text-[#3a7a8a] font-medium"
                      >
                        Start your first chat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Messages - Only show when not minimized */}
            {!isMinimized && (
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-gradient-primary backdrop-blur-sm text-black dark:text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
              </div>
            )}

            {/* Suggested Prompts */}
            {!isMinimized && messages.length <= 1 && !showChatHistory && (
              <div className="px-4 pb-2">
                <p className="text-xs text-gray-500 mb-2">Try asking:</p>
                <div className="space-y-1">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handleSend(prompt)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input - Only show when not minimized */}
            {!isMinimized && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything..."
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent"
                />
                <Button
                  onClick={() => handleSend()}
                  variant="primary"
                  size="sm"
                  className="px-3"
                  disabled={loading || !input.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default AIAssistant;