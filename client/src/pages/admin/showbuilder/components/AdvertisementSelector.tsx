import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, Package, ExternalLink } from "lucide-react";
import type { Advertisement, Product } from "@/types/api-models";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface AdvertisementSelectorProps {
  onAdvertisementSelect: (advertisement: Advertisement, selectedProducts: Product[]) => void;
}

export default function AdvertisementSelector({ onAdvertisementSelect }: AdvertisementSelectorProps) {
  const [, setLocation] = useLocation();
  const [selectedAdvertisement, setSelectedAdvertisement] = useState<Advertisement | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

  // Fetch advertisements
  const { data: advertisements = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: async () => {
      const data = await api.get<Advertisement[]>('/advertisements');
      return data || [];
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const data = await api.get<Product[]>('/products');
      return data || [];
    },
  });

  const handleProductToggle = (product: Product, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, product]);
    } else {
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
    }
  };

  const handleAdvertisementConfirm = () => {
    if (selectedAdvertisement) {
      onAdvertisementSelect(selectedAdvertisement, selectedProducts);
      toast.success("Advertisement and products selected!");
    }
  };

  const handleGoToAdManager = () => {
    setLocation('/admin/advertisements-manager');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Advertisement Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="ad-select">Select Advertisement</Label>
              <Select
                value={selectedAdvertisement?.id.toString() || "none"}
                onValueChange={(value) => {
                  if (value === "none") {
                    setSelectedAdvertisement(null);
                    setSelectedProducts([]);
                  } else {
                    const ad = advertisements.find(a => a.id.toString() === value);
                    setSelectedAdvertisement(ad || null);
                    setSelectedProducts([]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose advertisement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No advertisement</SelectItem>
                  {advertisements.map((ad) => (
                    <SelectItem key={ad.id} value={ad.id.toString()}>
                      {ad.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGoToAdManager}
              variant="outline"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Manage Ads
            </Button>
          </div>

          {selectedAdvertisement && (
            <div className="p-4 bg-radio-cyan/10 rounded-lg border border-radio-cyan/30">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-neutral-100">{selectedAdvertisement.title}</h4>
                  <p className="text-sm text-radio-cyan mt-1">Advertiser: {selectedAdvertisement.advertiser}</p>
                </div>
                <Button
                  onClick={handleGoToAdManager}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Package className="h-4 w-4" />
                  Manage Products
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAdvertisement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Select Products for Advertisement ({selectedProducts.length} selected)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {products.map((product) => (
                <div key={product.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id={`product-${product.id}`}
                    checked={selectedProducts.some(p => p.id === product.id)}
                    onCheckedChange={(checked) => handleProductToggle(product, checked as boolean)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`product-${product.id}`}
                      className="font-medium cursor-pointer"
                    >
                      {product.name}
                    </label>
                    <p className="text-sm text-gray-600">{product.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">${product.price}</Badge>
                      <Badge variant="secondary">{product.category}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No Products Available</h4>
                  <p className="text-gray-500 mb-4">
                    No products available. Go to advertisement manager to create products!
                  </p>
                  <Button
                    onClick={handleGoToAdManager}
                    variant="outline"
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Go to Ad Manager
                  </Button>
                </div>
              )}
            </div>

            {selectedProducts.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Selected Products:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedProducts.map((product) => (
                    <Badge key={product.id} variant="secondary">
                      {product.name} - ${product.price}
                    </Badge>
                  ))}
                </div>
                <Button
                  onClick={handleAdvertisementConfirm}
                  className="mt-3 w-full"
                >
                  Confirm Advertisement Selection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}