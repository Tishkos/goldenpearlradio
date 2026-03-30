import { Track } from "@shared/schema";

// Mood weighting for better transitions
const MOOD_COMPATIBILITY: Record<string, Record<string, number>> = {
  upbeat: { upbeat: 1, energetic: 0.8, happy: 0.7, chill: 0.4, relaxed: 0.3, melancholic: 0.1, romantic: 0.3 },
  energetic: { upbeat: 0.8, energetic: 1, happy: 0.7, chill: 0.3, relaxed: 0.2, melancholic: 0.1, romantic: 0.2 },
  happy: { upbeat: 0.7, energetic: 0.7, happy: 1, chill: 0.5, relaxed: 0.4, melancholic: 0.2, romantic: 0.5 },
  chill: { upbeat: 0.4, energetic: 0.3, happy: 0.5, chill: 1, relaxed: 0.8, melancholic: 0.5, romantic: 0.7 },
  relaxed: { upbeat: 0.3, energetic: 0.2, happy: 0.4, chill: 0.8, relaxed: 1, melancholic: 0.6, romantic: 0.7 },
  melancholic: { upbeat: 0.1, energetic: 0.1, happy: 0.2, chill: 0.5, relaxed: 0.6, melancholic: 1, romantic: 0.6 },
  romantic: { upbeat: 0.3, energetic: 0.2, happy: 0.5, chill: 0.7, relaxed: 0.7, melancholic: 0.6, romantic: 1 },
};

// Genre weights for transitions
const GENRE_COMPATIBILITY: Record<string, string[]> = {
  Electronic: ["Electronic", "Pop", "Hip Hop", "Lounge", "Ambient"],
  Pop: ["Pop", "Electronic", "Rock", "RnB", "Hip Hop"],
  Rock: ["Rock", "Pop", "Alternative", "Indie"],
  "Hip Hop": ["Hip Hop", "Pop", "RnB", "Electronic"],
  RnB: ["RnB", "Hip Hop", "Pop", "Electronic", "Jazz"],
  Jazz: ["Jazz", "RnB", "Classical", "Lounge", "World"],
  Classical: ["Classical", "Jazz", "Ambient", "World"],
  World: ["World", "Lounge", "Jazz", "Electronic"],
  Lounge: ["Lounge", "Electronic", "Jazz", "Ambient", "World"],
  Ambient: ["Ambient", "Electronic", "Lounge", "Classical"]
};

// Calculate compatibility score between two tracks
export function calculateCompatibilityScore(track1: Track, track2: Track): number {
  let score = 0;
  
  // Mood compatibility (40% weight)
  if (track1.mood && track2.mood) {
    score += (MOOD_COMPATIBILITY[track1.mood]?.[track2.mood] || 0.3) * 0.4;
  } else {
    // Default compatibility if mood is not specified
    score += 0.3;
  }
  
  // Tempo compatibility (30% weight)
  if (track1.tempo && track2.tempo) {
    // Tempo difference as percentage of the max tempo
    const maxTempo = Math.max(track1.tempo, track2.tempo);
    const tempoDiff = Math.abs(track1.tempo - track2.tempo);
    const tempoCompatibility = 1 - (tempoDiff / maxTempo);
    score += tempoCompatibility * 0.3;
  } else {
    // Default tempo compatibility if not specified
    score += 0.3;
  }
  
  // Genre compatibility (30% weight)
  if (track1.genre && track2.genre) {
    const compatibleGenres = GENRE_COMPATIBILITY[track1.genre] || [];
    if (compatibleGenres.includes(track2.genre)) {
      score += 0.3;
    } else {
      score += 0.1; // Lower score for incompatible genres
    }
  } else {
    // Default genre compatibility if not specified
    score += 0.2;
  }
  
  return score;
}

// Generate automatic AI playlist based on target mood and tracks library
export function generateAIPlaylist(
  tracks: Track[], 
  targetMood: string | null = null, 
  targetGenre: string | null = null, 
  duration: number = 3600 // Default 1 hour in seconds
): Track[] {
  if (!tracks.length) return [];
  
  // Filter tracks if mood or genre specified
  let availableTracks = [...tracks];
  
  if (targetMood) {
    availableTracks = availableTracks.filter(track => 
      track.mood === targetMood || 
      (track.mood && MOOD_COMPATIBILITY[targetMood]?.[track.mood] > 0.6)
    );
  }
  
  if (targetGenre) {
    const compatibleGenres = [targetGenre, ...(GENRE_COMPATIBILITY[targetGenre] || [])];
    availableTracks = availableTracks.filter(track => 
      compatibleGenres.includes(track.genre || '')
    );
  }
  
  // Fall back to all tracks if filters resulted in empty set
  if (availableTracks.length === 0) {
    availableTracks = [...tracks];
  }
  
  // Start with a random seed track from the available pool
  const playlist: Track[] = [availableTracks[Math.floor(Math.random() * availableTracks.length)]];
  let totalDuration = playlist[0].duration;
  
  // Prevent selecting the same track multiple times
  const usedTrackIds = new Set<number>([playlist[0].id]);
  
  // Build playlist until we reach target duration
  while (totalDuration < duration && availableTracks.length > usedTrackIds.size) {
    const lastTrack = playlist[playlist.length - 1];
    
    // Calculate compatibility scores for all remaining tracks
    const candidateTracks = availableTracks.filter(track => !usedTrackIds.has(track.id));
    
    if (candidateTracks.length === 0) break;
    
    // Score each candidate track for compatibility with the last track
    const scoredTracks = candidateTracks.map(track => ({
      track,
      score: calculateCompatibilityScore(lastTrack, track)
    }));
    
    // Sort by compatibility score (highest first)
    scoredTracks.sort((a, b) => b.score - a.score);
    
    // Add some randomness - select from top 25% of compatible tracks
    const topCount = Math.max(1, Math.floor(scoredTracks.length * 0.25));
    const randomIndex = Math.floor(Math.random() * topCount);
    const nextTrack = scoredTracks[randomIndex].track;
    
    // Add track to playlist
    playlist.push(nextTrack);
    usedTrackIds.add(nextTrack.id);
    totalDuration += nextTrack.duration;
  }
  
  return playlist;
}

// Find optimal pause/break points for moderator messages
export function findOptimalBreakPoints(playlist: Track[], messageCount: number = 3): number[] {
  if (!playlist.length || messageCount <= 0) return [];
  
  // Calculate total playlist duration
  const totalDuration = playlist.reduce((sum, track) => sum + track.duration, 0);
  
  // Aim for evenly spaced breaks
  const targetInterval = totalDuration / (messageCount + 1);
  
  const breakPoints: number[] = [];
  let currentDuration = 0;
  let breakIndex = 0;
  
  // For each target break point time
  for (let i = 1; i <= messageCount; i++) {
    const targetTime = targetInterval * i;
    
    // Find the track that contains this break point
    while (
      breakIndex < playlist.length - 1 && 
      currentDuration + playlist[breakIndex].duration < targetTime
    ) {
      currentDuration += playlist[breakIndex].duration;
      breakIndex++;
    }
    
    // Add this index to our break points
    breakPoints.push(breakIndex);
  }
  
  return [...new Set(breakPoints)]; // Remove duplicates
}

// Automatic tracklist analyzer - provides insight into playlist characteristics
export function analyzePlaylist(playlist: Track[]): {
  averageTempo: number;
  dominantMood: string;
  dominantGenre: string;
  energyProfile: string;
  duration: number;
} {
  if (!playlist.length) {
    return {
      averageTempo: 0,
      dominantMood: "unknown",
      dominantGenre: "unknown",
      energyProfile: "balanced",
      duration: 0
    };
  }
  
  // Calculate average tempo
  let tempoSum = 0;
  let tempoCount = 0;
  let duration = 0;
  
  // Count moods and genres
  const moodCounts: Record<string, number> = {};
  const genreCounts: Record<string, number> = {};
  
  // Energy profile mapping
  const energyMap: Record<string, number> = {
    upbeat: 1,
    energetic: 1,
    happy: 0.8,
    chill: 0.4,
    relaxed: 0.3,
    romantic: 0.5,
    melancholic: 0.2
  };
  
  let totalEnergy = 0;
  
  playlist.forEach(track => {
    // Calculate duration
    duration += track.duration;
    
    // Track tempo
    if (track.tempo) {
      tempoSum += track.tempo;
      tempoCount++;
    }
    
    // Count mood occurrences
    if (track.mood) {
      moodCounts[track.mood] = (moodCounts[track.mood] || 0) + 1;
      totalEnergy += energyMap[track.mood] || 0.5;
    }
    
    // Count genre occurrences
    if (track.genre) {
      genreCounts[track.genre] = (genreCounts[track.genre] || 0) + 1;
    }
  });
  
  // Find dominant mood and genre
  let dominantMood = "balanced";
  let maxMoodCount = 0;
  
  for (const mood in moodCounts) {
    if (moodCounts[mood] > maxMoodCount) {
      maxMoodCount = moodCounts[mood];
      dominantMood = mood;
    }
  }
  
  let dominantGenre = "mixed";
  let maxGenreCount = 0;
  
  for (const genre in genreCounts) {
    if (genreCounts[genre] > maxGenreCount) {
      maxGenreCount = genreCounts[genre];
      dominantGenre = genre;
    }
  }
  
  // Calculate average energy
  const avgEnergy = totalEnergy / playlist.length;
  
  // Classify energy profile
  let energyProfile = "balanced";
  if (avgEnergy > 0.8) energyProfile = "high-energy";
  else if (avgEnergy > 0.6) energyProfile = "energetic";
  else if (avgEnergy > 0.4) energyProfile = "moderate";
  else if (avgEnergy > 0.2) energyProfile = "relaxed";
  else energyProfile = "low-energy";
  
  return {
    averageTempo: tempoCount > 0 ? Math.round(tempoSum / tempoCount) : 0,
    dominantMood,
    dominantGenre,
    energyProfile,
    duration
  };
}
