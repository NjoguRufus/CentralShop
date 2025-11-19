import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { getShopCollectionName } from '../config/shopConfig';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any;
}

interface AIAssistantSettings {
  useExternalAI: boolean;
  externalAIProvider: 'chatgpt' | 'gemini';
  apiKey: string;
  model: string;
}

interface QueryResult {
  intent: string;
  data: any;
  message: string;
  suggestions?: string[];
}

interface AIAssistantContextType {
  messages: ChatMessage[];
  isTyping: boolean;
  settings: AIAssistantSettings;
  sendMessage: (message: string) => Promise<void>;
  clearChat: () => void;
  updateSettings: (settings: Partial<AIAssistantSettings>) => void;
  getQuickActions: () => string[];
}

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

export const useAIAssistant = () => {
  const context = useContext(AIAssistantContext);
  if (context === undefined) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
};

// Intent detection patterns
const intents = {
  sales: {
    keywords: ['sales', 'sold', 'revenue', 'income', 'money', 'earnings', 'profit', 'today', 'week', 'month', 'how much'],
    patterns: [
      /how much.*sold/i,
      /how much.*sales/i,
      /sales.*today/i,
      /revenue.*today/i,
      /total.*sales/i,
      /who.*sold.*most/i,
      /top.*performer/i
    ]
  },
  inventory: {
    keywords: ['stock', 'inventory', 'items', 'products', 'low', 'out', 'available', 'quantity', 'how many'],
    patterns: [
      /how many.*items/i,
      /how many.*products/i,
      /number.*of.*items/i,
      /total.*items/i,
      /count.*items/i,
      /low.*stock/i,
      /out.*of.*stock/i,
      /which.*items.*low/i,
      /stock.*of.*(.+)/i,
      /fastest.*selling/i,
      /top.*product/i
    ]
  },
  customers: {
    keywords: ['customers', 'client', 'loyal', 'repeat', 'visits', 'new', 'top', 'how many'],
    patterns: [
      /how many.*customers/i,
      /number.*of.*customers/i,
      /total.*customers/i,
      /count.*customers/i,
      /top.*customers/i,
      /loyal.*customers/i,
      /new.*customers/i,
      /customer.*visits/i,
      /repeat.*customers/i
    ]
  },
  employees: {
    keywords: ['employees', 'staff', 'cashier', 'workers', 'team', 'performance', 'how many'],
    patterns: [
      /how many.*employees/i,
      /number.*of.*employees/i,
      /total.*employees/i,
      /count.*employees/i,
      /employees.*worked/i,
      /top.*cashier/i,
      /staff.*performance/i
    ]
  },
  general: {
    keywords: ['summary', 'overview', 'status', 'business', 'dashboard'],
    patterns: [
      /business.*summary/i,
      /overview.*today/i,
      /status.*update/i,
      /dashboard.*summary/i
    ]
  }
};

export const AIAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [settings, setSettings] = useState<AIAssistantSettings>({
    useExternalAI: false,
    externalAIProvider: 'chatgpt',
    apiKey: '',
    model: 'gpt-3.5-turbo'
  });

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('ai-assistant-settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Save settings to localStorage
  const updateSettings = (newSettings: Partial<AIAssistantSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem('ai-assistant-settings', JSON.stringify(updatedSettings));
  };

  // Detect intent from user message
  const detectIntent = (message: string): string => {
    const lowerMessage = message.toLowerCase();
    
    for (const [intent, config] of Object.entries(intents)) {
      // Check patterns first (more specific)
      for (const pattern of config.patterns) {
        if (pattern.test(lowerMessage)) {
          return intent;
        }
      }
    }
    
    // If no pattern matches, check keywords with higher threshold
    for (const [intent, config] of Object.entries(intents)) {
      const keywordMatches = config.keywords.filter(keyword => 
        lowerMessage.includes(keyword)
      ).length;
      
      if (keywordMatches >= 2) {
        return intent;
      }
    }
    
    return 'general';
  };

  // Query executors
  const executeQuery = async (intent: string, message: string): Promise<QueryResult> => {
    if (!currentUser?.shopId) {
      return {
        intent: 'error',
        data: null,
        message: 'No shop assigned to your account'
      };
    }

    try {
      switch (intent) {
        case 'sales':
          return await executeSalesQuery(message);
        case 'inventory':
          return await executeInventoryQuery(message);
        case 'customers':
          return await executeCustomersQuery(message);
        case 'employees':
          return await executeEmployeesQuery(message);
        case 'general':
          return await executeGeneralQuery(message);
        default:
          return {
            intent: 'unknown',
            data: null,
            message: 'I didn\'t understand that. Try asking about sales, inventory, customers, or employees.'
          };
      }
    } catch (error) {
      console.error('Query execution error:', error);
      return {
        intent: 'error',
        data: null,
        message: 'Sorry, I encountered an error while processing your request.'
      };
    }
  };

  // Sales query executor
  const executeSalesQuery = async (message: string): Promise<QueryResult> => {
    const ordersRef = collection(db, getShopCollectionName('orders'));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayQuery = query(
      ordersRef,
      where('createdAt', '>=', today),
      where('status', '==', 'completed')
    );
    
    const todaySnapshot = await getDocs(todayQuery);
    const todaySales = todaySnapshot.docs.reduce((sum, doc) => sum + doc.data().total, 0);
    
    // Get this week's sales
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekQuery = query(
      ordersRef,
      where('createdAt', '>=', weekStart),
      where('status', '==', 'completed')
    );
    
    const weekSnapshot = await getDocs(weekQuery);
    const weekSales = weekSnapshot.docs.reduce((sum, doc) => sum + doc.data().total, 0);
    
    // Get top employee
    const employeeStats: { [key: string]: { sales: number, count: number } } = {};
    weekSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const employeeId = data.employeeId;
      if (employeeId) {
        if (!employeeStats[employeeId]) {
          employeeStats[employeeId] = { sales: 0, count: 0 };
        }
        employeeStats[employeeId].sales += data.total;
        employeeStats[employeeId].count += 1;
      }
    });
    
    const topEmployee = Object.entries(employeeStats)
      .sort(([,a], [,b]) => b.sales - a.sales)[0];
    
    if (message.toLowerCase().includes('today')) {
      return {
        intent: 'sales',
        data: { todaySales, weekSales },
        message: `Today's sales are KSH ${todaySales.toFixed(2)}.`,
        suggestions: ['Show me this week\'s sales', 'Who sold the most today?', 'What\'s our top product?']
      };
    }
    
    if (message.toLowerCase().includes('week')) {
      return {
        intent: 'sales',
        data: { weekSales, todaySales },
        message: `This week's sales are KSH ${weekSales.toFixed(2)}.`,
        suggestions: ['Show me today\'s sales', 'Who\'s the top performer?', 'What\'s our business summary?']
      };
    }
    
    // Handle "how much" questions specifically
    if (message.toLowerCase().includes('how much')) {
      return {
        intent: 'sales',
        data: { todaySales, weekSales },
        message: `Today's sales: KSH ${todaySales.toFixed(2)}\nThis week's sales: KSH ${weekSales.toFixed(2)}`,
        suggestions: ['Show me today\'s sales', 'Show me this week\'s sales', 'Who sold the most?']
      };
    }
    
    if (message.toLowerCase().includes('top') || message.toLowerCase().includes('most')) {
      return {
        intent: 'sales',
        data: { topEmployee, employeeStats },
        message: topEmployee ? 
          `Top performer this week: Employee ${topEmployee[0]} with KSH ${topEmployee[1].sales.toFixed(2)} in sales (${topEmployee[1].count} orders).` :
          'No sales data available for this week.',
        suggestions: ['Show me today\'s sales', 'What\'s our weekly total?', 'Show me low stock items']
      };
    }
    
    return {
      intent: 'sales',
      data: { todaySales, weekSales },
      message: `Sales Summary:\n• Today: KSH ${todaySales.toFixed(2)}\n• This Week: KSH ${weekSales.toFixed(2)}`,
      suggestions: ['Show me today\'s sales', 'Who sold the most?', 'What\'s our top product?']
    };
  };

  // Inventory query executor
  const executeInventoryQuery = async (message: string): Promise<QueryResult> => {
    const productsRef = collection(db, getShopCollectionName('products'));
    const productsSnapshot = await getDocs(productsRef);
    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get low stock items (assuming threshold is 10)
    const lowStockItems = products.filter(p => p.stock < 10);
    
    // Get top selling products (this would need order data)
    const ordersRef = collection(db, getShopCollectionName('orders'));
    const ordersSnapshot = await getDocs(ordersRef);
    
    const productSales: { [key: string]: { quantity: number, revenue: number, name: string } } = {};
    
    ordersSnapshot.docs.forEach(doc => {
      const order = doc.data();
      if (order.items) {
        order.items.forEach((item: any) => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = { quantity: 0, revenue: 0, name: item.name || 'Unknown' };
          }
          productSales[item.productId].quantity += item.quantity;
          productSales[item.productId].revenue += item.quantity * item.price;
        });
      }
    });
    
    const topProducts = Object.entries(productSales)
      .sort(([,a], [,b]) => b.quantity - a.quantity)
      .slice(0, 5);
    
    // Handle "how many items" specifically
    if (message.toLowerCase().includes('how many') || 
        message.toLowerCase().includes('number of') || 
        message.toLowerCase().includes('total') ||
        message.toLowerCase().includes('count')) {
      return {
        intent: 'inventory',
        data: { totalItems: products.length },
        message: `Total items in inventory: ${products.length}`,
        suggestions: ['Show me low stock items', 'Show me top products', 'What\'s our inventory status?']
      };
    }
    
    if (message.toLowerCase().includes('low') || message.toLowerCase().includes('out')) {
      return {
        intent: 'inventory',
        data: { lowStockItems },
        message: lowStockItems.length > 0 ? 
          `Low stock items:\n${lowStockItems.map(item => `• ${item.name}: ${item.stock} units`).join('\n')}` :
          'All items are well stocked!',
        suggestions: ['Show me top products', 'What\'s our inventory status?', 'Show me today\'s sales']
      };
    }
    
    if (message.toLowerCase().includes('top') || message.toLowerCase().includes('fastest')) {
      return {
        intent: 'inventory',
        data: { topProducts },
        message: topProducts.length > 0 ?
          `Top selling products:\n${topProducts.map(([id, data], index) => 
            `${index + 1}. ${data.name}: ${data.quantity} units sold (KSH ${data.revenue.toFixed(2)})`
          ).join('\n')}` :
          'No sales data available.',
        suggestions: ['Show me low stock items', 'What\'s our inventory status?', 'Show me today\'s sales']
      };
    }
    
    // Check for specific product query
    const productMatch = message.match(/stock.*of.*(.+)/i);
    if (productMatch) {
      const productName = productMatch[1].trim();
      const product = products.find(p => 
        p.name.toLowerCase().includes(productName.toLowerCase())
      );
      
      if (product) {
        return {
          intent: 'inventory',
          data: { product },
          message: `${product.name} stock: ${product.stock} units (KSH ${product.price} each)`,
          suggestions: ['Show me low stock items', 'What\'s our top product?', 'Show me all products']
        };
      }
    }
    
    return {
      intent: 'inventory',
      data: { lowStockItems, topProducts },
      message: `Inventory Status:\n• Low stock items: ${lowStockItems.length}\n• Total products: ${products.length}`,
      suggestions: ['Show me low stock items', 'What\'s our top product?', 'Show me specific product stock']
    };
  };

  // Customers query executor
  const executeCustomersQuery = async (message: string): Promise<QueryResult> => {
    const customersRef = collection(db, getShopCollectionName('customers'));
    const customersSnapshot = await getDocs(customersRef);
    const customers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get orders to calculate customer visits
    const ordersRef = collection(db, getShopCollectionName('orders'));
    const ordersSnapshot = await getDocs(ordersRef);
    
    const customerVisits: { [key: string]: { count: number, total: number, name: string } } = {};
    
    ordersSnapshot.docs.forEach(doc => {
      const order = doc.data();
      if (order.customerId) {
        if (!customerVisits[order.customerId]) {
          customerVisits[order.customerId] = { count: 0, total: 0, name: 'Unknown' };
        }
        customerVisits[order.customerId].count += 1;
        customerVisits[order.customerId].total += order.total;
      }
    });
    
    // Match customer names
    customers.forEach(customer => {
      if (customerVisits[customer.id]) {
        customerVisits[customer.id].name = customer.name;
      }
    });
    
    const topCustomers = Object.entries(customerVisits)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5);
    
    const loyalCustomers = Object.entries(customerVisits)
      .filter(([,data]) => data.count >= 5)
      .sort(([,a], [,b]) => b.count - a.count);
    
    if (message.toLowerCase().includes('top')) {
      return {
        intent: 'customers',
        data: { topCustomers },
        message: topCustomers.length > 0 ?
          `Top 5 customers:\n${topCustomers.map(([id, data], index) => 
            `${index + 1}. ${data.name}: ${data.count} visits (KSH ${data.total.toFixed(2)})`
          ).join('\n')}` :
          'No customer data available.',
        suggestions: ['Show me loyal customers', 'How many new customers?', 'Show me today\'s sales']
      };
    }
    
    if (message.toLowerCase().includes('loyal')) {
      return {
        intent: 'customers',
        data: { loyalCustomers },
        message: loyalCustomers.length > 0 ?
          `Loyal customers (5+ visits):\n${loyalCustomers.map(([id, data], index) => 
            `${index + 1}. ${data.name}: ${data.count} visits`
          ).join('\n')}` :
          'No loyal customers yet.',
        suggestions: ['Show me top customers', 'How many new customers?', 'Show me customer summary']
      };
    }
    
    if (message.toLowerCase().includes('new')) {
      const thisMonth = new Date();
      thisMonth.setMonth(thisMonth.getMonth() - 1);
      
      const newCustomers = customers.filter(customer => 
        customer.createdAt && customer.createdAt.toDate() > thisMonth
      );
      
      return {
        intent: 'customers',
        data: { newCustomers },
        message: `New customers this month: ${newCustomers.length}`,
        suggestions: ['Show me top customers', 'Show me loyal customers', 'Show me customer summary']
      };
    }
    
    // Handle "how many customers" specifically
    if (message.toLowerCase().includes('how many') || 
        message.toLowerCase().includes('number of') || 
        message.toLowerCase().includes('total') ||
        message.toLowerCase().includes('count')) {
      return {
        intent: 'customers',
        data: { totalCustomers: customers.length },
        message: `Total customers: ${customers.length}`,
        suggestions: ['Show me top customers', 'Show me loyal customers', 'How many new customers?']
      };
    }
    
    return {
      intent: 'customers',
      data: { topCustomers, loyalCustomers, totalCustomers: customers.length },
      message: `Customer Summary:\n• Total customers: ${customers.length}\n• Loyal customers: ${loyalCustomers.length}\n• Top customer: ${topCustomers[0]?.[1]?.name || 'None'}`,
      suggestions: ['Show me top customers', 'Show me loyal customers', 'How many new customers?']
    };
  };

  // Employees query executor
  const executeEmployeesQuery = async (message: string): Promise<QueryResult> => {
    const employeesRef = collection(db, getShopCollectionName('employees'));
    const employeesSnapshot = await getDocs(employeesRef);
    const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get orders for performance data
    const ordersRef = collection(db, getShopCollectionName('orders'));
    const ordersSnapshot = await getDocs(ordersRef);
    
    const employeePerformance: { [key: string]: { sales: number, orders: number, name: string } } = {};
    
    ordersSnapshot.docs.forEach(doc => {
      const order = doc.data();
      if (order.employeeId) {
        if (!employeePerformance[order.employeeId]) {
          employeePerformance[order.employeeId] = { sales: 0, orders: 0, name: 'Unknown' };
        }
        employeePerformance[order.employeeId].sales += order.total;
        employeePerformance[order.employeeId].orders += 1;
      }
    });
    
    // Match employee names
    employees.forEach(employee => {
      if (employeePerformance[employee.id]) {
        employeePerformance[employee.id].name = employee.name;
      }
    });
    
    const topPerformer = Object.entries(employeePerformance)
      .sort(([,a], [,b]) => b.sales - a.sales)[0];
    
    if (message.toLowerCase().includes('top') || message.toLowerCase().includes('cashier')) {
      return {
        intent: 'employees',
        data: { topPerformer, employeePerformance },
        message: topPerformer ?
          `Top performer: ${topPerformer[1].name} with KSH ${topPerformer[1].sales.toFixed(2)} in sales (${topPerformer[1].orders} orders).` :
          'No performance data available.',
        suggestions: ['How many employees worked?', 'Show me staff performance', 'Show me today\'s sales']
      };
    }
    
    if (message.toLowerCase().includes('how many') || 
        message.toLowerCase().includes('number of') || 
        message.toLowerCase().includes('total') ||
        message.toLowerCase().includes('count')) {
      return {
        intent: 'employees',
        data: { totalEmployees: employees.length, activeEmployees: Object.keys(employeePerformance).length },
        message: `Total employees: ${employees.length}`,
        suggestions: ['Show me top performer', 'Show me staff performance', 'Show me employee summary']
      };
    }
    
    return {
      intent: 'employees',
      data: { employees, employeePerformance },
      message: `Employee Summary:\n• Total employees: ${employees.length}\n• Active employees: ${Object.keys(employeePerformance).length}\n• Top performer: ${topPerformer?.[1]?.name || 'None'}`,
      suggestions: ['Show me top performer', 'How many employees worked?', 'Show me staff performance']
    };
  };

  // General query executor
  const executeGeneralQuery = async (message: string): Promise<QueryResult> => {
    // Get business summary
    const [salesResult, inventoryResult, customersResult] = await Promise.all([
      executeSalesQuery('today'),
      executeInventoryQuery('low stock'),
      executeCustomersQuery('top')
    ]);
    
    return {
      intent: 'general',
      data: { sales: salesResult.data, inventory: inventoryResult.data, customers: customersResult.data },
      message: `Business Summary for Today:\n\n📊 Sales: ${salesResult.message}\n\n📦 Inventory: ${inventoryResult.message}\n\n👥 Customers: ${customersResult.message}`,
      suggestions: ['Show me detailed sales', 'Show me low stock items', 'Show me top customers', 'Show me employee performance']
    };
  };

  // Send message and get response
  const sendMessage = async (message: string) => {
    if (!message.trim()) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    
    try {
      // Detect intent
      const intent = detectIntent(message);
      
      // Execute query
      const result = await executeQuery(intent, message);
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.message,
        timestamp: new Date(),
        data: result.data
      };
      
      setTimeout(() => {
        setMessages(prev => [...prev, assistantMessage]);
        setIsTyping(false);
      }, 1000 + Math.random() * 1000); // Simulate typing delay
      
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      
      setTimeout(() => {
        setMessages(prev => [...prev, errorMessage]);
        setIsTyping(false);
      }, 500);
    }
  };

  // Clear chat
  const clearChat = () => {
    setMessages([]);
  };

  // Get quick actions
  const getQuickActions = () => [
    "How much did we sell today?",
    "Show me low stock items",
    "Who are my top customers?",
    "What's the business summary?",
    "Show me top products",
    "How many employees worked?"
  ];

  const value: AIAssistantContextType = {
    messages,
    isTyping,
    settings,
    sendMessage,
    clearChat,
    updateSettings,
    getQuickActions
  };

  return (
    <AIAssistantContext.Provider value={value}>
      {children}
    </AIAssistantContext.Provider>
  );
};

































