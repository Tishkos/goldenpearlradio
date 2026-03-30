import { useEffect } from "react";

const DURATION_MS = 4500; // 4.5 seconds

interface LinesMatrixProps {
  onFinish: () => void;
}

/** Placeholder for "Lines Matrix" intro – animation to be added. No skip; plays full duration. */
export default function LinesMatrix({ onFinish }: LinesMatrixProps) {
  useEffect(() => {
    const t = setTimeout(onFinish, DURATION_MS);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white">
      <div className="text-2xl font-bold tracking-widest opacity-90">LINES MATRIX</div>
      <p className="mt-2 text-sm text-white/70">Intro animation placeholder</p>
    </div>
  );
}
