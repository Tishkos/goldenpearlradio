import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Advertisement, Product } from "@/types/api-models";

interface AdvertisementFormProps {
  advertisement?: Advertisement & { product?: Product };
  products: Product[];
  onSubmit: (data: Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function AdvertisementForm({ advertisement, products, onSubmit, onCancel }: AdvertisementFormProps) {
  const [formData, setFormData] = useState({
    title: advertisement?.title || "",
    advertiser: advertisement?.advertiser || "",
    productId: advertisement?.productId || 0,
    isActive: advertisement?.isActive ?? true,
  });

  const [productSearchOpen, setProductSearchOpen] = useState(false);

  const selectedProduct = products.find(product => product.id === formData.productId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.advertiser.trim() || formData.productId === 0) {
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="productId">Product *</Label>
        <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={productSearchOpen}
              className="w-full justify-between"
            >
              {selectedProduct
                ? `${selectedProduct.name} - ${selectedProduct.price} ${selectedProduct.currency.toUpperCase()}`
                : "Select a product for this advertisement..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search products..." />
              <CommandList>
                <CommandEmpty>No products found.</CommandEmpty>
                <CommandGroup>
                  {products.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={`${product.name} ${product.category} ${product.description}`}
                      onSelect={() => {
                        setFormData({ ...formData, productId: product.id });
                        setProductSearchOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          formData.productId === product.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-sm text-gray-500">
                          {product.category} • {product.price} {product.currency.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400 truncate max-w-xs">
                          {product.description}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label htmlFor="title">Advertisement Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Enter advertisement title"
          required
        />
      </div>

      <div>
        <Label htmlFor="advertiser">Advertiser *</Label>
        <Input
          id="advertiser"
          value={formData.advertiser}
          onChange={(e) => setFormData({ ...formData, advertiser: e.target.value })}
          placeholder="Enter advertiser name"
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {advertisement ? "Update" : "Create"} Advertisement
        </Button>
      </div>
    </form>
  );
}