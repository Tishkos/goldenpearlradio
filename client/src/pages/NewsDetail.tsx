import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ExternalLink, Newspaper } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type NewsItem = {
  id: number;
  newsType: string;
  title: string;
  message?: string | null;
  category?: string | null;
  createdAt: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkBehavior?: "dialog" | "external";
  location?: { name?: string } | null;
};

export default function NewsDetailPage() {
  const [, params] = useRoute("/news/:id");
  const newsId = params?.id ? Number(params.id) : null;

  const { data: newsItem, isLoading } = useQuery<NewsItem | null>({
    queryKey: ["news-detail", newsId],
    queryFn: async () => {
      if (!newsId) return null;
      const allNews = await api.get<NewsItem[]>("/news");
      return allNews.find((item) => item.id === newsId) ?? null;
    },
    enabled: Boolean(newsId),
    staleTime: 30 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
          <div className="max-w-5xl w-full glass-card p-7 md:p-10">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-white/15 rounded w-1/3" />
              <div className="h-64 bg-white/10 rounded-2xl" />
              <div className="h-6 bg-white/15 rounded w-2/3" />
              <div className="h-20 bg-white/10 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!newsItem) {
    return (
      <div className="min-h-screen">
        <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
          <div className="max-w-4xl w-full glass-card p-10 text-center">
            <h1 className="font-gp-display text-[clamp(1.6rem,3vw,2.2rem)] font-semibold text-white mb-3">
              News Item Not Found
            </h1>
            <p className="font-gp-serif text-white/80 mb-6">
              This news story is no longer available.
            </p>
            <Link href="/news">
              <Button className="rounded-2xl h-11 bg-white/25 hover:bg-white/35 text-white border border-white/30">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to News
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
        <div className="max-w-5xl w-full glass-card p-7 md:p-10">
          <header className="mb-8">
            <div className="flex items-center justify-center gap-4 mb-6 font-gp-sans text-[0.7rem] tracking-[0.3em] uppercase text-white/75">
              <span className="h-px w-14 bg-gradient-to-r from-transparent to-white/55" aria-hidden="true" />
              <span>News</span>
              <span className="h-px w-14 bg-gradient-to-r from-white/55 to-transparent" aria-hidden="true" />
            </div>

            <div className="flex justify-start">
              <Link href="/news">
                <Button
                  variant="outline"
                  className="rounded-2xl border border-white/25 bg-white/10 text-white/90 hover:text-white hover:bg-white/15"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to News
                </Button>
              </Link>
            </div>
          </header>

          <div className="space-y-6">
            {newsItem.imageUrl ? (
              <div className="glass-card overflow-hidden !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <img
                  src={newsItem.imageUrl}
                  alt={newsItem.title}
                  className="w-full h-64 md:h-96 object-cover"
                />
              </div>
            ) : (
              <div className="glass-card flex h-56 items-center justify-center !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <Newspaper className="h-12 w-12 text-white/40" />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {newsItem.category ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-2xl text-xs font-gp-sans uppercase tracking-[0.1em] border border-white/25 bg-white/10 text-white/80">
                    {newsItem.category}
                  </span>
                ) : null}
                {newsItem.newsType ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-2xl text-xs font-gp-sans uppercase tracking-[0.1em] border border-white/25 bg-white/10 text-white/80">
                    {newsItem.newsType}
                  </span>
                ) : null}
                {newsItem.location?.name ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-2xl text-xs font-gp-sans uppercase tracking-[0.1em] border border-white/25 bg-white/10 text-white/80">
                    {newsItem.location.name}
                  </span>
                ) : null}
              </div>

              <h1 className="font-gp-display text-[clamp(1.9rem,3.6vw,3rem)] font-semibold text-white leading-tight">
                {newsItem.title}
              </h1>

              <p className="font-gp-sans text-[0.7rem] uppercase tracking-[0.14em] text-white/65">
                {newsItem.createdAt ? new Date(newsItem.createdAt).toLocaleString() : ""}
              </p>

              <div className="rounded-2xl border border-white/25 bg-white/10 p-6">
                <p className="font-gp-serif text-white/90 text-[1rem] leading-relaxed whitespace-pre-wrap">
                  {newsItem.message || "Latest newsroom update from Golden Pearl Radio."}
                </p>
              </div>

              {newsItem.linkUrl ? (
                <div className="pt-2">
                  <a
                    href={newsItem.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-white/15 px-4 py-3 text-sm font-gp-sans font-semibold uppercase tracking-[0.1em] text-white hover:bg-white/25 transition-colors"
                  >
                    Open Source Link
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
