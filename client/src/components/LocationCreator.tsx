import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { MapPin, Plus, Loader2 } from "lucide-react";
import LazyMap from "../pages/home/components/LazyMap";

interface LocationCreatorProps {
  value?: string;
  onChange: (locationId: string) => void;
  placeholder?: string;
  className?: string;
}

export default function LocationCreator({
  value,
  onChange,
  placeholder = "Select or create location...",
  className
}: LocationCreatorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: "",
    address: "",
    city: "",
    country: "",
    mapUrl: "",
    imageUrl: "",
    rating: "",
    tags: ""
  });

  // Fetch locations
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const data = await api.get('/locations');
      return (data || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
    }
  });

  // Create new location
  const createLocation = useMutation({
    mutationFn: async (data: {
      name: string;
      address?: string;
      city?: string;
      country?: string;
      mapUrl?: string;
      imageUrl?: string;
      rating?: number;
      tags?: string[];
    }) => {
      return api.post('/locations', {
        name: data.name,
        address: data.address || "",
        city: data.city,
        country: data.country,
        mapUrl: data.mapUrl,
        imageUrl: data.imageUrl,
        rating: data.rating,
        tags: data.tags || []
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast({
        title: "Location Created",
        description: `Location "${data.name}" has been created successfully.`
      });
      onChange(data.id.toString());
      setIsCreateDialogOpen(false);
      setNewLocation({
        name: "",
        address: "",
        city: "",
        country: "",
        mapUrl: "",
        imageUrl: "",
        rating: "",
        tags: ""
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create location: ${error}`,
        variant: "destructive",
      });
    }
  });

  const handleCreateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.name.trim()) return;

    const data = {
      name: newLocation.name.trim(),
      address: newLocation.address.trim() || "",
      city: newLocation.city.trim() || undefined,
      country: newLocation.country.trim() || undefined,
      mapUrl: newLocation.mapUrl.trim() || undefined,
      imageUrl: newLocation.imageUrl.trim() || undefined,
      rating: newLocation.rating ? parseInt(newLocation.rating) : undefined,
      tags: newLocation.tags.trim() ? newLocation.tags.split(',').map(tag => tag.trim()) : []
    };

    createLocation.mutate(data);
  };

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === "create-new") {
      setIsCreateDialogOpen(true);
    } else {
      onChange(selectedValue);
    }
  };

  return (
    <div className={className}>
      <Select value={value} onValueChange={handleSelectChange} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Loading locations..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="create-new">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create New Location
            </div>
          </SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id.toString()}>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {location.name}
                {location.city && (
                  <span className="text-muted-foreground text-sm">
                    - {location.city}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Create Location Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Location</DialogTitle>
            <DialogDescription>
              Add a new location to the system. Fill in as many details as possible.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateLocation} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Location name..."
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Full address..."
                />
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={newLocation.city}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="City name..."
                />
              </div>

              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={newLocation.country}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, country: e.target.value }))}
                  placeholder="Country name..."
                />
              </div>

              <div>
                <Label htmlFor="rating">Rating (1-5)</Label>
                <Input
                  id="rating"
                  type="number"
                  min="1"
                  max="5"
                  value={newLocation.rating}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, rating: e.target.value }))}
                  placeholder="1-5"
                />
              </div>

              <div>
                <Label htmlFor="mapUrl">Map URL</Label>
                <Input
                  id="mapUrl"
                  value={newLocation.mapUrl}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, mapUrl: e.target.value }))}
                  placeholder="Google Maps URL..."
                />
              </div>

              {newLocation.mapUrl && (
                <div className="md:col-span-2">
                  <Label>Map Preview</Label>
                  <div className="mt-2">
                    <LazyMap
                      mapUrl={newLocation.mapUrl}
                      locationName={newLocation.name || "New Location"}
                    />
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input
                  id="imageUrl"
                  value={newLocation.imageUrl}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="Image URL..."
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={newLocation.tags}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="restaurant, hotel, attraction..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createLocation.isPending || !newLocation.name.trim()}
              >
                {createLocation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Location
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}