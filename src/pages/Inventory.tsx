import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, Camera, X } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
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
import { Product } from '../types';
import { toast } from 'react-toastify';

interface ProductCategory {
  id: string;
  name: string;
}

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

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
    barcode: '',
    images: [] as string[] // Changed to array for multiple images (max 3)
  });
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        console.error('No shop ID found for current user');
        toast.error('No shop assigned to your account');
        return;
      }

      const q = query(collection(db, getShopCollectionName('products')), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const productsData: Product[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        productsData.push({ 
          id: doc.id, 
          ...data,
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

      const q = query(collection(db, getShopCollectionName('productCategories')), orderBy('name'));
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

      const categoryRef = await addDoc(collection(db, getShopCollectionName('productCategories')), {
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
    
    try {
      const productData = {
        name: formData.name,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        category: formData.category.trim(),
        barcode: formData.barcode || '',
        image: formData.images[0] || '', // Use first image as primary
        updatedAt: new Date()
      };

      if (editingProduct) {
        await updateDoc(doc(db, getShopCollectionName('products'), editingProduct.id), productData);
        toast.success('Product updated successfully');
      } else {
        await addDoc(collection(db, getShopCollectionName('products')), {
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
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      stock: '',
      category: '',
      barcode: '',
      images: []
    });
    setShowAddModal(false);
    setEditingProduct(null);
    setShowAddCategoryInline(false);
    setNewCategoryName('');
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category,
      barcode: product.barcode || '',
      images: product.image ? [product.image] : []
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
      await deleteDoc(doc(db, getShopCollectionName('products'), productToDelete.id!));
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
        <p className="text-gray-600 dark:text-gray-300">Manage your products and stock levels</p>
      </div>

      {/* Search and Add Product */}
      <Card className="p-3 md:p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#4A90A4] focus:border-transparent"
            />
          </div>
          <Button 
            onClick={() => setShowAddModal(true)} 
            className="flex items-center whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </Card>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          {[...Array(10)].map((_, i) => (
            <Card key={i} className="p-3 md:p-4">
              <div className="aspect-square rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          {filteredProducts.map(product => {
          const stockStatus = getStockStatus(product.stock);
          return (
            <Card key={product.id} className="p-0 overflow-hidden">
              {/* Image - Full width and top */}
              <div className="aspect-square w-full overflow-hidden relative">
                {product.image ? (
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>
              
              {/* Content - with padding */}
              <div className="p-3 md:p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{product.category}</p>
                </div>
                
                <div>
                  <span className="text-lg font-bold text-[#4A90A4]">KSH {product.price.toLocaleString()}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Stock: {product.stock} units</span>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                    {stockStatus.text}
                  </span>
                </div>
                
                {product.barcode && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Barcode: {product.barcode}
                  </div>
                )}
                
                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleEdit(product)}
                    variant="secondary"
                    size="sm"
                    className="flex-1 flex items-center justify-center"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDeleteClick(product)}
                    variant="danger"
                    size="sm"
                    className="flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        </div>
      )}

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
              label="Price ($)"
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
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              required
            />
          </div>
          
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
            <Button type="submit" variant="primary" className="flex-1">
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
            <Button type="button" onClick={resetForm} variant="secondary">
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
    </div>
  );
};

export default Inventory;