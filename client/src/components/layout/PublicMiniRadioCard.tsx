import { Pause, Play, Radio } from "lucide-react";
import { Link } from "wouter";
import { usePublicRadio } from "@/contexts/PublicRadioContext";

export default function PublicMiniRadioCard() {
  const { currentSong, isPlaying, radioState, hasPlayableContent, togglePlayPause } = usePublicRadio();

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[min(92vw,22rem)]">
      <div className="glass-card px-4 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlayPause}
            disabled={!hasPlayableContent}
            className={[
              "h-11 w-11 rounded-full border flex items-center justify-center transition-colors",
              hasPlayableContent
                ? "border-white/35 text-white bg-white/20 hover:bg-white/30 hover:border-white/50 backdrop-blur-sm"
                : "border-white/25 text-white/50 opacity-50 cursor-not-allowed",
            ].join(" ")}
            aria-label={isPlaying ? "Pause radio" : "Play radio"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-white/90" />
              <span className="font-gp-sans text-[0.62rem] uppercase tracking-[0.14em] text-white/80">
                Live Radio
              </span>
            </div>
            <p className="truncate font-gp-display text-[0.98rem] text-white">
              {currentSong?.current?.title || "Golden Pearl Radio"}
            </p>
          </div>

          <Link
            href="/"
            className="px-3 py-2 border border-white/25 rounded-2xl font-gp-sans text-[0.62rem] uppercase tracking-[0.12em] text-white/90 hover:text-white hover:bg-white/20 hover:border-white/40 transition-colors backdrop-blur-sm"
          >
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}
