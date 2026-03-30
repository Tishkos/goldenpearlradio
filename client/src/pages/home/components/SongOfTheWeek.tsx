import { useQuery } from "@tanstack/react-query";
import { Music2 } from "lucide-react";
import { api } from "@/lib/api-client";

interface TopTrack {
  id: number;
  title: string;
  artist: string;
  coverArt?: string | null;
  playCount: number;
}

export default function SongOfTheWeek() {
  const { data: topTracks = [], isLoading } = useQuery<TopTrack[]>({
    queryKey: ["tracks", "top-week"],
    queryFn: async () => {
      try {
        return await api.get<TopTrack[]>("/tracks/top-week");
      } catch {
        return [];
      }
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  return (
    <div className="flex flex-col h-full">
      <p className="font-gp-sans text-[0.65rem] font-medium tracking-[0.2em] uppercase text-white/75 mb-3 flex items-center justify-center gap-2">
        <Music2 className="h-3.5 w-3.5" />
        Song of the Week
      </p>
      {isLoading ? (
        <div className="space-y-2 flex justify-center flex-col items-center">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse w-full max-w-xs">
              <div className="h-6 w-6 rounded bg-white/15 shrink-0" />
              <div className="h-3 bg-white/15 rounded flex-1 max-w-[80%]" />
            </div>
          ))}
        </div>
      ) : topTracks.length === 0 ? (
        <p className="font-gp-sans text-xs text-white/60 italic text-center">No plays yet this week — tune in!</p>
      ) : (
        <ol className="space-y-2">
          {topTracks.map((track, idx) => (
            <li key={track.id} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] font-semibold text-white/90">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-gp-sans text-sm text-white/95">{track.title}</p>
              </div>
              <span className="shrink-0 text-[10px] text-white/50 font-gp-sans">{track.playCount}×</span>
            </li>
          ))}
        </ol>
      )}
      <p className="font-gp-sans text-[0.6rem] tracking-[0.12em] uppercase text-white/80 text-center mt-auto pt-6">
        UAE · Culture · Music
      </p>
    </div>
  );
}
