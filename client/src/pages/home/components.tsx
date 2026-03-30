import { Volume2, VolumeX, Play, Pause } from "lucide-react";
import { format } from 'date-fns';
import { UI } from "./constants";

/**
 * Radio Header Component
 * Displays title, location, and live clock
 */
export function RadioHeader({ currentTime }: { currentTime: Date }) {
  return (
    <div className="relative px-7 py-6 border-b border-white/20 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.14),transparent_65%)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-2 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
      />
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-[2px]" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="block w-[3px] rounded-[2px] bg-white/80"
                style={{
                  height: [8, 14, 10, 16, 8][i] + 'px',
                  animation: 'gpWave 1.2s ease-in-out infinite',
                  animationDelay: [0, 0.15, 0.3, 0.1, 0.25][i] + 's',
                  opacity: 0.75,
                }}
              />
            ))}
          </div>
          <div>
            <div className="font-gp-display text-[1.65rem] font-bold leading-none tracking-[0.01em] bg-gradient-to-r from-[var(--gp-white)] via-[var(--gp-gold-bright)] to-[var(--gp-white)] bg-clip-text text-transparent">
              {UI.VERSION}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="font-gp-sans text-[0.62rem] tracking-[0.25em] uppercase text-white/85">
                {UI.LOCATION}
              </div>
              <span className="inline-flex items-center rounded-[2px] border border-white/35 bg-white/10 px-2 py-[2px] font-gp-sans text-[0.52rem] uppercase tracking-[0.14em] text-white/92">
                Live Broadcast
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-gp-sans text-[1.4rem] font-light tracking-[0.05em] text-white tabular-nums">
            {format(currentTime, 'HH:mm:ss')}
          </div>
          <div className="font-gp-sans text-[0.6rem] tracking-[0.15em] text-[color:var(--gp-muted)] mt-1">
            {format(currentTime, 'EEE, MMM dd')}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Broadcast Status Indicator
 */
export function BroadcastStatus({ isLive }: { isLive: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      {isLive ? (
        <>
          <div className="relative">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <div className="absolute inset-0 w-2 h-2 bg-white rounded-full animate-ping"></div>
          </div>
          <span className="text-white font-gp-sans font-medium text-[10px] uppercase tracking-[0.3em]">
            Live
          </span>
        </>
      ) : (
        <>
          <div className="w-2 h-2 bg-[color:var(--gp-muted)] rounded-full opacity-70"></div>
          <span className="text-[color:var(--gp-muted)] font-gp-sans font-medium text-[10px] uppercase tracking-[0.3em]">
            Offline
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Waveform Visualization Component
 */
export function Waveform({
  audioData,
  isPlaying,
}: {
  audioData: number[];
  isPlaying: boolean;
}) {
  const minHeight = 8;
  const maxHeight = 64;
  const bars = audioData.slice(0, 44);

  return (
    <div className="relative px-6 py-2 border-y border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-1/2 h-10 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.1)_35%,transparent_75%)]"
      />
      <div className="relative flex items-end justify-center gap-[3px] h-16">
      {bars.map((value, i) => {
        const shaped = Math.min(1, value * 1.15 + Math.abs(Math.sin(i * 0.28)) * 0.1);
        const height = isPlaying ? Math.max(minHeight, shaped * maxHeight) : minHeight + (i % 5 === 0 ? 2 : 0);
        return (
          <div
            key={i}
            className="w-[3px] rounded-[2px] will-change-transform"
            style={{
              height: `${height}px`,
              background: isPlaying
                ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(214,233,255,0.95) 55%, rgba(149,181,220,0.95) 100%)"
                : "linear-gradient(180deg, rgba(214,233,255,0.55) 0%, rgba(149,181,220,0.45) 100%)",
              boxShadow: isPlaying ? "0 0 10px rgba(216,234,255,0.35)" : "none",
              opacity: isPlaying ? 0.45 + shaped * 0.55 : 0.26,
              transform: 'translateZ(0)',
              transition: 'height 0.07s linear, opacity 0.07s linear',
            }}
          />
        );
      })}
      <div
        aria-hidden="true"
        className={[
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border",
          isPlaying
            ? "border-white/80 bg-white/60 shadow-[0_0_14px_rgba(216,234,255,0.7)]"
            : "border-white/35 bg-white/20",
        ].join(" ")}
      />
      </div>
    </div>
  );
}

/**
 * Currently Playing Song Display
 */
export function CurrentSongDisplay({
  title,
  isLive,
  label = "Now Playing",
}: {
  title: string;
  isLive: boolean;
  label?: string;
}) {
  const hasTrack = Boolean(title && title.trim().length > 0);
  return (
    <div className="relative border-b border-white/20 bg-[rgba(255,255,255,0.06)]">
      <div className="relative px-7 py-7 text-center">
        <BroadcastStatus isLive={isLive} />

        {hasTrack ? (
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-[9px] text-[color:var(--gp-subtle)] uppercase tracking-[0.15em] mb-2 font-gp-sans">
                {label}
              </div>
              <h2 className="font-gp-display text-[1.4rem] italic text-[color:var(--gp-white)] leading-snug px-2">
                {title}
              </h2>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="font-gp-display text-[1.4rem] italic text-[color:var(--gp-muted)]">
              No Broadcast
            </div>
            <div className="mt-2 font-gp-sans text-[0.65rem] tracking-[0.15em] uppercase text-[color:var(--gp-subtle)]">
              Check back soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Volume Control Component
 */
export function VolumeControl({
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
}: {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (value: number) => void;
  onMuteToggle: () => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="font-gp-sans text-[0.55rem] tracking-[0.2em] uppercase text-white/80 mb-2">
        Volume
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onMuteToggle}
          className="w-9 h-9 rounded-full border border-white/35 text-white/90 hover:bg-white/20 hover:text-white transition-colors inline-flex items-center justify-center"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Volume2 className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="w-full h-[2px] rounded appearance-none cursor-pointer
                     bg-[rgba(248,244,236,0.15)]
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-white
                     [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(216,234,255,0.5)]"
            style={{
              background: `linear-gradient(90deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) ${volume}%, rgba(248,244,236,0.15) ${volume}%, rgba(248,244,236,0.15) 100%)`,
            }}
            aria-label="Volume"
          />
          <div className="font-gp-sans text-[0.6rem] text-[color:var(--gp-muted)] mt-2 text-right">
            {volume}%
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Power Control (Play/Pause Button)
 */
export function PowerControl({
  isPlaying,
  isStreaming,
  hasPlayableContent = true,
  onTogglePlayPause,
}: {
  isPlaying: boolean;
  isStreaming: boolean;
  hasPlayableContent?: boolean;
  onTogglePlayPause: () => void;
}) {
  const canPlay = hasPlayableContent;
  return (
    <div className="flex flex-col items-center">
      <div className="font-gp-sans text-[0.55rem] tracking-[0.2em] uppercase text-white/80 mb-2">
        Power
      </div>
      <button
        onClick={onTogglePlayPause}
        disabled={!canPlay}
        className={[
          "relative w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center",
          "transition-all duration-300 will-change-transform hover:scale-105 active:scale-95",
          canPlay
            ? "border border-white/40 text-white/90 hover:bg-white/20 hover:text-white"
            : "border border-white/25 opacity-40 cursor-not-allowed text-white/60",
        ].join(" ")}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        <span
          aria-hidden="true"
          className="absolute -inset-1 rounded-full border border-white/25 opacity-35"
        />
        {isPlaying && canPlay ? (
          <Pause
            className="h-5 w-5 relative z-10"
            strokeWidth={1.5}
          />
        ) : (
          <Play
            className="h-5 w-5 ml-0.5 relative z-10"
            strokeWidth={1.5}
          />
        )}
      </button>
    </div>
  );
}

/**
 * Listener Count Display
 */
export function ListenerCount({ count }: { count: number }) {
  return (
    <div className="flex-1 text-right">
      <div className="font-gp-sans text-[0.55rem] tracking-[0.2em] uppercase text-white/80 mb-2">
        Listeners
      </div>
      <div className="border-l border-white/25 pl-6">
        <div className="font-gp-display text-[1.8rem] font-semibold leading-none text-white tabular-nums">
          {count}
        </div>
        <div className="font-gp-sans text-[0.55rem] tracking-[0.2em] uppercase text-white/75 mt-1">
          Live Now
        </div>
      </div>
    </div>
  );
}

/**
 * Decorative Radio Tuner Dial
 */
export function RadioTunerDial() {
  return (
    <div className="border-t border-white/20">
      <div className="h-6 flex items-center justify-center gap-1 px-6 opacity-20">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="w-[2px] h-3 bg-white/75 rounded-[1px]" />
        ))}
      </div>
    </div>
  );
}

/**
 * WhatsApp Contact Button
 */
export function WhatsappContactButton() {
  const whatsappNumber = "36704066713";
  const whatsappMessage = "Hello Golden Pearl Radio";

  return (
    <a
      href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-gp-sans font-semibold text-[0.68rem] uppercase tracking-[0.1em] border border-white/25 transition-colors shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      Contact us
    </a>
  );
}
