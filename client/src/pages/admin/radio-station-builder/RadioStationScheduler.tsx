import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Search, Radio, Plus, Clock, Trash2, Calendar, Grid3x3 } from "lucide-react";
import type { ScheduledShow, Show, RadioStation, Host } from "@/types/api-models";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { format, startOfDay } from 'date-fns';
import { cn } from "@/lib/utils";
import ScheduleBrickView from './components/ScheduleBrickView';

// Types
type ShowWithDuration = Show & { host: Host; duration: number };
type ScheduledShowWithRelations = ScheduledShow & {
  show: Show & { host: Host };
  radioStation: RadioStation;
};

export default function RadioStationScheduler() {
  const queryClient = useQueryClient();
  
  // Simple state
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [viewMode, setViewMode] = useState<"timeline" | "brick">("brick");
  const [schedulingShow, setSchedulingShow] = useState<ShowWithDuration | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledShowWithRelations | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  // Fetch data
  const { data: stations = [] } = useQuery({
    queryKey: ['radio-stations'],
    queryFn: async () => {
      const data = await api.get<RadioStation[]>('/radio-stations');
      return data || [];
    },
  });

  const { data: shows = [] } = useQuery({
    queryKey: ['shows'],
    queryFn: async () => {
      const data = await api.get<any[]>('/shows');
      const list = data || [];
      return list.map((show: any) => {
        const items = show.showItems || [];
        const duration = items.reduce((acc: number, it: any) => {
          const startTrim = it.playbackStartTime ?? 0;
          const endTrim = it.playbackEndTime ?? 0;
          return acc + Math.max(0, endTrim - startTrim);
        }, 0);
        return { ...show, duration: duration > 0 ? duration : 1800 } as ShowWithDuration;
      });
    },
  });

  const { data: scheduledShows = [] } = useQuery({
    queryKey: ['scheduled-shows', selectedStationId],
    queryFn: async () => {
      if (!selectedStationId) return [];
      const data = await api.get<ScheduledShowWithRelations[]>(`/scheduled-shows?stationId=${selectedStationId}`);
      return data || [];
    },
    enabled: !!selectedStationId,
  });

  // Simple scheduling function
  const handleSchedule = async () => {
    if (!schedulingShow || !scheduleDateTime || !selectedStationId) {
      toast.error("Please fill in all fields");
      console.error('Missing fields:', { schedulingShow: !!schedulingShow, scheduleDateTime, selectedStationId });
      return;
    }

    // Parse datetime-local input (format: YYYY-MM-DDTHH:mm)
    // This is in local time, so we need to handle it correctly
    let startTime: Date;
    try {
      // datetime-local gives us local time, so we create the date directly
      startTime = new Date(scheduleDateTime);
      
      // Validate date
      if (isNaN(startTime.getTime())) {
        toast.error("Invalid date/time format");
        console.error('Invalid date:', scheduleDateTime);
        return;
      }
    } catch (error) {
      console.error('Date parsing error:', error, scheduleDateTime);
      toast.error("Invalid date/time format");
      return;
    }

    // Use actual duration in seconds (not rounded to minutes)
    const durationSeconds = schedulingShow.duration || 1800;
    const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

    // Validate end time is after start time
    if (endTime <= startTime) {
      toast.error("End time must be after start time");
      return;
    }

    // Check conflicts - two shows conflict ONLY if they overlap
    // No conflict if: one ends exactly when another starts (back-to-back is allowed)
    // Conflict exists if: startTime < sEnd AND endTime > sStart
    const conflicts = scheduledShows.filter(s => {
      const sStart = new Date(s.startTime);
      const sEnd = new Date(s.endTime);
      
      // Validate dates
      if (isNaN(sStart.getTime()) || isNaN(sEnd.getTime())) {
        return false; // Skip invalid dates
      }
      
      // Only conflict if there's actual overlap (not just touching)
      // Example: Show A ends at 5:25, Show B starts at 5:37 -> NO conflict (gap exists)
      // Example: Show A ends at 5:25, Show B starts at 5:25 -> NO conflict (exact boundary)
      // Example: Show A ends at 5:30, Show B starts at 5:25 -> CONFLICT (overlap)
      const hasOverlap = startTime < sEnd && endTime > sStart;
      
      return hasOverlap;
    });

    if (conflicts.length > 0) {
      if (!confirm(`This time conflicts with ${conflicts.length} show(s). Schedule anyway?`)) {
        return;
      }
    }

    console.log('Scheduling show:', {
      showId: schedulingShow.id,
      radioStationId: selectedStationId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      localStart: startTime.toLocaleString(),
      localEnd: endTime.toLocaleString(),
    });

    try {
      const data: any = await api.post('/scheduled-shows', {
        showId: schedulingShow.id,
        radioStationId: parseInt(selectedStationId, 10),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      console.log('Schedule success:', data);
      toast.success("Show scheduled successfully!");
      setSchedulingShow(null);
      setScheduleDateTime("");
      // Update selectedDate to the scheduled date so the show appears immediately
      if (data?.startTime) {
        const scheduledDate = new Date(data.startTime);
        // Normalize to start of day in local timezone
        const localDate = startOfDay(scheduledDate);
        console.log('Updating selectedDate - Local:', localDate.toLocaleDateString(), 'ISO:', localDate.toISOString(), 'from scheduled:', scheduledDate.toLocaleDateString());
        setSelectedDate(localDate);
        // Invalidate and refetch immediately
        await queryClient.invalidateQueries({ queryKey: ['scheduled-shows', selectedStationId] });
        await queryClient.refetchQueries({ queryKey: ['scheduled-shows', selectedStationId] });
      } else {
        // Invalidate and refetch the query
        await queryClient.invalidateQueries({ queryKey: ['scheduled-shows', selectedStationId] });
        await queryClient.refetchQueries({ queryKey: ['scheduled-shows', selectedStationId] });
      }
    } catch (error: any) {
      console.error('Schedule error:', error);
      toast.error(`Failed to schedule: ${error?.message || 'Unknown error'}`);
    }
  };

  // Update schedule
  const handleUpdate = async () => {
    if (!editingSchedule || !scheduleDateTime) {
      toast.error("Please fill in all fields");
      return;
    }

    const startTime = new Date(scheduleDateTime);
    
    // Validate date
    if (isNaN(startTime.getTime())) {
      toast.error("Invalid date/time");
      return;
    }

    // Get show with duration from shows list
    const show = shows.find(s => s.id === editingSchedule.showId);
    if (!show) {
      toast.error("Show not found");
      return;
    }

    // Use actual duration in seconds (not rounded to minutes)
    const durationSeconds = show.duration || 1800;
    const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

    // Validate end time is after start time
    if (endTime <= startTime) {
      toast.error("End time must be after start time");
      return;
    }

    // Check for conflicts (excluding the event being updated)
    // Conflict exists if: startTime < sEnd AND endTime > sStart
    const conflicts = scheduledShows.filter(s => {
      if (s.id === editingSchedule.id) return false; // Exclude current schedule
      const sStart = new Date(s.startTime);
      const sEnd = new Date(s.endTime);
      
      // Validate dates
      if (isNaN(sStart.getTime()) || isNaN(sEnd.getTime())) {
        return false; // Skip invalid dates
      }
      
      // Only conflict if there's actual overlap (not just touching)
      // Example: Show A ends at 5:25, Show B starts at 5:37 -> NO conflict (gap exists)
      // Example: Show A ends at 5:25, Show B starts at 5:25 -> NO conflict (exact boundary)
      // Example: Show A ends at 5:30, Show B starts at 5:25 -> CONFLICT (overlap)
      const hasOverlap = startTime < sEnd && endTime > sStart;
      
      return hasOverlap;
    });

    if (conflicts.length > 0) {
      if (!confirm(`This time conflicts with ${conflicts.length} show(s). Update anyway?`)) {
        return;
      }
    }

    try {
      await api.put(`/scheduled-shows/${editingSchedule.id}`, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      toast.success("Schedule updated!");
      setEditingSchedule(null);
      setScheduleDateTime("");
      // Update selectedDate to the updated date
      if (editingSchedule) {
        const updatedDate = new Date(editingSchedule.startTime);
        setSelectedDate(startOfDay(updatedDate));
      }
      // Invalidate and refetch the query
      await queryClient.invalidateQueries({ queryKey: ['scheduled-shows', selectedStationId] });
      await queryClient.refetchQueries({ queryKey: ['scheduled-shows', selectedStationId] });
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(`Failed: ${error?.message || 'Unknown error'}`);
    }
  };

  // Delete schedule
  const handleDelete = async (schedule: ScheduledShowWithRelations) => {
    if (!confirm(`Delete "${schedule.show.title}"?`)) return;

    try {
      await api.delete(`/scheduled-shows/${schedule.id}`);
      toast.success("Deleted!");
      // Close the edit dialog
      setEditingSchedule(null);
      setScheduleDateTime("");
      // Invalidate and refetch the query
      await queryClient.invalidateQueries({ queryKey: ['scheduled-shows', selectedStationId] });
      await queryClient.refetchQueries({ queryKey: ['scheduled-shows', selectedStationId] });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(`Failed: ${error?.message || 'Unknown error'}`);
    }
  };

  // Filter shows
  const filteredShows = useMemo(() => {
    if (!searchQuery.trim()) return shows;
    const query = searchQuery.toLowerCase();
    return shows.filter(s => 
      s.title?.toLowerCase().includes(query) ||
      s.host?.name?.toLowerCase().includes(query)
    );
  }, [shows, searchQuery]);

  // Sort scheduled shows by start time, then end time
  const sortedScheduledShows = useMemo(() => {
    const sorted = [...scheduledShows]
      .filter(s => s.show && s.startTime && s.endTime)
      .sort((a, b) => {
        const startDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        if (startDiff !== 0) return startDiff;
        // If start times are equal, sort by end time (shorter shows first)
        return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
      });
    console.log('sortedScheduledShows:', sorted.length, 'shows, selectedDate:', selectedDate?.toISOString());
    return sorted;
  }, [scheduledShows, selectedDate]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold">Schedule Shows</h2>
        <p className="text-gray-600 mt-1">Simple scheduling for your radio station</p>
      </div>

      {/* Station Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Select Station
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select 
            value={selectedStationId} 
            onValueChange={(value) => {
              setSelectedStationId(value);
              // Reset editing state when station changes
              setEditingSchedule(null);
              setSchedulingShow(null);
              setScheduleDateTime("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a radio station..." />
            </SelectTrigger>
            <SelectContent>
              {stations.map(station => (
                <SelectItem key={station.id} value={station.id.toString()}>
                  {station.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedStationId && (
            <p className="text-sm text-gray-500 mt-2">
              {scheduledShows.length} show{scheduledShows.length !== 1 ? 's' : ''} scheduled
            </p>
          )}
        </CardContent>
      </Card>

      {selectedStationId && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Shows List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Available Shows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search shows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredShows.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No shows found</p>
                ) : (
                  filteredShows.map(show => (
                    <div
                      key={show.id}
                      className="p-3 bg-white border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="font-medium text-sm">{show.title || 'Untitled Show'}</div>
                      <div className="text-xs text-gray-500">{show.host?.name}</div>
                      {show.duration && (
                        <div className="text-xs text-gray-400 mt-1">
                          {Math.floor(show.duration / 60)}:{(show.duration % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                      <Button
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => {
                          setSchedulingShow(show);
                          // Set default to current date/time in local format for datetime-local input
                          const now = new Date();
                          // Get local date/time string in format YYYY-MM-DDTHH:mm
                          const year = now.getFullYear();
                          const month = String(now.getMonth() + 1).padStart(2, '0');
                          const day = String(now.getDate()).padStart(2, '0');
                          const hours = String(now.getHours()).padStart(2, '0');
                          const minutes = String(now.getMinutes()).padStart(2, '0');
                          const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
                          setScheduleDateTime(dateTimeString);
                          console.log('Setting schedule for show:', show.title, 'at:', dateTimeString);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Schedule
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Brick Grid View */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Scheduled Shows</CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={format(selectedDate, "yyyy-MM-dd")}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : new Date();
                      setSelectedDate(startOfDay(date));
                    }}
                    className="w-auto"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                {sortedScheduledShows.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No shows scheduled yet</p>
                    <p className="text-sm text-gray-400 mt-2">Select a show from the list and click Schedule</p>
                  </div>
                ) : (
                  <ScheduleBrickView
                    scheduledShows={sortedScheduledShows.map(s => ({
                      id: s.id,
                      startTime: s.startTime,
                      endTime: s.endTime,
                      show: {
                        title: s.show.title || 'Untitled Show',
                        host: s.show.host ? { name: s.show.host.name } : undefined,
                      },
                    }))}
                    selectedDate={selectedDate}
                    onEventClick={(schedule) => {
                      const fullSchedule = sortedScheduledShows.find(s => s.id === schedule.id);
                      if (fullSchedule) {
                        setEditingSchedule(fullSchedule);
                        setScheduleDateTime(format(new Date(fullSchedule.startTime), "yyyy-MM-dd'T'HH:mm"));
                      }
                    }}
                    selectedEventId={editingSchedule?.id || null}
                    groupBy="none"
                    showDateHeaders={false}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Schedule Dialog */}
      <Dialog 
        open={!!schedulingShow} 
        onOpenChange={(open) => {
          if (!open) {
            setSchedulingShow(null);
            setScheduleDateTime("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Show</DialogTitle>
            <DialogDescription>
              Select a date and time to schedule this show on the radio station.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <div className="font-medium">{schedulingShow?.title}</div>
              <div className="text-sm text-gray-500">{schedulingShow?.host?.name}</div>
              {schedulingShow?.duration && (
                <div className="text-xs text-gray-400 mt-1">
                  Duration: {Math.floor(schedulingShow.duration / 60)}:{(schedulingShow.duration % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="mt-1"
                required
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the date and time when this show should start (24-hour format)
              </p>
              {scheduleDateTime && (
                <p className="text-xs text-blue-600 mt-1">
                  Selected: {new Date(scheduleDateTime).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setSchedulingShow(null);
                setScheduleDateTime("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSchedule}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog 
        open={!!editingSchedule} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingSchedule(null);
            setScheduleDateTime("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              Update the date and time for this scheduled show.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <div className="font-medium">{editingSchedule?.show.title}</div>
              <div className="text-sm text-gray-500">{editingSchedule?.show.host?.name}</div>
              {editingSchedule && (() => {
                const show = shows.find(s => s.id === editingSchedule.showId);
                const duration = show?.duration || 1800;
                return (
                  <div className="text-xs text-gray-400 mt-1">
                    Duration: {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                  </div>
                );
              })()}
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="mt-1"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Update the date and time for this scheduled show
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => editingSchedule && handleDelete(editingSchedule)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setEditingSchedule(null);
                setScheduleDateTime("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!selectedStationId && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Please select a radio station to start scheduling</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
