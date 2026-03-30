import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAudioPlayer } from 'react-use-audio-player';
import type { Track, RadioStation } from '@/types/api-models';

// --- TYPE DEFINITIONS ---
export type { Track };

// --- CUSTOM PLAYER STATE ---
type CustomPlayerState = {
  currentTrack: Track | null;
  streamUrl: string | null;
  streamTitle: string | null;
  currentStation: RadioStation | null;
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
  shuffleHistory: number[];
};

// --- CONTEXT DEFINITION ---
type PlayerContextType = {
  audioState: ReturnType<typeof useAudioPlayer>;
  playlistState: CustomPlayerState & { isStreaming: boolean };
  next: () => void;
  prev: () => void;
  playStream: (urlOrStation: string | RadioStation, title?: string) => void;
  playTrack: (track: Track) => void;
  stopAudio: () => void;
  toggleShuffle: () => void;
  setRepeat: (mode: 'off' | 'one' | 'all') => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);



// --- PROVIDER COMPONENT ---
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioPlayer = useAudioPlayer();

  const [playerState, setPlayerState] = useState<CustomPlayerState>({
    currentTrack: null,
    streamUrl: null,
    streamTitle: null,
    currentStation: null,
    shuffle: false,
    repeat: 'off',
    shuffleHistory: [],
  });

  const playerStateRef = useRef(playerState);
  // URL can repeat across adjacent schedule items; key off item id + url.
  const lastLoadedStreamKeyRef = useRef<string | null>(null);
  const lastLoadedUrlRef = useRef<string | null>(null);
  
  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  const currentTrack = playerState.currentTrack;
  const isStreaming = !!playerState.streamUrl;

  const handleNext = useCallback(() => {
    // Simplified - no collections to navigate
    return;
  }, []);

  const handlePrev = useCallback(() => {
    // Simplified - no collections to navigate
    return;
  }, []);
  
  // Simple stream: Poll for current song from timeline schedule OR play regular track
  useEffect(() => {
    const streamSrc = playerState.streamUrl;
    const trackSrc = currentTrack?.url;
    
    // Handle regular track playback (not stream)
    if (trackSrc && !streamSrc) {
      if (trackSrc !== lastLoadedUrlRef.current) {
        if (lastLoadedUrlRef.current) {
          try {
            audioPlayer.stop();
          } catch (e) {}
        }
        lastLoadedUrlRef.current = trackSrc;
        console.log('Loading track:', trackSrc, currentTrack?.title);
        audioPlayer.load(trackSrc, { 
          autoplay: true,
          html5: true,
          format: ['mp3', 'mpeg', 'mpg', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
          preload: false,
          onend: () => console.log('Track ended'),
          onloaderror: () => {
            if (lastLoadedUrlRef.current === trackSrc) {
              lastLoadedUrlRef.current = null;
            }
          },
        });
      }
      return;
    }

    // Radio stream: Poll timeline for current song
    if (!streamSrc || streamSrc !== 'http://127.0.0.1:3001/stream') {
      return;
    }

    let pollInterval: NodeJS.Timeout;
    let isPolling = true;
    let nextSongUrl: string | null = null;
    let nextSongTitle: string | null = null;

    const pollCurrentSong = async () => {
      if (!isPolling) return;
      
      try {
        const response = await fetch('http://127.0.0.1:3001/api/stream/current');
        const data = await response.json();
        
        if (data.playing && data.current?.url) {
          const currentUrl = data.current.url;
          const currentId = data.current.id;
          const audioFilePosition = data.current.audioFilePosition || 0;
          const timeRemaining = data.current.timeRemaining || 0;
          const currentStreamKey = `${currentId}:${currentUrl}`;
          
          // Store next song info for seamless transition (only log when it changes)
          if (data.next) {
            const isNewNextSong = !nextSongUrl || nextSongUrl !== data.next.url;
            nextSongUrl = data.next.url;
            nextSongTitle = data.next.title;
            if (isNewNextSong) {
              console.log(`Next song queued: ${nextSongTitle} (starts in ${((data.next.startTime - data.currentTime) / 60).toFixed(1)} min)`);
            }
          } else {
            if (nextSongUrl) {
              console.log('No next song scheduled');
            }
            nextSongUrl = null;
            nextSongTitle = null;
          }
          
          if (currentStreamKey !== lastLoadedStreamKeyRef.current) {
            // New song - load it
            if (lastLoadedUrlRef.current) {
              try {
                audioPlayer.stop();
              } catch (e) {}
            }
            
            lastLoadedStreamKeyRef.current = currentStreamKey;
            lastLoadedUrlRef.current = currentUrl;
            console.log('Playing scheduled song:', data.current.title, `(starting at ${audioFilePosition.toFixed(1)}s)`);
            
            setPlayerState(prev => ({
              ...prev,
              streamTitle: data.current.title,
            }));
            
            audioPlayer.load(currentUrl, {
              autoplay: true,
              html5: true,
              format: ['mp3', 'mpeg'],
              preload: false,
              onload: () => {
                // Seek to the live position after audio loads (for synchronized playback)
                if (audioFilePosition > 0) {
                  try {
                    // Small delay to ensure audio is ready
                    setTimeout(() => {
                      audioPlayer.seek(audioFilePosition);
                      console.log(`Seeked to live position: ${audioFilePosition.toFixed(1)}s`);
                      
                      // Ensure playback starts after seeking
                      setTimeout(() => {
                        try {
                          if (!audioPlayer.isPlaying) {
                            audioPlayer.play();
                            console.log('Started playback after sync');
                          }
                        } catch (e) {
                          console.warn('Could not start playback:', e);
                        }
                      }, 50);
                    }, 100);
                  } catch (e) {
                    console.warn('Could not seek to live position:', e);
                    // If seek fails, try to play anyway
                    setTimeout(() => {
                      try {
                        if (!audioPlayer.isPlaying) {
                          audioPlayer.play();
                        }
                      } catch (playError) {
                        console.warn('Could not start playback:', playError);
                      }
                    }, 100);
                  }
                } else {
                  // No seeking needed, just ensure playback starts
                  setTimeout(() => {
                    try {
                      if (!audioPlayer.isPlaying) {
                        audioPlayer.play();
                        console.log('Started playback');
                      }
                    } catch (e) {
                      console.warn('Could not start playback:', e);
                    }
                  }, 100);
                }
              },
              onplay: () => {
                console.log('Audio started playing');
              },
              onend: () => {
                console.log('Song ended, switching to next...');
                // Immediately switch to next song if available
                if (nextSongUrl) {
                  lastLoadedUrlRef.current = nextSongUrl;
                  lastLoadedStreamKeyRef.current = null; // next poll will set correct key
                  setPlayerState(prev => ({
                    ...prev,
                    streamTitle: nextSongTitle,
                  }));
                  
                  audioPlayer.load(nextSongUrl, {
                    autoplay: true,
                    html5: true,
                    format: ['mp3', 'mpeg'],
                    preload: false,
                    onplay: () => {
                      console.log('Next song started:', nextSongTitle);
                    },
                    onend: () => {
                      // Next song ended - immediately poll for new one
                      console.log('Next song ended, fetching new one...');
                      setTimeout(pollCurrentSong, 300);
                    },
                    onloaderror: () => {
                      console.error('Failed to load next song, polling for new one...');
                      setTimeout(pollCurrentSong, 1000);
                    },
                  });
                  
                  // Don't clear next song refs - they'll be updated on next poll
                  // This allows seamless transition if another song is queued
                } else {
                  // No next song queued, poll for new one immediately
                  setTimeout(pollCurrentSong, 300);
                }
              },
              onloaderror: () => {
                if (lastLoadedUrlRef.current === currentUrl) {
                  lastLoadedUrlRef.current = null;
                  lastLoadedStreamKeyRef.current = null;
                }
                // Retry after error
                setTimeout(pollCurrentSong, 2000);
              },
            });
            
            // Pre-fetch next song 5 seconds before current ends for seamless transition
            if (data.next && timeRemaining > 0 && timeRemaining <= 5) {
              console.log(`Pre-loading next song: ${data.next.title}`);
              // Preload is handled by the onend callback
            }
          } else {
            // Same song - check if we need to sync position (drift correction)
            // Only sync if audio is actually loaded and playing
            try {
              const currentPosition = audioPlayer.getPosition();
              const duration = audioPlayer.duration || 0;
              const isPlaying = audioPlayer.isPlaying;
              
              // Only sync if:
              // 1. Audio is loaded (duration > 0)
              // 2. Audio is actually playing (not stuck at 0)
              // 3. Position difference is significant (> 2 seconds)
              // 4. Don't sync if position is 0 and audioFilePosition is large (audio might still be loading)
              if (duration > 0 && isPlaying && currentPosition >= 0) {
                const positionDiff = Math.abs(currentPosition - audioFilePosition);
                
                // Prevent sync loop: if position is 0 and we need to seek far, audio might not be loaded yet
                // Only sync if we're actually playing (position > 0) or if the drift is reasonable
                if (positionDiff > 2 && (currentPosition > 0 || audioFilePosition < 5)) {
                  // Throttle sync attempts - only sync once every 10 seconds max
                  const lastSyncTime = (window as any).lastSyncTime || 0;
                  const now = Date.now();
                  if (now - lastSyncTime > 10000) {
                    console.log(`Syncing position: ${currentPosition.toFixed(1)}s -> ${audioFilePosition.toFixed(1)}s (drift: ${positionDiff.toFixed(1)}s)`);
                    audioPlayer.seek(audioFilePosition);
                    (window as any).lastSyncTime = now;
                  }
                }
              }
            } catch (e) {
              // Ignore sync errors
            }
            
            // Always update next song info if available (only log when it changes)
            if (data.next) {
              const isNewNextSong = !nextSongUrl || nextSongUrl !== data.next.url;
              nextSongUrl = data.next.url;
              nextSongTitle = data.next.title;
              if (isNewNextSong) {
                console.log(`Updated next song: ${nextSongTitle}`);
              }
            } else {
              if (nextSongUrl) {
                nextSongUrl = null;
                nextSongTitle = null;
              }
            }
          }
        } else if (data.next) {
          // No current song, but next one is coming
          const waitTime = Math.max(1000, (data.next.startTime - data.currentTime) * 1000);
          console.log(`Waiting for next song: ${data.next.title} (in ${(waitTime/1000).toFixed(0)}s)`);
          
          // Update UI to show we're waiting
          setPlayerState(prev => ({
            ...prev,
            streamTitle: `Next: ${data.next.title} (in ${(waitTime/1000).toFixed(0)}s)`,
          }));
          
          setTimeout(pollCurrentSong, Math.min(waitTime, 5000));
        } else {
          // No content scheduled - show offline
          console.log('No content scheduled - radio is offline');
          setPlayerState(prev => ({
            ...prev,
            streamTitle: 'Offline - No content scheduled',
          }));
          
          // Stop current playback if any
          try {
            audioPlayer.stop();
            lastLoadedUrlRef.current = null;
            lastLoadedStreamKeyRef.current = null;
          } catch (e) {}
          
          // Check again in 10 seconds
          setTimeout(pollCurrentSong, 10000);
        }
      } catch (error) {
        console.error('Error polling stream:', error);
        setTimeout(pollCurrentSong, 5000);
      }
    };

    pollCurrentSong();
    pollInterval = setInterval(pollCurrentSong, 5000);

    return () => {
      isPolling = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [playerState.streamUrl, currentTrack?.url, audioPlayer]);

  const playStream = useCallback((urlOrStation: string | RadioStation, title?: string) => {
    console.log('Playing stream:', urlOrStation);
    if (typeof urlOrStation === 'string') {
      setPlayerState({
        currentTrack: null,
        streamUrl: urlOrStation,
        streamTitle: title ?? null,
        currentStation: null,
        shuffle: false,
        repeat: 'off',
        shuffleHistory: [],
      });
    } else if (urlOrStation && typeof urlOrStation === 'object') {
      setPlayerState({
        currentTrack: null,
        streamUrl: urlOrStation.streamUrl ?? null,
        streamTitle: urlOrStation.name ?? title ?? null,
        currentStation: urlOrStation,
        shuffle: false,
        repeat: 'off',
        shuffleHistory: [],
      });
    }
  }, []);

  const playTrack = useCallback((track: Track) => {
    setPlayerState({
      currentTrack: track,
      streamUrl: null,
      streamTitle: null,
      currentStation: null,
      shuffle: false,
      repeat: 'off',
      shuffleHistory: [],
    });
  }, []);

  const stopAudio = useCallback(() => {
    console.log('Stopping audio');
    audioPlayer.stop();
    lastLoadedUrlRef.current = null;
    lastLoadedStreamKeyRef.current = null;
    setPlayerState({
      currentTrack: null,
      streamUrl: null,
      streamTitle: null,
      currentStation: null,
      shuffle: false,
      repeat: 'off',
      shuffleHistory: [],
    });
  }, [audioPlayer]);

  const toggleShuffle = useCallback(() => {
    console.log('Toggle shuffle');
    setPlayerState(s => ({ 
      ...s, 
      shuffle: !s.shuffle, 
      shuffleHistory: !s.shuffle ? [] : [] 
    }));
  }, []);
  
  const setRepeatMode = useCallback((mode: 'off' | 'one' | 'all') => {
    console.log('Set repeat mode:', mode);
    setPlayerState(s => ({ ...s, repeat: mode }));
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const playlistStateMemo = useMemo(() => ({ ...playerState, isStreaming }), [playerState, isStreaming]);
  
  const value: PlayerContextType = useMemo(() => ({
    audioState: audioPlayer,
    playlistState: playlistStateMemo,
    next: handleNext,
    prev: handlePrev,
    playStream,
    playTrack,
    stopAudio,
    toggleShuffle,
    setRepeat: setRepeatMode,
  }), [audioPlayer, playlistStateMemo, handleNext, handlePrev, playStream, playTrack, stopAudio, toggleShuffle, setRepeatMode]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    console.error('usePlayer must be used within a PlayerProvider - context is null');
    // Return a minimal context to prevent crashes
    return {
      audioState: {} as any,
      playlistState: {
        currentTrack: null,
        streamUrl: null,
        streamTitle: null,
        currentStation: null,
        shuffle: false,
        repeat: 'off' as const,
        shuffleHistory: [],
        isStreaming: false,
      },
      next: () => {},
      prev: () => {},
      playStream: () => {},
      playTrack: () => {},
      stopAudio: () => {},
      toggleShuffle: () => {},
      setRepeat: () => {},
    };
  }
  return context;
}
