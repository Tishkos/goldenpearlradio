import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, Plus, GripVertical, X } from "lucide-react";
import type { ShowItem, Track, Talk, Product } from "@/types/api-models";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface OverlayItem {
  id: string;
  contentType: "TALK" | "ADVERTISEMENT";
  contentId: number;
  title: string;
  duration: number;
  startTime: number; // Start time in seconds within the track
  duckingVolume: number; // Volume to duck the background track to (0-100)
}

interface TrackTimelineEditorProps {
  track: Track;
  showItem: ShowItem;
  talks: Talk[];
  products: Product[];
  onUpdate: (updates: Partial<ShowItem>) => void;
  onAddOverlay: (overlay: Omit<OverlayItem, "id">) => void;
  onRemoveOverlay: (overlayId: string) => void;
  overlayItems: OverlayItem[];
  onUpdateOverlay: (overlayId: string, updates: Partial<OverlayItem>) => void;
}

export default function TrackTimelineEditor({
  track,
  showItem,
  talks,
  products,
  onUpdate,
  onAddOverlay,
  onRemoveOverlay,
  overlayItems,
  onUpdateOverlay,
}: TrackTimelineEditorProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isAddOverlayOpen, setIsAddOverlayOpen] = useState(false);
  const [newOverlay, setNewOverlay] = useState<{
    contentType: "TALK" | "ADVERTISEMENT";
    contentId: number;
    startTime: number;
    duckingVolume: number;
  }>({
    contentType: "TALK",
    contentId: 0,
    startTime: 0,
    duckingVolume: 50,
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const overlayAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const trackDuration = track.duration || 180; // Default 3 minutes if not set
  // Use showItem.duckingVolume if set, otherwise default to 50
  // This allows the slider to work even if duckingVolume is null/undefined initially
  const defaultDuckingVolume = showItem.duckingVolume !== null && showItem.duckingVolume !== undefined 
    ? showItem.duckingVolume 
    : 50;

  // Get audio URL for overlay item
  const getOverlayAudioUrl = (overlay: OverlayItem): string | null => {
    if (overlay.contentType === "TALK") {
      const talk = talks.find(t => t.id === overlay.contentId);
      return talk?.audioUrl || null;
    } else {
      const product = products.find(p => p.id === overlay.contentId);
      return product?.audioUrl || null;
    }
  };

  // Check if an overlay is currently active and get its ducking volume
  const getActiveOverlay = () => {
    return overlayItems.find(overlay => {
      const overlayStart = overlay.startTime;
      const overlayEnd = overlay.startTime + overlay.duration;
      return currentTime >= overlayStart && currentTime < overlayEnd;
    });
  };

  // Manage overlay audio playback and volume ducking in real-time
  useEffect(() => {
    if (!audioRef.current) return;

    const activeOverlay = getActiveOverlay();
    
    // Handle main track volume ducking with smooth transitions
    if (activeOverlay) {
      const duckingVolume = activeOverlay.duckingVolume ?? defaultDuckingVolume;
      const targetVolume = Math.max(0, Math.min(1, duckingVolume / 100));
      
      // Immediate but smooth transition (updated every 100ms via currentTime updates)
      const currentVolume = audioRef.current.volume;
      const volumeDiff = targetVolume - currentVolume;
      
      if (Math.abs(volumeDiff) > 0.02) {
        // Smooth step towards target
        const step = Math.min(0.15, Math.abs(volumeDiff) * 0.5);
        audioRef.current.volume = currentVolume + (volumeDiff > 0 ? step : -step);
      } else {
        audioRef.current.volume = targetVolume;
      }
    } else {
      // Smoothly restore full volume
      const currentVolume = audioRef.current.volume;
      if (currentVolume < 0.98) {
        const step = 0.15; // Faster restoration
        audioRef.current.volume = Math.min(1.0, currentVolume + step);
      } else {
        audioRef.current.volume = 1.0;
      }
    }

    // Manage overlay audio playback with fade transitions
    overlayItems.forEach(overlay => {
      const overlayStart = overlay.startTime;
      const overlayEnd = overlay.startTime + overlay.duration;
      const isActive = currentTime >= overlayStart && currentTime < overlayEnd;
      const audioUrl = getOverlayAudioUrl(overlay);
      
      if (!audioUrl) return;

      let overlayAudio = overlayAudioRefs.current.get(overlay.id);
      
      if (!overlayAudio) {
        // Create audio element for this overlay
        overlayAudio = new Audio(audioUrl);
        overlayAudio.volume = 1.0;
        overlayAudioRefs.current.set(overlay.id, overlayAudio);
      }

      if (isActive && isPlaying) {
        // Overlay should be playing
        if (overlayAudio.paused) {
          // Start playing from the correct position
          const timeIntoOverlay = currentTime - overlayStart;
          overlayAudio.currentTime = Math.max(0, Math.min(timeIntoOverlay, overlay.duration));
          overlayAudio.play().catch(err => {
            console.warn('Failed to play overlay audio:', err);
          });
        } else {
          // Sync position if needed
          const timeIntoOverlay = currentTime - overlayStart;
          const timeDiff = Math.abs(overlayAudio.currentTime - timeIntoOverlay);
          if (timeDiff > 0.5) {
            overlayAudio.currentTime = Math.max(0, Math.min(timeIntoOverlay, overlay.duration));
          }
        }
        
        // Apply fade transitions to overlay audio
        const timeIntoOverlay = currentTime - overlayStart;
        const fadeInDuration = showItem.fadeInDuration || 0;
        const fadeOutDuration = showItem.fadeOutDuration || 0;
        let overlayVolume = 1.0;
        
        // Fade in at the start
        if (fadeInDuration > 0 && timeIntoOverlay < fadeInDuration) {
          overlayVolume = timeIntoOverlay / fadeInDuration;
        }
        // Fade out at the end
        if (fadeOutDuration > 0 && overlay.duration - timeIntoOverlay < fadeOutDuration) {
          overlayVolume = Math.min(overlayVolume, (overlay.duration - timeIntoOverlay) / fadeOutDuration);
        }
        
        overlayAudio.volume = Math.max(0, Math.min(1, overlayVolume));
      } else {
        // Overlay should be paused
        if (!overlayAudio.paused) {
          overlayAudio.pause();
        }
      }
    });
    
    // Apply fade transitions to main track
    if (audioRef.current && isPlaying) {
      const fadeInDuration = showItem.fadeInDuration || 0;
      const fadeOutDuration = showItem.fadeOutDuration || 0;
      let trackVolume = audioRef.current.volume; // Preserve ducking volume
      
      // Fade in at the start
      if (fadeInDuration > 0 && currentTime < fadeInDuration) {
        trackVolume = (currentTime / fadeInDuration) * trackVolume;
      }
      // Fade out at the end
      if (fadeOutDuration > 0 && trackDuration - currentTime < fadeOutDuration) {
        trackVolume = ((trackDuration - currentTime) / fadeOutDuration) * trackVolume;
      }
      
      audioRef.current.volume = Math.max(0, Math.min(1, trackVolume));
    }
  }, [currentTime, overlayItems, defaultDuckingVolume, isPlaying, talks, products]);

  // Cleanup overlay audio elements
  useEffect(() => {
    return () => {
      overlayAudioRefs.current.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      overlayAudioRefs.current.clear();
    };
  }, []);

  // Update current time while playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      // Pause all overlay audio
      overlayAudioRefs.current.forEach(audio => {
        audio.pause();
      });
    } else {
      audioRef.current.play();
      // Overlay audio will start automatically via useEffect when currentTime reaches overlay start
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * trackDuration;
    
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      
      // Sync overlay audio positions
      overlayItems.forEach(overlay => {
        const overlayAudio = overlayAudioRefs.current.get(overlay.id);
        if (overlayAudio) {
          const overlayStart = overlay.startTime;
          const overlayEnd = overlay.startTime + overlay.duration;
          if (time >= overlayStart && time < overlayEnd) {
            const timeIntoOverlay = time - overlayStart;
            overlayAudio.currentTime = Math.max(0, Math.min(timeIntoOverlay, overlay.duration));
          } else {
            overlayAudio.pause();
          }
        }
      });
    }
  };

  const handleAddOverlay = () => {
    const content = newOverlay.contentType === "TALK"
      ? talks.find(t => t.id === newOverlay.contentId)
      : products.find(p => p.id === newOverlay.contentId);

    if (!content) return;

    onAddOverlay({
      contentType: newOverlay.contentType,
      contentId: newOverlay.contentId,
      title: newOverlay.contentType === "TALK" 
        ? (content as Talk).title 
        : (content as Product).name,
      duration: content.duration || 30,
      startTime: newOverlay.startTime,
      duckingVolume: newOverlay.duckingVolume,
    });

    setIsAddOverlayOpen(false);
    setNewOverlay({
      contentType: "TALK",
      contentId: 0,
      startTime: 0,
      duckingVolume: 50,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getOverlayPosition = (startTime: number) => {
    return (startTime / trackDuration) * 100;
  };

  const getOverlayWidth = (duration: number) => {
    return (duration / trackDuration) * 100;
  };

  return (
    <div className="space-y-4">
      {/* Audio Player */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={togglePlayPause}
              size="lg"
              className="rounded-full w-12 h-12 p-0"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{track.title}</span>
                <span className="text-xs text-gray-500">
                  {formatTime(currentTime)} / {formatTime(trackDuration)}
                </span>
              </div>
              <div
                ref={timelineRef}
                className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
                onClick={handleTimelineClick}
              >
                {/* Progress bar */}
                <div
                  className="absolute left-0 top-0 h-full bg-blue-500 rounded-full"
                  style={{ width: `${(currentTime / trackDuration) * 100}%` }}
                />
                {/* Overlay items on timeline */}
                {overlayItems.map((overlay) => (
                  <div
                    key={overlay.id}
                    className="absolute top-0 h-full bg-radio-cyan/70 border border-radio-cyan rounded"
                    style={{
                      left: `${getOverlayPosition(overlay.startTime)}%`,
                      width: `${getOverlayWidth(overlay.duration)}%`,
                    }}
                    title={`${overlay.title} - Duck to ${overlay.duckingVolume}%`}
                  />
                ))}
              </div>
            </div>
          </div>
          <audio
            ref={audioRef}
            src={track.url}
            volume={1.0}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={() => {
              if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
              }
            }}
          />
        </CardContent>
      </Card>


      {/* Overlay Items List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Overlay Items (Talks & Products)</Label>
          <Button
            size="sm"
            onClick={() => setIsAddOverlayOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Overlay
          </Button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {overlayItems.map((overlay) => {
            const content = overlay.contentType === "TALK"
              ? talks.find(t => t.id === overlay.contentId)
              : products.find(p => p.id === overlay.contentId);

            return (
              <Card key={overlay.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">
                        {overlay.contentType === "TALK" ? "Talk" : "Product"}
                      </Badge>
                      <span className="text-sm font-medium">{overlay.title}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Start: {formatTime(overlay.startTime)}</span>
                      <span>Duration: {overlay.duration}s</span>
                      <div className="flex items-center gap-1">
                        <span>Duck to:</span>
                        <Input
                          type="number"
                          value={overlay.duckingVolume}
                          onChange={(e) => onUpdateOverlay(overlay.id, {
                            duckingVolume: Math.max(0, Math.min(100, Number(e.target.value)))
                          })}
                          className="w-16 h-6 text-xs px-1"
                          min={0}
                          max={100}
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={overlay.startTime}
                      onChange={(e) => onUpdateOverlay(overlay.id, {
                        startTime: Math.max(0, Math.min(trackDuration - overlay.duration, Number(e.target.value)))
                      })}
                      className="w-20 h-8 text-xs"
                      min={0}
                      max={trackDuration - overlay.duration}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRemoveOverlay(overlay.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {overlayItems.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No overlay items. Click "Add Overlay" to add talks or products over this track.
            </p>
          )}
        </div>
      </div>

      {/* Add Overlay Dialog */}
      <Dialog open={isAddOverlayOpen} onOpenChange={setIsAddOverlayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Overlay Item</DialogTitle>
            <DialogDescription>
              Add a talk or product to play over this track
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Content Type</Label>
              <Select
                value={newOverlay.contentType}
                onValueChange={(value: "TALK" | "ADVERTISEMENT") =>
                  setNewOverlay({ ...newOverlay, contentType: value, contentId: 0 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TALK">Talk</SelectItem>
                  <SelectItem value="ADVERTISEMENT">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {newOverlay.contentType === "TALK" ? "Talk" : "Product"}
              </Label>
              <Select
                value={newOverlay.contentId.toString()}
                onValueChange={(value) =>
                  setNewOverlay({ ...newOverlay, contentId: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {newOverlay.contentType === "TALK"
                    ? talks.map((talk) => (
                        <SelectItem key={talk.id} value={talk.id.toString()}>
                          {talk.title} ({talk.duration}s)
                        </SelectItem>
                      ))
                    : products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name} ({product.duration || 30}s)
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Time (seconds)</Label>
              <Input
                type="number"
                value={newOverlay.startTime}
                onChange={(e) =>
                  setNewOverlay({
                    ...newOverlay,
                    startTime: Math.max(0, Number(e.target.value)),
                  })
                }
                min={0}
                max={trackDuration}
              />
            </div>
            <div>
              <Label>Duck Background Volume To</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[newOverlay.duckingVolume]}
                  onValueChange={([value]) =>
                    setNewOverlay({ ...newOverlay, duckingVolume: value })
                  }
                  max={100}
                  min={0}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm text-gray-600 w-16 text-right">
                  {newOverlay.duckingVolume}%
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddOverlayOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddOverlay}
                disabled={newOverlay.contentId === 0}
              >
                Add Overlay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

