import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit, Trash2, Mic, Play, Volume2, Pause, User } from "lucide-react";
import type { HostCommentary, Host } from "@/types/api-models";

interface HostCommentaryListProps {
  commentaries: (HostCommentary & { host?: Host })[];
  hosts: Host[];
  searchTerm: string;
  onEdit: (commentary: HostCommentary & { host?: Host }) => void;
  onDelete: (commentary: HostCommentary & { host?: Host }) => void;
  onGenerateHostAudio: (commentaryId: number, hostId: number) => void;
  onDeleteHostAudio?: (commentaryId: number) => void;
  generatingAudio?: Set<number>;
}

export default function HostCommentaryList({
  commentaries,
  hosts,
  searchTerm,
  onEdit,
  onDelete,
  onGenerateHostAudio,
  onDeleteHostAudio,
  generatingAudio = new Set(),
}: HostCommentaryListProps) {
  const [selectedHostId, setSelectedHostId] = useState<string>("");
  const [playingAudio, setPlayingAudio] = useState<{ commentaryId: number } | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  const playHostAudio = async (commentaryId: number, audioUrl: string) => {
    const audioKey = `commentary_${commentaryId}`;

    // Stop any currently playing audio
    audioElements.forEach((audio, key) => {
      if (key !== audioKey) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    let audio = audioElements.get(audioKey);
    if (!audio) {
      audio = new Audio(audioUrl);
      audio.onended = () => {
        setPlayingAudio(null);
        setAudioElements(prev => {
          const newMap = new Map(prev);
          newMap.delete(audioKey);
          return newMap;
        });
      };
      audio.onerror = () => {
        setPlayingAudio(null);
        setAudioElements(prev => {
          const newMap = new Map(prev);
          newMap.delete(audioKey);
          return newMap;
        });
      };
      setAudioElements(prev => new Map(prev).set(audioKey, audio!));
    }

    if (playingAudio?.commentaryId === commentaryId) {
      // Currently playing this audio, so pause it
      audio.pause();
      audio.currentTime = 0;
      setPlayingAudio(null);
    } else {
      // Play this audio
      setPlayingAudio({ commentaryId });
      try {
        await audio.play();
      } catch (error) {
        console.error('Failed to play audio:', error);
        setPlayingAudio(null);
      }
    }
  };

  const filteredCommentaries = commentaries.filter((commentary) =>
    commentary.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    commentary.script.toLowerCase().includes(searchTerm.toLowerCase()) ||
    commentary.host?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
      {filteredCommentaries.map((commentary) => (
        <Card key={commentary.id} className="hover:shadow-lg transition-shadow h-fit">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base font-semibold truncate leading-tight">
                  {commentary.title}
                </CardTitle>
                {commentary.host && (
                  <p className="text-sm text-blue-600 mt-1 flex items-center gap-1 truncate">
                    <User className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{commentary.host.name}</span>
                  </p>
                )}
              </div>
              <Badge variant={commentary.audioUrl ? "default" : "secondary"} className="text-xs flex-shrink-0">
                {commentary.audioUrl ? "Has Audio" : "No Audio"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Script Preview */}
            <div className="border-b border-gray-200 pb-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <span className="truncate">Script Preview</span>
              </h4>
              <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                {commentary.script}
              </p>
            </div>

            {/* Audio Status Section */}
            <div className="border-b border-gray-200 pb-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Volume2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Audio Status</span>
              </h4>
              {commentary.audioUrl ? (
                <div className="flex items-center gap-2">
                  <span className="text-radio-cyan font-medium text-xs flex-shrink-0">✓ Audio available</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => playHostAudio(commentary.id, commentary.audioUrl!)}
                    className="h-6 px-2 text-xs flex-shrink-0"
                  >
                    {playingAudio?.commentaryId === commentary.id ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ) : (
                <span className="text-gray-400 text-xs">No audio generated</span>
              )}
            </div>

            {/* Audio Generation Section */}
            <div className="border-t border-gray-200 pt-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Mic className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Generate Audio</span>
              </h4>

              <div className="space-y-2">
                {commentary.host ? (
                  <div className="flex items-center gap-2 text-xs text-radio-cyan">
                    <User className="h-3 w-3 flex-shrink-0" />
                    <span className="text-xs leading-tight">Audio will be generated using {commentary.host.name}'s voice</span>
                  </div>
                ) : (
                  <Select value={selectedHostId} onValueChange={setSelectedHostId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select host to generate audio" />
                    </SelectTrigger>
                    <SelectContent>
                      {hosts.map((host) => (
                        <SelectItem key={host.id} value={host.id.toString()}>
                          {host.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  size="sm"
                  onClick={() => {
                    const hostId = commentary.hostId || parseInt(selectedHostId);
                    if (hostId) {
                      onGenerateHostAudio(commentary.id, hostId);
                    }
                  }}
                  disabled={(!commentary.hostId && !selectedHostId) || !!commentary.audioUrl || generatingAudio.has(commentary.id)}
                  className="w-full h-8 text-xs"
                >
                  {generatingAudio.has(commentary.id) ? (
                    <>
                      <Volume2 className="h-3 w-3 mr-1 animate-pulse" />
                      Generating...
                    </>
                  ) : commentary.audioUrl ? (
                    'Audio Already Generated'
                  ) : (
                    <>
                      <Volume2 className="h-3 w-3 mr-1" />
                      Generate Audio
                    </>
                  )}
                </Button>

                {commentary.audioUrl && onDeleteHostAudio && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDeleteHostAudio(commentary.id)}
                    className="w-full h-8 text-xs mt-2"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete Audio
                  </Button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-200">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(commentary)}
                className="flex-1 text-xs h-8"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="flex-1 text-xs h-8">
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-lg">Delete Host Commentary</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Are you sure you want to delete "{commentary.title}"?
                    </p>
                    <p className="text-xs text-red-600">
                      This will also delete the associated audio file from storage.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Cancel</Button>
                    </DialogTrigger>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(commentary)}
                    >
                      Delete
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      ))}

      {filteredCommentaries.length === 0 && (
        <div className="col-span-full text-center py-12">
          <Mic className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No host commentaries found</h3>
          <p className="text-gray-600">
            {searchTerm ? "Try adjusting your search terms." : "Create your first host commentary to get started."}
          </p>
        </div>
      )}
    </div>
  );
}