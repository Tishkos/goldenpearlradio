import express, { Request, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { prisma } from '../../../lib/prisma';
import { processShowItemAudioWithOverlays } from '../utils/audioProcessor';
import {
  createScheduleItem,
  listScheduleItems,
  softDeleteScheduleItem,
  updateScheduleItem,
} from '../utils/scheduleItems';

const router = express.Router();

// Authentication is optional for public GET routes and required later by requireAdmin
// for mutation routes. Running authenticateToken on every request lets public
// endpoints still know when the caller is an authenticated admin.
router.use((req, res, next) => authenticateToken(req as AuthRequest, res, next));

// ========== TRACKS ==========
router.get('/tracks', async (req: Request, res: Response) => {
  try {
    const tracks = await prisma.track.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(tracks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tracks/:id', async (req: Request, res: Response) => {
  try {
    const track = await prisma.track.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    res.json(track);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tracks', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const track = await prisma.track.create({
      data: req.body
    });
    res.status(201).json(track);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/tracks/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const track = await prisma.track.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(track);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tracks/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.track.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Track deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== SHOWS ==========
router.get('/shows', async (req: Request, res: Response) => {
  try {
    const shows = await prisma.show.findMany({
      include: {
        host: true,
        showItems: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(shows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/shows/:id', async (req: Request, res: Response) => {
  try {
    const show = await prisma.show.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        host: true,
        showItems: true,
      }
    });
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }
    res.json(show);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/shows', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const show = await prisma.show.create({
      data: req.body,
      include: {
        host: true,
        showItems: true,
      }
    });
    res.status(201).json(show);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/shows/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const show = await prisma.show.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
      include: {
        host: true,
        showItems: true,
      }
    });
    res.json(show);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/shows/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.show.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Show deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== SHOW ITEMS ==========
router.get('/show-items', async (req: Request, res: Response) => {
  try {
    const { showId } = req.query;
    const where: any = {};
    if (showId) where.showId = parseInt(showId as string);

    const items = await prisma.showItem.findMany({
      where,
      orderBy: { position: 'asc' },
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/show-items', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.showItem.create({
      data: {
        ...req.body,
        // Ensure overlay fields are included
        parentItemId: req.body.parentItemId || null,
        startTimeInParent: req.body.startTimeInParent || null,
        duckingVolume: req.body.duckingVolume !== undefined && req.body.duckingVolume !== null ? req.body.duckingVolume : null,
      },
    });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/show-items/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Get the item first to check if it has audio
    const existingItem = await prisma.showItem.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        show: {
          include: { host: true }
        }
      }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Show item not found' });
    }

    // Update the item
    const item = await prisma.showItem.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });

    // Process audio if this is a track item with audio
    if (item.contentType === 'TRACK') {
      try {
        const track = await prisma.track.findUnique({
          where: { id: item.contentId },
          select: { url: true }
        });

        if (track?.url) {
          const hostId = existingItem.show?.hostId || null;
          const processedUrl = await processShowItemAudioWithOverlays(
            item.id,
            track.url,
            item.showId,
            hostId,
            item.volume || 100,
            item.fadeInDuration || 0,
            item.fadeOutDuration || 0,
            item.playbackStartTime || undefined,
            item.playbackEndTime || undefined
          );

          console.log(`Processed audio for item ${item.id}: ${processedUrl}`);
        }
      } catch (audioError: any) {
        console.error(`Failed to process audio for item ${item.id}:`, audioError);
        // Don't fail the update if audio processing fails
      }
    }

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/show-items/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.showItem.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Show item deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== TIMELINE ITEMS (Date-based, no show required) ==========
// Get timeline items for a specific date
router.get('/timeline-items', async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string | undefined;
    
    // Get or create a default show for the radio station
    let defaultShow = await prisma.show.findFirst({
      where: { 
        isActive: true,
        title: 'Golden Pearl Radio Timeline'
      },
    });

    if (!defaultShow) {
      // Create default show if it doesn't exist
      const firstHost = await prisma.host.findFirst({ where: { isActive: true } });
      if (!firstHost) {
        // Create a dummy host if none exists
        const dummyHost = await prisma.host.create({
          data: {
            name: 'Radio Station',
            isActive: true,
          },
        });
        defaultShow = await prisma.show.create({
          data: {
            title: 'Golden Pearl Radio Timeline',
            description: 'Main radio timeline',
            hostId: dummyHost.id,
            isActive: true,
          },
        });
      } else {
        defaultShow = await prisma.show.create({
          data: {
            title: 'Golden Pearl Radio Timeline',
            description: 'Main radio timeline',
            hostId: firstHost.id,
            isActive: true,
          },
        });
      }
    }

    // Filter by date if provided - each date has its own independent timeline
    const whereClause: any = { showId: defaultShow.id };
    if (date) {
      whereClause.date = date;
      
      // Check if this date is published (for public access)
      // Public users can only see published timelines
      const isPublished = await prisma.publishedTimeline.findUnique({
        where: { date }
      });
      
      // Check if user is authenticated and admin (req.user is set by auth middleware if authenticated)
      const isAdmin = (req as any).user?.isAdmin || false;
      
      // For non-admin users, only return items if published
      if (!isPublished && !isAdmin) {
        return res.json([]); // Return empty array for unpublished dates
      }
    } else {
      // If no date is provided, return items without a date (legacy items)
      whereClause.date = null;
    }

    const items = await prisma.showItem.findMany({
      where: whereClause,
      orderBy: { position: 'asc' },
    });
    
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create timeline item
router.post('/timeline-items', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Get default show
    let defaultShow = await prisma.show.findFirst({
      where: { 
        isActive: true,
        title: 'Golden Pearl Radio Timeline'
      },
    });

    if (!defaultShow) {
      const firstHost = await prisma.host.findFirst({ where: { isActive: true } });
      if (!firstHost) {
        // Create a dummy host if none exists
        const dummyHost = await prisma.host.create({
          data: {
            name: 'Radio Station',
            isActive: true,
          },
        });
        defaultShow = await prisma.show.create({
          data: {
            title: 'Golden Pearl Radio Timeline',
            description: 'Main radio timeline',
            hostId: dummyHost.id,
            isActive: true,
          },
        });
      } else {
        defaultShow = await prisma.show.create({
          data: {
            title: 'Golden Pearl Radio Timeline',
            description: 'Main radio timeline',
            hostId: firstHost.id,
            isActive: true,
          },
        });
      }
    }

    const { date, ...itemData } = req.body;
    
    // DATE IS REQUIRED - Each day must have its own independent schedule
    if (!date) {
      return res.status(400).json({ error: 'date is required. Each day must have its own independent schedule (format: YYYY-MM-DD)' });
    }
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Must be YYYY-MM-DD (e.g., 2026-01-29)' });
    }
    
    // Ensure required fields are present
    if (!itemData.contentType) {
      return res.status(400).json({ error: 'contentType is required' });
    }
    if (!itemData.contentId) {
      return res.status(400).json({ error: 'contentId is required' });
    }
    if (itemData.position === undefined) {
      // Calculate next position if not provided - only count items for the same date
      const existingItems = await prisma.showItem.findMany({
        where: { 
          showId: defaultShow.id,
          date: date // Only count items for this specific date
        },
        orderBy: { position: 'desc' },
        take: 1,
      });
      itemData.position = existingItems.length > 0 ? existingItems[0].position + 1 : 0;
    }

    const item = await prisma.showItem.create({
      data: {
        ...itemData,
        showId: defaultShow.id,
        date: date, // Date is required - each day has its own schedule
        startTimeOffset: itemData.startTimeOffset || 0,
        volume: itemData.volume || 100,
        fadeInDuration: itemData.fadeInDuration || 0,
        fadeOutDuration: itemData.fadeOutDuration || 0,
        playbackStartTime: itemData.playbackStartTime || 0,
        mixMode: itemData.mixMode || 'sequential',
        // Overlay fields
        parentItemId: itemData.parentItemId || null,
        startTimeInParent: itemData.startTimeInParent || null,
        duckingVolume: itemData.duckingVolume !== undefined && itemData.duckingVolume !== null ? itemData.duckingVolume : null,
      },
    });
    res.status(201).json(item);
  } catch (error: any) {
    console.error('Error creating timeline item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update timeline item
router.put('/timeline-items/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id, date, ...updates } = req.body;
    
    // Get the item first to check if it has audio
    const existingItem = await prisma.showItem.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        show: {
          include: { host: true }
        }
      }
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Timeline item not found' });
    }
    
    // Ensure all fields are properly set, especially startTimeOffset and date
    const updateData: any = {
      ...updates,
    };
    
    // Preserve date if provided
    if (date) {
      updateData.date = date;
    }
    
    // Ensure startTimeOffset is a number (seconds since midnight)
    if (updateData.startTimeOffset !== undefined) {
      updateData.startTimeOffset = parseInt(updateData.startTimeOffset) || 0;
    }
    
    const item = await prisma.showItem.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
    });

    // Process audio if this is a track item with audio
    if (item.contentType === 'TRACK') {
      try {
        const track = await prisma.track.findUnique({
          where: { id: item.contentId },
          select: { url: true }
        });

        if (track?.url) {
          const hostId = existingItem.show?.hostId || null;
          const processedUrl = await processShowItemAudioWithOverlays(
            item.id,
            track.url,
            item.showId,
            hostId,
            item.volume || 100,
            item.fadeInDuration || 0,
            item.fadeOutDuration || 0,
            item.playbackStartTime || undefined,
            item.playbackEndTime || undefined
          );

          console.log(`Processed audio for timeline item ${item.id}: ${processedUrl}`);
          
          // Force reload timeline for all active streamers to pick up the new processed audio
          try {
            const { streamers } = await import('../index');
            if (streamers) {
              for (const streamer of streamers.values()) {
                // Clear audio cache for this item to force reload
                const audioCache = (streamer as any).audioCache;
                if (audioCache) {
                  // Clear cache for original URL
                  const track = await prisma.track.findUnique({
                    where: { id: item.contentId },
                    select: { url: true }
                  });
                  if (track?.url) {
                    // Clear original URL from cache
                    if (audioCache.has(track.url)) {
                      audioCache.delete(track.url);
                      console.log(`🗑️ Cleared audio cache for item ${item.id} original URL: ${track.url}`);
                    }
                    
                    // Also clear any existing processed URLs for this item
                    const processedDir = require('path').join(process.cwd(), 'uploads', 'processed');
                    if (require('fs').existsSync(processedDir)) {
                      const files = require('fs').readdirSync(processedDir);
                      const itemFiles = files.filter((f: string) => 
                        f.startsWith(`processed_item_${item.id}_`) && f.endsWith('.mp3')
                      );
                      for (const file of itemFiles) {
                        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
                        const processedUrl = `${baseUrl}/api/uploads/processed/${file}`;
                        if (audioCache.has(processedUrl)) {
                          audioCache.delete(processedUrl);
                          console.log(`🗑️ Cleared audio cache for item ${item.id} processed URL: ${file}`);
                        }
                      }
                    }
                  }
                }
                
                // Force immediate reload of timeline to pick up new processed audio
                streamer.loadScheduleAndBuildTimeline().catch((err: any) => {
                  console.error('Error reloading timeline after audio processing:', err);
                });
              }
              console.log(`🔄 Timeline reloaded for all streamers - new processed audio will be used`);
            }
          } catch (reloadError) {
            console.error('Could not reload timeline after audio processing:', reloadError);
          }
        }
      } catch (audioError: any) {
        console.error(`Failed to process audio for timeline item ${item.id}:`, audioError);
        // Don't fail the update if audio processing fails
      }
    }

    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete timeline item
router.delete('/timeline-items/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.showItem.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Timeline item deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup old timeline data - Delete timeline items for past dates (more efficient)
router.delete('/timeline-items/cleanup/old-dates', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const todayDateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Get default show
    const defaultShow = await prisma.show.findFirst({
      where: { 
        isActive: true,
        title: 'Golden Pearl Radio Timeline'
      },
    });

    if (!defaultShow) {
      return res.json({ message: 'No default show found', deletedCount: 0 });
    }
    
    // Delete all timeline items for dates before today
    const result = await prisma.showItem.deleteMany({
      where: {
        showId: defaultShow.id,
        date: {
          lt: todayDateKey, // Less than today (past dates)
        },
      },
    });
    
    res.json({ 
      message: `Cleaned up ${result.count} timeline items from past dates`,
      deletedCount: result.count,
      todayDate: todayDateKey
    });
  } catch (error: any) {
    console.error('Error cleaning up old timeline data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get timeline items count by date (for monitoring and cleanup decisions)
router.get('/timeline-items/stats', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Get default show
    const defaultShow = await prisma.show.findFirst({
      where: { 
        isActive: true,
        title: 'Golden Pearl Radio Timeline'
      },
    });

    if (!defaultShow) {
      return res.json({ dates: [] });
    }

    // Get all unique dates with item counts
    const items = await prisma.showItem.findMany({
      where: { 
        showId: defaultShow.id,
        date: { not: null }
      },
      select: { date: true },
    });

    // Group by date and count
    const dateCounts: Record<string, number> = {};
    items.forEach(item => {
      if (item.date) {
        dateCounts[item.date] = (dateCounts[item.date] || 0) + 1;
      }
    });

    // Convert to array and sort by date
    const dates = Object.entries(dateCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({ dates });
  } catch (error: any) {
    console.error('Error getting timeline stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== LISTENER STATS ==========
// Get current active listeners count (no auth required for public stats)
router.get('/listeners/current', async (req: Request, res: Response) => {
  try {
    // Import streamers from the main server file
    const { streamers } = await import('../index');
    const streamerKey = '1'; // Default streamer
    const streamer = streamers.get(streamerKey);
    
    if (!streamer) {
      return res.json({ count: 0 });
    }
    
    // Get the httpClients Map size (active listeners)
    const httpClients = (streamer as any).httpClients;
    const listenerCount = httpClients ? httpClients.size : 0;
    
    res.json({ count: listenerCount });
  } catch (error: any) {
    console.error('Error getting listener count:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== TIMELINE PRESETS ==========
// Get all presets
router.get('/timeline-presets', async (req: Request, res: Response) => {
  try {
    const presets = await prisma.timelinePreset.findMany({
      orderBy: { createdAt: 'desc' }
    });
    // Parse JSON items for each preset
    const presetsWithParsedItems = presets.map(preset => ({
      ...preset,
      items: typeof preset.items === 'string' ? JSON.parse(preset.items) : preset.items
    }));
    res.json(presetsWithParsedItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create preset
router.post('/timeline-presets', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { date, name, items } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Preset name is required' });
    }
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }
    
    const preset = await prisma.timelinePreset.create({
      data: {
        name,
        date: date || new Date().toISOString().split('T')[0],
        items: items as any,
      }
    });
    
    res.status(201).json(preset);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PUBLISHED TIMELINES ==========
// Get published timelines
router.get('/published-timelines', async (req: Request, res: Response) => {
  try {
    const published = await prisma.publishedTimeline.findMany({
      orderBy: { publishedAt: 'desc' }
    });
    res.json(published);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Publish a timeline for a specific date
router.post('/published-timelines', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    
    // Upsert: create if doesn't exist, update if exists
    const published = await prisma.publishedTimeline.upsert({
      where: { date },
      update: {
        publishedAt: new Date(),
        publishedBy: req.user?.id,
      },
      create: {
        date,
        publishedBy: req.user?.id,
      }
    });
    
    // Force reload timeline for all active streamers if this is today's date
    const todayDateKey = new Date().toISOString().split('T')[0];
    if (date === todayDateKey) {
      try {
        const { streamers } = await import('../index');
        if (streamers) {
          for (const streamer of streamers.values()) {
            // Force immediate reload of timeline
            streamer.loadScheduleAndBuildTimeline().catch((err: any) => {
              console.error('Error reloading timeline after publish:', err);
            });
          }
          console.log(`Timeline reloaded for today (${date}) - stream will update immediately`);
        }
      } catch (err) {
        console.error('Could not reload timeline after publish (will reload on next check):', err);
      }
    }
    
    res.status(201).json(published);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PRODUCTS ==========
router.get('/products', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        user: {
          select: { id: true, username: true, email: true }
        },
        location: true,
      },
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    
    // Transform products to ensure all fields are properly serialized
    const transformedProducts = products.map(product => ({
      ...product,
      category: product.category || 'GENERAL',
      coverUrl: product.coverUrl || product.imageUrl || null,
      audioUrl: product.audioUrl || null,
      duration: product.duration || null,
    }));
    
    res.json(transformedProducts);
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: {
          select: { id: true, username: true, email: true }
        },
        location: true,
      }
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Transform product to ensure all fields are properly serialized
    const transformedProduct = {
      ...product,
      category: product.category || 'GENERAL',
      coverUrl: product.coverUrl || product.imageUrl || null,
      audioUrl: product.audioUrl || null,
      duration: product.duration || null,
    };
    
    res.json(transformedProduct);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/products', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Extract and validate required fields
    const {
      name,
      description,
      affiliateUrl,
      audioUrl,
      coverUrl,
      imageUrl,
      category,
      price,
      currency,
      duration,
      tags,
      isActive,
      productType,
      details,
      locationId,
    } = req.body;

    // Validate required fields
    if (!name || !affiliateUrl) {
      return res.status(400).json({ error: 'Name and affiliateUrl are required' });
    }

    // Handle category - now accepts any string (custom categories allowed)
    // Category is required in schema, so we need a default value
    let categoryValue: string = 'GENERAL'; // Default category
    if (category && category.trim()) {
      // Allow any category string (custom categories)
      categoryValue = category.trim();
    }

    const product = await prisma.product.create({
      data: {
        userId: req.user!.id,
        name,
        description: description || '',
        affiliateUrl,
        audioUrl: audioUrl || null,
        coverUrl: coverUrl || null,
        imageUrl: imageUrl || coverUrl || null,
        category: categoryValue, // Use provided category or default to GENERAL
        price: price || 0,
        currency: currency || 'aed',
        duration: duration || null,
        tags: tags || [],
        isActive: isActive !== undefined ? isActive : true,
        productType: productType || 'affiliate',
        details: details || {},
        locationId: locationId || null,
      },
      include: {
        user: {
          select: { id: true, username: true, email: true }
        },
        location: true,
      }
    });
    
    // Transform product to ensure all fields are properly serialized
    const transformedProduct = {
      ...product,
      category: product.category || 'GENERAL',
      coverUrl: product.coverUrl || product.imageUrl || null,
      audioUrl: product.audioUrl || null,
      duration: product.duration || null,
    };
    
    res.status(201).json(transformedProduct);
  } catch (error: any) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/products/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      description,
      affiliateUrl,
      audioUrl,
      coverUrl,
      imageUrl,
      category,
      price,
      currency,
      duration,
      tags,
      isActive,
      productType,
      details,
      locationId,
    } = req.body;

    // Build update data object, only including provided fields
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (affiliateUrl !== undefined) updateData.affiliateUrl = affiliateUrl;
    if (audioUrl !== undefined) updateData.audioUrl = audioUrl;
    if (coverUrl !== undefined) updateData.coverUrl = coverUrl;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (price !== undefined) updateData.price = price;
    if (currency !== undefined) updateData.currency = currency;
    if (duration !== undefined) updateData.duration = duration;
    if (tags !== undefined) updateData.tags = tags;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (productType !== undefined) updateData.productType = productType;
    if (details !== undefined) updateData.details = details;
    if (locationId !== undefined) updateData.locationId = locationId;
    
    // Handle category - now accepts any string (custom categories allowed)
    if (category !== undefined) {
      if (category === null || category.trim() === '') {
        // Use default if null or empty
        updateData.category = 'GENERAL';
      } else {
        // Allow any category string (custom categories)
        updateData.category = category.trim();
      }
    }

    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        user: {
          select: { id: true, username: true, email: true }
        },
        location: true,
      }
    });
    
    // Transform product to ensure all fields are properly serialized
    const transformedProduct = {
      ...product,
      category: product.category || 'GENERAL',
      coverUrl: product.coverUrl || product.imageUrl || null,
      audioUrl: product.audioUrl || null,
      duration: product.duration || null,
    };
    
    res.json(transformedProduct);
  } catch (error: any) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/products/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false }
    });
    res.json({ message: 'Product deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Increment product click count
router.post('/products/:id/click', async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: {
        clickCount: { increment: 1 }
      }
    });
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== RADIO STATIONS ==========
router.get('/radio-stations', async (req: Request, res: Response) => {
  try {
    const stations = await prisma.radioStation.findMany({
      include: {
        location: true,
        hosts: true,
        _count: {
          select: {
            scheduledShows: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(stations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/radio-stations/:id', async (req: Request, res: Response) => {
  try {
    const station = await prisma.radioStation.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        location: true,
        hosts: true,
        scheduledShows: {
          include: {
            show: {
              include: {
                host: true,
                showItems: true,
              }
            }
          }
        }
      }
    });
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    res.json(station);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/radio-stations', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const station = await prisma.radioStation.create({
      data: req.body,
      include: {
        location: true,
        hosts: true,
      }
    });
    res.status(201).json(station);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/radio-stations/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const station = await prisma.radioStation.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
      include: {
        location: true,
        hosts: true,
      }
    });
    res.json(station);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/radio-stations/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.radioStation.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Radio station deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== SCHEDULED SHOWS ==========
router.get('/scheduled-shows', async (req: Request, res: Response) => {
  try {
    const { stationId, startTime, endTime } = req.query;
    const where: any = {};
    
    if (stationId) {
      where.radioStationId = parseInt(stationId as string);
    }
    if (startTime) {
      where.startTime = { gte: new Date(startTime as string) };
    }
    if (endTime) {
      where.endTime = { lte: new Date(endTime as string) };
    }

    const scheduledShows = await prisma.scheduledShow.findMany({
      where,
      include: {
        show: {
          include: {
            host: true,
            showItems: true,
          }
        },
        radioStation: true,
        location: true,
      },
      orderBy: { startTime: 'asc' }
    });
    res.json(scheduledShows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/scheduled-shows', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const scheduledShow = await prisma.scheduledShow.create({
      data: req.body,
      include: {
        show: {
          include: {
            host: true,
            showItems: true,
          }
        },
        radioStation: true,
      }
    });
    res.status(201).json(scheduledShow);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/scheduled-shows/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.scheduledShow.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Scheduled show deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== NEWS ==========
router.get('/news', async (req: Request, res: Response) => {
  try {
    let news;
    try {
      news = await prisma.news.findMany({
        include: { location: true },
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
    } catch (innerError: any) {
      const msg = String(innerError?.message || '');
      if (!msg.includes('Unknown argument `sortOrder`')) throw innerError;

      news = await prisma.news.findMany({
        include: { location: true },
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    res.json(news);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/news', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    let nextSortOrder = 0;
    try {
      const last = await prisma.news.findFirst({
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      nextSortOrder = (last?.sortOrder ?? -1) + 1;
    } catch {
      // Ignore for stale Prisma client.
    }

    const payload = {
      ...req.body,
      linkBehavior: req.body?.linkBehavior || 'dialog',
      sortOrder: req.body?.sortOrder ?? nextSortOrder,
    } as any;

    let news;
    try {
      news = await prisma.news.create({
        data: payload,
        include: {
          location: true,
        }
      });
    } catch (innerError: any) {
      const msg = String(innerError?.message || '');
      const incompatibleClient =
        msg.includes('Unknown argument `sortOrder`') ||
        msg.includes('Unknown argument `imageUrl`') ||
        msg.includes('Unknown argument `linkUrl`') ||
        msg.includes('Unknown argument `linkBehavior`');

      if (!incompatibleClient) throw innerError;

      // Fallback for stale Prisma client: ignore new optional fields until client is regenerated.
      const { imageUrl, linkUrl, linkBehavior, sortOrder, ...safePayload } = payload;
      news = await prisma.news.create({
        data: safePayload,
        include: {
          location: true,
        }
      });
    }
    res.status(201).json(news);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/news/reorder', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    await prisma.$transaction(
      items.map((item: any, index: number) =>
        prisma.news.update({
          where: { id: parseInt(String(item.id), 10) },
          data: { sortOrder: Number.isFinite(item.sortOrder) ? Number(item.sortOrder) : index },
        }),
      ),
    );

    res.json({ message: 'News order updated' });
  } catch (error: any) {
    const msg = String(error?.message || '');
    if (msg.includes('Unknown argument `sortOrder`')) {
      return res.status(500).json({
        error: 'sortOrder field is not available yet. Regenerate Prisma client and restart server.',
      });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/news/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const payload = {
      ...req.body,
      linkBehavior: req.body?.linkBehavior || 'dialog',
    } as any;

    let news;
    try {
      news = await prisma.news.update({
        where: { id: parseInt(req.params.id) },
        data: payload,
        include: {
          location: true,
        }
      });
    } catch (innerError: any) {
      const msg = String(innerError?.message || '');
      const incompatibleClient =
        msg.includes('Unknown argument `sortOrder`') ||
        msg.includes('Unknown argument `imageUrl`') ||
        msg.includes('Unknown argument `linkUrl`') ||
        msg.includes('Unknown argument `linkBehavior`');

      if (!incompatibleClient) throw innerError;

      // Fallback for stale Prisma client: ignore new optional fields until client is regenerated.
      const { imageUrl, linkUrl, linkBehavior, sortOrder, ...safePayload } = payload;
      news = await prisma.news.update({
        where: { id: parseInt(req.params.id) },
        data: safePayload,
        include: {
          location: true,
        }
      });
    }
    res.json(news);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/news/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.news.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false }
    });
    res.json({ message: 'News deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PROMOTIONS ==========
router.get('/promotions', async (req: Request, res: Response) => {
  try {
    const items = await prisma.promotion.findMany({
      where: { isActive: true },
      include: {
        product: true,
        location: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/promotions', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const last = await prisma.promotion.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const nextSortOrder = (last?.sortOrder ?? -1) + 1;

    const item = await prisma.promotion.create({
      data: {
        ...req.body,
        linkBehavior: req.body?.linkBehavior || 'dialog',
        sortOrder: req.body?.sortOrder ?? nextSortOrder,
      },
      include: {
        product: true,
        location: true,
      },
    });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/promotions/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.promotion.update({
      where: { id: parseInt(req.params.id, 10) },
      data: {
        ...req.body,
        linkBehavior: req.body?.linkBehavior || 'dialog',
      },
      include: {
        product: true,
        location: true,
      },
    });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/promotions/reorder', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    await prisma.$transaction(
      items.map((item: any, index: number) =>
        prisma.promotion.update({
          where: { id: parseInt(String(item.id), 10) },
          data: { sortOrder: Number.isFinite(item.sortOrder) ? Number(item.sortOrder) : index },
        }),
      ),
    );

    res.json({ message: 'Promotion order updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/promotions/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.promotion.update({
      where: { id: parseInt(req.params.id, 10) },
      data: { isActive: false },
    });
    res.json({ message: 'Promotion deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ADVERTISEMENTS ==========
router.get('/advertisements', async (req: Request, res: Response) => {
  try {
    const ads = await prisma.advertisement.findMany({
      where: { isActive: true },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/advertisement-host-audios', async (req: Request, res: Response) => {
  try {
    const hostAudios = await prisma.advertisementHostAudio.findMany({
      where: { isActive: true },
      include: {
        advertisement: {
          include: { product: true },
        },
        host: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ advertisementId: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(hostAudios);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/advertisements/:id', async (req: Request, res: Response) => {
  try {
    const ad = await prisma.advertisement.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { product: true },
    });
    if (!ad) return res.status(404).json({ error: 'Advertisement not found' });
    res.json(ad);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/advertisements', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ad = await prisma.advertisement.create({ data: req.body });
    res.status(201).json(ad);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/advertisements/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ad = await prisma.advertisement.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(ad);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/advertisements/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.advertisement.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    });
    res.json({ message: 'Advertisement deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== TALKS ==========
router.get('/talks', async (req: Request, res: Response) => {
  try {
    const talks = await prisma.talk.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(talks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/talks/:id', async (req: Request, res: Response) => {
  try {
    const talk = await prisma.talk.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!talk) return res.status(404).json({ error: 'Talk not found' });
    res.json(talk);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/talks', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const talk = await prisma.talk.create({ data: req.body });
    res.status(201).json(talk);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/talks/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const talk = await prisma.talk.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(talk);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/talks/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.talk.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false },
    });
    res.json({ message: 'Talk deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== HOST COMMENTARIES ==========
router.get('/host-commentaries', async (req: Request, res: Response) => {
  try {
    const { hostId } = req.query;
    const where: any = {};
    if (hostId) where.hostId = parseInt(hostId as string);

    const items = await prisma.hostCommentary.findMany({
      where,
      include: { host: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/host-commentaries', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.hostCommentary.create({
      data: req.body,
      include: { host: true },
    });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/host-commentaries/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.hostCommentary.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
      include: { host: true },
    });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/host-commentaries/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.hostCommentary.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Host commentary deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== COMMENTARIES (Unified endpoint for News + HostCommentary) ==========
router.get('/commentaries', async (req: Request, res: Response) => {
  try {
    const news = await prisma.news.findMany({
      where: { isActive: true },
      include: { location: true },
      orderBy: { createdAt: 'desc' },
    });
    
    // HostCommentary doesn't have isActive field, so fetch all
    const hostCommentaries = await prisma.hostCommentary.findMany({
      include: { host: true },
      orderBy: { createdAt: 'desc' },
    });
    
    // Combine and format as Commentary type
    const commentaries = [
      ...news.map(n => ({
        id: n.id,
        title: n.title,
        content: n.message || '',
        type: 'NEWS' as const,
        priority: n.priority,
        expiresAt: n.expiresAt,
        isActive: n.isActive,
        createdAt: n.createdAt,
        location: n.location,
      })),
      ...hostCommentaries.map(hc => ({
        id: hc.id,
        title: hc.title,
        content: hc.script || '', // HostCommentary uses 'script' field, not 'content'
        type: 'HOST_COMMENTARY' as const,
        hostId: hc.hostId,
        isActive: true, // HostCommentary doesn't have isActive field
        createdAt: hc.createdAt,
        host: hc.host,
      })),
    ];
    
    res.json(commentaries);
  } catch (error: any) {
    console.error('Error fetching commentaries:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== HOSTS ==========
router.get('/hosts', async (req: Request, res: Response) => {
  try {
    const hosts = await prisma.host.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(hosts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/hosts', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.create({
      data: req.body
    });
    res.status(201).json(host);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/hosts/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(host);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/hosts/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.host.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false }
    });
    res.json({ message: 'Host deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== LOCATIONS ==========
router.get('/locations', async (req: Request, res: Response) => {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(locations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/locations', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const location = await prisma.location.create({
      data: req.body
    });
    res.status(201).json(location);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== SCHEDULE ITEMS (Admin CRUD) ==========
router.get('/schedule-items', async (req: Request, res: Response) => {
  try {
    const kindParam = String(req.query.kind || '').trim().toLowerCase();
    const kind =
      kindParam === 'programme' || kindParam === 'podcast'
        ? (kindParam as 'programme' | 'podcast')
        : undefined;
    const items = await listScheduleItems(kind);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/schedule-items', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const kind = String(req.body?.kind || '').trim().toLowerCase();
    if (kind !== 'programme' && kind !== 'podcast') {
      return res.status(400).json({ error: 'kind must be programme or podcast' });
    }

    const title = String(req.body?.title || '').trim();
    const startAt = String(req.body?.startAt || '').trim();
    if (!title || !startAt) return res.status(400).json({ error: 'title and startAt are required' });

    const created = await createScheduleItem({
      kind,
      title,
      description: req.body?.description ?? null,
      imageUrl: req.body?.imageUrl ?? null,
      startAt,
    });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/schedule-items/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const kind = String(req.body?.kind || '').trim().toLowerCase();
    if (kind !== 'programme' && kind !== 'podcast') {
      return res.status(400).json({ error: 'kind must be programme or podcast' });
    }

    const title = String(req.body?.title || '').trim();
    const startAt = String(req.body?.startAt || '').trim();
    if (!title || !startAt) return res.status(400).json({ error: 'title and startAt are required' });

    const updated = await updateScheduleItem(id, {
      kind,
      title,
      description: req.body?.description ?? null,
      imageUrl: req.body?.imageUrl ?? null,
      startAt,
    });
    if (!updated) return res.status(404).json({ error: 'Schedule item not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/schedule-items/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const ok = await softDeleteScheduleItem(id);
    if (!ok) return res.status(404).json({ error: 'Schedule item not found' });
    res.json({ message: 'Schedule item deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
