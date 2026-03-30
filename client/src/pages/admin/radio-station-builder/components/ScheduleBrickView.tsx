import React, { useMemo, useState, useEffect } from "react";
import { format, startOfDay } from "date-fns";
import { Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduledShow {
  id: number;
  startTime: string | Date;
  endTime: string | Date;
  show: {
    title: string;
    host?: {
      name: string;
    };
  };
}

interface ScheduleBrickViewProps {
  scheduledShows: ScheduledShow[];
  selectedDate?: Date;
  onEventClick?: (schedule: ScheduledShow) => void;
  selectedEventId?: number | null;
  groupBy?: "day" | "hour" | "none";
  showDateHeaders?: boolean;
}

export default function ScheduleBrickView({
  scheduledShows,
  selectedDate,
  onEventClick,
  selectedEventId,
  groupBy = "day",
  showDateHeaders = true,
}: ScheduleBrickViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute to check if shows are active
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Check if a show is currently active
  const isShowActive = (start: Date, end: Date) => {
    const now = currentTime;
    return now >= start && now <= end;
  };

  // Process and group shows - filter by selected date
  const groupedShows = useMemo(() => {
    const selectedDayStart = selectedDate ? startOfDay(selectedDate) : null;
    const selectedDayEnd = selectedDate ? new Date(selectedDayStart!) : null;
    if (selectedDayEnd) {
      selectedDayEnd.setDate(selectedDayEnd.getDate() + 1);
    }
    
    // Debug: log selected date info
    if (selectedDayStart) {
      console.log('ScheduleBrickView - Selected date:', {
        selectedDayStart: selectedDayStart.toISOString(),
        selectedLocal: selectedDayStart.toLocaleDateString(),
        selectedComponents: `${selectedDayStart.getFullYear()}-${selectedDayStart.getMonth() + 1}-${selectedDayStart.getDate()}`,
        totalShows: scheduledShows.length
      });
    }
    
    const mapped = scheduledShows.map((s, index) => {
      const start = s.startTime instanceof Date ? s.startTime : new Date(s.startTime);
      const end = s.endTime instanceof Date ? s.endTime : new Date(s.endTime);
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      
      return {
        ...s,
        start,
        end,
        durationMinutes,
        startDay: startOfDay(start),
        startHour: start.getHours(),
        _index: index, // For debug logging
      };
    });
    
    const processed = mapped.filter(s => {
      // Filter by selected date - show if it overlaps with selected day
      if (!selectedDayStart || !selectedDayEnd) return true;
      
      // Get the start and end days in local timezone
      const showStartDay = startOfDay(s.start);
      const showEndDay = startOfDay(s.end);
      
      // Compare dates by their date components (year, month, day) to avoid timezone issues
      const selectedYear = selectedDayStart.getFullYear();
      const selectedMonth = selectedDayStart.getMonth();
      const selectedDay = selectedDayStart.getDate();
      
      const showStartYear = showStartDay.getFullYear();
      const showStartMonth = showStartDay.getMonth();
      const showStartDayNum = showStartDay.getDate();
      
      const showEndYear = showEndDay.getFullYear();
      const showEndMonth = showEndDay.getMonth();
      const showEndDayNum = showEndDay.getDate();
      
      // Check if show starts, ends, or spans the selected day
      const showStartsOnSelectedDay = 
        showStartYear === selectedYear && 
        showStartMonth === selectedMonth && 
        showStartDayNum === selectedDay;
      
      const showEndsOnSelectedDay = 
        showEndYear === selectedYear && 
        showEndMonth === selectedMonth && 
        showEndDayNum === selectedDay;
      
      const showSpansSelectedDay = 
        (showStartYear < selectedYear || (showStartYear === selectedYear && showStartMonth < selectedMonth) || 
         (showStartYear === selectedYear && showStartMonth === selectedMonth && showStartDayNum < selectedDay)) &&
        (showEndYear > selectedYear || (showEndYear === selectedYear && showEndMonth > selectedMonth) || 
         (showEndYear === selectedYear && showEndMonth === selectedMonth && showEndDayNum > selectedDay));
      
      const matches = showStartsOnSelectedDay || showEndsOnSelectedDay || showSpansSelectedDay;
      
      return matches;
    })
      .sort((a, b) => {
        // Sort by start time first
        const startDiff = a.start.getTime() - b.start.getTime();
        if (startDiff !== 0) return startDiff;
        // If start times are equal, sort by end time (shorter shows first)
        return a.end.getTime() - b.end.getTime();
      });
    
    // Debug: log filtered results
    console.log('ScheduleBrickView - Filter results:', {
      totalShows: scheduledShows.length,
      filteredShows: processed.length,
      selectedDate: selectedDayStart?.toLocaleDateString(),
      selectedComponents: selectedDayStart ? `${selectedDayStart.getFullYear()}-${selectedDayStart.getMonth() + 1}-${selectedDayStart.getDate()}` : 'none',
      processedShows: processed.map(s => ({
        id: s.id,
        title: s.show?.title,
        start: s.start.toLocaleString(),
        end: s.end.toLocaleString()
      }))
    });

    if (groupBy === "none") {
      return { all: processed };
    }

    if (groupBy === "day") {
      const grouped: Record<string, typeof processed> = {};
      processed.forEach(show => {
        // Use the actual start date in local timezone for grouping
        const showStartLocal = new Date(show.start);
        const dayKey = format(startOfDay(showStartLocal), "yyyy-MM-dd");
        if (!grouped[dayKey]) {
          grouped[dayKey] = [];
        }
        grouped[dayKey].push(show);
      });
      // Sort shows within each day group by start time, then end time
      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => {
          const startDiff = a.start.getTime() - b.start.getTime();
          if (startDiff !== 0) return startDiff;
          return a.end.getTime() - b.end.getTime();
        });
      });
      // Debug: log grouped results
      console.log('ScheduleBrickView - Grouped by day:', {
        groupKeys: Object.keys(grouped),
        groupCounts: Object.entries(grouped).map(([key, shows]) => ({ key, count: shows.length })),
        totalProcessed: processed.length
      });
      return grouped;
    }

    if (groupBy === "hour") {
      const grouped: Record<string, typeof processed> = {};
      processed.forEach(show => {
        const hourKey = `${format(show.startDay, "yyyy-MM-dd")}-${show.startHour}`;
        if (!grouped[hourKey]) {
          grouped[hourKey] = [];
        }
        grouped[hourKey].push(show);
      });
      // Sort shows within each hour group by start time, then end time
      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => {
          const startDiff = a.start.getTime() - b.start.getTime();
          if (startDiff !== 0) return startDiff;
          return a.end.getTime() - b.end.getTime();
        });
      });
      return grouped;
    }

    return { all: processed };
  }, [scheduledShows, groupBy, selectedDate]);

  const getDurationDisplay = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getHeightByDuration = (minutes: number) => {
    // Dynamic height based on duration - minimum 80px, scales with duration
    const baseHeight = 80;
    const minHeight = 60;
    const height = Math.max(minHeight, baseHeight + (minutes * 2));
    return Math.min(height, 300); // Cap at 300px
  };

  if (groupBy === "none") {
    // Debug: log what we're about to render
    console.log('ScheduleBrickView - Rendering (groupBy=none):', {
      hasAll: !!groupedShows.all,
      allLength: groupedShows.all?.length || 0,
      allShows: groupedShows.all?.map(s => ({
        id: s.id,
        title: s.show?.title,
        start: s.start.toLocaleString(),
        end: s.end.toLocaleString()
      })) || []
    });
    
    if (!groupedShows.all || groupedShows.all.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">No shows scheduled</p>
            <p className="text-sm mt-2">Select a date to view scheduled shows</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative min-h-[500px]">
        {/* Vertical queue - one brick per horizontal line */}
        <div className="space-y-4">
          {groupedShows.all.map((schedule) => {
            const isSelected = selectedEventId === schedule.id;
            const isActive = isShowActive(schedule.start, schedule.end);
            const brickHeight = getHeightByDuration(schedule.durationMinutes);
            
            return (
              <div
                key={schedule.id}
                className={cn(
                  "relative rounded-lg border-2 cursor-pointer transition-all overflow-visible",
                  "hover:shadow-lg",
                  isActive
                    ? "bg-radio-cyan/10 border-radio-cyan ring-2 ring-radio-cyan shadow-lg"
                    : isSelected
                    ? "bg-yellow-50 border-yellow-400 ring-2 ring-yellow-300 shadow-md"
                    : "bg-white border-gray-200 hover:border-blue-300"
                )}
                style={{
                  minHeight: `${brickHeight}px`,
                }}
                onClick={() => onEventClick?.(schedule)}
              >
                {isActive && (
                  <div className="absolute top-2 right-2 bg-radio-cyan text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse z-10 shadow-lg">
                    LIVE
                  </div>
                )}
                <div className="p-4 h-full flex flex-col">
                  {/* Time Interval Badge */}
                  <div className={cn(
                    "mb-3 px-3 py-1.5 rounded-md text-sm font-semibold text-center shadow-sm",
                    isActive
                      ? "bg-radio-cyan text-white border border-radio-deep-blue"
                      : isSelected
                      ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                      : "bg-blue-100 text-blue-800 border border-blue-300"
                  )}>
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4 flex-shrink-0" />
                      <span className="font-mono text-xs sm:text-sm">
                        {format(schedule.start, "HH:mm")} - {format(schedule.end, "HH:mm")}
                      </span>
                    </div>
                  </div>
                  
                  <div className="font-semibold text-lg mb-2 flex-1 text-gray-900">
                    {schedule.show.title || 'Untitled Show'}
                  </div>
                  {schedule.show.host && (
                    <div className="text-sm text-gray-600 mb-3 font-medium">
                      Host: <span className="text-gray-800">{schedule.show.host.name}</span>
                    </div>
                  )}
                  <div className="space-y-2 text-sm mt-auto pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="h-4 w-4 flex-shrink-0 text-gray-500" />
                      <span className="font-mono text-xs">
                        {format(schedule.start, "MMM dd, yyyy")}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      Duration: {getDurationDisplay(schedule.durationMinutes)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const allShows = Object.values(groupedShows).flat();
  if (allShows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <div className="text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">No shows scheduled</p>
          <p className="text-sm mt-2">Select a date to view scheduled shows</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedShows)
        .sort(([keyA], [keyB]) => {
          // Sort groups by their key (date/time) in ascending order
          if (groupBy === "hour") {
            // For hour grouping, key format is "yyyy-MM-dd-HH"
            const [dateA, hourA] = keyA.split('-');
            const [dateB, hourB] = keyB.split('-');
            const dateCompare = dateA.localeCompare(dateB);
            if (dateCompare !== 0) return dateCompare;
            return parseInt(hourA || '0') - parseInt(hourB || '0');
          } else {
            // For day grouping, key format is "yyyy-MM-dd"
            return keyA.localeCompare(keyB);
          }
        })
        .map(([key, shows]) => {
        if (shows.length === 0) return null;
        
        const [datePart, hourPart] = key.split('-');
        const groupDate = new Date(datePart + (hourPart ? `T${hourPart}:00:00` : 'T00:00:00'));
        
        return (
          <div key={key} className="space-y-3">
            {showDateHeaders && (
              <div className="sticky top-0 z-10 bg-white py-3 border-b-2 border-gray-300 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800">
                  {groupBy === "hour" 
                    ? `${format(groupDate, "MMM dd, yyyy")} - ${format(groupDate, "HH:mm")}`
                    : format(groupDate, "EEEE, MMMM dd, yyyy")
                  }
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({shows.length} show{shows.length !== 1 ? 's' : ''})
                  </span>
                </h3>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {shows.map(schedule => {
                const isSelected = selectedEventId === schedule.id;
                const isActive = isShowActive(schedule.start, schedule.end);
                return (
                  <div
                    key={schedule.id}
                    className={cn(
                      "rounded-lg border-2 cursor-pointer transition-all overflow-hidden relative",
                      "hover:shadow-lg",
                      isActive
                        ? "bg-radio-cyan/10 border-radio-cyan ring-2 ring-radio-cyan shadow-lg"
                        : isSelected
                        ? "bg-yellow-50 border-yellow-400 ring-2 ring-yellow-300 shadow-md"
                        : "bg-white border-gray-200 hover:border-blue-300"
                    )}
                    style={{
                      minHeight: `${getHeightByDuration(schedule.durationMinutes)}px`,
                    }}
                    onClick={() => onEventClick?.(schedule)}
                  >
                    <div className="p-4 h-full flex flex-col">
                      {isActive && (
                        <div className="absolute top-2 right-2 bg-radio-cyan text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse z-10">
                          LIVE
                        </div>
                      )}
                      {/* Time Interval Badge */}
                      <div className={cn(
                        "mb-3 px-3 py-1.5 rounded-md text-sm font-semibold text-center shadow-sm",
                        isActive
                          ? "bg-radio-cyan text-white border border-radio-deep-blue"
                          : isSelected
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                          : "bg-blue-100 text-blue-800 border border-blue-300"
                      )}>
                        <div className="flex items-center justify-center gap-2">
                          <Clock className="h-4 w-4 flex-shrink-0" />
                          <span className="font-mono text-xs">
                            {format(schedule.start, "HH:mm")} - {format(schedule.end, "HH:mm")}
                          </span>
                        </div>
                      </div>
                      
                      <div className="font-semibold text-lg mb-2 flex-1 text-gray-900">
                        {schedule.show.title || 'Untitled Show'}
                      </div>
                      {schedule.show.host && (
                        <div className="text-sm text-gray-600 mb-3 font-medium">
                          Host: <span className="text-gray-800">{schedule.show.host.name}</span>
                        </div>
                      )}
                      <div className="space-y-2 text-sm mt-auto pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Calendar className="h-4 w-4 flex-shrink-0 text-gray-500" />
                          <span className="font-mono text-xs">
                            {format(schedule.start, "MMM dd, yyyy")}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 font-medium">
                          Duration: {getDurationDisplay(schedule.durationMinutes)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

