import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, getAuthToken } from "@/lib/api-client";
import { subscribeToRadioTimelineSync } from "@/lib/radio-timeline-sync";
import { useAudioContext, useAudioPlayback, useWaveform, useListenerTracking, useBackgroundPlayback, useAutoPlayback } from "@/pages/home/hooks";
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

interface SyncMarkers {
  [url: string]: boolean;
}

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
  audioData: number[];
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
  const [audioData, setAudioData] = useState<number[]>(new Array(50).fill(0));
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

  const fetchLatestStreamState = useCallback(async (): Promise<StreamCurrentResponse | null> => {
    try {
      const streamServerUrl = import.meta.env.VITE_STREAM_SERVER_URL || "http://127.0.0.1:3001";
      const res = await fetch(`${streamServerUrl}${API_ENDPOINTS.STREAM_CURRENT}`);
      if (!res.ok) return null;
      return (await res.json()) as StreamCurrentResponse;
    } catch {
      return null;
    }
  }, []);

  // IMPORTANT: URL can repeat across adjacent schedule items; key off item id + url.
  const lastStreamKeyRef = useRef<string | null>(null);
  const hasSyncedRef = useRef<SyncMarkers>({});
  const lastWaveformRecoverRef = useRef(0);
  const lastDriftSyncAtRef = useRef(0);

  const audioContext = useAudioContext(audioRef.current);
  const playback = useAudioPlayback(audioRef.current, audioContext.refs.audioContextRef);
  const initializeAudio = audioContext.initialize;
  const resumeAudio = audioContext.resume;
  const setupAudioEvents = audioContext.setupEvents;
  const setupUserInteractionListener = playback.setupUserInteractionListener;
  const playAudio = playback.play;
  const pauseAudio = playback.pause;
  const setAudioVolume = playback.setVolume;
  const setAudioMuted = playback.setMuted;
  const pendingPlayRef = playback.pendingPlayRef;
  const recoverWaveform = useCallback(() => {
    const now = Date.now();
    if (now - lastWaveformRecoverRef.current < 3500) return;
    lastWaveformRecoverRef.current = now;

    // Force a reconnect of the WebAudio graph when signal gets stuck.
    const recovered = initializeAudio(true);
    if (!recovered) {
      setTimeout(() => {
        initializeAudio(true);
      }, 250);
    }

    // Ensure context is resumed after reconnect.
    resumeAudio().catch(() => {
      // no-op
    });
  }, [initializeAudio, resumeAudio]);

  useWaveform(
    isPlaying,
    audioContext.refs.analyserRef.current,
    audioContext.refs.dataArrayRef.current,
    setAudioData,
    audioRef.current,
    recoverWaveform
  );
  useListenerTracking(isPlaying, api);

  useEffect(() => setupUserInteractionListener(), [setupUserInteractionListener]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), POLLING_INTERVALS.TIME_UPDATE);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;

    const initSuccess = initializeAudio();
    if (!initSuccess) {
      setTimeout(() => initializeAudio(), POLLING_INTERVALS.INIT_RETRY_DELAY);
    }

    return setupAudioEvents(
      () => initializeAudio(false),
      () => initializeAudio(false)
    );
  }, [initializeAudio, setupAudioEvents]);

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

    const resolvedTimelineItems = publicTimelineItems
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

    const playableItems = resolvedTimelineItems.filter(
      (item) => Boolean(item.title && item.url)
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
    stationCurrentSeconds,
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
    const serverMatchesScheduledWindow =
      scheduledCurrentId != null &&
      normalizedServerData?.current?.id != null &&
      Number(normalizedServerData.current.id) === Number(scheduledCurrentId);

    const shouldPreferFallback =
      Boolean(fallbackStreamData?.current) &&
      (
        !normalizedServerData?.current ||
        normalizedServerData.playing !== true ||
        !normalizedServerData.debug?.stationTimeZone ||
        serverClockSkew > 90 ||
        !serverMatchesScheduledWindow
      );

    if (!enableProtectedPublicFallback) return normalizedServerData || null;
    if (!hasScheduledCurrentWindow) return fallbackStreamData;
    if (shouldPreferFallback) return fallbackStreamData;
    if (normalizedServerData?.current && !serverMatchesScheduledWindow) return fallbackStreamData;
    return normalizedServerData || fallbackStreamData || null;
  }, [enableProtectedPublicFallback, fallbackStreamData, stationCurrentSeconds, streamData]);

  const currentSong = effectiveStreamData ?? null;

  useBackgroundPlayback(isPlaying, currentSong?.playing ?? false);
  useAutoPlayback(isPlaying, currentSong?.playing ?? false, queryClient);

  useEffect(() => {
    if (isPublicRoute) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, [isPublicRoute]);

  useEffect(() => {
    if (!effectiveStreamData) {
      return;
    }

    const normalizedCurrentUrl = resolveStreamUrl(effectiveStreamData.current?.url);
    const streamKey = effectiveStreamData.current && normalizedCurrentUrl ? `${effectiveStreamData.current.id}:${normalizedCurrentUrl}` : null;
    if (effectiveStreamData.playing && effectiveStreamData.current && !lastStreamKeyRef.current && streamKey) {
      const currentSongData = effectiveStreamData.current;
      const normalizedUrl = resolveStreamUrl(currentSongData.url);
      setTimeout(() => {
        const audio = audioRef.current;
        if (!audio || isPlaying || !currentSongData || !normalizedUrl) return;

        audio.src = normalizedUrl;
        audio.load();

        const handleCanPlay = async () => {
          try {
            if (currentSongData.audioFilePosition > 0) {
              audio.currentTime = currentSongData.audioFilePosition;
            }
            await playAudio();
            setIsPlaying(true);
            lastStreamKeyRef.current = `${currentSongData.id}:${normalizedUrl}`;
            hasSyncedRef.current[lastStreamKeyRef.current] = true;
          } catch {
            pendingPlayRef.current = true;
          }
        };

        audio.addEventListener("canplay", handleCanPlay, { once: true });
      }, POLLING_INTERVALS.METADATA_LOAD_DELAY);
    }
  }, [effectiveStreamData, isPlaying, playAudio, pendingPlayRef, resolveStreamUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong?.playing || !currentSong.current) return;

    const currentUrl = resolveStreamUrl(currentSong.current.url);
    if (!currentUrl) return;
    const currentId = currentSong.current.id;
    const audioFilePosition = currentSong.current.audioFilePosition || 0;
    const currentStreamKey = `${currentId}:${currentUrl}`;
    const currentLoadedUrl = audio.currentSrc || audio.src || "";
    const urlChanged = !currentLoadedUrl.includes(currentUrl);

    // If item changes (even with same URL), reload + hard sync once.
    if (currentStreamKey !== lastStreamKeyRef.current) {
      // If only the item id changed but URL stayed the same, do not restart audio.
      if (!urlChanged) {
        lastStreamKeyRef.current = currentStreamKey;
        hasSyncedRef.current[currentStreamKey] = true;
        return;
      }

      // If next URL arrived before current track naturally finishes, avoid mid-song cut.
      // We'll switch when current playback reaches the end.
      if (!audio.paused && !audio.ended && Number.isFinite(audio.duration) && audio.duration > 0) {
        const remaining = Math.max(0, audio.duration - (audio.currentTime || 0));
        if (remaining > 1.25) {
          return;
        }
      }

      lastStreamKeyRef.current = currentStreamKey;
      hasSyncedRef.current[currentStreamKey] = false;
      audio.src = currentUrl;

      const handleLoadedMetadata = async () => {
        initializeAudio(false);

        if (!hasSyncedRef.current[currentStreamKey] && audioFilePosition > 0) {
          hasSyncedRef.current[currentStreamKey] = true;
          audio.currentTime = Math.min(audioFilePosition, Math.max(0, audio.duration - 0.1));
          await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVALS.SEEK_COMPLETE_DELAY));
        }

        try {
          await resumeAudio();
        } catch {
          // no-op
        }

        if (!audioContext.refs.analyserRef.current || !audioContext.refs.sourceRef.current) {
          initializeAudio(false);
        }

        const didPlay = await playAudio();
        if (didPlay && !isPlaying) {
          setIsPlaying(true);
        }
      };

      audio.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
      audio.load();
      return;
    }

    // Same item key: apply conservative drift correction.
    // Avoid backward seeks (can sound like repeating/looping snippets).
    if (audioFilePosition > 0 && !Number.isNaN(audio.duration) && audio.duration > 0) {
      const clampedTarget = Math.min(audioFilePosition, Math.max(0, audio.duration - 0.1));
      const currentPos = audio.currentTime || 0;
      const behindBy = clampedTarget - currentPos;
      const now = Date.now();

      // Only nudge when we're noticeably BEHIND live position.
      // Never rewind for minor drift because it creates audible repeats.
      if (behindBy > 2.4 && now - lastDriftSyncAtRef.current > 12000) {
        try {
          audio.currentTime = clampedTarget;
          lastDriftSyncAtRef.current = now;
        } catch {
          // no-op (some browsers can throw while seeking)
        }
      }
    }
  }, [currentSong, isPlaying, initializeAudio, resumeAudio, playAudio, resolveStreamUrl, audioContext.refs.analyserRef, audioContext.refs.sourceRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (currentSong?.playing) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STREAM_CURRENT });
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [currentSong, queryClient]);

  useEffect(() => {
    setAudioVolume(volume);
  }, [volume, setAudioVolume]);

  useEffect(() => {
    setAudioMuted(isMuted);
  }, [isMuted, setAudioMuted]);

  const togglePlayPause = useCallback(() => {
    if (!isPublicRoute) return;
    void (async () => {
      initializeAudio();
      if (isPlaying) {
        pauseAudio();
        setIsPlaying(false);
        return;
      }

      // Manual play always re-syncs from server so resume follows live timeline time.
      const latest = await fetchLatestStreamState();
      const candidate = latest?.playing && latest.current?.url ? latest : effectiveStreamData;
      const latestCurrent = candidate?.current;
      const isLiveNow = Boolean(candidate?.playing && latestCurrent?.url);
      const urlToPlay = resolveStreamUrl(isLiveNow ? latestCurrent?.url : null);
      if (!urlToPlay) {
        setIsPlaying(false);
        return;
      }
      const audio = audioRef.current;
      if (urlToPlay && audio) {
        const targetAudioPosition = isLiveNow
          ? Math.max(0, Number(latestCurrent?.audioFilePosition || 0))
          : 0;

        if (!audio.src || !audio.src.includes(urlToPlay)) {
          // When manually starting playback, treat it as a new stream key so it will sync on next poll.
          lastStreamKeyRef.current = isLiveNow && latestCurrent
            ? `${latestCurrent.id}:${resolveStreamUrl(latestCurrent.url)}`
            : null;
          audio.src = urlToPlay;
          audio.load();
          const onCanPlay = async () => {
            audio.removeEventListener("canplay", onCanPlay);
            if (targetAudioPosition > 0) {
              try {
                const cap = Number.isFinite(audio.duration) && audio.duration > 0
                  ? Math.max(0, audio.duration - 0.1)
                  : targetAudioPosition;
                audio.currentTime = Math.min(targetAudioPosition, cap);
              } catch {
                // no-op
              }
            }
            const didPlay = await playAudio();
            if (didPlay) setIsPlaying(true);
          };
          audio.addEventListener("canplay", onCanPlay, { once: true });
          return;
        }

        // Same URL paused -> sync live position first, then resume.
        if (targetAudioPosition > 0) {
          try {
            const cap = Number.isFinite(audio.duration) && audio.duration > 0
              ? Math.max(0, audio.duration - 0.1)
              : targetAudioPosition;
            audio.currentTime = Math.min(targetAudioPosition, cap);
          } catch {
            // no-op
          }
        }
        try {
          await resumeAudio();
        } catch {
          // no-op
        }
        const didPlay = await playAudio();
        if (didPlay) setIsPlaying(true);
      }

      // No current item -> do nothing.
    })();
  }, [isPublicRoute, isPlaying, initializeAudio, pauseAudio, playAudio, resumeAudio, resolveStreamUrl, fetchLatestStreamState, effectiveStreamData]);

  // Strict schedule behavior: if backend says there's no current live item, stop local playback.
  useEffect(() => {
    if (effectiveStreamData?.playing && effectiveStreamData?.current) return;
    if (!isPlaying) return;
    pauseAudio();
    setIsPlaying(false);
  }, [effectiveStreamData?.playing, effectiveStreamData?.current, isPlaying, pauseAudio]);

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
      audioData,
      currentTime,
      currentListeners: listenerData?.count || 0,
      radioState,
      hasPlayableContent,
      setVolume,
      setIsMuted,
      togglePlayPause,
    }),
    [currentSong, isPlaying, volume, isMuted, audioData, currentTime, listenerData?.count, radioState, hasPlayableContent, togglePlayPause]
  );

  return (
    <PublicRadioContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onPlay={() => {
          setIsPlaying(true);
          if (!audioContext.refs.analyserRef.current || !audioContext.refs.sourceRef.current) {
            initializeAudio();
          }
        }}
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
