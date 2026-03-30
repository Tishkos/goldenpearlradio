import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Podcast, Star } from "lucide-react";
import {
  markInterested,
  fetchScheduleItems,
  type ScheduleItem,
  type ScheduleKind,
} from "@/lib/schedule-api";
import { Button } from "@/components/ui/button";

type SchedulePageProps = {
  kind: ScheduleKind;
};

function upcomingInDays(items: ScheduleItem[], days: number) {
  const now = Date.now();
  const end = now + days * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const time = new Date(item.startAt).getTime();
    return time >= now && time <= end;
  });
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export default function SchedulePage({ kind }: SchedulePageProps) {
  const isPodcast = kind === "podcast";
  const basePath = isPodcast ? "/podcasts" : "/programme";
  const Icon = isPodcast ? Podcast : CalendarDays;
  const heading = isPodcast ? "Podcasts" : "Programme";
  const subtitle = isPodcast
    ? "Upcoming podcasts with timeline and details."
    : "Upcoming programme schedule with timeline and details.";

  const [, detailParams] = useRoute(`${basePath}/:id`);
  const detailId = detailParams?.id;

  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery<ScheduleItem[]>({
    queryKey: ["schedule-items", kind],
    queryFn: () => fetchScheduleItems(kind),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const selected = useMemo(() => {
    if (!detailId) return null;
    return items.find((item) => String(item.id) === String(detailId)) ?? null;
  }, [kind, detailId, items]);

  const yearItems = useMemo(() => upcomingInDays(items, 365), [items]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    items.forEach((item) => {
      const key = dayKey(new Date(item.startAt));
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    map.forEach((list) =>
      list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    );
    return map;
  }, [items]);

  const selectedDayItems = useMemo(() => itemsByDay.get(dayKey(selectedDay)) || [], [itemsByDay, selectedDay]);

  if (detailId) {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 py-14">
          <div className="max-w-4xl w-full glass-card p-8 text-center text-white/85">Loading...</div>
        </div>
      );
    }
    if (!selected) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 py-14">
          <div className="max-w-4xl w-full glass-card p-8 text-center">
            <h1 className="font-gp-display text-3xl text-white">Item not found</h1>
            <Link href={basePath} className="inline-flex mt-5 text-white/90 hover:text-white underline">
              Back to {heading}
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen">
        <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
          <div className="max-w-5xl w-full glass-card p-7 md:p-10">
            <Link href={basePath} className="inline-flex text-sm text-white/90 hover:text-white underline mb-5">
              Back to {heading}
            </Link>

            <div className="rounded-2xl border border-white/25 bg-white/10 overflow-hidden">
              <div className="h-56 md:h-80 bg-white/10">
                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt={selected.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center bg-[linear-gradient(135deg,rgba(74,111,148,0.35),rgba(212,99,42,0.25))]">
                    <Icon className="h-14 w-14 text-white/90" />
                  </div>
                )}
              </div>
              <div className="p-6 md:p-7">
                <h1 className="font-gp-display text-3xl md:text-4xl text-white">{selected.title}</h1>
                <p className="mt-3 text-white/85">{selected.description || "No description available."}</p>
                <p className="mt-4 inline-flex items-center gap-1 text-[11px] tracking-[0.12em] uppercase text-white/70">
                  <Clock className="h-4 w-4" />
                  Starts: {new Date(selected.startAt).toLocaleString()}
                </p>
                <div className="mt-6">
                  <Button
                    type="button"
                    onClick={() => {
                      void markInterested(selected.id)
                        .then(() => queryClient.invalidateQueries({ queryKey: ["schedule-items"] }))
                        .catch(() => {});
                    }}
                    className="rounded-2xl border border-white/25 bg-white/20 text-white hover:bg-white/30"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Star Interested
                  </Button>
                  <span className="ml-3 text-sm text-white/85">{selected.interestedCount} interested</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderCards = (list: ScheduleItem[]) => {
    if (list.length === 0) {
      return (
        <div className="rounded-2xl border border-white/20 bg-white/5 p-8 text-center text-white/75">
          No upcoming items in this window.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((item) => (
          <Link
            key={item.id}
            href={`${basePath}/${item.id}`}
            className="rounded-2xl border border-white/25 bg-white/10 overflow-hidden hover:bg-white/15 hover:border-white/35 transition-colors"
          >
            <div className="h-36 bg-white/10">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center bg-[linear-gradient(135deg,rgba(74,111,148,0.35),rgba(212,99,42,0.25))]">
                  <Icon className="h-10 w-10 text-white/90" />
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-gp-sans font-semibold text-white line-clamp-2">{item.title}</h3>
              <p className="mt-2 text-xs text-white/80 line-clamp-2">{item.description || "No description"}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-[10px] tracking-[0.1em] uppercase text-white/65">
                <Clock className="h-3.5 w-3.5" />
                {new Date(item.startAt).toLocaleString()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  if (kind === "programme") {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const leadingEmpty = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();
    const totalCells = Math.ceil((leadingEmpty + daysInMonth) / 7) * 7;
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const cells: Array<Date | null> = [];
    for (let i = 0; i < totalCells; i += 1) {
      const dayNumber = i - leadingEmpty + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cells.push(null);
      } else {
        cells.push(new Date(year, month, dayNumber));
      }
    }

    const selectedLabel = selectedDay.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return (
      <div className="min-h-screen">
        <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
          <div className="max-w-7xl w-full glass-card p-7 md:p-10">
            <header className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-6 font-gp-sans text-[0.7rem] tracking-[0.3em] uppercase text-white/75">
                <span className="h-px w-14 bg-gradient-to-r from-transparent to-white/55" aria-hidden="true" />
                <span>Programme Calendar</span>
                <span className="h-px w-14 bg-gradient-to-r from-white/55 to-transparent" aria-hidden="true" />
              </div>
              <h1 className="font-gp-display font-bold leading-[1.15] tracking-[-0.01em] text-[clamp(2rem,4vw,3rem)] text-white">
                Programme
              </h1>
              <p className="mt-4 mx-auto max-w-2xl font-gp-serif text-[1.1rem] italic tracking-[0.04em] text-white/85">
                Select a day on the calendar to view programmes scheduled on that day.
              </p>
            </header>

            <section className="rounded-2xl bg-white/10 border border-white/25 p-5 md:p-7 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3 mb-5">
                <Button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                  className="rounded-2xl border border-white/35 bg-white/20 text-white hover:bg-white/30 hover:border-white/45"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Prev
                </Button>
                <h2 className="font-gp-display text-2xl text-white">
                  {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </h2>
                <Button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                  className="rounded-2xl border border-white/35 bg-white/20 text-white hover:bg-white/30 hover:border-white/45"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center py-2 text-[0.68rem] font-gp-sans uppercase tracking-[0.12em] text-white/75"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {cells.map((date, idx) => {
                  if (!date) {
                    return <div key={`empty-${idx}`} className="h-20 rounded-xl bg-white/5 border border-white/10" />;
                  }

                  const key = dayKey(date);
                  const hasItems = (itemsByDay.get(key)?.length || 0) > 0;
                  const isSelected = dayKey(selectedDay) === key;
                  const isToday = dayKey(new Date()) === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDay(date)}
                      className={[
                        "relative h-20 rounded-xl border text-left p-2 transition-colors",
                        isSelected
                          ? "border-[var(--gp-gold-bright)] bg-[rgba(201,168,76,0.2)]"
                          : "border-white/20 bg-white/5 hover:bg-white/10",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between">
                        <span className={["text-sm font-gp-sans", isToday ? "text-[var(--gp-gold-bright)]" : "text-white/90"].join(" ")}>
                          {date.getDate()}
                        </span>
                        {hasItems ? (
                          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-[var(--gp-gold)] text-[var(--gp-navy-deep)] text-[10px] font-semibold">
                            {itemsByDay.get(key)?.length}
                          </span>
                        ) : null}
                      </div>
                      {hasItems ? (
                        <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-[0.1em] text-white/80">
                          Programme
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl bg-white/10 border border-white/25 p-5 md:p-7 backdrop-blur-md mt-6">
              <h3 className="font-gp-sans text-[0.72rem] uppercase tracking-[0.14em] text-[var(--gp-gold-bright)] mb-2">
                {selectedLabel}
              </h3>
              {selectedDayItems.length === 0 ? (
                <div className="rounded-2xl border border-white/20 bg-white/5 p-8 text-center text-white/75">
                  No programme scheduled for this day.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedDayItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`${basePath}/${item.id}`}
                      className="rounded-2xl border border-white/25 bg-white/10 overflow-hidden hover:bg-white/15 hover:border-white/35 transition-colors"
                    >
                      <div className="h-32 bg-white/10">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center bg-[linear-gradient(135deg,rgba(74,111,148,0.35),rgba(212,99,42,0.25))]">
                            <CalendarDays className="h-9 w-9 text-white/90" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h4 className="font-gp-sans font-semibold text-white line-clamp-2">{item.title}</h4>
                        <p className="mt-2 text-xs text-white/80 line-clamp-2">{item.description || "No description"}</p>
                        <p className="mt-2 inline-flex items-center gap-1 text-[10px] tracking-[0.1em] uppercase text-white/65">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(item.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
        <div className="max-w-7xl w-full glass-card p-7 md:p-10">
          <header className="text-center mb-10">
            <div className="flex items-center justify-center gap-4 mb-6 font-gp-sans text-[0.7rem] tracking-[0.3em] uppercase text-white/75">
              <span className="h-px w-14 bg-gradient-to-r from-transparent to-white/55" aria-hidden="true" />
              <span>{heading}</span>
              <span className="h-px w-14 bg-gradient-to-r from-white/55 to-transparent" aria-hidden="true" />
            </div>
            <h1 className="font-gp-display font-bold leading-[1.15] tracking-[-0.01em] text-[clamp(2rem,4vw,3rem)] text-white">
              {heading}
            </h1>
            <p className="mt-4 mx-auto max-w-2xl font-gp-serif text-[1.1rem] italic tracking-[0.04em] text-white/85">
              {subtitle}
            </p>
          </header>

          <section className="rounded-2xl bg-white/10 border border-white/25 p-5 md:p-7 backdrop-blur-md">
            <h2 className="font-gp-sans text-[0.72rem] uppercase tracking-[0.14em] text-[var(--gp-gold-bright)] mb-4">
              Upcoming
            </h2>
            {renderCards(yearItems)}
          </section>
        </div>
      </div>
    </div>
  );
}
