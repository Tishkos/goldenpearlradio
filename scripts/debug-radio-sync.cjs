const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function partsInTz(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return map;
}

function fmtSec(total) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function getStreamCurrent(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/stream/current`);
    const json = await res.json();
    return { ok: true, status: res.status, data: json };
  } catch (error) {
    return { ok: false, status: 0, error: String(error) };
  }
}

async function main() {
  const tz = process.env.STREAM_TIMEZONE || "Europe/Budapest";
  const baseUrl = process.env.STREAM_BASE_URL || "http://localhost:3001";
  const now = new Date();
  const p = partsInTz(now, tz);
  const dateKey = `${p.year}-${p.month}-${p.day}`;
  const nowSec = Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second);

  const show = await prisma.show.findFirst({
    where: { isActive: true, title: "Golden Pearl Radio Timeline" },
    select: { id: true },
  });

  if (!show) {
    console.log("No 'Golden Pearl Radio Timeline' show found.");
    return;
  }

  const items = await prisma.showItem.findMany({
    where: { showId: show.id, date: dateKey },
    orderBy: { position: "asc" },
    select: {
      id: true,
      contentType: true,
      contentId: true,
      startTimeOffset: true,
      playbackStartTime: true,
      playbackEndTime: true,
    },
  });

  const trackIds = items.filter((i) => i.contentType === "TRACK").map((i) => i.contentId);
  const tracks = trackIds.length
    ? await prisma.track.findMany({
        where: { id: { in: trackIds } },
        select: { id: true, title: true, duration: true, url: true },
      })
    : [];
  const trackMap = new Map(tracks.map((t) => [t.id, t]));

  const enriched = items
    .map((item) => {
      if (item.contentType !== "TRACK") return null;
      const track = trackMap.get(item.contentId);
      if (!track?.url) return null;
      const start = item.startTimeOffset || 0;
      const playbackStart = (item.playbackStartTime || 0) / 1000;
      const playbackEnd = item.playbackEndTime ? item.playbackEndTime / 1000 : track.duration || 180;
      const duration = Math.max(1, playbackEnd - playbackStart);
      const end = start + duration;
      return {
        id: item.id,
        title: track.title || "Untitled",
        start,
        end,
        playbackStart,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const current = enriched.find((i) => nowSec >= i.start && nowSec < i.end) || null;
  const next = enriched.find((i) => i.start > nowSec) || null;
  const stream = await getStreamCurrent(baseUrl);

  const expected = {
    timezone: tz,
    nowLocal: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`,
    nowSeconds: nowSec,
    nowHMS: fmtSec(nowSec),
    dateKey,
    current: current
      ? {
          id: current.id,
          title: current.title,
          window: `${fmtSec(current.start)} -> ${fmtSec(current.end)}`,
          secondsInto: nowSec - current.start,
          expectedAudioFilePosition: current.playbackStart + (nowSec - current.start),
        }
      : null,
    next: next
      ? {
          id: next.id,
          title: next.title,
          startsAt: fmtSec(next.start),
          secondsUntil: next.start - nowSec,
        }
      : null,
  };

  console.log("=== Expected From Radio Editor Timeline ===");
  console.log(JSON.stringify(expected, null, 2));
  console.log("=== Actual /api/stream/current ===");
  console.log(JSON.stringify(stream, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

