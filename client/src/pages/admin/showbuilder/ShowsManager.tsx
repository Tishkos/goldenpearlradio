import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Image, Radio, Calendar, Users, User } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Show, Host, ShowItem } from "@/types/api-models";

type ShowWithRelations = {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  hostId: number;
  featured: boolean;
  isActive: boolean;
  createdAt: Date;
  host: {
    id: number;
    name: string;
    bio: string | null;
    aiStyle: string | null;
  } | null;
  scheduledShows: {
    id: number;
    showId: number;
    radioStationId: number;
    locationId: number | null;
    startTime: Date;
    endTime: Date;
    createdAt: Date;
    radioStation: {
      id: number;
      name: string;
      description: string | null;
      logoUrl: string | null;
      streamUrl: string | null;
      timezone: string;
      locationId: number | null;
      isActive: boolean;
      createdAt: Date;
    };
    location: {
      id: number;
      name: string;
      address: string;
      city: string | null;
      country: string | null;
      mapUrl: string | null;
      imageUrl: string | null;
      rating: number | null;
      tags: any;
      createdAt: Date;
    } | null;
  }[];
  showItems: {
    id: number;
    showId: number;
    position: number;
    startTimeOffset: number;
    contentType: string;
    contentId: number;
    notes: string | null;
    volume: number;
    fadeInDuration: number;
    fadeOutDuration: number;
    playbackStartTime: number;
    playbackEndTime: number | null;
    mixMode: string;
    parentItemId: number | null;
    startTimeInParent: number | null;
    duckingVolume: number | null;
  }[];
};

// Frontend-only: do not depend on Prisma types
// (We keep the structure above for now, but the base types come from api-models.)

export default function ShowsManager() {
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingShow, setEditingShow] = useState<ShowWithRelations | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    imageUrl: "",
    hostId: 0,
    featured: false,
    isActive: true,
  });

  // Fetch hosts
  const { data: hosts = [] } = useQuery({
    queryKey: ['hosts'],
    queryFn: async () => {
      const data = await api.get('/hosts');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Fetch shows from API (PostgreSQL)
  const { data: shows = [], isLoading, error } = useQuery({
    queryKey: ['shows'],
    queryFn: async () => {
      const data = await api.get('/shows');
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // Create show mutation
  const createShowMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return api.post('/shows', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast.success("Show created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create show: " + error.message);
    },
  });

  // Update show mutation
  const updateShowMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return api.put(`/shows/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] });
      setEditingShow(null);
      resetForm();
      toast.success("Show updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update show: " + error.message);
    },
  });

  // Delete show mutation
  const deleteShowMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/shows/${id}`);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] });
      toast.success("Show deleted successfully!");
    },
    onError: (error) => {
      toast.error("Failed to delete show: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      imageUrl: "",
      hostId: 0,
      featured: false,
      isActive: true,
    });
  };

  const handleCreateShow = () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a show title");
      return;
    }
    if (formData.hostId === 0) {
      toast.error("Please select a host for the show");
      return;
    }
    createShowMutation.mutate(formData);
  };

  const handleEditShow = (show: ShowWithRelations) => {
    setEditingShow(show as any);
    setFormData({
      title: show.title,
      description: show.description || "",
      imageUrl: show.imageUrl || "",
      hostId: show.hostId,
      featured: show.featured,
      isActive: show.isActive,
    });
  };

  const handleUpdateShow = () => {
    if (!editingShow) return;
    if (!formData.title.trim()) {
      toast.error("Please enter a show title");
      return;
    }
    if (formData.hostId === 0) {
      toast.error("Please select a host for the show");
      return;
    }
    updateShowMutation.mutate({ id: editingShow.id, data: formData });
  };

  const handleDeleteShow = (id: number) => {
    deleteShowMutation.mutate(id);
  };

  // Filter shows based on search query
  const filteredShows = shows.filter((show) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const matchesTitle = show.title.toLowerCase().includes(query);
    const matchesDescription = show.description?.toLowerCase().includes(query);
    const matchesHost = show.host?.name.toLowerCase().includes(query);

    return matchesTitle || matchesDescription || matchesHost;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Shows Management</h2>
          <p className="text-gray-600">Create and manage your radio show templates</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create New Show
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search shows by title, description, or host name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredShows.map((show: ShowWithRelations) => (
          <Card key={show.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="aspect-video bg-gray-200 relative">
              {show.imageUrl ? (
                <img
                  src={show.imageUrl}
                  alt={show.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                  <Radio className="h-12 w-12 text-purple-400" />
                </div>
              )}
              {show.featured && (
                <Badge className="absolute top-2 right-2 bg-yellow-500">
                  Featured
                </Badge>
              )}
            </div>

            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">{show.title}</h3>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditShow(show)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteShow(show.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {show.host && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 rounded-lg">
                  <User className="h-4 w-4 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">{show.host.name}</p>
                    {show.host.bio && (
                      <p className="text-xs text-blue-700 line-clamp-1">{show.host.bio}</p>
                    )}
                  </div>
                  {show.host.aiStyle && (
                    <Badge variant="outline" className="text-xs">
                      {show.host.aiStyle}
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                <span>{show.scheduledShows?.length || 0} scheduled shows</span>
                <span>{show.showItems?.length || 0} total items</span>
              </div>

              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                {show.description || "No description available"}
              </p>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Created {new Date(show.createdAt).toLocaleDateString()}</span>
                <Badge variant={show.isActive ? "default" : "secondary"}>
                  {show.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredShows.length === 0 && searchQuery && (
        <div className="text-center py-8">
          <p className="text-gray-500">No shows found matching "{searchQuery}"</p>
          <Button
            variant="outline"
            onClick={() => setSearchQuery("")}
            className="mt-2"
          >
            Clear Search
          </Button>
        </div>
      )}

      {filteredShows.length === 0 && !searchQuery && shows.length === 0 && (
        <div className="text-center py-8">
          <Radio className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No shows created yet</p>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-2 gap-2">
            <Plus className="h-4 w-4" />
            Create Your First Show
          </Button>
        </div>
      )}

      {/* Create Show Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Show</DialogTitle>
            <DialogDescription>
              Create a new show template that can be scheduled multiple times.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Show Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter show title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter show description"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="Enter image URL"
              />
            </div>

            <div>
              <Label htmlFor="host">Host *</Label>
              <Select
                value={formData.hostId.toString()}
                onValueChange={(value) => setFormData({ ...formData, hostId: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a host for this show" />
                </SelectTrigger>
                <SelectContent>
                  {hosts.map((host) => (
                    <SelectItem key={host.id} value={host.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{host.name}</span>
                        {host.bio && (
                          <span className="text-xs text-gray-500 truncate max-w-32">
                            - {host.bio}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hosts.length === 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  No hosts available. Please create a host first.
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="featured"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="featured">Featured Show</Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateShow}>Create Show</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Show Dialog */}
      <Dialog open={!!editingShow} onOpenChange={() => setEditingShow(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Show</DialogTitle>
            <DialogDescription>
              Update the show template details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Show Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter show title"
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter show description"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="edit-imageUrl">Image URL</Label>
              <Input
                id="edit-imageUrl"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="Enter image URL"
              />
            </div>

            <div>
              <Label htmlFor="edit-host">Host *</Label>
              <Select
                value={formData.hostId.toString()}
                onValueChange={(value) => setFormData({ ...formData, hostId: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a host for this show" />
                </SelectTrigger>
                <SelectContent>
                  {hosts.map((host) => (
                    <SelectItem key={host.id} value={host.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{host.name}</span>
                        {host.bio && (
                          <span className="text-xs text-gray-500 truncate max-w-32">
                            - {host.bio}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hosts.length === 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  No hosts available. Please create a host first.
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-featured"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-featured">Featured Show</Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-isActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingShow(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateShow}>Update Show</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}