type RadioTimelineSyncPayload = {
  dateKey: string;
  updatedAt: number;
  source: string;
};

const RADIO_TIMELINE_SYNC_CHANNEL = "golden-pearl-radio-timeline-sync";
const RADIO_TIMELINE_SYNC_STORAGE_KEY = "golden-pearl-radio-timeline-sync:last";

let channelInstance: BroadcastChannel | null | undefined;
const pendingTimers = new Map<string, number>();

const getChannel = () => {
  if (channelInstance !== undefined) return channelInstance;
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    channelInstance = null;
    return channelInstance;
  }
  channelInstance = new BroadcastChannel(RADIO_TIMELINE_SYNC_CHANNEL);
  return channelInstance;
};

export const broadcastRadioTimelineSync = (dateKey: string, source = "radio-editor") => {
  if (typeof window === "undefined") return;

  const payload: RadioTimelineSyncPayload = {
    dateKey,
    updatedAt: Date.now(),
    source,
  };

  const channel = getChannel();
  channel?.postMessage(payload);

  try {
    localStorage.setItem(RADIO_TIMELINE_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
};

export const scheduleRadioTimelineSyncBroadcast = (
  dateKey: string,
  source = "radio-editor",
  delayMs = 250
) => {
  if (typeof window === "undefined") return;

  const existingTimer = pendingTimers.get(dateKey);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const nextTimer = window.setTimeout(() => {
    pendingTimers.delete(dateKey);
    broadcastRadioTimelineSync(dateKey, source);
  }, delayMs);

  pendingTimers.set(dateKey, nextTimer);
};

export const subscribeToRadioTimelineSync = (
  listener: (payload: RadioTimelineSyncPayload) => void
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let lastHandledAt = 0;
  const handlePayload = (payload: RadioTimelineSyncPayload | null | undefined) => {
    if (!payload?.dateKey || !payload.updatedAt) return;
    if (payload.updatedAt <= lastHandledAt) return;
    lastHandledAt = payload.updatedAt;
    listener(payload);
  };

  const channel = getChannel();
  const onMessage = (event: MessageEvent<RadioTimelineSyncPayload>) => {
    handlePayload(event.data);
  };
  channel?.addEventListener("message", onMessage);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== RADIO_TIMELINE_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      handlePayload(JSON.parse(event.newValue) as RadioTimelineSyncPayload);
    } catch {
      // no-op
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    channel?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
  };
};
