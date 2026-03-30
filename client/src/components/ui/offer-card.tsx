import type { Product } from '@/types/api-models';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface OfferCardProps {
  product: Product;
}

export function OfferCard({ product }: OfferCardProps) {
  const handleClick = () => {
    // In a real implementation, this would increment clicks and redirect
    fetch(`/api/products/${product.id}/click`, {
      method: 'POST',
    });
    window.open(product.affiliateUrl, '_blank');
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {product.imageUrl && (
        <img 
          src={product.imageUrl} 
          alt={product.name}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-poppins font-medium text-lg">{product.name}</h3>
          <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
            {product.category}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {product.description}
        </p>
        <div className="flex justify-between items-center">
          <span className="text-radio-orange font-bold">{(product.price/100).toFixed(2)} {product.currency ?? 'AED'}</span>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `/shop/product/${product.id}`}
            >
              View Details
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-radio-orange text-white hover:bg-radio-orange/90 rounded-full flex items-center"
              onClick={handleClick}
            >
              Buy Now
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}