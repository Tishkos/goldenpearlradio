export type ScheduleKind = "programme" | "podcast";

export type ScheduleItem = {
  id: string;
  kind: ScheduleKind;
  title: string;
  description: string;
  imageUrl?: string | null;
  startAt: string; // ISO
  interestedCount: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

const SCHEDULE_KEY = "gp_schedule_items_v1";
const INTEREST_KEY = "gp_schedule_interest_v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): ScheduleItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const cleaned = parsed.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const time = new Date((item as ScheduleItem).startAt).getTime();
      return Number.isFinite(time) && time >= now;
    }) as ScheduleItem[];

    if (cleaned.length !== parsed.length) {
      writeAll(cleaned);
      const validIds = new Set(cleaned.map((item) => item.id));
      const interest = readInterestMap();
      const nextInterest: Record<string, true> = {};
      Object.keys(interest).forEach((id) => {
        if (validIds.has(id)) nextInterest[id] = true;
      });
      writeInterestMap(nextInterest);
    }

    return cleaned;
  } catch {
    return [];
  }
}

function writeAll(items: ScheduleItem[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(items));
}

export function getScheduleItems(kind: ScheduleKind): ScheduleItem[] {
  return readAll()
    .filter((i) => i.kind === kind)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export function getScheduleItemById(kind: ScheduleKind, id: string): ScheduleItem | null {
  return readAll().find((i) => i.kind === kind && i.id === id) ?? null;
}

export function upsertScheduleItem(
  payload: Omit<ScheduleItem, "id" | "createdAt" | "updatedAt" | "interestedCount"> & {
    id?: string;
    interestedCount?: number;
  }
): ScheduleItem {
  const all = readAll();
  const now = new Date().toISOString();

  if (payload.id) {
    const idx = all.findIndex((i) => i.id === payload.id && i.kind === payload.kind);
    if (idx >= 0) {
      const updated: ScheduleItem = {
        ...all[idx],
        ...payload,
        imageUrl: payload.imageUrl ?? null,
        updatedAt: now,
      };
      all[idx] = updated;
      writeAll(all);
      return updated;
    }
  }

  const created: ScheduleItem = {
    id: payload.id ?? `${payload.kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind: payload.kind,
    title: payload.title,
    description: payload.description,
    imageUrl: payload.imageUrl ?? null,
    startAt: payload.startAt,
    interestedCount: payload.interestedCount ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  all.push(created);
  writeAll(all);
  return created;
}

export function deleteScheduleItem(kind: ScheduleKind, id: string) {
  const all = readAll().filter((i) => !(i.kind === kind && i.id === id));
  writeAll(all);
}

function readInterestMap(): Record<string, true> {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(INTEREST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeInterestMap(map: Record<string, true>) {
  if (!canUseStorage()) return;
  localStorage.setItem(INTEREST_KEY, JSON.stringify(map));
}

export function hasInterested(itemId: string): boolean {
  const map = readInterestMap();
  return !!map[itemId];
}

export function markInterested(kind: ScheduleKind, id: string): ScheduleItem | null {
  const interest = readInterestMap();
  if (interest[id]) {
    return getScheduleItemById(kind, id);
  }

  const all = readAll();
  const idx = all.findIndex((i) => i.kind === kind && i.id === id);
  if (idx < 0) return null;

  const updated: ScheduleItem = {
    ...all[idx],
    interestedCount: (all[idx].interestedCount || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  writeAll(all);

  interest[id] = true;
  writeInterestMap(interest);
  return updated;
}

export function getUpcomingByWindow(kind: ScheduleKind, days: number): ScheduleItem[] {
  const now = Date.now();
  const end = now + days * 24 * 60 * 60 * 1000;
  return getScheduleItems(kind).filter((item) => {
    const t = new Date(item.startAt).getTime();
    return t >= now && t <= end;
  });
}
