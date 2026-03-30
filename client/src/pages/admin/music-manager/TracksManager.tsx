import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import type { Track } from "@/types/api-models";
import { Card, CardContent } from "@/components/ui/card";

// Extended Track type with relations
interface TrackWithRelations extends Omit<Track, 'albumId'> {
  likesCount: number;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Music, ListMusic, Plus, Search, Filter, Clock, Play, Edit, Trash2, ArrowUpDown, Heart, Image as ImageIcon, Upload, FileAudio
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";



import TrackFormDialog from "./TrackFormDialog";

import { usePlayer } from "@/components/player/PlayerProvider";
import { useAuth } from "@/contexts/AuthContext";

export default function TracksManager() {
  const [isTrackFormOpen, setIsTrackFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [trackFormMode, setTrackFormMode] = useState<"full" | "cover" | "audio" | "metadata">("full");
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Track | "";
    direction: "ascending" | "descending";
  }>({ key: "", direction: "ascending" });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const player = usePlayer();
  const { user } = useAuth();

  // Use current user from auth context (already has id)
  const dbUser = user;

  // Fetch tracks with likes count
  const { data: tracks, isLoading: isLoadingTracks } = useQuery<Track[]>({
    queryKey: ["tracks"],
    queryFn: async () => {
      // Get all tracks from API
      const tracksData = await api.get("/tracks");
      
      console.log('Fetched tracks:', tracksData);
      
      // For now, return tracks with likesCount: 0
      // TODO: Add likes count endpoint or include in tracks response
      return (tracksData || []).map((track: any) => ({
        ...track,
        likesCount: 0, // Will be updated when we add likes API
      }));
    },
  });

  // Fetch liked tracks for current user (TODO: Add likes API endpoint)
  const { data: likedTracks } = useQuery<number[]>({
    queryKey: ['user-liked-tracks', dbUser?.id],
    queryFn: async () => {
      if (!dbUser?.id) return [];
      // TODO: Add GET /api/likes endpoint
      return [];
    },
    enabled: !!dbUser?.id,
  });

  const resolveTrackCoverUrl = (cover?: string | null) => {
    if (!cover) return undefined;
    // If it's already a full URL, return it
    if (cover.startsWith('http')) return cover;
    // If it's a relative path, make it absolute
    if (cover.startsWith('/')) return `${window.location.origin}${cover}`;
    // Otherwise return as-is
    return cover;
  };

  // Delete track mutation
  const deleteTrackMutation = useMutation({
    mutationFn: async (track: Track) => {
      // Delete track via API (backend handles file cleanup if needed)
      await api.delete(`/tracks/${track.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      toast({
        title: "Track Deleted",
        description: "The track has been successfully removed from the library.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete track: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Format seconds as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Check if a track is liked by current user
  const isTrackLiked = (trackId: number) => {
    return likedTracks?.includes(trackId) || false;
  };

  // Handle like/unlike for a track
  const handleLikeTrack = async (track: Track) => {
    if (!dbUser) {
      toast({
        title: "Authentication Required",
        description: "Please log in to like tracks.",
        variant: "destructive",
      });
      return;
    }

    try {
      const isLiked = isTrackLiked(track.id);

      // TODO: Add likes API endpoints
      // For now, just show a message
      toast({
        title: isLiked ? "Track Unliked" : "Track Liked",
        description: `${isLiked ? 'Removed' : 'Added'} ${track.title} ${isLiked ? 'from' : 'to'} your liked tracks.`,
      });

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['user-liked-tracks', dbUser.id] });
      queryClient.invalidateQueries({ queryKey: ['tracks'] }); // Refresh track likes count

    } catch (error) {
      console.error('Error toggling track like:', error);
      toast({
        title: "Error",
        description: `Failed to ${isTrackLiked(track.id) ? 'unlike' : 'like'} track.`,
        variant: "destructive",
      });
    }
  };

  // Total duration across all tracks (in seconds) - handle missing durations
  const totalDurationSeconds = tracks
    ? tracks.reduce((sum, t) => sum + (t.duration ?? 0), 0)
    : 0;
  const totalDurationMinutes = Math.floor(totalDurationSeconds / 60);
  const totalDurationRemSeconds = totalDurationSeconds % 60;

  // Filter tracks based on search query
  const filteredTracks = tracks?.filter(
    (track) =>
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (track.genre && track.genre.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort tracks
  const sortedTracks =
    filteredTracks && sortConfig.key
      ? [...filteredTracks].sort((a, b) => {
          const aValue = a[sortConfig.key as keyof Track];
          const bValue = b[sortConfig.key as keyof Track];

          if (aValue === null || aValue === undefined)
            return sortConfig.direction === "ascending" ? -1 : 1;
          if (bValue === null || bValue === undefined)
            return sortConfig.direction === "ascending" ? 1 : -1;

          if (typeof aValue === "string" && typeof bValue === "string") {
            return sortConfig.direction === "ascending"
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          }

          return sortConfig.direction === "ascending"
            ? aValue < bValue
              ? -1
              : 1
            : aValue > bValue
            ? -1
            : 1;
        })
      : filteredTracks;

  const handleSort = (key: keyof Track) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "ascending"
          ? "descending"
          : "ascending",
    });
  };

  const handleEditTrack = (track: Track) => {
    setSelectedTrack(track);
    setTrackFormMode("full");
    setIsTrackFormOpen(true);
  };

  const handleDeleteClick = (track: Track) => {
    setSelectedTrack(track);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedTrack) {
      deleteTrackMutation.mutate(selectedTrack);
      setIsDeleteDialogOpen(false);
      setSelectedTrack(null);
    }
  };

  const handleChangeCover = (track: Track) => {
    setSelectedTrack(track);
    setTrackFormMode("cover");
    setIsTrackFormOpen(true);
  };

  const handleChangeAudio = (track: Track) => {
    setSelectedTrack(track);
    setTrackFormMode("audio");
    setIsTrackFormOpen(true);
  };

  const handleChangeMetadata = (track: Track) => {
    setSelectedTrack(track);
    setTrackFormMode("metadata");
    setIsTrackFormOpen(true);
  };

  const handlePlayPause = (trackId: number, trackUrl: string) => {
    const track = tracks?.find((t) => t.id === trackId);
    if (!track) {
      toast({
        title: "Error",
        description: "Track not found",
        variant: "destructive",
      });
      return;
    }

    // Ensure URL is absolute
    let playUrl = track.url;
    if (playUrl && !playUrl.startsWith('http')) {
      // Make it absolute
      const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://127.0.0.1:3001';
      playUrl = `${baseUrl}${playUrl.startsWith('/') ? '' : '/'}${playUrl}`;
    }

    console.log('Playing track:', track.title, 'URL:', playUrl);

    // Use PlayerProvider for main playback (shows PlayerDock)
    player.playTrack({ ...track, url: playUrl });

    toast({
      title: "Now Playing",
      description: `${track.title} by ${track.artist}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="gp-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">
                  Total Tracks
                </p>
                <h3 className="mt-2 font-gp-brand text-[1.35rem] text-[color:var(--gp-white)]">
                  {tracks?.length || 0}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Music className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">
                  Total Duration
                </p>
                <h3 className="mt-2 font-gp-brand text-[1.35rem] text-[color:var(--gp-white)]">
                  {`${totalDurationMinutes}:${totalDurationRemSeconds.toString().padStart(2, "0")}`}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">
                  Genres
                </p>
                <h3 className="mt-2 font-gp-brand text-[1.35rem] text-[color:var(--gp-white)]">
                  {tracks ? new Set(tracks.map((t) => t.genre).filter(Boolean)).size : 0}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <ListMusic className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">
                  Now Playing
                </p>
                <h3 className="mt-2 font-gp-sans text-[0.85rem] text-[color:var(--gp-white)]/90">
                  {player.audioState.isPlaying ? "Active" : "Paused"}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Play className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card className="gp-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--gp-white)]/55" size={20} />
              <Input
                placeholder="Search by title, artist, or genre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
              >
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button
                onClick={() => {
                  setSelectedTrack(null);
                  setTrackFormMode("full");
                  setIsTrackFormOpen(true);
                }}
                className="gap-2 bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
              >
                <Plus className="h-4 w-4" /> Add Track
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tracks Table */}
      <Card className="gp-card overflow-hidden">
        <CardContent className="p-0">
          {isLoadingTracks ? (
            <div className="flex flex-col justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--gp-gold)]"></div>
              <p className="mt-4 font-gp-serif italic text-[color:var(--gp-muted)]">Loading tracks...</p>
            </div>
          ) : sortedTracks?.length === 0 ? (
            <div className="text-center py-16">
              <div className="border border-[var(--gp-border-gold)] rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center bg-[rgba(6,13,26,0.35)]">
                <Music className="h-12 w-12 text-[color:var(--gp-gold)]/90" />
              </div>
              <h3 className="mt-6 font-gp-display text-xl font-semibold text-[color:var(--gp-white)]">No tracks found</h3>
              <p className="mt-2 text-sm text-[color:var(--gp-white)]/75 max-w-sm mx-auto font-gp-serif italic">
                {searchQuery
                  ? "No tracks match your search criteria. Try a different search term."
                  : "Get started by adding your first track to the music library."}
              </p>
              <div className="mt-8">
                <Button
                  onClick={() => {
                    setSelectedTrack(null);
                    setIsTrackFormOpen(true);
                  }}
                  className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] gap-2 font-sans text-sm font-semibold tracking-normal"
                  size="lg"
                >
                  <Plus className="h-5 w-5" /> Add Your First Track
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
          <TableRow className="bg-[rgba(6,13,26,0.55)] hover:bg-[rgba(6,13,26,0.55)] border-b border-[var(--gp-border-gold)]/40">
            <TableHead className="w-14"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">#</span></TableHead>
            <TableHead className="w-12"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Cover</span></TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="cursor-pointer hover:bg-white/5" onClick={() => handleSort("title")}>
                      <div className="flex items-center gap-1 font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">
                        Title
                        <ArrowUpDown
                          className={`ml-1 h-4 w-4 ${
                            sortConfig.key === "title" ? "text-[var(--gp-gold-bright)]" : "text-[color:var(--gp-white)]/35"
                          }`}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-white/5" onClick={() => handleSort("artist")}>
                      <div className="flex items-center gap-1 font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">
                        Artist
                        <ArrowUpDown
                          className={`ml-1 h-4 w-4 ${
                            sortConfig.key === "artist" ? "text-[var(--gp-gold-bright)]" : "text-[color:var(--gp-white)]/35"
                          }`}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-white/5" onClick={() => handleSort("duration")}>
                      <div className="flex items-center gap-1 font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">
                        Duration
                        <ArrowUpDown
                          className={`ml-1 h-4 w-4 ${
                            sortConfig.key === "duration" ? "text-[var(--gp-gold-bright)]" : "text-[color:var(--gp-white)]/35"
                          }`}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Genre</TableHead>
                    <TableHead className="font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Mood</TableHead>
                    <TableHead className="font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Likes</TableHead>
                    <TableHead className="text-right font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTracks?.map((track, index) => (
                    <TableRow key={track.id} className="hover:bg-white/5 transition-colors border-b border-[var(--gp-border-gold)]/15">
                      <TableCell className="font-gp-sans text-[color:var(--gp-white)]/75 text-sm">{index + 1}</TableCell>
                      <TableCell>
                        {track.coverArt ? (
                          <img 
                            src={resolveTrackCoverUrl(track.coverArt)} 
                            alt={track.title} 
                            className="w-10 h-10 rounded-[2px] object-cover border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)]"
                            onError={(e) => {
                              // Fallback if image fails to load
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-10 h-10 rounded-[2px] border border-[rgba(201,168,76,0.35)] bg-[rgba(6,13,26,0.35)] flex items-center justify-center"><svg class="h-5 w-5" style="color: rgba(201,168,76,0.9)" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg></div>';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-[2px] border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)] flex items-center justify-center">
                            <Music className="h-5 w-5 text-[color:var(--gp-gold)]/90" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/70"
                          onClick={() => handlePlayPause(track.id, track.url)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-gp-sans font-medium text-[color:var(--gp-white)]">{track.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[color:var(--gp-white)]/85 font-gp-serif italic">{track.artist}</TableCell>
                      <TableCell className="text-[color:var(--gp-white)]/70 font-gp-sans text-sm">{formatDuration(track.duration)}</TableCell>
                      <TableCell>
                        {track.genre ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border border-[var(--gp-border-gold)]/40 bg-[rgba(6,13,26,0.4)] text-[color:var(--gp-white)]/80">
                            {track.genre}
                          </span>
                        ) : (
                          <span className="text-[color:var(--gp-white)]/35">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {track.mood ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border border-[var(--gp-border-gold)]/40 bg-[rgba(6,13,26,0.4)] text-[color:var(--gp-white)]/80">
                            {track.mood}
                          </span>
                        ) : (
                          <span className="text-[color:var(--gp-white)]/35">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLikeTrack(track)}
                            disabled={!dbUser}
                            className={`h-8 w-8 p-0 hover:bg-white/5 ${
                              isTrackLiked(track.id) 
                                ? 'text-[var(--gp-gold-bright)] hover:text-[var(--gp-gold-bright)]' 
                                : 'text-[color:var(--gp-white)]/45 hover:text-[var(--gp-gold-bright)]'
                            }`}
                            title={dbUser ? (isTrackLiked(track.id) ? 'Unlike track' : 'Like track') : 'Login to like tracks'}
                          >
                            <Heart 
                              className={`h-4 w-4 ${isTrackLiked(track.id) ? 'fill-current' : ''}`} 
                            />
                          </Button>
                          <span className="text-sm text-[color:var(--gp-white)]/70 font-gp-sans">
                            {track.likesCount || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="flex flex-col gap-1">
                            {/* Row 1: Cover, Audio, Metadata */}
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleChangeCover(track)}
                                className="h-6 w-6 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/60"
                                title="Change cover"
                              >
                                <ImageIcon className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleChangeAudio(track)}
                                className="h-6 w-6 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/60"
                                title="Change audio"
                              >
                                <FileAudio className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleChangeMetadata(track)}
                                className="h-6 w-6 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/60"
                                title="Edit metadata"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                            {/* Row 2: Delete */}
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(track)}
                                className="h-6 w-6 hover:bg-white/5 hover:text-red-400 text-[color:var(--gp-white)]/60"
                                title="Delete track"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Track Form Dialog */}
          <TrackFormDialog
        open={isTrackFormOpen}
        onOpenChange={setIsTrackFormOpen}
        selectedTrack={selectedTrack}
        mode={trackFormMode}
        onSuccess={() => {
          // Refresh tracks data (match the query key used for fetching)
          queryClient.invalidateQueries({ queryKey: ['tracks'] });
          setIsTrackFormOpen(false);
          setSelectedTrack(null);
          setTrackFormMode("full");
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[rgba(6,13,26,0.95)] border border-[var(--gp-border-gold)] text-[color:var(--gp-white)] rounded-[2px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-gp-display text-[color:var(--gp-white)]">Delete Track</AlertDialogTitle>
            <AlertDialogDescription className="text-[color:var(--gp-white)]/75 font-gp-serif italic">
              Are you sure you want to delete "{selectedTrack?.title}" by {selectedTrack?.artist}? 
              This action cannot be undone and will permanently remove the track from the library.
              {selectedTrack?.coverArt && (
                <span className="block mt-2 text-red-300 font-gp-sans text-xs uppercase tracking-[0.12em]">
                  ⚠️ Note: Associated files will be removed from storage.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 rounded-[2px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600 text-white rounded-[2px]"
            >
              {deleteTrackMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
