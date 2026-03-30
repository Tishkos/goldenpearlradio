import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const prisma = new PrismaClient();

async function fixTrackUrls() {
  try {
    const tracks = await prisma.track.findMany();
    
    console.log(`\nFound ${tracks.length} tracks to check\n`);
    
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const files = fs.readdirSync(uploadsDir);
    
    console.log(`Found ${files.length} files in uploads directory:\n`);
    files.forEach(file => {
      console.log(`  - ${file}`);
    });
    
    let fixed = 0;
    
    for (const track of tracks) {
      console.log(`\nChecking track: ${track.title} by ${track.artist}`);
      console.log(`  Current URL: ${track.url}`);
      console.log(`  Duration: ${track.duration}s`);
      
      // Check if URL points to a file that exists
      if (track.url) {
        const urlPath = track.url.split('/').pop()?.split('?')[0];
        const fileExists = files.some(f => f.includes(urlPath || '') || urlPath?.includes(f));
        
        if (!fileExists && files.length > 0) {
          // Try to find a matching file by checking if any file might be this track
          // This is a simple heuristic - in production you'd have better tracking
          console.log(`  ⚠️  File not found for URL: ${track.url}`);
        } else if (fileExists) {
          console.log(`  ✅ File exists`);
        }
      }
      
      // If duration is 0, try to calculate it
      if (track.duration === 0 && track.url) {
        console.log(`  ⚠️  Duration is 0, needs recalculation`);
        // Note: Duration recalculation would need audio file processing
        // For now, we'll just note it
      }
    }
    
    console.log(`\n✅ Check complete. ${fixed} tracks fixed.\n`);
    
  } catch (error) {
    console.error('❌ Error fixing track URLs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixTrackUrls();

