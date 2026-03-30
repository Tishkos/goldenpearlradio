import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Clock, Trash2, Edit, Volume2, Pause, Mic } from "lucide-react";
import { useState } from "react";
import LazyMap from "@/pages/home/components/LazyMap";
import type { News, Host, Location } from "@/types/api-models";

// News type with relations
interface NewsWithRelations extends News {
  location?: Location;
  newsHostAudio?: Array<{
    id: number;
    audioUrl: string;
    duration?: number;
    host: Host;
  }>;
}

interface NewsItemProps {
  news: News;
  onEdit: (news: News) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  isUpdating: boolean;
  hosts?: any[];
  hostAudios?: any[];
  onGenerateHostAudio?: (newsId: number, hostId: number) => void;
  onDeleteHostAudio?: (newsId: number, hostId: number) => void;
  generatingHostAudio?: Set<string>;
}

export default function NewsItem({ 
  news, 
  onEdit, 
  onDelete, 
  isDeleting, 
  isUpdating,
  hosts = [],
  hostAudios = [],
  onGenerateHostAudio,
  onDeleteHostAudio,
  generatingHostAudio = new Set()
}: NewsItemProps) {
  const [selectedHostId, setSelectedHostId] = useState<string>("");
  const [playingAudio, setPlayingAudio] = useState<{ hostId: number } | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  const playHostAudio = async (hostId: number, audioUrl: string) => {
    const audioKey = `${news.id}-${hostId}`;

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

    if (playingAudio?.hostId === hostId) {
      // Currently playing this audio, so pause it
      audio.pause();
      audio.currentTime = 0;
      setPlayingAudio(null);
    } else {
      // Play this audio
      setPlayingAudio({ hostId });
      try {
        await audio.play();
      } catch (error) {
        console.error('Failed to play audio:', error);
        setPlayingAudio(null);
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-orange-500";
      case "critical": return "bg-red-500";
      default: return "bg-blue-500";
    }
  };

  return (
    <Card className={`${!news.isActive ? 'opacity-60' : ''} h-fit`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className={`${getPriorityColor(news.priority || 'normal')} text-white text-xs`}>
                {(news.priority || 'normal').toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground truncate">
                {news.newsType || 'News'}
              </span>
              {news.category && (
                <Badge variant="outline" className="text-xs">
                  {news.category}
                </Badge>
              )}
              {news.location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground truncate">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">
                    {news.location.name}
                    {news.location.city && `, ${news.location.city}`}
                    {news.location.country && `, ${news.location.country}`}
                  </span>
                </div>
              )}
            </div>

            {news.location?.mapUrl && (
              <div className="mt-2 mb-3">
                <LazyMap
                  mapUrl={news.location.mapUrl}
                  locationName={news.location.name}
                />
              </div>
            )}

            <h4 className="font-medium text-sm mb-2 leading-tight">
              {news.title || `${news.newsType || 'News'} - ${new Date(news.createdAt).toLocaleTimeString()}`}
            </h4>
            <p className="text-sm mb-3 leading-relaxed">{news.message}</p>

            {/* Host Audio Status Section */}
            <div className="border-b border-gray-200 pb-3">
              <h5 className="text-xs font-medium text-gray-900 mb-2 flex items-center gap-1">
                <Volume2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Host Audio Status</span>
              </h5>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {hosts.map((host) => {
                  const hostAudio = hostAudios.find(
                    (audio: any) => audio.newsId === news.id && audio.hostId === host.id
                  );
                  return (
                    <div key={host.id} className="flex items-center justify-between text-xs gap-2">
                      <span className="text-gray-600 truncate flex-shrink-0 max-w-[80px]">{host.name}:</span>
                      {hostAudio ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-radio-cyan font-medium">✓ {hostAudio.duration}s</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => playHostAudio(host.id, hostAudio.audioUrl)}
                            className="h-5 px-1 text-xs"
                          >
                            {playingAudio?.hostId === host.id ? (
                              <Pause className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onGenerateHostAudio?.(news.id, host.id)}
                            disabled={isDeleting || isUpdating || (() => {
                              const key = `${news.id}-${host.id}`;
                              return generatingHostAudio.has(key);
                            })()}
                            className="h-5 px-1 text-xs"
                          >
                            <Volume2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-gray-400 flex-shrink-0">Not generated</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual Host Audio Generation */}
            <div className="border-b border-gray-200 pb-3">
              <h5 className="text-xs font-medium text-gray-900 mb-2 flex items-center gap-1">
                <Mic className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Generate for Specific Host</span>
              </h5>
              <div className="flex gap-2">
                <Select value={selectedHostId} onValueChange={setSelectedHostId}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Select host" />
                  </SelectTrigger>
                  <SelectContent>
                    {hosts.map((host) => (
                      <SelectItem key={host.id} value={host.id.toString()}>
                        {host.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => {
                    const hostId = parseInt(selectedHostId);
                    if (hostId && onGenerateHostAudio) {
                      onGenerateHostAudio(news.id, hostId);
                    }
                  }}
                  disabled={!selectedHostId || isDeleting || isUpdating || (() => {
                    // Check if the selected host already has audio
                    const selectedHostIdNum = parseInt(selectedHostId);
                    return hostAudios.some(audio => 
                      audio.newsId === news.id && audio.hostId === selectedHostIdNum
                    );
                  })() || (() => {
                    // Check if this specific host audio is currently being generated
                    const selectedHostIdNum = parseInt(selectedHostId);
                    const key = `${news.id}-${selectedHostIdNum}`;
                    return generatingHostAudio.has(key);
                  })()}
                  className="h-8 text-xs flex-shrink-0"
                >
                  {(() => {
                    // Check if this specific host audio is currently being generated
                    const selectedHostIdNum = parseInt(selectedHostId);
                    const key = `${news.id}-${selectedHostIdNum}`;
                    const isGenerating = generatingHostAudio.has(key);
                    
                    if (isGenerating) {
                      return (
                        <>
                          <Volume2 className="h-3 w-3 mr-1 animate-pulse" />
                          Generating...
                        </>
                      );
                    }
                    
                    // Check if the selected host already has audio
                    const hasAudio = hostAudios.some(audio => 
                      audio.newsId === news.id && audio.hostId === selectedHostIdNum
                    );
                    return hasAudio ? 'Audio Already Generated' : 'Generate Audio';
                  })()}
                </Button>
              </div>
              {selectedHostId && (() => {
                // Check if the selected host has audio
                const selectedHostIdNum = parseInt(selectedHostId);
                const hasAudio = hostAudios.some(audio => 
                  audio.newsId === news.id && audio.hostId === selectedHostIdNum
                );
                
                return hasAudio ? (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const hostId = parseInt(selectedHostId);
                        if (hostId && onDeleteHostAudio) {
                          onDeleteHostAudio(news.id, hostId);
                        }
                      }}
                      disabled={isDeleting || isUpdating}
                      className="w-full h-8 text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete Audio for Selected Host
                    </Button>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(news)}
              disabled={isDeleting || isUpdating}
              className="text-blue-600 hover:bg-blue-50 h-8 w-8 p-0"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(news.id)}
              disabled={isDeleting || isUpdating}
              className="text-red-600 hover:bg-red-50 h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}