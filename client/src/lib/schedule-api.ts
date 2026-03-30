import { api } from "@/lib/api-client";
import {
  deleteScheduleItem as deleteLocalScheduleItem,
  getScheduleItems as getLocalScheduleItems,
  markInterested as markLocalInterested,
  upsertScheduleItem as upsertLocalScheduleItem,
  type ScheduleItem as LocalScheduleItem,
} from "@/lib/schedule-store";

export type ScheduleKind = "programme" | "podcast";

export type ScheduleItem = {
  id: number;
  kind: ScheduleKind;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startAt: string;
  interestedCount: number;
  createdAt: string;
  updatedAt: string;
};

const DEVICE_KEY = "gp_schedule_device_id_v1";
const SCHEDULE_ENDPOINT_KEY = "gp_schedule_endpoint_available_v1";

function readStoredScheduleEndpointAvailability(): boolean | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(SCHEDULE_ENDPOINT_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

let scheduleEndpointAvailable: boolean | null = readStoredScheduleEndpointAvailability();

function useRemoteScheduleApi() {
  const env = String(import.meta.env.VITE_SCHEDULE_REMOTE_API || "").toLowerCase();
  if (env === "false" || env === "0" || env === "off" || env === "local") return false;
  return true;
}

function getScheduleApiBase() {
  return import.meta.env.VITE_API_URL || "http://127.0.0.1:3001/api";
}

async function publicScheduleRequest<T>(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${getScheduleApiBase()}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: `HTTP error! status: ${response.status}` };
    }
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function getLocalItems(kind?: ScheduleKind) {
  if (kind) return getLocalScheduleItems(kind).map(toApiItem);
  return [...getLocalScheduleItems("programme"), ...getLocalScheduleItems("podcast")].map(toApiItem);
}

function setScheduleEndpointAvailability(value: boolean | null) {
  scheduleEndpointAvailable = value;
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  if (value === null) {
    localStorage.removeItem(SCHEDULE_ENDPOINT_KEY);
    return;
  }
  localStorage.setItem(SCHEDULE_ENDPOINT_KEY, value ? "true" : "false");
}

function shouldFallbackToLocal(error: unknown) {
  const message = String((error as any)?.message || "").toLowerCase();
  return (
    message.includes("401") ||
    message.includes("unauthorized") ||
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("backend server is not running") ||
    message.includes("failed to fetch") ||
    message.includes("connection refused") ||
    message.includes("no token provided") ||
    message.includes("authentication failed") ||
    message.includes("forbidden")
  );
}

function resolveLocalItemById(id: number, kind?: ScheduleKind): LocalScheduleItem | null {
  const candidates = kind
    ? getLocalScheduleItems(kind)
    : [...getLocalScheduleItems("programme"), ...getLocalScheduleItems("podcast")];

  return (
    candidates.find((item) => {
      const parsed = Number(item.id);
      if (Number.isFinite(parsed) && parsed === id) return true;
      return Math.abs(hashCode(item.id)) === id;
    }) ?? null
  );
}

function toApiItem(item: LocalScheduleItem): ScheduleItem {
  const parsed = Number(item.id);
  return {
    id: Number.isFinite(parsed) ? parsed : Math.abs(hashCode(item.id)),
    kind: item.kind,
    title: item.title,
    description: item.description,
    imageUrl: item.imageUrl ?? null,
    startAt: item.startAt,
    interestedCount: item.interestedCount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function hashCode(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function getScheduleDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (id) return id;
  id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

export async function fetchScheduleItems(kind?: ScheduleKind) {
  if (!useRemoteScheduleApi()) {
    return getLocalItems(kind);
  }

  const endpoint = kind ? `/schedule-items?kind=${kind}` : "/schedule-items";
  try {
    const result = await publicScheduleRequest<ScheduleItem[]>(endpoint);
    setScheduleEndpointAvailability(true);
    return result;
  } catch (error: any) {
    if (shouldFallbackToLocal(error)) {
      setScheduleEndpointAvailability(null);
      return getLocalItems(kind);
    }
    throw error;
  }
}

export async function createScheduleItem(input: {
  kind: ScheduleKind;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startAt: string;
}) {
  if (!useRemoteScheduleApi() || scheduleEndpointAvailable === false) {
    const created = upsertLocalScheduleItem({
      kind: input.kind,
      title: input.title,
      description: input.description || "",
      imageUrl: input.imageUrl ?? null,
      startAt: input.startAt,
    });
    return toApiItem(created);
  }
  try {
    const created = await api.post<ScheduleItem>("/schedule-items", input);
    setScheduleEndpointAvailability(true);
    return created;
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error;
    setScheduleEndpointAvailability(false);
    const created = upsertLocalScheduleItem({
      kind: input.kind,
      title: input.title,
      description: input.description || "",
      imageUrl: input.imageUrl ?? null,
      startAt: input.startAt,
    });
    return toApiItem(created);
  }
}

export async function updateScheduleItem(
  id: number,
  input: {
    kind: ScheduleKind;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    startAt: string;
  }
) {
  if (!useRemoteScheduleApi() || scheduleEndpointAvailable === false) {
    const existing = resolveLocalItemById(id, input.kind);
    const updated = upsertLocalScheduleItem({
      id: existing?.id ?? String(id),
      kind: input.kind,
      title: input.title,
      description: input.description || "",
      imageUrl: input.imageUrl ?? null,
      startAt: input.startAt,
    });
    return toApiItem(updated);
  }
  try {
    const updated = await api.put<ScheduleItem>(`/schedule-items/${id}`, input);
    setScheduleEndpointAvailability(true);
    return updated;
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error;
    setScheduleEndpointAvailability(false);
    const existing = resolveLocalItemById(id, input.kind);
    const updated = upsertLocalScheduleItem({
      id: existing?.id ?? String(id),
      kind: input.kind,
      title: input.title,
      description: input.description || "",
      imageUrl: input.imageUrl ?? null,
      startAt: input.startAt,
    });
    return toApiItem(updated);
  }
}

export async function deleteScheduleItem(id: number) {
  if (!useRemoteScheduleApi() || scheduleEndpointAvailable === false) {
    const localItem = resolveLocalItemById(id);
    if (localItem) {
      deleteLocalScheduleItem(localItem.kind, localItem.id);
    }
    return { message: "Deleted" };
  }
  try {
    const result = await api.delete<{ message: string }>(`/schedule-items/${id}`);
    setScheduleEndpointAvailability(true);
    return result;
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error;
    setScheduleEndpointAvailability(false);
    const localItem = resolveLocalItemById(id);
    if (localItem) {
      deleteLocalScheduleItem(localItem.kind, localItem.id);
    }
    return { message: "Deleted" };
  }
}

export async function markInterested(id: number) {
  if (!useRemoteScheduleApi()) {
    const localItem = resolveLocalItemById(id);
    if (localItem) {
      const updated = markLocalInterested(localItem.kind, localItem.id);
      if (updated) return toApiItem(updated);
    }
    throw new Error("Schedule item not found");
  }

  const deviceId = getScheduleDeviceId();
  try {
    const updated = await publicScheduleRequest<ScheduleItem>(`/schedule-items/${id}/interested`, {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    });
    setScheduleEndpointAvailability(true);
    return updated;
  } catch (fallbackError) {
    if (!shouldFallbackToLocal(fallbackError)) {
      throw fallbackError;
    }
    setScheduleEndpointAvailability(null);
    const localItem = resolveLocalItemById(id);
    if (localItem) {
      const updated = markLocalInterested(localItem.kind, localItem.id);
      if (updated) return toApiItem(updated);
    }
    throw fallbackError;
  }
}
