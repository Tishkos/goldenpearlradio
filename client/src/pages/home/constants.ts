/**
 * Radio Player Configuration Constants
 */

// Audio Context Configuration
export const AUDIO_CONFIG = {
  FFT_SIZE: 256,
  SMOOTHING_TIME_CONSTANT: 0.3,
  MIN_DECIBELS: -90,
  MAX_DECIBELS: -10,
  WAVEFORM_BARS: 50,
} as const;

// Polling & Timing Intervals (in milliseconds)
export const POLLING_INTERVALS = {
  STREAM_ACTIVE: 2000, // Poll every 2 seconds when actively playing
  STREAM_INACTIVE: 2000, // Poll every 2 seconds otherwise for tighter live sync
  LISTENER_UPDATE: 5000, // Update listener count every 5 seconds
  LISTENER_PING: 5000, // Send heartbeat every 5 seconds
  TIME_UPDATE: 1000, // Update clock every second
  AUDIO_KEEP_ALIVE: 1000, // Check audio context state every second
  RECONNECT_THROTTLE: 3000, // Throttle reconnection attempts to 1 per 3 seconds
  SEEK_COMPLETE_DELAY: 150, // Wait for seek to complete
  INIT_RETRY_DELAY: 50, // Retry initialization after 50ms
  METADATA_LOAD_DELAY: 200, // Wait for metadata to load
  AUTOPLAY_RETRY_DELAY: 500, // Retry autoplay after delay
} as const;

// Audio Data Smoothing
export const SMOOTHING = {
  PLAYING_SMOOTHING: 0.5, // When playing
  PAUSED_SMOOTHING: 0.85, // When paused
  MIN_IDLE_HEIGHT: 0.05, // Minimum height when idle
  MIN_BAR_HEIGHT: 4, // Pixels
  MAX_BAR_HEIGHT: 48, // Pixels
} as const;

// UI/Display Constants
export const UI = {
  VERSION: 'Golden Pearl Radio',
  LOCATION: 'DUBAI',
  NO_BROADCAST_CHECK_TEXT: 'Check back soon',
  WAVEFORM_TRANSITION: '0.05s linear',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  STREAM_CURRENT: '/api/stream/current',
  LISTENERS_CURRENT: '/listeners/current',
  LISTENERS_PING: '/listeners/ping',
  TIMELINE_ITEMS: '/timeline-items',
  PRODUCTS: '/products',
} as const;

// Query Keys for React Query
export const QUERY_KEYS = {
  LISTENERS_CURRENT: ['listeners', 'current'],
  STREAM_CURRENT: ['stream-current'],
  TIMELINE_ITEMS: (date: string) => ['timeline-items', date],
  PRODUCT: (id: number) => ['product', id],
} as const;

// Waveform Animation
export const WAVEFORM = {
  ANIMATION_SPEED: 60,
  SHOW_RADIAL_GRADIENT: true,
} as const;

// Cache Durations (in milliseconds)
export const CACHE_DURATIONS = {
  PLAYLIST: 30 * 1000, // 30 seconds
  PRODUCT: 30 * 1000, // 30 seconds
} as const;

// Feature Flags
export const FEATURES = {
  ENABLE_WAKE_LOCK: true, // Request screen wake lock on mobile
  ENABLE_BACKGROUND_PLAYBACK: true,
  ENABLE_WAVEFORM_VISUALIZATION: true,
  ENABLE_LISTENER_TRACKING: true,
} as const;

// Error Messages & Logging
export const LOG_MESSAGES = {
  AUDIO_CONTEXT_INIT: '✅ Audio context initialized successfully',
  AUDIO_CONTEXT_INIT_FAILED: '❌ Error initializing audio context',
  MEDIA_SOURCE_CREATED: '✅ MediaElementSource created and connected successfully',
  MEDIA_SOURCE_EXISTS: '⚠️ MediaElementSource already exists',
  CONNECTION_VERIFIED: '✅ Connection verified - analyser is receiving data',
  CONNECTION_NO_DATA: '⚠️ Connection established but analyser has no data yet',
  AUDIO_PLAYING_NO_DATA: '⚠️ Audio playing but analyser has no data. Attempting to reconnect...',
  AUTOPLAY_BLOCKED: 'Autoplay blocked, waiting for user interaction...',
  AUTOPLAY_ENABLED: 'Autoplay enabled after user interaction',
  SONG_ENDED: 'Song ended, automatically loading next song...',
} as const;
