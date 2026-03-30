import React, { Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Product } from '@/types/api-models';
import { Button } from '@/components/ui/button';

// Lazy load the map component to improve performance
const LazyMap = lazy(() => import('./LazyMap'));

interface Props {
  radioStationId?: number | null;
}

export default function StationShowProducts({ radioStationId }: Props) {
  // Fetch all products for the station (including location details)
  const { data: products, isLoading } = useQuery<{
    products: (Product & { location?: { name: string; address: string; city?: string; rating?: number; mapUrl?: string } })[];
  }>({
    queryKey: ['station-products', radioStationId],
    queryFn: async () => {
      if (!radioStationId) return { products: [] };
      const res = await fetch(`/api/stations/${radioStationId}/products`);
      if (!res.ok) return { products: [] };
      return res.json();
    },
    enabled: !!radioStationId,
  });

  if (!radioStationId) {
    // default Dubai guide promo as a compact component
    return (
      <div className="bg-radio-orange text-radio-cream rounded-xl shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row items-center">
          <div className="md:w-2/3 mb-6 md:mb-0 md:pr-6">
            <h2 className="font-poppins text-xl font-semibold mb-2">Discover Dubai With Us</h2>
            <p className="mb-4">
              Get exclusive recommendations for dining, entertainment, shopping, and cultural experiences tailored to your interests.
            </p>
          </div>
          <div className="md:w-1/3">
            <img
              src="https://images.unsplash.com/photo-1582672171646-3c0616e1185b?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80"
              alt="Dubai landmark"
              className="w-full h-40 object-cover rounded-lg"
            />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading station promotions...</div>;
  }

  if (!products || !products.products || products.products.length === 0) {
    return (
      <div className="bg-radio-orange text-radio-cream rounded-xl shadow-md p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">No station promotions available</h3>
            <p className="text-xs">This station doesn't have any active promotions right now.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => window.location.href = '/podcasts'}>Browse Content</Button>
        </div>
      </div>
    );
  }

  // Group products by category and sort within categories
  const productsByCategory = products.products
    .sort((a, b) => (a.name || '').localeCompare(b.name || '')) // Sort products alphabetically
    .reduce((acc, product) => {
      const category = product.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(product);
      return acc;
    }, {} as Record<string, typeof products.products>);

  // Sort categories alphabetically, with 'Other' at the end
  const sortedCategories = Object.entries(productsByCategory)
    .sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-poppins text-xl font-semibold">Station Products</h3>
          <p className="text-sm text-gray-600">Products available at this station</p>
        </div>
      </div>

      <div className="space-y-8">
        {sortedCategories.map(([category, categoryProducts]) => (
          <div key={category}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-lg text-radio-orange border-b border-radio-orange/20 pb-2">
                {category}
              </h4>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {categoryProducts.length} item{categoryProducts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryProducts.map(p => (
                <Suspense key={p.id} fallback={
                  <div className="border rounded-lg p-4 animate-pulse">
                    <div className="flex items-start justify-between mb-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-12"></div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3 mb-3"></div>
                    <div className="flex justify-between">
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                }>
                  <div className="border rounded-lg p-4 hover:shadow-md transition-shadow hover:border-radio-orange/30">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium text-sm flex-1 pr-2">{p.name}</div>
                      {!p.details?.noPrice && typeof p.price === "number" && p.price > 0 ? (
                        <div className="text-xs font-semibold text-radio-orange whitespace-nowrap">
                          {(p.price/100).toFixed(2)} {p.currency ?? 'AED'}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-xs text-gray-600 mb-2 line-clamp-2">
                      {p.description}
                    </div>

                    {p.location && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 mb-1">
                          📍 {p.location.name}
                          {p.location.city && `, ${p.location.city}`}
                        </div>

                        {p.location.rating && (
                          <div className="text-xs text-yellow-600 mb-2">
                            ⭐ {p.location.rating}/5 rating
                          </div>
                        )}

                        {p.location.mapUrl && (
                          <div className="mb-2 space-y-2">
                            <Suspense fallback={
                              <div className="w-full h-32 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
                                <div className="text-xs text-gray-500">Loading map...</div>
                              </div>
                            }>
                              <LazyMap mapUrl={p.location.mapUrl} locationName={p.location.name} />
                            </Suspense>

                            <a
                              href={p.location.mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              📍 View full map
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-center mt-3 gap-2">
                      <a href={p.affiliateUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                        <Button size="sm" variant="outline" className="w-full">
                          Buy Now
                        </Button>
                      </a>
                    </div>
                  </div>
                </Suspense>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
