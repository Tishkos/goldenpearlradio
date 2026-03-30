import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Advertisement, Product, Show, ShowItem, Host } from "@/types/api-models";
import { api } from "@/lib/api-client";
import ShowList from "./components/ShowList";
import ShowDetails from "./components/ShowDetails";

type ShowWithRelations = Show & { host?: Host | null; showItems: ShowItem[] };

export default function ShowBuilder() {
  const queryClient = useQueryClient();

  const [selectedShow, setSelectedShow] = useState<ShowWithRelations | null>(null);

  // Fetch shows with relations
  const { data: shows = [] } = useQuery({
    queryKey: ['shows-with-items'],
    queryFn: async () => {
      const data = await api.get<ShowWithRelations[]>('/shows');
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  const handleAdvertisementSelect = (advertisement: Advertisement, products: Product[]) => {
    // Handle advertisement selection with products
    console.log("Selected advertisement:", advertisement, "with products:", products);
    toast.success(`Advertisement "${advertisement.title}" selected with ${products.length} products`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Advanced Show Builder
          </h2>
          <p className="text-gray-600">Create complex radio shows with hosts, content, advertisements, and advanced controls</p>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-4 xl:grid-cols-3 gap-6">
        {/* Shows List */}
        <div className="2xl:col-span-1 xl:col-span-1">
          <ShowList
            shows={shows}
            selectedShow={selectedShow}
            onShowSelect={setSelectedShow}
          />
        </div>

        {/* Show Details and Builder */}
        <div className="2xl:col-span-3 xl:col-span-2 space-y-6">
          <ShowDetails
            selectedShow={selectedShow}
            onAdvertisementSelect={handleAdvertisementSelect}
            showId={selectedShow?.id}
            onItemAdded={() => queryClient.invalidateQueries({ queryKey: ['shows-with-items'] })}
          />
        </div>
      </div>
    </div>
  );
}