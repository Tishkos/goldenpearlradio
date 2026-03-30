import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function NewsPage() {
  const queryClient = useQueryClient();
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

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
      window.open(item.linkUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setSelectedNews(item);
  };

  // Varied sizes for masonry-like layout (matches navbar max-w-7xl)
  const getCardSize = (index: number) => {
    const pattern = ["lg", "md", "sm", "wide", "sm", "md", "lg", "sm", "wide", "md"];
    return pattern[index % pattern.length];
  };

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
        <div className="w-full max-w-7xl glass-card p-7 md:p-10">
          <header className="text-center mb-10">
            <div className="flex items-center justify-center gap-4 mb-6 font-gp-sans text-[0.7rem] tracking-[0.3em] uppercase text-white/75">
              <span className="h-px w-14 bg-gradient-to-r from-transparent to-white/55" aria-hidden="true" />
              <span>News</span>
              <span className="h-px w-14 bg-gradient-to-r from-white/55 to-transparent" aria-hidden="true" />
            </div>

            <h1 className="font-gp-display font-bold leading-[1.15] tracking-[-0.01em] text-[clamp(2rem,4vw,3rem)] text-white">
              Latest <span className="text-white italic">News</span>
            </h1>
            <p className="mt-4 mx-auto max-w-xl font-gp-serif text-[1.1rem] italic tracking-[0.04em] text-white/85">
              Breaking news and updates from Golden Pearl Radio Dubai.
            </p>
          </header>

          <div className="flex justify-end mb-6">
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["news"] })}
              className="inline-flex items-center gap-2 px-4 py-2 border border-white/25 rounded-2xl font-gp-sans text-[0.65rem] uppercase tracking-[0.12em] text-white/80 hover:bg-white/25 hover:border-white/40 hover:text-white transition-colors"
              aria-label="Refresh news"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {error ? (
            <div className="text-center py-16">
              <div className="h-14 w-14 rounded-full border border-white/25 grid place-items-center text-white/70 mx-auto mb-4">
                <AlertCircle className="h-7 w-7" />
              </div>
              <p className="font-gp-display text-[1.05rem] italic text-white mb-5">News unavailable</p>
              <p className="font-gp-sans text-[0.7rem] uppercase tracking-[0.12em] text-white/60 mb-6">Service updating</p>
              <button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["news"] })}
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/25 rounded-2xl font-gp-sans text-[0.7rem] uppercase tracking-[0.12em] text-white/90 hover:bg-white/25 hover:border-white/40 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 auto-rows-[minmax(140px,auto)] grid-flow-dense">
              {Array.from({ length: 8 }).map((_, i) => {
                const patterns = ["col-span-2 row-span-2", "col-span-2 row-span-1", "col-span-1 row-span-1", "col-span-3 row-span-1"];
                const span = patterns[i % 4];
                return (
                  <div key={i} className={`${span} rounded-2xl border border-white/25 bg-white/10 p-4 animate-pulse flex flex-col`}>
                    <div className="h-24 md:h-32 bg-white/15 rounded-xl mb-3 flex-shrink-0" />
                    <div className="h-4 bg-white/15 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-white/15 rounded w-full" />
                  </div>
                );
              })}
            </div>
          ) : newsList.length === 0 ? (
            <div className="text-center py-16">
              <Newspaper className="h-14 w-14 mx-auto text-white/60 mb-4" />
              <p className="font-gp-display text-[1.05rem] italic text-white mb-1">No news at the moment</p>
              <p className="font-gp-sans text-[0.7rem] uppercase tracking-[0.12em] text-white/85">UAE · Culture · Music</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 auto-rows-[minmax(140px,auto)] grid-flow-dense gp-scrollbar">
              {newsList.map((item, index) => {
                const size = getCardSize(index);
                const sizeClasses = {
                  lg: "col-span-2 row-span-2",
                  md: "col-span-2 row-span-1",
                  wide: "col-span-3 row-span-1",
                  sm: "col-span-1 row-span-1",
                };
                const imgHeights = {
                  lg: "h-48 md:h-64 min-h-[12rem]",
                  md: "h-36 md:h-40 min-h-[9rem]",
                  wide: "h-32 md:h-36 min-h-[8rem]",
                  sm: "h-28 md:h-32 min-h-[7rem]",
                };
                const contentPaddings = {
                  lg: "p-4 md:p-5",
                  md: "p-4",
                  wide: "p-4",
                  sm: "p-3",
                };
                const titleSizes = {
                  lg: "text-base md:text-lg line-clamp-3",
                  md: "text-sm md:text-base line-clamp-2",
                  wide: "text-sm md:text-base line-clamp-2",
                  sm: "text-xs md:text-sm line-clamp-2",
                };
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNewsClick(item)}
                    className={`${sizeClasses[size]} text-left rounded-2xl border border-white/25 bg-white/10 p-0 hover:border-white/35 hover:bg-white/15 transition-all overflow-hidden backdrop-blur-md flex flex-col`}
                  >
                    {item.imageUrl ? (
                      <div className={`w-full flex-shrink-0 ${imgHeights[size]} bg-white/10 overflow-hidden`}>
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={`w-full flex-shrink-0 ${imgHeights[size]} bg-white/5 flex items-center justify-center`}>
                        <Newspaper className="h-8 w-8 md:h-10 md:w-10 text-white/30" />
                      </div>
                    )}
                    <div className={`flex-1 flex flex-col min-h-0 ${contentPaddings[size]}`}>
                      <div className="flex items-start gap-2">
                        {item.newsType?.toLowerCase().includes("breaking") ? (
                          <AlertCircle className="h-4 w-4 text-white/90 flex-shrink-0 mt-0.5" />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <h3 className={`font-gp-sans font-semibold text-white ${titleSizes[size]}`}>
                            {item.title}
                          </h3>
                          {size !== "sm" && item.message ? (
                            <p className="text-xs text-white/80 mt-1 line-clamp-2">
                              {item.message}
                            </p>
                          ) : null}
                          <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
                            {item.category ? (
                              <span className="text-[9px] md:text-[10px] font-medium px-2 py-0.5 rounded-xl border border-white/25 text-white/80">
                                {item.category}
                              </span>
                            ) : null}
                            <span className="text-[9px] md:text-[10px] text-white/60 font-gp-sans tracking-[0.08em] uppercase">
                              {item.createdAt ? format(new Date(item.createdAt), "MMM d") : ""}
                            </span>
                          </div>
                          {item.linkBehavior === "external" && item.linkUrl && size !== "sm" ? (
                            <span className="inline-flex items-center gap-0.5 mt-1 text-[9px] font-gp-sans uppercase tracking-[0.1em] text-white/90">
                              Open
                              <ExternalLink className="h-2.5 w-2.5" />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
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

          {selectedNews?.imageUrl ? (
            <div className="rounded-2xl overflow-hidden border border-white/25">
              <img
                src={selectedNews.imageUrl}
                alt={selectedNews.title}
                className="w-full h-56 md:h-72 object-cover"
              />
            </div>
          ) : null}

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
                onClick={() => window.open(selectedNews.linkUrl || "", "_blank", "noopener,noreferrer")}
                className="bg-white/25 hover:bg-white/35 text-white font-sans text-sm font-semibold tracking-normal border border-white/30"
              >
                Open Link
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
