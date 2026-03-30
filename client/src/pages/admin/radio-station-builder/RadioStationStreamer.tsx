import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Radio, Play, Pause, Volume2, VolumeX, Users, Activity, Wifi, WifiOff } from "lucide-react";
import type { RadioStation, ScheduledShow, Show, Host } from "@/types/api-models";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

type RadioStationWithRelations = RadioStation & {
  hosts: Host[];
  scheduledShows: (ScheduledShow & {
    show: Show & {
      host: Host;
    };
  })[];
};

export default function RadioStationStreamer() {
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [streamInfo, setStreamInfo] = useState<any>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Fetch radio stations with current schedules
  const { data: radioStations = [] } = useQuery({
    queryKey: ['radio-stations-with-schedules'],
    queryFn: async () => {
      const data = await api.get<RadioStationWithRelations[]>('/radio-stations');
      return data || [];
    },
  });

  // Get current show for selected station
  const getCurrentShow = (station: RadioStationWithRelations) => {
    const now = new Date();
    return station.scheduledShows.find(show =>
      new Date(show.startTime) <= now && new Date(show.endTime) >= now
    ) || null;
  };

  // Check stream connection status and load current show info
  useEffect(() => {
    if (selectedStation) {
      setConnectionStatus('connecting');

      // Check if stream server is accessible via health check
      const checkStreamConnection = async () => {
        try {
          const streamServerUrl = import.meta.env.VITE_STREAM_SERVER_URL || 'http://localhost:3001';
          const healthUrl = `${streamServerUrl}/health`;
          
          // Try health check first (faster and doesn't start streaming)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          try {
            const healthResponse = await fetch(healthUrl, {
              method: 'GET',
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            
            if (healthResponse.ok) {
              setConnectionStatus('connected');
            } else {
              setConnectionStatus('error');
            }
          } catch (healthError: any) {
            clearTimeout(timeoutId);
            if (healthError.name !== 'AbortError') {
              // Health check failed, but streaming might still work
              // Set to connected anyway - let the audio element handle the actual connection
              setConnectionStatus('connected');
            } else {
              // Timeout on health check - assume server might be slow
              setConnectionStatus('connecting');
            }
          }
        } catch (error: any) {
          console.error('Stream connection check failed:', error);
          // Don't set error status - let user try to play anyway
          setConnectionStatus('connecting');
        }
      };

      // Load current show info
      const loadCurrentShow = () => {
        const station = radioStations.find(s => s.id.toString() === selectedStation);
        if (station) {
          const currentShow = getCurrentShow(station);
          setStreamInfo({
            station: {
              id: station.id,
              name: station.name,
              description: station.description,
              timezone: station.timezone,
            },
            currentShow: currentShow ? {
              title: currentShow.show.title,
              host: currentShow.show.host?.name || 'Unknown',
              startTime: currentShow.startTime,
              endTime: currentShow.endTime,
            } : null,
            isPlaying: isPlaying,
            listeners: 0,
          });
        }
      };

      checkStreamConnection();
      loadCurrentShow();

      // Poll for connection status every 30 seconds
      const pollInterval = setInterval(() => {
        checkStreamConnection();
        loadCurrentShow();
      }, 30000);

      return () => {
        clearInterval(pollInterval);
      };
    } else {
      setConnectionStatus('disconnected');
      setStreamInfo(null);
    }
  }, [selectedStation, radioStations, isPlaying]);

  // Cleanup: pause audio when component unmounts or station changes
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [selectedStation]);

  const handlePlayPause = async () => {
    if (!selectedStation) return;

    const station = radioStations.find(s => s.id.toString() === selectedStation);
    if (!station) return;

    try {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
        toast.info("Streaming paused");
      } else {
        if (audioRef.current) {
          // Build stream URL with API key as query parameter for authentication
          // HTML5 audio elements cannot send custom headers, so we pass the API key as a query param
          const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
          if (!apiKey) {
            throw new Error('Missing Supabase API key. Please check your environment variables.');
          }
          
          // Use Node.js stream server if available, otherwise fall back to Supabase edge function
          const streamServerUrl = import.meta.env.VITE_STREAM_SERVER_URL || 'http://localhost:3001';
          const streamUrl = `${streamServerUrl}/stream?station=${selectedStation}&apikey=${encodeURIComponent(apiKey)}`;
          
          // Set up error handlers before setting src
          audioRef.current.onerror = (e) => {
            console.error('Audio playback error:', e, audioRef.current?.error);
            const errorMsg = audioRef.current?.error 
              ? `Error ${audioRef.current.error.code}: ${getAudioErrorMessage(audioRef.current.error.code)}`
              : 'Audio playback failed';
            toast.error(errorMsg);
            setIsPlaying(false);
          };
          
          audioRef.current.onloadstart = () => {
            console.log('Audio stream loading started');
          };
          
          audioRef.current.oncanplay = () => {
            console.log('Audio stream ready to play');
            setConnectionStatus('connected');
          };

          audioRef.current.onstalled = () => {
            console.warn('Audio stream stalled');
            toast.warning("Stream connection stalled. Trying to reconnect...");
          };

          audioRef.current.onwaiting = () => {
            console.log('Audio stream buffering...');
          };

          audioRef.current.onplaying = () => {
            console.log('Audio stream playing');
            setIsPlaying(true);
            setConnectionStatus('connected');
            toast.success("Stream is now playing");
          };
          
          audioRef.current.onpause = () => {
            setIsPlaying(false);
          };
          
          audioRef.current.onended = () => {
            setIsPlaying(false);
            toast.info("Stream ended");
          };

          // Set the source and volume
          audioRef.current.src = streamUrl;
          audioRef.current.volume = (volume / 100) * (isMuted ? 0 : 1);
          
          // Try to play
          try {
            await audioRef.current.play();
            // Don't set isPlaying here - let onplaying event handle it
            // This ensures we only mark as playing when audio actually starts
            setConnectionStatus('connected');
          } catch (playError: any) {
            // Handle autoplay restrictions
            if (playError.name === 'NotAllowedError') {
              throw new Error('Autoplay blocked. Please click play again.');
            }
            throw playError;
          }
        }
      }
    } catch (error: any) {
      console.error('Playback error:', error);
      toast.error(error.message || "Failed to start streaming");
      setIsPlaying(false);
    }
  };

  // Helper function to get user-friendly error messages
  const getAudioErrorMessage = (code: number | null): string => {
    if (!code) return 'Unknown error';
    const errorMessages: Record<number, string> = {
      1: 'Media aborted',
      2: 'Network error',
      3: 'Decode error',
      4: 'Source not supported',
    };
    return errorMessages[code] || `Error code: ${code}`;
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current && !isMuted) {
      audioRef.current.volume = newVolume / 100;
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (audioRef.current) {
      audioRef.current.volume = newMutedState ? 0 : volume / 100;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-radio-cyan';
      case 'connecting': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="h-4 w-4" />;
      case 'connecting': return <Activity className="h-4 w-4 animate-pulse" />;
      case 'error': return <WifiOff className="h-4 w-4" />;
      default: return <WifiOff className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Live Streamer</h2>
          <p className="text-gray-600">Test and monitor live radio station streaming</p>
        </div>
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
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Radio className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Node.js Streaming Server</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Stream URLs are generated using the Node.js streaming server.
                    Make sure the server is running and FFmpeg is installed for live streaming to work.
                    Set <code>VITE_STREAM_SERVER_URL</code> environment variable to configure the server URL.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="station-select">Radio Station</Label>
                <Select value={selectedStation} onValueChange={setSelectedStation}>
                  <SelectTrigger id="station-select">
                    <SelectValue placeholder="Choose a radio station to stream" />
                  </SelectTrigger>
                  <SelectContent>
                    {radioStations.map((station) => (
                      <SelectItem key={station.id} value={station.id.toString()}>
                        {station.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className={`flex items-center gap-2 px-3 py-2 rounded ${getConnectionStatusColor()}`}>
                  {getConnectionStatusIcon()}
                  <span className="text-sm capitalize">{connectionStatus}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stream Controls */}
      {selectedStation && (
        <Card>
          <CardHeader>
            <CardTitle>Stream Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Audio Element (hidden) */}
              <audio ref={audioRef} preload="none" />

              {/* Play/Pause Button */}
              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handlePlayPause}
                  className="w-32 h-32 rounded-full"
                  disabled={connectionStatus === 'error'}
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8" />
                  ) : (
                    <Play className="h-8 w-8 ml-1" />
                  )}
                </Button>
              </div>
              
              {/* Playback Status */}
              <div className="text-center">
                {isPlaying ? (
                  <div className="flex items-center justify-center gap-2 text-radio-cyan">
                    <Activity className="h-4 w-4 animate-pulse" />
                    <span className="text-sm font-medium">Streaming Live</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Ready to stream</span>
                )}
              </div>

              {/* Volume Control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    Volume
                  </Label>
                  <span className="text-sm text-gray-600">{isMuted ? 0 : volume}%</span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    disabled={isMuted}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleMute}
                    className={isMuted ? "bg-red-50 border-red-200" : ""}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Show Info */}
      {selectedStation && streamInfo?.currentShow && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Currently Scheduled Show
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{streamInfo.currentShow.title}</h3>
                <p className="text-gray-600">Hosted by {streamInfo.currentShow.host}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-400" />
                  <span>
                    {new Date(streamInfo.currentShow.startTime).toLocaleTimeString()} - {new Date(streamInfo.currentShow.endTime).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span>{streamInfo.listeners || 0} listeners</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={isPlaying ? "default" : "secondary"}>
                  {isPlaying ? "Live" : "Scheduled"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* No Show Scheduled */}
      {selectedStation && !streamInfo?.currentShow && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="font-medium text-yellow-900">No Show Scheduled</h3>
                <p className="text-yellow-700 text-sm">There is no show currently scheduled for this station. The stream may not have content to play.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Station Info */}
      {selectedStation && (
        <Card>
          <CardHeader>
            <CardTitle>Station Information</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const station = radioStations.find(s => s.id.toString() === selectedStation);
              if (!station) return null;

              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {station.logoUrl ? (
                      <img src={station.logoUrl} alt={station.name} className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Radio className="h-8 w-8 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold">{station.name}</h3>
                      <p className="text-gray-600">{station.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <Badge variant={station.isActive ? "default" : "secondary"}>
                          {station.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-sm text-gray-500">{station.timezone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Hosts:</span> {station.hosts.length}
                    </div>
                    <div>
                      <span className="font-medium">Scheduled Shows:</span> {station.scheduledShows.length}
                    </div>
                    <div>
                      <span className="font-medium">Current Listeners:</span> {streamInfo?.listeners || 0}
                    </div>
                    <div>
                      <span className="font-medium">Stream Status:</span>
                      <Badge variant={streamInfo?.isPlaying ? "default" : "secondary"} className="ml-2">
                        {streamInfo?.isPlaying ? "Playing" : "Stopped"}
                      </Badge>
                    </div>
                  </div>

                  {station.streamUrl && (
                    <div className="text-sm">
                      <span className="font-medium">Stream URL:</span>
                      <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                        {station.streamUrl}
                      </code>
                    </div>
                  )}

                  <div className="text-sm">
                    <span className="font-medium">Stream Server URL:</span>
                    <code className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs break-all">
                      {import.meta.env.VITE_STREAM_SERVER_URL || 'http://localhost:3001'}/stream?station={station.id}
                    </code>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Connection Status */}
      {selectedStation && connectionStatus === 'error' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="font-medium text-red-900">Connection Error</h3>
                <p className="text-red-700 text-sm">
                  Unable to connect to the streaming server. Please ensure:
                </p>
                <ul className="text-red-700 text-sm mt-2 list-disc list-inside space-y-1">
                  <li>The Node.js streaming server is running (port 3001)</li>
                  <li>FFmpeg is installed and available</li>
                  <li>The server URL is correct: {import.meta.env.VITE_STREAM_SERVER_URL || 'http://localhost:3001'}</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {selectedStation && connectionStatus === 'connecting' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-yellow-600 animate-pulse" />
              <div>
                <h3 className="font-medium text-yellow-900">Connecting...</h3>
                <p className="text-yellow-700 text-sm">Checking connection to streaming server...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}