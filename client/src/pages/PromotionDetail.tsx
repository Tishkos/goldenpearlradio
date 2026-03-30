import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ExternalLink, MapPin, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type Promotion = {
  id: number;
  productId?: number | null;
  title: string;
  message?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkBehavior?: "dialog" | "external";
  createdAt: string;
  location?: { name?: string } | null;
  product?: {
    id: number;
    name: string;
    affiliateUrl?: string | null;
    price?: number | null;
    currency?: string | null;
    details?: { noPrice?: boolean } | null;
  } | null;
};

function resolveMediaUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = import.meta.env.VITE_STREAM_SERVER_URL || "";
  if (url.startsWith("/") && base) return `${base}${url}`;
  return url;
}

export default function PromotionDetailPage() {
  const [, params] = useRoute("/promotions/:id");
  const promotionId = params?.id ? Number(params.id) : null;

  const { data: promotion, isLoading } = useQuery<Promotion | null>({
    queryKey: ["promotion-detail", promotionId],
    queryFn: async () => {
      if (!promotionId) return null;
      const promotions = await api.get<Promotion[]>("/promotions");
      return promotions.find((item) => item.id === promotionId) ?? null;
    },
    enabled: Boolean(promotionId),
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

  if (!promotion) {
    return (
      <div className="min-h-screen">
        <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
          <div className="max-w-4xl w-full glass-card p-10 text-center">
            <h1 className="font-gp-display text-[clamp(1.6rem,3vw,2.2rem)] font-semibold text-white mb-3">
              Promotion Not Found
            </h1>
            <p className="font-gp-serif text-white/80 mb-6">
              This recommendation is no longer available.
            </p>
            <Link href="/">
              <Button className="rounded-2xl h-11 bg-white/25 hover:bg-white/35 text-white border border-white/30">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const linkedProductId = promotion.product?.id ?? promotion.productId ?? null;

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
        <div className="max-w-5xl w-full glass-card p-7 md:p-10">
          <header className="mb-8">
            <div className="flex items-center justify-center gap-4 mb-6 font-gp-sans text-[0.7rem] tracking-[0.3em] uppercase text-white/75">
              <span className="h-px w-14 bg-gradient-to-r from-transparent to-white/55" aria-hidden="true" />
              <span>Promotion</span>
              <span className="h-px w-14 bg-gradient-to-r from-white/55 to-transparent" aria-hidden="true" />
            </div>

            <div className="flex justify-start">
              <Link href="/">
                <Button
                  variant="outline"
                  className="rounded-2xl border border-white/25 bg-white/10 text-white/90 hover:text-white hover:bg-white/15"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </header>

          <div className="space-y-6">
            {promotion.imageUrl ? (
              <div className="glass-card overflow-hidden !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <img
                  src={resolveMediaUrl(promotion.imageUrl) ?? promotion.imageUrl}
                  alt={promotion.title}
                  className="w-full h-64 md:h-96 object-cover"
                />
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {promotion.category ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-2xl text-xs font-gp-sans uppercase tracking-[0.1em] border border-white/25 bg-white/10 text-white/80">
                    {promotion.category}
                  </span>
                ) : null}
                {promotion.location?.name ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-2xl text-xs font-gp-sans uppercase tracking-[0.1em] border border-white/25 bg-white/10 text-white/80">
                    <MapPin className="h-3.5 w-3.5" />
                    {promotion.location.name}
                  </span>
                ) : null}
              </div>

              <h1 className="font-gp-display text-[clamp(1.9rem,3.6vw,3rem)] font-semibold text-white leading-tight">
                {promotion.title}
              </h1>

              <p className="font-gp-serif text-white/90 text-[1rem] leading-relaxed whitespace-pre-wrap">
                {promotion.message || "Latest featured promotion from Golden Pearl Radio."}
              </p>

              {promotion.product?.name ? (
                <div className="rounded-2xl border border-white/25 bg-white/10 p-5">
                  <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.16em] text-white/70 mb-2">
                    Linked Product
                  </p>
                  <p className="font-gp-display text-xl text-white">{promotion.product.name}</p>
                  {!promotion.product.details?.noPrice &&
                  typeof promotion.product.price === "number" &&
                  promotion.product.price > 0 ? (
                    <p className="mt-2 font-gp-sans text-sm text-white/80">
                      {(promotion.product.price / 100).toFixed(2)} {promotion.product.currency || "AED"}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3 pt-2">
                {linkedProductId ? (
                  <Link href={`/shop/product/${linkedProductId}`}>
                    <Button className="rounded-2xl bg-white/20 hover:bg-white/30 text-white border border-white/30">
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      View Product
                    </Button>
                  </Link>
                ) : null}
                {promotion.linkUrl ? (
                  <a href={promotion.linkUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/30">
                      Open Link
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
