import { useState, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Radio, Clock, Shuffle, Save, Download, CheckCircle, Trash2, Film } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getStoredIntroId,
  setStoredIntroId,
  INTRO_IDS,
  INTRO_LABELS,
  type IntroId,
} from "@/components/intros";
import { format, startOfDay, addDays, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";
import { scheduleRadioTimelineSyncBroadcast } from "@/lib/radio-timeline-sync";
import { api } from "@/lib/api-client";
import type { ShowItem, Track, Advertisement, Commentary, Talk, TimelinePreset } from "@/types/api-models";
import TimelineEditor24h from "./components/TimelineEditor24h";
import ShowItemBuilder, { ShowItemBuilderRef } from "./components/ShowItemBuilder";
import { toast } from "sonner";

export default function RadioEditor() {
  type ShuffleOptions = {
    mode: "within-hour" | "full-day";
    talkEveryTracks: number;
    productEveryTracks: number;
    maxTalkOccurrences: number;
    unlimitedProducts: boolean;
    maxProductOccurrences: number;
    genreMode: "mixed" | "grouped";
    genreFilter: string;
  };

  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [introDialogOpen, setIntroDialogOpen] = useState(false);
  const [shuffleDialogOpen, setShuffleDialogOpen] = useState(false);
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [loadPresetDialogOpen, setLoadPresetDialogOpen] = useState(false);
  const [clearTracksDialogOpen, setClearTracksDialogOpen] = useState(false);
  const [pendingPresetId, setPendingPresetId] = useState<number | null>(null);
  const [presetName, setPresetName] = useState("");
  const [selectedIntroId, setSelectedIntroId] = useState<IntroId | null>(() => getStoredIntroId());
  const [shuffleOptions, setShuffleOptions] = useState<ShuffleOptions>({
    mode: "within-hour",
    talkEveryTracks: 3,
    productEveryTracks: 4,
    maxTalkOccurrences: 2,
    unlimitedProducts: true,
    maxProductOccurrences: 99,
    genreMode: "mixed",
    genreFilter: "all",
  });
  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const showItemBuilderRef = useRef<ShowItemBuilderRef>(null);

  // Fetch timeline items for selected date
  const { data: timelineItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['timeline-items', dateKey],
    queryFn: async () => {
      const data = await api.get<ShowItem[]>('/timeline-items', {
        params: { date: dateKey },
      });
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // Fetch Show Items bucket for the selected date (items available to add to timeline)
  const { data: showItemsBucket = [] } = useQuery({
    queryKey: ['show-items', 0, dateKey],
    queryFn: async () => {
      const data = await api.get<ShowItem[]>('/timeline-items', {
        params: { date: dateKey },
      });
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // Fetch available presets
  const { data: presets = [] } = useQuery({
    queryKey: ['timeline-presets'],
    queryFn: async () => {
      const data = await api.get<TimelinePreset[]>('/timeline-presets');
      return data || [];
    },
  });

  // Fetch content for timeline
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
      return data || [];
    },
  });

  const { data: commentaries = [] } = useQuery({
    queryKey: ['commentaries'],
    queryFn: async () => {
      const data = await api.get<Commentary[]>('/commentaries');
      return data || [];
    },
  });

  const { data: news = [] } = useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      const data = await api.get<any[]>('/news');
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

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const data = await api.get<any[]>('/products');
      return (data || []).filter((p: any) => p.isActive);
    },
  });

  const shuffleArray = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

  const isTalkLike = (item: ShowItem) =>
    item.contentType === "TALK" || item.contentType === "HOST_COMMENTARY" || item.contentType === "COMMENTARY";

  const isProductItem = (item: ShowItem) =>
    item.contentType === "ADVERTISEMENT" &&
    products.some((p: any) => Number(p.id) === Number(item.contentId));

  const getTrackGenre = (item: ShowItem) => {
    if (item.contentType !== "TRACK") return "";
    const track = tracks.find((t) => Number(t.id) === Number(item.contentId));
    return (track?.genre || "").toLowerCase().trim();
  };

  const getItemDurationForShuffle = (item: ShowItem): number => {
    switch (item.contentType) {
      case "TRACK": {
        const track = tracks.find((t) => Number(t.id) === Number(item.contentId));
        return track?.duration || 180;
      }
      case "ADVERTISEMENT": {
        const product = products.find((p: any) => Number(p.id) === Number(item.contentId));
        if (product) return product.duration || 30;
        const ad = advertisements.find((a) => Number(a.id) === Number(item.contentId));
        return ad?.duration || 30;
      }
      case "TALK": {
        const talk = talks.find((t) => Number(t.id) === Number(item.contentId));
        return talk?.duration || 300;
      }
      case "HOST_COMMENTARY":
      case "COMMENTARY": {
        const commentary = commentaries.find((c) => Number(c.id) === Number(item.contentId));
        return (commentary as any)?.duration || 120;
      }
      default:
        return 180;
    }
  };

  const buildAdvancedShuffleOrder = (items: ShowItem[], options: ShuffleOptions): ShowItem[] => {
    const tracksPool = items.filter((i) => i.contentType === "TRACK");
    const talksPool = items.filter((i) => isTalkLike(i));
    const productsPool = items.filter((i) => isProductItem(i));
    const othersPool = items.filter((i) => i.contentType !== "TRACK" && !isTalkLike(i) && !isProductItem(i));

    let trackItems = shuffleArray(tracksPool);
    if (options.genreFilter !== "all") {
      const wanted = trackItems.filter((i) => getTrackGenre(i) === options.genreFilter.toLowerCase());
      const rest = trackItems.filter((i) => getTrackGenre(i) !== options.genreFilter.toLowerCase());
      trackItems = [...shuffleArray(wanted), ...shuffleArray(rest)];
    } else if (options.genreMode === "grouped") {
      const byGenre = new Map<string, ShowItem[]>();
      for (const item of trackItems) {
        const g = getTrackGenre(item) || "ungrouped";
        byGenre.set(g, [...(byGenre.get(g) || []), item]);
      }
      trackItems = Array.from(byGenre.values()).flatMap((group) => shuffleArray(group));
    }

    const talkItems = shuffleArray(talksPool);
    const productItems = shuffleArray(productsPool);
    const otherItems = shuffleArray(othersPool);
    const result: ShowItem[] = [];
    const talkUsage = new Map<number, number>();
    const productUsage = new Map<number, number>();
    let tracksSinceStart = 0;

    const takeTalk = () => {
      if (!talkItems.length) return;
      const idx = talkItems.findIndex((t) => {
        const current = talkUsage.get(Number(t.contentId)) || 0;
        return current < Math.max(1, options.maxTalkOccurrences);
      });
      if (idx < 0) return;
      const [selected] = talkItems.splice(idx, 1);
      const key = Number(selected.contentId);
      talkUsage.set(key, (talkUsage.get(key) || 0) + 1);
      result.push(selected);
    };

    const takeProduct = () => {
      if (!productItems.length) return;
      const idx = productItems.findIndex((p) => {
        if (options.unlimitedProducts) return true;
        const current = productUsage.get(Number(p.contentId)) || 0;
        return current < Math.max(1, options.maxProductOccurrences);
      });
      if (idx < 0) return;
      const [selected] = productItems.splice(idx, 1);
      const key = Number(selected.contentId);
      productUsage.set(key, (productUsage.get(key) || 0) + 1);
      result.push(selected);
    };

    while (trackItems.length || talkItems.length || productItems.length || otherItems.length) {
      if (trackItems.length) {
        result.push(trackItems.shift()!);
        tracksSinceStart += 1;
      } else if (otherItems.length) {
        result.push(otherItems.shift()!);
      } else if (talkItems.length) {
        takeTalk();
      } else if (productItems.length) {
        takeProduct();
      }

      if (options.talkEveryTracks > 0 && tracksSinceStart > 0 && tracksSinceStart % options.talkEveryTracks === 0) {
        takeTalk();
      }
      if (options.productEveryTracks > 0 && tracksSinceStart > 0 && tracksSinceStart % options.productEveryTracks === 0) {
        takeProduct();
      }
    }

    // Keep all items: append any leftovers that couldn't satisfy caps during cadence insertion.
    result.push(...talkItems, ...productItems);
    return result;
  };

  const shuffleMutation = useMutation({
    mutationFn: async (options: ShuffleOptions) => {
      const allItems = [...timelineItems].sort((a, b) => (a.startTimeOffset || 0) - (b.startTimeOffset || 0));
      if (allItems.length === 0) {
        throw new Error("No items to shuffle");
      }

      let ordered: ShowItem[] = [];
      const updatePayloads: Array<{ id: number; position: number; startTimeOffset: number }> = [];
      let position = 0;

      if (options.mode === "within-hour") {
        const byHour = new Map<number, ShowItem[]>();
        for (const item of allItems) {
          const hour = Math.floor((item.startTimeOffset || 0) / 3600);
          byHour.set(hour, [...(byHour.get(hour) || []), item]);
        }
        const sortedHours = Array.from(byHour.keys()).sort((a, b) => a - b);

        for (const hour of sortedHours) {
          const hourStart = hour * 3600;
          const bucket = byHour.get(hour) || [];
          const shuffledBucket = buildAdvancedShuffleOrder(bucket, options);
          ordered.push(...shuffledBucket);

          let localTime = 0;
          for (const item of shuffledBucket) {
            updatePayloads.push({
              id: item.id,
              position: position++,
              startTimeOffset: hourStart + localTime,
            });
            localTime += getItemDurationForShuffle(item);
          }
        }
      } else {
        ordered = buildAdvancedShuffleOrder(allItems, options);
        let runningTime = 0;
        for (const item of ordered) {
          updatePayloads.push({
            id: item.id,
            position: position++,
            startTimeOffset: runningTime,
          });
          runningTime += getItemDurationForShuffle(item);
        }
      }

      await Promise.all(
        updatePayloads.map((u) =>
          api.put(`/timeline-items/${u.id}`, {
            startTimeOffset: u.startTimeOffset,
            position: u.position,
          })
        )
      );

      return ordered;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-items', dateKey] });
      queryClient.invalidateQueries({ queryKey: ['show-items', 0, dateKey] });
      scheduleRadioTimelineSyncBroadcast(dateKey, "radio-editor:shuffle");
      toast.success('Advanced shuffle applied successfully.');
      setShuffleDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to shuffle items');
    },
  });

  // Save preset mutation
  const savePresetMutation = useMutation({
    mutationFn: async (name: string) => {
      return await api.post('/timeline-presets', {
        date: dateKey,
        name,
        items: timelineItems,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-presets'] });
      toast.success('Preset saved successfully!');
      setSavePresetDialogOpen(false);
      setPresetName("");
    },
    onError: () => {
      toast.error('Failed to save preset');
    },
  });

  // Load preset mutation
  const loadPresetMutation = useMutation({
    mutationFn: async (presetId: number) => {
      const preset = presets.find(p => p.id === presetId);
      if (!preset) throw new Error('Preset not found');

      // Parse items if they're stored as JSON string (from database)
      const items = typeof preset.items === 'string' 
        ? JSON.parse(preset.items) 
        : Array.isArray(preset.items) 
          ? preset.items 
          : [];

      if (items.length === 0) {
        throw new Error('Preset has no items');
      }

      // Delete existing items for this date
      if (timelineItems.length > 0) {
        await Promise.all(
          timelineItems.map(item => api.delete(`/timeline-items/${item.id}`))
        );
      }

      // Create new items from preset
      await Promise.all(
        items.map((item: any, index: number) =>
          api.post('/timeline-items', {
            ...item,
            id: undefined, // Remove id to create new
            date: dateKey,
            position: index,
          })
        )
      );

      return preset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-items', dateKey] });
      queryClient.invalidateQueries({ queryKey: ['show-items', 0, dateKey] });
      scheduleRadioTimelineSyncBroadcast(dateKey, "radio-editor:load-preset");
      toast.success('Preset loaded successfully! You can now shuffle it if needed.');
      setLoadPresetDialogOpen(false);
      setPendingPresetId(null);
    },
    onError: () => {
      toast.error('Failed to load preset');
    },
  });

  const clearDayTracksMutation = useMutation({
    mutationFn: async () => {
      if (timelineItems.length === 0) return 0;
      await Promise.all(timelineItems.map((item) => api.delete(`/timeline-items/${item.id}`)));
      return timelineItems.length;
    },
    onSuccess: (deletedCount) => {
      queryClient.invalidateQueries({ queryKey: ['timeline-items', dateKey] });
      queryClient.invalidateQueries({ queryKey: ['show-items', 0, dateKey] });
      scheduleRadioTimelineSyncBroadcast(dateKey, "radio-editor:clear-day");
      if (deletedCount > 0) {
        toast.success(`Cleared ${deletedCount} track${deletedCount === 1 ? '' : 's'} from ${format(selectedDate, "MMM d, yyyy")}.`);
      } else {
        toast.info('No tracks to clear for this date.');
      }
      setClearTracksDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to clear tracks');
    },
  });

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
      setCalendarOpen(false);
    }
  };

  const handleTodayClick = () => {
    setSelectedDate(startOfDay(new Date()));
  };

  const handleTomorrowClick = () => {
    setSelectedDate(startOfDay(addDays(new Date(), 1)));
  };

  const handleShuffle = () => {
    if (timelineItems.length === 0) {
      toast.error('No items to shuffle');
      return;
    }
    setShuffleDialogOpen(true);
  };

  const handleSavePreset = () => {
    if (timelineItems.length === 0) {
      toast.error('No items to save as preset');
      return;
    }
    setPresetName(`${format(selectedDate, "MMM d")} Preset`);
    setSavePresetDialogOpen(true);
  };

  const handleLoadPreset = (presetId: number) => {
    setPendingPresetId(presetId);
    setLoadPresetDialogOpen(true);
  };

  const handleItemUpdate = async (id: number, updates: Partial<ShowItem>) => {
    try {
      // Optimistically update the UI first - this prevents snap-back
      queryClient.setQueryData(['timeline-items', dateKey], (old: ShowItem[] = []) => {
        const updated = old.map(item => 
          item.id === id ? { ...item, ...updates } : item
        );
        return updated;
      });
      
      // Then sync with server in background (don't wait)
      api.put(`/timeline-items/${id}`, updates).then(() => {
        scheduleRadioTimelineSyncBroadcast(dateKey, "radio-editor:update-item");
      }).catch((error: any) => {
        // Only revert on error, don't show toast for drag operations
        console.error('Failed to update item:', error);
        queryClient.invalidateQueries({ queryKey: ['timeline-items', dateKey] });
      });
      
      // Don't invalidate immediately - let optimistic update stay
      // Only invalidate after a delay to sync with server
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['timeline-items', dateKey] });
      }, 1000);
    } catch (error: any) {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ['timeline-items', dateKey] });
      toast.error(error.message || 'Failed to update item');
    }
  };

  const handleItemDelete = async (id: number) => {
    try {
      await api.delete(`/timeline-items/${id}`);
      queryClient.invalidateQueries({ queryKey: ['timeline-items', dateKey] });
      scheduleRadioTimelineSyncBroadcast(dateKey, "radio-editor:delete-item");
      toast.success('Item deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    }
  };

  const handleItemAdd = () => {
    queryClient.invalidateQueries({ queryKey: ['timeline-items'] });
    queryClient.invalidateQueries({ queryKey: ['timeline-items', dateKey] });
    queryClient.invalidateQueries({ queryKey: ['show-items', 0] });
    queryClient.invalidateQueries({ queryKey: ['show-items', 0, dateKey] });
    scheduleRadioTimelineSyncBroadcast(dateKey, "radio-editor:add-item");
  };

  const handleAddFromBucket = async (itemId: number, alreadyExists: boolean = false) => {
    // Find the item in the bucket
    const item = showItemsBucket.find(i => i.id === itemId);
    if (!item) return;

    // Calculate position - add right after the last item (sequential)
    // Sort by startTimeOffset to find the actual last item chronologically
    let newPosition = 0;
    let newStartTimeOffset = 0;
    
    if (timelineItems.length > 0) {
      // Sort by startTimeOffset to find the chronologically last item
      const sortedByTime = [...timelineItems].sort((a, b) => (a.startTimeOffset || 0) - (b.startTimeOffset || 0));
      const lastItem = sortedByTime[sortedByTime.length - 1];
      
      // Get duration of last item
      const lastItemDuration = getContentDuration(lastItem, contentData);
      newStartTimeOffset = (lastItem.startTimeOffset || 0) + lastItemDuration;
      
      // For position, use the max position + 1
      const maxPosition = Math.max(...timelineItems.map(i => i.position || 0));
      newPosition = maxPosition + 1;
    }

    // Add to timeline (create a copy with new position)
    try {
      await api.post('/timeline-items', {
        contentType: item.contentType,
        contentId: item.contentId,
        position: newPosition,
        startTimeOffset: newStartTimeOffset, // Place right after last item chronologically
        mixMode: item.mixMode || 'sequential',
        notes: item.notes || '',
        volume: item.volume || 100,
        fadeInDuration: item.fadeInDuration || 0,
        fadeOutDuration: item.fadeOutDuration || 0,
        playbackStartTime: item.playbackStartTime || 0,
        playbackEndTime: item.playbackEndTime || null,
        date: dateKey,
      });
      
      handleItemAdd();
      scheduleRadioTimelineSyncBroadcast(dateKey, "radio-editor:add-from-bucket");
      if (alreadyExists) {
        toast.success('Item added to timeline (placed sequentially after last item)');
      } else {
        toast.success('Item added to timeline');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add item to timeline');
    }
  };

  // Helper function to get content duration
  const getContentDuration = (item: ShowItem, contentData: any): number => {
    switch (item.contentType) {
      case 'TRACK':
        const track = contentData.tracks.find((t: any) => t.id === item.contentId);
        return track?.duration || 180;
      case 'ADVERTISEMENT':
        // Product-backed advertisement entries should still resolve duration
        // even before audio is generated.
        const product = contentData.products?.find((p: any) => Number(p.id) === Number(item.contentId));
        if (product) {
          return product.duration || 30;
        }
        // Otherwise it's a regular advertisement
        const ad = contentData.advertisements.find((a: any) => Number(a.id) === Number(item.contentId));
        if (ad?.duration) return ad.duration;
        if (ad?.productId) {
          const linkedProduct = contentData.products?.find((p: any) => Number(p.id) === Number(ad.productId));
          if (linkedProduct?.duration) return linkedProduct.duration;
        }
        return 30;
      case 'NEWS':
        const news = contentData.news.find((n: any) => n.id === item.contentId);
        return news?.duration || 60;
      case 'TALK':
        const talk = contentData.talks.find((t: any) => t.id === item.contentId);
        return talk?.duration || 300;
      case 'HOST_COMMENTARY':
      case 'COMMENTARY':
        const commentary = contentData.hostCommentaries.find((h: any) => h.id === item.contentId);
        return commentary?.duration || 120;
      default:
        return 180;
    }
  };

  // Save timeline for public playback
  const saveTimelineMutation = useMutation({
    mutationFn: async () => {
      // Save all timeline items for this date with all necessary fields
      const promises = timelineItems.map((item, index) => {
        // Ensure all critical fields are included, especially startTimeOffset
        const updateData = {
          id: item.id,
          position: index,
          startTimeOffset: item.startTimeOffset || 0, // Critical: time in seconds since midnight
          contentType: item.contentType,
          contentId: item.contentId,
          volume: item.volume || 100,
          fadeInDuration: item.fadeInDuration || 0,
          fadeOutDuration: item.fadeOutDuration || 0,
          playbackStartTime: item.playbackStartTime || 0,
          playbackEndTime: item.playbackEndTime || null,
          mixMode: item.mixMode || 'sequential',
          notes: item.notes || null,
          date: dateKey, // Ensure date is set
        };
        return api.put(`/timeline-items/${item.id}`, updateData);
      });
      await Promise.all(promises);
      
      // Mark this date as published for public playback
      await api.post('/published-timelines', {
        date: dateKey,
      });
      
      return { success: true, date: dateKey };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-items', dateKey] });
      queryClient.invalidateQueries({ queryKey: ['published-timelines'] });
      scheduleRadioTimelineSyncBroadcast(dateKey, "radio-editor:publish");
      toast.success('Timeline saved and published! Radio stream is now live! 🎵', {
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save timeline');
    },
  });

  const contentData = {
    tracks,
    advertisements,
    news,
    talks,
    hostCommentaries: commentaries,
    products,
  };

  const availableGenres = Array.from(
    new Set(
      tracks
        .map((t) => (t.genre || "").trim())
        .filter((g) => g.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      {/* Date Selection & Controls */}
      <Card className="gp-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-gp-display text-[color:var(--gp-white)] text-xl">
            <CalendarIcon className="h-5 w-5 text-[var(--gp-gold-bright)]" />
            Radio Timeline Editor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Quick Date Buttons */}
            <div className="flex gap-2">
              <Button
                variant={isToday(selectedDate) ? "default" : "outline"}
                onClick={handleTodayClick}
                className={cn(
                  "font-sans text-sm font-semibold tracking-normal border-[var(--gp-border-gold)]",
                  isToday(selectedDate)
                    ? "bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)]"
                    : "text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                )}
              >
                Today
              </Button>
              <Button
                variant={isTomorrow(selectedDate) ? "default" : "outline"}
                onClick={handleTomorrowClick}
                className={cn(
                  "font-sans text-sm font-semibold tracking-normal border-[var(--gp-border-gold)]",
                  isTomorrow(selectedDate)
                    ? "bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)]"
                    : "text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                )}
              >
                Tomorrow
              </Button>
            </div>

            {/* Calendar Picker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-sans text-sm font-semibold tracking-normal bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)]",
                    !selectedDate && "text-[color:var(--gp-white)]/55"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Action Buttons */}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={async () => {
                  if (confirm('Delete all timeline items from past dates? This will clean up old data and cannot be undone.')) {
                    try {
                      const response = await api.delete('/timeline-items/cleanup/old-dates');
                      toast.success(`Cleaned up ${response.deletedCount} items from past dates`);
                      queryClient.invalidateQueries({ queryKey: ['timeline-items'] });
                    } catch (error: any) {
                      toast.error('Failed to cleanup old dates: ' + (error?.message || 'Unknown error'));
                    }
                  }
                }}
                className="gap-2 border-[rgba(239,68,68,0.45)] text-red-300 hover:text-red-200 hover:bg-[rgba(127,29,29,0.35)] font-sans text-sm font-semibold tracking-normal"
              >
                <Trash2 className="h-4 w-4" />
                Cleanup Old Dates
              </Button>
              <Button
                variant="outline"
                onClick={() => setClearTracksDialogOpen(true)}
                disabled={clearDayTracksMutation.isPending}
                className="gap-2 border-[rgba(239,68,68,0.45)] text-red-300 hover:text-red-200 hover:bg-[rgba(127,29,29,0.35)] font-sans text-sm font-semibold tracking-normal"
              >
                <Trash2 className="h-4 w-4" />
                {isToday(selectedDate) ? "Clear All Today Tracks" : "Clear All Tracks"}
              </Button>
              <Dialog open={introDialogOpen} onOpenChange={setIntroDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal">
                    <Film className="h-4 w-4" />
                    Today's Intro
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
                  <DialogHeader>
                    <DialogTitle className="font-gp-display text-2xl font-semibold text-[color:var(--gp-white)]">Today's Intro</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-[color:var(--gp-white)]/80 font-gp-serif">
                    Choose the intro animation visitors see when they open the website. Navbar, player, and footer stay hidden until the intro finishes.
                  </p>
                  <div className="grid gap-2 py-2">
                    {INTRO_IDS.map((id) => (
                      <Button
                        key={id}
                        variant={selectedIntroId === id ? "default" : "outline"}
                        className={cn(
                          "justify-start font-sans text-sm font-semibold tracking-normal border-[var(--gp-border-gold)]",
                          selectedIntroId === id
                            ? "bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)]"
                            : "text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                        )}
                        onClick={() => {
                          setStoredIntroId(id);
                          setSelectedIntroId(id);
                          toast.success(`Intro set to "${INTRO_LABELS[id]}"`);
                          setIntroDialogOpen(false);
                        }}
                      >
                        {INTRO_LABELS[id]}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      className="justify-start text-[color:var(--gp-white)]/70 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 border-[var(--gp-border-gold)] font-sans text-sm font-semibold tracking-normal"
                      onClick={() => {
                        setStoredIntroId(null);
                        setSelectedIntroId(null);
                        toast.success("Intro disabled");
                        setIntroDialogOpen(false);
                      }}
                    >
                      None (no intro)
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                onClick={handleShuffle}
                disabled={shuffleMutation.isPending || timelineItems.length === 0}
                className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
              >
                <Shuffle className="h-4 w-4" />
                Shuffle Items
              </Button>
              <Button
                variant="outline"
                onClick={handleSavePreset}
                disabled={savePresetMutation.isPending || timelineItems.length === 0}
                className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
              >
                <Save className="h-4 w-4" />
                Save Preset
              </Button>
              <Select
                onValueChange={(value) => handleLoadPreset(parseInt(value))}
                disabled={loadPresetMutation.isPending || presets.length === 0}
              >
                <SelectTrigger className="w-[180px] gap-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-sm font-semibold tracking-normal">
                  <Download className="h-4 w-4" />
                  <SelectValue placeholder="Load Preset" />
                </SelectTrigger>
                <SelectContent className="bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id.toString()}>
                      {preset.name} ({format(new Date(preset.date), "MMM d")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="default"
                onClick={() => saveTimelineMutation.mutate()}
                disabled={saveTimelineMutation.isPending || timelineItems.length === 0}
                className="gap-2 bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
              >
                <CheckCircle className="h-4 w-4" />
                Save & Publish
              </Button>
            </div>

            {/* Selected Date Display */}
            <div className="w-full text-sm text-[color:var(--gp-white)]/75 mt-2 font-sans">
              <span className="font-semibold">Editing timeline for:</span>{" "}
              <span className="text-[var(--gp-gold-bright)] font-semibold">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Editor */}
      {itemsLoading ? (
        <div className="flex items-center justify-center p-8">
          <Clock className="h-6 w-6 animate-spin text-[var(--gp-gold-bright)]" />
        </div>
      ) : (
        <>
                  {/* Show Items - Main Playlist/Player */}
                  <ShowItemBuilder
                    ref={showItemBuilderRef}
                    showId={0} // Not used anymore, but component expects it
                    onItemAdded={handleItemAdd}
                    selectedDate={dateKey} // Pass date to filter items by date
                  />
                  
                  {/* Timeline - View Only Visualization */}
                  <TimelineEditor24h
                    showItems={timelineItems}
                    onItemUpdate={handleItemUpdate}
                    onItemDelete={handleItemDelete}
                    onItemAdd={handleItemAdd}
                    contentData={contentData}
                    selectedDate={selectedDate}
                  />
        </>
      )}

      <Dialog open={clearTracksDialogOpen} onOpenChange={setClearTracksDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
          <DialogHeader>
            <DialogTitle className="font-gp-display text-2xl font-semibold text-[color:var(--gp-white)]">
              {isToday(selectedDate) ? "Clear All Today Tracks" : "Clear All Tracks"}
            </DialogTitle>
            <DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/90 text-base leading-relaxed">
              This will remove every item from <span className="text-[var(--gp-gold-bright)]">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[2px] border border-[rgba(239,68,68,0.45)] bg-[rgba(127,29,29,0.2)] p-3 text-sm font-gp-sans text-red-200">
            Playlist items to delete: <span className="font-semibold">{timelineItems.length}</span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearTracksDialogOpen(false)}
              className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={clearDayTracksMutation.isPending}
              onClick={() => clearDayTracksMutation.mutate()}
              className="bg-red-600 hover:bg-red-500 text-white font-sans text-sm font-semibold tracking-normal"
            >
              {clearDayTracksMutation.isPending ? "Clearing..." : "Yes, Clear All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loadPresetDialogOpen} onOpenChange={setLoadPresetDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
          <DialogHeader>
            <DialogTitle className="font-gp-display text-2xl font-semibold text-[color:var(--gp-white)]">
              Load Preset
            </DialogTitle>
            <DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/90 text-base leading-relaxed">
              This will replace the current timeline for <span className="text-[var(--gp-gold-bright)]">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[2px] border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)] p-3">
            <p className="text-sm font-gp-sans text-[color:var(--gp-white)]/85">
              Preset:
              <span className="text-[var(--gp-gold-bright)] ml-2">
                {presets.find((p) => p.id === pendingPresetId)?.name || "Unknown Preset"}
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLoadPresetDialogOpen(false);
                setPendingPresetId(null);
              }}
              className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={loadPresetMutation.isPending || !pendingPresetId}
              onClick={() => {
                if (!pendingPresetId) return;
                loadPresetMutation.mutate(pendingPresetId);
              }}
              className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
            >
              {loadPresetMutation.isPending ? "Loading..." : "Load Preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shuffleDialogOpen} onOpenChange={setShuffleDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
          <DialogHeader>
            <DialogTitle className="font-gp-display text-2xl md:text-3xl font-semibold text-[color:var(--gp-white)]">
              Advanced Shuffle Settings
            </DialogTitle>
            <DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/90 text-base leading-relaxed">
              Choose how items are shuffled, when talks/products are inserted, and how genres should behave.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Card className="gp-card">
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Shuffle Scope</Label>
                  <Select value={shuffleOptions.mode} onValueChange={(v: "within-hour" | "full-day") => setShuffleOptions((s) => ({ ...s, mode: v }))}>
                    <SelectTrigger className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="within-hour">Shuffle Within Same Hour</SelectItem>
                      <SelectItem value="full-day">Shuffle Full Day Timeline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Insert Talk Every N Tracks</Label>
                    <Input
                      type="number"
                      min={0}
                      value={shuffleOptions.talkEveryTracks}
                      onChange={(e) => setShuffleOptions((s) => ({ ...s, talkEveryTracks: Math.max(0, Number(e.target.value) || 0) }))}
                      className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base"
                    />
                  </div>
                  <div>
                    <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Max Same Talk Occurrences</Label>
                    <Input
                      type="number"
                      min={1}
                      value={shuffleOptions.maxTalkOccurrences}
                      onChange={(e) => setShuffleOptions((s) => ({ ...s, maxTalkOccurrences: Math.max(1, Number(e.target.value) || 1) }))}
                      className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base"
                    />
                  </div>
                  <div>
                    <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Insert Product Every N Tracks</Label>
                    <Input
                      type="number"
                      min={0}
                      value={shuffleOptions.productEveryTracks}
                      onChange={(e) => setShuffleOptions((s) => ({ ...s, productEveryTracks: Math.max(0, Number(e.target.value) || 0) }))}
                      className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base"
                    />
                  </div>
                  <div>
                    <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Max Same Product Occurrences</Label>
                    <Input
                      type="number"
                      min={1}
                      disabled={shuffleOptions.unlimitedProducts}
                      value={shuffleOptions.maxProductOccurrences}
                      onChange={(e) => setShuffleOptions((s) => ({ ...s, maxProductOccurrences: Math.max(1, Number(e.target.value) || 1) }))}
                      className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base disabled:opacity-45"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="unlimited-products"
                    checked={shuffleOptions.unlimitedProducts}
                    onCheckedChange={(checked) => setShuffleOptions((s) => ({ ...s, unlimitedProducts: Boolean(checked) }))}
                  />
                  <Label htmlFor="unlimited-products" className="font-gp-sans text-[color:var(--gp-white)]/90 text-sm">
                    Allow Unlimited Product Repeats
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card className="gp-card">
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Genre Strategy</Label>
                  <Select value={shuffleOptions.genreMode} onValueChange={(v: "mixed" | "grouped") => setShuffleOptions((s) => ({ ...s, genreMode: v }))}>
                    <SelectTrigger className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">Mixed Genres</SelectItem>
                      <SelectItem value="grouped">Grouped by Genre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Genre Priority</Label>
                  <Select value={shuffleOptions.genreFilter} onValueChange={(v) => setShuffleOptions((s) => ({ ...s, genreFilter: v }))}>
                    <SelectTrigger className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genres</SelectItem>
                      {availableGenres.map((genre) => (
                        <SelectItem key={genre} value={genre}>
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShuffleDialogOpen(false)}
              className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={shuffleMutation.isPending}
              onClick={() => shuffleMutation.mutate(shuffleOptions)}
              className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
            >
              {shuffleMutation.isPending ? "Shuffling..." : "Apply Advanced Shuffle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
          <DialogHeader>
            <DialogTitle className="font-gp-display text-2xl font-semibold text-[color:var(--gp-white)]">
              Save Timeline Preset
            </DialogTitle>
            <DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/90 text-base leading-relaxed">
              Save the current timeline for {format(selectedDate, "EEEE, MMMM d, yyyy")} as a reusable preset.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Preset Name</Label>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Enter preset name..."
              className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSavePresetDialogOpen(false)}
              className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savePresetMutation.isPending || !presetName.trim()}
              onClick={() => savePresetMutation.mutate(presetName.trim())}
              className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
            >
              {savePresetMutation.isPending ? "Saving..." : "Save Preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
