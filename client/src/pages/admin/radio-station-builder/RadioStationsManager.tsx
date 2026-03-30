import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Radio, Plus, Search, Edit, Trash2, MapPin, Clock, Users } from "lucide-react";
import type { RadioStation, Location, Host } from "@/types/api-models";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import LocationCreator from "@/components/LocationCreator";

type RadioStationWithRelations = RadioStation & {
  location: Location | null;
  hosts: Host[];
  _count?: {
    scheduledShows: number;
  };
};

export default function RadioStationsManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<RadioStationWithRelations | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    logoUrl: "",
    timezone: "Asia/Dubai",
    locationId: "",
    isActive: true
  });

  const queryClient = useQueryClient();

  // Fetch radio stations with relations
  const { data: radioStations = [], isLoading } = useQuery({
    queryKey: ['radio-stations'],
    queryFn: async () => {
      const stations = await api.get('/radio-stations');
      // API already includes location, hosts, and _count
      return stations || [];
    },
  });

  // Fetch locations for dropdown
  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const locations = await api.get('/locations');
      return locations || [];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingStation) {
        return api.put(`/radio-stations/${editingStation.id}`, data);
      } else {
        return api.post('/radio-stations', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radio-stations'] });
      toast.success(editingStation ? "Radio station updated!" : "Radio station created!");
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to save radio station");
      console.error(error);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/radio-stations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radio-stations'] });
      toast.success("Radio station deleted!");
    },
    onError: (error) => {
      toast.error("Failed to delete radio station");
      console.error(error);
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      logoUrl: "",
      timezone: "Asia/Dubai",
      locationId: "",
      isActive: true
    });
    setEditingStation(null);
  };

  const handleEdit = (station: RadioStationWithRelations) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      description: station.description || "",
      logoUrl: station.logoUrl || "",
      timezone: station.timezone,
      locationId: station.locationId?.toString() || "",
      isActive: station.isActive
    });
    setIsCreateDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      locationId: formData.locationId ? parseInt(formData.locationId) : null
    };
    saveMutation.mutate(data);
  };

  // Filter radio stations based on search query
  const filteredStations = radioStations.filter((station) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const matchesName = station.name.toLowerCase().includes(query);
    const matchesLocation = station.location?.name.toLowerCase().includes(query);

    return matchesName || matchesLocation;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Radio Stations</h2>
          <p className="text-gray-600">Manage your radio stations and their configurations</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={resetForm}>
              <Plus className="h-4 w-4" />
              Create Station
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingStation ? "Edit Radio Station" : "Create New Radio Station"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Station Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={formData.timezone} onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationId">Location</Label>
                <LocationCreator
                  value={formData.locationId}
                  onChange={(locationId) => setFormData(prev => ({ ...prev, locationId }))}
                  placeholder="Select or create location..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    type="url"
                    value={formData.logoUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="isActive">Status</Label>
                  <Select value={formData.isActive.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, isActive: value === "true" }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editingStation ? "Update Station" : "Create Station"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search radio stations by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {searchQuery && (
          <Button
            variant="outline"
            onClick={() => setSearchQuery("")}
            className="gap-2"
          >
            Clear Search
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredStations.map((station: RadioStationWithRelations) => (
          <Card key={station.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {station.logoUrl ? (
                    <img src={station.logoUrl} alt={station.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Radio className="h-6 w-6 text-blue-600" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{station.name}</CardTitle>
                    <p className="text-sm text-gray-600">{station.location?.name || "No location"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={station.isActive ? "default" : "secondary"}>
                    {station.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {station.description && (
                <p className="text-sm text-gray-600">{station.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>{station.timezone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span>{station.hosts?.length || 0} hosts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-gray-400" />
                  <span>{station._count?.scheduledShows || 0} shows</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Radio className="h-4 w-4" />
                <span>Stream: Auto-generated edge function</span>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-xs text-gray-500">
                  Created {new Date(station.createdAt).toLocaleDateString()}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(station)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this radio station?")) {
                        deleteMutation.mutate(station.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStations.length === 0 && searchQuery && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Radio Stations Found</h3>
            <p className="text-gray-500 mb-4">No stations match your search "{searchQuery}"</p>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      )}

      {filteredStations.length === 0 && !searchQuery && radioStations.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Radio className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Radio Stations</h3>
            <p className="text-gray-500 mb-4">Create your first radio station to get started</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Station
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}