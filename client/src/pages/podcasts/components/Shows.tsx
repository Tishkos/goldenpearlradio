import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Clock, User, Headphones, Mic2, Search, X } from "lucide-react";
import { useOptionalAuth } from "@/contexts/AuthContext";
import ShowDetails from "./ShowDetails";
import { api } from "@/lib/api-client";
import type { Show, Host, RadioStation, Location } from "@/types/api-models";

type ShowWithRelations = Show & {
  host?: Host | null;
  scheduledShows?: Array<{
    id: number;
    radioStationId: number;
    locationId: number | null;
    startTime: Date;
    endTime: Date;
    radioStation?: RadioStation | null;
    location?: Location | null;
  }>;
  showItems?: Array<{
    id: number;
    position: number;
    contentType: string;
    notes: string | null;
  }>;
  _count?: {
    showItems: number;
    scheduledShows: number;
  };
};

export default function Shows() {
  const { user } = useOptionalAuth();
  const [search, setSearch] = useState("");
  const [selectedShowId, setSelectedShowId] = useState<number | null>(null);

  useQuery({
    queryKey: ["user-sales-shows", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await fetch("/api/user/purchases");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const { data: shows = [], isLoading: showsLoading } = useQuery<ShowWithRelations[]>({
    queryKey: ["podcast-shows", search],
    queryFn: async (): Promise<ShowWithRelations[]> => {
      const data = await api.get<Show[]>("/shows");
      const active = (data || []).filter((s: any) => s.isActive !== false);
      if (!search) return active;
      const q = search.toLowerCase();
      return active.filter((s: any) =>
        String(s.title || "").toLowerCase().includes(q) ||
        String(s.description || "").toLowerCase().includes(q)
      );
    },
  });

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 h-4 w-4" />
        <Input
          placeholder="Search podcasts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 pl-11 pr-11 text-base text-white placeholder:text-white/60 bg-white/10 border border-white/25 rounded-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0 focus-visible:border-white/40 backdrop-blur-md"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {showsLoading ? (
          Array(6)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="glass-card overflow-hidden !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <div className="h-44 bg-white/10 animate-pulse" />
                <CardContent className="p-5 space-y-3">
                  <div className="h-5 w-3/4 bg-white/15 animate-pulse rounded" />
                  <div className="h-4 w-full bg-white/15 animate-pulse rounded" />
                  <div className="h-4 w-2/3 bg-white/15 animate-pulse rounded" />
                  <div className="h-10 w-full bg-white/15 animate-pulse rounded-2xl" />
                </CardContent>
              </Card>
            ))
        ) : shows.length === 0 ? (
          <div className="col-span-full glass-card text-center py-16 !border-white/25 !bg-white/10">
            <Mic2 className="h-14 w-14 mx-auto text-white/60 mb-4" />
            <p className="font-gp-display text-[1.05rem] italic text-white mb-1">No podcasts found</p>
            <p className="font-gp-serif italic text-white/70 mb-6">Try adjusting your search terms</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearch("")}
              className="rounded-2xl border border-white/25 bg-white/10 text-white/90 hover:text-white hover:bg-white/15"
            >
              Clear search
            </Button>
          </div>
        ) : (
          shows.map((show) => (
            <Card key={show.id} className="glass-card overflow-hidden h-full flex flex-col !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-white/35 transition-colors">
              <div className="w-full h-44 bg-[rgba(6,13,26,0.5)] overflow-hidden relative flex-shrink-0">
                {show.imageUrl ? (
                  <img
                    src={show.imageUrl}
                    alt={show.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[linear-gradient(135deg,rgba(74,111,148,0.35),rgba(212,99,42,0.25))]">
                    <Mic2 className="h-12 w-12 text-white/90" />
                  </div>
                )}

                {show.featured && (
                  <Badge className="absolute top-2 right-2 text-[10px] font-semibold px-2.5 py-1 rounded-2xl bg-white/25 text-white border border-white/30">
                    Featured
                  </Badge>
                )}
              </div>

              <CardContent className="p-4 sm:p-5 flex-1 flex flex-col min-h-0">
                <h3 className="font-gp-sans font-medium text-base sm:text-lg text-white mb-2 line-clamp-2 leading-snug">
                  {show.title}
                </h3>

                {show.description && (
                  <p className="text-sm text-white/80 line-clamp-3 mb-4 leading-relaxed">
                    {show.description}
                  </p>
                )}

                <div className="space-y-1.5 mb-4 text-sm text-white/75">
                  {show.host && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{show.host.name}</span>
                    </div>
                  )}

                  {(show._count?.showItems || show.showItems?.length) && (
                    <div className="flex items-center gap-2">
                      <Headphones className="h-4 w-4" />
                      <span>
                        {show._count?.showItems ?? show.showItems?.length ?? 0}{" "}
                        {(show._count?.showItems ?? show.showItems?.length ?? 0) === 1 ? "episode" : "episodes"}
                      </span>
                    </div>
                  )}

                  {show.scheduledShows && show.scheduledShows.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {show.scheduledShows.length} {show.scheduledShows.length === 1 ? "schedule" : "schedules"}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => setSelectedShowId(show.id)}
                  className="w-full rounded-2xl h-11 bg-white/25 hover:bg-white/35 text-white font-gp-sans font-semibold text-[0.8rem] uppercase tracking-[0.12em] border border-white/30 transition-colors"
                  variant="outline"
                >
                  <Headphones className="h-4 w-4 mr-2 opacity-90" />
                  View Episodes
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedShowId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedShowId(null);
          }}
        >
          <div className="bg-white w-full sm:max-w-3xl max-h-[90vh] mx-auto rounded-t-lg sm:rounded-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Show Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedShowId(null)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
              <Suspense
                fallback={
                  <div className="space-y-4 pt-0">
                    <div className="h-32 bg-gray-200 animate-pulse rounded-lg" />
                    <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                    <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2" />
                  </div>
                }
              >
                <ShowDetails showId={selectedShowId} />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
