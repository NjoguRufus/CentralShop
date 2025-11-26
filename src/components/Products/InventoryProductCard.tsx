import React from 'react';
import { Product } from '../../types';
import { Edit, Trash2 } from 'lucide-react';
import Card from '../UI/Card';
import Button from '../UI/Button';
import { getUnitShortLabel } from '../../constants/productUnits';

interface InventoryProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  stockStatus: {
    text: string;
    color: string;
    bg: string;
  };
}

const InventoryProductCard: React.FC<InventoryProductCardProps> = ({
  product,
  onEdit,
  onDelete,
  stockStatus
}) => {
  const placeholderImage = "/mnt/data/A_logo_in_solid_black_is_displayed_on_a_white_back.png";

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(product);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(product);
  };

  return (
    <Card className="overflow-hidden bg-white dark:bg-[#111827] border border-black/5 dark:border-white/10 rounded-2xl transition-all duration-300 ease-out hover:shadow-lg">
      {/* Image Area - Large Rectangular Banner */}
      <div className="w-full overflow-hidden rounded-t-2xl relative" style={{ height: '170px' }}>
        <img
          src={product.image || placeholderImage}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content Area - Enterprise Typography */}
      <div className="p-4 space-y-2">
        {/* Product Name */}
        <h3 className="font-bold text-gray-900 dark:text-white text-sm tracking-tight line-clamp-2">
          {product.name}
        </h3>
        
        {/* Category */}
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
          {product.category}
        </p>
        
        {/* Price */}
        <div className="font-extrabold text-[#4A90A4] text-base">
          KSH {product.price.toLocaleString()} / {getUnitShortLabel(product.unit)}
        </div>
        {product.requireMeasurement && (
          <p className="text-[11px] text-gray-500">Requires measurement at checkout</p>
        )}
        
        {/* Capital & Buying Price */}
        {(product.capital || product.buyingPrice) && (
          <div className="space-y-1 text-xs">
            {product.capital && (
              <p className="text-gray-600 dark:text-gray-400">
                Capital: <span className="font-semibold">KSH {product.capital.toLocaleString()}</span>
              </p>
            )}
            {product.buyingPrice && (
              <p className="text-gray-600 dark:text-gray-400">
                Buying Price: <span className="font-semibold">KSH {product.buyingPrice.toLocaleString()}</span>
              </p>
            )}
        </div>
        )}
        
        {/* Stock Info */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            {product.unit === 'pieces' ? 'Stock' : getUnitShortLabel(product.unit)}: {product.stock} {getUnitShortLabel(product.unit)}
          </span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
            {stockStatus.text}
          </span>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            onClick={handleEdit}
            variant="secondary"
            size="sm"
            className="flex-1 flex items-center justify-center text-xs"
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
      </div>
    </Card>
  );
};

export default InventoryProductCard;

