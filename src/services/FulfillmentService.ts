import DataService, { SalesData, InventoryData, CustomerData, EmployeeData } from './DataService';
import { ExtractedEntity } from './LocalAI';

export interface FulfillmentResult {
  success: boolean;
  response: string;
  data?: any;
  requiresClarification?: boolean;
}

export class FulfillmentService {
  private dataService: DataService;

  constructor(shopId: string) {
    this.dataService = new DataService(shopId);
  }

  // Main fulfillment dispatcher
  async fulfillIntent(intent: string, entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      switch (intent) {
        case 'check_stock':
          return await this.fulfillCheckStock(entities);
        case 'sales_report_today':
          return await this.fulfillSalesReportToday(entities);
        case 'sales_report_yesterday':
          return await this.fulfillSalesReportYesterday(entities);
        case 'sales_report_week':
          return await this.fulfillSalesReportWeek(entities);
        case 'low_stock_items':
          return await this.fulfillLowStockItems(entities);
        case 'out_of_stock_items':
          return await this.fulfillOutOfStockItems(entities);
        case 'top_selling_products':
          return await this.fulfillTopSellingProducts(entities);
        case 'customer_count':
          return await this.fulfillCustomerCount(entities);
        case 'top_customers':
          return await this.fulfillTopCustomers(entities);
        case 'employee_count':
          return await this.fulfillEmployeeCount(entities);
        case 'sales_by_employee':
          return await this.fulfillSalesByEmployee(entities);
        case 'product_search':
          return await this.fulfillProductSearch(entities);
        case 'business_summary':
          return await this.fulfillBusinessSummary(entities);
        case 'invoice_info':
          return await this.fulfillInvoiceInfo(entities);
        case 'supplier_info':
          return await this.fulfillSupplierInfo(entities);
        case 'expense_info':
          return await this.fulfillExpenseInfo(entities);
        case 'service_info':
          return await this.fulfillServiceInfo(entities);
        case 'stock_report':
          return await this.fulfillStockReport(entities);
        case 'help':
          return await this.fulfillHelp(entities);
        default:
          return {
            success: false,
            response: "I'm not sure how to help with that. Try asking about sales, inventory, customers, employees, invoices, suppliers, expenses, services, or stock reports."
          };
      }
    } catch (error) {
      console.error('Error in fulfillment:', error);
      return {
        success: false,
        response: "I encountered an error while processing your request. Please try again."
      };
    }
  }

  // Check stock for specific products
  private async fulfillCheckStock(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    const productName = entities.find(e => e.type === 'product_name')?.value;
    const productId = entities.find(e => e.type === 'product_id')?.value;
    const productCategory = entities.find(e => e.type === 'product_category')?.value;

    if (!productName && !productId && !productCategory) {
      return {
        success: false,
        response: "Sure, I can check stock. Which product are you asking about? Please specify the product name, ID, or category.",
        requiresClarification: true
      };
    }

    try {
      const inventoryData = await this.dataService.getInventoryData();
      
      if (!inventoryData.hasData) {
        return {
          success: false,
          response: "I don't have inventory data available right now. Please check if products were added to the system."
        };
      }

      // For now, return general inventory status
      // In a real implementation, you'd search for specific products
      if (inventoryData.outOfStockItems.length > 0) {
        return {
          success: true,
          response: `We have ${inventoryData.totalItems} items in inventory. ${inventoryData.outOfStockItems.length} items are currently out of stock.`,
          data: inventoryData
        };
      } else if (inventoryData.lowStockItems.length > 0) {
        return {
          success: true,
          response: `We have ${inventoryData.totalItems} items in inventory. ${inventoryData.lowStockItems.length} items are running low on stock.`,
          data: inventoryData
        };
      } else {
        return {
          success: true,
          response: `We have ${inventoryData.totalItems} items in inventory. All items are well stocked!`,
          data: inventoryData
        };
      }
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access the inventory data. Please try again later."
      };
    }
  }

  // Today's sales report
  private async fulfillSalesReportToday(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const salesData = await this.dataService.getSalesData('today');
      
      if (!salesData.hasData) {
        return {
          success: false,
          response: "No sales recorded for today yet."
        };
      }

      if (salesData.todaySales > 0) {
        let response = `Today's sales are Ksh ${salesData.todaySales.toFixed(2)}.`;
        
        if (salesData.topProducts.length > 0) {
          response += `\n\nTop selling product: ${salesData.topProducts[0].name} (${salesData.topProducts[0].quantity} units sold)`;
        }
        
        return {
          success: true,
          response,
          data: salesData
        };
      } else {
        return {
          success: true,
          response: "No sales recorded for today yet.",
          data: salesData
        };
      }
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access today's sales data. Please try again later."
      };
    }
  }

  // Yesterday's sales report
  private async fulfillSalesReportYesterday(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const salesData = await this.dataService.getSalesData('yesterday');
      
      if (!salesData.hasData) {
        return {
          success: false,
          response: "I don't have sales data for yesterday. No sales were recorded."
        };
      }

      if (salesData.yesterdaySales > 0) {
        return {
          success: true,
          response: `Yesterday's sales were Ksh ${salesData.yesterdaySales.toFixed(2)}.`,
          data: salesData
        };
      } else {
        return {
          success: true,
          response: "No sales were recorded for yesterday.",
          data: salesData
        };
      }
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access yesterday's sales data. Please try again later."
      };
    }
  }

  // This week's sales report
  private async fulfillSalesReportWeek(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const salesData = await this.dataService.getSalesData('week');
      
      if (!salesData.hasData) {
        return {
          success: false,
          response: "I don't have sales data for this week. No sales were recorded."
        };
      }

      if (salesData.weekSales > 0) {
        return {
          success: true,
          response: `This week's sales total Ksh ${salesData.weekSales.toFixed(2)}.`,
          data: salesData
        };
      } else {
        return {
          success: true,
          response: "No sales were recorded for this week.",
          data: salesData
        };
      }
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access this week's sales data. Please try again later."
      };
    }
  }

  // Low stock items
  private async fulfillLowStockItems(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const inventoryData = await this.dataService.getInventoryData();
      
      if (!inventoryData.hasData) {
        return {
          success: false,
          response: "I don't have inventory data available right now. Please check if products were added to the system."
        };
      }

      if (inventoryData.lowStockItems.length > 0) {
        const itemsList = inventoryData.lowStockItems
          .map((item, index) => `${index + 1}. ${item.name} (${item.currentStock} remaining)`)
          .join('\n');
        
        return {
          success: true,
          response: `Here are the items running low on stock:\n\n${itemsList}\n\nYou should consider restocking these items soon.`,
          data: inventoryData
        };
      } else {
        return {
          success: true,
          response: "All items are well stocked! No low stock alerts at the moment.",
          data: inventoryData
        };
      }
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access the inventory data. Please try again later."
      };
    }
  }

  // Out of stock items
  private async fulfillOutOfStockItems(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const inventoryData = await this.dataService.getInventoryData();
      
      if (!inventoryData.hasData) {
        return {
          success: false,
          response: "I don't have inventory data available right now. Please check if products were added to the system."
        };
      }

      if (inventoryData.outOfStockItems.length > 0) {
        const itemsList = inventoryData.outOfStockItems
          .map((item, index) => `${index + 1}. ${item.name}`)
          .join('\n');
        
        return {
          success: true,
          response: `These items are completely out of stock:\n\n${itemsList}\n\nPlease restock these items immediately.`,
          data: inventoryData
        };
      } else {
        return {
          success: true,
          response: "Great news! No items are completely out of stock.",
          data: inventoryData
        };
      }
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access the inventory data. Please try again later."
      };
    }
  }

  // Top selling products
  private async fulfillTopSellingProducts(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const salesData = await this.dataService.getSalesData('today');
      
      if (!salesData.hasData) {
        return {
          success: false,
          response: "I don't have sales data available right now. Please check if sales were logged in the system."
        };
      }

      if (salesData.topProducts.length > 0) {
        const productsList = salesData.topProducts
          .slice(0, 5)
          .map((product, index) => `${index + 1}. ${product.name} - ${product.quantity} units (Ksh ${product.revenue.toFixed(2)})`)
          .join('\n');
        
        return {
          success: true,
          response: `Here are our top selling products:\n\n${productsList}`,
          data: salesData
        };
      } else {
        return {
          success: true,
          response: "No product sales data available at the moment.",
          data: salesData
        };
      }
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access the sales data. Please try again later."
      };
    }
  }

  // Customer count
  private async fulfillCustomerCount(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const customerData = await this.dataService.getCustomerData();
      
      if (!customerData.hasData) {
        return {
          success: false,
          response: "I don't have customer data available right now. Please check if customers were registered in the system."
        };
      }

      return {
        success: true,
        response: `You have ${customerData.totalCustomers} customers in your database.`,
        data: customerData
      };
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access the customer data. Please try again later."
      };
    }
  }

  // Top customers
  private async fulfillTopCustomers(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const customerData = await this.dataService.getCustomerData();
      
      if (!customerData.hasData) {
        return {
          success: false,
          response: "I don't have customer data available right now. Please check if customers were registered in the system."
        };
      }

      if (customerData.topCustomers.length > 0) {
        const customersList = customerData.topCustomers
          .map((customer, index) => `${index + 1}. ${customer.name} (${customer.loyaltyPoints} points)`)
          .join('\n');
        
        return {
          success: true,
          response: `Here are your top customers:\n\n${customersList}`,
          data: customerData
        };
      } else {
        return {
          success: true,
          response: `You have ${customerData.totalCustomers} customers in your database.`,
          data: customerData
        };
      }
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access the customer data. Please try again later."
      };
    }
  }

  // Employee count
  private async fulfillEmployeeCount(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const employeeData = await this.dataService.getEmployeeData();
      
      if (!employeeData.hasData) {
        return {
          success: false,
          response: "I don't have employee data available right now. Please check if employees were added to the system."
        };
      }

      return {
        success: true,
        response: `You have ${employeeData.totalEmployees} employees on your team.`,
        data: employeeData
      };
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access the employee data. Please try again later."
      };
    }
  }

  // Sales by employee
  private async fulfillSalesByEmployee(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const salesData = await this.dataService.getSalesData('today');
      
      if (!salesData.hasData) {
        return {
          success: false,
          response: "I don't have sales data available right now. Please check if sales were logged in the system."
        };
      }

      // For now, return general sales info
      // In a real implementation, you'd track sales by employee
      return {
        success: true,
        response: `Today's total sales are Ksh ${salesData.todaySales.toFixed(2)}. Employee-specific sales tracking is not available at the moment.`,
        data: salesData
      };
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access the sales data. Please try again later."
      };
    }
  }

  // Product search
  private async fulfillProductSearch(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    const productName = entities.find(e => e.type === 'product_name')?.value;
    const productId = entities.find(e => e.type === 'product_id')?.value;

    if (!productName && !productId) {
      return {
        success: false,
        response: "What product would you like me to search for? Please specify the product name or ID.",
        requiresClarification: true
      };
    }

    try {
      const inventoryData = await this.dataService.getInventoryData();
      
      if (!inventoryData.hasData) {
        return {
          success: false,
          response: "I don't have inventory data available right now. Please check if products were added to the system."
        };
      }

      // For now, return general inventory info
      // In a real implementation, you'd search for specific products
      return {
        success: true,
        response: `I found ${inventoryData.totalItems} products in the inventory. Please be more specific about which product you're looking for.`,
        data: inventoryData
      };
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access the inventory data. Please try again later."
      };
    }
  }

  // Business summary
  private async fulfillBusinessSummary(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      const [salesData, inventoryData, customerData, employeeData] = await Promise.all([
        this.dataService.getSalesData('today'),
        this.dataService.getInventoryData(),
        this.dataService.getCustomerData(),
        this.dataService.getEmployeeData()
      ]);

      let summary = `📊 **Business Summary for Today**\n\n`;
      
      if (salesData.hasData) {
        summary += `💰 **Sales:** Today's sales are Ksh ${salesData.todaySales.toFixed(2)}.\n`;
      } else {
        summary += `💰 **Sales:** No sales recorded for today.\n`;
      }
      
      if (inventoryData.hasData) {
        summary += `📦 **Inventory:** ${inventoryData.totalItems} items in stock.`;
        if (inventoryData.lowStockItems.length > 0) {
          summary += ` ${inventoryData.lowStockItems.length} items running low.`;
        }
        if (inventoryData.outOfStockItems.length > 0) {
          summary += ` ${inventoryData.outOfStockItems.length} items out of stock.`;
        }
        summary += `\n`;
      } else {
        summary += `📦 **Inventory:** No inventory data available.\n`;
      }
      
      if (customerData.hasData) {
        summary += `👥 **Customers:** ${customerData.totalCustomers} registered customers.\n`;
      } else {
        summary += `👥 **Customers:** No customer data available.\n`;
      }
      
      if (employeeData.hasData) {
        summary += `👨‍💼 **Employees:** ${employeeData.totalEmployees} team members.\n`;
      } else {
        summary += `👨‍💼 **Employees:** No employee data available.\n`;
      }

      return {
        success: true,
        response: summary,
        data: { salesData, inventoryData, customerData, employeeData }
      };
    } catch (error) {
      return {
        success: false,
        response: "I couldn't generate a business summary. Please try again later."
      };
    }
  }

  // Invoice Information
  private async fulfillInvoiceInfo(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      // For now, return a placeholder response
      // In a real implementation, you'd query the invoices collection
      return {
        success: true,
        response: "I can help you with invoice information. Currently, I don't have access to invoice data, but you can check the Invoicing section in the sidebar to manage your invoices."
      };
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access invoice data. Please try again later."
      };
    }
  }

  // Supplier Information
  private async fulfillSupplierInfo(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      // For now, return a placeholder response
      // In a real implementation, you'd query the suppliers collection
      return {
        success: true,
        response: "I can help you with supplier information. Currently, I don't have access to supplier data, but you can check the Suppliers section in the sidebar to manage your suppliers."
      };
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access supplier data. Please try again later."
      };
    }
  }

  // Expense Information
  private async fulfillExpenseInfo(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      // For now, return a placeholder response
      // In a real implementation, you'd query the expenses collection
      return {
        success: true,
        response: "I can help you with expense information. Currently, I don't have access to expense data, but you can check the Expenses section in the sidebar to manage your expenses."
      };
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access expense data. Please try again later."
      };
    }
  }

  // Service Information
  private async fulfillServiceInfo(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      // For now, return a placeholder response
      // In a real implementation, you'd query the services collection
      return {
        success: true,
        response: "I can help you with service information. Currently, I don't have access to service data, but you can check the Services section in the sidebar to manage your services."
      };
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access service data. Please try again later."
      };
    }
  }

  // Stock Report
  private async fulfillStockReport(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    try {
      return {
        success: true,
        response: "I can help you generate stock reports. You can access comprehensive stock reports including inventory summary, low stock alerts, movement reports, and valuation reports in the Stock Reports section of the sidebar."
      };
    } catch (error) {
      return {
        success: false,
        response: "I couldn't access stock report data. Please try again later."
      };
    }
  }

  // Help
  private async fulfillHelp(entities: ExtractedEntity[]): Promise<FulfillmentResult> {
    return {
      success: true,
      response: `I can help you with the following:

📊 **Sales Reports:**
- "How much did we sell today?"
- "Yesterday's sales"
- "This week's revenue"

📦 **Inventory Management:**
- "Check stock for iPhone"
- "What items are low on stock?"
- "Show me out of stock items"
- "Top selling products"

👥 **Customer & Employee Info:**
- "How many customers do we have?"
- "Who are our top customers?"
- "How many employees do we have?"
- "Who sold the most today?"

💰 **Financial Management:**
- "Invoice information"
- "Supplier details"
- "Expense tracking"
- "Service management"

📈 **Reports & Analytics:**
- "Stock reports"
- "Business summary"
- "Generate reports"

🔍 **Product Search:**
- "Find product by name"
- "Search for Samsung TV"
- "Product ID 456"

Just ask me anything about your business!`
    };
  }
}

































