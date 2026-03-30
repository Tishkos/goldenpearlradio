import express, { Request, Response } from 'express';
import { prisma } from '../../../lib/prisma';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Track last logged item to avoid duplicate play logs when same track is current across polls
let lastLoggedShowItemId: number | null = null;

// Simple stream endpoint - returns current song based on timeline schedule
router.get('/current', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    // The radio schedule is tied to a station timezone. If the server runs in UTC (or any other TZ),
    // using Date#getHours() will drift from what the editor and listeners expect.
    // Default to the server's local timezone, configurable via env.
    const stationTimeZone =
      process.env.STREAM_TIMEZONE || 'Europe/Budapest';

    const getPartsInTimeZone = (date: Date, timeZone: string) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(date);
      const map: Record<string, string> = {};
      for (const p of parts) {
        if (p.type !== 'literal') map[p.type] = p.value;
      }
      return {
        year: map.year,
        month: map.month,
        day: map.day,
        hour: Number(map.hour),
        minute: Number(map.minute),
        second: Number(map.second),
      };
    };

    const parts = getPartsInTimeZone(now, stationTimeZone);
    const todayDateKey = `${parts.year}-${parts.month}-${parts.day}`;

    // Calculate current time of day in seconds since midnight (station timezone)
    const currentTimeOfDay = (parts.hour * 3600) + (parts.minute * 60) + parts.second;
    const formatHms = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    
    // Get default show
    const defaultShow = await prisma.show.findFirst({
      where: { 
        isActive: true,
        title: 'Golden Pearl Radio Timeline'
      },
    });

    // Load today's timeline items (if we have a default show)
    let todayItems: any[] = [];
    if (defaultShow) {
      todayItems = await prisma.showItem.findMany({
        where: {
          showId: defaultShow.id,
          date: todayDateKey,
        },
        orderBy: { position: 'asc' },
      });
    }

    if (!defaultShow || todayItems.length === 0) {
      return res.json({
        playing: false,
        message: defaultShow ? 'No items scheduled for today' : 'No timeline configured',
        currentTime: currentTimeOfDay,
        debug: {
          stationTimeZone,
          dateKey: todayDateKey,
          currentTimeHms: formatHms(currentTimeOfDay),
          totalTimelineItems: todayItems.length,
          playableItems: 0,
          resolutionSource: 'stream-server',
        },
      });
    }

    // Enrich items with content data and calculate times
    const enrichedItems = await Promise.all(todayItems.map(async (item) => {
      let content: any = null;
      let audioUrl: string | null = null;
      
      switch (item.contentType) {
        case 'TRACK':
          const track = await prisma.track.findUnique({
            where: { id: item.contentId },
            select: { title: true, url: true, duration: true }
          });
          
          // Check if this track has overlay items (items with parentItemId = this item.id)
          const hasOverlays = todayItems.some(otherItem => otherItem.parentItemId === item.id);
          
          // Check for processed audio
          let processedUrl: string | null = null;
          if (track?.url) {
            try {
              const processedDir = path.join(process.cwd(), 'uploads', 'processed');
              if (fs.existsSync(processedDir)) {
                const files = fs.readdirSync(processedDir);
                const itemFiles = files.filter((f: string) => f.startsWith(`processed_item_${item.id}_`) && f.endsWith('.mp3'));
                
                if (itemFiles.length > 0) {
                  // Sort by timestamp (newest first)
                  itemFiles.sort((a: string, b: string) => {
                    const timestampA = parseInt(a.match(/_(\d+)\.mp3$/)?.[1] || '0');
                    const timestampB = parseInt(b.match(/_(\d+)\.mp3$/)?.[1] || '0');
                    return timestampB - timestampA;
                  });
                  
                  const latestFile = itemFiles[0];
                  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
                  processedUrl = `${baseUrl}/api/uploads/processed/${latestFile}`;
                }
              }
            } catch (error) {
              console.error(`Error checking for processed audio for item ${item.id}:`, error);
            }
          }
          
          // If track has overlays, MUST use processed audio
          if (hasOverlays && processedUrl) {
            console.log(`[Stream /current] Track "${track?.title}" (id: ${item.id}) has overlays - using processed audio: ${processedUrl}`);
            content = { title: track?.title, audioUrl: processedUrl, duration: track?.duration };
          } else if (hasOverlays && !processedUrl) {
            console.warn(`[Stream /current] ⚠️ Track "${track?.title}" (id: ${item.id}) has overlays but no processed audio found! Using original audio.`);
            content = { title: track?.title, audioUrl: track?.url, duration: track?.duration };
          } else {
            // No overlays - use processed if available, otherwise original
            content = { title: track?.title, audioUrl: processedUrl || track?.url, duration: track?.duration };
          }
          break;
        case 'TALK':
          const talk = await prisma.talk.findUnique({
            where: { id: item.contentId },
            select: { title: true, audioUrl: true, duration: true }
          });
          content = { title: talk?.title, audioUrl: talk?.audioUrl, duration: talk?.duration };
          break;
        case 'HOST_COMMENTARY':
          const hc = await prisma.hostCommentary.findUnique({
            where: { id: item.contentId },
            select: { title: true, audioUrl: true, duration: true }
          });
          content = { title: hc?.title, audioUrl: hc?.audioUrl, duration: hc?.duration };
          break;
        case 'ADVERTISEMENT':
          // First check if it's a product with audioUrl
          const product = await prisma.product.findUnique({
            where: { id: item.contentId },
            select: { id: true, name: true, audioUrl: true, duration: true }
          });
          
          if (product && product.audioUrl) {
            // It's a product with audio - use product audio
            content = {
              title: product.name,
              audioUrl: product.audioUrl,
              duration: product.duration || 30,
              isProduct: true,
              productId: product.id,
            };
          } else {
            // It's a regular advertisement - use host audio when available, otherwise fall back to product audio.
            const advertisement = await prisma.advertisement.findUnique({
              where: { id: item.contentId },
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    audioUrl: true,
                    duration: true,
                  },
                },
              },
            });
            const hostId = defaultShow.hostId;
            const adAudio = advertisement && hostId
              ? await prisma.advertisementHostAudio.findFirst({
                  where: {
                    advertisementId: item.contentId,
                    hostId: hostId,
                  },
                  include: {
                    advertisement: {
                      select: { title: true, productId: true }
                    }
                  }
                })
              : null;
            // Get actual duration from audio file if stored duration is missing
            let duration = adAudio?.duration;
            if ((!duration || duration === 0) && adAudio?.audioUrl) {
              const { getAudioFileDuration } = await import('../utils/audioProcessor');
              const actualDuration = await getAudioFileDuration(adAudio.audioUrl);
              if (actualDuration) {
                duration = actualDuration;
                // Update the database with the correct duration for future use
                try {
                  await prisma.advertisementHostAudio.updateMany({
                    where: {
                      advertisementId: item.contentId,
                      hostId: hostId,
                    },
                    data: { duration: actualDuration }
                  });
                  console.log(`[Stream /current] Updated advertisement duration for item ${item.id}: ${actualDuration}s`);
                } catch (err) {
                  console.error('Failed to update advertisement duration:', err);
                }
              }
            }
            
            const linkedProduct = advertisement?.product || null;
            content = {
              title: adAudio?.advertisement.title || advertisement?.title || linkedProduct?.name || 'Advertisement',
              audioUrl: adAudio?.audioUrl || linkedProduct?.audioUrl || null,
              duration: duration || linkedProduct?.duration || null,
              productId: linkedProduct?.id || adAudio?.advertisement.productId || null,
              isProduct: Boolean(linkedProduct),
            };
          }
          break;
        case 'NEWS':
          const newsHostId = defaultShow.hostId;
          const newsAudio = await prisma.newsHostAudio.findFirst({
            where: {
              newsId: item.contentId,
              hostId: newsHostId,
            },
            include: {
              news: {
                select: { title: true }
              }
            }
          });
          content = { title: newsAudio?.news.title, audioUrl: newsAudio?.audioUrl, duration: newsAudio?.duration };
          break;
      }

      if (content && content.audioUrl) {
        audioUrl = content.audioUrl;
      }

      // Calculate start and end times
      const startTime = item.startTimeOffset || 0;
      const playbackStart = (item.playbackStartTime || 0) / 1000; // Convert ms to seconds
      const playbackEnd = item.playbackEndTime ? (item.playbackEndTime / 1000) : (content?.duration || 180);
      let duration = Math.max(1, playbackEnd - playbackStart);
      
      // For product overlays (ADVERTISEMENT with parentItemId), extend display duration beyond audio duration
      // Audio plays for original duration, but overlay stays visible longer (e.g., 16s audio -> 26s display)
      if (item.parentItemId && item.contentType === 'ADVERTISEMENT' && (content as any)?.isProduct) {
        // Add 10 seconds to the display duration (audio duration + 10s)
        // This ensures the product overlay stays visible longer than the audio plays
        const audioDuration = duration;
        duration = audioDuration + 10; // Extend by 10 seconds
      }
      
      const endTime = startTime + duration;

      return {
        id: item.id,
        title: content?.title || 'Untitled',
        audioUrl,
        startTime,
        endTime,
        duration,
        calculatedStartTime: startTime,
        calculatedEndTime: endTime,
        playbackStartTime: item.playbackStartTime || 0, // Store for live sync calculation
        contentType: item.contentType, // Include content type
        contentId: item.contentId, // Include content ID
        productId: (content as any)?.productId || null,
        parentItemId: item.parentItemId || null, // Include parentItemId for overlays
        startTimeInParent: item.startTimeInParent || null, // Include startTimeInParent for overlays
      };
    }));

    // Filter out items without audio URLs
    const validItems = enrichedItems.filter(item => item.audioUrl);
    const aroundNow = validItems
      .filter((item) => item.calculatedEndTime >= currentTimeOfDay - 900 && item.calculatedStartTime <= currentTimeOfDay + 900)
      .map((item) => ({
        id: item.id,
        title: item.title,
        contentType: item.contentType,
        startTime: item.calculatedStartTime,
        endTime: item.calculatedEndTime,
        startTimeHms: formatHms(item.calculatedStartTime),
        endTimeHms: formatHms(item.calculatedEndTime),
      }))
      .slice(0, 15);

    // Find current item
    const currentItem = validItems.find(item => 
      currentTimeOfDay >= item.calculatedStartTime && currentTimeOfDay < item.calculatedEndTime
    );

    if (currentItem) {
      // Log track play when a new TRACK becomes current (for Song of the Week)
      if (currentItem.contentType === 'TRACK' && currentItem.contentId && currentItem.id !== lastLoggedShowItemId) {
        lastLoggedShowItemId = currentItem.id;
        prisma.trackPlay.create({ data: { trackId: currentItem.contentId } }).catch(() => {});
      } else if (currentItem.contentType !== 'TRACK') {
        lastLoggedShowItemId = null; // Reset so next TRACK will be logged
      }

      // Calculate how many seconds into the current item we are (for live sync)
      const secondsIntoItem = currentTimeOfDay - currentItem.calculatedStartTime;
      const timeRemaining = currentItem.calculatedEndTime - currentTimeOfDay;
      
      // Calculate the playback position in the audio file
      // This accounts for playbackStartTime (trimming) - if song starts at 10s in the file, we need to add that
      const playbackStartSeconds = (currentItem.playbackStartTime || 0) / 1000;
      const audioFilePosition = playbackStartSeconds + secondsIntoItem;
      
      // Find active overlays (items with parentItemId that are currently playing)
      const activeOverlays = validItems.filter(item => 
        item.parentItemId === currentItem.id &&
        currentTimeOfDay >= item.calculatedStartTime &&
        currentTimeOfDay < item.calculatedEndTime
      );
      
      // Find next item
      const nextItem = validItems.find(item => item.calculatedStartTime > currentTimeOfDay);

      return res.json({
        playing: true,
        current: {
          id: currentItem.id,
          title: currentItem.title,
          url: currentItem.audioUrl,
          startTime: currentItem.calculatedStartTime,
          endTime: currentItem.calculatedEndTime,
          secondsIntoItem,
          timeRemaining,
          audioFilePosition, // Position in the audio file to start playing from (for live sync)
          contentType: currentItem.contentType, // Include content type
          contentId: currentItem.contentId, // Include content ID
          productId: currentItem.productId,
        },
        overlay: activeOverlays.length > 0 ? {
          id: activeOverlays[0].id,
          title: activeOverlays[0].title,
          contentType: activeOverlays[0].contentType,
          contentId: activeOverlays[0].contentId,
          productId: activeOverlays[0].productId,
        } : null,
        next: nextItem ? {
          id: nextItem.id,
          title: nextItem.title,
          url: nextItem.audioUrl,
          startTime: nextItem.calculatedStartTime,
          productId: nextItem.productId,
        } : null,
        currentTime: currentTimeOfDay,
        debug: {
          stationTimeZone,
          dateKey: todayDateKey,
          currentTimeHms: formatHms(currentTimeOfDay),
          totalTimelineItems: todayItems.length,
          playableItems: validItems.length,
          currentWindowHms: `${formatHms(currentItem.calculatedStartTime)} -> ${formatHms(currentItem.calculatedEndTime)}`,
          nextStartHms: nextItem ? formatHms(nextItem.calculatedStartTime) : null,
          resolutionSource: 'stream-server',
          aroundNow,
        },
      });
    }

    // No current item - find next item
    const nextItem = validItems.find(item => item.calculatedStartTime > currentTimeOfDay);
    
    if (nextItem) {
      const waitTime = nextItem.calculatedStartTime - currentTimeOfDay;
      return res.json({
        playing: false,
        message: `Next song starts in ${Math.floor(waitTime / 60)}:${String(Math.floor(waitTime % 60)).padStart(2, '0')}`,
        next: {
          id: nextItem.id,
          title: nextItem.title,
          url: nextItem.audioUrl,
          startTime: nextItem.calculatedStartTime,
        },
        currentTime: currentTimeOfDay,
        debug: {
          stationTimeZone,
          dateKey: todayDateKey,
          currentTimeHms: formatHms(currentTimeOfDay),
          totalTimelineItems: todayItems.length,
          playableItems: validItems.length,
          nextStartHms: formatHms(nextItem.calculatedStartTime),
          resolutionSource: 'stream-server',
          aroundNow,
        },
      });
    }

    return res.json({
      playing: false,
      message: 'No more items scheduled for today',
      currentTime: currentTimeOfDay,
      debug: {
        stationTimeZone,
        dateKey: todayDateKey,
        currentTimeHms: formatHms(currentTimeOfDay),
        totalTimelineItems: todayItems.length,
        playableItems: validItems.length,
        resolutionSource: 'stream-server',
        aroundNow,
      },
    });

  } catch (error: any) {
    // If the database is down (common in local dev), don't hard-fail the radio endpoint.
    // The client can then show "no broadcast" / keep play locked instead of going into an error loop.
    console.error('Error getting current stream:', error);
    return res.status(200).json({
      playing: false,
      message: 'Radio backend unavailable (database offline).',
      currentTime: (() => {
        const stationTimeZone = process.env.STREAM_TIMEZONE || 'Europe/Budapest';
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: stationTimeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).formatToParts(new Date());
        const map: Record<string, string> = {};
        for (const p of parts) {
          if (p.type !== 'literal') map[p.type] = p.value;
        }
        return (Number(map.hour) * 3600) + (Number(map.minute) * 60) + Number(map.second);
      })(),
      debug: (() => {
        const stationTimeZone = process.env.STREAM_TIMEZONE || 'Europe/Budapest';
        const toHms = (seconds: number) => {
          const h = Math.floor(seconds / 3600);
          const m = Math.floor((seconds % 3600) / 60);
          const s = Math.floor(seconds % 60);
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        };
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: stationTimeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).formatToParts(new Date());
        const map: Record<string, string> = {};
        for (const p of parts) {
          if (p.type !== 'literal') map[p.type] = p.value;
        }
        const currentTime = (Number(map.hour) * 3600) + (Number(map.minute) * 60) + Number(map.second);
        return {
          stationTimeZone,
          dateKey: `${map.year}-${map.month}-${map.day}`,
          currentTimeHms: toHms(currentTime),
          totalTimelineItems: 0,
          playableItems: 0,
          resolutionSource: 'stream-server',
        };
      })(),
    });
  }
});

export default router;
