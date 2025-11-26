import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, Camera, X, Grid3x3, List, Loader2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getShopCollectionName } from '../config/shopConfig';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Modal from '../components/Modal';
import FormInput from '../components/UI/FormInput';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import Dropdown from '../components/UI/Dropdown';
import BarcodeScanner from '../components/BarcodeScanner';
import ProductsGrid from '../components/Products/ProductsGrid';
import { Product, ProductUnit } from '../types';
import { toast } from 'react-toastify';
import { PRODUCT_UNIT_OPTIONS, getDefaultUnit } from '../constants/productUnits';
import { BRANCHES, BranchName } from '../config/shopConfig';

interface ProductCategory {
  id: string;
  name: string;
}

const DEFAULT_UNIT = getDefaultUnit();

const Inventory: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [showAddCategoryInline, setShowAddCategoryInline] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showCapitalModal, setShowCapitalModal] = useState<boolean>(false);
  const [capitalReport, setCapitalReport] = useState<any[]>([]);
  const [loadingCapitalReport, setLoadingCapitalReport] = useState<boolean>(false);
  const [selectedProductsForReport, setSelectedProductsForReport] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('CentralShop');

  // Determine if user can switch between shops
  const canSwitchBranches =
    (Array.isArray((currentUser as any)?.assignedShops) &&
      new Set(
        ((currentUser as any).assignedShops as string[]).map(s => s.replace(/\s+/g, '').toLowerCase())
      ).size > 1) ||
    currentUser?.role === 'mainAdmin' ||
    currentUser?.role === 'Admin' ||
    currentUser?.role === 'astraronix';

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
    barcode: '',
    images: [] as string[], // Changed to array for multiple images (max 3)
    unit: DEFAULT_UNIT as ProductUnit,
    requireMeasurement: false,
    measurementLabel: '',
    capital: '',
    buyingPrice: ''
  });
  const [isDragOver, setIsDragOver] = useState(false);

  // Sync selected branch with current user's primary shop (auto-navigate to authorised shop)
  useEffect(() => {
    if (currentUser?.shopName) {
      setSelectedBranch(currentUser.shopName);
    } else if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedShop');
      if (saved) {
        setSelectedBranch(saved);
      }
    }
  }, [currentUser?.shopName]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [selectedBranch]);

  const fetchProducts = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        console.error('No shop ID found for current user');
        toast.error('No shop assigned to your account');
        return;
      }

      const q = query(collection(db, getShopCollectionName('products', selectedBranch as BranchName)), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const productsData: Product[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        productsData.push({ 
          id: doc.id, 
          ...data,
          unit: data.unit || DEFAULT_UNIT,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as Product);
      });
      setProducts(productsData);
    } catch (error) {
      toast.error('Failed to fetch products');
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async (): Promise<void> => {
    try {
      if (!currentUser?.shopId) return;

      const q = query(collection(db, getShopCollectionName('productCategories', selectedBranch as BranchName)), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const categoriesData: ProductCategory[] = [];
      querySnapshot.forEach((doc) => {
        categoriesData.push({
          id: doc.id,
          name: doc.data().name
        });
      });
      setCategories(categoriesData);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      // Don't show error toast for permission errors - rules need to be deployed
      if (error.code !== 'permission-denied') {
        toast.error('Failed to load categories');
      }
    }
  };

  const addCategoryInline = async (): Promise<void> => {
    if (!currentUser?.shopId || !newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      // Check if category already exists
      const existingCategory = categories.find(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase());
      if (existingCategory) {
        toast.error('Category already exists');
        setFormData(prev => ({ ...prev, category: existingCategory.name }));
        setShowAddCategoryInline(false);
        setNewCategoryName('');
        return;
      }

      const categoryRef = await addDoc(collection(db, getShopCollectionName('productCategories', selectedBranch as BranchName)), {
        name: newCategoryName.trim()
      });

      const newCategory: ProductCategory = {
        id: categoryRef.id,
        name: newCategoryName.trim()
      };

      setCategories(prev => [...prev, newCategory]);
      setFormData(prev => ({ ...prev, category: newCategory.name }));
      setShowAddCategoryInline(false);
      setNewCategoryName('');
      toast.success('Category added successfully');
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error('Failed to add category');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!currentUser?.shopId) {
      toast.error('No shop assigned to your account');
      return;
    }

    if (!formData.category.trim()) {
      toast.error('Please select or add a category');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const requiresMeasurement = (formData.unit === 'meters' || formData.unit === 'litres') ? formData.requireMeasurement : false;
      const productData = {
        name: formData.name,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        category: formData.category.trim(),
        barcode: formData.barcode || '',
        image: formData.images[0] || '', // Use first image as primary
        unit: formData.unit || DEFAULT_UNIT,
        requireMeasurement: requiresMeasurement,
        measurementLabel: requiresMeasurement ? (formData.measurementLabel?.trim() || '') : '',
        capital: formData.capital ? parseFloat(formData.capital) : undefined,
        buyingPrice: formData.buyingPrice ? parseFloat(formData.buyingPrice) : undefined,
        updatedAt: new Date()
      };

      if (editingProduct) {
        await updateDoc(doc(db, getShopCollectionName('products', selectedBranch as BranchName), editingProduct.id), productData);
        toast.success('Product updated successfully');
      } else {
        await addDoc(collection(db, getShopCollectionName('products', selectedBranch as BranchName)), {
          ...productData,
          createdAt: new Date()
        });
        toast.success('Product added successfully');
      }

      resetForm();
      fetchProducts();
    } catch (error) {
      toast.error('Failed to save product');
      console.error('Error saving product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      stock: '',
      category: '',
      barcode: '',
      images: [],
      unit: DEFAULT_UNIT,
      requireMeasurement: false,
      measurementLabel: '',
      capital: '',
      buyingPrice: ''
    });
    setShowAddModal(false);
    setEditingProduct(null);
    setShowAddCategoryInline(false);
    setNewCategoryName('');
    setIsSubmitting(false);
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category,
      barcode: product.barcode || '',
      images: product.image ? [product.image] : [],
      unit: product.unit || DEFAULT_UNIT,
      capital: product.capital?.toString() || '',
      requireMeasurement: product.requireMeasurement || false,
      measurementLabel: product.measurementLabel || '',
      buyingPrice: product.buyingPrice?.toString() || ''
    });
    setEditingProduct(product);
    setShowAddModal(true);
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async (): Promise<void> => {
    if (!productToDelete || !currentUser?.shopId) {
      toast.error('No shop assigned to your account');
      return;
    }

    try {
      await deleteDoc(doc(db, getShopCollectionName('products', selectedBranch as BranchName), productToDelete.id!));
      toast.success('Product deleted successfully');
      fetchProducts();
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (error) {
      toast.error('Failed to delete product');
      console.error('Error deleting product:', error);
    }
  };

  const processImageFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    // Check if we already have 3 images
    if (formData.images.length >= 3) {
      toast.error('Maximum 3 images allowed');
      return;
    }

    try {
      // First, create a local preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setFormData(prev => ({ ...prev, images: [...prev.images, result] }));
      };
      reader.readAsDataURL(file);

      // For production, you would upload to Cloudinary here
      // For now, we'll use the data URL approach
      toast.success('Image loaded successfully');
    } catch (error) {
      toast.error('Failed to load image');
      console.error('Error loading image:', error);
    }
  };


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = e.target.files;
    if (files) {
      const remainingSlots = 3 - formData.images.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      filesToProcess.forEach(file => processImageFile(file));
      if (files.length > remainingSlots) {
        toast.warning(`Only ${remainingSlots} image(s) added. Maximum 3 images allowed.`);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processImageFile(files[0]);
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { text: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900' };
    if (stock < 20) return { text: 'Low Stock', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900' };
    return { text: 'In Stock', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900' };
  };

  const generateCapitalReport = async () => {
    if (!currentUser?.shopId) {
      toast.error('No shop assigned to your account');
      return;
    }

    setLoadingCapitalReport(true);
    try {
      // Fetch all orders
      const ordersQuery = query(
        collection(db, getShopCollectionName('orders', selectedBranch as BranchName)),
        where('status', '==', 'completed')
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      // Calculate sales for each product
      const productSales = new Map<string, { quantity: number; revenue: number }>();
      
      ordersSnapshot.forEach((doc) => {
        const order = doc.data();
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const productId = item.productId;
            if (productId) {
              const existing = productSales.get(productId) || { quantity: 0, revenue: 0 };
              productSales.set(productId, {
                quantity: existing.quantity + (item.quantity || 0),
                revenue: existing.revenue + ((item.quantity || 0) * (item.price || 0))
              });
            }
          });
        }
      });

      // Generate report for products
      const reportData = products
        .filter(product => {
          // Filter by selected products if any are selected
          if (selectedProductsForReport.length > 0) {
            return selectedProductsForReport.includes(product.id);
          }
          // Only show products with capital or buying price
          return product.capital || product.buyingPrice;
        })
        .map(product => {
          const sales = productSales.get(product.id) || { quantity: 0, revenue: 0 };
          
          // Calculate capital
          let capital = 0;
          if (product.capital) {
            capital = product.capital;
          } else if (product.buyingPrice) {
            // Estimate capital based on buying price and current stock
            // Note: This is an estimate since we don't track initial stock
            capital = product.buyingPrice * (product.stock + sales.quantity);
          }

          const profit = sales.revenue - capital;
          const profitPercentage = capital > 0 ? ((profit / capital) * 100) : 0;

          return {
            productId: product.id,
            productName: product.name,
            category: product.category,
            capital: capital,
            quantitySold: sales.quantity,
            salesRevenue: sales.revenue,
            profit: profit,
            profitPercentage: profitPercentage,
            isProfit: profit >= 0
          };
        })
        .sort((a, b) => b.salesRevenue - a.salesRevenue);

      setCapitalReport(reportData);
    } catch (error) {
      toast.error('Failed to generate capital report');
      console.error('Error generating capital report:', error);
    } finally {
      setLoadingCapitalReport(false);
    }
  };

  const handleOpenCapitalModal = () => {
    setShowCapitalModal(true);
    // Reset selection when opening
    setSelectedProductsForReport([]);
    setCapitalReport([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
        <p className="text-gray-600 dark:text-gray-300">Manage your products and stock levels</p>
        </div>
        {/* Branch Selector (only for users allowed to access both shops) */}
        {canSwitchBranches && (
          <Dropdown
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={[
              { value: BRANCHES.CENTRAL, label: 'Central Shop Inventory' },
              { value: BRANCHES.KAMWENE, label: 'Kamwene Inventory' }
            ]}
            placeholder="Select Branch"
          />
        )}
      </div>

      {/* Search, View Toggle, and Add Product */}
      <div className="flex items-center gap-2">
          <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent"
            />
          </div>
        <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#4A90A4] text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label="Grid view"
            >
            <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#4A90A4] text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label="List view"
            >
            <List className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleOpenCapitalModal}
              variant="secondary"
              className="flex items-center whitespace-nowrap shrink-0 text-sm py-1.5 px-3"
            >
              <DollarSign className="w-3.5 h-3.5 mr-1.5" />
              View Capital
            </Button>
          <Button 
            onClick={() => setShowAddModal(true)} 
          className="flex items-center whitespace-nowrap shrink-0 text-sm py-1.5 px-3"
          >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Product
          </Button>
          </div>
        </div>

      {/* Products Grid */}
      <ProductsGrid
        products={filteredProducts}
        mode="inventory"
        viewMode={viewMode}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        getStockStatus={getStockStatus}
      />

      {/* Add/Edit Product Modal */}
      <Modal
        open={showAddModal}
        onClose={resetForm}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Product Name"
            name="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Selling Price (KSH)"
              name="price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
            />
            
            <FormInput
              label="Stock"
              name="stock"
              type="number"
              value={formData.stock}
              onChange={(e) => {
                const stock = e.target.value;
                const buyingPrice = parseFloat(formData.buyingPrice) || 0;
                const capital = parseFloat(formData.capital) || 0;
                let updatedData = { ...formData, stock };
                
                // If buying price is set, recalculate capital
                if (buyingPrice > 0 && stock) {
                  updatedData.capital = (buyingPrice * parseFloat(stock)).toFixed(2);
                }
                // If capital is set but no buying price, recalculate buying price
                else if (capital > 0 && stock) {
                  updatedData.buyingPrice = (capital / parseFloat(stock)).toFixed(2);
                }
                
                setFormData(updatedData);
              }}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Buying Price (KSH)"
              name="buyingPrice"
              type="number"
              step="0.01"
              value={formData.buyingPrice}
              onChange={(e) => {
                const buyingPrice = e.target.value;
                const stock = parseFloat(formData.stock) || 0;
                const calculatedCapital = buyingPrice && stock > 0 
                  ? (parseFloat(buyingPrice) * stock).toFixed(2) 
                  : '';
                setFormData({ 
                  ...formData, 
                  buyingPrice,
                  capital: calculatedCapital || formData.capital
                });
              }}
              placeholder="Cost per unit"
            />
            
            <FormInput
              label="Capital (KSH)"
              name="capital"
              type="number"
              step="0.01"
              value={formData.capital}
              onChange={(e) => {
                const capital = e.target.value;
                const stock = parseFloat(formData.stock) || 0;
                const calculatedBuyingPrice = capital && stock > 0 
                  ? (parseFloat(capital) / stock).toFixed(2) 
                  : '';
                setFormData({ 
                  ...formData, 
                  capital,
                  buyingPrice: calculatedBuyingPrice || formData.buyingPrice
                });
              }}
              placeholder="Total investment (auto-calculated)"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enter either Buying Price (per unit) or Capital (total). The other will be calculated automatically: Capital = Buying Price × Stock
          </p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unit of Measure
            </label>
            <Dropdown
              value={formData.unit}
              onChange={(value) => setFormData({ ...formData, unit: value as ProductUnit })}
              options={PRODUCT_UNIT_OPTIONS.map(option => ({
                value: option.value,
                label: option.label
              }))}
              placeholder="Select unit"
            />
          </div>

          {(formData.unit === 'meters' || formData.unit === 'litres') && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.requireMeasurement}
                  onChange={(e) => setFormData({ ...formData, requireMeasurement: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-[#4A90A4] focus:ring-[#4A90A4]"
                />
                Require entering {formData.unit === 'meters' ? 'meters' : 'litres'} at checkout
              </label>
              {!formData.requireMeasurement && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Customers can buy in fractional {formData.unit}. Enable the option above if you want the POS to prompt for the exact
                  {` ${formData.unit}`} length/volume during checkout.
                </p>
              )}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            {!showAddCategoryInline ? (
              <Dropdown
                value={formData.category}
                onChange={(value) => {
                  if (value === '__add_new__') {
                    setShowAddCategoryInline(true);
                  } else {
                    setFormData({ ...formData, category: value });
                  }
                }}
                options={categories.map(cat => ({
                  value: cat.name,
                  label: cat.name
                }))}
                placeholder="Select category"
                addNewLabel="Add new category"
                onAddNew={() => setShowAddCategoryInline(true)}
                menuClassName="max-h-48"
              />
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCategoryInline();
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent"
                />
                <Button
                  type="button"
                  onClick={addCategoryInline}
                  variant="primary"
                >
                  Add
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowAddCategoryInline(false);
                    setNewCategoryName('');
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Barcode (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-3 py-2 pr-10 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent"
                placeholder="Enter barcode or scan"
              />
              <button
                type="button"
                onClick={() => setShowBarcodeScanner(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-[#4A90A4] dark:text-gray-400 dark:hover:text-[#4A90A4] transition-colors"
                title="Scan barcode with camera"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {showBarcodeScanner && (
            <BarcodeScanner
              onScan={(barcode) => {
                setFormData({ ...formData, barcode });
                setShowBarcodeScanner(false);
                toast.success(`Barcode scanned: ${barcode}`);
              }}
              onClose={() => setShowBarcodeScanner(false)}
            />
          )}
          
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
              Product Images (Max 3)
            </label>
            <div className="space-y-2 md:space-y-3">
              <div className="flex gap-2">
                <div 
                  className={`flex-1 border-2 border-dashed rounded-lg p-2 md:p-4 text-center transition-colors ${
                    isDragOver 
                      ? 'border-[#4A90A4] bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-[#4A90A4]'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input 
                    type="file" 
                    onChange={handleImageUpload} 
                    accept="image/*"
                    multiple
                    disabled={formData.images.length >= 3}
                    className="w-full text-xs md:text-sm text-gray-500 file:mr-2 file:py-1 file:px-2 md:file:py-2 md:file:px-4 file:rounded-full file:border-0 file:text-xs md:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-100 disabled:opacity-50" 
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {isDragOver ? 'Drop images here' : `Upload (${formData.images.length}/3)`}
                  </p>
                </div>
              </div>
              
              {formData.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {formData.images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={image} 
                        alt={`Product preview ${index + 1}`} 
                        className="w-full h-20 md:h-24 rounded-lg object-cover border border-gray-200 dark:border-gray-600" 
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          images: prev.images.filter((_, i) => i !== index) 
                        }))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <Button 
              type="submit" 
              variant="primary" 
              className="flex-1 flex items-center justify-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {editingProduct ? 'Updating product...' : 'Adding product...'}
                </>
              ) : (
                editingProduct ? 'Update Product' : 'Add Product'
              )}
            </Button>
            <Button 
              type="button" 
              onClick={resetForm} 
              variant="secondary"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${productToDelete?.name}"? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Capital Report Modal */}
      <Modal
        open={showCapitalModal}
        onClose={() => {
          setShowCapitalModal(false);
          setSelectedProductsForReport([]);
        }}
        title="Capital & Profit Report"
        size="lg"
      >
        <div className="space-y-4">
          {/* Filter Section */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter Products (Leave empty for all products)
            </label>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {products
                .filter(p => p.capital || p.buyingPrice)
                .map(product => (
                  <label key={product.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedProductsForReport.includes(product.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProductsForReport([...selectedProductsForReport, product.id]);
                        } else {
                          setSelectedProductsForReport(selectedProductsForReport.filter(id => id !== product.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-[#4A90A4] focus:ring-[#4A90A4]"
                    />
                    <span className="text-gray-700 dark:text-gray-300">{product.name}</span>
                  </label>
                ))}
            </div>
            <Button
              onClick={generateCapitalReport}
              variant="primary"
              className="mt-3"
              disabled={loadingCapitalReport}
            >
              {loadingCapitalReport ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>

          {/* Report Table */}
          {capitalReport.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Product</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Capital</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Qty Sold</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Sales</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">Profit/Loss</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">%</th>
                  </tr>
                </thead>
                <tbody>
                  {capitalReport.map((item) => (
                    <tr key={item.productId} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 text-gray-900 dark:text-white">{item.productName}</td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                        KSH {item.capital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{item.quantitySold}</td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                        KSH {item.salesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${
                        item.isProfit 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        <div className="flex items-center justify-end gap-1">
                          {item.isProfit ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          KSH {item.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className={`py-2 px-3 text-right font-semibold ${
                        item.isProfit 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {item.profitPercentage >= 0 ? '+' : ''}{item.profitPercentage.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                    <td className="py-3 px-3 text-gray-900 dark:text-white">Total</td>
                    <td className="py-3 px-3 text-right text-gray-900 dark:text-white">
                      KSH {capitalReport.reduce((sum, item) => sum + item.capital, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-900 dark:text-white">
                      {capitalReport.reduce((sum, item) => sum + item.quantitySold, 0)}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-900 dark:text-white">
                      KSH {capitalReport.reduce((sum, item) => sum + item.salesRevenue, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-3 text-right ${
                      capitalReport.reduce((sum, item) => sum + item.profit, 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      <div className="flex items-center justify-end gap-1">
                        {capitalReport.reduce((sum, item) => sum + item.profit, 0) >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        KSH {capitalReport.reduce((sum, item) => sum + item.profit, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className={`py-3 px-3 text-right ${
                      capitalReport.reduce((sum, item) => sum + item.profit, 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {(() => {
                        const totalCapital = capitalReport.reduce((sum, item) => sum + item.capital, 0);
                        const totalProfit = capitalReport.reduce((sum, item) => sum + item.profit, 0);
                        const totalPercentage = totalCapital > 0 ? ((totalProfit / totalCapital) * 100) : 0;
                        return `${totalProfit >= 0 ? '+' : ''}${totalPercentage.toFixed(2)}%`;
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {loadingCapitalReport ? 'Generating report...' : 'No data available. Click "Generate Report" to view capital analysis.'}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Inventory;