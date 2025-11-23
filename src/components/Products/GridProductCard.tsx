import React from 'react';
import { Product } from '../../types';
import POSProductCard from './POSProductCard';
import InventoryProductCard from './InventoryProductCard';

interface GridProductCardProps {
  product: Product;
  mode: 'inventory' | 'pos';
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  stockStatus?: {
    text: string;
    color: string;
    bg: string;
  };
}

const GridProductCard: React.FC<GridProductCardProps> = ({
  product,
  mode,
  onEdit,
  onDelete,
  onAddToCart,
  stockStatus
}) => {
  if (mode === 'pos' && onAddToCart && stockStatus) {
    return <POSProductCard product={product} onAddToCart={onAddToCart} stockStatus={stockStatus} />;
  }

  if (mode === 'inventory' && onEdit && onDelete && stockStatus) {
    return (
      <InventoryProductCard
        product={product}
        onEdit={onEdit}
        onDelete={onDelete}
        stockStatus={stockStatus}
      />
    );
  }

  return null;
};

export default GridProductCard;

