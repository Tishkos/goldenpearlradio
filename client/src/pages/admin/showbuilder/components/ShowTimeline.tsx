import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ShowItem, ContentType } from "@/types/api-models";
import { Music, DollarSign, Newspaper, MessageSquare, Mic, Radio, Plus, Trash2, Volume2, Clock, Play, Pause, SkipBack, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

interface ShowTimelineProps {
  showItems: ShowItem[];
  onItemUpdate: (id: number, updates: Partial<ShowItem>) => void;
  onItemDelete: (id: number) => void;
  onItemAdd: () => void;
  contentData: {
    tracks: any[];
    advertisements: any[];
    news: any[];
    talks: any[];
    hostCommentaries: any[];
    advertisementHostAudios?: any[];
    newsHostAudios?: any[];
    products?: any[];
  };
}

interface TimelineItem extends ShowItem {
  content?: any;
  layer: number;
  calculatedStartTime: number;
  calculatedEndTime: number;
}

interface SortableTimelineItemProps {
  item: TimelineItem;
  isSelected: boolean;
  isPlaying: boolean;
  onClick: () => void;
  onDelete: () => void;
  onPreview: () => void;
  getItemColor: (type: ContentType) => string;
  getContentIcon: (type: ContentType) => React.ReactNode;
  formatTime: (seconds: number) => string;
  overlayItems?: TimelineItem[]; // Overlay items for this parent item
  getItemDisplayName: (item: TimelineItem, content: any) => string; // Function to get display name
}

const SortableTimelineItem: React.FC<SortableTimelineItemProps> = ({
  item,
  isSelected,
  isPlaying,
  onClick,
  onDelete,
  onPreview,
  getItemColor,
  getContentIcon,
  formatTime,
  overlayItems = [],
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id.toString() });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const width = (item.calculatedEndTime - item.calculatedStartTime) * PIXELS_PER_SECOND;
  const left = item.calculatedStartTime * PIXELS_PER_SECOND;
  const top = item.layer * LAYER_HEIGHT + 10;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${TIMELINE_HEIGHT}px`,
        zIndex: isSelected ? 10 : 1
      }}
      className={cn(
        "rounded-lg shadow-md transition-all border-2",
        getItemColor(item.contentType),
        isSelected ? "border-yellow-400 ring-2 ring-yellow-400" : "border-transparent",
        isPlaying ? "ring-2 ring-radio-cyan shadow-lg shadow-radio-cyan/20" : "",
        item.parentItemId && "opacity-80"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Drag Handle - Top bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-6 cursor-grab active:cursor-grabbing bg-black bg-opacity-20 hover:bg-opacity-30 flex items-center justify-between px-2 rounded-t-lg"
        {...attributes}
        {...listeners}
      >
        <div className="flex gap-0.5">
          <div className="w-1 h-1 bg-white rounded-full opacity-50"></div>
          <div className="w-1 h-1 bg-white rounded-full opacity-50"></div>
          <div className="w-1 h-1 bg-white rounded-full opacity-50"></div>
        </div>
        <div className="flex items-center gap-1">
          {/* Preview button */}
          <button
            className="pointer-events-auto hover:bg-white hover:bg-opacity-20 rounded p-0.5 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            title="Preview audio"
          >
            <Headphones className="h-3 w-3 text-white" />
          </button>
          {/* Delete button */}
          <button
            className="pointer-events-auto hover:bg-red-500 hover:bg-opacity-80 rounded p-0.5 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this item?')) {
                onDelete();
              }
            }}
            title="Delete item"
          >
            <Trash2 className="h-3 w-3 text-white" />
          </button>
        </div>
      </div>

      <div className="p-2 pt-7 h-full flex flex-col justify-between text-white text-xs overflow-hidden pointer-events-none">
        <div className="flex items-center gap-1">
          {getContentIcon(item.contentType)}
          <span className="font-semibold truncate">
            {getItemDisplayName(item, item.content)}
          </span>
          {overlayItems.length > 0 && (
            <Badge variant="secondary" className="text-xs py-0 ml-1 bg-radio-cyan/80 text-white">
              +{overlayItems.length} overlay{overlayItems.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="font-mono">{formatTime(item.calculatedStartTime)}</span>
            </div>
            <span className="text-white/70">→</span>
            <div className="flex items-center gap-1">
              <span className="font-mono">{formatTime(item.calculatedEndTime)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              <span>{item.volume}%</span>
            </div>
            {item.fadeInDuration > 0 && (
              <Badge variant="secondary" className="text-xs py-0">
                ↗{item.fadeInDuration}s
              </Badge>
            )}
            {item.fadeOutDuration > 0 && (
              <Badge variant="secondary" className="text-xs py-0">
                ↘{item.fadeOutDuration}s
              </Badge>
            )}
          </div>
          {/* Overlay information displayed within the block */}
          {overlayItems.length > 0 && (
            <div className="mt-1 pt-1 border-t border-white/20 space-y-0.5">
              {overlayItems.map((overlay) => {
                // Calculate overlay timing relative to parent
                // For explicit overlays (with parentItemId), use startTimeInParent
                // For implicit overlays (overlapping), calculate from calculatedStartTime
                const overlayStartTime = overlay.parentItemId && overlay.startTimeInParent !== null
                  ? overlay.startTimeInParent
                  : overlay.calculatedStartTime - item.calculatedStartTime;
                const overlayEndTime = overlay.calculatedEndTime - item.calculatedStartTime;
                const overlayDuration = overlayEndTime - overlayStartTime;
                const duckingVolume = overlay.duckingVolume ?? 50;
                return (
                  <div key={overlay.id} className="text-[10px] text-radio-cyan/80">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">Overlay:</span>
                      <span>{getItemDisplayName(overlay, overlay.content)}</span>
                      <span className="text-white/60">({overlay.contentType})</span>
                    </div>
                    <div className="text-white/80">
                      {formatTime(overlayStartTime)} → {formatTime(overlayEndTime)} ({formatTime(overlayDuration)})
                    </div>
                    <div className="text-white/80">
                      Main track ducks to {duckingVolume}% during overlay
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fade indicators */}
      {item.fadeInDuration > 0 && (
        <div
          className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-black/40 to-transparent pointer-events-none"
          style={{ width: `${Math.min(item.fadeInDuration * PIXELS_PER_SECOND, width / 2)}px` }}
        />
      )}
      {item.fadeOutDuration > 0 && (
        <div
          className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-black/40 to-transparent pointer-events-none"
          style={{ width: `${Math.min(item.fadeOutDuration * PIXELS_PER_SECOND, width / 2)}px` }}
        />
      )}

      {/* Visual indicator for overlay regions on the timeline */}
      {overlayItems.length > 0 && overlayItems.map((overlay) => {
        const overlayStart = overlay.calculatedStartTime - item.calculatedStartTime;
        const overlayEnd = overlay.calculatedEndTime - item.calculatedStartTime;
        const overlayLeft = overlayStart * PIXELS_PER_SECOND;
        const overlayWidth = (overlayEnd - overlayStart) * PIXELS_PER_SECOND;
        
        return (
          <div
            key={overlay.id}
            className="absolute top-0 bottom-0 bg-radio-cyan/30 border-l-2 border-r-2 border-radio-cyan/60 pointer-events-none"
            style={{
              left: `${overlayLeft}px`,
              width: `${overlayWidth}px`,
            }}
            title={`Overlay: ${getItemDisplayName(overlay, overlay.content)} (${formatTime(overlayStart)} - ${formatTime(overlayEnd)})`}
          />
        );
      })}
    </div>
  );
};

const PIXELS_PER_SECOND = 10;
const TIMELINE_HEIGHT = 80;
const LAYER_HEIGHT = 100;

export default function ShowTimeline({
  showItems,
  onItemUpdate,
  onItemDelete,
  onItemAdd,
  contentData
}: ShowTimelineProps) {
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Support multiple audio elements for simultaneous layer playback
  const activeAudiosRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const [playingItemIds, setPlayingItemIds] = useState<Set<number>>(new Set());
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Debounce timer for slider updates - one timer per item
  const updateTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  // Track pending updates per item
  const pendingUpdatesRef = useRef<Map<number, Partial<ShowItem>>>(new Map());
  
  // Debounced update function to prevent too many database calls
  const debouncedUpdate = useCallback((id: number, updates: Partial<ShowItem>) => {
    // Immediately update local state for responsive UI
    setTimelineItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
    
    // Merge with any pending updates for this item
    const currentPending = pendingUpdatesRef.current.get(id) || {};
    pendingUpdatesRef.current.set(id, { ...currentPending, ...updates });
    
    // Clear existing timer for this item
    const existingTimer = updateTimersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer for this item
    const timer = setTimeout(() => {
      const allUpdates = pendingUpdatesRef.current.get(id) || {};
      pendingUpdatesRef.current.delete(id);
      updateTimersRef.current.delete(id);
      
      // Convert numeric values to integers where needed
      const sanitizedUpdates: any = { ...allUpdates };
      
      // Ensure integer fields are actually integers
      if (sanitizedUpdates.volume !== undefined) {
        sanitizedUpdates.volume = Math.round(Number(sanitizedUpdates.volume));
      }
      if (sanitizedUpdates.fadeInDuration !== undefined) {
        sanitizedUpdates.fadeInDuration = Math.round(Number(sanitizedUpdates.fadeInDuration));
      }
      if (sanitizedUpdates.fadeOutDuration !== undefined) {
        sanitizedUpdates.fadeOutDuration = Math.round(Number(sanitizedUpdates.fadeOutDuration));
      }
      if (sanitizedUpdates.duckingVolume !== undefined) {
        sanitizedUpdates.duckingVolume = Math.round(Number(sanitizedUpdates.duckingVolume));
      }
      if (sanitizedUpdates.startTimeOffset !== undefined) {
        sanitizedUpdates.startTimeOffset = Math.round(Number(sanitizedUpdates.startTimeOffset));
      }
      if (sanitizedUpdates.playbackStartTime !== undefined) {
        sanitizedUpdates.playbackStartTime = Math.round(Number(sanitizedUpdates.playbackStartTime));
      }
      if (sanitizedUpdates.playbackEndTime !== undefined && sanitizedUpdates.playbackEndTime !== null) {
        sanitizedUpdates.playbackEndTime = Math.round(Number(sanitizedUpdates.playbackEndTime));
      }
      
      onItemUpdate(id, sanitizedUpdates);
    }, 500); // Wait 500ms after last change before updating
    
    updateTimersRef.current.set(id, timer);
  }, [onItemUpdate]);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      updateTimersRef.current.forEach(timer => clearTimeout(timer));
      updateTimersRef.current.clear();
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Reduced from 8 for more responsive dragging
      },
    })
  );

  const selectedItem = timelineItems.find(item => item.id === selectedItemId);

  // Calculate timeline layout
  useEffect(() => {
    const items: TimelineItem[] = [];
    const layers: Map<number, number> = new Map(); // track: last end time per layer

    // Sort items by position first, then by startTimeOffset for overlays
    const sortedItems = [...showItems].sort((a, b) => {
      // First sort by position (creation order)
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      // Then by startTimeOffset for items with same position
      return (a.startTimeOffset || 0) - (b.startTimeOffset || 0);
    });

    sortedItems.forEach((item) => {
      // Get content to calculate duration
      const content = getContentByType(item.contentType, item.contentId);
      const fullDuration = content?.duration || 180; // default 3 minutes
      
      // Calculate actual duration considering cropping/trimming
      const startTrim = item.playbackStartTime || 0;
      const endTrim = item.playbackEndTime || fullDuration;
      const duration = Math.max(1, endTrim - startTrim); // Ensure at least 1 second

      let startTime: number;
      let layer = 0;

      if (item.parentItemId) {
        // This is an overlay - find parent and position relative to it
        const parent = items.find(i => i.id === item.parentItemId);
        if (parent) {
          startTime = parent.calculatedStartTime + (item.startTimeInParent || 0);
          layer = parent.layer + 1;
        } else {
          // Parent not found, treat as overlay with explicit time
          startTime = item.startTimeOffset || 0;
          layer = 1;
        }
      } else {
        // Main track item - determine positioning based on mix mode
        if (item.mixMode === "overlay") {
          // Overlay mode: use explicit startTimeOffset
          startTime = item.startTimeOffset || 0;
          
          // Find available layer that doesn't conflict with existing items
          layer = 0;
          let attempts = 0;
          const maxAttempts = 10; // Prevent infinite loop
          
          while (attempts < maxAttempts) {
            const layerEndTime = layers.get(layer) || 0;
            const endTime = startTime + duration;
            
            // Check if this layer is free for our time range
            const hasConflict = items.some(existingItem => 
              existingItem.layer === layer &&
              !(endTime <= existingItem.calculatedStartTime || startTime >= existingItem.calculatedEndTime)
            );
            
            if (!hasConflict && startTime >= layerEndTime) {
              break; // Found a free layer
            }
            
            layer++;
            attempts++;
          }
        } else if (item.mixMode === "crossfade") {
          // Crossfade: overlap with previous item on main track
          const previousMainItem = items.filter(i => i.layer === 0).pop();
          if (previousMainItem) {
            const crossfadeDuration = Math.min(item.fadeInDuration || 3, previousMainItem.fadeOutDuration || 3, 10);
            startTime = Math.max(0, previousMainItem.calculatedEndTime - crossfadeDuration);
          } else {
            startTime = 0;
          }
          layer = 0;
        } else {
          // Sequential (default): start after previous item on main track (layer 0)
          const previousMainItem = items.filter(i => i.layer === 0).pop();
          if (previousMainItem) {
            startTime = previousMainItem.calculatedEndTime;
          } else {
            startTime = 0;
          }
          layer = 0;
        }
      }

      const endTime = startTime + duration;
      layers.set(layer, Math.max(layers.get(layer) || 0, endTime));

      items.push({
        ...item,
        content,
        layer,
        calculatedStartTime: startTime,
        calculatedEndTime: endTime,
      });
    });

    setTimelineItems(items);
  }, [showItems, contentData]);

  const getContentByType = (type: ContentType, id: number) => {
    const normalizedId = Number(id);
    let content;
    switch (type) {
      case "TRACK":
        content = contentData.tracks.find(t => Number(t.id) === normalizedId);
        break;
      case "ADVERTISEMENT": {
        // Product-backed advertisement entries should still keep their
        // identity even before audio is generated.
        const product = contentData.products?.find((p: any) => Number(p.id) === normalizedId);
        if (product) {
          content = {
            ...product,
            title: product.name || "Product Advertisement",
            duration: product.duration || 30,
          };
        } else {
          // Fall back to regular advertisement
          const advertisement = contentData.advertisements.find((a: any) => Number(a.id) === normalizedId);
          const linkedProduct = advertisement?.productId != null
            ? contentData.products?.find((p: any) => Number(p.id) === Number(advertisement.productId))
            : null;
          content = advertisement
            ? {
                ...advertisement,
                product: advertisement.product || linkedProduct || null,
                audioUrl: advertisement.audioUrl || linkedProduct?.audioUrl || null,
                duration: advertisement.duration || linkedProduct?.duration || null,
                title: advertisement.title || linkedProduct?.name || "Advertisement",
              }
            : null;
          // Merge with host-specific audio if available
          if (content && contentData.advertisementHostAudios) {
            const hostAudio = contentData.advertisementHostAudios.find(
              ha => Number(ha.advertisementId) === normalizedId
            );
            if (hostAudio) {
              content = { ...content, audioUrl: hostAudio.audioUrl, duration: hostAudio.duration };
            }
          }
        }
        break;
      }
      case "NEWS":
        content = contentData.news.find(n => Number(n.id) === normalizedId);
        // Merge with host-specific audio if available
        if (content && contentData.newsHostAudios) {
          const hostAudio = contentData.newsHostAudios.find(
            ha => Number(ha.newsId) === normalizedId
          );
          if (hostAudio) {
            content = { ...content, audioUrl: hostAudio.audioUrl, duration: hostAudio.duration };
          }
        }
        break;
      case "TALK":
        content = contentData.talks.find(t => Number(t.id) === normalizedId);
        break;
      case "HOST_COMMENTARY":
        content = contentData.hostCommentaries.find(h => Number(h.id) === normalizedId);
        break;
      default:
        content = null;
    }
    return content;
  };

  // Get display name for an item - checks if ADVERTISEMENT is a product first
  const getItemDisplayName = (item: ShowItem | TimelineItem, content: any): string => {
    if (item.contentType === "ADVERTISEMENT") {
      const normalizedId = Number(item.contentId);
      // Check if it's a product-backed advertisement first
      const product = contentData.products?.find((p: any) => Number(p.id) === normalizedId);
      if (product) {
        return product.name || "Unknown Product";
      }
      const linkedProductId = content?.productId ?? content?.product?.id ?? null;
      const linkedProduct = linkedProductId != null
        ? contentData.products?.find((p: any) => Number(p.id) === Number(linkedProductId))
        : null;
      // Fall back to regular advertisement
      if (content?.title) {
        return content.title;
      }
      if (linkedProduct?.name) {
        return linkedProduct.name;
      }
      if (content?.name) {
        return content.name;
      }
      return "Unknown Advertisement";
    }
    // For other content types, use the content title
    if (content && content.title) {
      return content.title;
    }
    return `Item ${item.id}`;
  };

  const getContentIcon = (type: ContentType) => {
    switch (type) {
      case "TRACK":
        return <Music className="h-4 w-4" />;
      case "ADVERTISEMENT":
        return <DollarSign className="h-4 w-4" />;
      case "NEWS":
        return <Newspaper className="h-4 w-4" />;
      case "TALK":
        return <MessageSquare className="h-4 w-4" />;
      case "HOST_COMMENTARY":
        return <Mic className="h-4 w-4" />;
      default:
        return <Radio className="h-4 w-4" />;
    }
  };

  const getItemColor = (type: ContentType) => {
    switch (type) {
      case "TRACK":
        return "bg-blue-500";
      case "ADVERTISEMENT":
        return "bg-radio-cyan";
      case "NEWS":
        return "bg-red-500";
      case "TALK":
        return "bg-purple-500";
      case "HOST_COMMENTARY":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const itemId = parseInt(event.active.id as string);
    setSelectedItemId(itemId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveId(null);

    if (!timelineRef.current) return;

    const itemId = parseInt(active.id as string);
    const item = timelineItems.find(i => i.id === itemId);
    if (!item) return;

    // Calculate new position based on drag delta in timeline coordinates
    const timeChange = delta.x / PIXELS_PER_SECOND;
    const layerChange = Math.round(delta.y / LAYER_HEIGHT);

    const newStartTime = Math.max(0, Math.round(item.calculatedStartTime + timeChange));
    const targetLayer = Math.max(0, item.layer + layerChange);

    // Key insight: We need to store BOTH the explicit time and a layer indicator
    // The layer determines the visual position, startTimeOffset determines the actual time
    
    let mixMode: string;
    
    if (targetLayer > 0) {
      // Any item on layer 1+ is always an overlay at explicit time
      mixMode = "overlay";
    } else {
      // On main track (layer 0)
      if (newStartTime === 0) {
        // At the very beginning - check if there are other items
        const hasOtherItems = timelineItems.some(i => i.id !== itemId && i.layer === 0);
        mixMode = hasOtherItems ? "sequential" : "sequential";
      } else {
        // Explicit time on main track = overlay
        mixMode = "overlay";
      }
    }

    // CRITICAL: We need to update position to maintain order
    // Find what position this should be at based on time
    const itemsBefore = timelineItems.filter(i => 
      i.id !== itemId && 
      (i.calculatedStartTime < newStartTime || 
       (i.calculatedStartTime === newStartTime && i.position < item.position))
    ).length;

    // Update item with all necessary fields
    onItemUpdate(itemId, {
      startTimeOffset: newStartTime,
      mixMode: mixMode,
      parentItemId: null, // Clear parent when manually positioned
      position: itemsBefore // Update position in sequence
    });
  };  const maxTime = timelineItems.length > 0
    ? Math.max(...timelineItems.map(item => item.calculatedEndTime))
    : 300;

  const maxLayer = timelineItems.length > 0
    ? Math.max(...timelineItems.map(item => item.layer))
    : 0;

  const timelineWidth = maxTime * PIXELS_PER_SECOND;
  const timelineHeight = (maxLayer + 2) * LAYER_HEIGHT;

  // Real audio playback following the timeline
  useEffect(() => {
    if (!isPlaying) {
      // Stop all audio when paused
      activeAudiosRef.current.forEach(audio => audio.pause());
      activeAudiosRef.current.clear();
      setPlayingItemIds(new Set());
      return;
    }

    // Update every 100ms for smooth playhead movement
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + 0.1;
        if (next >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        
        // Find ALL items that should be playing at this time (across all layers)
        const activeItems = timelineItems.filter(item => 
          next >= item.calculatedStartTime && next < item.calculatedEndTime
        );

        const activeItemIds = new Set(activeItems.map(item => item.id));
        
        // Only update if active items changed
        let hasChanges = false;

        // Stop audio for items that are no longer active
        activeAudiosRef.current.forEach((audio, itemId) => {
          if (!activeItemIds.has(itemId)) {
            audio.pause();
            activeAudiosRef.current.delete(itemId);
            hasChanges = true;
          }
        });

        // Start or update audio for all active items
        activeItems.forEach(item => {
          // Get audio URL based on content type
          let audioUrl: string | null = null;
          
          if (item.content) {
            switch (item.contentType) {
              case 'TRACK':
                audioUrl = item.content.url;
                break;
              case 'TALK':
              case 'HOST_COMMENTARY':
                audioUrl = item.content.audioUrl;
                break;
              case 'ADVERTISEMENT':
              case 'NEWS':
                // These use separate audio tables, may need host-specific audio
                audioUrl = item.content.audioUrl;
                break;
            }
          }
          
          if (!audioUrl) {
            return;
          }

          if (!activeAudiosRef.current.has(item.id)) {
            hasChanges = true;
            
            // Start new audio for this item
            const audio = new Audio(audioUrl);
            audio.volume = item.volume / 100;
            
            // Calculate where to start in the audio, considering cropping
            const timeIntoItem = next - item.calculatedStartTime;
            const playbackStartTime = item.playbackStartTime || 0;
            const actualAudioTime = playbackStartTime + timeIntoItem;
            
            // Wait for audio to be ready before seeking and playing
            audio.addEventListener('loadedmetadata', () => {
              if (actualAudioTime >= 0 && actualAudioTime < audio.duration) {
                audio.currentTime = actualAudioTime;
              }
            });
            
            audio.play().catch(err => {
              console.error('Failed to play audio:', err);
            });
            
            activeAudiosRef.current.set(item.id, audio);
          } else {
            // Update existing audio volume (no state change needed)
            const audio = activeAudiosRef.current.get(item.id)!;
            audio.volume = item.volume / 100;
          }
        });

        // Only update state if something changed
        if (hasChanges) {
          setPlayingItemIds(activeItemIds);
        }

        return next;
      });
    }, 100); // Update 10 times per second for smooth playback

    return () => {
      clearInterval(interval);
      // Clean up all audio on unmount
      activeAudiosRef.current.forEach(audio => audio.pause());
    };
  }, [isPlaying, maxTime, timelineItems]); // Removed currentTime from dependencies

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      activeAudiosRef.current.forEach(audio => audio.pause());
    };
  }, []);

  if (showItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Content Yet</h4>
          <p className="text-gray-500">Add items to build your show timeline</p>
          <Button onClick={onItemAdd} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add First Item
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timeline View */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline Editor
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Current: {formatTime(currentTime)}</span>
                <span>•</span>
                <span>Total: {formatTime(maxTime)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (currentTime === 0 || currentTime >= maxTime) {
                    // Start from beginning
                    setCurrentTime(0);
                    setIsPlaying(false);
                    setTimeout(() => setIsPlaying(true), 50);
                  } else {
                    // Reset to beginning
                    activeAudiosRef.current.forEach(audio => audio.pause());
                    activeAudiosRef.current.clear();
                    setCurrentTime(0);
                    setPlayingItemIds(new Set());
                  }
                }}
                disabled={currentTime === 0 && !isPlaying}
                title="Reset to beginning"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPlaying(!isPlaying)}
                className={isPlaying ? "bg-radio-cyan/10 border-radio-cyan/50" : ""}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Reset all items to sequential mode on main track
                  showItems.forEach((item, index) => {
                    onItemUpdate(item.id, {
                      mixMode: "sequential",
                      startTimeOffset: 0,
                      parentItemId: null
                    });
                  });
                }}
                title="Reset all items to play sequentially"
              >
                Reset Layout
              </Button>
              <Button onClick={onItemAdd} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto border rounded-lg bg-gray-50">
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div
                ref={timelineRef}
                className="relative"
                style={{
                  width: `${Math.max(timelineWidth, 1000)}px`,
                  height: `${Math.max(timelineHeight, 300)}px`,
                  cursor: activeId ? 'grabbing' : 'default'
                }}
                onClick={(e) => {
                  if (activeId) return; // Don't set time while dragging
                  const rect = timelineRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = e.clientX - rect.left;
                    const clickedTime = Math.max(0, Math.min(maxTime, x / PIXELS_PER_SECOND));
                    
                    // Stop all currently playing audio
                    activeAudiosRef.current.forEach(audio => audio.pause());
                    activeAudiosRef.current.clear();
                    setPlayingItemIds(new Set());
                    
                    // Set the new time
                    setCurrentTime(clickedTime);
                  }
                }}
              >
                {/* Time markers */}
                <div className="absolute top-0 left-0 right-0 h-8 bg-white border-b flex items-center">
                  {Array.from({ length: Math.ceil(maxTime / 30) + 1 }).map((_, i) => {
                    const time = i * 30;
                    const isMajorMarker = i % 2 === 0; // Every 1 minute
                    return (
                      <div
                        key={i}
                        className="absolute text-xs text-gray-500 flex flex-col items-center"
                        style={{ left: `${time * PIXELS_PER_SECOND}px` }}
                      >
                        <div className={`border-l ${isMajorMarker ? 'border-gray-400 h-3' : 'border-gray-300 h-2'}`} />
                        <span className={`ml-1 ${isMajorMarker ? 'font-medium' : ''}`}>
                          {formatTime(time)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Layer labels */}
                <div className="absolute left-0 top-8 bottom-0 w-16 bg-white border-r">
                  {Array.from({ length: maxLayer + 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-b border-gray-200 flex items-center justify-center text-xs text-gray-500"
                      style={{
                        top: `${i * LAYER_HEIGHT}px`,
                        height: `${LAYER_HEIGHT}px`
                      }}
                    >
                      {i === 0 ? "Main" : `Layer ${i}`}
                    </div>
                  ))}
                </div>

                {/* Timeline items */}
                <div className="absolute left-16 top-8 right-0 bottom-0">
                  {/* Playhead */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                    style={{ left: `${currentTime * PIXELS_PER_SECOND}px` }}
                  >
                    <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                  </div>

                  <SortableContext items={timelineItems.filter(item => {
                    // Show items that are either:
                    // 1. Don't have a parentItemId (parent items)
                    // 2. Are not overlapping with any other item that should be the parent
                    if (item.parentItemId) return false; // Hide items with explicit parentItemId
                    
                    // For TRACK items, always show them
                    if (item.contentType === "TRACK") return true;
                    
                    // For other items, check if they overlap with a TRACK - if so, hide it (it will be shown as part of the TRACK)
                    const overlapsWithTrack = timelineItems.some(track => 
                      track.contentType === "TRACK" && 
                      track.id !== item.id &&
                      !track.parentItemId &&
                      // Check if item overlaps with track (starts during track and ends during or after track)
                      item.calculatedStartTime >= track.calculatedStartTime &&
                      item.calculatedStartTime < track.calculatedEndTime
                    );
                    
                    return !overlapsWithTrack; // Hide if it overlaps with a TRACK
                  }).map(item => item.id.toString())}>
                    {timelineItems
                      .filter(item => {
                        // Show items that are either:
                        // 1. Don't have a parentItemId (parent items)
                        // 2. Are TRACK items (always show)
                        // 3. Are not overlapping with any TRACK (standalone items)
                        if (item.parentItemId) return false; // Hide items with explicit parentItemId
                        
                        // Always show TRACK items
                        if (item.contentType === "TRACK") return true;
                        
                        // Check if this item overlaps with a TRACK - if so, hide it (it will be shown as part of the TRACK)
                        const overlapsWithTrack = timelineItems.some(track => 
                          track.contentType === "TRACK" && 
                          track.id !== item.id &&
                          !track.parentItemId &&
                          // Check if item overlaps with track (starts during track)
                          item.calculatedStartTime >= track.calculatedStartTime &&
                          item.calculatedStartTime < track.calculatedEndTime
                        );
                        
                        return !overlapsWithTrack; // Hide if it overlaps with a TRACK
                      })
                      .map((item) => {
                      // Get overlay items for this parent item - both explicit overlays (with parentItemId) and implicit overlays (overlapping in time)
                      const explicitOverlays = timelineItems.filter(overlay => overlay.parentItemId === item.id);
                      
                      // Also find items that overlap with this item in time (for TRACK items)
                      const implicitOverlays = item.contentType === "TRACK" 
                        ? timelineItems.filter(overlay => 
                            overlay.id !== item.id &&
                            !overlay.parentItemId && // Not already an explicit overlay
                            overlay.contentType !== "TRACK" && // Not another TRACK
                            // Check if overlay starts during this track
                            overlay.calculatedStartTime >= item.calculatedStartTime &&
                            overlay.calculatedStartTime < item.calculatedEndTime
                          )
                        : [];
                      
                      const itemOverlays = [...explicitOverlays, ...implicitOverlays];
                      
                      return (
                        <SortableTimelineItem
                        key={item.id}
                        item={item}
                        isSelected={selectedItemId === item.id}
                        isPlaying={playingItemIds.has(item.id)}
                        onClick={() => setSelectedItemId(item.id)}
                        onDelete={() => onItemDelete(item.id)}
                        overlayItems={itemOverlays}
                        onPreview={() => {
                          // Get audio URL for parent item
                          let parentAudioUrl: string | null = null;
                          
                          if (item.content) {
                            switch (item.contentType) {
                              case 'TRACK':
                                parentAudioUrl = item.content.url;
                                break;
                              case 'TALK':
                              case 'HOST_COMMENTARY':
                                parentAudioUrl = item.content.audioUrl;
                                break;
                              case 'ADVERTISEMENT':
                              case 'NEWS':
                                parentAudioUrl = item.content.audioUrl;
                                break;
                            }
                          }
                          
                          if (!parentAudioUrl) {
                            alert(`No audio URL available for this ${item.contentType} item.`);
                            return;
                          }

                          // Create parent audio element
                          const parentAudio = new Audio(parentAudioUrl);
                          parentAudio.volume = item.volume / 100;
                          
                          // Respect cropping when previewing
                          const playbackStart = item.playbackStartTime || 0;
                          parentAudio.addEventListener('loadedmetadata', () => {
                            if (playbackStart > 0 && playbackStart < parentAudio.duration) {
                              parentAudio.currentTime = playbackStart;
                            }
                            
                            // Stop at end trim if specified
                            if (item.playbackEndTime) {
                              const checkEnd = setInterval(() => {
                                if (parentAudio.currentTime >= item.playbackEndTime!) {
                                  parentAudio.pause();
                                  clearInterval(checkEnd);
                                }
                              }, 100);
                            }
                          });

                          // Handle overlay audio and ducking
                          const overlayAudios: HTMLAudioElement[] = [];
                          let duckingInterval: NodeJS.Timeout | null = null;

                          if (itemOverlays.length > 0) {
                            itemOverlays.forEach((overlay) => {
                              let overlayAudioUrl: string | null = null;
                              
                              if (overlay.content) {
                                switch (overlay.contentType) {
                                  case 'TALK':
                                  case 'HOST_COMMENTARY':
                                    overlayAudioUrl = overlay.content.audioUrl;
                                    break;
                                  case 'ADVERTISEMENT':
                                  case 'NEWS':
                                    overlayAudioUrl = overlay.content.audioUrl;
                                    break;
                                }
                              }

                              if (overlayAudioUrl) {
                                const overlayAudio = new Audio(overlayAudioUrl);
                                overlayAudio.volume = (overlay.volume || 100) / 100;
                                overlayAudios.push(overlayAudio);

                                // Calculate when overlay should start relative to parent
                                const overlayStartInParent = overlay.calculatedStartTime - item.calculatedStartTime;
                                
                                parentAudio.addEventListener('loadedmetadata', () => {
                                  overlayAudio.addEventListener('loadedmetadata', () => {
                                    // Start overlay at the right time
                                    const startOverlay = () => {
                                      const currentTime = parentAudio.currentTime;
                                      const overlayStartSeconds = overlayStartInParent;
                                      
                                      if (currentTime >= overlayStartSeconds && !overlayAudio.played.length) {
                                        overlayAudio.currentTime = 0;
                                        overlayAudio.play().catch(err => {
                                          console.error('Failed to play overlay audio:', err);
                                        });
                                      }
                                    };

                                    // Check periodically for overlay start time
                                    const checkOverlay = setInterval(() => {
                                      const currentTime = parentAudio.currentTime;
                                      const overlayStartSeconds = overlayStartInParent;
                                      const overlayEndSeconds = overlayStartSeconds + (overlay.calculatedEndTime - overlay.calculatedStartTime);
                                      
                                      if (currentTime >= overlayStartSeconds && currentTime < overlayEndSeconds) {
                                        if (overlayAudio.paused) {
                                          overlayAudio.currentTime = currentTime - overlayStartSeconds;
                                          overlayAudio.play().catch(err => {
                                            console.error('Failed to play overlay audio:', err);
                                          });
                                        }
                                      } else if (currentTime >= overlayEndSeconds) {
                                        overlayAudio.pause();
                                      }
                                    }, 100);
                                    
                                    // Cleanup on parent audio end
                                    parentAudio.addEventListener('ended', () => {
                                      clearInterval(checkOverlay);
                                      overlayAudio.pause();
                                    });
                                  });
                                });
                              }
                            });

                            // Handle ducking - reduce parent volume when overlay is active
                            duckingInterval = setInterval(() => {
                              const currentTime = parentAudio.currentTime;
                              let hasActiveOverlay = false;
                              
                              itemOverlays.forEach((overlay) => {
                                const overlayStartSeconds = overlay.calculatedStartTime - item.calculatedStartTime;
                                const overlayEndSeconds = overlayStartSeconds + (overlay.calculatedEndTime - overlay.calculatedStartTime);
                                
                                if (currentTime >= overlayStartSeconds && currentTime < overlayEndSeconds) {
                                  hasActiveOverlay = true;
                                  const duckingVolume = overlay.duckingVolume ?? 50;
                                  const targetVolume = (item.volume / 100) * (duckingVolume / 100);
                                  
                                  // Smooth ducking
                                  const currentVolume = parentAudio.volume;
                                  const volumeDiff = targetVolume - currentVolume;
                                  if (Math.abs(volumeDiff) > 0.02) {
                                    const step = Math.min(0.15, Math.abs(volumeDiff) * 0.5);
                                    parentAudio.volume = currentVolume + (volumeDiff > 0 ? step : -step);
                                  } else {
                                    parentAudio.volume = targetVolume;
                                  }
                                }
                              });
                              
                              // Restore full volume when no overlay is active
                              if (!hasActiveOverlay) {
                                const targetVolume = item.volume / 100;
                                const currentVolume = parentAudio.volume;
                                if (currentVolume < targetVolume - 0.02) {
                                  const step = 0.15;
                                  parentAudio.volume = Math.min(targetVolume, currentVolume + step);
                                } else {
                                  parentAudio.volume = targetVolume;
                                }
                              }
                            }, 100);
                          }
                          
                          // Play parent audio
                          parentAudio.play().catch(err => {
                            console.error('Failed to play audio:', err);
                            alert('Could not play audio. Make sure the audio file is accessible.');
                          });

                          // Cleanup function
                          const cleanup = () => {
                            parentAudio.pause();
                            overlayAudios.forEach(audio => audio.pause());
                            if (duckingInterval) clearInterval(duckingInterval);
                          };

                          parentAudio.addEventListener('ended', cleanup);
                          overlayAudios.forEach(audio => audio.addEventListener('ended', cleanup));
                        }}
                        getItemColor={getItemColor}
                        getContentIcon={getContentIcon}
                        formatTime={formatTime}
                      />
                      );
                    })}
                  </SortableContext>
                </div>
              </div>

              <DragOverlay>
                {activeId ? (
                  (() => {
                    const item = timelineItems.find(i => i.id.toString() === activeId);
                    if (!item) return null;
                    return (
                      <div
                        className={cn(
                          "rounded-lg shadow-lg border-2 opacity-80",
                          getItemColor(item.contentType)
                        )}
                        style={{
                          width: `${(item.calculatedEndTime - item.calculatedStartTime) * PIXELS_PER_SECOND}px`,
                          height: `${TIMELINE_HEIGHT}px`,
                        }}
                      >
                        <div className="p-2 h-full flex flex-col justify-between text-white text-xs overflow-hidden">
                          <div className="flex items-center gap-1">
                            {getContentIcon(item.contentType)}
                            <span className="font-semibold truncate">
                              {getItemDisplayName(item, item.content)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Timeline Controls Help */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
            <p className="font-semibold mb-2">Timeline Editor Controls:</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Click timeline</strong> to jump to that time position</li>
              <li>• <strong>Click items</strong> to select and edit their properties below</li>
              <li>• <strong>Drag the top bar (···) of items</strong> to move them in time (horizontal) or to different layers (vertical)</li>
              <li>• <strong>Headphones icon (🎧)</strong> previews just that item's audio (respects cropping)</li>
              <li>• <strong>Trash icon (🗑️)</strong> deletes the item after confirmation</li>
              <li>• <strong>Main track (Layer 0)</strong> plays items sequentially by default</li>
              <li>• <strong>Moving items up to Layer 1+</strong> automatically sets them as overlays at the dragged time</li>
              <li>• <strong>Items with explicit time offsets</strong> on main track become overlays at that time</li>
              <li>• <strong>Use Audio Cropping sliders</strong> to trim start/end of any audio clip</li>
            </ul>
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
              <p className="text-xs text-amber-800">
                <strong>💡 Multi-Layer Playback:</strong> The timeline plays ALL layers simultaneously! Main track + overlays = real radio show. 
                Green glow = currently playing. The system automatically finds free layers to avoid overlapping conflicts. 🎙️🎵
              </p>
            </div>
            <div className="mt-2 p-2 bg-radio-cyan/10 border border-radio-cyan/30 rounded">
              <p className="text-xs text-gray-800 dark:text-neutral-200">
                <strong>🎯 Pro Tip:</strong> Drag items vertically to create overlays (ads, news over music). 
                Drag horizontally to change when they start. Use Audio Cropping to cut intros/outros. Items snap to avoid conflicts!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Item Editor */}
      {selectedItem && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Edit: {getItemDisplayName(selectedItem, selectedItem.content)}
              </CardTitle>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onItemDelete(selectedItem.id);
                  setSelectedItemId(null);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mix Mode</Label>
                <Select
                  value={selectedItem.mixMode || "sequential"}
                  onValueChange={(value) => onItemUpdate(selectedItem.id, { mixMode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential (After Previous)</SelectItem>
                    <SelectItem value="overlay">Overlay (Play Over)</SelectItem>
                    <SelectItem value="crossfade">Crossfade (Blend)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Start Time Offset</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={selectedItem.startTimeOffset || 0}
                    onChange={(e) => onItemUpdate(selectedItem.id, { startTimeOffset: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                  <span className="text-sm text-gray-500">seconds</span>
                </div>
              </div>
            </div>

            <div>
              <Label>Volume: {selectedItem.volume}%</Label>
              <Slider
                value={[selectedItem.volume]}
                onValueChange={([value]) => debouncedUpdate(selectedItem.id, { volume: value })}
                max={100}
                min={0}
                step={5}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fade In: {selectedItem.fadeInDuration}s</Label>
                <Slider
                  value={[selectedItem.fadeInDuration]}
                  onValueChange={([value]) => debouncedUpdate(selectedItem.id, { fadeInDuration: value })}
                  max={10}
                  min={0}
                  step={0.5}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Fade Out: {selectedItem.fadeOutDuration}s</Label>
                <Slider
                  value={[selectedItem.fadeOutDuration]}
                  onValueChange={([value]) => debouncedUpdate(selectedItem.id, { fadeOutDuration: value })}
                  max={10}
                  min={0}
                  step={0.5}
                  className="mt-2"
                />
              </div>
            </div>

            {/* Audio Cropping/Trimming */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Audio Cropping (Trim Start/End)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start at: {selectedItem.playbackStartTime || 0}s</Label>
                  <Slider
                    value={[selectedItem.playbackStartTime || 0]}
                    onValueChange={([value]) => debouncedUpdate(selectedItem.id, { playbackStartTime: value })}
                    max={Math.min((selectedItem.content?.duration || 180) - 1, 180)}
                    min={0}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Skip first {selectedItem.playbackStartTime || 0}s of audio
                  </p>
                </div>

                <div>
                  <Label>
                    End at: {selectedItem.playbackEndTime || selectedItem.content?.duration || 180}s
                  </Label>
                  <Slider
                    value={[selectedItem.playbackEndTime || selectedItem.content?.duration || 180]}
                    onValueChange={([value]) => debouncedUpdate(selectedItem.id, { playbackEndTime: value })}
                    max={selectedItem.content?.duration || 180}
                    min={(selectedItem.playbackStartTime || 0) + 1}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Cut audio at {selectedItem.playbackEndTime || selectedItem.content?.duration || 180}s
                  </p>
                </div>
              </div>
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
                <strong>Effective Duration:</strong> {
                  (selectedItem.playbackEndTime || selectedItem.content?.duration || 180) - 
                  (selectedItem.playbackStartTime || 0)
                }s (original: {selectedItem.content?.duration || 180}s)
              </div>
            </div>

            {selectedItem.layer > 0 && (
              <div>
                <Label>Ducking Volume: {selectedItem.duckingVolume !== undefined && selectedItem.duckingVolume !== null ? selectedItem.duckingVolume : 50}%</Label>
                <Slider
                  value={[selectedItem.duckingVolume !== undefined && selectedItem.duckingVolume !== null ? selectedItem.duckingVolume : 50]}
                  onValueChange={([value]) => debouncedUpdate(selectedItem.id, { duckingVolume: value })}
                  max={100}
                  min={0}
                  step={5}
                  className="mt-2"
                />
                <p className="text-xs text-gray-600 mt-1">
                  How much to lower the underlying track volume
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Start Time:</span>
                <span className="ml-2 font-semibold">{formatTime(selectedItem.calculatedStartTime)}</span>
              </div>
              <div>
                <span className="text-gray-600">End Time:</span>
                <span className="ml-2 font-semibold">{formatTime(selectedItem.calculatedEndTime)}</span>
              </div>
              <div>
                <span className="text-gray-600">Duration:</span>
                <span className="ml-2 font-semibold">
                  {formatTime(selectedItem.calculatedEndTime - selectedItem.calculatedStartTime)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Layer:</span>
                <span className="ml-2 font-semibold">{selectedItem.layer === 0 ? "Main" : `Layer ${selectedItem.layer}`}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
