import { useRef, useCallback, useEffect } from 'react';
import {
  initializeAudioContext,
  getWaveformData,
  resumeAudioContext,
  setupAudioElementEvents,
  generateListenerId,
  isAudioActuallyPlaying,
} from './audioUtils';
import { AUDIO_CONFIG, POLLING_INTERVALS } from './constants';

interface AudioContextRefs {
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  dataArrayRef: React.MutableRefObject<Uint8Array | null>;
  sourceRef: React.MutableRefObject<MediaElementAudioSourceNode | null>;
}

/**
 * Hook to manage Web Audio API context and connections
 */
export function useAudioContext(audioElement: HTMLAudioElement | null) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const contextRefs: AudioContextRefs = {
    audioContextRef,
    analyserRef,
    dataArrayRef,
    sourceRef,
  };

  const initialize = useCallback((forceReconnect = false): boolean => {
    return initializeAudioContext(audioElement, contextRefs, forceReconnect);
  }, [audioElement]);

  const resume = useCallback(() => {
    return resumeAudioContext(audioContextRef.current);
  }, []);

  const getFrequencyData = useCallback((barCount?: number): number[] => {
    if (!analyserRef.current || !dataArrayRef.current) {
      return new Array(barCount || AUDIO_CONFIG.WAVEFORM_BARS).fill(0);
    }
    return getWaveformData(analyserRef.current, dataArrayRef.current, barCount);
  }, []);

  const setupEvents = useCallback(
    (onCanPlay: () => void, onLoadedData: () => void) => {
      if (!audioElement) return () => {};
      return setupAudioElementEvents(audioElement, onCanPlay, onLoadedData);
    },
    [audioElement]
  );

  return {
    refs: contextRefs,
    initialize,
    resume,
    getFrequencyData,
    setupEvents,
  };
}

/**
 * Hook to manage audio playback (play/pause, volume, mute)
 */
export function useAudioPlayback(
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  audioContextRef: React.MutableRefObject<AudioContext | null>
) {
  const userHasInteractedRef = useRef(false);
  const pendingPlayRef = useRef(false);

  const play = useCallback(async () => {
    const audioElement = audioRef.current;
    if (!audioElement) return false;

    try {
      // Resume context in parallel and call play immediately to preserve user-gesture playback on mobile.
      if (audioContextRef.current?.state === 'suspended') {
        void audioContextRef.current.resume().catch(() => {});
      }

      await audioElement.play();

      // Request wake lock on mobile if supported
      if ('wakeLock' in navigator) {
        (navigator as any).wakeLock?.request('screen').catch(() => {
          // Wake lock not supported or denied - continue anyway
        });
      }

      return true;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'NotSupportedError') {
        pendingPlayRef.current = true;
        console.log('Autoplay blocked, waiting for user interaction...');
        return false;
      }
      console.error('Play failed:', err);
      return false;
    }
  }, [audioRef, audioContextRef]);

  const pause = useCallback(() => {
    const audioElement = audioRef.current;
    if (audioElement) {
      audioElement.pause();
    }
  }, [audioRef]);

  const setVolume = useCallback((volume: number) => {
    const audioElement = audioRef.current;
    if (audioElement) {
      audioElement.volume = volume / 100;
    }
  }, [audioRef]);

  const setMuted = useCallback((muted: boolean) => {
    const audioElement = audioRef.current;
    if (audioElement) {
      audioElement.muted = muted;
    }
  }, [audioRef]);

  const setupUserInteractionListener = useCallback(() => {
    const enableAutoplay = async () => {
      const audioElement = audioRef.current;
      userHasInteractedRef.current = true;
      if (!pendingPlayRef.current || !audioElement) return;
      try {
        await audioElement.play();
        pendingPlayRef.current = false;
        console.log('Autoplay enabled after user interaction');
      } catch (err) {
        console.log('Play failed even after interaction:', err);
      }
    };

    const events = ['pointerdown', 'touchstart', 'click', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, enableAutoplay);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, enableAutoplay);
      });
    };
  }, [audioRef]);

  return {
    play,
    pause,
    setVolume,
    setMuted,
    setupUserInteractionListener,
    userHasInteractedRef,
    pendingPlayRef,
  };
}

/**
 * Hook to manage waveform visualization animation
 */
export function useWaveform(
  isPlaying: boolean,
  analyser: AnalyserNode | null,
  dataArray: Uint8Array | null,
  onDataUpdate: (updater: (prev: number[]) => number[]) => void,
  audioElement?: HTMLAudioElement | null,
  onSignalDrop?: () => void
) {
  const animationRef = useRef<number | null>(null);
  const noSignalFramesRef = useRef(0);
  const lastSignalDropActionRef = useRef(0);

  const updateAudioData = useCallback(() => {
    if (!analyser || !dataArray) {
      // Keep subtle idle motion even before analyser attaches to avoid visual freeze.
      onDataUpdate((prevData: number[]) =>
        (prevData || new Array(50).fill(0)).map((value, i) =>
          Math.max(value * 0.9, 0.03 + Math.abs(Math.sin((Date.now() / 350) + i * 0.25)) * 0.02)
        )
      );
      animationRef.current = requestAnimationFrame(updateAudioData);
      return;
    }

    try {
      const newData = getWaveformData(analyser, dataArray);
      const hasSignal = newData.some(v => v > 0.015);
      noSignalFramesRef.current = hasSignal ? 0 : noSignalFramesRef.current + 1;
      const isActuallyPlaying = isAudioActuallyPlaying(audioElement ?? null) || isPlaying;

      // Waveform watchdog: if audio is playing but analyser is flat for too long,
      // trigger a throttled recovery callback to reconnect the analyser graph.
      if (isActuallyPlaying && noSignalFramesRef.current > 90 && onSignalDrop) {
        const now = Date.now();
        if (now - lastSignalDropActionRef.current > 4000) {
          lastSignalDropActionRef.current = now;
          onSignalDrop();
        }
      }

      onDataUpdate((prevData: number[]) => {
        const previous = prevData || new Array(50).fill(0);

        // If analyser briefly drops while streaming is playing, synthesize a tasteful motion pattern
        // so the user never sees a frozen waveform.
        const fallbackData =
          isActuallyPlaying && noSignalFramesRef.current > 24
            ? previous.map((_, i) => 0.15 + Math.abs(Math.sin((Date.now() / 170) + i * 0.35)) * 0.22)
            : newData;

        if (isActuallyPlaying) {
          // When playing: smooth and responsive.
          return fallbackData.map(
            (value, i) => previous[i] * 0.45 + value * 0.55
          );
        } else {
          // When paused: fade to idle but keep minimal activity
          return previous.map(
            (value: number, i: number) =>
              Math.max(value * 0.86, 0.035 + Math.abs(Math.sin((Date.now() / 500) + i * 0.2)) * 0.015)
          );
        }
      });
    } catch (error) {
      console.warn('Error updating audio data:', error);
      onDataUpdate((prevData: number[]) => prevData);
    }

    animationRef.current = requestAnimationFrame(updateAudioData);
  }, [analyser, dataArray, isPlaying, onDataUpdate, audioElement, onSignalDrop]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(updateAudioData);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [updateAudioData]);

  return { animationRef };
}

/**
 * Hook to track active listeners and send heartbeat
 */
export function useListenerTracking(isPlaying: boolean, api: any) {
  const listenerIdRef = useRef<string>(generateListenerId());

  useEffect(() => {
    const sendPing = async () => {
      if (isPlaying) {
        try {
          await api.post('/listeners/ping', {
            listenerId: listenerIdRef.current,
            isPlaying,
          });
        } catch (error) {
          // Silently fail - don't interrupt user experience
        }
      }
    };

    // Send ping immediately and then every 5 seconds
    sendPing();
    const interval = setInterval(sendPing, POLLING_INTERVALS.LISTENER_PING);

    return () => clearInterval(interval);
  }, [isPlaying, api]);

  return { listenerIdRef };
}

/**
 * Hook to manage background playback and page visibility
 */
export function useBackgroundPlayback(isPlaying: boolean, currentSongPlaying: boolean) {
  useEffect(() => {
    const audio = document.querySelector('audio') as HTMLAudioElement | null;
    if (!audio || !currentSongPlaying) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isPlaying && audio.paused) {
          audio.play().catch(err => {
            console.log('Background play attempt failed:', err);
          });
        }
      } else {
        if (isPlaying && audio.paused) {
          audio.play().catch(err => {
            console.log('Resume play failed:', err);
          });
        }
      }
    };

    const handleBlur = () => {
      if (audio && isPlaying && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isPlaying, currentSongPlaying]);
}

/**
 * Hook to maintain playback during tab transitions
 */
export function useAutoPlayback(
  isPlaying: boolean,
  currentSongPlaying: boolean,
  queryClient: any
) {
  useEffect(() => {
    const audio = document.querySelector('audio') as HTMLAudioElement | null;
    if (!audio) return;

    const keepPlaying = async () => {
      // If playing but paused, resume
      if (isPlaying && audio.paused && currentSongPlaying) {
        try {
          await audio.play();
        } catch (err) {
          console.log('Background play attempt:', err);
        }
      }

      // If song ended but still supposed to play, load next
      if (isPlaying && audio.ended && currentSongPlaying) {
        console.log('Song ended, checking for next song...');
        queryClient.invalidateQueries({ queryKey: ['stream-current'] });
      }
    };

    const interval = setInterval(keepPlaying, POLLING_INTERVALS.AUDIO_KEEP_ALIVE);
    return () => clearInterval(interval);
  }, [isPlaying, currentSongPlaying, queryClient]);
}
