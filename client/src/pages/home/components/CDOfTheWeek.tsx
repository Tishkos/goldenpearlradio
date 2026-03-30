import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
// Using API client
import { api } from '@/lib/api-client';
import { usePlayer } from '@/components/player/PlayerProvider';
import { useOptionalAuth } from '@/contexts/AuthContext';
import type { Product } from '@/types/api-models';

// CD of the Week component — shows products of category CD nominated this week with View/Buy actions.
export default function CDOfTheWeek() {
  const player = usePlayer();
  const { user } = useOptionalAuth();
  const { data: productsData } = useQuery<Product[]>({
    queryKey: ['products-cd-category'],
    queryFn: async () => {
      const data = await api.get('/products');
      return data.filter((p: any) => p.category === 'CD_OF_THE_WEEK') || [];
    }
  });

  // Helpers for nomination-week calculation (Monday..Sunday)
  const startOfWeek = (d = new Date()) => {
    const d2 = new Date(d);
    const day = d2.getDay(); // 0 (Sun) .. 6 (Sat)
    const diffToMonday = (day + 6) % 7;
    d2.setHours(0,0,0,0);
    d2.setDate(d2.getDate() - diffToMonday);
    return d2;
  };

  const isNominationThisWeek = (val?: string | Date | null) => {
    if (!val) return false;
    const d = (val instanceof Date) ? val : new Date(String(val));
    if (Number.isNaN(d.getTime())) return false;
    const s = startOfWeek();
    const e = new Date(s);
    e.setDate(s.getDate() + 7);
    return d >= s && d < e;
  };

  // Check if user owns content (simplified - no sales table)
  const ownsContent = (productId: number) => {
    // For now, assume no ownership tracking without sales table
    return false;
  };

  // Check if content is free
  const isFree = (item: any) => {
    if (item?.details?.noPrice) return true;
    const price = item?.price;
    return price === null || price === undefined || price === 0 || price === '0';
  };

  const nominatedProducts = (productsData || []).filter(p => isNominationThisWeek(p.createdAt));

  const handleProductClick = async (productId: number) => {
    // Navigate to product page (no click count for internal navigation)
    window.location.href = `/store/product/${productId}`;
  };

  const handleAffiliateClick = async (productId: number, affiliateUrl: string) => {
    // TODO: implement click tracking endpoint (e.g. POST /api/products/:id/click)
    // Navigate to affiliate URL
    window.open(affiliateUrl, '_blank');
  };

  if (!nominatedProducts || nominatedProducts.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="font-poppins text-xl font-semibold mb-2">CD of the Week</h2>
        <div className="p-4 bg-white rounded-lg shadow-sm text-sm text-gray-600">No CD nominations this week — check back later.</div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="font-poppins text-xl font-semibold mb-4">CD of the Week</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {nominatedProducts.map((product: any) => {
          const userOwns = ownsContent(product.id);
          const contentIsFree = isFree(product);
          const canAccess = true; // Simplified - no ownership restrictions

          return (
            <div 
              key={`cd-${product.id}`} 
              className="bg-white p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleProductClick(product.id)}
            >
              <div className="flex items-start">
                <img src={product.imageUrl || '/attached_assets/image.png'} alt={product.name} className="w-20 h-20 object-cover rounded mr-4" />
                <div className="flex-1">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-gray-500">{product.description}</div>
                  {!contentIsFree && (
                    <div className="text-xs text-radio-cyan font-medium mt-1">
                      {userOwns ? '✓ Owned' : `${(product.price/100).toFixed(2)} ${product.currency?.toUpperCase() ?? 'AED'}`}
                    </div>
                  )}
                  {contentIsFree && (
                    <div className="text-xs text-blue-600 font-medium mt-1">Free</div>
                  )}
                  <div className="mt-3 flex space-x-2">
                    <Button 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent card click when button is clicked
                        handleProductClick(product.id);
                      }}
                    >
                      View
                    </Button>
                    {!contentIsFree && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click when button is clicked
                          handleAffiliateClick(product.id, product.affiliateUrl);
                        }}
                      >
                        Buy
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
