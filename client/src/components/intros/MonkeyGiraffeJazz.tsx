import { useEffect } from "react";

const DURATION_MS = 5000; // 5 seconds

interface MonkeyGiraffeJazzProps {
  onFinish: () => void;
}

/** Placeholder for "Monkey Giraffe Jazz" intro – animation to be added. No skip; plays full duration. */
export default function MonkeyGiraffeJazz({ onFinish }: MonkeyGiraffeJazzProps) {
  useEffect(() => {
    const t = setTimeout(onFinish, DURATION_MS);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-amber-950 text-amber-100">
      <div className="text-2xl font-bold tracking-widest opacity-90">MONKEY GIRAFFE JAZZ</div>
      <p className="mt-2 text-sm text-amber-200/70">Intro animation placeholder</p>
    </div>
  );
}
