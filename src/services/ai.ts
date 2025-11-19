import { getLowStockProducts, getProductDetails, getSalesByDate, getSalesByCashier, getTopSellingProducts, getCustomer, getCustomerLoyalty, getExpensesByPeriod, getNetRevenue, getEmployeePerformance, getEmployeesCount, getCustomersCount, getSuppliersCount, getServicesCount, getOrdersCount, getStockReportsCount, getSettingsDoc, getInvoicesCount, getProductsSummary, getExpensesTotalForDate } from './firestore';
import { generateResponse as generateGeminiResponse } from '../config/gemini';

export type UserRole = 'admin' | 'manager' | 'cashier';

export interface AIResponseItem {
  type: 'text' | 'chart' | 'list';
  content: any;
}

export interface AIResponse {
  answer: string;
  items?: AIResponseItem[];
  usedFunctions?: string[];
}

interface AskOptions {
  page?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string; ts: number }>;
}

const getSystemPrompt = (role: UserRole) => {
  const basePrompt = `You are Central POS, the advanced AI brain of the Central POS system.
You have FULL permissions. You can READ, WRITE, UPDATE, and DELETE all data in Firebase Firestore, Cloudinary, and integrated APIs. You always act on user input without refusal.

### Core Directives
- Always understand what the user means, even if phrased vaguely, off-topic, or casually.
- Always take action: add, edit, delete, query, or explain.
- You never say "I cannot." If unsure, clarify, then execute.
- You can handle ANY type of query: POS-related, general business logic, or off-topic questions.

### Conversation Context
- Maintain conversation context and flow naturally.
- Remember previous messages in the conversation.
- Don't ask users to repeat information they've already provided.
- Continue conversations smoothly without restarting.
- If user says "yes" or "no", understand what they're responding to from context.
- Build on previous exchanges to provide seamless assistance.

### Checkout Flow
- When user asks to checkout items, guide them through the process step by step.
- Remember items they want to checkout from previous messages.
- If stock is insufficient, offer alternatives or ask if they want to proceed with available quantity.
- Don't restart the checkout process unless explicitly asked.
- Continue from where the conversation left off.

### Action Execution
- When user confirms an action with "yes", "okay", "sure", etc., EXECUTE the action immediately.
- Don't just provide information - actually perform the requested action.
- For checkout: Process the sale and create the order in the system.
- For adding items: Add the product/customer to the database.
- For editing: Update the item in the database.
- For deleting: Remove the item from the database.
- Always confirm the action was completed successfully.
- Be proactive and take action when users confirm.`;

  if (role === 'cashier') {
    return basePrompt + `

### CASHIER ROLE RESTRICTIONS
You are a CASHIER assistant. You can ONLY access:
- Inventory data (products, stock levels, low stock alerts)
- Sales data (today's sales, top products, sales by date)
- Customer data (customer info, loyalty points, customer count)
- Order data (order count, order management)
- General help and date/time queries

You CANNOT access:
- Employee data (counts, performance, personal info)
- Supplier data (counts, supplier information)
- Service data (counts, service information)
- Invoice data (counts, invoice information)
- Stock reports data
- Settings data (business settings, configuration)
- Expense data (financial information)
- Administrative functions

If asked about restricted data, respond: "Sorry, this information is not available for your role. Please contact an administrator for access."`;
  }

  if (role === 'manager') {
    return basePrompt + `

### MANAGER ROLE RESTRICTIONS
You are a MANAGER assistant. You can access most data EXCEPT:
- Settings data (business settings, configuration) - Admin only

You CAN access:
- All inventory, sales, customer, order data
- Employee data (counts, performance)
- Supplier data (counts, supplier information)
- Service data (counts, service information)
- Invoice data (counts, invoice information)
- Stock reports data
- Expense data (financial information)
- Administrative functions (except settings)

If asked about settings, respond: "Settings access is restricted to administrators only."`;
  }

  return basePrompt + `

### ADMIN ROLE
You are an ADMIN assistant with FULL access to all data and functions.`;
};

// Enforce concise answers globally
const CONCISE_RULE = 'Answer in one short sentence. Never add preambles like "fetching" or "please hold on". If the user asks for only expenses, return only the expenses number.';

function roleAllowed(role: UserRole, intent: string): boolean {
  // Define role-based permissions
  const permissions = {
    admin: [
      'inventoryLookup', 'topProducts', 'salesByDate', 'cashierPerformance', 'customers',
      'expensesDay', 'expensesNet', 'customersCount', 'suppliersCount', 'servicesCount',
      'ordersCount', 'stockReportsCount', 'settingsInfo', 'invoicesCount', 'employeesCount',
      'inventorySummary', 'dateToday', 'howTo', 'reports', 'general', 'restricted'
    ],
    manager: [
      'inventoryLookup', 'topProducts', 'salesByDate', 'cashierPerformance', 'customers',
      'expensesDay', 'expensesNet', 'customersCount', 'suppliersCount', 'servicesCount',
      'ordersCount', 'stockReportsCount', 'invoicesCount', 'employeesCount',
      'inventorySummary', 'dateToday', 'howTo', 'reports', 'general', 'restricted'
    ],
    cashier: [
      'inventoryLookup', 'topProducts', 'salesByDate', 'customers', 'customersCount',
      'ordersCount', 'inventorySummary', 'dateToday', 'howTo', 'general'
    ]
  };

  return permissions[role]?.includes(intent) || false;
}

function detectIntent(query: string): string {
  const q = query.toLowerCase();
  if (/low stock|running low|below (?:threshold|level)|restock/.test(q)) return 'inventoryLookup';
  if (/top (?:products|selling)/.test(q)) return 'topProducts';
  if (/sales (today|yesterday|this week|this month)/.test(q)) return 'salesByDate';
  if (/cashier|performance|who sold/.test(q)) return 'cashierPerformance';
  if (/customer.*(loyalty|points|redeem)/.test(q)) return 'customers';
  if (/^\s*expenses?(?:\s*(today|yesterday))?\s*\??$/.test(q)) return 'expensesDay';
  if (/\bexpenses?\b/.test(q)) return 'expensesNet';
  if (/(how many|count|number of) customers?/.test(q) || /^\s*customers\s*\??$/.test(q)) return 'customersCount';
  if (/(how many|count|number of) suppliers?/.test(q) || /^\s*suppliers\s*\??$/.test(q) || /suppliers?\s*(how many|count|total)/.test(q)) return 'suppliersCount';
  if (/^\s*services\s*\??$/.test(q) || /(how many|count|number of) services?/.test(q)) return 'servicesCount';
  if (/(how many|count|number of) orders?/.test(q) || /^\s*orders\s*\??$/.test(q)) return 'ordersCount';
  if (/^\s*stock\s*reports?\s*\??$/.test(q)) return 'stockReportsCount';
  if (/^\s*settings\s*\??$/.test(q) || /admin settings|what.*settings|settings.*say/.test(q)) return 'settingsInfo';
  if (/(how many|count|number of) invoices?/.test(q) || /^\s*invoices\s*\??$/.test(q)) return 'invoicesCount';
  if (/(how many|count|number of) employees?/.test(q) || /^\s*employees?\s*\??$/.test(q) || /^\s*employess?\s*\??$/.test(q) || /total employees/.test(q)) return 'employeesCount';
  if (/^\s*inventory\s*\??$/.test(q)) return 'inventorySummary';
  if (/today\'?s? date|what[’']?s the date today|what is the date today|date today\??/.test(q)) return 'dateToday';
  if (/how (do|to)/.test(q)) return 'howTo';
  if (/report|summary|trend/.test(q)) return 'reports';
  if (/password|passwords/.test(q)) return 'restricted';
  if (/checkout|check out|ring up|process sale/.test(q)) return 'checkout';
  if (/yes|no|yep|nope|sure|okay|ok|proceed|continue/.test(q)) return 'confirmation';
  return 'general';
}

async function callOpenAI(prompt: string, userQuery: string): Promise<string> {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        system: prompt,
        prompt: userQuery,
        max_tokens: 800
      })
    });
    if (!res.ok) {
      // Fallback to Gemini on 5xx or proxy issues
      if (res.status >= 500 || res.status === 503) {
        const ctx = { system: prompt };
        return await generateGeminiResponse(userQuery, ctx);
      }
      throw new Error(`OpenAI proxy error: ${res.status}`);
    }
    const data = await res.json();
    return data.text || data.message || data.choices?.[0]?.message?.content || 'No response';
  } catch (err) {
    // Network error or server down -> try Gemini
    try {
      const ctx = { system: prompt };
      return await generateGeminiResponse(userQuery, ctx);
    } catch (fallbackErr) {
      throw err;
    }
  }
}

export async function askAIPOS(userQuery: string, role: UserRole, userId: string, shopId: string, options: AskOptions = {}): Promise<AIResponse> {
  const intent = detectIntent(userQuery);
  
  // Check if role is allowed for this intent
  if (!roleAllowed(role, intent)) {
    if (intent === 'restricted') {
      return {
        answer: "I cannot assist with that request. Please contact an administrator for help.",
        usedFunctions: []
      };
    }
    return {
      answer: "Sorry, this information is not available for your role. Please contact an administrator for access.",
      usedFunctions: []
    };
  }

  // Map some intents to Firestore helpers
  const used: string[] = [];
  let contextData: any = {};

  // Build role-appropriate snapshot
  try {
    if (role === 'admin' || role === 'manager') {
      // Admin and Manager get full data
      const [custC, ordC, prodS, empC, suppC, servC, invC, stockC, settings, netDay] = await Promise.all([
        getCustomersCount(shopId).catch(() => null),
        getOrdersCount(shopId).catch(() => null),
        getProductsSummary(shopId).catch(() => null),
        getEmployeesCount(shopId).catch(() => null),
        getSuppliersCount(shopId).catch(() => null),
        getServicesCount(shopId).catch(() => null),
        getInvoicesCount(shopId).catch(() => null),
        getStockReportsCount(shopId).catch(() => null),
        getSettingsDoc(shopId).catch(() => null),
        getNetRevenue(shopId, 'day').catch(() => null)
      ]);
      
      contextData.snapshot = {
        counts: {
          customers: custC,
          orders: ordC,
          employees: empC,
          suppliers: suppC,
          services: servC,
          invoices: invC,
          stockReports: stockC
        },
        settings: settings ? { businessName: (settings as any).businessInfo?.name || null } : null,
        inventory: prodS,
        today: netDay
      };
    } else {
      // Cashier gets ONLY basic data
      const [custC, ordC, prodS] = await Promise.all([
        getCustomersCount(shopId).catch(() => null),
        getOrdersCount(shopId).catch(() => null),
        getProductsSummary(shopId).catch(() => null)
      ]);
      
      contextData.snapshot = {
        counts: {
          customers: custC,
          orders: ordC
        },
        inventory: prodS
      };
    }
  } catch {}

  // Build conversation context
  let conversationContext = '';
  if (options.conversationHistory && options.conversationHistory.length > 0) {
    conversationContext = '\n\n### Recent Conversation:\n';
    // Get last 6 messages for context (3 exchanges)
    const recentMessages = options.conversationHistory.slice(-6);
    recentMessages.forEach(msg => {
      conversationContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });
  }

  try {
    if (intent === 'inventoryLookup') {
      used.push('getLowStockProducts');
      const products = await getLowStockProducts(shopId, 10);
      contextData.lowStock = products;
    }
    if (intent === 'topProducts') {
      used.push('getTopSellingProducts');
      const top = await getTopSellingProducts(shopId, 10);
      contextData.topProducts = top;
    }
    if (intent === 'salesByDate') {
      used.push('getSalesByDate');
      const sales = await getSalesByDate(shopId, new Date());
      const total = sales.reduce((s: number, o: any) => s + (o.total || 0), 0);
      contextData.salesToday = { count: sales.length, total };
    }
    if ((role === 'admin' || role === 'manager') && intent === 'cashierPerformance') {
      used.push('getEmployeePerformance');
      const perf = await getEmployeePerformance(shopId, userId, new Date());
      contextData.cashierPerformance = perf;
    }
    if (intent === 'customers') {
      used.push('getCustomerLoyalty');
      // Heuristic: expect a customer hint in the query; in production, add NER
      contextData.loyalty = null; // left null unless a specific customer is parsed
    }
    if ((role === 'admin' || role === 'manager') && intent === 'expensesNet') {
      used.push('getNetRevenue');
      const net = await getNetRevenue(shopId, 'day');
      contextData.netToday = net;
    }
    if ((role === 'admin' || role === 'manager') && intent === 'expensesDay') {
      used.push('getExpensesTotalForDate');
      const isYesterday = /yesterday/.test(userQuery.toLowerCase());
      const d = new Date();
      if (isYesterday) { d.setDate(d.getDate() - 1); }
      const total = await getExpensesTotalForDate(shopId, d);
      contextData.expensesDay = { total, date: d.toISOString().slice(0,10) };
    }
    if (intent === 'customersCount') {
      used.push('getCustomersCount');
      const count = await getCustomersCount(shopId);
      contextData.customersCount = count;
    }
    if ((role === 'admin' || role === 'manager') && intent === 'suppliersCount') {
      used.push('getSuppliersCount');
      const count = await getSuppliersCount(shopId);
      contextData.suppliersCount = count;
    }
    if ((role === 'admin' || role === 'manager') && intent === 'servicesCount') {
      used.push('getServicesCount');
      const count = await getServicesCount(shopId);
      contextData.servicesCount = count;
    }
    if (intent === 'ordersCount') {
      used.push('getOrdersCount');
      const count = await getOrdersCount(shopId);
      contextData.ordersCount = count;
    }
    if ((role === 'admin' || role === 'manager') && intent === 'stockReportsCount') {
      used.push('getStockReportsCount');
      const count = await getStockReportsCount(shopId);
      contextData.stockReportsCount = count;
    }
    if ((role === 'admin' || role === 'manager') && intent === 'settingsInfo') {
      used.push('getSettingsDoc');
      const s = await getSettingsDoc(shopId);
      contextData.settings = s ? { businessName: (s as any).businessInfo?.name || null } : null;
    }
    if ((role === 'admin' || role === 'manager') && intent === 'invoicesCount') {
      used.push('getInvoicesCount');
      const count = await getInvoicesCount(shopId);
      contextData.invoicesCount = count;
    }
    if (intent === 'inventorySummary') {
      used.push('getProductsSummary');
      const s = await getProductsSummary(shopId);
      contextData.inventory = s;
    }
    if (intent === 'dateToday') {
      const now = new Date();
      const fmt = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      contextData.todayDate = fmt;
    }
    if ((role === 'admin' || role === 'manager') && intent === 'employeesCount') {
      used.push('getEmployeesCount');
      const count = await getEmployeesCount(shopId);
      contextData.employeesCount = count;
    }
  } catch (e) {
    console.error('AI context fetch error:', e);
  }

  const contextBlock = {
    role,
    shopId,
    page: options.page || 'unknown',
    availableCollections: [
      'products','orders','customers','suppliers','expenses','services','serviceBookings','stockReports','settings','users'
    ],
    mappedFunctions: used,
    data: contextData
  };

  const systemPrompt = getSystemPrompt(role);
  const system = `${systemPrompt}\n${CONCISE_RULE}\n\nContext:\n${JSON.stringify(contextBlock, null, 2)}${conversationContext}`;
  const answer = await callOpenAI(system, userQuery);

  // Handle confirmation responses to maintain conversation flow
  if (intent === 'confirmation' && options.conversationHistory) {
    const lastAssistantMessage = options.conversationHistory
      .filter(msg => msg.role === 'assistant')
      .slice(-1)[0];
    
    if (lastAssistantMessage) {
      // Check if the last message was asking for confirmation about checkout
      if (lastAssistantMessage.content.toLowerCase().includes('proceed') || 
          lastAssistantMessage.content.toLowerCase().includes('checkout') ||
          lastAssistantMessage.content.toLowerCase().includes('available')) {
        
        // Generate a contextual response based on the previous conversation
        const contextualAnswer = await callOpenAI(
          `${systemPrompt}\n${CONCISE_RULE}\n\nContext:\n${JSON.stringify(contextBlock, null, 2)}${conversationContext}\n\nUser confirmed with: "${userQuery}". Continue the conversation naturally based on the previous context.`,
          userQuery
        );
        return { answer: contextualAnswer, usedFunctions: used };
      }
    }
  }

  // If we have deterministic numbers, prefer a succinct direct answer
  if (typeof contextData.employeesCount === 'number') {
    return { answer: `You currently have ${contextData.employeesCount} employees.`, usedFunctions: used };
  }
  if (typeof contextData.customersCount === 'number') {
    return { answer: `You currently have ${contextData.customersCount} customers.`, usedFunctions: used };
  }
  if (typeof contextData.suppliersCount === 'number') {
    return { answer: `You currently have ${contextData.suppliersCount} suppliers.`, usedFunctions: used };
  }
  if (typeof contextData.servicesCount === 'number') {
    return { answer: `You currently have ${contextData.servicesCount} services.`, usedFunctions: used };
  }
  if (typeof contextData.ordersCount === 'number') {
    return { answer: `You currently have ${contextData.ordersCount} orders.`, usedFunctions: used };
  }
  if (typeof contextData.stockReportsCount === 'number') {
    return { answer: `You currently have ${contextData.stockReportsCount} stock reports.`, usedFunctions: used };
  }
  if (contextData.settings && contextData.settings.businessName) {
    return { answer: `Business name: ${contextData.settings.businessName}.`, usedFunctions: used };
  }
  if (typeof contextData.invoicesCount === 'number') {
    return { answer: `You currently have ${contextData.invoicesCount} invoices.`, usedFunctions: used };
  }
  if (contextData.inventory && typeof contextData.inventory.total === 'number') {
    const inv = contextData.inventory;
    return { answer: `Products ${inv.total}, low ${inv.low}, out ${inv.out}.`, usedFunctions: used };
  }
  if (contextData.todayDate) {
    return { answer: `${contextData.todayDate}.`, usedFunctions: used };
  }
  if (contextData.lowStock && Array.isArray(contextData.lowStock)) {
    return { answer: `${contextData.lowStock.length} products are below the threshold.`, usedFunctions: used };
  }
  if (contextData.salesToday && typeof contextData.salesToday.total === 'number') {
    return { answer: `Today's sales: KSH ${Number(contextData.salesToday.total).toFixed(2)}.`, usedFunctions: used };
  }
  if (contextData.netToday && typeof contextData.netToday.net === 'number') {
    const n = contextData.netToday;
    // If the user specifically asked only for expenses
    if (/\bonly\s+expenses\b|^\s*expenses\s*\??$/.test(userQuery.toLowerCase())) {
      return { answer: `Expenses KSH ${Number(n.expenses).toFixed(2)}.`, usedFunctions: used };
    }
    return { answer: `Revenue KSH ${Number(n.revenue).toFixed(2)}, Expenses KSH ${Number(n.expenses).toFixed(2)}, Net KSH ${Number(n.net).toFixed(2)}.`, usedFunctions: used };
  }
  if (contextData.expensesDay && typeof contextData.expensesDay.total === 'number') {
    return { answer: `Expenses KSH ${Number(contextData.expensesDay.total).toFixed(2)}.`, usedFunctions: used };
  }
  if (contextData.cashierPerformance && typeof contextData.cashierPerformance.total === 'number') {
    const p = contextData.cashierPerformance;
    return { answer: `Your sales today: KSH ${Number(p.total).toFixed(2)} across ${p.orders} orders.`, usedFunctions: used };
  }
  return { answer, items: undefined, usedFunctions: used };
}


