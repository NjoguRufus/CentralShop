import React from 'react';
import { Product } from '../../types';
import Card from '../UI/Card';

interface POSProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  stockStatus: {
    text: string;
    color: string;
    bg: string;
  };
}

const POSProductCard: React.FC<POSProductCardProps> = ({ product, onAddToCart, stockStatus }) => {
  const isOutOfStock = product.stock <= 0;
  const placeholderImage = "/mnt/data/A_logo_in_solid_black_is_displayed_on_a_white_back.png";

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!isOutOfStock && onAddToCart) {
      onAddToCart(product);
    }
  };

  return (
    <Card 
      onClick={handleCardClick}
      className={`overflow-hidden bg-white dark:bg-[#111827] border border-black/5 dark:border-white/10 rounded-2xl transition-all duration-300 ease-out hover:shadow-lg ${
        isOutOfStock ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      }`}
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      onKeyDown={(e) => {
        if (!isOutOfStock && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          onAddToCart(product);
        }
      }}
      >
        {/* Image Area - Large Rectangular Banner */}
        <div className="w-full overflow-hidden rounded-t-2xl relative" style={{ height: '140px' }}>
          <img
            src={product.image || placeholderImage}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content Area - Enterprise Typography */}
        <div className="p-3.5 space-y-2">
          {/* Product Name */}
          <h3 className="font-bold text-gray-900 dark:text-white text-sm tracking-tight line-clamp-2">
            {product.name}
          </h3>
          
          {/* Price */}
          <div className="font-extrabold text-[#4A90A4] text-base">
            KSH {product.price.toLocaleString()}
          </div>
        </div>
    </Card>
  );
};

export default POSProductCard;

