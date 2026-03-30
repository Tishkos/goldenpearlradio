import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ShoppingBag, ExternalLink, MapPin } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/api-client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type RecommendedProductsProps = {
  variant?: "list" | "blocks";
  limit?: number;
};

export default function RecommendedProducts({ variant = "list", limit = 6 }: RecommendedProductsProps) {
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [, setLocation] = useLocation();

  const getPromotionTarget = (item: Promotion): string | null => {
    if (!item.id) return null;
    return `/promotions/${item.id}`;
  };

  const resolveMediaUrl = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const base = import.meta.env.VITE_STREAM_SERVER_URL || "";
    if (url.startsWith("/") && base) return `${base}${url}`;
    return url;
  };

  const { data: promotions = [], isLoading, error } = useQuery<Promotion[]>({
    queryKey: ["promotions"],
    queryFn: async () => {
      const data = await api.get<Promotion[]>("/promotions");
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30 * 1000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const navigateToTarget = (target: string) => {
    const url = new URL(target, window.location.origin);
    if (url.origin === window.location.origin) {
      setLocation(`${url.pathname}${url.search}${url.hash}`);
      return;
    }
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const handlePromotionClick = (item: Promotion) => {
    const target = getPromotionTarget(item);
    if (target) {
      navigateToTarget(target);
      return;
    }

    setSelectedPromotion(item);
  };

  const openLink = (link: string) => {
    const url = new URL(link, window.location.origin);
    if (url.origin === window.location.origin) {
      setLocation(`${url.pathname}${url.search}${url.hash}`);
      return;
    }
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-white/25 bg-white/10 p-10 text-center text-white/95 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-md">
        <p className="font-gp-sans text-xl leading-none mb-5 opacity-80">!</p>
        <p className="font-gp-sans text-[1.9rem] leading-none mb-3">Unable to load recommendations</p>
        <p className="font-gp-sans text-sm text-white/85">Please check your connection and try again</p>
      </div>
    );
  }

  const displayed = promotions.slice(0, limit);
  const hasMore = promotions.length > limit;

  const PromotionCard = ({ item }: { item: Promotion }) => {
    const target = getPromotionTarget(item);
    const baseClasses =
      "relative z-10 block pointer-events-auto cursor-pointer w-full text-left rounded-2xl border border-white/25 bg-white/10 p-0 hover:border-white/35 hover:bg-white/15 transition-colors overflow-hidden backdrop-blur-md";

    const cardContent = (
      <>
        {item.imageUrl ? (
          <div className="w-full h-28 bg-white/10">
            <img src={resolveMediaUrl(item.imageUrl) ?? item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
          </div>
        ) : null}
        <div className="p-4">
          <h3 className="font-gp-sans font-semibold text-sm text-white line-clamp-2">{item.title}</h3>
          {item.message ? <p className="text-xs text-white/80 mt-2 line-clamp-2">{item.message}</p> : null}
          <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
            <span className="text-[10px] font-medium px-2 py-1 rounded-2xl border border-white/25 text-white/80">
              {item.product?.name || item.category || "Promotion"}
            </span>
            <span className="text-[10px] text-white/60 font-gp-sans tracking-[0.08em] uppercase">
              {item.createdAt ? format(new Date(item.createdAt), "MMM d, HH:mm") : ""}
            </span>
          </div>
          {((item.product?.id ?? item.productId) || (item.linkBehavior === "external" && item.linkUrl)) && (
            <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-gp-sans uppercase tracking-[0.1em] text-white/90">
              {(item.product?.id ?? item.productId) ? "Product Page" : "Open Link"}
              <ExternalLink className="h-3 w-3" />
            </span>
          )}
        </div>
      </>
    );

    if (target) {
      return (
        <button
          type="button"
          onClick={() => navigateToTarget(target)}
          className={baseClasses}
        >
          {cardContent}
        </button>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handlePromotionClick(item)}
        className={baseClasses}
      >
        {cardContent}
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
        ) : promotions.length > 0 ? (
          <>
            <div className={variant === "blocks" ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4"}>
              {variant === "blocks"
                ? displayed.map((item) => <PromotionCard key={item.id} item={item} />)
                : displayed.map((item) => <PromotionCard key={item.id} item={item} />)}
            </div>
            {(hasMore || variant === "blocks") && (
              <Link
                href="/shop"
                className="mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/25 text-white/90 hover:bg-white/15 hover:border-white/40 transition-colors font-gp-sans text-[0.7rem] uppercase tracking-[0.12em]"
              >
                See more promotions
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </>
        ) : (
          <div className="glass-card p-7 text-center rounded-2xl">
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <ShoppingBag className="h-10 w-10 text-white/50" />
              <p className="font-gp-display text-[1rem] italic text-white/80">No promotions available</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selectedPromotion} onOpenChange={(open) => !open && setSelectedPromotion(null)}>
        <DialogContent className="sm:max-w-2xl bg-white/10 backdrop-blur-xl border-white/25 text-white max-h-[90vh] overflow-y-auto [&>button]:text-white [&>button]:opacity-100 [&>button]:border [&>button]:border-white/25 [&>button]:rounded-2xl [&>button:hover]:text-white [&>button:hover]:bg-white/15">
          <DialogHeader>
            <DialogTitle className="font-gp-display text-2xl md:text-3xl font-semibold text-white">
              {selectedPromotion?.title}
            </DialogTitle>
            <DialogDescription className="font-gp-serif text-white/90 text-base leading-relaxed">
              {selectedPromotion?.message || "Latest featured promotion from Golden Pearl Radio."}
            </DialogDescription>
          </DialogHeader>

          {selectedPromotion?.imageUrl ? (
            <div className="rounded-2xl overflow-hidden border border-white/25">
              <img src={selectedPromotion.imageUrl} alt={selectedPromotion.title} className="w-full h-56 md:h-72 object-cover" />
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedPromotion?.category ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border border-white/25 bg-white/10 text-white/80">
                  {selectedPromotion.category}
                </span>
              ) : null}
              {selectedPromotion?.location?.name ? (
                <span className="inline-flex items-center gap-1 text-xs text-white/70">
                  <MapPin className="h-3.5 w-3.5" />
                  {selectedPromotion.location.name}
                </span>
              ) : null}
            </div>

            {selectedPromotion?.product &&
            !selectedPromotion.product.details?.noPrice &&
            typeof selectedPromotion.product.price === "number" &&
            selectedPromotion.product.price > 0 ? (
              <span className="text-sm text-white font-semibold">
                {(selectedPromotion.product.price / 100).toFixed(2)} {selectedPromotion.product.currency || "AED"}
              </span>
            ) : null}
          </div>

          <div className="pt-2 flex gap-2 flex-wrap">
            {selectedPromotion?.linkUrl ? (
              <Button
                type="button"
                onClick={() => openLink(selectedPromotion.linkUrl || "")}
                className="bg-[#4A6F94] hover:bg-[#3d5d7a] text-white font-sans text-sm font-semibold tracking-normal"
              >
                Open Link
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            ) : null}
            {selectedPromotion?.product?.affiliateUrl ? (
              <Button
                type="button"
                onClick={() => window.open(selectedPromotion.product?.affiliateUrl || "", "_blank", "noopener,noreferrer")}
                className="border-white/25 text-white/90 hover:text-white hover:bg-white/10 font-sans text-sm font-semibold tracking-normal"
                variant="outline"
              >
                Buy Product
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
