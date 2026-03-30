import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Plus, Mic, Edit, Trash2 } from "lucide-react";
import type { Host, HostCommentary } from "@/types/api-models";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface HostSelectorProps {
  selectedShowId: number | null;
  assignedHost: Host | null;
  onHostAssign: (host: Host | null) => void;
}

export default function HostSelector({ selectedShowId, assignedHost, onHostAssign }: HostSelectorProps) {
  const queryClient = useQueryClient();
  const [isCreateHostDialogOpen, setIsCreateHostDialogOpen] = useState(false);
  const [isCreateCommentaryDialogOpen, setIsCreateCommentaryDialogOpen] = useState(false);
  const [selectedHost, setSelectedHost] = useState<Host | null>(null);

  const [hostFormData, setHostFormData] = useState({
    name: "",
    bio: "",
    imageUrl: "",
    aiStyle: "",
    aiVoiceId: "",
    language: "en-US",
    isActive: true,
  });

  const [commentaryFormData, setCommentaryFormData] = useState({
    title: "",
    content: "",
    audioUrl: "",
    duration: 0,
    isActive: true,
  });

  // Fetch hosts
  const { data: hosts = [] } = useQuery({
    queryKey: ['hosts'],
    queryFn: async () => {
      const data = await api.get<Host[]>('/hosts');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Fetch host commentaries for selected host
  const { data: hostCommentaries = [] } = useQuery({
    queryKey: ['host-commentaries', selectedHost?.id],
    queryFn: async () => {
      if (!selectedHost) return [];
      const data = await api.get<HostCommentary[]>(`/host-commentaries?hostId=${selectedHost.id}`);
      return data || [];
    },
    enabled: !!selectedHost,
  });

  // Create host mutation
  const createHostMutation = useMutation({
    mutationFn: async (data: typeof hostFormData) => {
      return api.post<Host>('/hosts', data);
    },
    onSuccess: (newHost) => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] });
      setIsCreateHostDialogOpen(false);
      resetHostForm();
      onHostAssign(newHost);
      toast.success("Host created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create host: " + error.message);
    },
  });

  // Assign host to show mutation
  const assignHostMutation = useMutation({
    mutationFn: async ({ showId, hostId }: { showId: number; hostId: number | null }) => {
      await api.put(`/shows/${showId}`, { hostId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shows-with-relations'] });
      toast.success("Host assigned successfully!");
    },
    onError: (error) => {
      toast.error("Failed to assign host: " + error.message);
    },
  });

  // Create host commentary mutation
  const createCommentaryMutation = useMutation({
    mutationFn: async (data: typeof commentaryFormData & { hostId: number }) => {
      return api.post('/host-commentaries', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-commentaries', selectedHost?.id] });
      setIsCreateCommentaryDialogOpen(false);
      resetCommentaryForm();
      toast.success("Host commentary created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create commentary: " + error.message);
    },
  });

  const resetHostForm = () => {
    setHostFormData({
      name: "",
      bio: "",
      imageUrl: "",
      aiStyle: "",
      aiVoiceId: "",
      language: "en-US",
      isActive: true,
    });
  };

  const resetCommentaryForm = () => {
    setCommentaryFormData({
      title: "",
      content: "",
      audioUrl: "",
      duration: 0,
      isActive: true,
    });
  };

  const handleHostAssign = (hostId: string) => {
    if (hostId === "none") {
      onHostAssign(null);
      if (selectedShowId) {
        assignHostMutation.mutate({ showId: selectedShowId, hostId: null });
      }
    } else {
      const host = hosts.find(h => h.id.toString() === hostId) || null;
      onHostAssign(host);
      if (selectedShowId && host) {
        assignHostMutation.mutate({ showId: selectedShowId, hostId: host.id });
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Host Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="host-select">Assign Host to Show</Label>
              <Select
                value={assignedHost?.id.toString() || "none"}
                onValueChange={handleHostAssign}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select host" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No host</SelectItem>
                  {hosts.map((host) => (
                    <SelectItem key={host.id} value={host.id.toString()}>
                      {host.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => setIsCreateHostDialogOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Host
            </Button>
          </div>

          {assignedHost && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-blue-900">{assignedHost.name}</h4>
                  <p className="text-sm text-blue-700 mt-1">{assignedHost.bio}</p>
                  <div className="flex gap-4 mt-2 text-xs text-blue-600">
                    {assignedHost.aiStyle && <span>🎭 {assignedHost.aiStyle}</span>}
                    {assignedHost.language && <span>🌐 {assignedHost.language}</span>}
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setSelectedHost(assignedHost);
                    setIsCreateCommentaryDialogOpen(true);
                  }}
                  size="sm"
                  className="gap-2"
                >
                  <Mic className="h-4 w-4" />
                  Add Commentary
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {assignedHost && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Host Commentaries ({hostCommentaries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hostCommentaries.map((commentary) => (
                <div key={commentary.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{commentary.title}</h4>
                    <p className="text-sm text-gray-600 line-clamp-2">{commentary.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{commentary.duration}s</Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(commentary.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {hostCommentaries.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  No commentaries yet. Create one to add personality to your show!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Host Dialog */}
      <Dialog open={isCreateHostDialogOpen} onOpenChange={setIsCreateHostDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Host</DialogTitle>
            <DialogDescription>
              Add a new radio host to your team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="host-name">Name</Label>
              <Input
                id="host-name"
                value={hostFormData.name}
                onChange={(e) => setHostFormData({ ...hostFormData, name: e.target.value })}
                placeholder="Host name"
              />
            </div>

            <div>
              <Label htmlFor="host-bio">Bio</Label>
              <Textarea
                id="host-bio"
                value={hostFormData.bio}
                onChange={(e) => setHostFormData({ ...hostFormData, bio: e.target.value })}
                placeholder="Tell us about this host"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="host-ai-style">AI Style</Label>
                <Input
                  id="host-ai-style"
                  value={hostFormData.aiStyle}
                  onChange={(e) => setHostFormData({ ...hostFormData, aiStyle: e.target.value })}
                  placeholder="Professional, Casual, etc."
                />
              </div>

              <div>
                <Label htmlFor="host-language">Language</Label>
                <Input
                  id="host-language"
                  value={hostFormData.language}
                  onChange={(e) => setHostFormData({ ...hostFormData, language: e.target.value })}
                  placeholder="en-US"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="host-image">Image URL</Label>
              <Input
                id="host-image"
                value={hostFormData.imageUrl}
                onChange={(e) => setHostFormData({ ...hostFormData, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateHostDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createHostMutation.mutate(hostFormData)}>
              Create Host
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Host Commentary Dialog */}
      <Dialog open={isCreateCommentaryDialogOpen} onOpenChange={setIsCreateCommentaryDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Host Commentary</DialogTitle>
            <DialogDescription>
              Add a personal commentary from {selectedHost?.name} to your show.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="commentary-title">Title</Label>
              <Input
                id="commentary-title"
                value={commentaryFormData.title}
                onChange={(e) => setCommentaryFormData({ ...commentaryFormData, title: e.target.value })}
                placeholder="Commentary title"
              />
            </div>

            <div>
              <Label htmlFor="commentary-content">Content</Label>
              <Textarea
                id="commentary-content"
                value={commentaryFormData.content}
                onChange={(e) => setCommentaryFormData({ ...commentaryFormData, content: e.target.value })}
                placeholder="What should the host say?"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="commentary-audio">Audio URL (Optional)</Label>
                <Input
                  id="commentary-audio"
                  value={commentaryFormData.audioUrl}
                  onChange={(e) => setCommentaryFormData({ ...commentaryFormData, audioUrl: e.target.value })}
                  placeholder="https://example.com/audio.mp3"
                />
              </div>

              <div>
                <Label htmlFor="commentary-duration">Duration (seconds)</Label>
                <Input
                  id="commentary-duration"
                  type="number"
                  min="0"
                  value={commentaryFormData.duration}
                  onChange={(e) => setCommentaryFormData({ ...commentaryFormData, duration: parseInt(e.target.value) || 0 })}
                  placeholder="30"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateCommentaryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedHost && createCommentaryMutation.mutate({
                ...commentaryFormData,
                hostId: selectedHost.id
              })}
            >
              Create Commentary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}