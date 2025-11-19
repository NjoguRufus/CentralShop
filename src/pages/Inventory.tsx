import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Modal from '../components/Modal';
import FormInput from '../components/UI/FormInput';
import ConfirmationModal from '../components/UI/ConfirmationModal';
import Dropdown from '../components/UI/Dropdown';
import { Product } from '../types';
import { toast } from 'react-toastify';

const Inventory: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    category: 'Beverages',
    barcode: '',
    image: ''
  });
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async (): Promise<void> => {
    try {
      setLoading(true);
      
      if (!currentUser?.shopId) {
        console.error('No shop ID found for current user');
        toast.error('No shop assigned to your account');
        return;
      }

      const q = query(collection(db, `shops/${currentUser.shopId}/products`), orderBy('name'));
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
    
    try {
      const productData = {
        name: formData.name,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        category: formData.category,
        barcode: formData.barcode || '',
        image: formData.image || '',
        updatedAt: new Date()
      };

      if (editingProduct) {
        await updateDoc(doc(db, `shops/${currentUser.shopId}/products`, editingProduct.id), productData);
        toast.success('Product updated successfully');
      } else {
        await addDoc(collection(db, `shops/${currentUser.shopId}/products`), {
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
      category: 'Beverages',
      barcode: '',
      image: ''
    });
    setShowAddModal(false);
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category,
      barcode: product.barcode || '',
      image: product.image || ''
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
      await deleteDoc(doc(db, `shops/${currentUser.shopId}/products`, productToDelete.id!));
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

    try {
      // First, create a local preview
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setFormData(prev => ({ ...prev, image: result }));
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
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage your products and stock levels</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="p-6">
        <div className="flex items-center space-x-4">
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
        </div>
      </Card>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="p-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => {
          const stockStatus = getStockStatus(product.stock);
          return (
            <Card key={product.id} className="p-6">
              <div className="aspect-square rounded-xl overflow-hidden mb-4">
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
              
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{product.category}</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-[#4A90A4]">KSH {product.price}</span>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                    {stockStatus.text}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div>Stock: {product.stock} units</div>
                  {product.barcode && <div>Barcode: {product.barcode}</div>}
                </div>
                
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
              Category
            </label>
            <Dropdown
              value={formData.category}
              onChange={(value) => setFormData({ ...formData, category: value })}
              options={[
                { value: 'Beverages', label: 'Beverages' },
                { value: 'Food', label: 'Food' },
                { value: 'Snacks', label: 'Snacks' },
                { value: 'Other', label: 'Other' }
              ]}
              placeholder="Select category"
            />
          </div>
          
          <FormInput
            label="Barcode (Optional)"
            name="barcode"
            type="text"
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Product Image
            </label>
            <div className="space-y-3">
              <div 
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
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
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-100" 
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {isDragOver ? 'Drop image here' : 'Click to upload or drag and drop (Max 5MB)'}
                </p>
              </div>
              {formData.image && (
                <div className="mt-2 flex items-center space-x-3">
                  <img 
                    src={formData.image} 
                    alt="Product preview" 
                    className="w-20 h-20 rounded-lg object-cover border border-gray-200 dark:border-gray-600" 
                  />
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                  >
                    Remove Image
                  </Button>
                </div>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Or enter image URL manually:
              </div>
              <FormInput
                name="image"
                type="url"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
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