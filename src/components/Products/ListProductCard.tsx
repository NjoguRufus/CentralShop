import React from 'react';
import { Product } from '../../types';
import { Edit, Trash2 } from 'lucide-react';
import Card from '../UI/Card';
import Button from '../UI/Button';

interface ListProductCardProps {
  product: Product;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  stockStatus?: {
    text: string;
    color: string;
    bg: string;
  };
  mode?: 'inventory' | 'pos';
}

const ListProductCard: React.FC<ListProductCardProps> = ({
  product,
  onEdit,
  onDelete,
  onAddToCart,
  stockStatus,
  mode = 'inventory'
}) => {
  const isOutOfStock = product.stock <= 0;
  const placeholderImage = "/mnt/data/A_logo_in_solid_black_is_displayed_on_a_white_back.png";

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(product);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(product);
  };

  const handleCardClick = () => {
    if (mode === 'pos' && !isOutOfStock && onAddToCart) {
      onAddToCart(product);
    }
  };

  return (
    <Card
      className={`
        overflow-hidden bg-white dark:bg-[#111827] 
        border border-black/5 dark:border-white/10 
        rounded-2xl 
        transition-all duration-300 ease-out
        ${mode === 'pos' && !isOutOfStock ? 'cursor-pointer hover:shadow-lg' : ''}
        ${isOutOfStock ? 'opacity-60' : ''}
      `}
      onClick={handleCardClick}
    >
      <div className="flex items-center gap-4 p-4">
        {/* Image on left */}
        <div className="w-[120px] h-[100px] overflow-hidden rounded-xl relative flex-shrink-0">
          <img
            src={product.image || placeholderImage}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {isOutOfStock && mode === 'pos' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold">
                OUT
              </span>
            </div>
          )}
        </div>

        {/* Content in middle */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm tracking-tight line-clamp-1">
            {product.name}
          </h3>
          {mode === 'inventory' && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
              {product.category}
            </p>
          )}
          <div className="font-extrabold text-[#4A90A4] text-base">
            KSH {product.price.toLocaleString()}
          </div>
          {mode === 'inventory' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 dark:text-gray-400">Stock: {product.stock}</span>
              {stockStatus && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                  {stockStatus.text}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions on right */}
        {mode === 'inventory' && onEdit && onDelete && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleEdit}
              variant="secondary"
              size="sm"
              className="flex items-center justify-center text-xs"
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              onClick={handleDelete}
              variant="danger"
              size="sm"
              className="flex items-center justify-center text-xs px-3"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
        {mode === 'pos' && !isOutOfStock && onAddToCart && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className="bg-[#4A90A4] text-white rounded-full w-8 h-8 shadow-md hover:bg-[#407f8f] transition-colors flex items-center justify-center font-bold text-lg flex-shrink-0"
            aria-label="Add to cart"
          >
            +
          </button>
        )}
      </div>
    </Card>
  );
};

export default ListProductCard;

