import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import type { Talk } from "@/types/api-models";
import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mic, Plus, Search, Filter, Clock, Play, Edit, Trash2, ArrowUpDown, Globe, Tag, Image
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

import TalkFormDialog from "./TalkFormDialog";

import { usePlayer } from "@/components/player/PlayerProvider";

export default function TalksManager() {
  const [isTalkFormOpen, setIsTalkFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [talkFormMode, setTalkFormMode] = useState<"full" | "audio" | "metadata" | "cover">("full");
  const [selectedTalk, setSelectedTalk] = useState<Talk | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Talk | "";
    direction: "ascending" | "descending";
  }>({ key: "", direction: "ascending" });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const player = usePlayer();

  // Fetch talks
  const { data: talks, isLoading: isLoadingTalks } = useQuery<Talk[]>({
    queryKey: ["talks"],
    queryFn: async () => {
      const data = await api.get<Talk[]>("/talks");
      return data || [];
    },
  });

  // Delete talk mutation
  const deleteTalkMutation = useMutation({
    mutationFn: async (talk: Talk) => {
      await api.delete(`/talks/${talk.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["talks"] });
      toast({
        title: "Talk Deleted",
        description: "The talk has been successfully removed from the library.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete talk: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Format seconds as MM:SS
  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Total duration across all talks (in seconds)
  const totalDurationSeconds = talks
    ? talks.reduce((sum, t) => sum + (t.duration ?? 0), 0)
    : 0;
  const totalDurationMinutes = Math.floor(totalDurationSeconds / 60);
  const totalDurationRemSeconds = totalDurationSeconds % 60;

  // Filter talks based on search query
  const filteredTalks = talks?.filter(
    (talk) =>
      talk.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (talk.speaker && talk.speaker.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (talk.summary && talk.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (talk.talkType && talk.talkType.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort talks
  const sortedTalks =
    filteredTalks && sortConfig.key
      ? [...filteredTalks].sort((a, b) => {
          const aValue = a[sortConfig.key as keyof Talk];
          const bValue = b[sortConfig.key as keyof Talk];

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
      : filteredTalks;

  const handleSort = (key: keyof Talk) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "ascending"
          ? "descending"
          : "ascending",
    });
  };

  const handleEditTalk = (talk: Talk) => {
    setSelectedTalk(talk);
    setTalkFormMode("full");
    setIsTalkFormOpen(true);
  };

  const handleDeleteClick = (talk: Talk) => {
    setSelectedTalk(talk);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedTalk) {
      deleteTalkMutation.mutate(selectedTalk);
      setIsDeleteDialogOpen(false);
      setSelectedTalk(null);
    }
  };

  const handleChangeAudio = (talk: Talk) => {
    setSelectedTalk(talk);
    setTalkFormMode("audio");
    setIsTalkFormOpen(true);
  };

  const handleChangeCover = (talk: Talk) => {
    setSelectedTalk(talk);
    setTalkFormMode("cover");
    setIsTalkFormOpen(true);
  };

  const handleChangeMetadata = (talk: Talk) => {
    setSelectedTalk(talk);
    setTalkFormMode("metadata");
    setIsTalkFormOpen(true);
  };

  const handlePlayPause = (talkId: number, talkUrl: string) => {
    const talk = talks?.find((t) => t.id === talkId);
    if (!talk) return;

    // Adapt talk to track format for PlayerProvider
    const adaptedTalk = {
      ...talk,
      url: talk.audioUrl, // PlayerProvider expects 'url' property
      artist: talk.speaker || 'Unknown Speaker', // Use speaker as artist
      coverArt: talk.coverUrl, // Map coverUrl to coverArt for PlayerProvider
    };

    // Use PlayerProvider for main playback (shows PlayerDock)
    player.playTrack(adaptedTalk as any);

    toast({
      title: "Now Playing",
      description: `${talk.title} by ${talk.speaker || 'Unknown Speaker'}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">Total Talks</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">{talks?.length || 0}</h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Mic className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">Total Duration</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">
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
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">Talk Types</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">
                  {talks ? new Set(talks.map((t) => t.talkType).filter(Boolean)).size : 0}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Tag className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">Languages</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">
                  {talks ? new Set(talks.map((t) => t.language).filter(Boolean)).size : 0}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Globe className="h-5 w-5" />
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
                placeholder="Search by title, speaker, summary, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-gp-sans text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button
                onClick={() => {
                  setSelectedTalk(null);
                  setTalkFormMode("full");
                  setIsTalkFormOpen(true);
                }}
                className="gap-2 bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
              >
                <Plus className="h-4 w-4" /> Add Talk
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Talks Table */}
      <Card className="gp-card overflow-hidden">
        <CardContent className="p-0">
          {isLoadingTalks ? (
            <div className="flex flex-col justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--gp-gold)]"></div>
              <p className="mt-4 font-gp-serif italic text-[color:var(--gp-muted)]">Loading talks...</p>
            </div>
          ) : sortedTalks?.length === 0 ? (
            <div className="text-center py-16">
              <div className="border border-[var(--gp-border-gold)] rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center bg-[rgba(6,13,26,0.35)]">
                <Mic className="h-12 w-12 text-[color:var(--gp-gold)]/90" />
              </div>
              <h3 className="mt-6 font-gp-display text-xl font-semibold text-[color:var(--gp-white)]">No talks found</h3>
              <p className="mt-2 text-sm text-[color:var(--gp-white)]/75 max-w-sm mx-auto font-gp-serif italic">
                {searchQuery
                  ? "No talks match your search criteria. Try a different search term."
                  : "Get started by adding your first talk to the library."}
              </p>
              <div className="mt-8">
                <Button
                  onClick={() => {
                    setSelectedTalk(null);
                    setIsTalkFormOpen(true);
                  }}
                  className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] gap-2 font-gp-sans"
                  size="lg"
                >
                  <Plus className="h-5 w-5" /> Add Your First Talk
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[rgba(6,13,26,0.55)] hover:bg-[rgba(6,13,26,0.55)] border-b border-[var(--gp-border-gold)]/40">
                    <TableHead className="w-14"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">#</span></TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-16"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Cover</span></TableHead>
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
                    <TableHead className="cursor-pointer hover:bg-white/5" onClick={() => handleSort("speaker")}>
                      <div className="flex items-center gap-1 font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">
                        Speaker
                        <ArrowUpDown
                          className={`ml-1 h-4 w-4 ${
                            sortConfig.key === "speaker" ? "text-[var(--gp-gold-bright)]" : "text-[color:var(--gp-white)]/35"
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
                    <TableHead className="font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Type</TableHead>
                    <TableHead className="font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Language</TableHead>
                    <TableHead className="font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Status</TableHead>
                    <TableHead className="text-right font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTalks?.map((talk, index) => (
                    <TableRow key={talk.id} className="hover:bg-white/5 transition-colors border-b border-[var(--gp-border-gold)]/15">
                      <TableCell className="font-gp-sans text-[color:var(--gp-white)]/75 text-sm">{index + 1}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/70"
                          onClick={() => talk.audioUrl && handlePlayPause(talk.id, talk.audioUrl)}
                          disabled={!talk.audioUrl}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        {talk.coverUrl ? (
                          <img
                            src={talk.coverUrl}
                            alt={`${talk.title} cover`}
                            className="w-10 h-10 object-cover rounded-[2px] border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-[2px] border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)] flex items-center justify-center">
                            <Mic className="h-5 w-5 text-[color:var(--gp-gold)]/90" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-gp-sans font-semibold text-[color:var(--gp-white)] text-[0.95rem]">{talk.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[color:var(--gp-white)]/85 font-gp-serif text-[0.95rem]">{talk.speaker || "-"}</TableCell>
                      <TableCell className="text-[color:var(--gp-white)]/80 font-gp-sans text-sm">{formatDuration(talk.duration)}</TableCell>
                      <TableCell>
                        {talk.talkType ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border border-[var(--gp-border-gold)]/40 bg-[rgba(6,13,26,0.4)] text-[color:var(--gp-white)]/80">
                            {talk.talkType}
                          </span>
                        ) : (
                          <span className="text-[color:var(--gp-white)]/35">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {talk.language ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border border-[var(--gp-border-gold)]/40 bg-[rgba(6,13,26,0.4)] text-[color:var(--gp-white)]/80">
                            {talk.language.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-[color:var(--gp-white)]/60">EN</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border ${
                          talk.isActive
                            ? 'border-[var(--gp-border-gold)]/45 bg-[rgba(201,168,76,0.18)] text-[var(--gp-gold-bright)]'
                            : 'border-[rgba(239,68,68,0.45)] bg-[rgba(127,29,29,0.35)] text-red-300'
                        }`}>
                          {talk.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="flex flex-col gap-1">
                            {/* Row 1: Audio, Cover, Metadata */}
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleChangeAudio(talk)}
                                className="h-6 w-6 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/60"
                                title="Change audio"
                              >
                                <Mic className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleChangeCover(talk)}
                                className="h-6 w-6 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/60"
                                title="Change cover"
                              >
                                <Image className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleChangeMetadata(talk)}
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
                                onClick={() => handleDeleteClick(talk)}
                                className="h-6 w-6 hover:bg-[rgba(127,29,29,0.35)] hover:text-red-300 text-[color:var(--gp-white)]/60"
                                title="Delete talk"
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

      {/* Talk Form Dialog */}
      <TalkFormDialog
        open={isTalkFormOpen}
        onOpenChange={setIsTalkFormOpen}
        selectedTalk={selectedTalk}
        mode={talkFormMode}
        onSuccess={() => {
          // Refresh talks data
          queryClient.invalidateQueries({ queryKey: ['talks'] });
          setIsTalkFormOpen(false);
          setSelectedTalk(null);
          setTalkFormMode("full");
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-gp-display text-[color:var(--gp-white)]">Delete Talk</AlertDialogTitle>
            <AlertDialogDescription className="text-[color:var(--gp-white)]/80 font-gp-serif">
              Are you sure you want to delete "{selectedTalk?.title}" by {selectedTalk?.speaker || 'Unknown Speaker'}?
              This action cannot be undone and will permanently remove the talk from the library.
              {selectedTalk?.audioUrl && (
                <span className="block mt-2 text-amber-300 font-gp-sans">
                  Note: Associated audio files will be removed from storage.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-700 hover:bg-red-600 text-white"
            >
              {deleteTalkMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
