import { Howl } from 'howler';
import { Track, Show, ModeratorMessage } from '@shared/schema';

type AudioTrack = {
  id: string;
  howl: Howl | null;
  track: Track;
};

type PlaybackState = {
  playing: boolean;
  volume: number;
  currentTime: number;
  currentTrackId: string | null;
  queue: AudioTrack[];
  history: AudioTrack[];
};

class AudioService {
  private state: PlaybackState = {
    playing: false,
    volume: 1.0,
    currentTime: 0,
    currentTrackId: null,
    queue: [],
    history: [],
  };
  
  private listeners: Set<(state: PlaybackState) => void> = new Set();
  private updateInterval: number | null = null;
  
  constructor() {
    // Initialize interval to update time
    this.startUpdateInterval();
  }
  
  // Subscribe to state changes
  subscribe(callback: (state: PlaybackState) => void): () => void {
    this.listeners.add(callback);
    // Immediately notify of current state
    callback({ ...this.state });
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  // Notify all listeners of state change
  private notifyListeners(): void {
    const stateCopy = { ...this.state };
    this.listeners.forEach(listener => listener(stateCopy));
  }
  
  // Start interval to update current time
  private startUpdateInterval(): void {
    if (this.updateInterval) return;
    
    this.updateInterval = window.setInterval(() => {
      if (this.state.playing && this.getCurrentHowl()) {
        this.state.currentTime = this.getCurrentHowl()?.seek() || 0;
        this.notifyListeners();
      }
    }, 1000);
  }
  
  // Stop the update interval
  private stopUpdateInterval(): void {
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  // Get the current Howl instance
  private getCurrentHowl(): Howl | null {
    if (!this.state.currentTrackId) return null;
    const currentTrack = this.state.queue.find(t => t.id === this.state.currentTrackId);
    return currentTrack?.howl || null;
  }
  
  // Generate a unique ID for each audio track
  private generateTrackId(): string {
    return `track_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  // Add a track to the queue
  addTrack(track: Track): void {
    const audioTrack: AudioTrack = {
      id: this.generateTrackId(),
      howl: null,
      track,
    };
    
    this.state.queue.push(audioTrack);
    
    // If this is the first track and nothing is playing, start it
    if (this.state.queue.length === 1 && !this.state.currentTrackId) {
      this.state.currentTrackId = audioTrack.id;
      this.loadCurrentTrack();
    }
    
    this.notifyListeners();
  }
  
  // Load multiple tracks to queue
  loadPlaylist(tracks: Track[]): void {
    // Clear current queue but keep currently playing
    const currentTrack = this.state.currentTrackId 
      ? this.state.queue.find(t => t.id === this.state.currentTrackId)
      : null;
    
    this.state.queue = currentTrack ? [currentTrack] : [];
    
    // Add tracks to queue
    tracks.forEach(track => {
      this.state.queue.push({
        id: this.generateTrackId(),
        howl: null,
        track,
      });
    });
    
    // If nothing is playing, start the first track
    if (!this.state.currentTrackId && this.state.queue.length > 0) {
      this.state.currentTrackId = this.state.queue[0].id;
      this.loadCurrentTrack();
    }
    
    this.notifyListeners();
  }
  
  // Load and setup the current track
  private loadCurrentTrack(): void {
    if (!this.state.currentTrackId) return;
    
    const trackIndex = this.state.queue.findIndex(t => t.id === this.state.currentTrackId);
    if (trackIndex === -1) return;
    
    const currentTrack = this.state.queue[trackIndex];
    if (currentTrack.howl) return; // Already loaded
    
    // For development environment, use a demo URL if needed
    const audioUrl = process.env.NODE_ENV === 'development' && !currentTrack.track.url.startsWith('http')
      ? 'https://storage.googleapis.com/media-session/sintel/snow-fight.mp3' // Demo fallback
      : currentTrack.track.url;
    
    // Create new Howl instance
    currentTrack.howl = new Howl({
      src: [audioUrl],
      html5: true, // Use HTML5 Audio to stream
      volume: this.state.volume,
      onplay: () => {
        this.state.playing = true;
        this.notifyListeners();
      },
      onpause: () => {
        this.state.playing = false;
        this.notifyListeners();
      },
      onstop: () => {
        this.state.playing = false;
        this.notifyListeners();
      },
      onend: () => {
        // Auto play next track
        this.next();
      },
      onloaderror: () => {
        console.error(`Failed to load audio: ${currentTrack.track.title}`);
        // Skip to next track if this one fails
        this.next();
      },
      onplayerror: () => {
        console.error(`Failed to play audio: ${currentTrack.track.title}`);
        // Try to recover by skipping to next
        this.next();
      }
    });
  }
  
  // Play or pause the current track
  togglePlayPause(): void {
    const howl = this.getCurrentHowl();
    
    if (!howl) {
      this.loadCurrentTrack();
      const newHowl = this.getCurrentHowl();
      if (newHowl) {
        newHowl.play();
      }
      return;
    }
    
    if (this.state.playing) {
      howl.pause();
    } else {
      howl.play();
    }
  }
  
  // Skip to the next track
  next(): void {
    if (!this.state.currentTrackId) return;
    
    // Find current index
    const currentIndex = this.state.queue.findIndex(t => t.id === this.state.currentTrackId);
    if (currentIndex === -1) return;
    
    // Stop current track
    const currentTrack = this.state.queue[currentIndex];
    if (currentTrack.howl) {
      currentTrack.howl.stop();
      // Move to history
      this.state.history.push({ ...currentTrack });
    }
    
    // If this is the last track, stop playback
    if (currentIndex === this.state.queue.length - 1) {
      this.state.currentTrackId = null;
      this.state.playing = false;
      this.notifyListeners();
      return;
    }
    
    // Move to next track
    const nextTrack = this.state.queue[currentIndex + 1];
    this.state.currentTrackId = nextTrack.id;
    this.loadCurrentTrack();
    
    // Auto-play the next track
    const howl = this.getCurrentHowl();
    if (howl) {
      howl.play();
    }
    
    this.notifyListeners();
  }
  
  // Go back to previous track
  previous(): void {
    if (!this.state.currentTrackId || this.state.history.length === 0) return;
    
    // Find current track
    const currentIndex = this.state.queue.findIndex(t => t.id === this.state.currentTrackId);
    if (currentIndex === -1) return;
    
    // If current track has played more than 3 seconds, restart it instead
    const currentHowl = this.getCurrentHowl();
    if (currentHowl && currentHowl.seek() > 3) {
      currentHowl.seek(0);
      this.notifyListeners();
      return;
    }
    
    // Stop current track
    const currentTrack = this.state.queue[currentIndex];
    if (currentTrack.howl) {
      currentTrack.howl.stop();
    }
    
    // Get last track from history
    const previousTrack = this.state.history.pop();
    if (!previousTrack) return;
    
    // Add it back to the queue at the current position
    this.state.queue.splice(currentIndex, 0, { ...previousTrack, howl: null });
    
    // Set as current and play it
    this.state.currentTrackId = previousTrack.id;
    this.loadCurrentTrack();
    
    const howl = this.getCurrentHowl();
    if (howl) {
      howl.play();
    }
    
    this.notifyListeners();
  }
  
  // Seek to a specific time
  seek(time: number): void {
    const howl = this.getCurrentHowl();
    if (!howl) return;
    
    howl.seek(time);
    this.state.currentTime = time;
    this.notifyListeners();
  }
  
  // Set volume (0-1)
  setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, volume));
    
    const howl = this.getCurrentHowl();
    if (howl) {
      howl.volume(this.state.volume);
    }
    
    this.notifyListeners();
  }
  
  // Get current track info
  getCurrentTrack(): Track | null {
    if (!this.state.currentTrackId) return null;
    
    const currentTrack = this.state.queue.find(t => t.id === this.state.currentTrackId);
    return currentTrack?.track || null;
  }
  
  // Get next tracks in queue
  getUpcomingTracks(count: number = 3): Track[] {
    if (!this.state.currentTrackId) {
      return this.state.queue.slice(0, count).map(t => t.track);
    }
    
    const currentIndex = this.state.queue.findIndex(t => t.id === this.state.currentTrackId);
    if (currentIndex === -1) return [];
    
    return this.state.queue
      .slice(currentIndex + 1, currentIndex + 1 + count)
      .map(t => t.track);
  }
  
  // Get playback state
  getState(): PlaybackState {
    return { ...this.state };
  }
  
  // Clear queue but keep current track
  clearQueue(): void {
    if (!this.state.currentTrackId) {
      this.state.queue = [];
      this.notifyListeners();
      return;
    }
    
    const currentTrack = this.state.queue.find(t => t.id === this.state.currentTrackId);
    if (currentTrack) {
      this.state.queue = [currentTrack];
    } else {
      this.state.queue = [];
    }
    
    this.notifyListeners();
  }
  
  // Get current track duration
  getDuration(): number {
    const howl = this.getCurrentHowl();
    return howl ? howl.duration() : 0;
  }
  
  // Insert a moderator message after the current track
  insertMessage(message: ModeratorMessage): void {
    if (!this.state.currentTrackId) return;
    
    // Find the current track index
    const currentIndex = this.state.queue.findIndex(t => t.id === this.state.currentTrackId);
    if (currentIndex === -1) return;
    
    // Create a track-like object for the message
    const messageTrack: Track = {
      id: -1, // Will be assigned by server in real implementation
      title: `Message: ${message.type}`,
      artist: "Golden Pearl Radio",
      duration: message.duration,
      url: "https://storage.googleapis.com/media-session/sintel/snow-fight.mp3", // Demo audio for development
      createdAt: new Date(),
      // Added properties for messages
      message: message.content,
      messageType: message.type
    };
    
    // Insert as the next track
    const audioTrack: AudioTrack = {
      id: this.generateTrackId(),
      howl: null,
      track: messageTrack,
    };
    
    this.state.queue.splice(currentIndex + 1, 0, audioTrack);
    this.notifyListeners();
  }
  
  // Clean up resources
  dispose(): void {
    this.stopUpdateInterval();
    
    // Stop and unload all tracks
    this.state.queue.forEach(track => {
      if (track.howl) {
        track.howl.stop();
        track.howl.unload();
      }
    });
    
    this.state.history.forEach(track => {
      if (track.howl) {
        track.howl.stop();
        track.howl.unload();
      }
    });
    
    this.listeners.clear();
  }
}

// Create singleton instance
const audioService = new AudioService();
export default audioService;
