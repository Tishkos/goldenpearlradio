import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

dotenv.config();

const prisma = new PrismaClient();

// Function to get audio duration using ffprobe (if available) or estimate from file size
async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    // Try ffprobe first (more accurate)
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0 && output.trim()) {
        const duration = parseFloat(output.trim());
        if (!isNaN(duration) && duration > 0) {
          resolve(Math.floor(duration));
          return;
        }
      }
      
      // Fallback: estimate from file size (rough approximation)
      // Average bitrate: 128kbps = 16KB per second for MP3
      try {
        const stats = fs.statSync(filePath);
        const estimatedDuration = Math.floor((stats.size / 1024) / 16);
        resolve(estimatedDuration > 0 ? estimatedDuration : 180); // Default to 3 minutes if can't determine
      } catch {
        resolve(180); // Default fallback
      }
    });

    ffprobe.on('error', () => {
      // ffprobe not available, use file size estimation
      try {
        const stats = fs.statSync(filePath);
        const estimatedDuration = Math.floor((stats.size / 1024) / 16);
        resolve(estimatedDuration > 0 ? estimatedDuration : 180);
      } catch {
        resolve(180);
      }
    });
  });
}

async function recalculateDurations() {
  try {
    // Get all tracks
    const allTracks = await prisma.track.findMany();
    
    console.log(`\nAll tracks in database:\n`);
    allTracks.forEach(t => {
      console.log(`  - ${t.title} by ${t.artist}: duration=${t.duration}s, url=${t.url}`);
    });
    
    const tracks = allTracks.filter(t => !t.duration || t.duration === 0);
    
    console.log(`\nFound ${tracks.length} tracks with missing durations\n`);
    
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    for (const track of tracks) {
      if (!track.url) {
        console.log(`⚠️  Track "${track.title}" has no URL, skipping`);
        continue;
      }
      
      // Extract filename from URL
      const urlParts = track.url.split('/');
      const filename = urlParts[urlParts.length - 1].split('?')[0];
      const filePath = path.join(uploadsDir, filename);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found for "${track.title}": ${filename}`);
        continue;
      }
      
      console.log(`Calculating duration for: ${track.title}...`);
      const duration = await getAudioDuration(filePath);
      
      await prisma.track.update({
        where: { id: track.id },
        data: { duration }
      });
      
      console.log(`  ✅ Updated duration: ${duration}s (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`);
    }
    
    console.log(`\n✅ Duration recalculation complete!\n`);
    
  } catch (error) {
    console.error('❌ Error recalculating durations:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

recalculateDurations();

