import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { api } from "@/lib/api-client";
import { Globe2, Users, MapPin, Radio } from "lucide-react";
import worldTopology from "@/assets/world-countries-110m.json";

interface MapLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
  count: number;
}

interface ListenerMapData {
  total: number;
  located: number;
  unlocated: number;
  countries: number;
  locations: MapLocation[];
  updatedAt: number;
}

const EMPTY_MAP_DATA: ListenerMapData = {
  total: 0,
  located: 0,
  unlocated: 0,
  countries: 0,
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

function countryName(code: string): string {
  if (!code || code === "Unknown") return "Unknown";
  try {
    return regionNames?.of(code) || code;
  } catch {
    return code;
  }
}

function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/i.test(code)) return "🌍";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

// Some IPs resolve to a country but no city — label those by country instead
function displayCity(location: MapLocation): string {
  return location.city && location.city !== "Unknown"
    ? location.city
    : countryName(location.country);
}

// Proportional symbol: area encodes magnitude, so radius grows with sqrt(count)
function dotRadius(count: number): number {
  return Math.min(4 + Math.sqrt(count) * 3.2, 19);
}

interface TooltipState {
  x: number;
  y: number;
  location: MapLocation;
}

export default function ListenersMapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { data, dataUpdatedAt } = useQuery<ListenerMapData>({
    queryKey: ["listeners", "map"],
    queryFn: async () => {
      try {
        return (await api.get<ListenerMapData>("/listeners/map")) || EMPTY_MAP_DATA;
      } catch (error) {
        console.error("Error fetching listener map:", error);
        return EMPTY_MAP_DATA;
      }
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const mapData = data || EMPTY_MAP_DATA;
  const topLocation = mapData.locations[0];
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

  const statTiles = [
    {
      title: "Live Listeners",
      value: mapData.total.toString(),
      icon: <Users className="h-6 w-6" />,
    },
    {
      title: "Countries",
      value: mapData.countries.toString(),
      icon: <Globe2 className="h-6 w-6" />,
    },
    {
      title: "Locations",
      value: mapData.locations.length.toString(),
      icon: <MapPin className="h-6 w-6" />,
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
            Live
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
          <div className="mb-4 flex items-center justify-between">
            <div className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)] flex items-center gap-2">
              <Globe2 className="h-5 w-5" />
              Live Listener Map
            </div>
            <div className="font-gp-serif text-sm italic text-[color:var(--gp-muted)]">
              Dot size = listeners · scroll to zoom, drag to pan
            </div>
          </div>

          <div ref={containerRef} className="relative overflow-hidden rounded-[2px] bg-[rgba(4,9,19,0.6)]">
            <ComposableMap
              projection="geoNaturalEarth1"
              projectionConfig={{ scale: 172, center: [12, 6] }}
              width={880}
              height={470}
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

                {mapData.locations.map((location) => {
                  const r = dotRadius(location.count);
                  return (
                    <Marker
                      key={`${location.country}-${location.city}-${location.lat}-${location.lon}`}
                      coordinates={[location.lon, location.lat]}
                    >
                      <circle className="gp-map-pulse" r={r} fill="rgba(232,196,106,0.45)" />
                      <circle
                        r={r}
                        fill="#e8c46a"
                        stroke="rgba(6,13,26,0.9)"
                        strokeWidth={2}
                        style={{ cursor: "pointer", filter: "drop-shadow(0 0 6px rgba(232,196,106,0.65))" }}
                        onMouseEnter={(e) => showTooltip(e, location)}
                        onMouseMove={(e) => showTooltip(e, location)}
                        onMouseLeave={() => setTooltip(null)}
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
                  left: Math.min(tooltip.x + 14, (containerRef.current?.clientWidth || 300) - 170),
                  top: Math.max(tooltip.y - 54, 8),
                }}
              >
                <div className="font-gp-sans text-sm font-medium text-[color:var(--gp-white)]">
                  {countryFlag(tooltip.location.country)} {displayCity(tooltip.location)}
                </div>
                <div className="font-gp-serif text-xs italic text-[color:var(--gp-muted)]">
                  {countryName(tooltip.location.country)}
                </div>
                <div className="mt-1 font-gp-sans text-xs uppercase tracking-[0.12em] text-[var(--gp-gold-bright)]">
                  {tooltip.location.count} listener{tooltip.location.count === 1 ? "" : "s"}
                </div>
              </div>
            )}

            {mapData.locations.length === 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="rounded-[2px] border border-[var(--gp-border-gold)]/50 bg-[rgba(6,13,26,0.85)] px-6 py-4 text-center">
                  <p className="font-gp-sans text-sm text-[color:var(--gp-white)]/90">
                    {mapData.total > 0
                      ? "Locating listeners…"
                      : "No one is tuned in right now"}
                  </p>
                  <p className="mt-1 font-gp-serif text-xs italic text-[color:var(--gp-muted)]">
                    Listener locations appear here the moment someone presses play
                  </p>
                </div>
              </div>
            )}
          </div>

          {mapData.unlocated > 0 && (
            <p className="mt-3 font-gp-serif text-xs italic text-[color:var(--gp-muted)]">
              {mapData.unlocated} listener{mapData.unlocated === 1 ? "" : "s"} could not be
              placed on the map (private network or unresolved location).
            </p>
          )}
        </div>

        {/* Top locations — table view of the map data */}
        <div className="gp-card p-7">
          <div className="mb-5 font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)] flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Top Locations
          </div>

          {mapData.locations.length > 0 ? (
            <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
              {mapData.locations.slice(0, 20).map((location, i) => (
                <div
                  key={`${location.country}-${location.city}-${i}`}
                  className="rounded-[2px] border border-[var(--gp-border-gold)]/40 bg-[rgba(6,13,26,0.5)] px-4 py-3"
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
                          {countryName(location.country)}
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
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center font-gp-serif italic text-[color:var(--gp-muted)]">
              No active listeners yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
