import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, X, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1, ChevronUp, ChevronDown, ListMusic, Heart, Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlayer } from './PlayerProvider';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { useIntro } from '@/contexts/IntroContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useLocation } from 'wouter';
// Removed Supabase - using API instead

export default function PlayerDock() {
  const [location] = useLocation();
  const { introActive } = useIntro();
  const player = usePlayer();
  const { 
    audioState, playlistState, next, prev, stopAudio, 
    toggleShuffle, setRepeat
  } = player;
  
  const { isStreaming, currentTrack, shuffle, repeat, currentStation } = playlistState;
  const listenerIdRef = useRef<string>(`listener-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  const [showTrackList, setShowTrackList] = useState(false);
  const [localSeekValue, setLocalSeekValue] = useState(0);
  const [localVolumeValue, setLocalVolumeValue] = useState(100);
  const [coverImageError, setCoverImageError] = useState(false);
  const isDraggingSeek = useRef(false);
  const isDraggingVolume = useRef(false);
  
  // Get actual playing state using the proper API
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const isPlayingRef = useRef(false);
  const lastUserActionTime = useRef(0);
  
  // Poll for position updates and track if audio is actually progressing
  useEffect(() => {
    let lastPosition = 0;
    let stuckCount = 0;
    
    const interval = setInterval(() => {
      const pos = audioState.getPosition();
      setCurrentPosition(pos);
      
      // Don't override user actions for 500ms after they interact with play/pause
      const timeSinceLastAction = Date.now() - lastUserActionTime.current;
      if (timeSinceLastAction < 500) {
        lastPosition = pos;
        return;
      }
      
      // Check if audio player reports playing state (more reliable)
      const isAudioPlaying = audioState.isPlaying;
      
      if (isAudioPlaying) {
        // If audio player says it's playing, trust it
        if (!isPlayingRef.current) {
          isPlayingRef.current = true;
          setIsPlaying(true);
        }
        stuckCount = 0;
      } else if (pos > lastPosition && pos > 0) {
        // Fallback: check if position is increasing
        if (!isPlayingRef.current) {
          isPlayingRef.current = true;
          setIsPlaying(true);
        }
        stuckCount = 0;
      } else if (pos === lastPosition && pos > 0) {
        stuckCount++;
        // Give more time before considering it paused (increased from 3 to 10 checks = 1 second)
        if (stuckCount > 10 && isPlayingRef.current) {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      } else if (pos === 0 && lastPosition === 0) {
        // Track not loaded or stopped
        if (isPlayingRef.current) {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      }
      
      lastPosition = pos;
    }, 100); // Keep 100ms interval for responsiveness
    
    return () => clearInterval(interval);
  }, [audioState]);

  // Update duration when track loads
  useEffect(() => {
    const checkDuration = () => {
      const dur = audioState.duration;
      if (dur && dur > 0) {
        setCurrentDuration(dur);
      }
    };
    
    checkDuration();
    const interval = setInterval(checkDuration, 500);
    return () => clearInterval(interval);
  }, [audioState, currentTrack]);

  // When track/stream changes, assume autoplay will start
  useEffect(() => {
    if (currentTrack || isStreaming) {
      // Set playing state after a short delay to allow audio to start
      const timer = setTimeout(() => {
        isPlayingRef.current = true;
        setIsPlaying(true);
      }, 200);
      
      return () => clearTimeout(timer);
    } else {
      // No track loaded, set to not playing
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, [currentTrack?.id, playlistState.streamUrl, isStreaming]);

  // Update local state from audio player
  useEffect(() => {
    if (!isDraggingSeek.current) {
      setLocalSeekValue(currentPosition);
    }
  }, [currentPosition]);
  
  useEffect(() => {
    if (!isDraggingVolume.current) {
      // TODO: Fix mute property - using fallback logic for now
      const vol = Math.round((audioState.volume || 1) * 100);
      setLocalVolumeValue(vol);
    }
  }, [audioState.volume]);

  const { user } = useOptionalAuth();
  const queryClient = useQueryClient();

  // Get database user ID from auth user ID
  // Use current user from auth context (already has id)
  const dbUser = user;
  
  // Simplified - no collections since we removed albums/playlists
  const currentCollection = null;
  const isAdminTheme = location.startsWith('/admin');

  const dockShellClass = isAdminTheme
    ? "fixed bottom-0 left-0 right-0 z-50 bg-[rgba(4,10,20,0.97)] border-t border-[var(--gp-border-gold)]/45 shadow-[0_-10px_24px_rgba(0,0,0,0.45)] backdrop-blur"
    : "fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 shadow-lg";
  const coverBoxClass = isAdminTheme
    ? "bg-[rgba(6,13,26,0.8)] border border-[var(--gp-border-gold)]/35"
    : "bg-gray-200 dark:bg-neutral-800";
  const titleClass = isAdminTheme
    ? "font-medium text-sm truncate text-[color:var(--gp-white)]"
    : "font-medium text-sm truncate text-gray-900 dark:text-neutral-100";
  const subtitleClass = isAdminTheme
    ? "text-xs text-[color:var(--gp-white)]/70 truncate"
    : "text-xs text-gray-500 dark:text-neutral-400 truncate";
  const ghostBtnClass = isAdminTheme
    ? "text-[color:var(--gp-white)]/75 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
    : "";
  const playBtnClass = isAdminTheme
    ? "bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] rounded-full"
    : "bg-red-600 hover:bg-red-700 text-white rounded-full";
  const spinnerClass = isAdminTheme
    ? "w-4 h-4 border-2 border-[var(--gp-border-gold)]/40 border-t-[var(--gp-gold)] rounded-full animate-spin"
    : "w-4 h-4 border-2 border-gray-300 border-t-red-600 rounded-full animate-spin";
  const timeClass = isAdminTheme
    ? "text-xs text-[var(--gp-gold-bright)] font-mono"
    : "text-xs text-gray-500 dark:text-neutral-400 font-mono";
  const seekSliderClass = isAdminTheme
    ? "w-full cursor-pointer h-1.5 sm:h-2 accent-[var(--gp-gold)]"
    : "w-full cursor-pointer h-1 sm:h-2";
  const volumeSliderClass = isAdminTheme
    ? "cursor-pointer accent-[var(--gp-gold)]"
    : "cursor-pointer";

  // Resolve cover URL
  const resolveCoverUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://127.0.0.1:3001';
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };
  
  const coverUrl = currentStation?.logoUrl ?? (isStreaming ? null : resolveCoverUrl(currentTrack?.coverArt) || null);

  // Reset cover image error when cover URL changes
  useEffect(() => {
    setCoverImageError(false);
  }, [coverUrl]);
  const formatTime = (seconds: number) => {
    if (isStreaming || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRepeatIcon = () => {
    const activeRepeatClass = isAdminTheme ? "text-[var(--gp-gold-bright)]" : "text-radio-cyan";
    switch (repeat) {
      case 'one': return <Repeat1 className={`h-4 w-4 ${activeRepeatClass}`} />;
      case 'all': return <Repeat className={`h-4 w-4 ${activeRepeatClass}`} />;
      default: return <Repeat className="h-4 w-4" />;
    }
  };

  // Control handlers with logging
  const handlePlayPause = () => {
    console.log('Play/Pause clicked, currently playing:', isPlaying);
    
    // Record the time of user action to prevent flickering
    lastUserActionTime.current = Date.now();
    
    try {
      if (isPlaying) {
        console.log('Calling pause()');
        audioState.pause();
        // Immediately update UI
        isPlayingRef.current = false;
        setIsPlaying(false);
      } else {
        console.log('Calling play()');
        audioState.play();
        // Immediately update UI
        isPlayingRef.current = true;
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error in play/pause:', error);
    }
  };

  const handleNext = () => {
    console.log('Next clicked');
    try {
      next();
    } catch (error) {
      console.error('Error in next:', error);
    }
  };

  const handlePrev = () => {
    console.log('Previous clicked');
    try {
      prev();
    } catch (error) {
      console.error('Error in prev:', error);
    }
  };

  const handleSeekMouseDown = () => {
    isDraggingSeek.current = true;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setLocalSeekValue(value);
  };

  const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    isDraggingSeek.current = false;
    const value = Number((e.target as HTMLInputElement).value);
    console.log('Seeking to:', value);
    audioState.seek(value);
  };

  const handleSeekTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    isDraggingSeek.current = false;
    const value = Number((e.target as HTMLInputElement).value);
    console.log('Seeking to:', value);
    audioState.seek(value);
  };

  const handleVolumeMouseDown = () => {
    isDraggingVolume.current = true;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setLocalVolumeValue(value);
  };

  const handleVolumeMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    isDraggingVolume.current = false;
    const value = Number((e.target as HTMLInputElement).value);
    console.log('Setting volume to:', value);
    audioState.setVolume(value / 100);
  };

  const handleVolumeTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    isDraggingVolume.current = false;
    const value = Number((e.target as HTMLInputElement).value);
    console.log('Setting volume to:', value);
    audioState.setVolume(value / 100);
  };

  const handleToggleMute = () => {
    console.log('Toggle mute');
    try {
      audioState.toggleMute();
    } catch (error) {
      console.error('Error in toggleMute:', error);
    }
  };

  const handleShuffleClick = () => {
    console.log('Shuffle clicked, current:', shuffle);
    try {
      toggleShuffle();
    } catch (error) {
      console.error('Error in shuffle:', error);
    }
  };

  const handleRepeatClick = () => {
    const modes: Array<'off' | 'one' | 'all'> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeat);
    const nextIndex = (currentIndex + 1) % modes.length;
    console.log('Repeat clicked, changing from', repeat, 'to', modes[nextIndex]);
    try {
      setRepeat(modes[nextIndex]);
    } catch (error) {
      console.error('Error in repeat:', error);
    }
  };

  const handleStop = () => {
    console.log('Stop clicked');
    try {
      stopAudio();
    } catch (error) {
      console.error('Error in stop:', error);
    }
  };

  const { data: stationLikeData } = useQuery({
    queryKey: ['station-like', currentStation?.id, dbUser?.id],
    queryFn: async () => {
      if (!currentStation?.id) return { userLikes: false, totalLikes: 0 };
      
      // TODO: Add likes API endpoint for stations
      return { userLikes: false, totalLikes: 0 };
    },
    enabled: isStreaming && !!currentStation?.id && !!dbUser,
    staleTime: 30000, // 30 seconds
    retry: 2,
    retryDelay: 1000,
  });

  const isStationLiked = Boolean(stationLikeData?.userLikes) || false;
  const stationLikeCount = stationLikeData?.totalLikes || 0;

  const handleLikeStation = async () => {
    if (!dbUser || !currentStation) return;
    
    console.log('Like clicked for station:', currentStation.name);
    try {
      // TODO: Add likes API endpoint for stations
      console.log('Like station functionality - API endpoint needed');
      
      queryClient.invalidateQueries({ queryKey: ['station-like', currentStation.id, dbUser.id] });
    } catch (error) {
      console.error('Error toggling station like:', error);
    }
  };

  const { data: trackLikeData } = useQuery({
    queryKey: ['track-like', currentTrack?.id, dbUser?.id],
    queryFn: async () => {
      if (!currentTrack?.id) return { userLikes: false, totalLikes: 0 };
      
      try {
        // TODO: Add likes API endpoint for tracks
        // For now, return default values
        return { userLikes: false, totalLikes: 0 };
      } catch (error) {
        console.error('Error fetching track like data:', error);
        return { userLikes: false, totalLikes: 0 };
      }
    },
    enabled: !isStreaming && !!currentTrack?.id && !!dbUser,
    staleTime: 30000, // 30 seconds
    retry: 2,
    retryDelay: 1000,
  });

  const handleLikeTrack = async () => {
    if (!dbUser || !currentTrack) return;
    
    console.log('Like clicked for track:', currentTrack.title);
    try {
      // TODO: Add likes API endpoint for tracks
      console.log('Like track functionality - API endpoint needed');
      
      queryClient.invalidateQueries({ queryKey: ['track-like', currentTrack.id, dbUser.id] });
    } catch (error) {
      console.error('Error toggling track like:', error);
    }
  };

  const isTrackLiked = Boolean(trackLikeData?.userLikes) || false;
  const trackLikeCount = trackLikeData?.totalLikes || 0;

  // Register as active listener and send heartbeat
  useEffect(() => {
    const sendPing = async () => {
      if (isPlaying || isStreaming) {
        try {
          await api.post('/listeners/ping', {
            listenerId: listenerIdRef.current,
            isPlaying: isPlaying || isStreaming,
          });
        } catch (error) {
          // Silently fail - don't interrupt user experience
        }
      }
    };
    
    // Send ping immediately and then every 5 seconds
    sendPing();
    const interval = setInterval(sendPing, 5000);
    
    return () => clearInterval(interval);
  }, [isPlaying, isStreaming]);

  // Hide dock when nothing is playing
  if (introActive) return null;
  if (!currentTrack && !isStreaming) return null;

  return (
    <div className={dockShellClass}>
      <div className="px-2 sm:px-4 py-2 sm:py-3">
        {/* Mobile Layout */}
        <div className="block md:hidden space-y-2">
          {/* Track Info - Mobile */}
          <div className="flex items-center space-x-2">
            <div className={`w-10 h-10 rounded flex-shrink-0 overflow-hidden flex items-center justify-center ${coverBoxClass}`}>
              {coverUrl && !coverImageError ? (
                <img 
                  src={coverUrl} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                  onError={() => {
                    setCoverImageError(true);
                  }}
                />
              ) : (
                isStreaming
                  ? <Radio className={`h-5 w-5 ${isAdminTheme ? "text-[color:var(--gp-gold)]/70" : "text-gray-500 dark:text-neutral-400"}`} />
                  : <ListMusic className={`h-5 w-5 ${isAdminTheme ? "text-[color:var(--gp-gold)]/70" : "text-gray-400 dark:text-neutral-500"}`} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className={titleClass}>
                {isStreaming
                  ? (currentStation?.name ?? playlistState.streamTitle ?? 'Live')
                  : (currentTrack?.title || 'No track selected')
                }
              </div>
              <div className={subtitleClass}>
                {isStreaming
                  ? (currentStation?.description ?? 'Live Radio Stream')
                  : (currentTrack?.artist || '...')
                }
              </div>
              {/* Show album/playlist info on mobile when playing tracks */}
              {!isStreaming && currentCollection && (
                <div className="text-xs text-orange-600 truncate mt-0.5">
                  Single Track
                </div>
              )}
            </div>
            {!isStreaming && dbUser && currentTrack && currentTrack.id && (
              <Button size="sm" variant="ghost" onClick={handleLikeTrack} className="flex items-center gap-1 p-1">
                <Heart className={`h-4 w-4 ${isTrackLiked ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'}`} />
                <span className={`text-xs ${isTrackLiked ? 'text-red-500' : 'text-gray-400'}`}>
                  {trackLikeCount}
                </span>
              </Button>
            )}
            {isStreaming && dbUser && currentStation && (
              <Button size="sm" variant="ghost" onClick={handleLikeStation} className="flex items-center gap-1 p-1">
                <Heart className={`h-4 w-4 ${isStationLiked ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'}`} />
                <span className={`text-xs ${isStationLiked ? 'text-red-500' : 'text-gray-400'}`}>
                  {stationLikeCount}
                </span>
              </Button>
            )}
          </div>

          {/* Playback Controls - Mobile */}
          <div className="flex items-center justify-center space-x-1">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleShuffleClick}
                disabled={isStreaming}
                className={`p-2 ${ghostBtnClass} ${shuffle ? (isAdminTheme ? 'text-[var(--gp-gold-bright)]' : 'text-radio-cyan') : ''}`}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            <Button 
              size="sm" 
                variant="ghost" 
                onClick={handlePrev}
                disabled={isStreaming}
                className={`p-2 ${ghostBtnClass}`}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
            {audioState.isLoading && !isStreaming ? (
              <Button size="sm" disabled className="p-2">
                <div className={spinnerClass} />
              </Button>
            ) : (
              <Button 
                size="sm" 
                onClick={handlePlayPause}
                className={`${playBtnClass} p-3`}
                disabled={isStreaming && audioState.isLoading}
              >
                {isStreaming && audioState.isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
            )}
            <Button 
              size="sm" 
                variant="ghost" 
                onClick={handleNext}
                disabled={isStreaming}
                className={`p-2 ${ghostBtnClass}`}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            <Button 
              size="sm" 
                variant="ghost" 
                disabled={isStreaming} 
                onClick={handleRepeatClick}
                className={`p-2 ${ghostBtnClass}`}
              >
                {getRepeatIcon()}
              </Button>
          </div>

          {/* Time and Controls - Mobile */}
          <div className="flex items-center justify-between">
            <div className={timeClass}>
              {isStreaming ? "LIVE" : `${formatTime(currentPosition)} / ${formatTime(currentDuration)}`}
            </div>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="ghost" onClick={handleToggleMute} className={`p-1 ${ghostBtnClass}`}>
                {localVolumeValue === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={localVolumeValue}
                onMouseDown={handleVolumeMouseDown}
                onChange={handleVolumeChange}
                onMouseUp={handleVolumeMouseUp}
                onTouchEnd={handleVolumeTouchEnd}
                className={`w-16 sm:w-20 ${volumeSliderClass}`}
              />
              {!isStreaming && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setShowTrackList(!showTrackList)}
                  className={`p-1 ${ghostBtnClass}`}
                >
                  {showTrackList ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              )}
              {isStreaming && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setShowTrackList(!showTrackList)}
                  className={`p-1 ${ghostBtnClass}`}
                >
                  {showTrackList ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleStop} className={`p-1 ${ghostBtnClass}`}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between max-w-6xl mx-auto gap-4">
          
          {/* Track Info */}
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className={`w-12 h-12 rounded flex-shrink-0 overflow-hidden flex items-center justify-center ${coverBoxClass}`}>
              {coverUrl && !coverImageError ? (
                <img 
                  src={coverUrl} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                  onError={() => {
                    setCoverImageError(true);
                  }}
                />
              ) : (
                isStreaming
                  ? <Radio className={`h-6 w-6 ${isAdminTheme ? "text-[color:var(--gp-gold)]/70" : "text-gray-500 dark:text-neutral-400"}`} />
                  : <ListMusic className={`h-6 w-6 ${isAdminTheme ? "text-[color:var(--gp-gold)]/70" : "text-gray-400 dark:text-neutral-500"}`} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className={titleClass}>
                {isStreaming
                  ? (currentStation?.name ?? playlistState.streamTitle ?? 'Live')
                  : (currentTrack?.title || 'No track selected')
                }
              </div>
              <div className={subtitleClass}>
                {isStreaming
                  ? (currentStation?.description ?? 'Live Radio Stream')
                  : (currentTrack?.artist || '...')
                }
              </div>
              {/* Show album/playlist info when playing tracks */}
              {!isStreaming && currentCollection && (
                <div className="text-xs text-orange-600 truncate mt-0.5">
                  Single Track
                </div>
              )}
            </div>
            {!isStreaming && dbUser && currentTrack && currentTrack.id && (
              <Button size="sm" variant="ghost" onClick={handleLikeTrack} className="flex items-center gap-1">
                <Heart className={`h-4 w-4 ${isTrackLiked ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'}`} />
                <span className={`text-xs ${isTrackLiked ? 'text-red-500' : 'text-gray-400'}`}>
                  {trackLikeCount}
                </span>
              </Button>
            )}
            {isStreaming && dbUser && currentStation && (
              <Button size="sm" variant="ghost" onClick={handleLikeStation} className="flex items-center gap-1">
                <Heart className={`h-4 w-4 ${isStationLiked ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'}`} />
                <span className={`text-xs ${isStationLiked ? 'text-red-500' : 'text-gray-400'}`}>
                  {stationLikeCount}
                </span>
              </Button>
            )}
          </div>

          {/* Playback Controls */}
          <div className="flex items-center space-x-2 flex-shrink-0">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleShuffleClick}
                disabled={isStreaming} 
                className={`${ghostBtnClass} ${shuffle ? (isAdminTheme ? 'text-[var(--gp-gold-bright)]' : 'text-radio-cyan') : ''}`}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handlePrev}
              disabled={isStreaming}
              className={ghostBtnClass}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            {audioState.isLoading && !isStreaming ? (
              <Button size="sm" disabled>
                <div className={spinnerClass} />
              </Button>
            ) : (
              <Button 
                size="sm" 
                onClick={handlePlayPause}
                className={playBtnClass}
                disabled={isStreaming && audioState.isLoading}
              >
                {isStreaming && audioState.isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleNext}
              disabled={isStreaming}
              className={ghostBtnClass}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              disabled={isStreaming} 
              onClick={handleRepeatClick}
              className={ghostBtnClass}
            >
              {getRepeatIcon()}
            </Button>
          </div>

          {/* Time and Volume */}
          <div className="flex items-center space-x-4 flex-1 justify-end">
            <div className={`${timeClass} w-24 text-center`}>
              {isStreaming ? "LIVE" : `${formatTime(currentPosition)} / ${formatTime(currentDuration)}`}
            </div>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="ghost" onClick={handleToggleMute} className={ghostBtnClass}>
                {localVolumeValue === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={localVolumeValue}
                onMouseDown={handleVolumeMouseDown}
                onChange={handleVolumeChange}
                onMouseUp={handleVolumeMouseUp}
                onTouchEnd={handleVolumeTouchEnd}
                className={`w-20 ${volumeSliderClass}`}
              />
            </div>
            {!isStreaming && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowTrackList(!showTrackList)}
                className={ghostBtnClass}
              >
                {showTrackList ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            )}
            {isStreaming && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowTrackList(!showTrackList)}
                className={ghostBtnClass}
              >
                {showTrackList ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleStop} className={ghostBtnClass}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Seek Bar */}
        {!isStreaming && (
          <div className="mt-2 max-w-6xl mx-auto px-2 sm:px-0">
            <input
              type="range"
              min={0}
              max={Math.max(currentDuration, 1)}
              step={0.1}
              value={localSeekValue}
              onMouseDown={handleSeekMouseDown}
              onChange={handleSeekChange}
              onMouseUp={handleSeekMouseUp}
              onTouchEnd={handleSeekTouchEnd}
              disabled={isStreaming || currentDuration === 0}
              className={seekSliderClass}
            />
          </div>
        )}
      </div>
      
      {/* Track List */}
      {!isStreaming && showTrackList && currentCollection && (
        <div className={`${isAdminTheme ? "border-t border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.9)]" : "border-t border-neutral-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900"} max-h-64 overflow-y-auto`}>
          <div className="max-w-6xl mx-auto p-2 sm:p-4">
            <div className="mb-2 sm:mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-base sm:text-lg mb-1 truncate">
                    Current Track
                  </h4>
                </div>
                {dbUser && currentCollection && (
                  <div className="flex gap-2 self-start sm:self-center">
                    {/* No album/playlist like buttons since they were removed */}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 text-xs text-gray-500 dark:text-neutral-400">
                <span>1 track</span>
              </div>
            </div>
            <div className="space-y-1">
              {currentTrack && (
                <div className={`flex items-center justify-between p-2 rounded ${isAdminTheme ? "bg-[rgba(201,168,76,0.14)] border border-[var(--gp-border-gold)]/25" : "bg-orange-100 dark:bg-orange-900/30"}`}>
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <span className="text-xs text-gray-400 w-5 sm:w-6 flex-shrink-0">1</span>
                    {currentTrack.coverArt && (
                      <img 
                        src={resolveCoverUrl(currentTrack.coverArt) || ''} 
                        alt="" 
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{currentTrack.title}</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">{currentTrack.artist}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-3 ml-2 flex-shrink-0">
                    {dbUser && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={handleLikeTrack}
                        className="flex items-center gap-1 h-6 sm:h-8 px-1 sm:px-2"
                      >
                        <Heart className={`h-3 w-3 ${isTrackLiked ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'}`} />
                        <span className={`text-xs ${isTrackLiked ? 'text-red-500' : 'text-gray-400'}`}>
                          {isTrackLiked ? '♥' : '♡'}
                        </span>
                      </Button>
                    )}
                    {currentTrack.genre && (
                      <span className="text-xs text-gray-400 dark:text-neutral-500 hidden md:block">{currentTrack.genre}</span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-neutral-400 font-mono min-w-[40px] text-right">
                      {formatTime(currentTrack.duration)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Station Info (when streaming) */}
      {isStreaming && showTrackList && currentStation && (
        <div className={`${isAdminTheme ? "border-t border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.9)]" : "border-t border-neutral-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900"} max-h-64 overflow-y-auto`}>
          <div className="max-w-6xl mx-auto p-2 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {currentStation.logoUrl && (
                <img 
                  src={currentStation.logoUrl} 
                  alt={currentStation.name} 
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover flex-shrink-0 self-center sm:self-start"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
                  <h4 className="font-medium text-base sm:text-lg truncate">{currentStation.name}</h4>
                  {dbUser && (
                    <Button size="sm" variant="ghost" onClick={handleLikeStation} className="flex items-center gap-1 self-start sm:self-center">
                      <Heart className={`h-4 w-4 ${isStationLiked ? 'fill-red-500 text-red-500' : 'text-gray-400 hover:text-red-400'}`} />
                      <span className={`text-xs ${isStationLiked ? 'text-red-500' : 'text-gray-400'}`}>
                        {stationLikeCount}
                      </span>
                    </Button>
                  )}
                </div>
                {currentStation.description && (
                  <p className="text-sm text-gray-600 dark:text-neutral-400 mb-2 line-clamp-3">{currentStation.description}</p>
                )}
                <div className="flex flex-wrap gap-2 sm:gap-3 text-xs text-gray-500 dark:text-neutral-400">
                  {currentStation.timezone && (
                    <span className="flex items-center gap-1">
                      <Radio className="h-3 w-3" />
                      {currentStation.timezone}
                    </span>
                  )}
                  {currentStation.isActive !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full ${
                      currentStation.isActive
                        ? (isAdminTheme
                            ? 'bg-[rgba(201,168,76,0.14)] text-[var(--gp-gold-bright)] border border-[var(--gp-border-gold)]/35'
                            : 'bg-radio-cyan/10 text-radio-cyan')
                        : (isAdminTheme
                            ? 'bg-[rgba(6,13,26,0.45)] text-[color:var(--gp-white)]/70 border border-[var(--gp-border-gold)]/25'
                            : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400')
                    }`}>
                      {currentStation.isActive ? 'Live' : 'Offline'}
                    </span>
                  )}
                  {currentStation.createdAt && (
                    <span className="hidden sm:inline">Since {new Date(currentStation.createdAt).getFullYear()}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
