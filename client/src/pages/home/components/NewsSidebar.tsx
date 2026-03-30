import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Newspaper, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { api } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface NewsItem {
  id: number;
  sortOrder?: number;
  newsType: string;
  title: string;
  message?: string | null;
  category?: string | null;
  priority?: string;
  createdAt: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkBehavior?: "dialog" | "external";
  location?: { name?: string } | null;
}

type NewsSidebarProps = {
  variant?: "sidebar" | "blocks";
  limit?: number;
};

export default function NewsSidebar({ variant = "sidebar", limit = 15 }: NewsSidebarProps) {
  const queryClient = useQueryClient();
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [, setLocation] = useLocation();

  const openLink = (link: string) => {
    const url = new URL(link, window.location.origin);
    if (url.origin === window.location.origin) {
      setLocation(`${url.pathname}${url.search}${url.hash}`);
      return;
    }
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const getNewsTarget = (item: NewsItem): string | null => {
    if (!item.id) return null;
    return `/news/${item.id}`;
  };

  const { data: newsList = [], isLoading, error } = useQuery<NewsItem[]>({
    queryKey: ["news"],
    queryFn: async () => {
      const data = await api.get<NewsItem[]>("/news");
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30 * 1000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const handleNewsClick = (item: NewsItem) => {
    if (item.linkBehavior === "external" && item.linkUrl) {
      openLink(item.linkUrl);
      return;
    }
    setSelectedNews(item);
  };

  if (error) {
    return (
      <aside className="glass-card p-7 h-full flex flex-col rounded-2xl">
        <div className="font-gp-sans text-[0.65rem] font-medium tracking-[0.2em] uppercase text-white/90 mb-6 flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          Latest News
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-3">
          <div className="h-10 w-10 rounded-full border border-white/25 grid place-items-center text-white/70">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="font-gp-display text-[1rem] italic text-white/80">News Unavailable</p>
          <p className="font-gp-sans text-[0.6rem] tracking-[0.15em] uppercase text-white/60">Service updating</p>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["news"] })}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 border border-white/25 rounded-2xl font-gp-sans text-[0.65rem] uppercase tracking-[0.12em] text-white/80 hover:bg-white/25 hover:text-white hover:border-white/40 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </aside>
    );
  }

  // Blocks variant: individual cards, no scroll, "See more" link
  if (variant === "blocks") {
    const displayed = newsList.slice(0, limit);
    const NewsCard = ({ item }: { item: NewsItem }) => {
      const target = getNewsTarget(item);
      const content = (
        <div className="p-4">
          <div className="flex items-start gap-2">
            {item.newsType?.toLowerCase().includes("breaking") ? (
              <AlertCircle className="h-4 w-4 text-white/90 flex-shrink-0 mt-0.5" />
            ) : null}
            <div className="min-w-0 flex-1">
              <h3 className="font-gp-sans font-semibold text-sm text-white line-clamp-2">{item.title}</h3>
              {item.message ? <p className="text-xs text-white/80 mt-1 line-clamp-2">{item.message}</p> : null}
              <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
                {item.category ? (
                  <span className="text-[10px] font-medium px-2 py-1 rounded-2xl border border-white/25 text-white/80">
                    {item.category}
                  </span>
                ) : null}
                <span className="text-[10px] text-white/60 font-gp-sans tracking-[0.08em] uppercase">
                  {item.createdAt ? format(new Date(item.createdAt), "MMM d, HH:mm") : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      );

      if (target) {
        return (
          <button
            type="button"
            onClick={() => openLink(target)}
            className="relative z-10 pointer-events-auto cursor-pointer block w-full text-left rounded-2xl border border-white/25 bg-white/10 p-0 hover:border-white/35 hover:bg-white/15 transition-colors overflow-hidden backdrop-blur-md"
          >
            {content}
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={() => handleNewsClick(item)}
          className="relative z-10 pointer-events-auto cursor-pointer w-full text-left rounded-2xl border border-white/25 bg-white/10 p-0 hover:border-white/35 hover:bg-white/15 transition-colors overflow-hidden backdrop-blur-md"
        >
          {content}
        </button>
      );
    };

    return (
      <>
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-2xl border border-white/25 p-4 animate-pulse h-40" />
              ))}
            </div>
          ) : newsList.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4">
                {displayed.map((item) => <NewsCard key={item.id} item={item} />)}
              </div>
              <Link
                href="/news"
                className="mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/25 text-white/90 hover:bg-white/15 hover:border-white/40 transition-colors font-gp-sans text-[0.7rem] uppercase tracking-[0.12em]"
              >
                See more news
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <div className="glass-card p-7 text-center rounded-2xl">
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <Newspaper className="h-10 w-10 text-white/50" />
                <p className="font-gp-display text-[1rem] italic text-white/80">No news at the moment</p>
              </div>
            </div>
          )}
        </div>
        <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
          <DialogContent className="sm:max-w-2xl bg-white/10 backdrop-blur-xl border-white/25 text-white max-h-[90vh] overflow-y-auto [&>button]:text-white [&>button]:opacity-100 [&>button]:border [&>button]:border-white/25 [&>button]:rounded-2xl [&>button:hover]:text-white [&>button:hover]:bg-white/15">
            <DialogHeader>
              <DialogTitle className="font-gp-display text-2xl md:text-3xl font-semibold text-white">
                {selectedNews?.title}
              </DialogTitle>
              <DialogDescription className="font-gp-serif text-white/90 text-base leading-relaxed">
                {selectedNews?.message || "Latest update from the station newsroom."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedNews?.category ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border border-white/25 bg-white/10 text-white/80">
                    {selectedNews.category}
                  </span>
                ) : null}
                {selectedNews?.newsType ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border border-white/25 bg-white/10 text-white/80">
                    {selectedNews.newsType}
                  </span>
                ) : null}
              </div>
              <span className="text-xs text-white/60 font-gp-sans tracking-[0.08em] uppercase">
                {selectedNews?.createdAt ? format(new Date(selectedNews.createdAt), "PPP p") : ""}
              </span>
            </div>
            {selectedNews?.linkUrl ? (
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => openLink(selectedNews.linkUrl || "")}
                  className="bg-white/25 hover:bg-white/35 text-white font-sans text-sm font-semibold tracking-normal border border-white/30"
                >
                  Open Link
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <aside className="glass-card h-full flex flex-col">
        <div className="px-7 pt-7 pb-5">
          <div className="font-gp-sans text-[0.65rem] font-medium tracking-[0.2em] uppercase text-white/90 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              Latest News
            </span>
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["news"] })}
              className="inline-flex items-center gap-2 text-[0.65rem] tracking-[0.12em] uppercase font-gp-sans text-white/70 hover:text-white transition-colors"
              aria-label="Refresh news"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="px-7 pb-7 flex-1 overflow-y-auto space-y-3 gp-scrollbar pr-1">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/25 bg-white/10 p-4 animate-pulse"
              >
                <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                <div className="h-3 bg-white/10 rounded w-full mb-1" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            ))
          ) : newsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
              <div className="h-10 w-10 rounded-full border border-white/25 grid place-items-center text-white/70">
                <Newspaper className="h-5 w-5" />
              </div>
              <p className="font-gp-display text-[1rem] italic text-white/80">No news at the moment</p>
              <p className="font-gp-sans text-[0.6rem] tracking-[0.15em] uppercase text-white/80">
                UAE · Culture · Music
              </p>
            </div>
          ) : (
            newsList.slice(0, 15).map((item) => {
              const target = getNewsTarget(item);
              const content = (
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    {item.newsType?.toLowerCase().includes("breaking") ? (
                      <AlertCircle className="h-4 w-4 text-[#4A6F94] flex-shrink-0 mt-0.5" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-gp-sans font-semibold text-sm text-white line-clamp-2">
                        {item.title}
                      </h3>
                      {item.message ? (
                        <p className="text-xs text-white/80 mt-2 line-clamp-2">
                          {item.message}
                        </p>
                      ) : null}
                      <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
                        {item.category ? (
                          <span className="text-[10px] font-medium px-2 py-1 rounded-2xl border border-white/25 text-white/80">
                            {item.category}
                          </span>
                        ) : null}
                        <span className="text-[10px] text-white/60 font-gp-sans tracking-[0.08em] uppercase">
                          {item.createdAt ? format(new Date(item.createdAt), "MMM d, HH:mm") : ""}
                        </span>
                      </div>
                      {item.linkBehavior === "external" && item.linkUrl ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-gp-sans uppercase tracking-[0.1em] text-white/90">
                          Open Link
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );

              if (target) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openLink(target)}
                    className="relative z-10 pointer-events-auto cursor-pointer block w-full text-left rounded-2xl border border-white/25 bg-white/10 p-0 hover:border-white/35 hover:bg-white/15 transition-colors overflow-hidden backdrop-blur-md"
                  >
                    {content}
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNewsClick(item)}
                  className="relative z-10 pointer-events-auto cursor-pointer w-full text-left rounded-2xl border border-white/25 bg-white/10 p-0 hover:border-white/35 hover:bg-white/15 transition-colors overflow-hidden backdrop-blur-md"
                >
                  {content}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className="sm:max-w-2xl bg-white/10 backdrop-blur-xl border-white/25 text-white max-h-[90vh] overflow-y-auto [&>button]:text-white [&>button]:opacity-100 [&>button]:border [&>button]:border-white/25 [&>button]:rounded-2xl [&>button:hover]:text-white [&>button:hover]:bg-white/15">
          <DialogHeader>
            <DialogTitle className="font-gp-display text-2xl md:text-3xl font-semibold text-white">
              {selectedNews?.title}
            </DialogTitle>
            <DialogDescription className="font-gp-serif text-white/90 text-base leading-relaxed">
              {selectedNews?.message || "Latest update from the station newsroom."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedNews?.category ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border border-white/25 bg-white/10 text-white/80">
                  {selectedNews.category}
                </span>
              ) : null}
              {selectedNews?.newsType ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border border-white/25 bg-white/10 text-white/80">
                  {selectedNews.newsType}
                </span>
              ) : null}
            </div>
            <span className="text-xs text-white/60 font-gp-sans tracking-[0.08em] uppercase">
              {selectedNews?.createdAt ? format(new Date(selectedNews.createdAt), "PPP p") : ""}
            </span>
          </div>

          {selectedNews?.linkUrl ? (
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => openLink(selectedNews.linkUrl || "")}
                className="bg-[#4A6F94] hover:bg-[#3d5d7a] text-white font-sans text-sm font-semibold tracking-normal"
              >
                Open Link
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
