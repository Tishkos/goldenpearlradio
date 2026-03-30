import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit, Trash2, Mic, Play, Volume2, Pause } from "lucide-react";
import type { Advertisement, Product } from "@/types/api-models";

interface AdvertisementListProps {
  advertisements: (Advertisement & { product?: Product })[];
  hosts: any[];
  hostAudios: any[];
  searchTerm: string;
  onEdit: (advertisement: Advertisement & { product?: Product }) => void;
  onDelete: (advertisement: Advertisement & { product?: Product }) => void;
  onGenerateHostAudio: (advertisementId: number, hostId: number) => void;
  regeneratingAudio?: Set<number>; // Set of advertisement IDs currently being regenerated
  generatingHostAudio?: Set<string>; // Set of "advertisementId-hostId" keys currently generating individual host audio
  onDeleteHostAudio?: (advertisementId: number, hostId: number) => void; // Function to delete specific host audio
}

export default function AdvertisementList({
  advertisements,
  hosts,
  hostAudios,
  searchTerm,
  onEdit,
  onDelete,
  onGenerateHostAudio,
  regeneratingAudio = new Set(),
  generatingHostAudio = new Set(),
  onDeleteHostAudio,
}: AdvertisementListProps) {
  console.log('AdvertisementList render - hostAudios:', hostAudios);
  const [selectedHostId, setSelectedHostId] = useState<string>("");
  const [currentPlaying, setCurrentPlaying] = useState<{ advertisementId: number; hostId: number } | null>(null);
  
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const playHostAudio = (advertisementId: number, hostId: number, audioUrl: string) => {
    console.log('Playing audio:', audioUrl);

    if (currentPlaying?.advertisementId === advertisementId && currentPlaying?.hostId === hostId) {
      // Currently playing this audio, so pause it
      if (audioElement) {
        audioElement.pause();
        setCurrentPlaying(null);
      }
    } else {
      // Stop any currently playing audio
      if (audioElement) {
        audioElement.pause();
      }

      // Create new audio element and play
      const newAudio = new Audio(audioUrl);
      newAudio.onended = () => {
        setCurrentPlaying(null);
        setAudioElement(null);
      };
      newAudio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setCurrentPlaying(null);
        setAudioElement(null);
      };

      setAudioElement(newAudio);
      setCurrentPlaying({ advertisementId, hostId });

      newAudio.play().catch(error => {
        console.error('Failed to play audio:', error);
        setCurrentPlaying(null);
        setAudioElement(null);
      });
    }
  };

  const filteredAdvertisements = advertisements.filter((ad) =>
    ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ad.advertiser.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ad.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ad.product?.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ad.product?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ad.product?.tags && Array.isArray(ad.product.tags) &&
     (ad.product.tags as string[]).some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {filteredAdvertisements.map((advertisement) => (
        <Card key={advertisement.id} className="hover:shadow-lg transition-shadow h-fit">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base font-semibold truncate leading-tight">
                  {advertisement.title}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1 truncate">
                  {advertisement.advertiser}
                </p>
                {advertisement.product && (
                  <div className="text-xs text-blue-600 mt-2 space-y-1">
                    <p className="truncate"><strong>Product:</strong> {advertisement.product.name}</p>
                    <p><strong>Price:</strong> {advertisement.product.price} {advertisement.product.currency.toUpperCase()}</p>
                    {advertisement.product.category && (
                      <p className="truncate"><strong>Category:</strong> {advertisement.product.category}</p>
                    )}
                    {advertisement.product.description && (
                      <p className="text-xs leading-relaxed line-clamp-2"><strong>Description:</strong> {advertisement.product.description}</p>
                    )}
                  </div>
                )}
                {regeneratingAudio.has(advertisement.id) && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <Volume2 className="h-3 w-3 animate-pulse flex-shrink-0" />
                    <span className="truncate">Regenerating audio...</span>
                  </p>
                )}
              </div>
              <Badge variant={advertisement.isActive ? "default" : "secondary"} className="text-xs flex-shrink-0">
                {advertisement.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Host Audio Status Section */}
            <div className="border-b border-gray-200 pb-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Volume2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Host Audio Status</span>
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {hosts.map((host) => {
                  const hostAudio = hostAudios.find(
                    (audio) => audio.advertisementId === advertisement.id && audio.hostId === host.id
                  );
                  console.log(`Host ${host.name} (${host.id}) for advertisement ${advertisement.id}:`, hostAudio);
                  return (
                    <div key={host.id} className="flex items-center justify-between text-xs gap-2">
                      <span className="text-gray-600 truncate flex-shrink-0 max-w-[80px]">{host.name}:</span>
                      {hostAudio ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-radio-cyan font-medium">✓ {hostAudio.duration}s</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => playHostAudio(advertisement.id, host.id, hostAudio.audioUrl)}
                            className="h-5 px-1 text-xs"
                          >
                            {currentPlaying?.advertisementId === advertisement.id && currentPlaying?.hostId === host.id ? (
                              <Pause className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onGenerateHostAudio(advertisement.id, host.id)}
                            disabled={regeneratingAudio.has(advertisement.id)}
                            className="h-5 px-1 text-xs"
                          >
                            <Volume2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-gray-400 flex-shrink-0">Not generated</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Host Audio Generation Section */}
            <div className="border-t border-gray-200 pt-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Mic className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Host Audio Generation</span>
              </h4>

              <div className="space-y-2">
                <Select value={selectedHostId} onValueChange={setSelectedHostId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select host to generate audio" />
                  </SelectTrigger>
                  <SelectContent>
                    {hosts.map((host) => (
                      <SelectItem key={host.id} value={host.id.toString()}>
                        {host.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  onClick={() => {
                    const hostId = parseInt(selectedHostId);
                    if (hostId) {
                      onGenerateHostAudio(advertisement.id, hostId);
                    }
                  }}
                  disabled={!selectedHostId || regeneratingAudio.has(advertisement.id) || (() => {
                    // Check if the selected host already has audio
                    const selectedHostIdNum = parseInt(selectedHostId);
                    return hostAudios.some(audio => 
                      audio.advertisementId === advertisement.id && audio.hostId === selectedHostIdNum
                    );
                  })() || (() => {
                    // Check if this specific host audio is currently being generated
                    const selectedHostIdNum = parseInt(selectedHostId);
                    const key = `${advertisement.id}-${selectedHostIdNum}`;
                    return generatingHostAudio.has(key);
                  })()}
                  className="w-full h-8 text-xs"
                >
                  {(() => {
                    // Check if this specific host audio is currently being generated
                    const selectedHostIdNum = parseInt(selectedHostId);
                    const key = `${advertisement.id}-${selectedHostIdNum}`;
                    const isGenerating = generatingHostAudio.has(key);
                    
                    if (isGenerating) {
                      return (
                        <>
                          <Volume2 className="h-3 w-3 mr-1 animate-pulse" />
                          Generating...
                        </>
                      );
                    }
                    
                    // Check if the selected host already has audio
                    const hasAudio = hostAudios.some(audio => 
                      audio.advertisementId === advertisement.id && audio.hostId === selectedHostIdNum
                    );
                    return hasAudio ? 'Audio Already Generated' : 'Generate Audio';
                  })()}
                </Button>
              </div>
              {selectedHostId && (() => {
                // Check if the selected host has audio
                const selectedHostIdNum = parseInt(selectedHostId);
                const hasAudio = hostAudios.some(audio => 
                  audio.advertisementId === advertisement.id && audio.hostId === selectedHostIdNum
                );
                
                return hasAudio ? (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const hostId = parseInt(selectedHostId);
                        if (hostId && onDeleteHostAudio) {
                          onDeleteHostAudio(advertisement.id, hostId);
                        }
                      }}
                      disabled={regeneratingAudio.has(advertisement.id)}
                      className="w-full h-8 text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete Audio for Selected Host
                    </Button>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-200">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(advertisement)}
                className="flex-1 text-xs h-8"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="flex-1 text-xs h-8">
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-lg">Delete Advertisement</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Are you sure you want to delete "{advertisement.title}"?
                    </p>
                    <p className="text-xs text-red-600">
                      This will also delete all associated host audio files from storage.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Cancel</Button>
                    </DialogTrigger>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(advertisement)}
                    >
                      Delete
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ))}

      {filteredAdvertisements.length === 0 && (
        <div className="col-span-full text-center py-12">
          <Mic className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No advertisements found</h3>
          <p className="text-gray-600">
            {searchTerm ? "Try adjusting your search terms." : "Create your first advertisement to get started."}
          </p>
        </div>
      )}
    </div>
  );
}