import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Music, DollarSign, Newspaper, Mic, MessageSquare, Play, Pause, ZoomIn, ZoomOut, Grid } from "lucide-react";
import type { ShowItem, ContentType } from "@/types/api-models";
import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TimelineEditor24hProps {
  showItems: ShowItem[];
  onItemUpdate: (id: number, updates: Partial<ShowItem>) => void;
  onItemDelete: (id: number) => void;
  onItemAdd: () => void;
  onOpenAddItemDialog?: () => void; // Callback to open ShowItemBuilder dialog
  contentData: {
    tracks: any[];
    advertisements: any[];
    news: any[];
    talks: any[];
    hostCommentaries: any[];
    products?: any[];
  };
  selectedDate: Date;
}

// Format time in seconds to HH:MM:SS or MM:SS
const formatTime = (seconds: number, showHours: boolean = false): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (showHours || hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Convert seconds to minutes
const secondsToMinutes = (seconds: number): number => {
  return Math.floor(seconds / 60);
};

// Convert minutes to seconds
const minutesToSeconds = (minutes: number): number => {
  return minutes * 60;
};

// Get current time of day in minutes (0-1440)
const getCurrentTimeOfDayInMinutes = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

// Get current time of day in seconds (0-86400)
const getCurrentTimeOfDay = (): number => {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
};

// Snap to grid (snap to nearest 5 minutes)
const snapToGridValue = (minutes: number, gridSize: number = 5): number => {
  return Math.round(minutes / gridSize) * gridSize;
};

// Smart snap: snap to nearby items if very close (within 3 minutes), otherwise snap to grid
const smartSnap = (
  newMinutes: number,
  allItems: ShowItem[],
  currentItemId: number,
  contentData: TimelineEditor24hProps['contentData'],
  threshold: number = 3, // 3 minutes threshold
  gridSize: number = 5 // 5 minute grid
): number => {
  const otherItems = allItems.filter(item => item.id !== currentItemId);
  
  // First snap to grid
  let snappedToGrid = snapToGridValue(newMinutes, gridSize);
  
  if (otherItems.length === 0) {
    return snappedToGrid;
  }

  // Check distance to other items (both start and end)
  let nearestDistance = Infinity;
  let nearestTime: number | null = null;

  otherItems.forEach(item => {
    const itemStartMinutes = secondsToMinutes(item.startTimeOffset || 0);
    const itemDurationMinutes = getContentDurationMinutes(item, contentData);
    const itemEndMinutes = itemStartMinutes + itemDurationMinutes;
    
    // Check distance to start
    const distanceToStart = Math.abs(newMinutes - itemStartMinutes);
    if (distanceToStart < nearestDistance) {
      nearestDistance = distanceToStart;
      nearestTime = itemStartMinutes;
    }
    
    // Check distance to end
    const distanceToEnd = Math.abs(newMinutes - itemEndMinutes);
    if (distanceToEnd < nearestDistance) {
      nearestDistance = distanceToEnd;
      nearestTime = itemEndMinutes;
    }
    
    // Also check snapped position
    const distanceToSnappedStart = Math.abs(snappedToGrid - itemStartMinutes);
    if (distanceToSnappedStart < nearestDistance) {
      nearestDistance = distanceToSnappedStart;
      nearestTime = itemStartMinutes;
    }
    
    const distanceToSnappedEnd = Math.abs(snappedToGrid - itemEndMinutes);
    if (distanceToSnappedEnd < nearestDistance) {
      nearestDistance = distanceToSnappedEnd;
      nearestTime = itemEndMinutes;
    }
  });

  // If very close to another item (within threshold), snap to it
  if (nearestTime !== null && nearestDistance <= threshold) {
    return nearestTime;
  }

  // Otherwise use grid snap
  return snappedToGrid;
};

// Get icon for content type
const getContentIcon = (contentType: ContentType) => {
  switch (contentType) {
    case 'TRACK':
      return <Music className="h-4 w-4" />;
    case 'ADVERTISEMENT':
      return <DollarSign className="h-4 w-4" />;
    case 'NEWS':
      return <Newspaper className="h-4 w-4" />;
    case 'TALK':
      return <Mic className="h-4 w-4" />;
    case 'HOST_COMMENTARY':
    case 'COMMENTARY':
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <Music className="h-4 w-4" />;
  }
};

// Get color for content type
const getContentColor = (contentType: ContentType, isPlaying: boolean = false, isDragging: boolean = false): string => {
  const baseColor = isPlaying ? 'ring-2 ring-[var(--gp-gold-bright)]/70 ring-offset-1 ring-offset-[rgba(4,10,20,0.98)]' : '';
  const dragColor = isDragging ? 'opacity-50' : '';
  switch (contentType) {
    case 'TRACK':
      return cn('bg-[linear-gradient(135deg,rgba(201,168,76,0.88),rgba(138,110,46,0.9))]', baseColor, dragColor);
    case 'ADVERTISEMENT':
      return cn('bg-[linear-gradient(135deg,rgba(245,158,11,0.88),rgba(180,83,9,0.9))]', baseColor, dragColor);
    case 'NEWS':
      return cn('bg-[linear-gradient(135deg,rgba(239,68,68,0.88),rgba(127,29,29,0.9))]', baseColor, dragColor);
    case 'TALK':
      return cn('bg-[linear-gradient(135deg,rgba(56,189,248,0.88),rgba(30,64,175,0.9))]', baseColor, dragColor);
    case 'HOST_COMMENTARY':
    case 'COMMENTARY':
      return cn('bg-[linear-gradient(135deg,rgba(168,85,247,0.88),rgba(88,28,135,0.9))]', baseColor, dragColor);
    default:
      return cn('bg-[linear-gradient(135deg,rgba(100,116,139,0.88),rgba(51,65,85,0.9))]', baseColor, dragColor);
  }
};

// Get content title
const getContentTitle = (
  item: ShowItem,
  contentData: TimelineEditor24hProps['contentData']
): string => {
  const contentId = Number(item.contentId);
  switch (item.contentType) {
    case 'TRACK':
      const track = contentData.tracks.find(t => Number(t.id) === contentId);
      if (track?.title && track?.artist) return `${track.title} - ${track.artist}`;
      return track?.title || 'Unknown Track';
    case 'ADVERTISEMENT':
      // Product-backed advertisement entries should still show product names
      // even when audio is generated later.
      const product = contentData.products?.find((p: any) => Number(p.id) === contentId);
      if (product) {
        return product.name || 'Unknown Product';
      }
      // Fall back to regular advertisement
      const ad = contentData.advertisements.find(a => Number(a.id) === contentId);
      const linkedProduct = ad?.productId != null
        ? contentData.products?.find((p: any) => Number(p.id) === Number(ad.productId))
        : null;
      return ad?.title || ad?.name || linkedProduct?.name || 'Unknown Ad';
    case 'NEWS':
      const news = contentData.news.find(n => Number(n.id) === contentId);
      return news?.title || news?.message?.slice(0, 42) || 'Unknown News';
    case 'TALK':
      const talk = contentData.talks.find(t => Number(t.id) === contentId);
      return talk?.title || talk?.speaker || 'Unknown Talk';
    case 'HOST_COMMENTARY':
    case 'COMMENTARY':
      const commentary = contentData.hostCommentaries.find(h => Number(h.id) === contentId);
      return commentary?.title || commentary?.script?.slice(0, 42) || 'Unknown Commentary';
    default:
      return 'Unknown Content';
  }
};

// Get content duration in seconds (for accurate width calculation)
const getContentDuration = (
  item: ShowItem,
  contentData: TimelineEditor24hProps['contentData']
): number => {
  switch (item.contentType) {
    case 'TRACK':
      const track = contentData.tracks.find(t => t.id === item.contentId);
      return track?.duration || 180; // default 3 minutes
    case 'ADVERTISEMENT':
      // Product-backed advertisement entries should still resolve duration
      // before audio is attached.
      const product = contentData.products?.find((p: any) => p.id === item.contentId);
      if (product) {
        return product.duration || 30;
      }
      // Otherwise it's a regular advertisement
      const ad = contentData.advertisements.find(a => a.id === item.contentId);
      if (ad?.duration) return ad.duration;
      if ((ad as any)?.productId) {
        const linkedProduct = contentData.products?.find((p: any) => Number(p.id) === Number((ad as any).productId));
        if (linkedProduct?.duration) return linkedProduct.duration;
      }
      return 30;
    case 'NEWS':
      const news = contentData.news.find(n => n.id === item.contentId);
      return news?.duration || 60;
    case 'TALK':
      const talk = contentData.talks.find(t => t.id === item.contentId);
      return talk?.duration || 300;
    case 'HOST_COMMENTARY':
    case 'COMMENTARY':
      const commentary = contentData.hostCommentaries.find(h => h.id === item.contentId);
      return commentary?.duration || 120;
    default:
      return 180;
  }
};

// Get content duration in minutes (for display)
const getContentDurationMinutes = (
  item: ShowItem,
  contentData: TimelineEditor24hProps['contentData']
): number => {
  return secondsToMinutes(getContentDuration(item, contentData));
};

// Constants
const MIN_ITEM_WIDTH = 60; // Minimum width in pixels regardless of zoom

// Timeline Item Component (Read-only)
interface TimelineItemProps {
  item: ShowItem;
  contentData: TimelineEditor24hProps['contentData'];
  pixelsPerMinute: number;
  isPlaying: boolean;
  currentTimeMinutes: number;
}

const TimelineItem: React.FC<TimelineItemProps> = ({
  item,
  contentData,
  pixelsPerMinute,
  isPlaying,
  currentTimeMinutes,
}) => {
  // Use seconds directly for precise positioning
  const startSeconds = item.startTimeOffset || 0;
  // Get duration in seconds (not minutes) for accurate width
  const durationSeconds = getContentDuration(item, contentData);
  const pixelsPerSecond = pixelsPerMinute / 60; // Convert to pixels per second
  const left = startSeconds * pixelsPerSecond;
  // Ensure minimum width even when zoomed out
  const calculatedWidth = durationSeconds * pixelsPerSecond;
  const width = Math.max(MIN_ITEM_WIDTH, calculatedWidth);
  const title = getContentTitle(item, contentData);
  
  // Check if this item is currently playing
  const currentTimeSeconds = currentTimeMinutes * 60;
  const itemEndSeconds = startSeconds + durationSeconds;
  const isCurrentlyPlaying = isPlaying && currentTimeSeconds >= startSeconds && currentTimeSeconds < itemEndSeconds;

  const style: React.CSSProperties = {
    left: `${left}px`,
    width: `${width}px`,
    position: 'absolute',
  };

  return (
    <div
      style={style}
      className={cn(
        "absolute rounded-[2px] shadow-md border border-[var(--gp-border-gold)]/55",
        getContentColor(item.contentType, isCurrentlyPlaying, false),
        "hover:shadow-lg"
      )}
    >
      <div className="p-2 text-[color:var(--gp-white)] h-full flex flex-col justify-between relative min-h-[50px]">
        <div className="mt-2 flex items-center gap-2 mb-1">
          {getContentIcon(item.contentType)}
          <span className="text-xs font-semibold truncate flex-1">{title}</span>
          {isCurrentlyPlaying && (
            <div className="animate-pulse">
              <Play className="h-3 w-3" />
            </div>
          )}
        </div>
        
        {/* Time display (read-only) */}
        <div className="flex items-center justify-between text-xs">
          <span>{formatTime(startSeconds, true)}</span>
          <span className="mx-1">→</span>
          <span>{formatTime(startSeconds + durationSeconds, true)}</span>
        </div>
      </div>
    </div>
  );
};

export default function TimelineEditor24h({
  showItems,
  onItemUpdate,
  onItemDelete,
  onItemAdd,
  onOpenAddItemDialog,
  availableShowItems = [],
  onAddFromBucket,
  contentData,
  selectedDate,
}: TimelineEditor24hProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentTimeOfDay());
  const [zoom, setZoom] = useState(1); // 1x = 2px/min, 2x = 4px/min, etc.
  const [snapToGrid, setSnapToGrid] = useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isTodayDate = isToday(selectedDate);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update current time every second
  useEffect(() => {
    if (isTodayDate && isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(getCurrentTimeOfDay());
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (isTodayDate) {
        setCurrentTime(getCurrentTimeOfDay());
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTodayDate, isPlaying]);

  // Calculate pixels per minute based on zoom
  const pixelsPerMinute = useMemo(() => {
    return Math.max(0.5, 2 * zoom); // Base: 2px/min, scales with zoom, minimum 0.5px/min
  }, [zoom]);

  // Convert to pixels per second for precise positioning
  const pixelsPerSecond = useMemo(() => {
    return pixelsPerMinute / 60;
  }, [pixelsPerMinute]);

  // Auto-scroll to current time when playing
  useEffect(() => {
    if (isTodayDate && isPlaying && timelineRef.current) {
      const currentTimePosition = currentTime * pixelsPerSecond; // Use seconds directly
      const containerWidth = timelineRef.current.clientWidth;
      const scrollLeft = currentTimePosition - containerWidth / 2;
      timelineRef.current.scrollLeft = Math.max(0, scrollLeft);
    }
  }, [currentTime, isPlaying, isTodayDate, pixelsPerSecond]);

  // 24-hour timeline (86400 seconds = 1440 minutes)
  const TOTAL_SECONDS = 24 * 60 * 60; // 86400 seconds
  const timelineWidth = TOTAL_SECONDS * pixelsPerSecond;
  const TIMELINE_HEIGHT = 100;

  // Sort items by start time and remove duplicates (by id)
  const sortedItems = useMemo(() => {
    const uniqueItems = showItems.filter((item, index, self) => 
      index === self.findIndex(i => i.id === item.id)
    );
    return uniqueItems.sort((a, b) => (a.startTimeOffset || 0) - (b.startTimeOffset || 0));
  }, [showItems]);

  // Find currently playing item (only in current hour)
  const currentlyPlayingItem = useMemo(() => {
    if (!isTodayDate || !isPlaying) return null;
    
    const currentTimeMinutes = getCurrentTimeOfDayInMinutes();
    const currentHour = Math.floor(currentTimeMinutes / 60);
    
    return showItems.find((item) => {
      const startMinutes = secondsToMinutes(item.startTimeOffset || 0);
      const itemHour = Math.floor(startMinutes / 60);
      const durationMinutes = getContentDurationMinutes(item, contentData);
      const endMinutes = startMinutes + durationMinutes;
      
      // Only play items in the current hour
      return itemHour === currentHour && 
             currentTimeMinutes >= startMinutes && 
             currentTimeMinutes < endMinutes;
    });
  }, [showItems, currentTime, isTodayDate, isPlaying, contentData]);

  // Generate hour markers (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const currentTimeMinutes = getCurrentTimeOfDayInMinutes();

  // Handle play/pause
  const handlePlayPause = () => {
    if (!isTodayDate) {
      alert('Playback is only available for today\'s timeline. Select today\'s date to play.');
      return;
    }
    setIsPlaying(!isPlaying);
  };

  // Removed drag handlers - timeline is read-only

  return (
    <Card className="gp-card">
      <CardHeader>
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2 font-gp-display text-[color:var(--gp-white)] text-xl">
              <Clock className="h-5 w-5 text-[var(--gp-gold-bright)]" />
              Timeline Editor - {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </CardTitle>
            {isTodayDate && (
              <div className="flex items-center gap-2">
                <div className="text-sm font-sans bg-[rgba(6,13,26,0.55)] border border-[var(--gp-border-gold)]/45 px-3 py-1 rounded-[2px] text-[color:var(--gp-white)]">
                  {formatTime(currentTime, true)}
                </div>
                <Button
                  variant={isPlaying ? "destructive" : "default"}
                  size="sm"
                  onClick={handlePlayPause}
                  className={cn(
                    "gap-2 font-sans text-sm font-semibold tracking-normal",
                    isPlaying
                      ? "bg-red-700 hover:bg-red-600 text-white"
                      : "bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)]"
                  )}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Play
                    </>
                  )}
                </Button>
              </div>
            )}
            {!isTodayDate && (
              <div className="text-sm text-[color:var(--gp-white)]/65 font-sans">
                {showItems.length === 0 ? 'No items scheduled for this date' : `${showItems.length} items scheduled`}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <ZoomOut 
                className="h-4 w-4 cursor-pointer text-[color:var(--gp-white)]/65 hover:text-[var(--gp-gold-bright)]"
                onClick={() => setZoom(Math.max(0.1, zoom - 0.5))}
              />
              <Slider
                value={[zoom]}
                onValueChange={([value]) => setZoom(value)}
                min={0.1}
                max={10}
                step={0.1}
                className="w-24"
              />
              <ZoomIn 
                className="h-4 w-4 cursor-pointer text-[color:var(--gp-white)]/65 hover:text-[var(--gp-gold-bright)]"
                onClick={() => setZoom(Math.min(10, zoom + 0.5))}
              />
              <span className="text-xs text-[color:var(--gp-white)]/65 w-12 font-sans">{Math.round(zoom * 100)}%</span>
            </div>

            {/* Grid Toggle */}
            <Button
              variant={snapToGrid ? "default" : "outline"}
              size="sm"
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={cn(
                "gap-2 font-sans text-sm font-semibold tracking-normal border-[var(--gp-border-gold)]",
                snapToGrid
                  ? "bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)]"
                  : "text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
              )}
            >
              <Grid className="h-4 w-4" />
              Grid
            </Button>

            {/* Timeline is view-only - items are managed in Show Items section below */}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Timeline (Read-only Overview) */}
          <div 
            ref={timelineRef}
            className="border border-[var(--gp-border-gold)]/40 rounded-[2px] overflow-x-auto overflow-y-auto bg-[rgba(6,13,26,0.5)] p-4"
            style={{ 
              maxHeight: '400px',
            }}
          >
            <div 
              className="relative"
              style={{ 
                width: `${Math.max(timelineWidth, 1200)}px`,
                height: `${TIMELINE_HEIGHT + 60}px`,
              }}
            >
              {/* Hour markers at top - visual guides only */}
              <div className="sticky top-0 z-30 bg-[rgba(4,10,20,0.98)] border-b border-[var(--gp-border-gold)]/35 pb-1 mb-2" style={{ height: '40px' }}>
                {hours.map((hour) => {
                  const position = hour * 3600 * pixelsPerSecond; // hour in seconds
                  return (
                    <div
                      key={hour}
                      className="absolute flex flex-col items-center"
                      style={{ left: `${position}px` }}
                    >
                      <div className="h-6 w-px bg-[var(--gp-border-gold)]/80" />
                      <span className="text-xs text-[color:var(--gp-white)] font-semibold mt-1 whitespace-nowrap font-sans">
                        {hour.toString().padStart(2, '0')}:00
                      </span>
                    </div>
                  );
                })}
                
                {/* 10-minute markers */}
                {hours.map((hour) => {
                  return Array.from({ length: 5 }, (_, i) => {
                    const minute = (i + 1) * 10; // 10, 20, 30, 40, 50
                    const position = (hour * 3600 + minute * 60) * pixelsPerSecond; // Convert to seconds
                    return (
                      <div
                        key={`${hour}-${minute}`}
                        className="absolute"
                        style={{ left: `${position}px` }}
                      >
                        <div className="h-3 w-px bg-[var(--gp-border-gold)]/30" />
                        <span className="text-xs text-[color:var(--gp-white)]/45 mt-1 whitespace-nowrap font-sans" style={{ marginLeft: '-10px' }}>
                          {minute}
                        </span>
                      </div>
                    );
                  });
                })}
              </div>

              {/* Current time indicator - red line */}
              {isTodayDate && (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-red-500 z-50 pointer-events-none shadow-lg"
                  style={{
                    left: `${currentTime * pixelsPerSecond}px`, // Use seconds directly
                  }}
                >
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap font-bold">
                    {formatTime(currentTime, true)}
                  </div>
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                </div>
              )}

              {/* Single timeline track - all items on one row */}
              <div className="relative mt-14 border border-[var(--gp-border-gold)]/40 rounded-[2px] bg-[rgba(3,9,18,0.95)]" style={{ height: `${TIMELINE_HEIGHT}px` }}>
                {/* Items (read-only) */}
                {sortedItems.map((item) => (
                  <TimelineItem
                    key={item.id}
                    item={item}
                    contentData={contentData}
                    pixelsPerMinute={pixelsPerMinute}
                    isPlaying={isPlaying}
                    currentTimeMinutes={currentTimeMinutes}
                  />
                ))}

                {/* Empty state */}
                {sortedItems.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[color:var(--gp-white)]/45">
                    <div className="text-center">
                      <p className="text-lg mb-2 font-gp-display">No timeline items for this date</p>
                      <p className="text-sm font-gp-serif">Add items using the "Add Item to Playlist" button in the Radio Playlist section above</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline Info */}
          <div className="text-sm text-[color:var(--gp-white)]/70 font-sans">
            <p>
              <strong>Total Items:</strong> {showItems.length} | 
              <strong> Currently Playing:</strong> {currentlyPlayingItem ? getContentTitle(currentlyPlayingItem, contentData) : 'None'} |
              <strong> Status:</strong> {isTodayDate ? (isPlaying ? 'Playing' : 'Paused') : 'Future Date'} |
              <strong> Zoom:</strong> {Math.round(zoom * 100)}% |
              <strong> Grid:</strong> {snapToGrid ? 'On' : 'Off'}
            </p>
            <p className="text-xs mt-1 text-[color:var(--gp-white)]/55">
              Timeline Overview: Visual representation of the playlist from 00:00:00 to 23:59:59. Items are managed in the Radio Playlist section above.
            </p>
          </div>
        </div>
      </CardContent>

      {/* Dialog to select item from Show Items bucket */}
      {onAddFromBucket && (
        <Dialog open={isSelectItemDialogOpen} onOpenChange={setIsSelectItemDialogOpen}>
          <DialogContent className="bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
            <DialogHeader>
              <DialogTitle className="font-gp-display text-2xl font-semibold text-[color:var(--gp-white)]">Add Item from Show Items</DialogTitle>
              <DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/80">
                Select an item from your Show Items bucket to add to the timeline
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {availableShowItems.length === 0 ? (
                <p className="text-center text-[color:var(--gp-white)]/55 py-4">No items available in Show Items bucket</p>
              ) : (() => {
                // Get unique items by contentType + contentId (show each song/content only once)
                const uniqueItems = new Map<string, ShowItem>();
                availableShowItems.forEach(item => {
                  const key = `${item.contentType}-${item.contentId}`;
                  if (!uniqueItems.has(key)) {
                    uniqueItems.set(key, item);
                  }
                });

                return Array.from(uniqueItems.values()).map((item) => {
                  const title = getContentTitle(item, contentData);
                  // Count how many times this exact item (by contentId + contentType) exists on timeline
                  const countOnTimeline = showItems.filter(
                    ti => ti.contentType === item.contentType && ti.contentId === item.contentId
                  ).length;
                  
                  return (
                    <div
                      key={`${item.contentType}-${item.contentId}`}
                      className={cn(
                        "p-3 border rounded-[2px] cursor-pointer hover:bg-white/5 transition-colors border-[var(--gp-border-gold)]/30",
                        countOnTimeline > 0 && "border-[var(--gp-gold)]/70 bg-[rgba(201,168,76,0.16)]"
                      )}
                      onClick={() => {
                        if (onAddFromBucket) {
                          onAddFromBucket(item.id, countOnTimeline > 0);
                          setIsSelectItemDialogOpen(false);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getContentIcon(item.contentType)}
                          <span className="font-medium font-sans">{title}</span>
                        </div>
                        {countOnTimeline > 0 ? (
                          <span className="text-xs text-[var(--gp-gold-bright)] font-medium">
                            Already on timeline ({countOnTimeline} {countOnTimeline === 1 ? 'time' : 'times'})
                          </span>
                        ) : (
                          <span className="text-xs text-[color:var(--gp-white)]/55">Click to add</span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSelectItemDialogOpen(false)} className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal">
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}


