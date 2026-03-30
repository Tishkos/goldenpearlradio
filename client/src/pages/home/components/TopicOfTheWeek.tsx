import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { fetchScheduleItems, type ScheduleItem, type ScheduleKind } from "@/lib/schedule-api";

type TopicPick = {
  item: ScheduleItem;
  kind: ScheduleKind;
};

function getTopicPick(all: TopicPick[]): TopicPick | null {
  if (all.length === 0) return null;

  all.sort((a, b) => {
    const interestedDiff = (b.item.interestedCount || 0) - (a.item.interestedCount || 0);
    if (interestedDiff !== 0) return interestedDiff;
    if (a.kind !== b.kind) return a.kind === "podcast" ? -1 : 1;
    return new Date(a.item.startAt).getTime() - new Date(b.item.startAt).getTime();
  });

  return all[0];
}

export default function TopicOfTheWeek() {
  const { data: items = [] } = useQuery<ScheduleItem[]>({
    queryKey: ["schedule-items", "all"],
    queryFn: () => fetchScheduleItems(),
    staleTime: 30_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const topic = useMemo(() => {
    const all: TopicPick[] = items.map((item) => ({ item, kind: item.kind }));
    return getTopicPick(all);
  }, [items]);

  const targetHref = useMemo(() => {
    if (!topic) return null;
    return topic.kind === "podcast" ? `/podcasts/${topic.item.id}` : `/programme/${topic.item.id}`;
  }, [topic]);

  return (
    <div className="flex flex-col gap-2 text-center">
      <p className="font-gp-sans text-[0.7rem] tracking-[0.18em] uppercase text-white/85">
        Topic of the Week
      </p>

      {topic ? (
        <>
          <p className="font-gp-display text-[1rem] text-white leading-relaxed">{topic.item.title}</p>
          <p className="font-gp-serif text-[0.82rem] text-white/80 leading-relaxed line-clamp-2">
            {topic.item.description || "Most interested editorial topic from our audience this week."}
          </p>
          <p className="font-gp-sans text-[0.62rem] uppercase tracking-[0.12em] text-white/70">
            {topic.kind === "podcast" ? "Podcast" : "Programme"} | {topic.item.interestedCount} interested
          </p>
          {targetHref ? (
            <div className="pt-1">
              <Link
                href={targetHref}
                className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-white/15 px-3 py-1.5 text-[0.62rem] font-gp-sans uppercase tracking-[0.1em] text-white hover:bg-white/25 transition-colors"
              >
                Open Topic
              </Link>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="max-w-[24rem] font-gp-serif text-[0.9rem] text-white/80 leading-relaxed">
            This space highlights Golden Pearl Radio's weekly editorial focus. Featured programme and
            podcast topics will appear here as soon as they are scheduled.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Link
              href="/programme"
              className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-3 py-1.5 text-[0.62rem] font-gp-sans uppercase tracking-[0.1em] text-white hover:bg-white/20 transition-colors"
            >
              Browse Programme
            </Link>
            <Link
              href="/podcasts"
              className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-3 py-1.5 text-[0.62rem] font-gp-sans uppercase tracking-[0.1em] text-white hover:bg-white/20 transition-colors"
            >
              Browse Podcasts
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
