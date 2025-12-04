import React, { useEffect, useState } from 'react';
import { Product } from '../../types';
import GridProductCard from './GridProductCard';
import ListProductCard from './ListProductCard';
import SkeletonProductCard from './SkeletonProductCard';

interface ProductsGridProps {
  products: Product[];
  mode: 'inventory' | 'pos';
  viewMode: 'grid' | 'list';
  loading?: boolean;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  getStockStatus?: (stock: number) => {
    text: string;
    color: string;
    bg: string;
  };
}

const ProductsGrid: React.FC<ProductsGridProps> = ({
  products,
  mode,
  viewMode,
  loading = false,
  onEdit,
  onDelete,
  onAddToCart,
  getStockStatus
}) => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth < 640;
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.innerWidth < 640);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const gridTemplateColumns = isMobile
    ? 'repeat(2, minmax(0, 1fr))'
    : 'repeat(auto-fill, minmax(170px, 1fr))';

  if (loading) {
    return (
      <div 
        className="grid gap-4"
        style={{ 
          gridTemplateColumns
        }}
      >
        {[...Array(10)].map((_, i) => (
          <SkeletonProductCard key={i} />
        ))}
      </div>
    );
  }

  if (!loading && products.length === 0) {
    return (
      <div className="py-12 text-center text-gray-600 dark:text-gray-400">
        <p className="font-medium text-sm md:text-base">
          No products found
        </p>
        <p className="text-xs md:text-sm mt-1">
          Add products to start selling.
        </p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {products.map((product) => {
          const stockStatus = getStockStatus ? getStockStatus(product.stock) : undefined;
          return (
            <ListProductCard
              key={product.id}
              product={product}
              mode={mode}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddToCart={onAddToCart}
              stockStatus={stockStatus}
            />
          );
        })}
      </div>
    );
  }

  // Grid mode - Use auto-fit with min-width for flexible layout (4 cards per row at 67% scale)
  return (
    <div 
      className="grid gap-4"
      style={{ 
        gridTemplateColumns
      }}
    >
      {products.map((product) => {
        // Always get stock status for both modes
        const stockStatus = getStockStatus ? getStockStatus(product.stock) : {
          text: product.stock === 0 ? 'Out of Stock' : product.stock < 20 ? 'Low Stock' : 'In Stock',
          color: product.stock === 0 ? 'text-red-600' : product.stock < 20 ? 'text-yellow-600' : 'text-green-600',
          bg: product.stock === 0 ? 'bg-red-100 dark:bg-red-900' : product.stock < 20 ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-green-100 dark:bg-green-900'
        };
        return (
          <GridProductCard
            key={product.id}
            product={product}
            mode={mode}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddToCart={onAddToCart}
            stockStatus={stockStatus}
          />
        );
      })}
    </div>
  );
};

export default ProductsGrid;

