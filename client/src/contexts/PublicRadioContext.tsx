import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, getAuthToken } from "@/lib/api-client";
import { subscribeToRadioTimelineSync } from "@/lib/radio-timeline-sync";
import { useAudioPlayback, useListenerTracking, useBackgroundPlayback, useAutoPlayback } from "@/pages/home/hooks";
import { API_ENDPOINTS, POLLING_INTERVALS, QUERY_KEYS } from "@/pages/home/constants";
import type { Advertisement, HostCommentary, News, Product, ShowItem, Talk, Track } from "@/types/api-models";

interface StreamCurrentResponse {
  playing: boolean;
  current: {
    id: number;
    title: string;
    url: string;
    audioFilePosition: number;
    contentType?: string;
    contentId?: number;
    productId?: number | null;
  } | null;
  scheduledCurrent?: {
    id: number;
    title: string;
    url?: string | null;
    hasAudio?: boolean;
    contentType?: string;
    contentId?: number;
    productId?: number | null;
  } | null;
  overlay?: {
    id: number;
    title: string;
    contentType?: string;
    contentId?: number;
    productId?: number | null;
  } | null;
  next: {
    id: number;
    title: string;
    url?: string;
    startTime: number;
    productId?: number | null;
  } | null;
  currentTime?: number;
  debug?: {
    stationTimeZone?: string;
    dateKey?: string;
    currentTimeHms?: string;
    totalTimelineItems?: number;
    playableItems?: number;
    currentWindowHms?: string | null;
    scheduledCurrentId?: number | null;
    nextStartHms?: string | null;
    resolutionSource?: "stream-server" | "timeline-fallback";
    aroundNow?: Array<{
      id: number;
      title: string;
      contentType?: string;
      startTime?: number;
      endTime?: number;
      startTimeHms?: string;
      endTimeHms?: string;
    }>;
  };
}

type ResolvedTimelineItem = {
  id: number;
  title: string | null;
  url: string | null;
  startTime: number;
  endTime: number;
  audioFilePositionBase: number;
  contentType: ShowItem["contentType"];
  contentId: number;
  productId: number | null;
};

type PlayableTimelineItem = ResolvedTimelineItem & {
  title: string;
  url: string;
};

type RadioState = "loading" | "live" | "offline" | "empty" | "error";

type AdvertisementHostAudioRecord = {
  id: number;
  advertisementId: number;
  audioUrl: string;
  duration?: number | null;
  advertisement?: Advertisement | null;
};

interface PublicRadioContextValue {
  currentSong: StreamCurrentResponse | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: Date;
  currentListeners: number;
  radioState: RadioState;
  hasPlayableContent: boolean;
  setVolume: (value: number) => void;
  setIsMuted: (value: boolean) => void;
  togglePlayPause: () => void;
}

const PublicRadioContext = createContext<PublicRadioContextValue | null>(null);

export function PublicRadioProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);
  const isPublicRoute =
    !location.startsWith("/admin") &&
    location !== "/login" &&
    location !== "/signup" &&
    location !== "/reset-password";

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [allowPublicTimelineRequests, setAllowPublicTimelineRequests] = useState(true);
  const [allowPublicCatalogRequests, setAllowPublicCatalogRequests] = useState(true);
  const stationTimeZone = "Europe/Budapest";
  const publicRadioFallbackRequested = String(import.meta.env.VITE_ENABLE_PUBLIC_RADIO_FALLBACK || "").toLowerCase() === "true";
  const enableProtectedPublicFallback = publicRadioFallbackRequested || Boolean(getAuthToken());

  const isUnauthorizedError = useCallback((error: unknown) => {
    const message = String((error as any)?.message || "").toLowerCase();
    return (
      message.includes("401") ||
      message.includes("unauthorized") ||
      message.includes("authentication failed") ||
      message.includes("no token provided") ||
      message.includes("forbidden")
    );
  }, []);

  const getStationParts = useCallback((date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: stationTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const map: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== "literal") map[part.type] = part.value;
    }

    return {
      year: map.year,
      month: map.month,
      day: map.day,
      hour: Number(map.hour),
      minute: Number(map.minute),
      second: Number(map.second),
    };
  }, []);

  const formatHms = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, []);

  const stationNowParts = getStationParts(currentTime);
  const stationDateKey = `${stationNowParts.year}-${stationNowParts.month}-${stationNowParts.day}`;
  const stationCurrentSeconds =
    stationNowParts.hour * 3600 + stationNowParts.minute * 60 + stationNowParts.second;

  const resolveStreamUrl = useCallback((rawUrl?: string | null) => {
    if (!rawUrl) return null;
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    const streamServerUrl = import.meta.env.VITE_STREAM_SERVER_URL || "http://127.0.0.1:3001";
    return `${streamServerUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  }, []);

  // The website plays the server's continuous live broadcast (/stream): one
  // ffmpeg-mixed MP3 stream, identical and synchronized for every listener,
  // driven by the radio editor timeline. The metadata endpoints below are only
  // used to display what is on air — never to drive playback position.
  const liveStreamUrl = useMemo(() => {
    const base = import.meta.env.VITE_STREAM_SERVER_URL || "http://127.0.0.1:3001";
    return `${base.replace(/\/+$/, "")}/stream`;
  }, []);

  const userWantsPlaybackRef = useRef(true);
  const nextAutoConnectAttemptRef = useRef(0);
  const lastProgressRef = useRef<{ time: number; at: number }>({ time: 0, at: 0 });
  const reconnectTimerRef = useRef<number | null>(null);
  const missingLiveSinceRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const playback = useAudioPlayback(audioRef, audioContextRef);
  const setupUserInteractionListener = playback.setupUserInteractionListener;
  const playAudio = playback.play;
  const pauseAudio = playback.pause;
  const setAudioVolume = playback.setVolume;
  const setAudioMuted = playback.setMuted;
  useListenerTracking(isPlaying, api);

  useEffect(() => setupUserInteractionListener(), [setupUserInteractionListener]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), POLLING_INTERVALS.TIME_UPDATE);
    return () => clearInterval(timer);
  }, []);

  const { data: streamData, isLoading: streamLoading, error: streamError } = useQuery<StreamCurrentResponse>({
    queryKey: QUERY_KEYS.STREAM_CURRENT,
    queryFn: async () => {
      const streamServerUrl = import.meta.env.VITE_STREAM_SERVER_URL || "http://127.0.0.1:3001";
      const res = await fetch(`${streamServerUrl}${API_ENDPOINTS.STREAM_CURRENT}`);
      if (!res.ok) throw new Error("Failed to fetch stream");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data as StreamCurrentResponse | undefined;
      return data?.playing && isPlaying ? POLLING_INTERVALS.STREAM_ACTIVE : POLLING_INTERVALS.STREAM_INACTIVE;
    },
    enabled: isPublicRoute,
    refetchIntervalInBackground: true,
  });

  const { data: publicTimelineItems = [] } = useQuery<ShowItem[]>({
    queryKey: ["public-radio", "timeline-items", stationDateKey],
    queryFn: async () => {
      try {
        const data = await api.get<ShowItem[]>("/timeline-items", {
          params: { date: stationDateKey },
        });
        return data || [];
      } catch (error) {
        if (isUnauthorizedError(error)) {
          setAllowPublicTimelineRequests(false);
        }
        return [];
      }
    },
    enabled: isPublicRoute && enableProtectedPublicFallback && allowPublicTimelineRequests,
    refetchInterval: isPublicRoute ? POLLING_INTERVALS.STREAM_INACTIVE : false,
    refetchIntervalInBackground: true,
    staleTime: 2000,
    retry: false,
  });

  const { data: publicRadioCatalog } = useQuery<{
    tracks: Track[];
    talks: Talk[];
    advertisements: Advertisement[];
    products: Product[];
    news: News[];
    hostCommentaries: HostCommentary[];
    advertisementHostAudios: AdvertisementHostAudioRecord[];
  }>({
    queryKey: ["public-radio", "catalog"],
    queryFn: async () => {
      let shouldDisableCatalogRequests = false;

      const readOrEmpty = async <T,>(endpoint: string): Promise<T[]> => {
        try {
          const data = await api.get<T[]>(endpoint);
          return data || [];
        } catch (error) {
          if (isUnauthorizedError(error)) {
            shouldDisableCatalogRequests = true;
          }
          return [];
        }
      };

      const [tracks, talks, advertisements, products, news, hostCommentaries, advertisementHostAudios] = await Promise.all([
        readOrEmpty<Track>("/tracks"),
        readOrEmpty<Talk>("/talks"),
        readOrEmpty<Advertisement>("/advertisements"),
        readOrEmpty<Product>("/products"),
        readOrEmpty<News>("/news"),
        readOrEmpty<HostCommentary>("/host-commentaries"),
        readOrEmpty<AdvertisementHostAudioRecord>("/advertisement-host-audios"),
      ]);

      if (shouldDisableCatalogRequests) {
        setAllowPublicCatalogRequests(false);
      }

      return { tracks, talks, advertisements, products, news, hostCommentaries, advertisementHostAudios };
    },
    enabled: isPublicRoute && enableProtectedPublicFallback && allowPublicCatalogRequests,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: listenerData } = useQuery<{ count: number }>({
    queryKey: QUERY_KEYS.LISTENERS_CURRENT,
    queryFn: async () => {
      try {
        const data = await api.get<{ count: number }>(API_ENDPOINTS.LISTENERS_CURRENT);
        return data || { count: 0 };
      } catch {
        return { count: 0 };
      }
    },
    enabled: isPublicRoute,
    refetchInterval: isPublicRoute ? POLLING_INTERVALS.LISTENER_UPDATE : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!isPublicRoute) return;

    return subscribeToRadioTimelineSync((payload) => {
      if (payload.dateKey !== stationDateKey) return;

      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STREAM_CURRENT });
      void queryClient.invalidateQueries({ queryKey: ["public-radio", "timeline-items", stationDateKey] });
      void queryClient.refetchQueries({ queryKey: QUERY_KEYS.STREAM_CURRENT, type: "active" });
      void queryClient.refetchQueries({ queryKey: ["public-radio", "timeline-items", stationDateKey], type: "active" });
    });
  }, [isPublicRoute, queryClient, stationDateKey]);

  const fallbackStreamData = useMemo<StreamCurrentResponse | null>(() => {
    if (!isPublicRoute) return null;
    const nowParts = getStationParts(new Date());
    const stationCurrentSeconds =
      nowParts.hour * 3600 + nowParts.minute * 60 + nowParts.second;

    const tracksById = new Map((publicRadioCatalog?.tracks || []).map((track) => [Number(track.id), track]));
    const talksById = new Map((publicRadioCatalog?.talks || []).map((talk) => [Number(talk.id), talk]));
    const advertisementsById = new Map((publicRadioCatalog?.advertisements || []).map((ad) => [Number(ad.id), ad]));
    const productsById = new Map((publicRadioCatalog?.products || []).map((product) => [Number(product.id), product]));
    const newsById = new Map((publicRadioCatalog?.news || []).map((item) => [Number(item.id), item]));
    const hostCommentariesById = new Map((publicRadioCatalog?.hostCommentaries || []).map((item) => [Number(item.id), item]));
    const advertisementHostAudioByAdId = new Map<number, AdvertisementHostAudioRecord>();
    for (const hostAudio of publicRadioCatalog?.advertisementHostAudios || []) {
      const key = Number(hostAudio.advertisementId);
      if (!advertisementHostAudioByAdId.has(key)) {
        advertisementHostAudioByAdId.set(key, hostAudio);
      }
    }

    const resolvedTimelineItems: ResolvedTimelineItem[] = publicTimelineItems
      .map((item) => {
        let title: string | null = null;
        let audioUrl: string | null = null;
        let duration: number | null = null;
        let productId: number | null = null;

        if (item.contentType === "TRACK") {
          const track = tracksById.get(Number(item.contentId));
          title = track?.title || null;
          audioUrl = track?.url || null;
          duration = track?.duration || null;
        } else if (item.contentType === "TALK") {
          const talk = talksById.get(Number(item.contentId));
          title = talk?.title || null;
          audioUrl = talk?.audioUrl || null;
          duration = talk?.duration || null;
        } else if (item.contentType === "ADVERTISEMENT") {
          const directProduct = productsById.get(Number(item.contentId));
          if (directProduct?.audioUrl) {
            title = directProduct.name;
            audioUrl = directProduct.audioUrl;
            duration = directProduct.duration || null;
            productId = directProduct.id;
          } else {
            const ad = advertisementsById.get(Number(item.contentId));
            const linkedProduct = ad?.productId ? productsById.get(Number(ad.productId)) : null;
            const hostAudio = advertisementHostAudioByAdId.get(Number(item.contentId));
            title = ad?.title || linkedProduct?.name || null;
            audioUrl = hostAudio?.audioUrl || ad?.audioUrl || linkedProduct?.audioUrl || null;
            duration = hostAudio?.duration || ad?.duration || linkedProduct?.duration || null;
            productId = linkedProduct?.id || ad?.productId || null;
          }
        } else if (item.contentType === "NEWS") {
          const newsItem = newsById.get(Number(item.contentId));
          title = newsItem?.title || (newsItem as any)?.message || null;
          audioUrl = newsItem?.audioUrl || null;
          duration = (newsItem as any)?.duration || null;
        } else if (item.contentType === "HOST_COMMENTARY" || item.contentType === "COMMENTARY") {
          const commentary = hostCommentariesById.get(Number(item.contentId));
          title = commentary?.title || (commentary as any)?.script || null;
          audioUrl = commentary?.audioUrl || null;
          duration = commentary?.duration || null;
        }

        const playbackStartSeconds = (item.playbackStartTime || 0) / 1000;
        const inferredDuration =
          duration ??
          (item.contentType === "ADVERTISEMENT"
            ? 30
            : item.contentType === "NEWS"
              ? 60
              : item.contentType === "TALK"
                ? 300
                : item.contentType === "HOST_COMMENTARY" || item.contentType === "COMMENTARY"
                  ? 120
                  : 180);
        const playbackEndSeconds = item.playbackEndTime
          ? item.playbackEndTime / 1000
          : inferredDuration;
        const effectiveDuration = Math.max(1, playbackEndSeconds - playbackStartSeconds);
        const startTime = item.startTimeOffset || 0;
        const endTime = startTime + effectiveDuration;
        const resolvedUrl = resolveStreamUrl(audioUrl);

        return {
          id: item.id,
          title,
          url: resolvedUrl,
          startTime,
          endTime,
          audioFilePositionBase: playbackStartSeconds,
          contentType: item.contentType,
          contentId: item.contentId,
          productId,
        };
      })
      .sort((a, b) => a.startTime - b.startTime);

    const playableItems: PlayableTimelineItem[] = resolvedTimelineItems.filter(
      (item): item is PlayableTimelineItem => Boolean(item.title && item.url)
    );

    const currentScheduledItem =
      resolvedTimelineItems.find((item) => stationCurrentSeconds >= item.startTime && stationCurrentSeconds < item.endTime) || null;
    const currentItem =
      playableItems.find((item) => stationCurrentSeconds >= item.startTime && stationCurrentSeconds < item.endTime) || null;
    const nextItem = playableItems.find((item) => item.startTime > stationCurrentSeconds) || null;

    return {
      playing: Boolean(currentScheduledItem && currentItem && currentItem.id === currentScheduledItem.id),
      current: currentScheduledItem && currentItem && currentItem.id === currentScheduledItem.id
        ? {
            id: currentItem.id,
            title: currentItem.title,
            url: currentItem.url,
            audioFilePosition: currentItem.audioFilePositionBase + (stationCurrentSeconds - currentItem.startTime),
            contentType: currentItem.contentType,
            contentId: currentItem.contentId,
            productId: currentItem.productId,
          }
        : null,
      scheduledCurrent: currentScheduledItem
        ? {
            id: currentScheduledItem.id,
            title: currentScheduledItem.title || `Scheduled ${currentScheduledItem.contentType}`,
            url: currentScheduledItem.url,
            hasAudio: Boolean(currentScheduledItem.url),
            contentType: currentScheduledItem.contentType,
            contentId: currentScheduledItem.contentId,
            productId: currentScheduledItem.productId,
          }
        : null,
      overlay: null,
      next: nextItem
        ? {
            id: nextItem.id,
            title: nextItem.title,
            url: nextItem.url,
            startTime: nextItem.startTime,
            productId: nextItem.productId,
          }
        : null,
      currentTime: stationCurrentSeconds,
      debug: {
        stationTimeZone,
        dateKey: stationDateKey,
        currentTimeHms: formatHms(stationCurrentSeconds),
        totalTimelineItems: publicTimelineItems.length,
        playableItems: playableItems.length,
        currentWindowHms: currentScheduledItem ? `${formatHms(currentScheduledItem.startTime)} -> ${formatHms(currentScheduledItem.endTime)}` : null,
        scheduledCurrentId: currentScheduledItem?.id ?? null,
        nextStartHms: nextItem ? formatHms(nextItem.startTime) : null,
        resolutionSource: "timeline-fallback",
        aroundNow: resolvedTimelineItems
          .filter((item) => item.endTime >= stationCurrentSeconds - 900 && item.startTime <= stationCurrentSeconds + 900)
          .slice(0, 12)
          .map((item) => ({
            id: item.id,
            title: item.title || `Scheduled ${item.contentType}`,
            contentType: item.contentType,
            startTime: item.startTime,
            endTime: item.endTime,
            startTimeHms: formatHms(item.startTime),
            endTimeHms: formatHms(item.endTime),
          })),
      },
    };
  }, [
    formatHms,
    getStationParts,
    isPublicRoute,
    publicRadioCatalog?.advertisements,
    publicRadioCatalog?.advertisementHostAudios,
    publicRadioCatalog?.hostCommentaries,
    publicRadioCatalog?.news,
    publicRadioCatalog?.products,
    publicRadioCatalog?.talks,
    publicRadioCatalog?.tracks,
    publicTimelineItems,
    resolveStreamUrl,
    stationDateKey,
    stationTimeZone,
  ]);

  const effectiveStreamData = useMemo<StreamCurrentResponse | null>(() => {
    const normalizedServerData = streamData
      ? {
          ...streamData,
          scheduledCurrent: fallbackStreamData?.scheduledCurrent ?? null,
          debug: {
            ...streamData.debug,
            scheduledCurrentId: fallbackStreamData?.debug?.scheduledCurrentId ?? streamData.debug?.scheduledCurrentId ?? null,
            currentWindowHms: fallbackStreamData?.debug?.currentWindowHms ?? streamData.debug?.currentWindowHms ?? null,
            resolutionSource: "stream-server" as const,
          },
        }
      : null;

    const serverClockSkew =
      normalizedServerData?.currentTime != null
        ? Math.abs(normalizedServerData.currentTime - stationCurrentSeconds)
        : Number.POSITIVE_INFINITY;

    const scheduledCurrentId = fallbackStreamData?.debug?.scheduledCurrentId ?? null;
    const hasScheduledCurrentWindow = Boolean(scheduledCurrentId);

    // The stream server is the authority on what is *actually* playing — it is
    // the thing emitting the audio. The timeline fallback exists to cover the
    // server being unavailable or clearly wrong, not to overrule it.
    //
    // This distinction is what caused the label to stall at a track change. The
    // server advances the moment the next track starts, but the client's
    // scheduled window is computed from its own clock and the published
    // timeline, so for a few seconds either side of a boundary the two disagree
    // about which item is current. The previous logic treated any such
    // disagreement as "the server is wrong" and displayed the *scheduled* item —
    // which, at a boundary, is the track that has just finished. It corrected
    // itself once the window advanced, which is exactly why it looked
    // intermittent and why it always resolved on its own.
    //
    // A window mismatch is now no longer grounds on its own to override the
    // server. The genuine failure signals are kept: no current track, not
    // playing, no station timezone, or a clock more than 90s out.
    const serverIsTrustworthy =
      Boolean(normalizedServerData?.current) &&
      normalizedServerData?.playing === true &&
      Boolean(normalizedServerData?.debug?.stationTimeZone) &&
      serverClockSkew <= 90;

    const shouldPreferFallback = Boolean(fallbackStreamData?.current) && !serverIsTrustworthy;

    if (!enableProtectedPublicFallback) return normalizedServerData || null;
    if (!hasScheduledCurrentWindow) return fallbackStreamData;
    if (shouldPreferFallback) return fallbackStreamData;
    return normalizedServerData || fallbackStreamData || null;
  }, [enableProtectedPublicFallback, fallbackStreamData, stationCurrentSeconds, streamData]);

  const currentSong = effectiveStreamData ?? null;

  useBackgroundPlayback(isPlaying, currentSong?.playing ?? false);
  useAutoPlayback(isPlaying, currentSong?.playing ?? false, queryClient);

  useEffect(() => {
    if (isPublicRoute) return;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setIsPlaying(false);
  }, [isPublicRoute]);

  // Join the live broadcast at "now". The cache-buster guarantees the browser
  // opens a fresh connection instead of resuming a stale buffered position.
  const connectLiveStream = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;

    audio.src = `${liveStreamUrl}?t=${Date.now()}`;
    audio.playbackRate = 1.0;
    audio.defaultPlaybackRate = 1.0;
    audio.load();

    const didPlay = await playAudio();
    if (didPlay) {
      setIsPlaying(true);
      lastProgressRef.current = { time: -1, at: Date.now() };
    } else {
      // Autoplay blocked or stream unavailable: drop the connection so we do
      // not keep buffering; a user gesture or the auto-connect retry rejoins.
      audio.removeAttribute("src");
      audio.load();
      setIsPlaying(false);
    }
    return didPlay;
  }, [liveStreamUrl, playAudio]);

  const disconnectLiveStream = useCallback(() => {
    const audio = audioRef.current;
    pauseAudio();
    if (audio) {
      audio.removeAttribute("src");
      audio.load();
    }
    setIsPlaying(false);
  }, [pauseAudio]);

  const isLiveNow = Boolean(effectiveStreamData?.playing && effectiveStreamData?.current);

  // Auto-connect while the station is on air (retries cover blocked autoplay
  // and temporary backend outages without hammering the server).
  useEffect(() => {
    if (!isPublicRoute || !isLiveNow || isPlaying || !userWantsPlaybackRef.current) return;
    if (Date.now() < nextAutoConnectAttemptRef.current) return;

    nextAutoConnectAttemptRef.current = Date.now() + 15000;
    const timer = window.setTimeout(() => {
      if (!userWantsPlaybackRef.current) return;
      void connectLiveStream();
    }, POLLING_INTERVALS.METADATA_LOAD_DELAY);
    return () => window.clearTimeout(timer);
  }, [isPublicRoute, isLiveNow, isPlaying, connectLiveStream, effectiveStreamData]);

  // First user gesture starts the stream when autoplay was blocked.
  useEffect(() => {
    if (!isPublicRoute) return;

    const resumeOnGesture = () => {
      if (!userWantsPlaybackRef.current) return;
      const audio = audioRef.current;
      if (!audio || !audio.paused) return;
      void connectLiveStream();
    };

    const events = ["pointerdown", "touchstart", "keydown"] as const;
    events.forEach((event) => document.addEventListener(event, resumeOnGesture));
    return () => {
      events.forEach((event) => document.removeEventListener(event, resumeOnGesture));
    };
  }, [isPublicRoute, connectLiveStream]);

  // Live streams must always make progress. If playback stalls, or the stream
  // ends/errors (e.g. backend restart), rejoin automatically.
  useEffect(() => {
    if (!isPublicRoute) return;

    const interval = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !userWantsPlaybackRef.current || !isPlaying || !audio.currentSrc) return;

      const now = Date.now();
      const time = audio.currentTime;
      if (time !== lastProgressRef.current.time) {
        lastProgressRef.current = { time, at: now };
        return;
      }
      if (now - lastProgressRef.current.at > 8000) {
        lastProgressRef.current = { time, at: now };
        void connectLiveStream();
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [isPublicRoute, isPlaying, connectLiveStream]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const scheduleReconnect = () => {
      // Only reconnect for genuine mid-stream failures, not our own disconnects.
      if (!userWantsPlaybackRef.current || !audio.currentSrc) return;
      if (reconnectTimerRef.current != null) return;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (userWantsPlaybackRef.current) void connectLiveStream();
      }, 2000);
    };

    audio.addEventListener("ended", scheduleReconnect);
    audio.addEventListener("error", scheduleReconnect);
    return () => {
      audio.removeEventListener("ended", scheduleReconnect);
      audio.removeEventListener("error", scheduleReconnect);
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connectLiveStream]);

  useEffect(() => {
    setAudioVolume(volume);
  }, [volume, setAudioVolume]);

  useEffect(() => {
    setAudioMuted(isMuted);
  }, [isMuted, setAudioMuted]);

  const togglePlayPause = useCallback(() => {
    if (!isPublicRoute) return;
    void (async () => {
      if (isPlaying) {
        userWantsPlaybackRef.current = false;
        disconnectLiveStream();
        return;
      }

      userWantsPlaybackRef.current = true;
      const didPlay = await connectLiveStream();
      if (!didPlay) {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STREAM_CURRENT });
      }
    })();
  }, [isPublicRoute, isPlaying, connectLiveStream, disconnectLiveStream, queryClient]);

  // Strict schedule behavior: if backend says there's no current live item, stop local playback.
  useEffect(() => {
    if (effectiveStreamData?.playing && effectiveStreamData?.current) {
      missingLiveSinceRef.current = null;
      return;
    }
    if (!isPlaying) return;
    const now = Date.now();
    if (missingLiveSinceRef.current == null) {
      missingLiveSinceRef.current = now;
      return;
    }
    const missingFor = now - missingLiveSinceRef.current;

    if (missingFor >= 15000 && missingFor < 16000) {
      void queryClient.refetchQueries({ queryKey: QUERY_KEYS.STREAM_CURRENT, type: "active" });
      return;
    }

    if (missingFor >= 30000 && missingFor < 31000) {
      void queryClient.refetchQueries({ queryKey: QUERY_KEYS.STREAM_CURRENT, type: "active" });
      return;
    }

    if (missingFor < 120000) return;
    // Off air for 2 minutes: stop consuming the stream. userWantsPlaybackRef
    // stays true, so the auto-connect effect rejoins when the broadcast returns.
    disconnectLiveStream();
    missingLiveSinceRef.current = null;
  }, [effectiveStreamData?.playing, effectiveStreamData?.current, isPlaying, disconnectLiveStream, queryClient]);

  const isStreaming = effectiveStreamData?.playing ?? false;
  const hasCurrentTrack = Boolean(effectiveStreamData?.current);
  const hasPlayableContent = hasCurrentTrack;
  const radioState: RadioState = streamLoading && !effectiveStreamData
    ? "loading"
    : !effectiveStreamData && streamError
      ? "error"
      : isStreaming
        ? "live"
        : hasCurrentTrack
          ? "offline"
          : "empty";

  const value = useMemo<PublicRadioContextValue>(
    () => ({
      currentSong: currentSong ?? null,
      isPlaying,
      volume,
      isMuted,
      currentTime,
      currentListeners: listenerData?.count || 0,
      radioState,
      hasPlayableContent,
      setVolume,
      setIsMuted,
      togglePlayPause,
    }),
    [currentSong, isPlaying, volume, isMuted, currentTime, listenerData?.count, radioState, hasPlayableContent, togglePlayPause]
  );

  return (
    <PublicRadioContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        autoPlay
        preload="auto"
        crossOrigin="anonymous"
        playsInline
        webkit-playsinline="true"
      />
    </PublicRadioContext.Provider>
  );
}

export function usePublicRadio() {
  const ctx = useContext(PublicRadioContext);
  if (!ctx) {
    throw new Error("usePublicRadio must be used within PublicRadioProvider");
  }
  return ctx;
}
