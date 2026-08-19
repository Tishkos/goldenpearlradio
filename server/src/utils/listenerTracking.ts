import crypto from 'crypto';
import { prisma } from '../../../lib/prisma';

// Persists who listened, for how long, and to what — so the admin map can look
// back over 24 hours, 7 days or the current month instead of only showing the
// handful of sockets that happen to be open right now.

export interface ListenerGeo {
  country: string; // ISO country code, e.g. "AE"
  city: string;
  lat: number;
  lon: number;
}

export interface NowPlayingItem {
  showItemId: number | null;
  contentType: string | null;
  contentId: number | null;
  title: string;
  artist: string | null;
}

const HASH_SALT = process.env.LISTENER_HASH_SALT || 'golden-pearl-radio-listener-v1';
const TICK_MS = 10_000;
// A browser that reconnects (watchdog rejoin, behind-live-edge rejoin, a short
// network drop) must not read as a brand-new listener, or one person's evening
// becomes dozens of 40-second sessions on the map.
const RESUME_WINDOW_MS = 90_000;
// Drive-by connections (scanners, players that probe and leave) never reach the
// database; they would otherwise dominate the location counts.
const MIN_PERSISTED_SECONDS = 5;
// A single tick must never credit more than this, so an event-loop stall or a
// suspended process cannot inflate somebody's listening time.
const MAX_CREDIT_PER_TICK_S = 60;
const RETENTION_DAYS = 120;

/** Stable pseudonym for an IP — the raw address is never stored. */
export function hashListener(ip: string): string {
  return crypto.createHash('sha256').update(`${HASH_SALT}:${ip}`).digest('hex').slice(0, 32);
}

interface TrackedPlay {
  rowId: number | null;
  signature: string;
  showItemId: number | null;
  contentType: string | null;
  contentId: number | null;
  title: string;
  artist: string | null;
  startedAt: number;
  lastSeenAt: number;
  seconds: number;
  dirty: boolean;
}

interface TrackedSession {
  id: string;
  listenerHash: string;
  source: string;
  geo: ListenerGeo | null | undefined; // undefined = lookup still pending
  startedAt: number;
  lastSeenAt: number;
  endedAt: number | null;
  seconds: number;
  clients: Set<string>;
  lastCreditAt: number;
  idleSince: number | null;
  created: boolean;
  dirty: boolean;
  finalized: boolean;
  plays: TrackedPlay[];
}

const sessions = new Map<string, TrackedSession>();
const clientToSession = new Map<string, string>();
// Newest live-or-recently-idle session per listener, for reconnect merging
const sessionByHash = new Map<string, string>();

let nowPlayingResolver: (() => NowPlayingItem | null) | null = null;
let ticker: NodeJS.Timeout | null = null;
let flushing = false;
let lastFlushError = 0;

export function setNowPlayingResolver(resolver: () => NowPlayingItem | null) {
  nowPlayingResolver = resolver;
}

function playSignature(item: NowPlayingItem): string {
  return `${item.showItemId ?? 'x'}|${item.contentType ?? 'x'}|${item.contentId ?? 'x'}|${item.title}`;
}

function creditSession(session: TrackedSession, now: number, nowPlaying: NowPlayingItem | null) {
  const elapsed = Math.min(Math.max((now - session.lastCreditAt) / 1000, 0), MAX_CREDIT_PER_TICK_S);
  session.lastCreditAt = now;
  if (elapsed <= 0) return;

  session.seconds += elapsed;
  session.lastSeenAt = now;
  session.dirty = true;

  if (!nowPlaying || !nowPlaying.title) return;
  const signature = playSignature(nowPlaying);
  let current = session.plays[session.plays.length - 1];
  if (!current || current.signature !== signature) {
    current = {
      rowId: null,
      signature,
      showItemId: nowPlaying.showItemId,
      contentType: nowPlaying.contentType,
      contentId: nowPlaying.contentId,
      title: nowPlaying.title,
      artist: nowPlaying.artist,
      startedAt: now,
      lastSeenAt: now,
      seconds: 0,
      dirty: true,
    };
    session.plays.push(current);
  }
  current.seconds += elapsed;
  current.lastSeenAt = now;
  current.dirty = true;
}

/**
 * A listener opened /stream. Reuses the listener's existing session when this
 * is a reconnect, so one person stays one session.
 */
export function attachListener(
  clientKey: string,
  opts: { ip?: string; source?: string; geo?: ListenerGeo | null }
): void {
  if (!opts.ip) return; // no IP => nothing we can attribute or place on a map
  const now = Date.now();
  const listenerHash = hashListener(opts.ip);

  const existingId = sessionByHash.get(listenerHash);
  const existing = existingId ? sessions.get(existingId) : undefined;
  if (existing && !existing.finalized && now - (existing.idleSince ?? now) <= RESUME_WINDOW_MS) {
    existing.clients.add(clientKey);
    existing.idleSince = null;
    existing.endedAt = null;
    existing.lastCreditAt = now;
    existing.lastSeenAt = now;
    existing.dirty = true;
    if (opts.geo !== undefined && existing.geo == null) existing.geo = opts.geo;
    clientToSession.set(clientKey, existing.id);
    return;
  }

  const session: TrackedSession = {
    id: crypto.randomUUID(),
    listenerHash,
    source: opts.source || 'stream',
    geo: opts.geo,
    startedAt: now,
    lastSeenAt: now,
    endedAt: null,
    seconds: 0,
    clients: new Set([clientKey]),
    lastCreditAt: now,
    idleSince: null,
    created: false,
    dirty: true,
    finalized: false,
    plays: [],
  };
  sessions.set(session.id, session);
  clientToSession.set(clientKey, session.id);
  sessionByHash.set(listenerHash, session.id);
}

/** Geo lookups resolve after the socket is already streaming. */
export function setListenerGeo(clientKey: string, geo: ListenerGeo | null): void {
  const sessionId = clientToSession.get(clientKey);
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session) return;
  session.geo = geo;
  session.dirty = true;
}

/** The listener's socket closed. The session stays resumable for a short while. */
export function detachListener(clientKey: string): void {
  const sessionId = clientToSession.get(clientKey);
  clientToSession.delete(clientKey);
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session) return;
  session.clients.delete(clientKey);
  if (session.clients.size > 0) return;
  const now = Date.now();
  creditSession(session, now, nowPlayingResolver?.() ?? null);
  session.idleSince = now;
  session.dirty = true;
}

export interface LiveSessionSnapshot {
  id: string;
  listenerHash: string;
  geo: ListenerGeo | null | undefined;
  seconds: number;
  startedAt: number;
}

/** Sessions currently on air, for the live map. */
export function getLiveSessions(): LiveSessionSnapshot[] {
  const live: LiveSessionSnapshot[] = [];
  for (const session of sessions.values()) {
    if (session.clients.size === 0) continue;
    live.push({
      id: session.id,
      listenerHash: session.listenerHash,
      geo: session.geo,
      seconds: Math.round(session.seconds),
      startedAt: session.startedAt,
    });
  }
  return live;
}

async function persistSession(session: TrackedSession): Promise<void> {
  const seconds = Math.round(session.seconds);
  const ended = session.finalized ? new Date(session.endedAt ?? session.lastSeenAt) : null;

  if (!session.created) {
    if (seconds < MIN_PERSISTED_SECONDS) return;
    await prisma.listenerSession.create({
      data: {
        id: session.id,
        listenerHash: session.listenerHash,
        source: session.source,
        country: session.geo?.country ?? null,
        city: session.geo?.city ?? null,
        lat: session.geo?.lat ?? null,
        lon: session.geo?.lon ?? null,
        startedAt: new Date(session.startedAt),
        lastSeenAt: new Date(session.lastSeenAt),
        endedAt: ended,
        seconds,
      },
    });
    session.created = true;
  } else {
    await prisma.listenerSession.update({
      where: { id: session.id },
      data: {
        country: session.geo?.country ?? null,
        city: session.geo?.city ?? null,
        lat: session.geo?.lat ?? null,
        lon: session.geo?.lon ?? null,
        lastSeenAt: new Date(session.lastSeenAt),
        endedAt: ended,
        seconds,
      },
    });
  }

  for (const play of session.plays) {
    if (!play.dirty) continue;
    const playSeconds = Math.round(play.seconds);
    if (play.rowId === null) {
      if (playSeconds < 1) continue;
      const row = await prisma.listenerPlay.create({
        data: {
          sessionId: session.id,
          showItemId: play.showItemId,
          contentType: play.contentType,
          contentId: play.contentId,
          title: play.title,
          artist: play.artist,
          startedAt: new Date(play.startedAt),
          lastSeenAt: new Date(play.lastSeenAt),
          seconds: playSeconds,
        },
      });
      play.rowId = row.id;
    } else {
      await prisma.listenerPlay.update({
        where: { id: play.rowId },
        data: { lastSeenAt: new Date(play.lastSeenAt), seconds: playSeconds },
      });
    }
    play.dirty = false;
  }

  // Keep only the item still playing; earlier ones are safely in the database
  if (session.plays.length > 1) {
    session.plays = [session.plays[session.plays.length - 1]];
  }
  session.dirty = false;
}

async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (const session of [...sessions.values()]) {
      if (session.dirty) {
        try {
          await persistSession(session);
        } catch (error) {
          // A database blip must not take the broadcast down; retry next tick.
          const now = Date.now();
          if (now - lastFlushError > 60_000) {
            lastFlushError = now;
            console.error('[listeners] Failed to persist listener session:', error);
          }
          continue;
        }
      }
      if (session.finalized) {
        sessions.delete(session.id);
        if (sessionByHash.get(session.listenerHash) === session.id) {
          sessionByHash.delete(session.listenerHash);
        }
      }
    }
  } finally {
    flushing = false;
  }
}

function tick(): void {
  const now = Date.now();
  const nowPlaying = nowPlayingResolver?.() ?? null;

  for (const session of sessions.values()) {
    if (session.finalized) continue;
    if (session.clients.size > 0) {
      creditSession(session, now, nowPlaying);
      continue;
    }
    // Idle past the reconnect grace period — this listener really did leave
    if (session.idleSince !== null && now - session.idleSince > RESUME_WINDOW_MS) {
      session.endedAt = session.idleSince;
      session.finalized = true;
      session.dirty = true;
    }
  }

  void flush();
}

/**
 * Closes sessions the previous process left open (a restart kills every socket
 * without a chance to write endedAt) and drops history past the retention window.
 */
async function reconcileOnBoot(): Promise<void> {
  try {
    const orphanCutoff = new Date(Date.now() - RESUME_WINDOW_MS);
    const orphans = await prisma.listenerSession.findMany({
      where: { endedAt: null, lastSeenAt: { lt: orphanCutoff } },
      select: { id: true, lastSeenAt: true },
      take: 5000,
    });
    for (const orphan of orphans) {
      await prisma.listenerSession.update({
        where: { id: orphan.id },
        data: { endedAt: orphan.lastSeenAt },
      });
    }
    if (orphans.length > 0) {
      console.log(`[listeners] Closed ${orphans.length} session(s) left open by a previous run`);
    }
  } catch (error) {
    console.error('[listeners] Boot reconcile failed:', error);
  }
}

async function purgeOldHistory(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const removed = await prisma.listenerSession.deleteMany({ where: { startedAt: { lt: cutoff } } });
    if (removed.count > 0) {
      console.log(`[listeners] Purged ${removed.count} session(s) older than ${RETENTION_DAYS} days`);
    }
  } catch (error) {
    console.error('[listeners] History purge failed:', error);
  }
}

export function startListenerTracking(): void {
  if (ticker) return;
  ticker = setInterval(tick, TICK_MS);
  ticker.unref?.();
  void reconcileOnBoot();
  void purgeOldHistory();
  const purgeTimer = setInterval(() => void purgeOldHistory(), 6 * 60 * 60 * 1000);
  purgeTimer.unref?.();
}
