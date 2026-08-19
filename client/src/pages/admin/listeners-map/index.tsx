import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { api } from "@/lib/api-client";
import { Globe2, Users, MapPin, Radio, Clock, ChevronLeft, Music, Headphones } from "lucide-react";
import worldTopology from "@/assets/world-countries-110m.json";

type MapRange = "live" | "24h" | "7d" | "month";

const RANGE_OPTIONS: { key: MapRange; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "Last 7 days" },
  { key: "month", label: "This month" },
];

interface MapLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
  count: number;
  sessions: number;
  seconds: number;
}

interface ListenerMapData {
  range: MapRange;
  total: number;
  located: number;
  unlocated: number;
  countries: number;
  sessions: number;
  seconds: number;
  avgSeconds: number;
  locations: MapLocation[];
  updatedAt: number;
}

interface SessionSummary {
  id: string;
  label: string;
  source: string;
  country: string | null;
  city: string | null;
  startedAt: string;
  endedAt: string | null;
  lastSeenAt: string;
  seconds: number;
  isLive: boolean;
  playCount: number;
  topPlay: { title: string; artist: string | null; seconds: number } | null;
}

interface SessionPlay {
  id: number;
  title: string;
  artist: string | null;
  contentType: string | null;
  startedAt: string;
  seconds: number;
}

interface SessionDetail extends Omit<SessionSummary, "playCount" | "topPlay"> {
  plays: SessionPlay[];
  listenerTotals: { sessions: number; seconds: number; firstHeardAt: string | null };
}

const EMPTY_MAP_DATA: ListenerMapData = {
  range: "live",
  total: 0,
  located: 0,
  unlocated: 0,
  countries: 0,
  sessions: 0,
  seconds: 0,
  avgSeconds: 0,
  locations: [],
  updatedAt: 0,
};

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

function countryName(code: string | null): string {
  if (!code || code === "Unknown") return "Unknown";
  try {
    return regionNames?.of(code) || code;
  } catch {
    return code;
  }
}

function countryFlag(code: string | null): string {
  if (!code || !/^[A-Z]{2}$/i.test(code)) return "🌍";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

// Some IPs resolve to a country but no city — label those by country instead
function displayCity(location: { city: string | null; country: string | null }): string {
  return location.city && location.city !== "Unknown"
    ? location.city
    : countryName(location.country);
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Proportional symbol: area encodes magnitude, so radius grows with sqrt(count)
function dotRadius(count: number): number {
  return Math.min(2.5 + Math.sqrt(count) * 1.8, 12);
}

interface TooltipState {
  x: number;
  y: number;
  location: MapLocation;
}

interface SelectedPlace {
  city: string;
  country: string;
}

export default function ListenersMapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [range, setRange] = useState<MapRange>("live");
  const [place, setPlace] = useState<SelectedPlace | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const isLive = range === "live";

  // Switching the time window invalidates whatever was drilled into
  useEffect(() => {
    setPlace(null);
    setSessionId(null);
    setTooltip(null);
  }, [range]);

  const { data, dataUpdatedAt } = useQuery<ListenerMapData>({
    queryKey: ["listeners", "map", range],
    queryFn: async () => {
      try {
        return (
          (await api.get<ListenerMapData>(`/listeners/map?range=${range}`)) || EMPTY_MAP_DATA
        );
      } catch (error) {
        console.error("Error fetching listener map:", error);
        return EMPTY_MAP_DATA;
      }
    },
    refetchInterval: isLive ? 5000 : 60000,
    refetchIntervalInBackground: isLive,
  });

  const { data: sessionList, isFetching: loadingSessions } = useQuery<{ sessions: SessionSummary[] }>({
    queryKey: ["listeners", "sessions", range, place?.country, place?.city],
    enabled: Boolean(place),
    queryFn: async () => {
      const params = new URLSearchParams({ range });
      if (place?.country) params.set("country", place.country);
      if (place?.city) params.set("city", place.city);
      try {
        return (
          (await api.get<{ sessions: SessionSummary[] }>(`/listeners/sessions?${params}`)) || {
            sessions: [],
          }
        );
      } catch (error) {
        console.error("Error fetching listener sessions:", error);
        return { sessions: [] };
      }
    },
    refetchInterval: isLive ? 10000 : false,
  });

  const { data: sessionDetail, isFetching: loadingDetail } = useQuery<SessionDetail | null>({
    queryKey: ["listeners", "session", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      try {
        return await api.get<SessionDetail>(`/listeners/sessions/${sessionId}`);
      } catch (error) {
        console.error("Error fetching listener session:", error);
        return null;
      }
    },
    refetchInterval: isLive ? 10000 : false,
  });

  const mapData = data || EMPTY_MAP_DATA;
  const locations = mapData.locations || [];
  const topLocation = locations[0];
  const maxCount = topLocation?.count || 1;

  const geographies = useMemo(() => worldTopology as any, []);

  const showTooltip = (event: React.MouseEvent, location: MapLocation) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setTooltip({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      location,
    });
  };

  const selectPlace = (location: MapLocation) => {
    setSessionId(null);
    setPlace({ city: location.city, country: location.country });
  };

  const rangeLabel = RANGE_OPTIONS.find((o) => o.key === range)?.label ?? "Live";

  const statTiles = [
    {
      title: isLive ? "Live Listeners" : `Listeners · ${rangeLabel}`,
      value: mapData.total.toString(),
      subtitle: isLive ? undefined : `${mapData.sessions} tune-in${mapData.sessions === 1 ? "" : "s"}`,
      icon: <Users className="h-6 w-6" />,
    },
    {
      title: "Countries",
      value: mapData.countries.toString(),
      icon: <Globe2 className="h-6 w-6" />,
    },
    {
      title: isLive ? "Listening For" : "Avg. Listen Time",
      value: formatDuration(mapData.avgSeconds),
      subtitle: isLive ? "average, on air now" : `${formatDuration(mapData.seconds)} total`,
      icon: <Clock className="h-6 w-6" />,
    },
    {
      title: "Top Location",
      value: topLocation ? displayCity(topLocation) : "—",
      subtitle: topLocation ? countryName(topLocation.country) : undefined,
      icon: <Radio className="h-6 w-6" />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 text-[color:var(--gp-white)]">
      <style>{`
        @keyframes gp-map-pulse {
          0% { transform: scale(1); opacity: 0.55; }
          70% { transform: scale(2.6); opacity: 0; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        .gp-map-pulse {
          animation: gp-map-pulse 2.4s ease-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes gp-live-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .gp-live-dot { animation: gp-live-blink 1.6s ease-in-out infinite; }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-gp-display text-3xl font-semibold text-[var(--gp-white)]">
          Listeners Around the World
        </h1>
        <div className="flex items-center gap-2 rounded-[2px] border border-[var(--gp-border-gold)] bg-[rgba(6,13,26,0.6)] px-3 py-1.5">
          <span className="gp-live-dot h-2 w-2 rounded-full bg-[var(--gp-gold-bright)]" />
          <span className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)]">
            {rangeLabel}
          </span>
          {dataUpdatedAt > 0 && (
            <span className="font-gp-sans text-[0.62rem] tracking-[0.08em] text-[color:var(--gp-muted)]">
              {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statTiles.map((stat) => (
          <div key={stat.title} className="gp-card p-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--gp-muted)]">
                  {stat.title}
                </p>
                <p className="mt-3 truncate font-gp-brand text-3xl font-semibold tracking-[0.04em] text-[var(--gp-gold-bright)]">
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="mt-1 truncate font-gp-serif text-sm italic text-[color:var(--gp-white)]/70">
                    {stat.subtitle}
                  </p>
                )}
              </div>
              <div className="h-10 w-10 flex-shrink-0 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* World map */}
        <div className="gp-card p-7 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)] flex items-center gap-2">
              <Globe2 className="h-5 w-5" />
              Listener Map
            </div>
            <div className="flex flex-wrap rounded-[2px] border border-[var(--gp-border-gold)] bg-[rgba(6,13,26,0.5)] p-1">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setRange(option.key)}
                  className={[
                    "px-3 py-1 rounded-[2px] font-gp-sans text-[0.68rem] uppercase tracking-[0.12em] transition-colors",
                    range === option.key
                      ? "bg-[var(--gp-gold)] text-[var(--gp-navy-deep)]"
                      : "text-[color:var(--gp-white)]/75 hover:text-[var(--gp-gold-bright)]",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={containerRef} className="relative overflow-hidden rounded-[2px] bg-[rgba(4,9,19,0.6)]">
            <ComposableMap
              projection="geoEquirectangular"
              projectionConfig={{ scale: 140, center: [10, 12] }}
              width={880}
              height={400}
              style={{ width: "100%", height: "auto" }}
            >
              <ZoomableGroup minZoom={1} maxZoom={8}>
                <Geographies geography={geographies}>
                  {({ geographies: geos }) =>
                    geos
                      .filter((geo) => geo.properties.name !== "Antarctica")
                      .map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill="rgba(201,168,76,0.10)"
                          stroke="rgba(201,168,76,0.28)"
                          strokeWidth={0.4}
                          style={{
                            default: { outline: "none" },
                            hover: { outline: "none", fill: "rgba(201,168,76,0.18)" },
                            pressed: { outline: "none" },
                          }}
                        />
                      ))
                  }
                </Geographies>

                {locations.map((location) => {
                  const r = dotRadius(location.count);
                  const isSelected =
                    place?.city === location.city && place?.country === location.country;
                  return (
                    <Marker
                      key={`${location.country}-${location.city}-${location.lat}-${location.lon}`}
                      coordinates={[location.lon, location.lat]}
                    >
                      {isLive && <circle className="gp-map-pulse" r={r} fill="rgba(232,196,106,0.45)" />}
                      <circle
                        r={r}
                        fill={isSelected ? "#ffffff" : "#e8c46a"}
                        stroke={isSelected ? "#e8c46a" : "rgba(6,13,26,0.9)"}
                        strokeWidth={2}
                        style={{ cursor: "pointer", filter: "drop-shadow(0 0 6px rgba(232,196,106,0.65))" }}
                        onMouseEnter={(e) => showTooltip(e, location)}
                        onMouseMove={(e) => showTooltip(e, location)}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => selectPlace(location)}
                      />
                    </Marker>
                  );
                })}
              </ZoomableGroup>
            </ComposableMap>

            {tooltip && (
              <div
                className="pointer-events-none absolute z-10 rounded-[2px] border border-[rgba(201,168,76,0.45)] bg-[rgba(6,13,26,0.95)] px-3 py-2"
                style={{
                  left: Math.min(tooltip.x + 14, (containerRef.current?.clientWidth || 300) - 180),
                  top: Math.max(tooltip.y - 66, 8),
                }}
              >
                <div className="font-gp-sans text-sm font-medium text-[color:var(--gp-white)]">
                  {countryFlag(tooltip.location.country)} {displayCity(tooltip.location)}
                </div>
                <div className="font-gp-serif text-xs italic text-[color:var(--gp-muted)]">
                  {countryName(tooltip.location.country)}
                </div>
                <div className="mt-1 font-gp-sans text-xs uppercase tracking-[0.12em] text-[var(--gp-gold-bright)]">
                  {tooltip.location.count} listener{tooltip.location.count === 1 ? "" : "s"} ·{" "}
                  {formatDuration(tooltip.location.seconds)}
                </div>
                <div className="mt-0.5 font-gp-serif text-[0.68rem] italic text-[color:var(--gp-muted)]">
                  Click to see who
                </div>
              </div>
            )}

            {locations.length === 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="rounded-[2px] border border-[var(--gp-border-gold)]/50 bg-[rgba(6,13,26,0.85)] px-6 py-4 text-center">
                  <p className="font-gp-sans text-sm text-[color:var(--gp-white)]/90">
                    {isLive
                      ? mapData.total > 0
                        ? "Locating listeners…"
                        : "No one is tuned in right now"
                      : `No listeners located in this period`}
                  </p>
                  <p className="mt-1 font-gp-serif text-xs italic text-[color:var(--gp-muted)]">
                    Listener locations appear here the moment someone presses play
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 font-gp-serif text-xs italic text-[color:var(--gp-muted)]">
            Dot size = listeners · click a dot to see who was listening · scroll to zoom, drag to pan
            {mapData.unlocated > 0 && (
              <>
                {" · "}
                {mapData.unlocated} listener{mapData.unlocated === 1 ? "" : "s"} could not be
                placed on the map
              </>
            )}
          </p>
        </div>

        {/* Drill-down panel: locations -> listeners -> one listener */}
        <div className="gp-card p-7">
          {sessionId ? (
            <SessionDetailPanel
              detail={sessionDetail || null}
              loading={loadingDetail}
              onBack={() => setSessionId(null)}
            />
          ) : place ? (
            <SessionListPanel
              place={place}
              sessions={sessionList?.sessions || []}
              loading={loadingSessions}
              onBack={() => setPlace(null)}
              onSelect={setSessionId}
            />
          ) : (
            <LocationListPanel
              locations={locations}
              maxCount={maxCount}
              onSelect={selectPlace}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PanelHeader({
  icon,
  title,
  onBack,
}: {
  icon: React.ReactNode;
  title: string;
  onBack?: () => void;
}) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {onBack && (
        <button
          onClick={onBack}
          className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border border-[var(--gp-border-gold)] text-[var(--gp-gold-bright)] transition-colors hover:bg-[rgba(201,168,76,0.15)]"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div className="flex min-w-0 items-center gap-2 font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)]">
        {icon}
        <span className="truncate">{title}</span>
      </div>
    </div>
  );
}

function LocationListPanel({
  locations,
  maxCount,
  onSelect,
}: {
  locations: MapLocation[];
  maxCount: number;
  onSelect: (location: MapLocation) => void;
}) {
  return (
    <>
      <PanelHeader icon={<MapPin className="h-5 w-5" />} title="Top Locations" />
      {locations.length > 0 ? (
        <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
          {locations.slice(0, 40).map((location, i) => (
            <button
              key={`${location.country}-${location.city}-${i}`}
              onClick={() => onSelect(location)}
              className="w-full rounded-[2px] border border-[var(--gp-border-gold)]/40 bg-[rgba(6,13,26,0.5)] px-4 py-3 text-left transition-colors hover:border-[var(--gp-border-gold)] hover:bg-[rgba(201,168,76,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-7 w-7 flex-shrink-0 rounded-full border border-[var(--gp-border-gold)] grid place-items-center font-gp-sans text-xs text-[var(--gp-gold-bright)]">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-gp-sans font-medium text-[color:var(--gp-white)]">
                      {countryFlag(location.country)} {displayCity(location)}
                    </p>
                    <p className="truncate font-gp-serif text-xs italic text-[color:var(--gp-muted)]">
                      {countryName(location.country)} · {formatDuration(location.seconds)} listened
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 font-gp-sans text-sm tracking-[0.08em] text-[color:var(--gp-white)]/85">
                  {location.count}
                </div>
              </div>
              <div className="mt-2 h-1 w-full rounded-full bg-[rgba(201,168,76,0.12)]">
                <div
                  className="h-1 rounded-full bg-[var(--gp-gold-bright)] transition-all duration-700"
                  style={{ width: `${Math.max((location.count / maxCount) * 100, 6)}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="py-10 text-center font-gp-serif italic text-[color:var(--gp-muted)]">
          No listeners in this period yet
        </p>
      )}
    </>
  );
}

function SessionListPanel({
  place,
  sessions,
  loading,
  onBack,
  onSelect,
}: {
  place: SelectedPlace;
  sessions: SessionSummary[];
  loading: boolean;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <PanelHeader
        icon={<Headphones className="h-5 w-5" />}
        title={`${countryFlag(place.country)} ${displayCity(place)}`}
        onBack={onBack}
      />
      {sessions.length > 0 ? (
        <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className="w-full rounded-[2px] border border-[var(--gp-border-gold)]/40 bg-[rgba(6,13,26,0.5)] px-4 py-3 text-left transition-colors hover:border-[var(--gp-border-gold)] hover:bg-[rgba(201,168,76,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {session.isLive && (
                    <span className="gp-live-dot h-2 w-2 flex-shrink-0 rounded-full bg-[var(--gp-gold-bright)]" />
                  )}
                  <p className="truncate font-gp-sans font-medium text-[color:var(--gp-white)]">
                    {session.label}
                  </p>
                </div>
                <div className="flex-shrink-0 font-gp-sans text-sm tracking-[0.08em] text-[var(--gp-gold-bright)]">
                  {formatDuration(session.seconds)}
                </div>
              </div>
              <p className="mt-1 truncate font-gp-serif text-xs italic text-[color:var(--gp-muted)]">
                {session.isLive ? "Listening now" : formatWhen(session.startedAt)}
                {session.playCount > 0 && (
                  <> · {session.playCount} item{session.playCount === 1 ? "" : "s"} heard</>
                )}
              </p>
              {session.topPlay && (
                <p className="mt-1 flex items-center gap-1.5 truncate font-gp-sans text-xs text-[color:var(--gp-white)]/75">
                  <Music className="h-3 w-3 flex-shrink-0 text-[var(--gp-gold)]" />
                  <span className="truncate">
                    {session.topPlay.title}
                    {session.topPlay.artist ? ` — ${session.topPlay.artist}` : ""}
                  </span>
                </p>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="py-10 text-center font-gp-serif italic text-[color:var(--gp-muted)]">
          {loading ? "Loading listeners…" : "No listener sessions recorded here yet"}
        </p>
      )}
    </>
  );
}

function SessionDetailPanel({
  detail,
  loading,
  onBack,
}: {
  detail: SessionDetail | null;
  loading: boolean;
  onBack: () => void;
}) {
  if (!detail) {
    return (
      <>
        <PanelHeader icon={<Headphones className="h-5 w-5" />} title="Listener" onBack={onBack} />
        <p className="py-10 text-center font-gp-serif italic text-[color:var(--gp-muted)]">
          {loading ? "Loading…" : "This session is no longer available"}
        </p>
      </>
    );
  }

  const plays = [...detail.plays].sort((a, b) => b.seconds - a.seconds);

  return (
    <>
      <PanelHeader icon={<Headphones className="h-5 w-5" />} title={detail.label} onBack={onBack} />

      <div className="rounded-[2px] border border-[var(--gp-border-gold)]/40 bg-[rgba(6,13,26,0.5)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-gp-sans text-sm text-[color:var(--gp-white)]">
            {countryFlag(detail.country)} {displayCity(detail)}
          </p>
          {detail.isLive && (
            <span className="flex flex-shrink-0 items-center gap-1.5 font-gp-sans text-[0.62rem] uppercase tracking-[0.16em] text-[var(--gp-gold-bright)]">
              <span className="gp-live-dot h-2 w-2 rounded-full bg-[var(--gp-gold-bright)]" />
              On air
            </span>
          )}
        </div>
        <p className="mt-3 font-gp-brand text-2xl font-semibold text-[var(--gp-gold-bright)]">
          {formatDuration(detail.seconds)}
        </p>
        <p className="font-gp-serif text-xs italic text-[color:var(--gp-muted)]">
          listened · started {formatWhen(detail.startedAt)}
          {detail.endedAt ? ` · left ${formatWhen(detail.endedAt)}` : ""}
        </p>
        {detail.listenerTotals.sessions > 1 && (
          <p className="mt-2 font-gp-serif text-xs italic text-[color:var(--gp-white)]/70">
            Returning listener — {detail.listenerTotals.sessions} tune-ins,{" "}
            {formatDuration(detail.listenerTotals.seconds)} in total
          </p>
        )}
      </div>

      <div className="mt-5 mb-3 font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)] flex items-center gap-2">
        <Music className="h-4 w-4" />
        What they heard
      </div>

      {plays.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {plays.map((play) => (
            <div
              key={play.id}
              className="rounded-[2px] border border-[var(--gp-border-gold)]/30 bg-[rgba(6,13,26,0.4)] px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-gp-sans text-sm text-[color:var(--gp-white)]">
                    {play.title}
                  </p>
                  <p className="truncate font-gp-serif text-xs italic text-[color:var(--gp-muted)]">
                    {play.artist || (play.contentType || "").toLowerCase().replace(/_/g, " ") || "—"}
                  </p>
                </div>
                <span className="flex-shrink-0 font-gp-sans text-xs tracking-[0.08em] text-[var(--gp-gold-bright)]">
                  {formatDuration(play.seconds)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center font-gp-serif italic text-[color:var(--gp-muted)]">
          Nothing recorded yet for this session
        </p>
      )}
    </>
  );
}
