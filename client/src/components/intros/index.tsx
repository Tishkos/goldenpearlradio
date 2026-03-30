import { lazy, Suspense } from "react";
import type { ComponentType } from "react";

const LinesMatrix = lazy(() => import("./LinesMatrix"));
const MonkeyGiraffeJazz = lazy(() => import("./MonkeyGiraffeJazz"));
const ArrowIntroduction = lazy(() => import("./ArrowIntroduction"));

export const INTRO_IDS = ["lines-matrix", "monkey-giraffe-jazz", "arrow-introduction"] as const;
export type IntroId = (typeof INTRO_IDS)[number];

export const INTRO_LABELS: Record<IntroId, string> = {
  "lines-matrix": "Lines Matrix",
  "monkey-giraffe-jazz": "Monkey Giraffe Jazz",
  "arrow-introduction": "Arrow Introduction",
};

const INTRO_COMPONENTS: Record<IntroId, ComponentType<{ onFinish: () => void }>> = {
  "lines-matrix": LinesMatrix,
  "monkey-giraffe-jazz": MonkeyGiraffeJazz,
  "arrow-introduction": ArrowIntroduction,
};

const STORAGE_KEY = "radio-todays-intro";

export function getStoredIntroId(): IntroId | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v && INTRO_IDS.includes(v as IntroId) ? (v as IntroId) : null;
}

export function setStoredIntroId(id: IntroId | null): void {
  if (typeof window === "undefined") return;
  if (id == null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, id);
}

export function getIntroComponent(id: IntroId): ComponentType<{ onFinish: () => void }> {
  return INTRO_COMPONENTS[id];
}

interface IntroScreenProps {
  id: IntroId;
  onFinish: () => void;
}

export function IntroScreen({ id, onFinish }: IntroScreenProps) {
  const Component = INTRO_COMPONENTS[id];
  if (!Component) return null;
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[100] bg-black" />}>
      <Component onFinish={onFinish} />
    </Suspense>
  );
}
