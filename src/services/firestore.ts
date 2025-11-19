import { collection, doc, getDoc, getDocs, query, where, orderBy, limit as qLimit, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getShopCollectionName } from '../config/shopConfig';

// Types kept minimal to avoid coupling; consumers can refine as needed

export async function getLowStockProducts(shopId: string, threshold: number) {
  const snap = await getDocs(query(collection(db, getShopCollectionName('products')), where('stock', '<=', threshold)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getProductDetails(shopId: string, productId: string) {
  const ref = doc(db, getShopCollectionName('products'), productId);
  const d = await getDoc(ref);
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

export async function getSalesByDate(shopId: string, date: Date) {
  const start = new Date(date);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const snap = await getDocs(query(
    collection(db, getShopCollectionName('orders')),
    where('createdAt', '>=', start),
    where('createdAt', '<', end)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSalesByCashier(shopId: string, cashierId: string, date?: Date) {
  const constraints: any[] = [where('employeeId', '==', cashierId)];
  if (date) {
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    constraints.push(where('createdAt', '>=', start), where('createdAt', '<', end));
  }
  const snap = await getDocs(query(collection(db, getShopCollectionName('orders')), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTopSellingProducts(shopId: string, topN: number) {
  // Simple approach: fetch recent orders and aggregate client-side
  const snap = await getDocs(query(collection(db, getShopCollectionName('orders')), orderBy('createdAt', 'desc'), qLimit(500)));
  const counts: Record<string, { name?: string; qty: number }> = {};
  snap.docs.forEach(d => {
    const data: any = d.data();
    (data.items || []).forEach((it: any) => {
      const key = it.productId || it.name;
      if (!key) return;
      counts[key] = counts[key] || { name: it.name, qty: 0 };
      counts[key].qty += it.quantity || 0;
    });
  });
  const arr = Object.entries(counts).map(([productId, v]) => ({ productId, name: v.name, quantity: v.qty }));
  arr.sort((a,b) => b.quantity - a.quantity);
  return arr.slice(0, topN);
}

export async function getProductsByShop(shopId: string) {
  const snap = await getDocs(query(collection(db, getShopCollectionName('products'))));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getProductsSummary(shopId: string) {
  const products: any[] = await getProductsByShop(shopId);
  const total = products.length;
  const low = products.filter(p => typeof p.stock === 'number' && p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 10)).length;
  const out = products.filter(p => typeof p.stock === 'number' && p.stock <= 0).length;
  return { total, low, out };
}

export async function getOrdersCount(shopId: string, range?: 'day'|'week'|'month'|'year') {
  const col = collection(db, getShopCollectionName('orders'));
  if (!range) {
    const snap = await getDocs(col);
    return snap.docs.length;
  }
  const now = new Date();
  let start = new Date();
  let end = new Date();
  switch(range){
    case 'day': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); end = new Date(start); end.setDate(end.getDate()+1); break;
    case 'week': end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); start = new Date(end); start.setDate(start.getDate()-7); break;
    case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth()+1, 1); break;
    case 'year': start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear()+1, 0, 1); break;
  }
  const snap = await getDocs(query(col, where('createdAt', '>=', start), where('createdAt', '<', end)));
  return snap.docs.length;
}

export async function getCustomer(shopId: string, customerId: string) {
  const ref = doc(db, getShopCollectionName('customers'), customerId);
  const d = await getDoc(ref);
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

export async function getCustomerLoyalty(shopId: string, customerId: string) {
  const c = await getCustomer(shopId, customerId);
  if (!c) return null;
  return { customerId: c.id, name: (c as any).name, points: (c as any).loyaltyPoints || 0 };
}

export async function getCustomersByShop(shopId: string) {
  const snap = await getDocs(query(collection(db, getShopCollectionName('customers'))));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getCustomersCount(shopId: string) {
  const customers = await getCustomersByShop(shopId);
  return customers.length;
}

export async function getExpensesByPeriod(shopId: string, range: 'day'|'week'|'month'|'year') {
  const now = new Date();
  let start = new Date();
  let end = new Date();
  switch(range){
    case 'day': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); end = new Date(start); end.setDate(end.getDate()+1); break;
    case 'week': end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); start = new Date(end); start.setDate(start.getDate()-7); break;
    case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth()+1, 1); break;
    case 'year': start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear()+1, 0, 1); break;
  }
  const snap = await getDocs(query(collection(db, `shops/${shopId}/expenses`), where('date', '>=', start), where('date', '<', end)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getNetRevenue(shopId: string, range: 'day'|'week'|'month'|'year') {
  const expenses = await getExpensesByPeriod(shopId, range);
  const now = new Date();
  let start = new Date();
  let end = new Date();
  switch(range){
    case 'day': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); end = new Date(start); end.setDate(end.getDate()+1); break;
    case 'week': end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); start = new Date(end); start.setDate(start.getDate()-7); break;
    case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth()+1, 1); break;
    case 'year': start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear()+1, 0, 1); break;
  }
  const sales = await getDocs(query(collection(db, getShopCollectionName('orders')), where('createdAt', '>=', start), where('createdAt', '<', end)));
  let revenue = 0; sales.forEach(d => { const v: any = d.data(); revenue += v.total || 0; });
  const expenseTotal = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  return { revenue, expenses: expenseTotal, net: revenue - expenseTotal };
}

export async function getExpensesTotalForDate(shopId: string, date: Date) {
  const start = new Date(date);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const snap = await getDocs(query(collection(db, `shops/${shopId}/expenses`), where('date', '>=', start), where('date', '<', end)));
  let total = 0;
  snap.forEach(d => { const v: any = d.data(); total += v.amount || 0; });
  return total;
}

export async function getEmployeePerformance(shopId: string, userId: string, date?: Date) {
  const orders = await getSalesByCashier(shopId, userId, date);
  const total = orders.reduce((s: number, o: any) => s + (o.total || 0), 0);
  return { orders: orders.length, total };
}

export async function getEmployeesByShop(shopId: string) {
  const snap = await getDocs(query(collection(db, 'users'), where('shopId', '==', shopId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getEmployeesCount(shopId: string) {
  const employees = await getEmployeesByShop(shopId);
  return employees.length;
}

export async function getSuppliersCount(shopId: string) {
  const snap = await getDocs(query(collection(db, `shops/${shopId}/suppliers`)));
  return snap.docs.length;
}

export async function getServicesCount(shopId: string) {
  const snap = await getDocs(query(collection(db, `shops/${shopId}/services`)));
  return snap.docs.length;
}

export async function getStockReportsCount(shopId: string) {
  const snap = await getDocs(query(collection(db, `shops/${shopId}/stockReports`)));
  return snap.docs.length;
}

export async function getSettingsDoc(shopId: string) {
  const snap = await getDocs(collection(db, getShopCollectionName('settings')));
  const d = snap.docs[0];
  return d ? { id: d.id, ...d.data() } : null;
}

export async function getInvoicesCount(shopId: string) {
  const snap = await getDocs(query(collection(db, getShopCollectionName('invoices'))));
  return snap.docs.length;
}


