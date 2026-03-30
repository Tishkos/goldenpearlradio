import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../lib/prisma';

// Get audio file duration using ffprobe
export async function getAudioFileDuration(audioUrl: string | null): Promise<number | null> {
  if (!audioUrl) return null;
  
  try {
    // Convert URL to local file path (resolveAudioFilePath is defined later in the file)
    const filePath = resolveAudioFilePath(audioUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    
    // Try to use ffprobe to get duration
    const ffmpegPath = resolveFfmpegPath();
    if (!ffmpegPath) return null;
    
    // ffprobe is usually in the same directory as ffmpeg
    let ffprobePath = ffmpegPath.replace('ffmpeg.exe', 'ffprobe.exe').replace('ffmpeg', 'ffprobe');
    
    // If replacement didn't work, try to find ffprobe in the same directory
    if (ffprobePath === ffmpegPath && ffmpegPath.includes('ffmpeg')) {
      const dir = path.dirname(ffmpegPath);
      const ffprobeExe = path.join(dir, 'ffprobe.exe');
      if (fs.existsSync(ffprobeExe)) {
        ffprobePath = ffprobeExe;
      } else {
        // Try just 'ffprobe' on PATH
        ffprobePath = 'ffprobe';
      }
    }
    
    return new Promise((resolve) => {
      const ffprobe = spawn(ffprobePath, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ]);
      
      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffprobe.stderr.on('data', () => {
        // Ignore stderr for duration queries
      });
      
      ffprobe.on('close', (code) => {
        if (code === 0 && output.trim()) {
          const duration = parseFloat(output.trim());
          if (!isNaN(duration) && duration > 0) {
            resolve(Math.floor(duration));
            return;
          }
        }
        resolve(null);
      });
      
      ffprobe.on('error', () => {
        resolve(null);
      });
    });
  } catch (error) {
    console.error('Error getting audio duration:', error);
    return null;
  }
}

// --- FFmpeg resolution (Windows-friendly) ---
function resolveFfmpegPath(): string | null {
  // 1) Explicit env var
  const envPath = process.env.FFMPEG_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  // 2) Available on PATH?
  try {
    const test = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    if (test.status === 0) return 'ffmpeg';
  } catch {
    // ignore
  }

  // 3) Common WinGet install location (does not require PATH refresh)
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const wingetPackagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
      try {
        if (fs.existsSync(wingetPackagesDir)) {
          const dirs = fs.readdirSync(wingetPackagesDir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && d.name.toLowerCase().startsWith('gyan.ffmpeg_'))
            .map((d) => path.join(wingetPackagesDir, d.name));

          for (const base of dirs) {
            // Search a few levels deep for bin/ffmpeg.exe
            const stack: { p: string; depth: number }[] = [{ p: base, depth: 0 }];
            while (stack.length) {
              const { p, depth } = stack.pop()!;
              if (depth > 4) continue;
              const candidate = path.join(p, 'bin', 'ffmpeg.exe');
              if (fs.existsSync(candidate)) return candidate;
              try {
                const children = fs.readdirSync(p, { withFileTypes: true });
                for (const c of children) {
                  if (c.isDirectory()) {
                    stack.push({ p: path.join(p, c.name), depth: depth + 1 });
                  }
                }
              } catch {
                // ignore unreadable dirs
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

const uploadsDir = path.join(process.cwd(), 'uploads');
const processedDir = path.join(process.cwd(), 'uploads', 'processed');

// Ensure processed directory exists
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

interface OverlayItem {
  audioUrl: string;
  startTime: number; // Start time in seconds relative to base track
  duration: number;
  volume: number; // 0-100
  duckingVolume?: number; // Volume to duck parent to (0-100)
}

interface AudioProcessingOptions {
  baseAudioUrl: string;
  fadeInDuration: number; // seconds
  fadeOutDuration: number; // seconds
  playbackStartTime?: number; // milliseconds
  playbackEndTime?: number; // milliseconds
  volume: number; // 0-100
  overlayItems?: OverlayItem[];
}

/**
 * Get overlay items for a show item and enrich with audio URLs
 */
async function getOverlayItemsForShowItem(itemId: number, hostId: number | null): Promise<OverlayItem[]> {
  // Get overlay items (items with parentItemId = itemId)
  const overlayItems = await prisma.showItem.findMany({
    where: {
      parentItemId: itemId,
    },
    orderBy: { startTimeInParent: 'asc' },
  });

  const enrichedOverlays: OverlayItem[] = [];

  for (const overlay of overlayItems) {
    let audioUrl: string | null = null;
    let duration = 30;

    // Get audio URL based on content type
    switch (overlay.contentType) {
      case 'TALK':
        const talk = await prisma.talk.findUnique({
          where: { id: overlay.contentId },
          select: { audioUrl: true, duration: true },
        });
        audioUrl = talk?.audioUrl || null;
        duration = talk?.duration || 30;
        break;

      case 'ADVERTISEMENT':
        // Check if it's a product with audio
        const product = await prisma.product.findUnique({
          where: { id: overlay.contentId },
          select: { audioUrl: true, duration: true },
        });
        if (product?.audioUrl) {
          audioUrl = product.audioUrl;
          duration = product.duration || 30;
        } else if (hostId) {
          // Check for host audio
          const adAudio = await prisma.advertisementHostAudio.findFirst({
            where: {
              advertisementId: overlay.contentId,
              hostId: hostId,
            },
            select: { audioUrl: true, duration: true },
          });
          audioUrl = adAudio?.audioUrl || null;
          duration = adAudio?.duration || 30;
        }
        break;

      case 'HOST_COMMENTARY':
        const hc = await prisma.hostCommentary.findUnique({
          where: { id: overlay.contentId },
          select: { audioUrl: true, duration: true },
        });
        audioUrl = hc?.audioUrl || null;
        duration = hc?.duration || 30;
        break;

      case 'NEWS':
        if (hostId) {
          const newsAudio = await prisma.newsHostAudio.findFirst({
            where: {
              newsId: overlay.contentId,
              hostId: hostId,
            },
            select: { audioUrl: true, duration: true },
          });
          audioUrl = newsAudio?.audioUrl || null;
          duration = newsAudio?.duration || 30;
        }
        break;
    }

    if (audioUrl) {
      enrichedOverlays.push({
        audioUrl,
        startTime: (overlay.startTimeInParent || 0),
        duration: duration,
        volume: overlay.volume || 100,
        duckingVolume: overlay.duckingVolume !== undefined && overlay.duckingVolume !== null ? overlay.duckingVolume : undefined,
      });
    }
  }

  return enrichedOverlays;
}

/**
 * Process audio with fades, trimming, and overlay mixing
 * Returns the URL to the processed audio file
 */
export async function processShowItemAudio(
  itemId: number,
  options: AudioProcessingOptions
): Promise<string> {
  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) {
    throw new Error('FFmpeg not found. Cannot process audio.');
  }

  // Generate output filename
  const outputFilename = `processed_item_${itemId}_${Date.now()}.mp3`;
  const outputPath = path.join(processedDir, outputFilename);
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const outputUrl = `${baseUrl}/api/uploads/processed/${outputFilename}`;

  // Resolve base audio file path
  const baseAudioPath = resolveAudioFilePath(options.baseAudioUrl);
  if (!fs.existsSync(baseAudioPath)) {
    throw new Error(`Base audio file not found: ${baseAudioPath}`);
  }

  // Build FFmpeg command
  const ffmpegArgs: string[] = [
    '-i', baseAudioPath, // Base audio input
  ];

  // Calculate trim times (playbackStartTime and playbackEndTime are in milliseconds)
  const startTrim = (options.playbackStartTime || 0) / 1000; // Convert to seconds
  const endTrim = options.playbackEndTime ? (options.playbackEndTime / 1000) : undefined;

  // Build filter complex for audio processing
  const filters: string[] = [];

  // Start with base audio
  let currentStream = '[0:a]';

  // Apply trim if needed
  if (startTrim > 0 || endTrim) {
    const trimFilter = endTrim 
      ? `atrim=${startTrim}:${endTrim}`
      : `atrim=${startTrim}`;
    filters.push(`${currentStream}${trimFilter}[base]`);
    currentStream = '[base]';
  }

  // First apply base volume
  const baseVolume = (options.volume / 100).toFixed(3);
  filters.push(`${currentStream}volume=${baseVolume}[vol_base]`);
  currentStream = '[vol_base]';

  // Process overlay items
  if (options.overlayItems && options.overlayItems.length > 0) {
    const overlayInputs: string[] = [];
    const overlayFilters: string[] = [];
    let inputIndex = 1;
    const duckingPeriods: Array<{ start: number; end: number; volume: number }> = [];

    // Add overlay audio inputs and create filters
    for (let i = 0; i < options.overlayItems.length; i++) {
      const overlay = options.overlayItems[i];
      const overlayPath = resolveAudioFilePath(overlay.audioUrl);
      
      if (!fs.existsSync(overlayPath)) {
        console.warn(`Overlay audio file not found: ${overlayPath}, skipping...`);
        continue;
      }

      // Track ducking periods
      // duckingVolume is 0-100, representing what % of original volume to duck to
      // e.g., duckingVolume=20 means duck to 20% of original volume
      const duckingVolume = overlay.duckingVolume !== null && overlay.duckingVolume !== undefined 
        ? overlay.duckingVolume 
        : 50; // Default 50%
      // Calculate ducked volume: (base volume / 100) * (duckingVolume / 100)
      // e.g., if base volume is 80% and duckingVolume is 20%, ducked = 0.8 * 0.2 = 0.16 (16%)
      const duckedVolumeValue = (options.volume / 100) * (duckingVolume / 100);
      
      duckingPeriods.push({
        start: overlay.startTime,
        end: overlay.startTime + overlay.duration,
        volume: duckedVolumeValue
      });

      // Add input for overlay
      ffmpegArgs.push('-i', overlayPath);
      
      // Create overlay filter: ensure exact duration, delay, apply volume
      // Important: We need to ensure the overlay plays for its FULL duration
      const overlayVolume = (overlay.volume / 100).toFixed(3);
      const delayMs = Math.floor(overlay.startTime * 1000);
      
      // Strategy to ensure full overlay plays:
      // 1. First, trim or pad the overlay to exactly overlay.duration
      //    - If audio is longer than overlay.duration, trim it
      //    - If audio is shorter, pad it with silence
      // 2. Delay it by overlay.startTime (adds silence at the beginning)
      // 3. Apply volume
      // Note: We use atrim first to ensure exact duration, then apad to pad if needed
      // Actually, apad with whole_dur will pad to reach the duration, but won't trim if longer
      // So we need to trim first if needed, then pad
      overlayFilters.push(
        `[${inputIndex}:a]atrim=0:${overlay.duration}[trimmed_audio${i}];` +
        `[trimmed_audio${i}]apad=whole_dur=${overlay.duration}[padded${i}];` +
        `[padded${i}]adelay=${delayMs}|${delayMs}[delayed${i}];` +
        `[delayed${i}]volume=${overlayVolume}[overlay${i}]`
      );
      
      overlayInputs.push(`[overlay${i}]`);
      inputIndex++;
    }

    // Apply ducking to base track during overlay periods ONLY
    // Use volume filter with enable expression to duck only during overlay times
    if (duckingPeriods.length > 0) {
      const baseVolumeValue = (options.volume / 100).toFixed(3);
      
      // Build expression to check if we're in any ducking period
      // FFmpeg volume filter with enable: when enable is true, applies the volume change
      // When enable is false, keeps the original volume (which is already set to baseVolumeValue)
      
      // For multiple periods, we need to check if time is in any period
      const periodConditions: string[] = [];
      for (const period of duckingPeriods) {
        periodConditions.push(`between(t,${period.start},${period.end})`);
      }
      const enableExpr = periodConditions.join('+'); // OR condition: true if in any period
      
      // Get the ducked volume (use first period's volume, or average if multiple)
      // For now, use the first period's ducking volume
      const firstPeriod = duckingPeriods[0];
      const duckedVol = firstPeriod.volume.toFixed(3);
      
      // Apply volume filter with enable: only ducks when enable expression is true
      // When enable is false (not in any overlay period), volume stays at baseVolumeValue
      // When enable is true (in overlay period), volume is set to duckedVol
      filters.push(`${currentStream}volume=enable='${enableExpr}':volume=${duckedVol}[ducked_base]`);
      currentStream = '[ducked_base]';
      
      console.log(`Applying dynamic ducking: base volume ${baseVolumeValue}, ducked to ${duckedVol} during ${duckingPeriods.length} overlay period(s)`);
    }
    
    // Mix all overlays together
    if (overlayInputs.length > 0) {
      const mixInputs = overlayInputs.join('');
      // Use duration=longest to ensure all overlays play fully, even if they extend beyond the base track
      overlayFilters.push(`${mixInputs}amix=inputs=${overlayInputs.length}:duration=longest:dropout_transition=0[overlays_mixed]`);
      
      // Now mix ducked base with overlays
      // Use duration=longest to ensure overlays that extend beyond base track are not cut off
      filters.push(...overlayFilters);
      filters.push(`${currentStream}[overlays_mixed]amix=inputs=2:duration=longest:dropout_transition=0[mixed]`);
      currentStream = '[mixed]';
    }
  }

  // Apply fade in/out (apply to final mixed stream)
  // We need to calculate the total duration for fade out
  let totalDuration = 0;
  if (endTrim) {
    totalDuration = endTrim - startTrim;
  } else {
    // Estimate duration from base audio (we'll let FFmpeg determine actual duration)
    // For fade out, we'll use a large number and FFmpeg will clamp it
    totalDuration = 999999; // Large number - FFmpeg will use actual audio length
  }
  
  if (options.fadeInDuration > 0 || options.fadeOutDuration > 0) {
    if (options.fadeInDuration > 0 && options.fadeOutDuration > 0) {
      // Both fades
      const fadeOutStart = Math.max(0, totalDuration - options.fadeOutDuration);
      filters.push(`${currentStream}afade=t=in:st=0:d=${options.fadeInDuration},afade=t=out:st=${fadeOutStart}:d=${options.fadeOutDuration}[faded]`);
      currentStream = '[faded]';
    } else if (options.fadeInDuration > 0) {
      // Only fade in
      filters.push(`${currentStream}afade=t=in:st=0:d=${options.fadeInDuration}[fadein]`);
      currentStream = '[fadein]';
    } else if (options.fadeOutDuration > 0) {
      // Only fade out
      const fadeOutStart = Math.max(0, totalDuration - options.fadeOutDuration);
      filters.push(`${currentStream}afade=t=out:st=${fadeOutStart}:d=${options.fadeOutDuration}[faded]`);
      currentStream = '[faded]';
    }
  }

  // Final output stream
  const outputStream = currentStream;

  // Add filter complex
  if (filters.length > 0) {
    ffmpegArgs.push('-filter_complex', filters.join(';'));
    ffmpegArgs.push('-map', outputStream);
  } else {
    // No filters - just map input
    ffmpegArgs.push('-map', '0:a');
  }

  // Output settings
  ffmpegArgs.push(
    '-c:a', 'libmp3lame',
    '-b:a', '192k',
    '-y', // Overwrite output file
    outputPath
  );

  const filterComplexStr = filters.length > 0 ? filters.join(';') : '';
  console.log('🎵 Processing audio with FFmpeg:', {
    itemId,
    baseAudio: baseAudioPath,
    outputPath,
    filters: filters.length,
    overlays: options.overlayItems?.length || 0,
    fadeIn: `${options.fadeInDuration}s`,
    fadeOut: `${options.fadeOutDuration}s`,
    volume: `${options.volume}%`,
    duckingPeriods: options.overlayItems?.map(o => ({ 
      start: `${o.startTime}s`, 
      end: `${o.startTime + o.duration}s`, 
      ducking: `${o.duckingVolume || 50}%` 
    })) || [],
    filterComplex: filterComplexStr.substring(0, 500) // Log first 500 chars
  });

  // Execute FFmpeg
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ffmpegArgs);

    let stderr = '';

    ffmpeg.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(`✅ Audio processed successfully: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          resolve(outputUrl);
        } else {
          reject(new Error('FFmpeg completed but output file not found'));
        }
      } else {
        console.error('❌ FFmpeg error output:', stderr);
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr.substring(0, 500)}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg spawn error: ${error.message}`));
    });
  });
}

/**
 * Resolve audio URL to file path
 */
function resolveAudioFilePath(audioUrl: string): string {
  // Handle different URL formats
  let filename = audioUrl;
  
  // Extract filename from URL
  if (audioUrl.includes('/api/uploads/')) {
    filename = audioUrl.split('/api/uploads/')[1];
  } else if (audioUrl.includes('/uploads/')) {
    filename = audioUrl.split('/uploads/')[1];
  } else if (audioUrl.startsWith('http')) {
    // Extract filename from full URL
    const urlParts = new URL(audioUrl);
    filename = urlParts.pathname.split('/').pop() || '';
  }

  // Decode URL encoding
  filename = decodeURIComponent(filename);
  
  // Check in uploads directory
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) {
    return filePath;
  }

  // Check in processed directory
  const processedPath = path.join(processedDir, filename);
  if (fs.existsSync(processedPath)) {
    return processedPath;
  }

  // Return the path anyway (will fail later if not found)
  return filePath;
}

/**
 * Clean up old processed audio files (older than 24 hours)
 */
export function cleanupOldProcessedAudio(): void {
  try {
    const files = fs.readdirSync(processedDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const file of files) {
      const filePath = path.join(processedDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old processed audio: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up processed audio:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupOldProcessedAudio, 60 * 60 * 1000);

/**
 * Process audio for a show item with all its overlays
 * This is the main entry point for processing show item audio
 */
export async function processShowItemAudioWithOverlays(
  itemId: number,
  baseAudioUrl: string,
  showId: number,
  hostId: number | null,
  volume: number,
  fadeInDuration: number,
  fadeOutDuration: number,
  playbackStartTime?: number,
  playbackEndTime?: number
): Promise<string> {
  // Get overlay items
  const overlayItems = await getOverlayItemsForShowItem(itemId, hostId);

  // Process audio
  return processShowItemAudio(itemId, {
    baseAudioUrl,
    fadeInDuration,
    fadeOutDuration,
    playbackStartTime,
    playbackEndTime,
    volume,
    overlayItems,
  });
}
