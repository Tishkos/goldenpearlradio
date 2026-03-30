import { AUDIO_CONFIG, POLLING_INTERVALS, LOG_MESSAGES } from './constants';

/**
 * Audio Context Utilities
 * Handles creation, initialization, and management of Web Audio API context
 */

interface AudioContextRefs {
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  dataArrayRef: React.MutableRefObject<Uint8Array | null>;
  sourceRef: React.MutableRefObject<MediaElementAudioSourceNode | null>;
}

/**
 * Initialize or reuse audio context for visualization
 * Handles all the complex setup with proper error handling and reconnection logic
 */
export function initializeAudioContext(
  audioElement: HTMLAudioElement | null,
  refs: AudioContextRefs,
  forceReconnect = false
): boolean {
  if (!audioElement) {
    return false;
  }

  const { audioContextRef, analyserRef, dataArrayRef, sourceRef } = refs;

  // If already fully initialized and not forcing reconnect, just resume if suspended
  if (
    !forceReconnect &&
    audioContextRef.current &&
    analyserRef.current &&
    dataArrayRef.current
  ) {
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(err => {
        console.warn('Failed to resume audio context:', err);
      });
    }
    return true;
  }

  try {
    // Create or reuse audio context
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;

    // Reuse existing analyser if it exists and is valid
    let analyser = analyserRef.current;
    if (!analyser || forceReconnect) {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = AUDIO_CONFIG.FFT_SIZE;
      analyser.smoothingTimeConstant = AUDIO_CONFIG.SMOOTHING_TIME_CONSTANT;
      analyser.minDecibels = AUDIO_CONFIG.MIN_DECIBELS;
      analyser.maxDecibels = AUDIO_CONFIG.MAX_DECIBELS;
      analyserRef.current = analyser;
    }

    // Create source if it doesn't exist
    if (!sourceRef.current) {
      try {
        const source = audioContext.createMediaElementSource(audioElement);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        sourceRef.current = source;
        console.log(LOG_MESSAGES.MEDIA_SOURCE_CREATED);
      } catch (error: any) {
        if (
          error.message &&
          (error.message.includes('already been created') ||
            error.message.includes('already connected'))
        ) {
          console.warn(LOG_MESSAGES.MEDIA_SOURCE_EXISTS);
          try {
            analyser.connect(audioContext.destination);
            console.log('✅ Analyser connected to destination (source exists elsewhere)');
          } catch (e) {
            console.warn('❌ Could not connect analyser:', e);
          }
        } else {
          throw error;
        }
      }
    } else {
      // Source already exists - ensure it's connected to analyser
      try {
        try {
          sourceRef.current.disconnect();
        } catch (disconnectErr: any) {
          // Ignore disconnect errors if nothing to disconnect
        }

        try {
          analyser.disconnect();
        } catch (disconnectErr: any) {
          // Ignore disconnect errors
        }

        // Reconnect: source -> analyser -> destination
        sourceRef.current.connect(analyser);
        analyser.connect(audioContext.destination);
        console.log('✅ Reconnected existing source to analyser');

        // Verify connection
        setTimeout(() => {
          if (dataArrayRef.current) {
            analyser.getByteFrequencyData(dataArrayRef.current as Uint8Array<ArrayBuffer>);
            const hasData = dataArrayRef.current.some(val => val > 0);
            if (hasData) {
              console.log(LOG_MESSAGES.CONNECTION_VERIFIED);
            } else {
              console.warn(LOG_MESSAGES.CONNECTION_NO_DATA);
            }
          }
        }, POLLING_INTERVALS.INIT_RETRY_DELAY);
      } catch (e: any) {
        if (
          e.message &&
          (e.message.includes('already connected') ||
            e.message.includes('already been connected'))
        ) {
          console.log('✅ Source already connected to analyser');
        } else {
          console.warn('⚠️ Error reconnecting source:', e);
        }
      }
    }

    // Create or reuse data array
    if (!dataArrayRef.current || forceReconnect) {
      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
    }

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(err => {
        console.warn('Failed to resume audio context on init:', err);
      });
    }

    console.log(LOG_MESSAGES.AUDIO_CONTEXT_INIT, {
      hasSource: !!sourceRef.current,
      hasAnalyser: !!analyserRef.current,
      hasDataArray: !!dataArrayRef.current,
      contextState: audioContext.state,
    });

    return true;
  } catch (error: any) {
    console.error(LOG_MESSAGES.AUDIO_CONTEXT_INIT_FAILED, error);
    if (
      forceReconnect &&
      error.message &&
      !error.message.includes('already been created') &&
      !error.message.includes('already connected')
    ) {
      audioContextRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;
      sourceRef.current = null;
    }
    return false;
  }
}

/**
 * Extract frequency data from analyser and normalize to 0-1 range
 */
export function getWaveformData(
  analyser: AnalyserNode,
  dataArray: Uint8Array,
  barCount: number = AUDIO_CONFIG.WAVEFORM_BARS
): number[] {
  try {
    analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);

    const bars = barCount;
    const step = Math.floor(dataArray.length / bars);
    const newData: number[] = [];

    for (let i = 0; i < bars; i++) {
      const start = i * step;
      const end = start + step;
      let max = 0;

      for (let j = start; j < end && j < dataArray.length; j++) {
        max = Math.max(max, dataArray[j]);
      }

      // Normalize to 0-1 range with logarithmic scaling
      const normalized = Math.sqrt(max / 255);
      newData.push(normalized);
    }

    return newData;
  } catch (error) {
    console.warn('Error getting frequency data:', error);
    return new Array(barCount).fill(0);
  }
}

/**
 * Resume audio context if suspended
 */
export function resumeAudioContext(
  audioContext: AudioContext | null
): Promise<void> {
  return new Promise((resolve) => {
    if (!audioContext) {
      resolve();
      return;
    }

    if (audioContext.state === 'suspended') {
      audioContext
        .resume()
        .then(() => {
          console.log('Audio context resumed');
          resolve();
        })
        .catch(err => {
          console.warn('Failed to resume audio context:', err);
          resolve(); // Resolve anyway to not block playback
        });
    } else {
      resolve();
    }
  });
}

/**
 * Check if audio is actually playing (not just in playing state)
 */
export function isAudioActuallyPlaying(audio: HTMLAudioElement | null): boolean {
  return !!(audio && !audio.paused && !audio.ended && audio.readyState >= 2);
}

/**
 * Generate unique listener ID
 */
export function generateListenerId(): string {
  return `listener-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Setup audio element event listeners for waveform initialization
 */
export function setupAudioElementEvents(
  audioElement: HTMLAudioElement,
  onCanPlay: () => void,
  onLoadedData: () => void
): () => void {
  audioElement.addEventListener('canplay', onCanPlay);
  audioElement.addEventListener('loadeddata', onLoadedData);

  return () => {
    audioElement.removeEventListener('canplay', onCanPlay);
    audioElement.removeEventListener('loadeddata', onLoadedData);
  };
}
