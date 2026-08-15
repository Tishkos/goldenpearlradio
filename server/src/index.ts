import express, { Request, Response } from 'express';
import cors from 'cors';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../lib/prisma';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import { authenticateToken, requireAdmin } from './middleware/auth';
import uploadRoutes from './routes/upload';
import streamRoutes from './routes/stream';
import geoip from 'fast-geoip';
import { ensureScheduleTables, listScheduleItems, markScheduleItemInterested } from './utils/scheduleItems';

dotenv.config();

// --- LISTENER GEOLOCATION ---
interface ListenerGeo {
  country: string;      // ISO country code, e.g. "AE"
  city: string;
  lat: number;
  lon: number;
}

// The backend sits behind two nginx proxies (host TLS -> container -> node), so the
// real client address is the FIRST entry of X-Forwarded-For, not the socket address.
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(',')[0]?.trim();
  const ip = first || req.socket.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === '' ||
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('fc') ||
    ip.startsWith('fe80')
  );
}

const geoCache = new Map<string, ListenerGeo | null>();

// Rolling 24h log of located listeners (keyed by IP) so the admin map can show
// where recent listeners were, not just who is connected this second.
const RECENT_SIGHTING_TTL_MS = 24 * 60 * 60 * 1000;
const recentSightings = new Map<string, { geo: ListenerGeo; lastSeen: number }>();

function recordSighting(ip: string | undefined, geo: ListenerGeo | null | undefined) {
  if (!ip || !geo) return;
  recentSightings.set(ip, { geo, lastSeen: Date.now() });
}

function pruneSightings() {
  const cutoff = Date.now() - RECENT_SIGHTING_TTL_MS;
  for (const [ip, sighting] of recentSightings.entries()) {
    if (sighting.lastSeen < cutoff) recentSightings.delete(ip);
  }
  if (recentSightings.size > 5000) {
    const oldestFirst = [...recentSightings.entries()].sort(
      (a, b) => a[1].lastSeen - b[1].lastSeen
    );
    for (const [ip] of oldestFirst.slice(0, recentSightings.size - 5000)) {
      recentSightings.delete(ip);
    }
  }
}

async function lookupListenerGeo(ip: string): Promise<ListenerGeo | null> {
  if (isPrivateIp(ip)) return null;
  if (geoCache.has(ip)) return geoCache.get(ip) ?? null;
  try {
    const info = await geoip.lookup(ip);
    const geo: ListenerGeo | null =
      info && Array.isArray(info.ll) && (info.ll[0] !== 0 || info.ll[1] !== 0)
        ? {
            country: info.country || 'Unknown',
            city: info.city || info.region || 'Unknown',
            lat: info.ll[0],
            lon: info.ll[1],
          }
        : null;
    // Cap the cache so a scan of many unique IPs cannot grow memory unbounded
    if (geoCache.size > 10000) geoCache.clear();
    geoCache.set(ip, geo);
    return geo;
  } catch (error) {
    console.error(`Geo lookup failed for ${ip}:`, error);
    return null;
  }
}

// --- CONFIGURATION ---
const AUDIO_FORMAT = {
  sampleRate: 44100, // CD quality sample rate
  channels: 2,       // Stereo
  bitDepth: 16,      // 16-bit audio
  byteDepth: 2,      // 16-bit = 2 bytes
};
const TICK_INTERVAL_MS = 100; // The "frame rate" of the audio engine
const SAMPLES_PER_TICK = Math.floor(AUDIO_FORMAT.sampleRate * (TICK_INTERVAL_MS / 1000));
const BYTES_PER_TICK = SAMPLES_PER_TICK * AUDIO_FORMAT.channels * AUDIO_FORMAT.byteDepth;
const BUFFER_AHEAD_SECONDS = 60; // Pre-fetch and decode audio well before it's needed so track changes are seamless
const STREAM_TIMEZONE = process.env.STREAM_TIMEZONE || 'Europe/Budapest';

function getStationParts(date: Date, timeZone = STREAM_TIMEZONE) {
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
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function getStationDateKey(date: Date, timeZone = STREAM_TIMEZONE): string {
  const parts = getStationParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getStationTimeOfDaySeconds(date: Date, timeZone = STREAM_TIMEZONE): number {
  const parts = getStationParts(date, timeZone);
  const safeHour = parts.hour % 24;
  return (safeHour * 3600) + (parts.minute * 60) + parts.second;
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

const app = express();
const PORT = Number(process.env.PORT || 3001);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN === '*' ? '*' : (process.env.CORS_ORIGIN?.split(',') || '*'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
};

app.use(cors(corsOptions));
app.use(express.json());
// Note: express.static removed - files are served via /api/uploads/:filename route

// API Routes - public routes FIRST (before auth middleware)
app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes); // Mount BEFORE apiRoutes to avoid auth middleware
app.use('/api/stream', streamRoutes); // Public stream endpoint - no auth required

// Ensure schedule tables exist for shared programme/podcast interests
ensureScheduleTables().catch((error) => {
  console.error('Failed to ensure schedule tables:', error);
});

// Listener stats are for the admin dashboard only — the public site must not
// see (or be able to query) how many people are listening.
app.get('/api/listeners/current', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const streamerKey = '1'; // Default streamer
    const streamer = streamers.get(streamerKey);
    
    // Get HTTP stream connections
    const httpClients = streamer ? (streamer as any).httpClients : null;
    const streamConnections = httpClients ? httpClients.size : 0;
    
    // Get active website listeners (those with recent pings)
    const now = Date.now();
    const activeListeners = Array.from(activeWebsiteListeners.values()).filter(
      listener => now - listener.lastPing < 10000 && listener.isPlaying
    );
    
    // Total count = stream connections + active website listeners
    const totalCount = streamConnections + activeListeners.length;

    res.json({ count: totalCount });
  } catch (error: any) {
    console.error('Error getting listener count:', error);
    res.status(500).json({ error: error.message });
  }
});

// Live listener world map data (city-level aggregates only — never exposes IPs)
app.get('/api/listeners/map', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const streamer = streamers.get('1');
    const httpClients: Map<string, HttpClient> | undefined = streamer
      ? (streamer as any).httpClients
      : undefined;

    // One entry per distinct listener. Browser listeners hold an open /stream
    // connection AND send heartbeats, so dedupe website pings against stream IPs.
    const seenIps = new Set<string>();
    const entries: { ip?: string; geo: ListenerGeo | null | undefined }[] = [];

    if (httpClients) {
      for (const client of httpClients.values()) {
        if (client.ip) seenIps.add(client.ip);
        entries.push({ ip: client.ip, geo: client.geo });
      }
    }

    const now = Date.now();
    for (const listener of activeWebsiteListeners.values()) {
      if (now - listener.lastPing >= 10000 || !listener.isPlaying) continue;
      if (listener.ip && seenIps.has(listener.ip)) continue;
      if (listener.ip) seenIps.add(listener.ip);
      entries.push({ ip: listener.ip, geo: listener.geo });
    }

    // Long-lived stream connections never re-ping, so refresh their sightings here
    for (const entry of entries) recordSighting(entry.ip, entry.geo);
    pruneSightings();

    // Aggregate to city buckets
    const aggregate = (geos: ListenerGeo[]) => {
      const buckets = new Map<
        string,
        { city: string; country: string; lat: number; lon: number; count: number }
      >();
      for (const geo of geos) {
        const key = `${geo.country}|${geo.city}|${geo.lat.toFixed(1)},${geo.lon.toFixed(1)}`;
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.count++;
        } else {
          buckets.set(key, {
            city: geo.city,
            country: geo.country,
            lat: geo.lat,
            lon: geo.lon,
            count: 1,
          });
        }
      }
      return Array.from(buckets.values()).sort((a, b) => b.count - a.count);
    };

    const liveGeos = entries.map((e) => e.geo).filter((g): g is ListenerGeo => Boolean(g));
    const unlocated = entries.length - liveGeos.length;
    const locations = aggregate(liveGeos);
    const countries = new Set(locations.map((l) => l.country)).size;

    // Everyone located within the last 24h (one entry per distinct IP)
    const recentGeos = Array.from(recentSightings.values()).map((s) => s.geo);
    const recent = aggregate(recentGeos);

    res.json({
      total: entries.length,
      located: liveGeos.length,
      unlocated,
      countries,
      locations,
      recentTotal: recentGeos.length,
      recent,
      updatedAt: now,
    });
  } catch (error: any) {
    console.error('Error building listener map:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public news (home, news page - no auth)
app.get('/api/news', async (req: Request, res: Response) => {
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
    console.error('Error fetching news:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public promotions (RecommendedProducts - no auth)
app.get('/api/promotions', async (req: Request, res: Response) => {
  try {
    const items = await prisma.promotion.findMany({
      where: { isActive: true },
      include: { product: true, location: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(items);
  } catch (error: any) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public products (shop/home product spotlight - no auth)
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { location: true },
      orderBy: { createdAt: 'desc' },
    });

    const transformedProducts = products.map((product) => ({
      ...product,
      price: product.price != null ? Number(product.price) : null,
      clickCount: product.clickCount != null ? Number(product.clickCount) : 0,
      details: product.details || {},
    }));

    res.json(transformedProducts);
  } catch (error: any) {
    console.error('Error fetching public products:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      include: { location: true },
    });

    if (!product || !product.isActive) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      ...product,
      price: product.price != null ? Number(product.price) : null,
      clickCount: product.clickCount != null ? Number(product.clickCount) : 0,
      details: product.details || {},
    });
  } catch (error: any) {
    console.error('Error fetching public product:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products/:id/click', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        clickCount: {
          increment: 1,
        },
      },
      select: {
        id: true,
        clickCount: true,
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error tracking product click:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public shows (podcast/show pages - no auth)
app.get('/api/shows', async (req: Request, res: Response) => {
  try {
    const shows = await prisma.show.findMany({
      include: {
        host: true,
        scheduledShows: {
          include: {
            radioStation: true,
            location: true,
          },
        },
        showItems: true,
        _count: {
          select: {
            showItems: true,
            scheduledShows: true,
          },
        },
      },
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(shows);
  } catch (error: any) {
    console.error('Error fetching public shows:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shows/:id', async (req: Request, res: Response) => {
  try {
    const show = await prisma.show.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      include: {
        host: true,
        scheduledShows: {
          include: {
            radioStation: true,
            location: true,
          },
        },
        showItems: {
          orderBy: { position: 'asc' },
        },
        _count: {
          select: {
            showItems: true,
            scheduledShows: true,
          },
        },
      },
    });

    if (!show || show.isActive === false) {
      return res.status(404).json({ error: 'Show not found' });
    }

    res.json(show);
  } catch (error: any) {
    console.error('Error fetching public show:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public advertisements (radio overlay/product resolution - no auth)
app.get('/api/advertisements', async (req: Request, res: Response) => {
  try {
    const ads = await prisma.advertisement.findMany({
      where: { isActive: true },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ads);
  } catch (error: any) {
    console.error('Error fetching public advertisements:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/advertisements/:id', async (req: Request, res: Response) => {
  try {
    const advertisement = await prisma.advertisement.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      include: { product: true },
    });

    if (!advertisement || !advertisement.isActive) {
      return res.status(404).json({ error: 'Advertisement not found' });
    }

    res.json(advertisement);
  } catch (error: any) {
    console.error('Error fetching public advertisement:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public schedule items (programme/podcast) - no auth
app.get('/api/schedule-items', async (req: Request, res: Response) => {
  try {
    const kindParam = String(req.query.kind || '').trim().toLowerCase();
    const kind =
      kindParam === 'programme' || kindParam === 'podcast'
        ? (kindParam as 'programme' | 'podcast')
        : undefined;
    const items = await listScheduleItems(kind);
    res.json(items);
  } catch (error: any) {
    console.error('Error fetching schedule items:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public interested endpoint (shared across devices by DB; one vote per device id)
app.post('/api/schedule-items/:id/interested', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const deviceIdRaw = String(req.body?.deviceId || '').trim();
    if (!deviceIdRaw) return res.status(400).json({ error: 'deviceId is required' });
    const deviceId = deviceIdRaw.slice(0, 160);

    const updated = await markScheduleItemInterested(id, deviceId);
    if (!updated) return res.status(404).json({ error: 'Schedule item not found' });
    res.json(updated);
  } catch (error: any) {
    console.error('Error marking interested:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public top tracks this week (for Song of the Week - no auth)
app.get('/api/tracks/top-week', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const topTracks = await prisma.trackPlay.groupBy({
      by: ['trackId'],
      where: { playedAt: { gte: monday } },
      _count: { trackId: true },
      orderBy: { _count: { trackId: 'desc' } },
      take: 5,
    });

    const trackIds = topTracks.map((t) => t.trackId);
    const tracks = await prisma.track.findMany({
      where: { id: { in: trackIds } },
      select: { id: true, title: true, artist: true, coverArt: true },
    });

    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    const result = topTracks
      .map((t) => {
        const track = trackMap.get(t.trackId);
        if (!track) return null;
        return { ...track, playCount: t._count.trackId };
      })
      .filter(Boolean);

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching top tracks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to register/update active listener (heartbeat)
app.post('/api/listeners/ping', async (req: Request, res: Response) => {
  try {
    const { listenerId, isPlaying } = req.body;
    
    if (!listenerId) {
      return res.status(400).json({ error: 'listenerId is required' });
    }

    const ip = getClientIp(req);
    const previous = activeWebsiteListeners.get(listenerId);

    // Update or create listener entry
    activeWebsiteListeners.set(listenerId, {
      id: listenerId,
      lastPing: Date.now(),
      isPlaying: Boolean(isPlaying),
      ip,
      geo: previous?.ip === ip ? previous.geo : undefined,
    });

    const current = activeWebsiteListeners.get(listenerId);
    if (current && current.geo === undefined) {
      void lookupListenerGeo(ip).then((geo) => {
        recordSighting(ip, geo);
        const entry = activeWebsiteListeners.get(listenerId);
        if (entry && entry.ip === ip) entry.geo = geo;
      });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating listener ping:', error);
    res.status(500).json({ error: error.message });
  }
});

// Protected API routes (require authentication)
app.use('/api', apiRoutes);

// --- INTERNAL TYPE DEFINITIONS ---
enum ContentType {
  TRACK = 'TRACK',
  ADVERTISEMENT = 'ADVERTISEMENT',
  NEWS = 'NEWS',
  TALK = 'TALK',
  HOST_COMMENTARY = 'HOST_COMMENTARY',
}

interface DBShowItem {
  id: number;
  showId: number;
  position: number;
  contentType: ContentType;
  contentId: number;
  volume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  playbackStartTime: number | null;
  playbackEndTime: number | null;
  mixMode: 'sequential' | 'overlay' | 'crossfade';
  startTimeOffset: number;
  parentItemId: number | null;
  startTimeInParent: number | null;
  duckingVolume: number | null;
}

interface HttpClient {
  id: string;
  response: Response;
  ip?: string;
  geo?: ListenerGeo | null;
  connectedAt?: number;
}

// A unified object representing any playable item on the timeline
interface TimelineItem extends DBShowItem {
  audioUrl: string | null;
  contentTitle: string;
  layer: number;
  calculatedStartTime: number;
  calculatedEndTime: number;
  baseDuration: number; // The original duration of the audio file
  duration: number; // The effective duration after trimming
}

// =================================================================
// The Advanced Radio Streamer with Real-time Audio Mixing
// =================================================================
class RadioStreamer {
  private stationId: string;
  private httpClients = new Map<string, HttpClient>();
  private mainFfmpegProcess: ChildProcess | null = null;

  // Rolling buffer of the most recently encoded MP3 bytes. New listeners get
  // this burst immediately on connect (like Icecast burst-on-connect), so their
  // player starts with ~10s of cushion instead of zero. Without it, every
  // listener runs exactly at the live edge and any network jitter is an
  // audible stutter.
  private recentEncodedChunks: Buffer[] = [];
  private recentEncodedBytes = 0;
  private static readonly BURST_BUFFER_BYTES = 240_000; // ~10s at 192kbps
  // A client whose socket has stalled long enough to queue this much unsent
  // audio is dead weight; drop it and let the player's reconnect logic rejoin.
  private static readonly MAX_CLIENT_BACKLOG_BYTES = 4_000_000;
  private encoderRestartPending = false;

  private isPlaying = false;
  private showTime = 0; // Master clock for the current show in seconds
  private audioEngineInterval: NodeJS.Timeout | null = null;
  private showCheckInterval: NodeJS.Timeout | null = null; // Periodically check for new shows
  private nextAudioFrameTime: number | null = null;
  
  private currentShow: any = null; // Holds the full scheduled_show object
  private timelineItems: TimelineItem[] = [];
  private timelineSignature = '';
  private lastFullTimelineBuildMs = 0;
  private audioCache = new Map<string, Int16Array>(); // Cache for decoded raw audio data, keyed by audio URL
  private audioLoadPromises = new Map<string, Promise<Int16Array | null>>();
  private showStartTime: Date | null = null; // When the current show started (for synchronization)
  private lastDebugLogTime: number = 0; // Track last debug log time to avoid spam

  constructor(stationId: string) {
    this.stationId = stationId;
    this.lastDebugLogTime = 0;
    console.log(`[Station ${stationId}] RadioStreamer initialized.`);
  }

  // --- Client Management ---
  public addHttpClient(response: Response, ip?: string): string {
    const clientId = randomUUID();
    const client: HttpClient = { id: clientId, response, ip, connectedAt: Date.now() };
    this.httpClients.set(clientId, client);
    if (ip) {
      // Resolve asynchronously so connecting a listener never waits on geo data
      void lookupListenerGeo(ip).then((geo) => {
        recordSighting(ip, geo);
        const existing = this.httpClients.get(clientId);
        if (existing) existing.geo = geo;
      });
    }
    console.log(`[Station ${this.stationId}] Listener connected. Total: ${this.httpClients.size}`);

    // Send headers plus the rolling burst buffer right away so the player can
    // begin decoding with a multi-second cushion instead of waiting for the
    // next encoded chunk at exactly realtime rate.
    try {
      response.socket?.setNoDelay(true);
      this.beginClientResponse(client);
      for (const chunk of this.recentEncodedChunks) {
        if (!response.writable || response.destroyed) break;
        response.write(chunk);
      }
    } catch {
      // Socket died during connect; the close handler will clean up.
    }

    // If this is the first listener, start the engine
    // The stream runs continuously - all listeners receive the same synchronized audio
    if (!this.isPlaying) {
      this.start();
    }
    return clientId;
  }

  private beginClientResponse(client: HttpClient) {
    if (client.response.headersSent) return;
    client.response.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'X-Accel-Buffering': 'no',
    });
    client.response.flushHeaders?.();
  }

  public removeHttpClient(clientId: string) {
    this.httpClients.delete(clientId);
    console.log(`[Station ${this.stationId}] Listener disconnected. Total: ${this.httpClients.size}`);
    // The engine keeps running with zero listeners. Stopping and cold-starting
    // per listener caused seconds of silence on every (re)connect: schedule
    // queries plus decoding the current track had to finish before any audio.
    // An always-on engine means every listener joins the broadcast instantly.
  }

  // Start the broadcast engine independently of listeners (called at boot).
  public ensureStarted() {
    if (!this.isPlaying) {
      void this.start();
    }
  }

  // --- Core Streaming Logic ---
  private async start() {
    if (this.isPlaying) return;
    console.log(`[Station ${this.stationId}] Starting continuous stream...`);
    const ffmpegPath = resolveFfmpegPath();
    if (!ffmpegPath) {
      console.error(`[Station ${this.stationId}] FFmpeg not found. Streaming is disabled until FFmpeg is installed.`);
      this.broadcastError('FFmpeg is required for streaming. Install it or set FFMPEG_PATH. See FFMPEG_SETUP.md');
      return;
    }

    this.isPlaying = true;

    // Launch FFmpeg encoder first - stream must always be running
    this.launchMainFfmpegEncoder();

    // Load initial schedule
    await this.refreshProcessedFilesCache();
    await this.loadScheduleAndBuildTimeline();
    
    // Start the audio engine - it will handle silence if no show is scheduled
    this.audioEngineInterval = setInterval(() => this.audioEngineTick(), TICK_INTERVAL_MS);
    
    // Periodically reload the editor timeline so changes go live quickly
    this.showCheckInterval = setInterval(async () => {
      await this.checkForNewShow();
    }, 10000);
    
    // Set show start time for synchronization
    this.showStartTime = new Date();
  }

  private stop() {
    if (!this.isPlaying) return;
    console.log(`[Station ${this.stationId}] Stopping stream as all listeners have disconnected.`);
    this.isPlaying = false;
    
    if (this.audioEngineInterval) {
      clearInterval(this.audioEngineInterval);
      this.audioEngineInterval = null;
    }
    
    if (this.showCheckInterval) {
      clearInterval(this.showCheckInterval);
      this.showCheckInterval = null;
    }

    if (this.mainFfmpegProcess) {
      this.mainFfmpegProcess.stdin?.end();
      this.mainFfmpegProcess.kill();
      this.mainFfmpegProcess = null;
    }

    // Clear state
    this.showTime = 0;
    this.nextAudioFrameTime = null;
    this.recentEncodedChunks = [];
    this.recentEncodedBytes = 0;
    this.timelineSignature = '';
    this.lastFullTimelineBuildMs = 0;
    this.audioCache.clear();
    this.audioLoadPromises.clear();
    this.timelineItems = [];
    this.currentShow = null;
    this.showStartTime = null;
    
    // Close any remaining client connections
    for(const client of this.httpClients.values()) {
        try { 
          if (!client.response.headersSent) {
            client.response.end();
          }
        } catch {}
    }
    this.httpClients.clear();
  }
  
  // Reload today's playlist periodically to pick up any changes
  private async checkForNewShow() {
    // Reload today's timeline items to pick up any changes (new items, updates, etc.)
    // This ensures the stream always plays the latest published playlist
    await this.refreshProcessedFilesCache();
    await this.loadScheduleAndBuildTimeline();
  }
  
  // Launches the main FFmpeg process that encodes our mixed audio into an MP3 stream
  private launchMainFfmpegEncoder() {
    try {
        // Try to use FFmpeg from PATH, or from environment variable, or from local ffmpeg/bin directory
        const ffmpegPath = resolveFfmpegPath();
        if (!ffmpegPath) {
            throw Object.assign(new Error('FFmpeg not found'), { code: 'ENOENT' });
        }
        
        this.mainFfmpegProcess = spawn(ffmpegPath, [
            // Real errors only: the default per-0.5s progress stats wrote ~14MB
            // of docker logs per day on a 24/7 stream (no log rotation on the VPS).
            '-nostats', '-loglevel', 'error',
            '-f', `s${AUDIO_FORMAT.bitDepth}le`, // Input format: raw PCM 16-bit little-endian
            '-ar', `${AUDIO_FORMAT.sampleRate}`, // Input sample rate
            '-ac', `${AUDIO_FORMAT.channels}`,   // Input channels (stereo)
            '-i', 'pipe:0',                      // Read from our script's stdin
            '-c:a', 'libmp3lame',              // Encoder: MP3
            '-b:a', '192k',                      // Bitrate: 192 kbps (good quality for music)
            '-f', 'mp3',                         // Output format: MP3
            '-'                                  // Output to stdout, which we will pipe to clients
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        if (!this.mainFfmpegProcess.stdin || !this.mainFfmpegProcess.stdout) {
            throw new Error('Failed to create FFmpeg process streams');
        }

        // "spawn" event fires when the child process has started successfully.
        this.mainFfmpegProcess.once('spawn', () => {
            console.log(`[Station ${this.stationId}] Main FFmpeg encoder process started.`);
        });
        this.pipeFfmpegOutputToClients();

        // Log errors from FFmpeg
        if (this.mainFfmpegProcess.stderr) {
            this.mainFfmpegProcess.stderr.on('data', (chunk: Buffer) => {
                console.error(`[FFmpeg stderr - Station ${this.stationId}]:`, chunk.toString());
            });
        }

        // Handle FFmpeg process exit. Do NOT drop the connected listeners here:
        // the stdout 'end' handler restarts the encoder and clients simply keep
        // reading the same response — MP3 decoders resync on the next frame.
        this.mainFfmpegProcess.on('exit', (code, signal) => {
            if (code !== 0 && code !== null) {
                console.error(`[Station ${this.stationId}] FFmpeg encoder exited with code ${code} (signal ${signal ?? 'none'}); restarting.`);
            }
        });

        this.mainFfmpegProcess.on('error', (error: any) => {
            console.error(`[Station ${this.stationId}] FFmpeg process error:`, error);
            if (error.code === 'ENOENT') {
                console.error(`[Station ${this.stationId}] FFmpeg not found! Please install FFmpeg and add it to your PATH.`);
                console.error(`[Station ${this.stationId}] See FFMPEG_SETUP.md for installation instructions.`);
                console.error(`[Station ${this.stationId}] You can also set FFMPEG_PATH environment variable to point to FFmpeg executable.`);
            }
            this.scheduleEncoderRestart(2000);
        });
    } catch (error) {
        console.error(`[Station ${this.stationId}] Failed to launch FFmpeg:`, error);
        this.broadcastError("FFmpeg is not available. Audio streaming requires FFmpeg to be installed in the runtime environment.");
        throw error;
    }
  }
  
  // Reads the MP3 data from FFmpeg's stdout and sends it to all connected listeners
  // All clients receive the same synchronized stream data - like a real radio station
  private async pipeFfmpegOutputToClients() {
    const proc = this.mainFfmpegProcess;
    if (!proc || !proc.stdout) return;

    proc.stdout.on('data', (chunk: Buffer) => {
        // Maintain the burst buffer for future connects
        this.recentEncodedChunks.push(chunk);
        this.recentEncodedBytes += chunk.length;
        while (
          this.recentEncodedBytes > RadioStreamer.BURST_BUFFER_BYTES &&
          this.recentEncodedChunks.length > 1
        ) {
          const dropped = this.recentEncodedChunks.shift()!;
          this.recentEncodedBytes -= dropped.length;
        }

        // Broadcast the same chunk to all connected clients simultaneously
        for (const client of this.httpClients.values()) {
            try {
                this.beginClientResponse(client);
                if (!client.response.writable || client.response.destroyed) {
                    this.removeHttpClient(client.id);
                    continue;
                }
                // A stalled socket keeps queueing audio in server memory; cut it
                // off once the backlog is clearly hopeless.
                if (client.response.writableLength > RadioStreamer.MAX_CLIENT_BACKLOG_BYTES) {
                    console.warn(`[Station ${this.stationId}] Dropping stalled listener ${client.id} (${client.response.writableLength} bytes queued).`);
                    try { client.response.destroy(); } catch {}
                    this.removeHttpClient(client.id);
                    continue;
                }
                client.response.write(chunk);
            } catch (error: any) {
                // Client likely disconnected, remove them
                if (error.code !== 'EPIPE' && error.code !== 'ECONNRESET') {
                  console.error(`[Station ${this.stationId}] Error writing to client ${client.id}:`, error.message);
                }
                this.removeHttpClient(client.id);
            }
        }
    });

    proc.stdout.on('end', () => {
        // Only the currently-active encoder may trigger a restart; a stale
        // process ending after a replacement was launched must be ignored.
        if (this.mainFfmpegProcess !== proc) return;
        console.log(`[Station ${this.stationId}] FFmpeg stdout ended - restarting encoder`);
        this.scheduleEncoderRestart(1000);
    });

    proc.stdout.on('error', (error) => {
        console.error(`[Station ${this.stationId}] Error reading from FFmpeg stdout:`, error);
    });
  }

  // Restart the encoder once, even if several failure events fire together.
  // Listeners stay connected throughout; they just get a short gap in audio.
  private scheduleEncoderRestart(delayMs: number) {
    if (this.encoderRestartPending) return;
    this.encoderRestartPending = true;
    setTimeout(() => {
        this.encoderRestartPending = false;
        if (!this.isPlaying) return;
        console.log(`[Station ${this.stationId}] Restarting FFmpeg encoder...`);
        try {
            this.launchMainFfmpegEncoder();
        } catch (error) {
            console.error(`[Station ${this.stationId}] Failed to restart FFmpeg:`, error);
            this.scheduleEncoderRestart(5000);
        }
    }, delayMs);
  }
  
  // --- Audio Engine: The Heart of the Streamer ---
  
  // This function runs every TICK_INTERVAL_MS
  // All clients receive the same synchronized stream based on real time
  private audioEngineTick() {
    if (!this.mainFfmpegProcess || !this.isPlaying || !this.mainFfmpegProcess.stdin) return;

    const tickSeconds = TICK_INTERVAL_MS / 1000;
    const targetShowTime = this.showStartTime ? getStationTimeOfDaySeconds(new Date()) : 0;

    if (!this.showStartTime) {
      this.nextAudioFrameTime = null;
      this.writeAudioFrameAt(0);
      return;
    }

    // Keep the encoded stream continuous. If a timer fires late, write the missing
    // 100ms frames instead of jumping the source clock forward and creating stutter.
    if (
      this.nextAudioFrameTime === null ||
      targetShowTime < this.nextAudioFrameTime - 5 ||
      targetShowTime - this.nextAudioFrameTime > 5
    ) {
      this.nextAudioFrameTime = targetShowTime;
    }

    const lagSeconds = Math.max(0, targetShowTime - this.nextAudioFrameTime);
    const chunksToWrite = Math.min(6, Math.max(1, Math.floor(lagSeconds / tickSeconds) + 1));

    for (let i = 0; i < chunksToWrite; i++) {
      this.writeAudioFrameAt(this.nextAudioFrameTime);
      this.nextAudioFrameTime += tickSeconds;
    }
  }

  private writeAudioFrameAt(showTime: number) {
    if (!this.mainFfmpegProcess || !this.mainFfmpegProcess.stdin) return;

    this.showTime = showTime;

    // Find all items that should be playing at the current showTime
    const activeItems = this.timelineItems.filter(item => 
        this.showTime >= item.calculatedStartTime && this.showTime < item.calculatedEndTime
    );
    
    // Calculate currentTimeSeconds for debug logging
    const currentTimeSeconds = Math.floor(this.showTime);
    
    // Separate parent items from overlay items
    const allParentItems = activeItems.filter(item => !item.parentItemId);
    const explicitOverlays = activeItems.filter(item => item.parentItemId);
    const trackItems = allParentItems.filter(item => item.contentType === "TRACK");
    const implicitOverlays = allParentItems.filter(item => {
      if (item.parentItemId) return false;
      if (item.contentType === "TRACK") return false;
      return trackItems.some(track => 
        track.id !== item.id &&
        item.calculatedStartTime >= track.calculatedStartTime &&
        item.calculatedStartTime < track.calculatedEndTime
      );
    });
    const parentItems = allParentItems.filter(item => {
      if (item.contentType === "TRACK") return true;
      return !trackItems.some(track => 
        track.id !== item.id &&
        item.calculatedStartTime >= track.calculatedStartTime &&
        item.calculatedStartTime < track.calculatedEndTime
      );
    });
    const overlayItems = [...explicitOverlays, ...implicitOverlays];
    
    // Debug: Log current playback state every 10 seconds (to avoid spam)
    if (currentTimeSeconds - this.lastDebugLogTime >= 10) {
      this.lastDebugLogTime = currentTimeSeconds;
      const currentHours = Math.floor(this.showTime / 3600);
      const currentMins = Math.floor((this.showTime % 3600) / 60);
      const currentSecs = Math.floor(this.showTime % 60);
      console.log(`[Station ${this.stationId}] Current time: ${currentHours}:${currentMins.toString().padStart(2, '0')}:${currentSecs.toString().padStart(2, '0')} (${currentTimeSeconds}s), Active items: ${activeItems.length} (${parentItems.length} parents, ${overlayItems.length} overlays)`);
      if (activeItems.length > 0) {
        activeItems.forEach(item => {
          const isOverlay = item.parentItemId ? ' [OVERLAY]' : '';
          console.log(`  → Playing: "${item.contentTitle || 'Untitled'}"${isOverlay} (id: ${item.id}, parentId: ${item.parentItemId || 'none'}, duckingVolume: ${item.duckingVolume ?? 'none'})`);
        });
      } else if (this.timelineItems.length > 0) {
        // Show what items are nearby
        const upcoming = this.timelineItems.filter(item => item.calculatedStartTime > this.showTime).slice(0, 2);
        if (upcoming.length > 0) {
          console.log(`  → Next up: ${upcoming.map(i => i.contentTitle || 'Untitled').join(', ')}`);
        }
      }
    }

    // Proactively fetch audio for items that are coming up soon
    if (this.timelineItems.length > 0) {
      this.prefetchUpcomingAudio();
    }

    // Mix the audio for all active items for this specific tick
    // If no items are active, mixAudioForTick will return silence
    const mixedBuffer = this.mixAudioForTick(activeItems);

    try {
        // Write the mixed raw audio chunk to FFmpeg to be encoded
        // This keeps the stream running continuously - all clients receive the same data
        if (this.mainFfmpegProcess.stdin.writable) {
            this.mainFfmpegProcess.stdin.write(mixedBuffer);
        }
    } catch (e) {
        console.error(`[Station ${this.stationId}] CRITICAL: Error writing to FFmpeg stdin. Stream may have stopped.`, e);
        // Don't stop - try to recover
        try {
          this.launchMainFfmpegEncoder();
        } catch (recoverError) {
          console.error(`[Station ${this.stationId}] Failed to recover FFmpeg process.`, recoverError);
        }
    }
  }

  // The mixing logic
  // Returns silence if no items are active (keeps stream running)
  private mixAudioForTick(activeItems: TimelineItem[]): Buffer {
    // Calculate currentTimeSeconds for debug logging
    const currentTimeSeconds = Math.floor(this.showTime);
    // Accumulate the mix in floats: summing directly into an Int16Array wraps
    // around on overflow (e.g. ducked track + overlay), producing loud crackle.
    // We clamp once, after all sources are summed.
    const mixedBuffer = new Float32Array(SAMPLES_PER_TICK * AUDIO_FORMAT.channels);

    if (activeItems.length === 0) {
      // No active items - return silence (but stream continues)
      return Buffer.alloc(BYTES_PER_TICK);
    }

    // Separate parent items from overlay items
    // Overlays can be:
    // 1. Items with explicit parentItemId
    // 2. Items that overlap in time with a TRACK (implicit overlays)
    const allParentItems = activeItems.filter(item => !item.parentItemId);
    
    // Get explicit overlays (with parentItemId)
    const explicitOverlays = activeItems.filter(item => item.parentItemId);
    
    // Get TRACK items (these are always parents)
    const trackItems = allParentItems.filter(item => item.contentType === "TRACK");
    
    // Get implicit overlays (items that overlap with TRACKs but don't have parentItemId)
    // These are non-TRACK items that start during a TRACK's playback
    const implicitOverlays = allParentItems.filter(item => {
      if (item.parentItemId) return false; // Already an explicit overlay
      if (item.contentType === "TRACK") return false; // TRACKs are parents, not overlays
      
      // Check if this item overlaps with any active TRACK
      // An item overlaps if it starts during a TRACK's playback time
      return trackItems.some(track => 
        track.id !== item.id &&
        item.calculatedStartTime >= track.calculatedStartTime &&
        item.calculatedStartTime < track.calculatedEndTime
      );
    });
    
    // Parent items are TRACKs and non-TRACK items that don't overlap with TRACKs
    const parentItems = allParentItems.filter(item => {
      // TRACKs are always parents
      if (item.contentType === "TRACK") return true;
      // Non-TRACK items are parents only if they don't overlap with a TRACK
      return !trackItems.some(track => 
        track.id !== item.id &&
        item.calculatedStartTime >= track.calculatedStartTime &&
        item.calculatedStartTime < track.calculatedEndTime
      );
    });
    
    // Combine explicit and implicit overlays
    const overlayItems = [...explicitOverlays, ...implicitOverlays];
    
    // Debug: Log current playback state every 10 seconds (to avoid spam)
    if (currentTimeSeconds - this.lastDebugLogTime >= 10) {
      this.lastDebugLogTime = currentTimeSeconds;
      const currentHours = Math.floor(this.showTime / 3600);
      const currentMins = Math.floor((this.showTime % 3600) / 60);
      const currentSecs = Math.floor(this.showTime % 60);
      console.log(`[Station ${this.stationId}] Current time: ${currentHours}:${currentMins.toString().padStart(2, '0')}:${currentSecs.toString().padStart(2, '0')} (${currentTimeSeconds}s), Active items: ${activeItems.length} (${parentItems.length} parents, ${overlayItems.length} overlays)`);
      if (activeItems.length > 0) {
        activeItems.forEach(item => {
          const isOverlay = item.parentItemId ? ' [OVERLAY]' : '';
          console.log(`  → Playing: "${item.contentTitle || 'Untitled'}"${isOverlay} (id: ${item.id}, parentId: ${item.parentItemId || 'none'}, duckingVolume: ${item.duckingVolume ?? 'none'})`);
        });
      } else if (this.timelineItems.length > 0) {
        // Show what items are nearby
        const upcoming = this.timelineItems.filter(item => item.calculatedStartTime > this.showTime).slice(0, 2);
        if (upcoming.length > 0) {
          console.log(`  → Next up: ${upcoming.map(i => i.contentTitle || 'Untitled').join(', ')}`);
        }
      }
    }
    
    // Debug: Log overlay detection - always log when overlays are found
    if (overlayItems.length > 0) {
      if (currentTimeSeconds - this.lastDebugLogTime >= 2) {
        console.log(`\n[Station ${this.stationId}] ========== OVERLAY DETECTION ==========`);
        console.log(`[Station ${this.stationId}] 📊 Overlay detection: ${explicitOverlays.length} explicit, ${implicitOverlays.length} implicit overlays`);
        console.log(`[Station ${this.stationId}] 📊 Active items: ${activeItems.length}, Parent items: ${parentItems.length}, TRACK items: ${trackItems.length}`);
        console.log(`[Station ${this.stationId}] 📊 Current time: ${this.showTime.toFixed(1)}s`);
        overlayItems.forEach(overlay => {
          const overlayType = overlay.parentItemId ? 'explicit' : 'implicit';
          const hasAudio = overlay.audioUrl ? `yes (${overlay.audioUrl})` : 'NO ❌';
          const isActive = this.showTime >= overlay.calculatedStartTime && this.showTime < overlay.calculatedEndTime;
          console.log(`[Station ${this.stationId}]   → Overlay: "${overlay.contentTitle}" (id: ${overlay.id}, type: ${overlayType}, active: ${isActive}, audioUrl: ${hasAudio}, contentType: ${overlay.contentType}, time: ${overlay.calculatedStartTime.toFixed(1)}s-${overlay.calculatedEndTime.toFixed(1)}s)`);
        });
        console.log(`[Station ${this.stationId}] =========================================\n`);
        this.lastDebugLogTime = currentTimeSeconds;
      }
    } else if (activeItems.length > 0 && currentTimeSeconds - this.lastDebugLogTime >= 5) {
      // Log active items when no overlays found (for debugging) - check if there should be overlays
      const nonTrackItems = activeItems.filter(i => i.contentType !== "TRACK" && !i.parentItemId);
      const tracks = activeItems.filter(i => i.contentType === "TRACK");
      if (nonTrackItems.length > 0 && tracks.length > 0) {
        console.log(`\n[Station ${this.stationId}] ⚠️ NO OVERLAYS DETECTED but there are overlapping items!`);
        console.log(`[Station ${this.stationId}] 📊 Active TRACKs: ${tracks.map(t => `"${t.contentTitle}" (${t.calculatedStartTime.toFixed(1)}s-${t.calculatedEndTime.toFixed(1)}s)`).join(', ')}`);
        console.log(`[Station ${this.stationId}] 📊 Non-TRACK items: ${nonTrackItems.map(i => `"${i.contentTitle}" (${i.contentType}, ${i.calculatedStartTime.toFixed(1)}s-${i.calculatedEndTime.toFixed(1)}s)`).join(', ')}`);
        // Check why they're not being detected as overlays
        nonTrackItems.forEach(item => {
          const overlappingTracks = tracks.filter(track => 
            item.calculatedStartTime >= track.calculatedStartTime &&
            item.calculatedStartTime < track.calculatedEndTime
          );
          if (overlappingTracks.length > 0) {
            console.log(`[Station ${this.stationId}]   ⚠️ "${item.contentTitle}" overlaps with: ${overlappingTracks.map(t => `"${t.contentTitle}"`).join(', ')} - but NOT detected as overlay!`);
          }
        });
        console.log(`[Station ${this.stationId}] =========================================\n`);
      }
      this.lastDebugLogTime = currentTimeSeconds;
    }

    // Debug: Log overlay detection
    if (overlayItems.length > 0) {
      overlayItems.forEach(overlay => {
        const isActive = this.showTime >= overlay.calculatedStartTime && this.showTime < overlay.calculatedEndTime;
        if (isActive && currentTimeSeconds - this.lastDebugLogTime >= 3) {
          console.log(`[Station ${this.stationId}] 🔊 ACTIVE OVERLAY: "${overlay.contentTitle}" (id: ${overlay.id}, parentId: ${overlay.parentItemId} [${typeof overlay.parentItemId}], duckingVolume: ${overlay.duckingVolume ?? 'null'}, audioUrl: ${overlay.audioUrl ? 'yes' : 'no'}, time: ${this.showTime.toFixed(1)}s, range: ${overlay.calculatedStartTime.toFixed(1)}s-${overlay.calculatedEndTime.toFixed(1)}s)`);
          // Also log all parent items to see if any match
          const matchingParents = parentItems.filter(p => {
            const pId = p.id != null ? Number(p.id) : null;
            const oParentId = overlay.parentItemId != null ? Number(overlay.parentItemId) : null;
            return pId !== null && oParentId !== null && pId === oParentId;
          });
          if (matchingParents.length > 0) {
            console.log(`[Station ${this.stationId}]   → Matches ${matchingParents.length} parent(s): ${matchingParents.map(p => `"${p.contentTitle}" (id: ${p.id})`).join(', ')}`);
          } else {
            console.log(`[Station ${this.stationId}]   → ⚠️ No matching parent found! Available parents: ${parentItems.map(p => `"${p.contentTitle}" (id: ${p.id} [${typeof p.id}])`).join(', ')}`);
          }
          this.lastDebugLogTime = currentTimeSeconds;
        }
      });
    }

    // First, process parent items and check if they should be ducked
    for (const item of parentItems) {
        if (!item.audioUrl) {
          console.warn(`[Station ${this.stationId}] Active item "${item.contentTitle}" has no audioUrl`);
          continue;
        }
        
        // For TRACK items, check if processed audio exists and use it instead
        // This ensures we always use processed audio when available (especially for tracks with overlays)
        let audioUrlToUse = item.audioUrl;
        if (item.contentType === ContentType.TRACK && !item.audioUrl.includes('/processed/')) {
          // Check if processed audio exists for this item
          const processedUrl = this.getProcessedAudioUrl(item.id, item.audioUrl);
          if (processedUrl) {
            console.log(`[Station ${this.stationId}] 🔄 Switching to processed audio for track "${item.contentTitle}" (id: ${item.id})`);
            audioUrlToUse = processedUrl;
            // Update item's audioUrl for this tick
            item.audioUrl = processedUrl;
          }
        }
        
        const audioData = this.audioCache.get(audioUrlToUse);
        if (!audioData || audioData.length === 0) {
          // Audio not loaded yet - try to load it immediately
          console.warn(`[Station ${this.stationId}] Audio not cached for "${item.contentTitle}" (${audioUrlToUse}), attempting to load...`);
          this.queueAudioLoad(audioUrlToUse, item.contentTitle);
          continue; // Skip if audio hasn't been decoded yet
        }

        const timeIntoItem = this.showTime - item.calculatedStartTime;
        
        // --- Calculate final volume (0.0 to 1.0) including fades ---
        let volume = item.volume / 100;
        if (item.fadeInDuration > 0 && timeIntoItem < item.fadeInDuration) {
            volume *= (timeIntoItem / item.fadeInDuration); // Linear fade-in
        }
        if (item.fadeOutDuration > 0 && item.duration - timeIntoItem < item.fadeOutDuration) {
            volume *= ((item.duration - timeIntoItem) / item.fadeOutDuration); // Linear fade-out
        }
        
        // Check if this parent item has active overlays - if so, duck the volume
        // Only duck when overlay is actually playing (within its time range)
        // Handle both explicit overlays (with parentItemId) and implicit overlays (overlapping in time)
        const activeOverlaysForParent = overlayItems.filter(overlay => {
          // For explicit overlays (with parentItemId), check if parent matches
          if (overlay.parentItemId != null) {
            const overlayParentId = Number(overlay.parentItemId);
            const itemId = item.id != null ? Number(item.id) : null;
            
            if (itemId === null || overlayParentId !== itemId) {
              return false;
            }
          } else {
            // For implicit overlays (overlapping), check if overlay overlaps with this parent item
            // Only check for TRACK items as parents
            if (item.contentType !== "TRACK") {
              return false;
            }
            
            // Check if overlay starts during this parent track
            if (overlay.calculatedStartTime < item.calculatedStartTime || 
                overlay.calculatedStartTime >= item.calculatedEndTime) {
              return false;
            }
          }
          
          // Verify overlay is actually active at this moment
          const overlayStart = overlay.calculatedStartTime;
          const overlayEnd = overlay.calculatedEndTime;
          return this.showTime >= overlayStart && this.showTime < overlayEnd;
        });
        
        // Debug log when overlays are found for a parent
        if (activeOverlaysForParent.length > 0 && currentTimeSeconds - this.lastDebugLogTime >= 3) {
          console.log(`[Station ${this.stationId}] 🔍 Found ${activeOverlaysForParent.length} active overlay(s) for parent "${item.contentTitle}" (id: ${item.id}): ${activeOverlaysForParent.map(o => `"${o.contentTitle}" (id: ${o.id}, duckingVolume: ${o.duckingVolume ?? 'null'})`).join(', ')}`);
          this.lastDebugLogTime = currentTimeSeconds;
        }
        
        if (activeOverlaysForParent.length > 0) {
          // Find the ducking volume (use the first overlay's duckingVolume, or default to 50%)
          // For implicit overlays (without parentItemId), duckingVolume might be null - use default
          const rawDuckingVolume = activeOverlaysForParent[0].duckingVolume;
          // Ensure duckingVolume is a number (handle string conversion from DB)
          const duckingVolume = typeof rawDuckingVolume === 'string' ? parseFloat(rawDuckingVolume) : rawDuckingVolume;
          
          if (duckingVolume !== null && duckingVolume !== undefined && !isNaN(duckingVolume) && duckingVolume >= 0 && duckingVolume <= 100) {
            const originalVolume = volume;
            // Apply ducking: multiply by duckingVolume percentage (e.g., 20% = 0.2, so volume becomes 20% of original)
            volume = volume * (duckingVolume / 100);
            
            // Debug: Log ducking (more frequent for debugging)
            if (currentTimeSeconds - this.lastDebugLogTime >= 3) {
              const overlayType = activeOverlaysForParent[0].parentItemId ? 'explicit' : 'implicit';
              console.log(`[Station ${this.stationId}] 🎚️ DUCKING: "${item.contentTitle}" (id: ${item.id}) from ${(originalVolume * 100).toFixed(1)}% to ${(volume * 100).toFixed(1)}% (duckingVolume: ${duckingVolume}%, overlay: "${activeOverlaysForParent[0].contentTitle}", overlayId: ${activeOverlaysForParent[0].id}, type: ${overlayType})`);
              this.lastDebugLogTime = currentTimeSeconds;
            }
          } else {
            // Default ducking if not specified or invalid (especially for implicit overlays)
            const originalVolume = volume;
            volume = volume * 0.5; // Default to 50%
            if (currentTimeSeconds - this.lastDebugLogTime >= 3) {
              const overlayType = activeOverlaysForParent[0].parentItemId ? 'explicit' : 'implicit';
              console.log(`[Station ${this.stationId}] 🎚️ DUCKING (default): "${item.contentTitle}" (id: ${item.id}) from ${(originalVolume * 100).toFixed(1)}% to ${(volume * 100).toFixed(1)}% (duckingVolume was: ${rawDuckingVolume} [${typeof rawDuckingVolume}], using default 50%, overlay: "${activeOverlaysForParent[0].contentTitle}", type: ${overlayType})`);
              this.lastDebugLogTime = currentTimeSeconds;
            }
          }
        }
        
        // Find the starting position in the source audio file's buffer
        // playbackStartTime is in milliseconds, convert to seconds
        const timeIntoAudioFile = ((item.playbackStartTime || 0) / 1000) + timeIntoItem;
        const startSample = Math.floor(timeIntoAudioFile * AUDIO_FORMAT.sampleRate);
        const startIndexInSourceBuffer = startSample * AUDIO_FORMAT.channels;

        // Add this item's audio to the main mix buffer
        for (let i = 0; i < SAMPLES_PER_TICK * AUDIO_FORMAT.channels; i++) {
            const sourceIndex = startIndexInSourceBuffer + i;
            if (sourceIndex >= audioData.length) break;

            const sample = audioData[sourceIndex];
            mixedBuffer[i] += sample * volume;
        }
    }

    // Now process overlay items (these play at full volume over the ducked parent)
    // This includes both explicit overlays (with parentItemId) and implicit overlays (overlapping in time)
    for (const item of overlayItems) {
        // Verify overlay is actually active at this moment
        const overlayStart = item.calculatedStartTime;
        const overlayEnd = item.calculatedEndTime;
        if (this.showTime < overlayStart || this.showTime >= overlayEnd) {
          // Overlay is not active yet or has ended - skip
          continue;
        }
        
        // For implicit overlays (without parentItemId), make sure we have audio
        // They should already be in activeItems, so they should have audio loaded
        
        if (!item.audioUrl) {
          console.error(`[Station ${this.stationId}] ❌ Active overlay item "${item.contentTitle}" (id: ${item.id}) has no audioUrl - parentId: ${item.parentItemId}, contentType: ${item.contentType}, contentId: ${item.contentId}`);
          console.error(`[Station ${this.stationId}] ❌ This overlay will NOT play! Check if the ${item.contentType} with id ${item.contentId} has audioUrl in the database.`);
          continue;
        }
        
        const audioData = this.audioCache.get(item.audioUrl);
        if (!audioData || audioData.length === 0) {
          // Audio not loaded yet - try to load it immediately
          console.warn(`[Station ${this.stationId}] ⚠️ Audio not cached for overlay "${item.contentTitle}" (${item.audioUrl}), attempting to load...`);
          // Load audio asynchronously but don't wait - it will be available next tick
          this.queueAudioLoad(item.audioUrl, item.contentTitle);
          continue; // Skip this tick if audio hasn't been decoded yet
        }

        const timeIntoItem = this.showTime - item.calculatedStartTime;
        
        // Debug: Log when overlay audio is being mixed (more frequently)
        if (currentTimeSeconds - this.lastDebugLogTime >= 2) {
          console.log(`[Station ${this.stationId}] 🔊 MIXING OVERLAY: "${item.contentTitle}" (id: ${item.id}, volume: ${((item.volume || 100) / 100 * 100).toFixed(0)}%, timeIntoItem: ${timeIntoItem.toFixed(1)}s, audioUrl: ${item.audioUrl})`);
          this.lastDebugLogTime = currentTimeSeconds;
        }
        
        // --- Calculate final volume (0.0 to 1.0) including fades ---
        let volume = (item.volume || 100) / 100;
        if (item.fadeInDuration > 0 && timeIntoItem < item.fadeInDuration) {
            volume *= (timeIntoItem / item.fadeInDuration); // Linear fade-in
        }
        if (item.fadeOutDuration > 0 && item.duration - timeIntoItem < item.fadeOutDuration) {
            volume *= ((item.duration - timeIntoItem) / item.fadeOutDuration); // Linear fade-out
        }
        
        // Find the starting position in the source audio file's buffer
        // playbackStartTime is in milliseconds, convert to seconds
        const timeIntoAudioFile = ((item.playbackStartTime || 0) / 1000) + timeIntoItem;
        const startSample = Math.floor(timeIntoAudioFile * AUDIO_FORMAT.sampleRate);
        const startIndexInSourceBuffer = startSample * AUDIO_FORMAT.channels;

        // Add this overlay item's audio to the main mix buffer (at specified volume)
        let samplesMixed = 0;
        for (let i = 0; i < SAMPLES_PER_TICK * AUDIO_FORMAT.channels; i++) {
            const sourceIndex = startIndexInSourceBuffer + i;
            if (sourceIndex >= audioData.length) break;

            const sample = audioData[sourceIndex];
            // Mix overlay audio into the buffer
            mixedBuffer[i] += sample * volume;
            samplesMixed++;
        }
        
        // Debug: Log successful mixing (only log occasionally to avoid spam)
        if (samplesMixed > 0 && currentTimeSeconds - this.lastDebugLogTime >= 3) {
          console.log(`[Station ${this.stationId}] ✅ MIXED OVERLAY: "${item.contentTitle}" - ${samplesMixed} samples at ${(volume * 100).toFixed(0)}% volume`);
          this.lastDebugLogTime = currentTimeSeconds;
        }
    }
    
    // Clip the mixed audio to prevent distortion (ensure values are within 16-bit range)
    const pcmOut = new Int16Array(mixedBuffer.length);
    for (let i = 0; i < mixedBuffer.length; i++) {
      pcmOut[i] = Math.max(-32768, Math.min(32767, Math.round(mixedBuffer[i])));
    }

    return Buffer.from(pcmOut.buffer);
  }

  // Finds upcoming items and starts fetching/decoding their audio
  private prefetchUpcomingAudio() {
    const upcomingItems = this.timelineItems.filter(item => 
        item.audioUrl && // Only fetch items that have audio
        !this.audioCache.has(item.audioUrl) && // Only fetch if not already in cache
        item.calculatedStartTime >= this.showTime &&
        item.calculatedStartTime < this.showTime + BUFFER_AHEAD_SECONDS
    );

    for (const item of upcomingItems) {
        if (!item.audioUrl) continue;
        console.log(`[Station ${this.stationId}] Pre-fetching audio for: "${item.contentTitle}"`);
        this.queueAudioLoad(item.audioUrl, item.contentTitle);
    }
  }

  private queueAudioLoad(audioUrl: string, label: string) {
    if (this.audioLoadPromises.has(audioUrl)) return;

    const cached = this.audioCache.get(audioUrl);
    if (cached && cached.length > 0) return;

    // Placeholder prevents a cold listener from spawning a decoder every tick.
    this.audioCache.set(audioUrl, new Int16Array(0));

    const loadPromise = this.fetchAndDecodeAudio(audioUrl)
      .then(decodedBuffer => {
        if (decodedBuffer && decodedBuffer.length > 0) {
          this.audioCache.set(audioUrl, decodedBuffer);
          console.log(`[Station ${this.stationId}] Audio buffered for: "${label}"`);
          return decodedBuffer;
        }

        this.audioCache.delete(audioUrl);
        console.error(`[Station ${this.stationId}] Failed to decode audio for "${label}" (${audioUrl})`);
        return null;
      })
      .catch(err => {
        this.audioCache.delete(audioUrl);
        console.error(`[Station ${this.stationId}] Failed to buffer audio for "${label}" (${audioUrl}):`, err);
        return null;
      })
      .finally(() => {
        this.audioLoadPromises.delete(audioUrl);
      });

    this.audioLoadPromises.set(audioUrl, loadPromise);
  }

  // Maps an /api/uploads/... URL (any host) to the local file on disk, if it exists.
  // Decoding from disk avoids a fragile HTTP round-trip through the public domain/nginx
  // when the stream server fetches its own uploads.
  private resolveLocalUploadPath(audioUrl: string): string | null {
    try {
      const parsed = new URL(audioUrl, 'http://localhost');
      const match = parsed.pathname.match(/^\/api\/uploads\/(.+)$/);
      if (!match) return null;
      const uploadsRoot = path.resolve(process.cwd(), 'uploads');
      const candidate = path.resolve(uploadsRoot, decodeURIComponent(match[1]));
      if (!candidate.startsWith(uploadsRoot)) return null;
      return fs.existsSync(candidate) ? candidate : null;
    } catch {
      return null;
    }
  }

  // Decodes a local audio file to raw PCM via FFmpeg
  private decodeLocalAudioFile(filePath: string): Promise<Int16Array | null> {
    return new Promise((resolve, reject) => {
      const ffmpegPath = resolveFfmpegPath();
      if (!ffmpegPath) {
        reject(new Error('FFmpeg not found. Cannot decode audio.'));
        return;
      }
      const decoder = spawn(ffmpegPath, [
        '-i', filePath,
        '-f', `s${AUDIO_FORMAT.bitDepth}le`,
        '-ar', `${AUDIO_FORMAT.sampleRate}`,
        '-ac', `${AUDIO_FORMAT.channels}`,
        '-'
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      const rawAudioChunks: Buffer[] = [];
      const errorChunks: Buffer[] = [];
      decoder.stdout?.on('data', (chunk: Buffer) => rawAudioChunks.push(chunk));
      decoder.stderr?.on('data', (chunk: Buffer) => errorChunks.push(chunk));
      decoder.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg decoder failed with code ${code}: ${Buffer.concat(errorChunks).toString().slice(-500)}`));
          return;
        }
        const combined = Buffer.concat(rawAudioChunks);
        resolve(new Int16Array(combined.buffer, combined.byteOffset, combined.byteLength / 2));
      });
      decoder.on('error', (error) => reject(new Error(`FFmpeg decoder error: ${error.message}`)));
    });
  }

  // Fetches an audio file and uses a temporary FFmpeg process to decode it to raw PCM data
  private async fetchAndDecodeAudio(audioUrl: string): Promise<Int16Array | null> {
    try {
        // Prefer decoding our own uploads straight from disk
        const localPath = this.resolveLocalUploadPath(audioUrl);
        if (localPath) {
          return await this.decodeLocalAudioFile(localPath);
        }

        const response = await fetch(audioUrl);
        if (!response.ok || !response.body) {
            throw new Error(`Failed to fetch audio file: ${response.statusText}`);
        }

        return new Promise((resolve, reject) => {
            const ffmpegPath = resolveFfmpegPath();
            if (!ffmpegPath) {
                reject(new Error('FFmpeg not found. Cannot decode audio.'));
                return;
            }
            const decoder = spawn(ffmpegPath, [
                '-i', 'pipe:0',                  // Input from stdin
                '-f', `s${AUDIO_FORMAT.bitDepth}le`, // Output format: raw PCM
                '-ar', `${AUDIO_FORMAT.sampleRate}`, // Output sample rate
                '-ac', `${AUDIO_FORMAT.channels}`,   // Output channels
                '-'                              // Output to stdout
            ], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            if (!decoder.stdin || !decoder.stdout) {
                reject(new Error('Failed to create FFmpeg decoder process streams'));
                return;
            }

            const rawAudioChunks: Buffer[] = [];
            const errorChunks: Buffer[] = [];

            // Convert fetch response body to Node.js Readable stream and pipe to decoder
            // Readable.fromWeb is available in Node.js 18+
            const bodyStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
            
            bodyStream.pipe(decoder.stdin);
            bodyStream.on('error', (err) => {
                console.error(`[Station ${this.stationId}] Error reading audio URL:`, err);
                reject(err);
            });

            // Collect decoded audio data
            decoder.stdout.on('data', (chunk: Buffer) => {
                rawAudioChunks.push(chunk);
            });

            // Collect error output
            if (decoder.stderr) {
                decoder.stderr.on('data', (chunk: Buffer) => {
                    errorChunks.push(chunk);
                });
            }

            decoder.on('close', (code) => {
                if (code !== 0) {
                    const errorOutput = Buffer.concat(errorChunks).toString();
                    reject(new Error(`FFmpeg decoder failed with code ${code}: ${errorOutput}`));
                    return;
                }

                // Combine all chunks into a single buffer and return as Int16Array
                const combined = Buffer.concat(rawAudioChunks);
                resolve(new Int16Array(combined.buffer, combined.byteOffset, combined.byteLength / 2));
            });

            decoder.on('error', (error) => {
                reject(new Error(`FFmpeg decoder error: ${error.message}`));
            });
        });
    } catch (error) {
        console.error(`[Station ${this.stationId}] Error in fetchAndDecodeAudio for ${audioUrl}:`, error);
        return null;
    }
  }

  // --- Show & Timeline Management ---
  
  // Fetches schedule data from database and populates the timeline
  public async loadScheduleAndBuildTimeline() {
    const now = new Date();
    const stationIdNum = parseInt(this.stationId, 10);
    
    // Get today's date in YYYY-MM-DD format (station timezone)
    const stationTimeZone = STREAM_TIMEZONE;
    const todayDateKey = getStationDateKey(now, stationTimeZone);
    
    // Get or create default show for timeline items (with host included)
    let defaultShow = await prisma.show.findFirst({
      where: { 
        isActive: true,
        title: 'Golden Pearl Radio Timeline'
      },
      include: { host: true }
    });

    if (!defaultShow) {
      const firstHost = await prisma.host.findFirst({ where: { isActive: true } });
      if (!firstHost) {
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
          include: { host: true }
        });
      } else {
        defaultShow = await prisma.show.create({
          data: {
            title: 'Golden Pearl Radio Timeline',
            description: 'Main radio timeline',
            hostId: firstHost.id,
            isActive: true,
          },
          include: { host: true }
        });
      }
    }

    // Load today's timeline items (date-based playlist)
    const todayItems = await prisma.showItem.findMany({
      where: {
        showId: defaultShow.id,
        date: todayDateKey,
      },
      orderBy: { position: 'asc' },
    });

    // Enriching + laying out the timeline is expensive (a content query per
    // item plus heavy logging — with hundreds of items that stalled the audio
    // engine every 10s reload and made the stream stutter). Skip the rebuild
    // when nothing changed; a periodic full rebuild still picks up edits made
    // directly to content tables (e.g. a re-uploaded track file).
    const signature =
      `${todayDateKey}|${this.processedFilesSignature}|` +
      JSON.stringify(
        todayItems.map((i) => [
          i.id, i.position, i.startTimeOffset, i.contentType, i.contentId,
          i.volume, i.fadeInDuration, i.fadeOutDuration, i.playbackStartTime,
          i.playbackEndTime, i.mixMode, i.parentItemId, i.startTimeInParent,
          i.duckingVolume,
        ])
      );
    const fullRebuildDue = Date.now() - this.lastFullTimelineBuildMs > 5 * 60 * 1000;
    if (!fullRebuildDue && signature === this.timelineSignature) {
      this.evictFinishedAudioFromCache();
      return;
    }
    this.timelineSignature = signature;
    this.lastFullTimelineBuildMs = Date.now();

    if (todayItems.length === 0) {
      console.warn(`[Station ${this.stationId}] No timeline items found for today (${todayDateKey}).`);
      this.timelineItems = [];
      this.showStartTime = now;
      this.showTime = getStationTimeOfDaySeconds(now, stationTimeZone);
      return;
    }

    console.log(`[Station ${this.stationId}] Found ${todayItems.length} timeline items for today (${todayDateKey})`);

    this.showStartTime = now;
    
    // Calculate current time of day in seconds (e.g., 6:00 PM = 18*3600 = 64800 seconds)
    // This ensures the stream plays from the correct position based on the current time
    const currentTimeOfDay = getStationTimeOfDaySeconds(now, stationTimeZone);
    this.showTime = currentTimeOfDay;
    
    // Get hostId from the default show for advertisements/news
    const hostId = defaultShow?.hostId || null;

    // Enhance show items with their actual content data (audioUrl, title, etc.)
    const enrichedItems = await this.enrichShowItems(todayItems, hostId);
    
    // Calculate the final timeline layout
    this.timelineItems = this.calculateTimelineLayout(enrichedItems);

    this.evictFinishedAudioFromCache();

    console.log(`[Station ${this.stationId}] Loaded ${this.timelineItems.length} valid items for today. Stream synchronized to start of day.`);
  }

  // Decoded PCM is ~10MB per minute of audio; drop tracks that already finished
  // so a full broadcast day cannot exhaust server memory.
  private evictFinishedAudioFromCache() {
    if (this.audioCache.size === 0) return;
    const graceSeconds = 60;
    const stillNeeded = new Set<string>();
    for (const item of this.timelineItems) {
      if (item.audioUrl && item.calculatedEndTime >= this.showTime - graceSeconds) {
        stillNeeded.add(item.audioUrl);
      }
    }
    for (const url of this.audioCache.keys()) {
      if (!stillNeeded.has(url) && !this.audioLoadPromises.has(url)) {
        this.audioCache.delete(url);
      }
    }
  }

  // Latest processed file per item, refreshed asynchronously. The old
  // implementation ran a synchronous readdir of uploads/processed for EVERY
  // track on EVERY timeline reload (hundreds of blocking filesystem calls
  // every 10 seconds) and again on every 100ms audio tick — enough event-loop
  // stalling to make the broadcast stutter.
  private processedFilesByItemId = new Map<number, string>();
  private processedFilesSignature = '';

  private async refreshProcessedFilesCache(): Promise<void> {
    try {
      const processedDir = path.join(process.cwd(), 'uploads', 'processed');
      let files: string[] = [];
      try {
        files = await fs.promises.readdir(processedDir);
      } catch {
        files = []; // Directory may not exist yet
      }
      const newest = new Map<number, { file: string; ts: number }>();
      for (const file of files) {
        const idMatch = file.match(/^processed_item_(\d+)_/);
        if (!idMatch || !file.endsWith('.mp3')) continue;
        const itemId = parseInt(idMatch[1], 10);
        const ts = parseInt(file.match(/_(\d+)\.mp3$/)?.[1] || '0', 10);
        const existing = newest.get(itemId);
        if (!existing || ts > existing.ts) newest.set(itemId, { file, ts });
      }
      const next = new Map<number, string>();
      for (const [itemId, entry] of newest) next.set(itemId, entry.file);
      this.processedFilesByItemId = next;
      this.processedFilesSignature = [...next.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([id, file]) => `${id}:${file}`)
        .join('|');
    } catch (error) {
      console.error(`[Station ${this.stationId}] Failed to refresh processed audio cache:`, error);
    }
  }

  // Check for processed audio file for an item (pure in-memory lookup)
  private getProcessedAudioUrl(itemId: number, originalUrl: string | null): string | null {
    if (!originalUrl) return null;
    const latestFile = this.processedFilesByItemId.get(itemId);
    if (!latestFile) return null;
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    return `${baseUrl}/api/uploads/processed/${latestFile}`;
  }

  // Takes raw show_items and queries the correct content tables to get necessary details
  private async enrichShowItems(items: any[], hostId: number | null): Promise<Partial<TimelineItem>[]> {
      const enriched = await Promise.all(items.map(async (item) => {
          let content: any = null;
          switch (item.contentType) {
              case ContentType.TRACK:
                  const track = await prisma.track.findUnique({
                    where: { id: item.contentId },
                    select: { title: true, url: true, duration: true }
                  });
                  
                  // Check if this track has overlay items (items with parentItemId = this item.id)
                  const hasOverlays = items.some(otherItem => otherItem.parentItemId === item.id);
                  
                  // If track has overlays, MUST use processed audio (it should have been created when item was updated)
                  // If no processed audio exists but overlays exist, log a warning
                  const processedUrl = this.getProcessedAudioUrl(item.id, track?.url || null);
                  
                  if (hasOverlays) {
                    if (processedUrl) {
                      console.log(`[Station ${this.stationId}] ✅ Track "${track?.title}" (id: ${item.id}) has overlays - using processed audio: ${processedUrl}`);
                      content = { 
                        title: track?.title, 
                        audioUrl: processedUrl, // Use processed audio when overlays exist
                        duration: track?.duration 
                      };
                    } else {
                      console.warn(`[Station ${this.stationId}] ⚠️ Track "${track?.title}" (id: ${item.id}) has overlays but no processed audio found! Using original audio (overlays won't be mixed).`);
                      content = { 
                        title: track?.title, 
                        audioUrl: track?.url, // Fallback to original if processed not found
                        duration: track?.duration 
                      };
                    }
                  } else {
                    // No overlays - use processed if available, otherwise original
                    content = { 
                      title: track?.title, 
                      audioUrl: processedUrl || track?.url, 
                      duration: track?.duration 
                    };
                  }
                  break;
              case ContentType.TALK:
                  const talk = await prisma.talk.findUnique({
                    where: { id: item.contentId },
                    select: { title: true, audioUrl: true, duration: true }
                  });
                  content = { title: talk?.title, audioUrl: talk?.audioUrl, duration: talk?.duration };
                  break;
              case ContentType.HOST_COMMENTARY:
                  const hc = await prisma.hostCommentary.findUnique({
                    where: { id: item.contentId },
                    select: { title: true, audioUrl: true, duration: true }
                  });
                  content = { title: hc?.title, audioUrl: hc?.audioUrl, duration: hc?.duration };
                  break;
              case ContentType.ADVERTISEMENT:
                  // First check if it's a product with audioUrl
                  const product = await prisma.product.findUnique({
                    where: { id: item.contentId },
                    select: { name: true, audioUrl: true, duration: true }
                  });
                  
                  if (product && product.audioUrl) {
                    // It's a product with audio - use product audio
                    content = { title: product.name, audioUrl: product.audioUrl, duration: product.duration || 30 };
                  } else if (hostId) {
                    // It's a regular advertisement - check for host audio
                    const adAudio = await prisma.advertisementHostAudio.findFirst({
                      where: {
                        advertisementId: item.contentId,
                        hostId: hostId,
                      },
                    });
                    const ad = await prisma.advertisement.findUnique({
                      where: { id: item.contentId },
                      select: { title: true }
                    });
                    
                    // Get actual duration from audio file if stored duration is missing
                    let duration = adAudio?.duration;
                    if ((!duration || duration === 0) && adAudio?.audioUrl) {
                      const { getAudioFileDuration } = await import('./utils/audioProcessor');
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
                          console.log(`[Station ${this.stationId}] Updated advertisement duration for item ${item.id}: ${actualDuration}s`);
                        } catch (err) {
                          console.error('Failed to update advertisement duration:', err);
                        }
                      }
                    }
                    
                    content = { title: ad?.title || null, audioUrl: adAudio?.audioUrl || null, duration: duration || null };
                  }
                  break;
              case ContentType.NEWS:
                  if (hostId) {
                    const newsAudio = await prisma.newsHostAudio.findFirst({
                      where: {
                        newsId: item.contentId,
                        hostId: hostId,
                      },
                    });
                    const news = await prisma.news.findUnique({
                      where: { id: item.contentId },
                      select: { title: true }
                    });
                    content = { title: news?.title || null, audioUrl: newsAudio?.audioUrl || null, duration: newsAudio?.duration || null };
                  }
                  break;
          }
          if (content && content.audioUrl) {
              // Include all item properties including parentItemId, startTimeInParent, and duckingVolume
              return { 
                ...item, 
                audioUrl: content.audioUrl, 
                contentTitle: content.title || 'Untitled', 
                baseDuration: content.duration,
                parentItemId: item.parentItemId || null,
                startTimeInParent: item.startTimeInParent || null,
                duckingVolume: item.duckingVolume !== undefined && item.duckingVolume !== null ? item.duckingVolume : null,
              };
          }
          // Even if no audio, return overlay items so they can be tracked (they might have audio later)
          if (item.parentItemId) {
            return {
              ...item,
              audioUrl: null,
              contentTitle: 'Untitled Overlay',
              baseDuration: 30,
              parentItemId: item.parentItemId,
              startTimeInParent: item.startTimeInParent || null,
              duckingVolume: item.duckingVolume || null,
            };
          }
          return null;
      }));
      return enriched.filter(Boolean) as Partial<TimelineItem>[];
  }
  
  // Replicates the layout logic from your React component
  private calculateTimelineLayout(items: Partial<TimelineItem>[]): TimelineItem[] {
      const finalItems: TimelineItem[] = [];
      const layerEndTimes: Map<number, number> = new Map();

      // Sort by position first to establish a baseline order
      // But also ensure parent items come before their overlay items
      const sortedItems = [...items].sort((a, b) => {
          // If one is a parent of the other, parent comes first
          if (a.id === b.parentItemId) return -1;
          if (b.id === a.parentItemId) return 1;
          // Otherwise sort by position
          return (a.position || 0) - (b.position || 0);
      });

      for (const item of sortedItems) {
          // playbackStartTime and playbackEndTime are stored in milliseconds, convert to seconds
          const startTrim = (item.playbackStartTime || 0) / 1000;
          const endTrim = item.playbackEndTime ? (item.playbackEndTime / 1000) : (item.baseDuration || 180); // Use fetched duration, fallback to 180s
          const duration = Math.max(1, endTrim - startTrim);

          let startTime: number;
          let layer = 0;
          
          // Handle overlay items (items with parentItemId) - these overlay on top of parent tracks
          if (item.parentItemId) {
              // This is an overlay - find parent and position relative to it
              const parent = finalItems.find(i => i.id === item.parentItemId);
              if (parent) {
                  startTime = parent.calculatedStartTime + (item.startTimeInParent || 0);
                  layer = parent.layer + 1;
              } else {
                  // Parent not found yet, treat as overlay with explicit time
                  startTime = item.startTimeOffset || 0;
                  layer = 1;
              }
          } else if (item.mixMode === 'overlay') {
              startTime = item.startTimeOffset || 0;
              // Find the first available layer at this start time to avoid collisions
              while(true) {
                  const hasConflict = finalItems.some(i => i.layer === layer && startTime < i.calculatedEndTime && (startTime + duration) > i.calculatedStartTime);
                  if (!hasConflict) break;
                  layer++;
              }
          } else { 
              // For sequential items, use startTimeOffset directly (it's already set correctly in the database)
              // This ensures items play at the exact time specified, not just sequentially
              startTime = item.startTimeOffset || 0;
              layer = 0;
          }

          const finalItem: TimelineItem = {
              ...(item as DBShowItem),
              audioUrl: item.audioUrl!,
              contentTitle: item.contentTitle!,
              baseDuration: item.baseDuration!,
              duration,
              layer,
              calculatedStartTime: startTime,
              calculatedEndTime: startTime + duration,
          };
          finalItems.push(finalItem);
      }
      return finalItems;
  }
  
  // Utility to close connections with an error message
  private broadcastError(message: string) {
      for (const client of this.httpClients.values()) {
          try {
            if (!client.response.headersSent) {
                client.response.status(500).json({ error: message });
            } else {
                client.response.end();
            }
          } catch {}
      }
      this.httpClients.clear();
  }
}

// =================================================================
// Global Streamer Management & Express Server
// =================================================================
export const streamers = new Map<string, RadioStreamer>();

// Track active website listeners (not just HTTP stream connections)
interface ActiveListener {
  id: string;
  lastPing: number;
  isPlaying: boolean;
  ip?: string;
  geo?: ListenerGeo | null; // undefined = lookup pending, null = unresolvable
}

export const activeWebsiteListeners = new Map<string, ActiveListener>();

// Clean up inactive listeners (no ping in last 10 seconds)
setInterval(() => {
  const now = Date.now();
  const timeout = 10000; // 10 seconds
  for (const [id, listener] of activeWebsiteListeners.entries()) {
    if (now - listener.lastPing > timeout) {
      activeWebsiteListeners.delete(id);
    }
  }
}, 5000); // Check every 5 seconds

// Stream endpoint - simplified, no station required, just plays today's playlist
app.get('/stream', async (req: Request, res: Response) => {
  // Use a default streamer key (station ID 1) - we only have one radio now
  const streamerKey = '1';

  try {
    let streamer = streamers.get(streamerKey);
    if (!streamer) {
      streamer = new RadioStreamer(streamerKey);
      streamers.set(streamerKey, streamer);
    }

    // Add this client to the streamer
    streamer.addHttpClient(res, getClientIp(req));

    // Handle client disconnect
    req.on('close', () => {
      // Find and remove the client
      const httpClients = (streamer as any).httpClients;
      if (httpClients) {
        for (const [clientId, client] of httpClients.entries()) {
          if ((client as HttpClient).response === res) {
            streamer.removeHttpClient(clientId);
            break;
          }
        }
      }
    });

  } catch (error) {
    console.error("High-level server error:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Debug endpoint to check stream status and overlay detection
app.get('/api/stream/debug', async (req: Request, res: Response) => {
  try {
    const streamerKey = '1';
    const streamer = streamers.get(streamerKey) as RadioStreamer;
    
    if (!streamer) {
      return res.json({ error: 'Streamer not initialized' });
    }
    
    const showTime = (streamer as any).showTime || 0;
    const timelineItems = (streamer as any).timelineItems || [];
    const audioCache = (streamer as any).audioCache as Map<string, Int16Array> | undefined;
    const audioLoadPromises = (streamer as any).audioLoadPromises as Map<string, Promise<Int16Array | null>> | undefined;
    
    // Find active items
    const activeItems = timelineItems.filter((item: any) => 
      showTime >= item.calculatedStartTime && showTime < item.calculatedEndTime
    );
    
    const parentItems = activeItems.filter((item: any) => !item.parentItemId);
    const trackItems = parentItems.filter((item: any) => item.contentType === "TRACK");
    const explicitOverlays = activeItems.filter((item: any) => item.parentItemId);
    
    const implicitOverlays = parentItems.filter((item: any) => {
      if (item.parentItemId) return false;
      if (item.contentType === "TRACK") return false;
      return trackItems.some((track: any) => 
        track.id !== item.id &&
        item.calculatedStartTime >= track.calculatedStartTime &&
        item.calculatedStartTime < track.calculatedEndTime
      );
    });
    
    const overlayItems = [...explicitOverlays, ...implicitOverlays];
    
    // Check for active overlays for each parent
    const parentWithOverlays = parentItems.map((item: any) => {
      const activeOverlays = overlayItems.filter((overlay: any) => {
        if (overlay.parentItemId != null) {
          return Number(overlay.parentItemId) === Number(item.id);
        } else {
          return item.contentType === "TRACK" &&
            overlay.calculatedStartTime >= item.calculatedStartTime &&
            overlay.calculatedStartTime < item.calculatedEndTime &&
            showTime >= overlay.calculatedStartTime &&
            showTime < overlay.calculatedEndTime;
        }
      });
      
      return {
        ...item,
        activeOverlays: activeOverlays.map((o: any) => ({
          id: o.id,
          title: o.contentTitle,
          contentType: o.contentType,
          audioUrl: o.audioUrl ? 'yes' : 'NO',
          duckingVolume: o.duckingVolume,
          time: `${o.calculatedStartTime.toFixed(1)}s-${o.calculatedEndTime.toFixed(1)}s`
        }))
      };
    });
    
    res.json({
      showTime: showTime.toFixed(1),
      currentTime: new Date().toISOString(),
      audioCacheSize: audioCache?.size || 0,
      audioLoadsInProgress: audioLoadPromises?.size || 0,
      activeItems: activeItems.length,
      parentItems: parentItems.length,
      trackItems: trackItems.length,
      explicitOverlays: explicitOverlays.length,
      implicitOverlays: implicitOverlays.length,
      totalOverlays: overlayItems.length,
      parents: parentWithOverlays.map((p: any) => ({
        id: p.id,
        title: p.contentTitle,
        contentType: p.contentType,
        time: `${p.calculatedStartTime.toFixed(1)}s-${p.calculatedEndTime.toFixed(1)}s`,
        audioUrl: p.audioUrl ? 'yes' : 'NO',
        audioCached: Boolean(p.audioUrl && audioCache?.get(p.audioUrl)?.length),
        audioLoading: Boolean(p.audioUrl && audioLoadPromises?.has(p.audioUrl)),
        activeOverlays: p.activeOverlays
      })),
      allOverlays: overlayItems.map((o: any) => ({
        id: o.id,
        title: o.contentTitle,
        type: o.parentItemId ? 'explicit' : 'implicit',
        contentType: o.contentType,
        audioUrl: o.audioUrl ? 'yes' : 'NO',
        time: `${o.calculatedStartTime.toFixed(1)}s-${o.calculatedEndTime.toFixed(1)}s`,
        isActive: showTime >= o.calculatedStartTime && showTime < o.calculatedEndTime
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Now-playing endpoint for Flutter app (same backend as website – shared stream + database)
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;
app.get('/api/now-playing', async (req: Request, res: Response) => {
  try {
    const streamUrl = `${API_BASE_URL}/stream`;
    const currentRes = await fetch(`${API_BASE_URL}/api/stream/current`);
    const data = currentRes.ok ? (await currentRes.json()) as { playing?: boolean; current?: { title?: string; url?: string }; next?: { title?: string }; message?: string } : null;
    const playing = data?.playing === true && Boolean(data.current?.url);
    const title = data?.current?.title ?? 'Live';
    const subtitle = data?.next?.title ?? (playing ? null : data?.message ?? null);
    res.json({
      hasBroadcast: playing,
      streamUrl: playing ? streamUrl : undefined,
      title: playing ? title : 'Live',
      subtitle: subtitle || undefined,
    });
  } catch (error: any) {
    console.error('Error in /api/now-playing:', error);
    res.json({
      hasBroadcast: false,
      streamUrl: undefined,
      title: 'Live',
      subtitle: 'Unable to confirm current broadcast.',
    });
  }
});

// Start server – bind to 0.0.0.0 so Android emulator (10.0.2.2) and LAN devices can connect
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Radio Stream Server running on port ${PORT}`);
  console.log(`Stream endpoint: http://localhost:${PORT}/stream`);
  console.log(`API endpoint: http://localhost:${PORT}/api`);
  console.log(`From emulator/other device: use this machine's IP (e.g. http://192.168.x.x:${PORT})`);

  // Boot the broadcast engine immediately: the station is always on air, so
  // listeners join the running stream instantly instead of triggering a cold
  // start (schedule load + decode) on first connect.
  const bootStreamer = new RadioStreamer('1');
  streamers.set('1', bootStreamer);
  bootStreamer.ensureStarted();
});
