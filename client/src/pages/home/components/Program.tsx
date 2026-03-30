import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Clock, Music, Mic, Calendar as CalendarIcon, Archive as ArchiveIcon, Info } from "lucide-react";
import { api } from "@/lib/api-client";
import { startOfDay, endOfDay, isSameDay } from "date-fns";
import type { ScheduledShow, RadioStation, Show, Host } from '@/types/api-models'

interface ProgramBlock {
  id: number;
  startTime: Date;
  endTime: Date;
  startHour: number;
  endHour: number;
  title: string;
  blockType: 'music' | 'content' | 'mixed';
  description?: string;
  show: ScheduledShowWithRelations; // Include full show data for hover details
}

// ScheduledShow type with nested show relation
type ScheduledShowWithRelations = ScheduledShow & { 
  show?: (Show & { 
    host?: Host | null;
    showItems?: { 
      id: number; 
      contentType: string; 
      contentId: number; 
      position: number;
      notes?: string | null;
    }[];
  }) | null;
  host?: { id: number; name: string; bio?: string; imageUrl?: string };
  location?: { id: number; name: string; address: string; city?: string; rating?: number };
  showItems?: { id: number; contentType: string; contentId: number }[];
}

export default function Program({ radioStationId }: { radioStationId: number }) {
  // Fetch radio station metadata
  const { data: station } = useQuery<RadioStation | null>({
    queryKey: ['radioStation', radioStationId],
    queryFn: async () => {
      if (!radioStationId) return null;
      const data = await api.get(`/radio-stations/${radioStationId}`);
      return data as RadioStation;
    },
    enabled: !!radioStationId,
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedShowId, setSelectedShowId] = useState<number | null>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Fetch scheduled shows for the given radio station (with full details) using API
  const { data: scheduledShows } = useQuery<ScheduledShowWithRelations[]>({
    queryKey: ['scheduledShows', radioStationId],
    queryFn: async () => {
      if (!radioStationId) return [];
      const data = await api.get(`/scheduled-shows?stationId=${radioStationId}`);
      return (data || []) as ScheduledShowWithRelations[];
    },
    enabled: !!radioStationId,
  });

  const programBlocks: ProgramBlock[] = useMemo(() => {
    if (!scheduledShows) return [];
    return scheduledShows.map(s => {
      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      return {
        id: s.id,
        startTime: start,
        endTime: end,
        startHour: start.getHours(),
        endHour: end.getHours() + (end.getMinutes() > 0 ? 1 : 0),
        title: s.show?.title || 'Untitled Show',
        blockType: 'mixed',
        description: s.show?.description ?? undefined,
        show: s, // Include full show data
      } as ProgramBlock;
    });
  }, [scheduledShows]);

  // Helper function to calculate item play times
  const calculateItemTimes = (items: any[], showStartTime: Date) => {
    // Sort items by position first
    const sortedItems = [...items].sort((a, b) => (a.position || 0) - (b.position || 0));
    let currentTime = new Date(showStartTime);
    
    return sortedItems.map((item) => {
      const itemStart = new Date(currentTime);
      // Calculate duration: use playbackEndTime - playbackStartTime if available, otherwise default to 60 seconds
      let duration = 60; // Default 1 minute
      
      if (item.playbackStartTime !== null && item.playbackEndTime !== null) {
        duration = (item.playbackEndTime - item.playbackStartTime) / 1000; // Convert ms to seconds
      } else if (item.playbackStartTime !== null) {
        // If only start time is set, add offset to current time
        const offset = (item.playbackStartTime || 0) / 1000;
        itemStart.setSeconds(itemStart.getSeconds() + offset);
      }
      
      const itemEnd = new Date(itemStart.getTime() + duration * 1000);
      currentTime = new Date(itemEnd);
      
      return {
        ...item,
        calculatedStartTime: itemStart,
        calculatedEndTime: itemEnd,
      };
    });
  };

  const getSelectedDayBlocks = () => {
    if (!selectedDate || !programBlocks) return [];
    const selectedStart = startOfDay(selectedDate);
    const selectedEnd = endOfDay(selectedDate);
    return programBlocks.filter(block => {
      const blockStart = startOfDay(block.startTime);
      const blockEnd = endOfDay(block.endTime);
      // Check if the block overlaps with the selected date
      return (blockStart <= selectedEnd && blockEnd >= selectedStart);
    });
  };

  const getBlockIcon = (blockType: string) => {
    switch (blockType) {
      case 'music':
        return <Music className="h-4 w-4 text-blue-500" />;
      case 'content':
        return <Mic className="h-4 w-4 text-radio-cyan" />;
      case 'mixed':
        return <Clock className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getBlockColor = (block: ProgramBlock) => {
    switch (block.blockType) {
      case 'music':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'content':
        return 'bg-radio-cyan/10 border-radio-cyan/50 text-radio-cyan';
      case 'mixed':
        return 'bg-purple-100 border-purple-300 text-purple-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const renderDaySchedule = () => {
    const dayBlocks = getSelectedDayBlocks();
    
    if (dayBlocks.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-base">No shows scheduled for this date</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        {dayBlocks.map((block) => {
          const startTime = new Date(block.startTime);
          const endTime = new Date(block.endTime);
          const isSelected = selectedShowId === block.id;
          const isPast = endTime < new Date();
          
          return (
            <div 
              key={block.id} 
              className={`border-2 rounded-lg overflow-hidden cursor-pointer transition-all mb-3 ${
                isSelected
                  ? 'bg-blue-50 border-blue-400 shadow-md' 
                  : isPast
                  ? 'bg-gray-100 border-gray-300 hover:border-gray-400 hover:shadow-sm opacity-75'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
              onClick={() => setSelectedShowId(isSelected ? null : block.id)}
            >
              <div className="flex gap-2.5 p-2.5">
                {/* Show Image */}
                {block.show.show?.imageUrl && (
                  <div className="flex-shrink-0">
                    <img 
                      src={block.show.show.imageUrl} 
                      alt={block.title}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-gray-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">{block.title}</h3>
                  
                  {/* Time, Badges, and Items Count in one line */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-mono text-xs font-medium text-gray-600">
                      {startTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true
                      })} - {endTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true
                      })}
                    </div>
                    {block.show.show?.featured && (
                      <Badge className="text-[10px] px-1.5 py-0.5 bg-radio-orange text-white">
                        Featured
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 capitalize">
                      {block.blockType}
                    </Badge>
                    {block.show.show?.showItems && block.show.show.showItems.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {block.show.show.showItems.length} items
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {isSelected && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="space-y-2">
                    {/* Compact info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Show:</span>
                        <span className="ml-1 font-medium text-gray-900">{block.title}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Time:</span>
                        <span className="ml-1 font-mono font-medium text-gray-900">
                          {startTime.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true
                          })} - {endTime.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Type:</span>
                        <span className="ml-1 font-medium text-gray-900 capitalize">{block.blockType}</span>
                      </div>
                      {block.show.show?.host && (
                        <div>
                          <span className="text-gray-500">Host:</span>
                          <span className="ml-1 font-medium text-gray-900">{block.show.show.host.name}</span>
                        </div>
                      )}
                      {block.show.location && (
                        <div className="sm:col-span-2">
                          <span className="text-gray-500">Location:</span>
                          <span className="ml-1 font-medium text-gray-900">{block.show.location.name}</span>
                          {block.show.location.city && (
                            <span className="ml-1 text-gray-500">({block.show.location.city})</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Description */}
                    {block.description && (
                      <div className="text-xs">
                        <span className="text-gray-500">Description:</span>
                        <p className="mt-0.5 text-gray-700">{block.description}</p>
                      </div>
                    )}
                    
                    {/* Show Items */}
                    {block.show.show?.showItems && block.show.show.showItems.length > 0 && (
                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-gray-900">Show Items ({block.show.show.showItems.length})</span>
                        </div>
                        <div className="space-y-1">
                          {calculateItemTimes(block.show.show.showItems, startTime).map((item: any, index: number) => (
                            <div key={item.id || index} className="bg-gray-50 rounded px-2 py-1.5 border border-gray-200 hover:bg-gray-100 transition-colors">
                              <div className="flex items-center gap-2">
                                <div className="font-mono text-xs font-medium text-gray-700 flex-shrink-0 w-24">
                                  {item.calculatedStartTime.toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: true
                                  })} - {item.calculatedEndTime.toLocaleTimeString('en-US', { 
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </div>
                                <span className="text-xs font-medium text-gray-500">#{item.position !== undefined ? item.position + 1 : index + 1}</span>
                                <span className="font-medium text-gray-900 text-xs capitalize flex-1">
                                  {item.contentType?.replace('_', ' ') || 'Unknown'}
                                </span>
                                {item.notes && (
                                  <span className="text-xs text-gray-600 truncate max-w-[200px]">{item.notes}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 pb-6 sm:pb-8 pt-0">
        {/* Station header */}
        <Card className="mb-6 shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <img
            src={station?.logoUrl || '/attached_assets/logo fürs impressum _1750098786691.jpg'}
            alt={station?.name || 'Radio Logo'}
            className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-4 border-white shadow-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/attached_assets/logo fürs impressum _1750098786691.jpg';
            }}
          />
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{station?.name || 'Radio Station'}</h1>
                {station?.description && (
                  <p className="text-sm sm:text-base text-gray-600 mb-3">{station.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {station?.streamUrl && (
                    <a 
                      href={station.streamUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-radio-orange hover:bg-radio-orange/90 text-white text-sm font-medium shadow-md transition-colors"
                    >
                      ▶ Play Stream
                    </a>
                  )}
                  <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-md">
                    {station?.timezone || 'Timezone: Asia/Dubai'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Date Selection */}
              <Card className="shadow-md w-full">
                <CardHeader className="pb-3 px-4 sm:px-6">
                  <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                    <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-radio-orange flex-shrink-0" />
                    <span>Select Date</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
                  <div className="rounded-lg border-2 border-gray-200 bg-white p-2 sm:p-3 overflow-hidden">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="w-full"
                      classNames={{
                        months: "w-full",
                        month: "w-full space-y-1 sm:space-y-2",
                        caption: "flex justify-center pt-0.5 relative items-center mb-1 sm:mb-2 w-full",
                        caption_label: "text-xs sm:text-sm font-semibold text-gray-900",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 sm:h-8 sm:w-8 hover:bg-gray-100 hover:text-gray-900 border-gray-300",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse",
                        head_row: "flex w-full",
                        head_cell: "text-gray-600 font-medium text-[0.65rem] sm:text-[0.75rem] w-[calc(100%/7)] flex items-center justify-center py-0.5",
                        row: "flex w-full mt-0.5 sm:mt-1",
                        cell: "h-8 w-8 sm:h-9 sm:w-9 text-center text-xs p-0 relative w-[calc(100%/7)] flex items-center justify-center [&:has([aria-selected])]:bg-transparent",
                        day: "h-8 w-8 sm:h-9 sm:w-9 p-0 m-0 font-normal text-xs hover:bg-gray-100 rounded-md transition-colors cursor-pointer flex items-center justify-center w-full",
                        day_selected: "bg-radio-orange text-white hover:bg-radio-orange hover:text-white focus:bg-radio-orange focus:text-white font-semibold",
                        day_today: "bg-gray-100 text-gray-900 font-semibold",
                        day_outside: "text-gray-400 opacity-60 hover:opacity-100 hover:bg-gray-100 cursor-pointer",
                        day_disabled: "text-gray-300 opacity-30 cursor-not-allowed",
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 w-full">
                <Card className="shadow-md w-full">
                  <CardHeader className="pb-3 px-4 sm:px-6">
                    <CardTitle className="text-base sm:text-lg">
                      {selectedDate ? (
                        selectedDate.toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                      ) : (
                        'Select a date to view schedule'
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                    {selectedDate ? (
                      <div className="max-h-[400px] sm:max-h-[600px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                        {renderDaySchedule()}
                      </div>
                    ) : (
                      <div className="text-center py-8 sm:py-12 text-gray-500">
                        <CalendarIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-sm sm:text-base">Please select a date to view the program schedule</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
        </div>

        {/* Cost Information */}
        <Card className="mt-6 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 shadow-md">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Info className="h-6 w-6 text-orange-600 mt-0.5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 text-lg mb-2">Archive Services</h3>
                <p className="text-sm text-orange-800 leading-relaxed">
                  Current archive shows program schedules and block types. For detailed track listings, 
                  timestamps, and complete broadcast history, premium archive services are available. 
                  Contact Golden Pearl Radio for enterprise archive access.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
