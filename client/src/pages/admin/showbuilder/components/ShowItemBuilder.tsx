import { useState, useImperativeHandle, forwardRef, useMemo } from "react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Plus, Edit, Trash2, Settings, Music, DollarSign, Newspaper, MessageSquare, Mic, Radio, GripVertical, AlertTriangle, Search, Filter, ShoppingBag, CheckCircle, Sparkles, Loader2 } from "lucide-react";
import type { ShowItem, ContentType, Track, Advertisement, News, Talk, HostCommentary, Product } from "@/types/api-models";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import TrackTimelineEditor from "./TrackTimelineEditor";
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
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { scheduleRadioTimelineSyncBroadcast } from "@/lib/radio-timeline-sync";
// Note: ShowTimeline is rendered by parent component (RadioEditor), not here

interface ShowItemBuilderProps {
  showId: number | null;
  onItemAdded: () => void;
  selectedDate?: string; // Date key (yyyy-MM-dd) for filtering items by date
}

export interface ShowItemBuilderRef {
  openAddDialog: () => void;
}

type ShowItemWithContent = ShowItem & {
  content?: Track | Advertisement | News | Talk | HostCommentary;
};

type SelectedContent = {
  key: string;
  contentType: ContentType;
  contentId: number;
};

const ShowItemBuilder = forwardRef<ShowItemBuilderRef, ShowItemBuilderProps>(
  ({ showId, onItemAdded, selectedDate }, ref) => {
  const queryClient = useQueryClient();
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShowItemWithContent | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [timeSelectionMode, setTimeSelectionMode] = useState<"auto" | "manual">("auto");
  const [manualTime, setManualTime] = useState("00:00:00");
  const [selectedContents, setSelectedContents] = useState<SelectedContent[]>([]); // Multi-select with type-safe keys
  const [searchQuery, setSearchQuery] = useState(""); // Search bar
  const [contentFilter, setContentFilter] = useState<"all" | "tracks" | "comments" | "products">("all"); // Filter: tracks, comments, products
  const [overlayItems, setOverlayItems] = useState<Array<{
    id: string;
    contentType: "TALK" | "ADVERTISEMENT";
    contentId: number;
    title: string;
    duration: number;
    startTime: number;
    duckingVolume: number;
  }>>([]);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [itemFormData, setItemFormData] = useState({
    contentType: "TRACK" as ContentType,
    contentId: 0,
    position: 0,
    startTimeOffset: 0,
    mixMode: "sequential" as string,
    volume: 100,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    playbackStartTime: 0,
    playbackEndTime: null as number | null,
    // Overlay/interruption fields
    parentItemId: null as number | null,
    startTimeInParent: null as number | null,
    duckingVolume: null as number | null,
  });

  const makeSelectionKey = (contentType: ContentType, contentId: number) =>
    `${contentType}:${contentId}`;

  const isSelectedContent = (contentType: ContentType, contentId: number) =>
    selectedContents.some((s) => s.key === makeSelectionKey(contentType, contentId));

  const toggleSelectedContent = (contentType: ContentType, contentId: number, checked: boolean) => {
    const key = makeSelectionKey(contentType, contentId);
    if (checked) {
      setSelectedContents((prev) => {
        if (prev.some((p) => p.key === key)) return prev;
        return [...prev, { key, contentType, contentId }];
      });
      setItemFormData((prev) => ({ ...prev, contentType, contentId }));
      return;
    }

    setSelectedContents((prev) => prev.filter((p) => p.key !== key));
  };

  // Fetch show items - filtered by date if provided
  const { data: showItemsRaw = [] } = useQuery({
    queryKey: ['show-items', showId, selectedDate],
    queryFn: async () => {
      // Use timeline-items endpoint if showId is 0 or undefined
      if (!showId || showId === 0) {
        const params = selectedDate ? { date: selectedDate } : {};
        const data = await api.get<ShowItem[]>('/timeline-items', { params });
        return data || [];
      }
      const data = await api.get<ShowItem[]>(`/show-items?showId=${showId}`);
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // Allow duplicates - just remove duplicate IDs (same database record)
  const showItems = useMemo(() => {
    const seenIds = new Set<number>();
    
    return showItemsRaw.filter(item => {
      // Only remove duplicate IDs (same database record)
      if (seenIds.has(item.id)) {
        return false;
      }
      seenIds.add(item.id);
      return true;
    });
  }, [showItemsRaw]);

  // Fetch content based on type
  const { data: tracks = [] } = useQuery({
    queryKey: ['tracks'],
    queryFn: async () => {
      const data = await api.get<Track[]>('/tracks');
      return data || [];
    },
  });

  const { data: advertisements = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: async () => {
      const data = await api.get<Advertisement[]>('/advertisements');
      return (data || []).filter((a: any) => a.isActive);
    },
  });

  // Fetch products with audio for radio editor
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const data = await api.get<any[]>('/products');
      // Return all active products (for color coding, we need all products)
      return (data || []).filter((p: any) => p.isActive);
    },
  });

  const { data: news = [] } = useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      const data = await api.get<News[]>('/news');
      return data || [];
    },
  });

  const { data: talks = [] } = useQuery({
    queryKey: ['talks'],
    queryFn: async () => {
      const data = await api.get<Talk[]>('/talks');
      return data || [];
    },
  });

  const { data: hostCommentaries = [] } = useQuery({
    queryKey: ['host-commentaries'],
    queryFn: async () => {
      const data = await api.get<HostCommentary[]>('/host-commentaries');
      return data || [];
    },
  });

  const getAutoFillDuration = (contentType: ContentType, contentId: number): number => {
    if (contentType === "TRACK") {
      const track = tracks.find((t) => Number(t.id) === Number(contentId));
      return track?.duration || 180;
    }
    if (contentType === "TALK") {
      const talk = talks.find((t) => Number(t.id) === Number(contentId));
      return talk?.duration || 300;
    }
    if (contentType === "ADVERTISEMENT") {
      const product = products.find((p: any) => Number(p.id) === Number(contentId));
      if (product) return Number(product.duration) || 30;
      const ad = advertisements.find((a) => Number(a.id) === Number(contentId));
      return ad?.duration || 30;
    }
    return 180;
  };

  // Auto-fill full day:
  // 1) Schedule all unique tracks/talks/products once (non-repeating first pass)
  // 2) Continue cycling with repetition allowed until 23:59:59
  const autoFillMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate) {
        throw new Error("Date is required. Please select a date first.");
      }

      const DAY_SECONDS = 24 * 60 * 60;
      const basePool: Array<{ contentType: ContentType; contentId: number }> = [
        ...tracks.map((t) => ({ contentType: "TRACK" as ContentType, contentId: Number(t.id) })),
        ...talks.map((t) => ({ contentType: "TALK" as ContentType, contentId: Number(t.id) })),
        ...products.map((p: any) => ({ contentType: "ADVERTISEMENT" as ContentType, contentId: Number(p.id) })),
      ].filter((x) => Number.isFinite(x.contentId) && x.contentId > 0);

      if (basePool.length === 0) {
        throw new Error("No tracks, talks, or products available to auto fill.");
      }

      // Remove existing items on selected date before full-day auto-fill
      if (showItems.length > 0) {
        await Promise.all(showItems.map((item) => api.delete(`/timeline-items/${item.id}`)));
      }

      const planned: Array<{
        contentType: ContentType;
        contentId: number;
        position: number;
        startTimeOffset: number;
      }> = [];

      let currentTime = 0;
      let position = 0;

      // First pass: no repetition
      for (const item of basePool) {
        if (currentTime >= DAY_SECONDS) break;
        planned.push({
          contentType: item.contentType,
          contentId: item.contentId,
          position,
          startTimeOffset: currentTime,
        });
        position += 1;
        currentTime += getAutoFillDuration(item.contentType, item.contentId);
      }

      // Repeating pass until day is filled
      while (currentTime < DAY_SECONDS) {
        for (const item of basePool) {
          if (currentTime >= DAY_SECONDS) break;
          planned.push({
            contentType: item.contentType,
            contentId: item.contentId,
            position,
            startTimeOffset: currentTime,
          });
          position += 1;
          currentTime += getAutoFillDuration(item.contentType, item.contentId);
        }
      }

      const endpoint = (!showId || showId === 0) ? "/timeline-items" : "/show-items";
      const CHUNK_SIZE = 50;
      for (let i = 0; i < planned.length; i += CHUNK_SIZE) {
        const chunk = planned.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map((item) => {
            const payload: any = {
              contentType: item.contentType,
              contentId: item.contentId,
              position: item.position,
              startTimeOffset: item.startTimeOffset,
              mixMode: "sequential",
              volume: 100,
              fadeInDuration: 0,
              fadeOutDuration: 0,
              playbackStartTime: 0,
              playbackEndTime: null,
              date: selectedDate,
            };
            if (showId && showId !== 0) payload.showId = showId;
            return api.post(endpoint, payload);
          })
        );
      }

      return planned.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['show-items', showId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['show-items', 0, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['timeline-items', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['timeline-items'] });
      queryClient.invalidateQueries({ queryKey: ['shows-with-items'] });
      if (selectedDate) {
        scheduleRadioTimelineSyncBroadcast(selectedDate, "radio-editor:auto-fill");
      }
      toast.success(`Auto fill completed: ${count} items scheduled for the full day.`);
      setIsAddItemDialogOpen(false);
      setEditingItem(null);
      setSelectedContents([]);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to auto fill the day.");
    },
  });

  // Create show item mutation
  const createItemMutation = useMutation({
    mutationFn: async () => {
      // If multi-select is active, create items for all selected content entries
      if (selectedContents.length > 0) {
        const nextPosition =
          showItems.length > 0 ? Math.max(...showItems.map(i => i.position)) + 1 : 0;

        // Calculate startTimeOffset based on selection mode
        let baseStartTimeOffset = itemFormData.startTimeOffset;
        if (timeSelectionMode === "manual") {
          baseStartTimeOffset = parseTimeString(manualTime);
          // Validate time is within day bounds
          const endOfDay = 23 * 3600 + 59 * 60 + 59;
          if (baseStartTimeOffset > endOfDay) {
            throw new Error("Time cannot exceed 23:59:59");
          }
        }

        // DATE IS REQUIRED - Each day must have its own independent schedule
        if (!selectedDate) {
          toast.error("Date is required. Please select a date first.");
          return;
        }

        let currentTime = baseStartTimeOffset;
        const promises = selectedContents.map((selected, index) => {
          const contentType = selected.contentType;
          const contentId = selected.contentId;

          const payload = {
            ...itemFormData,
            contentType,
            contentId,
            startTimeOffset: currentTime,
            position: nextPosition + index,
            date: selectedDate, // Date is required - each day has its own schedule
          };

          // Calculate next item's start time
          const content = getContentByType(contentType, contentId);
          const duration = content?.duration || 180;
          currentTime += duration;

          const endpoint = (!showId || showId === 0) ? '/timeline-items' : '/show-items';
          const finalPayload = (!showId || showId === 0) ? payload : { ...payload, showId };
          return api.post(endpoint, finalPayload);
        });

        return Promise.all(promises);
      }

      // DATE IS REQUIRED - Each day must have its own independent schedule
      if (!selectedDate) {
        toast.error("Date is required. Please select a date first.");
        return;
      }

      // Single item creation (original behavior - allow duplicates)
      const nextPosition =
        showItems.length > 0 ? Math.max(...showItems.map(i => i.position)) + 1 : 0;

      // Calculate startTimeOffset based on selection mode
      let finalStartTimeOffset = itemFormData.startTimeOffset;
      if (timeSelectionMode === "manual") {
        finalStartTimeOffset = parseTimeString(manualTime);
        // Validate time is within day bounds
        const endOfDay = 23 * 3600 + 59 * 60 + 59;
        if (finalStartTimeOffset > endOfDay) {
          throw new Error("Time cannot exceed 23:59:59");
        }
      }

      const payload = {
        ...itemFormData,
        startTimeOffset: finalStartTimeOffset,
        position: nextPosition,
        date: selectedDate, // Date is required - each day has its own schedule
      };

      // Use timeline-items endpoint if no showId, otherwise use show-items
      const endpoint = (!showId || showId === 0) ? '/timeline-items' : '/show-items';
      const finalPayload = (!showId || showId === 0) ? payload : { ...payload, showId };

      console.log('Creating timeline item:', { endpoint, payload: finalPayload });
      return api.post(endpoint, finalPayload);
    },
    onSuccess: () => {
      // Invalidate Show Items queries (bucket) - but NOT timeline items
      queryClient.invalidateQueries({ queryKey: ['show-items', showId] });
      queryClient.invalidateQueries({ queryKey: ['show-items', 0] });
      queryClient.invalidateQueries({ queryKey: ['show-items', 0, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['timeline-items', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['shows-with-items'] });
      queryClient.invalidateQueries({ queryKey: ['shows'] });
      if (selectedDate) {
        scheduleRadioTimelineSyncBroadcast(selectedDate, "radio-editor:create-item");
      }
      
      if (selectedContents.length > 0) {
        toast.success(`${selectedContents.length} item(s) added to playlist`);
        setSelectedContents([]); // Clear selection
      } else {
        toast.success('Item added to playlist');
      }
      
      setIsAddItemDialogOpen(false);
      resetItemForm();
      onItemAdded(); // Trigger parent refresh
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to add item');
    },
  });

  // Note: Host audio generation used to be handled by Supabase Edge Functions.
  // Supabase is removed; for now we allow adding items without requiring generated host audio.
  const advertisementHostAudios: any[] = [];
  const newsHostAudios: any[] = [];

  // (Replaced) addShowItemMutation -> createItemMutation (API)

  // Update show item mutation
  const updateShowItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof itemFormData> }) => {
      // Filter out non-database fields that might cause issues
      const { layer, calculatedStartTime, calculatedEndTime, content, ...dbData } = data as any;
      
      console.log('Updating show item:', { id, data: dbData });
      
      // Use timeline-items endpoint if no showId, otherwise use show-items
      const endpoint = (!showId || showId === 0) ? `/timeline-items/${id}` : `/show-items/${id}`;
      await api.put(endpoint, dbData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['show-items', showId] });
      queryClient.invalidateQueries({ queryKey: ['timeline-items'] });
      queryClient.invalidateQueries({ queryKey: ['shows-with-items'] });
      if (selectedDate) {
        scheduleRadioTimelineSyncBroadcast(selectedDate, "radio-editor:update-builder-item");
      }
      setEditingItem(null);
      toast.success("Item updated successfully!");
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast.error("Failed to update item: " + error.message);
    },
  });

  // Parse time string (HH:MM:SS or HH:MM) to seconds
  const parseTimeString = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // HH:MM
      return parts[0] * 3600 + parts[1] * 60;
    }
    return 0;
  };

  // Format seconds to HH:MM:SS
  const formatTimeString = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle drag end - simple reordering: swap positions and recalculate times sequentially
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeId = parseInt(active.id as string);
    const overId = parseInt(over.id as string);

    // Get all items sorted by current timeline order.
    const sortedItems = [...sortedPlaylistItems];
    
    // Find indices in the sorted list
    const activeIndex = sortedItems.findIndex(item => item.id === activeId);
    const overIndex = sortedItems.findIndex(item => item.id === overId);

    if (activeIndex === -1 || overIndex === -1) return;

    // Simple reordering: move active item to over's position
    // Example: [1, 2, 3] -> drag 3 to 1 -> [3, 1, 2]
    const reorderedItems = [...sortedItems];
    const [removed] = reorderedItems.splice(activeIndex, 1);
    reorderedItems.splice(overIndex, 0, removed);

    // Recalculate startTimeOffset for all items sequentially from 0
    // This maintains the order and ensures times are correct
    let currentTime = 0;
    const updates: Array<{ id: number; startTimeOffset: number; position: number }> = [];
    
    reorderedItems.forEach((item, index) => {
      updates.push({
        id: item.id,
        startTimeOffset: currentTime,
        position: index, // Update position to match new order
      });
      
      // Move to next item's start time based on duration
      const content = getContentByType(item.contentType, item.contentId);
      const duration = content?.duration || 180;
      currentTime += duration;
    });

    // Optimistic update first for instant visual feedback.
    const optimisticItems = reorderedItems.map((item, index) => {
      const updated = updates[index];
      return { ...item, startTimeOffset: updated.startTimeOffset, position: updated.position };
    });

    queryClient.setQueryData<ShowItem[]>(['show-items', showId, selectedDate], optimisticItems);
    queryClient.setQueryData<ShowItem[]>(['timeline-items', selectedDate], optimisticItems);

    // Persist all updates.
    try {
      await Promise.all(
        updates.map(update => {
          const endpoint = (!showId || showId === 0) ? `/timeline-items/${update.id}` : `/show-items/${update.id}`;
          return api.put(endpoint, {
            startTimeOffset: update.startTimeOffset,
            position: update.position,
          });
        })
      );
      
      queryClient.invalidateQueries({ queryKey: ['show-items', showId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['timeline-items', selectedDate] });
      if (selectedDate) {
        scheduleRadioTimelineSyncBroadcast(selectedDate, "radio-editor:reorder-builder");
      }
      toast.success("Playlist order updated in real time.");
    } catch (error: any) {
      queryClient.invalidateQueries({ queryKey: ['show-items', showId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['timeline-items', selectedDate] });
      toast.error("Failed to reorder items: " + (error?.message || 'Unknown error'));
    }
  };

  // Delete show item mutation
  const deleteShowItemMutation = useMutation({
    mutationFn: async (id: number) => {
      // Use timeline-items endpoint if no showId, otherwise use show-items
      const endpoint = (!showId || showId === 0) ? `/timeline-items/${id}` : `/show-items/${id}`;
      await api.delete(endpoint);
    },
    onSuccess: () => {
      // Invalidate queries - include selectedDate for timeline-items
      queryClient.invalidateQueries({ queryKey: ['show-items', showId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['show-items', showId] });
      queryClient.invalidateQueries({ queryKey: ['timeline-items', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['timeline-items'] });
      queryClient.invalidateQueries({ queryKey: ['shows-with-items'] });
      if (selectedDate) {
        scheduleRadioTimelineSyncBroadcast(selectedDate, "radio-editor:delete-builder-item");
      }
      toast.success("Item deleted successfully!");
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast.error("Failed to delete item: " + (error?.message || 'Unknown error'));
    },
  });

    // Get current time of day in seconds (0-86400)
    const getCurrentTimeOfDay = (): number => {
      const now = new Date();
      return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    };

    // Get content duration helper
    const getContentDuration = (contentType: ContentType, contentId: number): number => {
      switch (contentType) {
        case 'TRACK':
          const track = tracks.find(t => t.id === contentId);
          return track?.duration || 180;
        case 'ADVERTISEMENT':
          // Product-backed advertisement entries should still resolve duration
          // even before audio has been attached.
          const product = products.find((p: any) => p.id === contentId);
          if (product) {
            return product.duration || 30;
          }
          // Otherwise it's a regular advertisement
          const ad = advertisements.find(a => a.id === contentId);
          return ad?.duration || 30;
        case 'NEWS':
          const newsItem = news.find(n => n.id === contentId);
          return newsItem?.duration || 60;
        case 'TALK':
          const talk = talks.find(t => t.id === contentId);
          return talk?.duration || 300;
        case 'HOST_COMMENTARY':
          const commentary = hostCommentaries.find(h => h.id === contentId);
          return commentary?.duration || 120;
        default:
          return 180;
      }
    };

    const resetItemForm = () => {
      // Calculate next position based on existing items
      const maxPosition = showItems.length > 0 ? Math.max(...showItems.map(item => item.position)) : -1;
      
      // Calculate startTimeOffset - add items sequentially starting from 00:00:00
      let newStartTimeOffset = 0; // Start from beginning of day (00:00:00)
      
      if (showItems.length > 0) {
        // Sort items by startTimeOffset to find the last item chronologically
        const sortedItems = [...showItems].sort((a, b) => (a.startTimeOffset || 0) - (b.startTimeOffset || 0));
        const lastItem = sortedItems[sortedItems.length - 1];
        
        // Get duration of last item
        const lastItemDuration = getContentDuration(lastItem.contentType, lastItem.contentId);
        const lastItemEndTime = (lastItem.startTimeOffset || 0) + lastItemDuration;
        
        // Start from the end of the last item
        newStartTimeOffset = lastItemEndTime;
        
        // Don't allow scheduling beyond 23:59:59 (end of day)
        const endOfDay = 23 * 3600 + 59 * 60 + 59; // 23:59:59 in seconds
        if (newStartTimeOffset > endOfDay) {
          newStartTimeOffset = endOfDay;
        }
      }
      
      // Reset time selection mode and manual time
      setTimeSelectionMode("auto");
      setManualTime(formatTimeString(newStartTimeOffset));
      setSelectedContents([]); // Clear multi-select
      
      setItemFormData({
        contentType: "TRACK",
        contentId: 0,
        position: maxPosition + 1,
        startTimeOffset: newStartTimeOffset, // Sequential from 00:00:00
        mixMode: "sequential",
        volume: 100,
        fadeInDuration: 0,
        fadeOutDuration: 0,
        playbackStartTime: 0,
        playbackEndTime: null,
        parentItemId: null,
        startTimeInParent: null,
        duckingVolume: null,
      });
    };

    // Expose method to open dialog from parent
    useImperativeHandle(ref, () => ({
      openAddDialog: () => {
        resetItemForm();
        setIsAddItemDialogOpen(true);
      },
    }));

  const getContentIcon = (type: ContentType) => {
    switch (type) {
      case "TRACK": return <Music className="h-4 w-4" />;
      case "ADVERTISEMENT": return <DollarSign className="h-4 w-4" />;
      case "NEWS": return <Newspaper className="h-4 w-4" />;
      case "TALK": return <MessageSquare className="h-4 w-4" />;
      case "HOST_COMMENTARY": return <Mic className="h-4 w-4" />;
      default: return <Radio className="h-4 w-4" />;
    }
  };

  // In the simplified architecture we don't filter ads/news by host anymore.
  // Just return the full active lists from the API.
  const getAvailableAdvertisements = () => {
    return advertisements;
  };

  const getAvailableNews = () => {
    return news;
  };

  const getContentByType = (type: ContentType, id: number) => {
    const normalizedId = Number(id);
    switch (type) {
      case "TRACK":
        return tracks.find(t => t.id === normalizedId);
      case "ADVERTISEMENT": {
        const product = products.find((p: any) => p.id === normalizedId);
        if (product) {
          return {
            ...product,
            title: product.name || "Product Advertisement",
            duration: product.duration || 30,
          };
        }
        const advertisement = advertisements.find(a => Number(a.id) === normalizedId);
        const linkedProduct = advertisement?.productId != null
          ? products.find((p: any) => Number(p.id) === Number(advertisement.productId))
          : null;
        return advertisement
          ? {
              ...advertisement,
              product: advertisement.product || linkedProduct || null,
              audioUrl: advertisement.audioUrl || linkedProduct?.audioUrl || null,
              duration: advertisement.duration || linkedProduct?.duration || null,
              title: advertisement.title || linkedProduct?.name || "Advertisement",
            }
          : null;
      }
      case "NEWS":
        return news.find(n => n.id === normalizedId);
      case "TALK":
        return talks.find(t => t.id === normalizedId);
      case "HOST_COMMENTARY":
      case "COMMENTARY":
        return hostCommentaries.find(h => h.id === normalizedId);
      default: return null;
    }
  };

  // Get human-friendly display name with robust fallbacks across all content types.
  const getItemDisplayName = (item: ShowItem, content: any): string => {
    if (item.contentType === "ADVERTISEMENT") {
      const product = products.find((p: any) => Number(p.id) === Number(item.contentId));
      if (product) {
        return product.name || "Unknown Product";
      }
      const linkedProductId = content?.productId ?? content?.product?.id ?? null;
      const linkedProduct = linkedProductId != null
        ? products.find((p: any) => Number(p.id) === Number(linkedProductId))
        : null;
      if (content?.name) return content.name;
      if (content?.title) return content.title;
      if (linkedProduct?.name) return linkedProduct.name;
      return "Unknown Advertisement";
    }

    if (item.contentType === "TRACK") {
      if (content?.title && content?.artist) return `${content.title} - ${content.artist}`;
      if (content?.title) return content.title;
      return "Unknown Track";
    }

    if (item.contentType === "TALK") {
      if (content?.title) return content.title;
      if (content?.speaker) return `Talk by ${content.speaker}`;
      return "Unknown Talk";
    }

    if (item.contentType === "NEWS") {
      if (content?.title) return content.title;
      if (content?.message) return content.message.slice(0, 42);
      return "Unknown News";
    }

    if (item.contentType === "HOST_COMMENTARY" || item.contentType === "COMMENTARY") {
      if (content?.title) return content.title;
      if (content?.script) return content.script.slice(0, 42);
      return "Host Commentary";
    }

    if (content?.title) return content.title;
    if (content?.name) return content.name;
    return `Item ${item.id}`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateTotalDuration = () => {
    if (showItems.length === 0) return 0;
    // Simple calculation: sum of all item durations (this is approximate)
    return showItems.reduce((total, item) => {
      // Get content duration or default
      const content = getContentByType(item.contentType, item.contentId);
      return total + (content?.duration || 180);
    }, 0);
  };

  const sortedPlaylistItems = useMemo(
    () => [...showItems].sort((a, b) =>
      (a.startTimeOffset || 0) - (b.startTimeOffset || 0) || (a.position || 0) - (b.position || 0)
    ),
    [showItems]
  );

  const handleEditItem = async (item: ShowItem) => {
    setEditingItem(item as ShowItemWithContent);
    setItemFormData({
      contentType: item.contentType,
      contentId: item.contentId,
      position: item.position,
      startTimeOffset: item.startTimeOffset || 0,
      mixMode: item.mixMode || "sequential",
      volume: item.volume,
      fadeInDuration: item.fadeInDuration,
      fadeOutDuration: item.fadeOutDuration,
      playbackStartTime: item.playbackStartTime,
      playbackEndTime: item.playbackEndTime,
      parentItemId: item.parentItemId || null,
      startTimeInParent: item.startTimeInParent || null,
      duckingVolume: item.duckingVolume !== undefined && item.duckingVolume !== null ? item.duckingVolume : null,
    });
    
    // Load overlay items (items that have this item as parent)
    if (item.contentType === "TRACK") {
      // Refresh showItems to get latest data
      await queryClient.invalidateQueries({ queryKey: ['show-items', showId, selectedDate] });
      await queryClient.invalidateQueries({ queryKey: ['timeline-items', selectedDate] });
      
      // Wait a bit for the query to refetch
      setTimeout(() => {
        const refreshedItems = queryClient.getQueryData<ShowItem[]>(['show-items', showId, selectedDate]) || 
                              queryClient.getQueryData<ShowItem[]>(['timeline-items', selectedDate]) || 
                              showItems;
        
        const overlays = refreshedItems
          .filter(overlay => overlay.parentItemId === item.id)
          .map(overlay => {
            let content: any = null;
            let title = "Unknown";
            let duration = 30;
            
            if (overlay.contentType === "TALK") {
              content = talks.find(t => t.id === overlay.contentId);
              title = content?.title || "Unknown";
              duration = content?.duration || 30;
            } else if (overlay.contentType === "ADVERTISEMENT") {
              // Check if it's a product with audio first
              const product = products.find((p: any) => p.id === overlay.contentId);
              if (product) {
                content = product;
                title = product.name || "Unknown";
                duration = product.duration || 30;
              } else {
                // Fall back to regular advertisement
                content = advertisements.find(a => a.id === overlay.contentId);
                title = content?.title || "Unknown";
                duration = content?.duration || 30;
              }
            }
            
            return {
              id: `overlay-${overlay.id}`,
              contentType: overlay.contentType === "TALK" ? "TALK" : "ADVERTISEMENT" as "TALK" | "ADVERTISEMENT",
              contentId: overlay.contentId,
              title: title,
              duration: duration,
              startTime: overlay.startTimeInParent || 0,
              duckingVolume: overlay.duckingVolume !== undefined && overlay.duckingVolume !== null ? overlay.duckingVolume : 50,
            };
          });
        setOverlayItems(overlays);
      }, 100);
    } else {
      setOverlayItems([]);
    }
  };

  if (false) { // Allow component to work without showId
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Radio className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Show</h3>
          <p className="text-gray-500">Choose a show to start building show items</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Note: Timeline Editor is rendered by parent component (RadioEditor) */}
      {/* This component only handles the item list and add/edit dialog */}
      
      <Card className="gp-card">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2 font-gp-display text-[color:var(--gp-white)] text-xl">
                <Settings className="h-5 w-5 text-[var(--gp-gold-bright)]" />
                Radio Playlist - Show Items ({showItems.length}) - Total Duration: {formatTime(calculateTotalDuration())}
              </CardTitle>
              <p className="text-sm text-[color:var(--gp-white)]/70 mt-1 font-gp-serif">
                Main playlist for {selectedDate ? format(new Date(selectedDate), "EEEE, MMMM d, yyyy") : "today"}. Items play sequentially from 00:00:00 to 23:59:59.
              </p>
            </div>
            <Button
              data-add-item-button
              onClick={() => {
                resetItemForm();
                setIsAddItemDialogOpen(true);
              }}
              className="gap-2 bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
            >
              <Plus className="h-4 w-4" />
              Add Item to Playlist
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showItems.length === 0 ? (
            <div className="text-center py-8">
              <Radio className="h-12 w-12 text-[color:var(--gp-gold)]/80 mx-auto mb-4" />
              <h3 className="text-lg font-gp-display text-[color:var(--gp-white)] mb-2">No Items Yet</h3>
              <p className="text-[color:var(--gp-white)]/65 mb-4 font-gp-serif">Start building your show by adding content items</p>
              <Button className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal" onClick={() => {
                resetItemForm();
                setIsAddItemDialogOpen(true);
              }}>
                Add First Item
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(event: DragStartEvent) => {
                setActiveId(event.active.id as string);
              }}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedPlaylistItems.map(item => item.id.toString())}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-6">
                  {Array.from({ length: 24 }, (_, hour) => {
                    // Filter items for this hour (items that start between hour:00:00 and hour:59:59)
                    const hourStartSeconds = hour * 3600;
                    const hourEndSeconds = (hour + 1) * 3600;
                    const hourItems = sortedPlaylistItems
                      .filter(item => {
                        const startTime = item.startTimeOffset || 0;
                        return startTime >= hourStartSeconds && startTime < hourEndSeconds;
                      })
                      .sort((a, b) => (a.startTimeOffset || 0) - (b.startTimeOffset || 0));

                    // Show all hours, even empty ones

                return (
                  <div key={hour} className="space-y-2">
                    {/* Hour Header */}
                    <div className={cn(
                      "flex items-center gap-3 px-2 py-2 rounded-[2px] border",
                      hourItems.length > 0 
                        ? "bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/40" 
                        : "bg-[rgba(6,13,26,0.35)] border-[var(--gp-border-gold)]/20 opacity-70"
                    )}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          "font-mono text-lg font-bold px-3 py-1",
                          hourItems.length > 0 
                            ? "bg-[var(--gp-gold)] text-[var(--gp-navy-deep)] border-[var(--gp-gold)]" 
                            : "bg-[rgba(6,13,26,0.55)] text-[color:var(--gp-white)]/70 border-[var(--gp-border-gold)]/35"
                        )}>
                          {hour.toString().padStart(2, '0')}:00 - {hour.toString().padStart(2, '0')}:59
                        </Badge>
                        <span className="text-sm text-[color:var(--gp-white)]/65 font-sans">
                          {hourItems.length} item{hourItems.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Items for this hour */}
                    {hourItems.length > 0 && (
                      <div className="space-y-2 pl-4">
                        {hourItems.map((item) => {
                          const content = getContentByType(item.contentType, item.contentId);
                          return (
                            <SortablePlaylistItem
                              key={item.id}
                              item={item}
                              content={content}
                              onEdit={handleEditItem}
                              onDelete={(id) => deleteShowItemMutation.mutate(id)}
                              isDeleting={deleteShowItemMutation.isPending}
                              getContentIcon={getContentIcon}
                              formatTime={formatTime}
                              products={products}
                              getItemDisplayName={getItemDisplayName}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeId ? (
                  <div className="opacity-50">
                    {sortedPlaylistItems
                      .filter(item => item.id.toString() === activeId)
                      .map(item => {
                        const content = getContentByType(item.contentType, item.contentId);
                        const startTime = item.startTimeOffset || 0;
                        const hours = Math.floor(startTime / 3600);
                        const minutes = Math.floor((startTime % 3600) / 60);
                        const seconds = Math.floor(startTime % 60);
                        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        const duration = content?.duration || 180;
                        const endTime = startTime + duration;
                        const endHours = Math.floor(endTime / 3600);
                        const endMinutes = Math.floor((endTime % 3600) / 60);
                        const endSeconds = Math.floor(endTime % 60);
                        const endTimeString = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:${endSeconds.toString().padStart(2, '0')}`;
                        
                        return (
                          <Card key={item.id} className="gp-card shadow-lg">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="font-mono bg-[rgba(201,168,76,0.2)] text-[var(--gp-gold-bright)] border-[var(--gp-border-gold)]/50">
                                  {timeString} {"->"} {endTimeString}
                                </Badge>
                                {getContentIcon(item.contentType)}
                                <span className="font-medium text-[color:var(--gp-white)]">
                                  {getItemDisplayName(item, content)}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Item Dialog */}
      <Dialog open={isAddItemDialogOpen || editingItem !== null} onOpenChange={(open) => {
        if (!open) {
          setIsAddItemDialogOpen(false);
          setEditingItem(null);
          setSelectedContents([]); // Clear multi-select
          setOverlayItems([]); // Clear overlay items
          resetItemForm();
        }
      }}>
        <DialogContent className="gp-admin-form-dialog gp-scrollbar sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
          <DialogHeader>
            <DialogTitle className="font-gp-display text-2xl md:text-3xl font-semibold text-[color:var(--gp-white)]">
              {editingItem ? "Edit Show Item" : "Add Show Item"}
            </DialogTitle>
            <DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/90 text-base leading-relaxed">
              {editingItem 
                ? (editingItem.contentType === "TRACK" 
                  ? "Edit track settings, add overlay items (talks/products), and configure volume ducking."
                  : "Edit item settings and fade transitions.")
                : "Select content to add to your show. Use the Timeline Editor to adjust timing, volume, and layering."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Timeline Editor for Editing Tracks */}
            {editingItem && editingItem.contentType === "TRACK" && (() => {
              const track = tracks.find(t => t.id === editingItem.contentId);
              if (!track) return null;
              
              return (
                <TrackTimelineEditor
                  track={track}
                  showItem={editingItem}
                  talks={talks}
                  products={products.filter((p: any) => p.audioUrl)}
                  onUpdate={(updates) => {
                    setItemFormData({ ...itemFormData, ...updates });
                    // Also update editingItem so the slider reflects changes immediately
                    if (editingItem) {
                      setEditingItem({ ...editingItem, ...updates } as ShowItemWithContent);
                    }
                  }}
                  onAddOverlay={async (overlay) => {
                    // Create a new show item as overlay
                    const newOverlayId = `temp-${Date.now()}`;
                    setOverlayItems([...overlayItems, { ...overlay, id: newOverlayId }]);
                    
                    // Create the overlay item in the database
                    try {
                      const payload = {
                        contentType: overlay.contentType,
                        contentId: overlay.contentId,
                        position: showItems.length,
                        startTimeOffset: (editingItem.startTimeOffset || 0) + overlay.startTime,
                        mixMode: "overlay",
                        volume: 100,
                        fadeInDuration: 0,
                        fadeOutDuration: 0,
                        parentItemId: editingItem.id,
                        startTimeInParent: overlay.startTime,
                        duckingVolume: overlay.duckingVolume,
                        date: selectedDate,
                      };
                      const endpoint = (!showId || showId === 0) ? '/timeline-items' : '/show-items';
                      const finalPayload = (!showId || showId === 0) ? payload : { ...payload, showId };
                      const result = await api.post(endpoint, finalPayload);
                      queryClient.invalidateQueries({ queryKey: ['timeline-items', selectedDate] });
                      queryClient.invalidateQueries({ queryKey: ['show-items', showId] });
                      queryClient.invalidateQueries({ queryKey: ['show-items', showId, selectedDate] });
                      
                      // Reload overlay items
                      setTimeout(() => {
                        const refreshedItems = queryClient.getQueryData<ShowItem[]>(['show-items', showId, selectedDate]) || 
                                              queryClient.getQueryData<ShowItem[]>(['timeline-items', selectedDate]) || 
                                              showItems;
                        
                        const overlays = refreshedItems
                          .filter(overlay => overlay.parentItemId === editingItem.id)
                          .map(overlay => {
                            let content: any = null;
                            let title = "Unknown";
                            let duration = 30;
                            
                            if (overlay.contentType === "TALK") {
                              content = talks.find(t => t.id === overlay.contentId);
                              title = content?.title || "Unknown";
                              duration = content?.duration || 30;
                            } else if (overlay.contentType === "ADVERTISEMENT") {
                              // Check if it's a product with audio first
                              const product = products.find((p: any) => p.id === overlay.contentId);
                              if (product) {
                                content = product;
                                title = product.name || "Unknown";
                                duration = product.duration || 30;
                              } else {
                                // Fall back to regular advertisement
                                content = advertisements.find(a => a.id === overlay.contentId);
                                title = content?.title || "Unknown";
                                duration = content?.duration || 30;
                              }
                            }
                            
                            return {
                              id: `overlay-${overlay.id}`,
                              contentType: overlay.contentType === "TALK" ? "TALK" : "ADVERTISEMENT" as "TALK" | "ADVERTISEMENT",
                              contentId: overlay.contentId,
                              title: title,
                              duration: duration,
                              startTime: overlay.startTimeInParent || 0,
                              duckingVolume: overlay.duckingVolume !== undefined && overlay.duckingVolume !== null ? overlay.duckingVolume : 50,
                            };
                          });
                        setOverlayItems(overlays);
                      }, 200);
                      
                      toast.success("Overlay item added");
                    } catch (error: any) {
                      toast.error("Failed to add overlay: " + (error?.message || 'Unknown error'));
                      setOverlayItems(overlayItems.filter(item => item.id !== newOverlayId));
                    }
                  }}
                  onRemoveOverlay={async (overlayId) => {
                    const overlay = overlayItems.find(item => item.id === overlayId);
                    if (!overlay) return;
                    
                    // Find the actual show item
                    const overlayItem = showItems.find(item => 
                      item.parentItemId === editingItem.id &&
                      item.contentId === overlay.contentId &&
                      item.startTimeInParent === overlay.startTime
                    );
                    
                    if (overlayItem) {
                      try {
                        const endpoint = (!showId || showId === 0) ? `/timeline-items/${overlayItem.id}` : `/show-items/${overlayItem.id}`;
                        await api.delete(endpoint);
                        queryClient.invalidateQueries({ queryKey: ['timeline-items', selectedDate] });
                        queryClient.invalidateQueries({ queryKey: ['show-items', showId] });
                        toast.success("Overlay item removed");
                      } catch (error: any) {
                        toast.error("Failed to remove overlay: " + (error?.message || 'Unknown error'));
                        return;
                      }
                    }
                    
                    setOverlayItems(overlayItems.filter(item => item.id !== overlayId));
                  }}
                  overlayItems={overlayItems}
                  onUpdateOverlay={async (overlayId, updates) => {
                    const overlay = overlayItems.find(item => item.id === overlayId);
                    if (!overlay) return;
                    
                    // Find the actual show item
                    const overlayItem = showItems.find(item => 
                      item.parentItemId === editingItem.id &&
                      item.contentId === overlay.contentId &&
                      item.startTimeInParent === overlay.startTime
                    );
                    
                    if (overlayItem) {
                      try {
                        const updateData: any = {};
                        if (updates.startTime !== undefined) {
                          updateData.startTimeInParent = updates.startTime;
                          updateData.startTimeOffset = (editingItem.startTimeOffset || 0) + updates.startTime;
                        }
                        if (updates.duckingVolume !== undefined) {
                          updateData.duckingVolume = updates.duckingVolume;
                        }
                        
                        const endpoint = (!showId || showId === 0) ? `/timeline-items/${overlayItem.id}` : `/show-items/${overlayItem.id}`;
                        await api.put(endpoint, updateData);
                        queryClient.invalidateQueries({ queryKey: ['timeline-items', selectedDate] });
                        queryClient.invalidateQueries({ queryKey: ['show-items', showId] });
                      } catch (error: any) {
                        toast.error("Failed to update overlay: " + (error?.message || 'Unknown error'));
                        return;
                      }
                    }
                    
                    setOverlayItems(overlayItems.map(item => 
                      item.id === overlayId ? { ...item, ...updates } : item
                    ));
                  }}
                />
              );
            })()}

            {/* Content Selection: Search + Filter + Multi-select - Only show when NOT editing */}
            {!editingItem && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div>
                <Label htmlFor="search">Search Content</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[color:var(--gp-white)]/45" />
                  <Input
                    id="search"
                    type="text"
                    placeholder="Search by title, artist, or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                  />
                </div>
              </div>

              {/* Filter Buttons (Tracks / Comments / Products) */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Filter className="h-4 w-4" />
                  Filter by Type
                </Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant={contentFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setContentFilter("all");
                      setSelectedContents([]);
                    }}
                    className={cn(
                      "font-sans text-sm font-semibold tracking-normal border-[var(--gp-border-gold)]",
                      contentFilter === "all"
                        ? "bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)]"
                        : "text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                    )}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant={contentFilter === "tracks" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setContentFilter("tracks");
                      setSelectedContents([]);
                    }}
                    className={cn(
                      "gap-2 font-sans text-sm font-semibold tracking-normal border-[var(--gp-border-gold)]",
                      contentFilter === "tracks"
                        ? "bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)]"
                        : "text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                    )}
                  >
                    <Music className="h-4 w-4" />
                    Tracks
                  </Button>
                  <Button
                    type="button"
                    variant={contentFilter === "comments" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setContentFilter("comments");
                      setSelectedContents([]);
                    }}
                    className={cn(
                      "gap-2 font-sans text-sm font-semibold tracking-normal border-[var(--gp-border-gold)]",
                      contentFilter === "comments"
                        ? "bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)]"
                        : "text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                    )}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Comments
                  </Button>
                  <Button
                    type="button"
                    variant={contentFilter === "products" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setContentFilter("products");
                      setSelectedContents([]);
                    }}
                    className={cn(
                      "gap-2 font-sans text-sm font-semibold tracking-normal border-[var(--gp-border-gold)]",
                      contentFilter === "products"
                        ? "bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)]"
                        : "text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                    )}
                  >
                    <DollarSign className="h-4 w-4" />
                    Products
                  </Button>
                </div>
              </div>

              {/* Content List (Multi-select enabled) */}
              <div>
                <Label htmlFor="content">Content (Multi-select enabled)</Label>
                <div className="border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)] rounded-[2px] p-3 max-h-[300px] overflow-y-auto gp-scrollbar space-y-2">
                  {/* Tracks */}
                  {(contentFilter === "all" || contentFilter === "tracks") && tracks
                    .filter(track => {
                      const q = searchQuery.toLowerCase();
                      if (!q) return true;
                      return (
                        track.title.toLowerCase().includes(q) ||
                        track.artist?.toLowerCase().includes(q)
                      );
                    })
                    .map((track) => {
                      const count = showItems.filter(item => 
                        item.contentType === "TRACK" && item.contentId === track.id
                      ).length;
                      const isSelected = isSelectedContent("TRACK", track.id);
                      return (
                        <div key={`track-${track.id}`} className="flex items-center space-x-2 p-2 hover:bg-white/5 rounded-[2px]">
                          <Checkbox
                            id={`content-track-${track.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                toggleSelectedContent("TRACK", track.id, true);
                              } else {
                                toggleSelectedContent("TRACK", track.id, false);
                              }
                            }}
                          />
                          <Label
                            htmlFor={`content-track-${track.id}`}
                            className="flex-1 cursor-pointer flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2">
                              <Music className="h-4 w-4 text-blue-500" />
                              {track.title} - {track.artist}
                            </span>
                            {count > 0 && (
                              <Badge variant="outline" className="ml-2 text-[var(--gp-gold-bright)] border-[var(--gp-border-gold)]/45 bg-[rgba(6,13,26,0.4)]">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Already exists ({count}x)
                              </Badge>
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  
                  {/* Comments (HOST_COMMENTARY and TALK) */}
                  {(contentFilter === "all" || contentFilter === "comments") && (
                    <>
                      {hostCommentaries
                        .filter(commentary => {
                          const matchesSearch = searchQuery === "" || 
                            commentary.title?.toLowerCase().includes(searchQuery.toLowerCase());
                          return matchesSearch;
                        })
                        .map((commentary) => {
                          const count = showItems.filter(item => 
                            item.contentType === "HOST_COMMENTARY" && item.contentId === commentary.id
                          ).length;
                          const isSelected = isSelectedContent("HOST_COMMENTARY", commentary.id);
                          return (
                            <div key={`commentary-${commentary.id}`} className="flex items-center space-x-2 p-2 hover:bg-white/5 rounded-[2px]">
                              <Checkbox
                                id={`content-commentary-${commentary.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    toggleSelectedContent("HOST_COMMENTARY", commentary.id, true);
                                  } else {
                                    toggleSelectedContent("HOST_COMMENTARY", commentary.id, false);
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`content-commentary-${commentary.id}`}
                                className="flex-1 cursor-pointer flex items-center justify-between"
                              >
                                <span className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-purple-500" />
                                  {commentary.title}
                                </span>
                                {count > 0 && (
                                  <Badge variant="outline" className="ml-2 text-[var(--gp-gold-bright)] border-[var(--gp-border-gold)]/45 bg-[rgba(6,13,26,0.4)]">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Already exists ({count}x)
                                  </Badge>
                                )}
                              </Label>
                            </div>
                          );
                        })}
                      {talks
                        .filter(talk => {
                          const matchesSearch = searchQuery === "" || 
                            talk.title?.toLowerCase().includes(searchQuery.toLowerCase());
                          return matchesSearch;
                        })
                        .map((talk) => {
                          const count = showItems.filter(item => 
                            item.contentType === "TALK" && item.contentId === talk.id
                          ).length;
                          const isSelected = isSelectedContent("TALK", talk.id);
                          return (
                            <div key={`talk-${talk.id}`} className="flex items-center space-x-2 p-2 hover:bg-white/5 rounded-[2px]">
                              <Checkbox
                                id={`content-talk-${talk.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    toggleSelectedContent("TALK", talk.id, true);
                                  } else {
                                    toggleSelectedContent("TALK", talk.id, false);
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`content-talk-${talk.id}`}
                                className="flex-1 cursor-pointer flex items-center justify-between"
                              >
                                <span className="flex items-center gap-2">
                                  <Mic className="h-4 w-4 text-radio-cyan" />
                                  {talk.title}
                                </span>
                                {count > 0 && (
                                  <Badge variant="outline" className="ml-2 text-[var(--gp-gold-bright)] border-[var(--gp-border-gold)]/45 bg-[rgba(6,13,26,0.4)]">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Already exists ({count}x)
                                  </Badge>
                                )}
                              </Label>
                            </div>
                          );
                        })}
                    </>
                  )}
                  
                  {/* Products (ADVERTISEMENT) - Regular Advertisements */}
                  {(contentFilter === "all" || contentFilter === "products") &&
                    getAvailableAdvertisements().length > 0 &&
                    getAvailableAdvertisements()
                      .filter(ad => {
                        const q = searchQuery.toLowerCase();
                        if (!q) return true;
                        return ad.title?.toLowerCase().includes(q);
                      })
                      .map((ad) => {
                        const count = showItems.filter(item => 
                          item.contentType === "ADVERTISEMENT" && item.contentId === ad.id
                        ).length;
                        const isSelected = isSelectedContent("ADVERTISEMENT", ad.id);
                        return (
                          <div key={`ad-${ad.id}`} className="flex items-center space-x-2 p-2 hover:bg-white/5 rounded-[2px]">
                            <Checkbox
                              id={`content-ad-${ad.id}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  toggleSelectedContent("ADVERTISEMENT", ad.id, true);
                                } else {
                                  toggleSelectedContent("ADVERTISEMENT", ad.id, false);
                                }
                              }}
                            />
                            <Label
                              htmlFor={`content-ad-${ad.id}`}
                              className="flex-1 cursor-pointer flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-yellow-500" />
                                {ad.title} ({ad.duration}s)
                              </span>
                              {count > 0 && (
                                <Badge variant="outline" className="ml-2 text-[var(--gp-gold-bright)] border-[var(--gp-border-gold)]/45 bg-[rgba(6,13,26,0.4)]">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Already exists ({count}x)
                                </Badge>
                              )}
                            </Label>
                          </div>
                        );
                      })}
                  
                  {/* Products with Audio - Playable Products */}
                  {(contentFilter === "all" || contentFilter === "products") &&
                    products.length > 0 &&
                    products
                      .filter(product => {
                        const q = searchQuery.toLowerCase();
                        if (!q) return true;
                        return product.name?.toLowerCase().includes(q) || 
                               product.description?.toLowerCase().includes(q);
                      })
                      .map((product) => {
                        const count = showItems.filter(item => 
                          item.contentType === "ADVERTISEMENT" && item.contentId === product.id
                        ).length;
                        const isSelected = isSelectedContent("ADVERTISEMENT", product.id);
                        return (
                          <div key={`product-${product.id}`} className="flex items-center space-x-2 p-2 hover:bg-white/5 rounded-[2px] border-l-2 border-[var(--gp-gold)]">
                            <Checkbox
                              id={`content-product-${product.id}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  toggleSelectedContent("ADVERTISEMENT", product.id, true);
                                } else {
                                  toggleSelectedContent("ADVERTISEMENT", product.id, false);
                                }
                              }}
                            />
                            <Label
                              htmlFor={`content-product-${product.id}`}
                              className="flex-1 cursor-pointer flex items-center justify-between"
                            >
                              <span className="flex items-center gap-2">
                                <ShoppingBag className="h-4 w-4 text-radio-cyan" />
                                <span className="font-medium text-[color:var(--gp-white)]">{product.name}</span>
                                {product.audioUrl && (
                                  <Badge variant="outline" className="ml-1 text-radio-cyan border-radio-cyan/50 bg-radio-cyan/10 text-xs">
                                    🎵 Audio
                                  </Badge>
                                )}
                                <span className="text-[color:var(--gp-white)]/55 text-xs">
                                  ({product.duration || 30}s)
                                </span>
                              </span>
                              {count > 0 && (
                                <Badge variant="outline" className="ml-2 text-[var(--gp-gold-bright)] border-[var(--gp-border-gold)]/45 bg-[rgba(6,13,26,0.4)]">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Already exists ({count}x)
                                </Badge>
                              )}
                            </Label>
                          </div>
                        );
                      })}
                  
                  {/* Empty State */}
                  {((contentFilter === "all" || contentFilter === "tracks") && tracks.filter(t => 
                    searchQuery === "" || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0) &&
                  ((contentFilter === "all" || contentFilter === "comments") && hostCommentaries.filter(c => 
                    searchQuery === "" || c.title?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 && talks.filter(t => 
                    searchQuery === "" || t.title?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0) &&
                  ((contentFilter === "all" || contentFilter === "products") && getAvailableAdvertisements().filter(a => 
                    searchQuery === "" || a.title?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0) && (
                    <div className="text-center py-8 text-[color:var(--gp-white)]/55">
                      <p>No content found matching your search and filter criteria.</p>
                    </div>
                  )}
                </div>
                {selectedContents.length > 0 && (
                  <p className="text-sm text-[var(--gp-gold-bright)] mt-2 font-sans">
                    {selectedContents.length} item(s) selected
                  </p>
                )}
              </div>
            </div>
            )}

            {/* Time Selection */}
            {!editingItem && (
              <div className="space-y-3">
                <Label>Start Time</Label>
                <div className="flex items-center gap-3">
                  <Select
                    value={timeSelectionMode}
                    onValueChange={(value: "auto" | "manual") => {
                      setTimeSelectionMode(value);
                      if (value === "auto") {
                        // Recalculate auto time
                        let newStartTimeOffset = 0;
                        if (showItems.length > 0) {
                          const sortedItems = [...showItems].sort((a, b) => (a.startTimeOffset || 0) - (b.startTimeOffset || 0));
                          const lastItem = sortedItems[sortedItems.length - 1];
                          const lastItemDuration = getContentDuration(lastItem.contentType, lastItem.contentId);
                          newStartTimeOffset = (lastItem.startTimeOffset || 0) + lastItemDuration;
                        }
                        setManualTime(formatTimeString(newStartTimeOffset));
                        setItemFormData({ ...itemFormData, startTimeOffset: newStartTimeOffset });
                      }
                    }}
                  >
                  <SelectTrigger className="w-32 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {timeSelectionMode === "manual" && (
                    <Input
                      type="time"
                      step="1"
                      value={manualTime}
                      onChange={(e) => {
                        const time = e.target.value;
                        setManualTime(time);
                        const seconds = parseTimeString(time);
                        setItemFormData({ ...itemFormData, startTimeOffset: seconds });
                      }}
                      className="w-40 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base"
                    />
                  )}
                  
                  {timeSelectionMode === "auto" && (
                    <span className="text-sm text-[color:var(--gp-white)]/72 font-sans">
                      Will start at: {formatTimeString(itemFormData.startTimeOffset)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* News Host Audio Management */}
            {itemFormData.contentType === "NEWS" && itemFormData.contentId > 0 && (
              <div className="p-4 bg-[rgba(6,13,26,0.45)] rounded-[2px] border border-[var(--gp-border-gold)]/35">
                <h4 className="font-medium text-[color:var(--gp-white)] mb-3 flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Host News Audio
                </h4>
                <p className="text-sm text-[var(--gp-gold-bright)] flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[var(--gp-gold-bright)] flex-shrink-0" />
                  <span>Host audio is available for this news item. Audio will be automatically selected when the item is added.</span>
                </p>
              </div>
            )}

            {/* Advertisement Host Audio Management */}
            {itemFormData.contentType === "ADVERTISEMENT" && itemFormData.contentId > 0 && (
              <div className="p-4 bg-[rgba(6,13,26,0.45)] rounded-[2px] border border-[var(--gp-border-gold)]/35">
                <h4 className="font-medium text-[color:var(--gp-white)] mb-3 flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Host Advertisement Audio
                </h4>
                <p className="text-sm text-[var(--gp-gold-bright)] flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[var(--gp-gold-bright)] flex-shrink-0" />
                  <span>Host audio is available for this advertisement. Audio will be automatically selected when the item is added.</span>
                </p>
              </div>
            )}

            {/* Fade In/Out Controls - Always show */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-4 w-4 text-purple-500" />
                <Label className="text-base font-semibold">Fade Transitions</Label>
              </div>
              <p className="text-sm text-[color:var(--gp-white)]/72 mb-4">
                Configure smooth fade transitions between voices, tracks, and products for professional audio mixing.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fade-in" className="text-sm font-medium">
                      Fade In Duration
                    </Label>
                    <span className="text-sm text-[color:var(--gp-white)]/72">{itemFormData.fadeInDuration}s</span>
                  </div>
                  <Slider
                    id="fade-in"
                    value={[itemFormData.fadeInDuration]}
                    onValueChange={([value]) => setItemFormData({ ...itemFormData, fadeInDuration: value })}
                    max={10}
                    min={0}
                    step={0.5}
                    className="w-full"
                  />
                  <p className="text-xs text-[color:var(--gp-white)]/55">
                    How long the audio fades in at the start (0-10 seconds)
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fade-out" className="text-sm font-medium">
                      Fade Out Duration
                    </Label>
                    <span className="text-sm text-[color:var(--gp-white)]/72">{itemFormData.fadeOutDuration}s</span>
                  </div>
                  <Slider
                    id="fade-out"
                    value={[itemFormData.fadeOutDuration]}
                    onValueChange={([value]) => setItemFormData({ ...itemFormData, fadeOutDuration: value })}
                    max={10}
                    min={0}
                    step={0.5}
                    className="w-full"
                  />
                  <p className="text-xs text-[color:var(--gp-white)]/55">
                    How long the audio fades out at the end (0-10 seconds)
                  </p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItemFormData({ ...itemFormData, fadeInDuration: 2, fadeOutDuration: 2 })}
                  className="text-xs border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                >
                  Quick: 2s / 2s
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItemFormData({ ...itemFormData, fadeInDuration: 3, fadeOutDuration: 3 })}
                  className="text-xs border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                >
                  Quick: 3s / 3s
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItemFormData({ ...itemFormData, fadeInDuration: 5, fadeOutDuration: 5 })}
                  className="text-xs border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                >
                  Quick: 5s / 5s
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItemFormData({ ...itemFormData, fadeInDuration: 0, fadeOutDuration: 0 })}
                  className="text-xs border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                >
                  No Fade
                </Button>
              </div>
            </div>

            {/* Info box - Only show when adding (not editing) */}
            {!editingItem && (
            <div className="p-3 bg-[rgba(6,13,26,0.45)] border border-[var(--gp-border-gold)]/35 rounded-[2px] text-sm text-[color:var(--gp-white)]/75">
              <p className="font-semibold mb-1">Timeline Editor</p>
              <p className="text-xs">
                After adding this item, use the Timeline Editor below to adjust positioning, timing, volume, and layering.
              </p>
              <div className="mt-3 pt-3 border-t border-[var(--gp-border-gold)]/25">
                <Button
                  type="button"
                  onClick={() => autoFillMutation.mutate()}
                  disabled={autoFillMutation.isPending}
                  className="w-full bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
                >
                  {autoFillMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Auto Filling Full Day...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Auto Fill Full Day (Non-repeat first, then repeat)
                    </>
                  )}
                </Button>
              </div>
            </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddItemDialogOpen(false);
              setEditingItem(null);
              setOverlayItems([]);
              resetItemForm();
            }} className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingItem) {
                  updateShowItemMutation.mutate({ id: editingItem.id, data: itemFormData });
                } else {
                  // Validate form - check if multi-select has items or single selection
                  if (selectedContents.length === 0 && itemFormData.contentId === 0) {
                    toast.error("Please select at least one content item");
                    return;
                  }

                  // Add item(s) (PostgreSQL via API)
                  // Works with or without showId (showId can be 0 for timeline-items)
                  createItemMutation.mutate();
                }
              }}
              disabled={createItemMutation.isPending || updateShowItemMutation.isPending}
              className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
            >
              {editingItem ? "Update Item" : selectedContents.length > 0 ? `Add ${selectedContents.length} Item(s)` : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

ShowItemBuilder.displayName = 'ShowItemBuilder';

// Sortable Playlist Item Component
interface SortablePlaylistItemProps {
  item: ShowItem;
  content: any;
  onEdit: (item: ShowItem) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  getContentIcon: (type: ContentType) => React.ReactNode;
  getItemDisplayName: (item: ShowItem, content: any) => string;
  formatTime: (seconds: number) => string;
  products?: any[]; // Products list to check if ADVERTISEMENT is a product
}

function SortablePlaylistItem({
  item,
  content,
  onEdit,
  onDelete,
  isDeleting,
  getContentIcon,
  getItemDisplayName,
  formatTime,
  products = [],
}: SortablePlaylistItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Get background color based on content type
  const getBackgroundColor = () => {
    if (item.contentType === "TRACK") {
      return "bg-[linear-gradient(135deg,rgba(201,168,76,0.20),rgba(6,13,26,0.65))] border-[var(--gp-border-gold)]/60";
    } else if (item.contentType === "TALK") {
      return "bg-[linear-gradient(135deg,rgba(56,189,248,0.20),rgba(6,13,26,0.65))] border-[rgba(56,189,248,0.45)]";
    } else if (item.contentType === "ADVERTISEMENT") {
      // Check if it's a product by checking if contentId matches a product ID
      const isProduct = products.some((p: any) => p.id === item.contentId);
      if (isProduct) {
        return "bg-[linear-gradient(135deg,rgba(16,185,129,0.20),rgba(6,13,26,0.65))] border-[rgba(16,185,129,0.45)]";
      }
      // Also check if the advertisement itself has a productId
      const ad = content as Advertisement;
      if (ad?.productId) {
        return "bg-[linear-gradient(135deg,rgba(16,185,129,0.20),rgba(6,13,26,0.65))] border-[rgba(16,185,129,0.45)]";
      }
      return "bg-[linear-gradient(135deg,rgba(234,179,8,0.20),rgba(6,13,26,0.65))] border-[rgba(234,179,8,0.45)]";
    }
    return "bg-[linear-gradient(135deg,rgba(148,163,184,0.20),rgba(6,13,26,0.65))] border-[rgba(148,163,184,0.45)]";
  };

  const startTime = item.startTimeOffset || 0;
  const hours = Math.floor(startTime / 3600);
  const minutes = Math.floor((startTime % 3600) / 60);
  const seconds = Math.floor(startTime % 60);
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  const duration = content?.duration || 180;
  const endTime = startTime + duration;
  const endHours = Math.floor(endTime / 3600);
  const endMinutes = Math.floor((endTime % 3600) / 60);
  const endSeconds = Math.floor(endTime % 60);
  const endTimeString = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:${endSeconds.toString().padStart(2, '0')}`;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("hover:shadow-lg transition-shadow border-2 gp-card", getBackgroundColor(), isDragging && "shadow-xl ring-2 ring-[var(--gp-gold-bright)]/45")}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded text-[color:var(--gp-white)]/70"
            >
              <GripVertical className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono bg-[rgba(201,168,76,0.2)] text-[var(--gp-gold-bright)] border-[var(--gp-border-gold)]/50">
                {timeString} {"->"} {endTimeString}
              </Badge>
              <span className="text-[var(--gp-gold-bright)]">{getContentIcon(item.contentType)}</span>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-[color:var(--gp-white)]">
                {getItemDisplayName(item, content)}
              </h4>
              <div className="flex items-center gap-4 text-sm text-[color:var(--gp-white)]/75 mt-1">
                <Badge variant="outline" className="border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]/90 bg-[rgba(6,13,26,0.35)]">{item.contentType}</Badge>
                <span>Vol: {item.volume}%</span>
                {content?.duration && (
                  <span>Duration: {formatTime(content.duration)}</span>
                )}
                {item.fadeInDuration > 0 && <span>Fade In: {item.fadeInDuration}s</span>}
                {item.fadeOutDuration > 0 && <span>Fade Out: {item.fadeOutDuration}s</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(item)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(item.id)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ShowItemBuilder;

