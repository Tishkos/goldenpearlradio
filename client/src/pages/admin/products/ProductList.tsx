import React, { useMemo } from 'react';
import { Package } from 'lucide-react';
import type { Product } from '@/types/api-models';
import ProductItem from './ProductItem';

interface ProductListProps {
  products: Product[];
  searchTerm: string;
  categoryFilter: string;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

const ProductList: React.FC<ProductListProps> = ({ products, searchTerm, categoryFilter, onEdit, onDelete }) => {
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Apply category filter
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(product.tags) && (product.tags as string[]).some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }

    return filtered;
  }, [products, searchTerm, categoryFilter]);

  if (filteredProducts.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">
          {searchTerm ? 'No products found matching your search.' : 'No products available.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Showing {filteredProducts.length} of {products.length} products
      </div>
      {filteredProducts.map(product => (
        <ProductItem
          key={product.id}
          product={product}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default ProductList;