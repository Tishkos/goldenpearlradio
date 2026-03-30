import { useEffect } from "react";

const DURATION_MS = 5500; // 5.5 seconds total

const ROWS: { text: string; direction: "ltr" | "rtl" }[] = [
  { text: "Welcome to", direction: "ltr" },
  { text: "Golden Pearl Radio", direction: "rtl" },
  { text: "Ultimate Audio Experience", direction: "ltr" },
  { text: "The Best Music, News, and Entertainment", direction: "rtl" },
];

const ARROW_IMG = "/arrow.png";

/* Vibrant palette gradient: deep blue → cyan → green → orange → red → magenta */
const ARROW_GRADIENT =
  "linear-gradient(90deg, #2563eb 0%, #22b8cf 20%, #0d9488 40%, #ea580c 60%, #e63946 75%, #c026d3 100%)";

interface ArrowIntroductionProps {
  onFinish: () => void;
}

/** Arrow shape filled with vibrant gradient via CSS mask. */
function ArrowBar({
  flip,
  className,
}: {
  flip?: boolean;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: ARROW_GRADIENT,
        WebkitMaskImage: `url(${ARROW_IMG})`,
        maskImage: `url(${ARROW_IMG})`,
        WebkitMaskSize: "cover",
        maskSize: "cover",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        transform: flip ? "scaleX(-1)" : undefined,
      }}
      aria-hidden
    />
  );
}

/** Arrow intro: 4 arrows (arrow shape with vibrant gradient) with text on each, overlay on main page. */
export default function ArrowIntroduction({ onFinish }: ArrowIntroductionProps) {
  useEffect(() => {
    const t = setTimeout(onFinish, DURATION_MS);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 md:gap-7 pointer-events-none"
      style={{ background: "transparent" }}
    >
      {/* Arrow 1: left → right, little top */}
      <div
        className="relative w-full max-w-2xl mx-auto h-20 md:h-24 arrow-intro-ltr flex items-stretch"
        style={{ animationDelay: "0s", marginTop: "-4rem" }}
      >
        <ArrowBar className="absolute inset-0 w-full h-full" />
        <div className="relative z-10 flex items-center justify-center w-full px-6">
          <span className="text-white font-semibold text-lg md:text-xl tracking-wide drop-shadow-md">
            {ROWS[0].text}
          </span>
        </div>
      </div>

      {/* Arrow 2: right → left */}
      <div
        className="relative w-full max-w-2xl mx-auto h-20 md:h-24 arrow-intro-rtl flex items-stretch"
        style={{ animationDelay: "0.4s" }}
      >
        <ArrowBar flip className="absolute inset-0 w-full h-full" />
        <div className="relative z-10 flex items-center justify-center w-full px-6">
          <span className="text-white font-semibold text-lg md:text-xl tracking-wide drop-shadow-md">
            {ROWS[1].text}
          </span>
        </div>
      </div>

      {/* Arrow 3: left → right */}
      <div
        className="relative w-full max-w-2xl mx-auto h-20 md:h-24 arrow-intro-ltr flex items-stretch"
        style={{ animationDelay: "0.8s" }}
      >
        <ArrowBar className="absolute inset-0 w-full h-full" />
        <div className="relative z-10 flex items-center justify-center w-full px-6">
          <span className="text-white font-semibold text-lg md:text-xl tracking-wide drop-shadow-md">
            {ROWS[2].text}
          </span>
        </div>
      </div>

      {/* Arrow 4: right → left */}
      <div
        className="relative w-full max-w-2xl mx-auto h-20 md:h-24 arrow-intro-rtl flex items-stretch"
        style={{ animationDelay: "1.2s" }}
      >
        <ArrowBar flip className="absolute inset-0 w-full h-full" />
        <div className="relative z-10 flex items-center justify-center w-full px-6">
          <span className="text-white font-semibold text-lg md:text-xl tracking-wide drop-shadow-md text-center">
            {ROWS[3].text}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes arrow-intro-ltr-keyframes {
          0% { opacity: 0; transform: translateX(-80%); }
          22% { opacity: 1; transform: translateX(0); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes arrow-intro-rtl-keyframes {
          0% { opacity: 0; transform: translateX(80%); }
          22% { opacity: 1; transform: translateX(0); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .arrow-intro-ltr {
          animation: arrow-intro-ltr-keyframes 1.2s ease-out forwards;
          opacity: 0;
        }
        .arrow-intro-rtl {
          animation: arrow-intro-rtl-keyframes 1.2s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
