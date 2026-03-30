import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, MapPin, Star, ShoppingBag, ArrowLeft } from "lucide-react";
import { Suspense, lazy } from "react";
import { api } from "@/lib/api-client";
import type { Product } from "@/types/api-models";

const LazyMap = lazy(() => import("../home/components/LazyMap"));

export default function ProductPage() {
  const [, storeParams] = useRoute("/store/product/:id");
  const [, shopParams] = useRoute("/shop/product/:id");
  const params = shopParams ?? storeParams;
  const productId = params?.id ? parseInt(params.id) : null;

  const { data: product, isLoading, error } = useQuery<
    Product & {
      location?: {
        name: string;
        address: string;
        city?: string;
        country?: string;
        rating?: number;
        mapUrl?: string;
        imageUrl?: string;
      };
    }
  >({
    queryKey: ["product-details", productId],
    queryFn: async () => {
      if (!productId) return null;
      const data = await api.get(`/products/${productId}`);
      return data;
    },
    enabled: !!productId,
  });

  const handleBuyNow = async () => {
    if (!product) return;

    try {
      await api.post(`/products/${product.id}/click`);
      window.open(product.affiliateUrl, "_blank", "noopener,noreferrer");
    } catch (trackError) {
      console.error("Error tracking affiliate click:", trackError);
      window.open(product.affiliateUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
          <div className="max-w-7xl w-full glass-card p-7 md:p-10">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-white/15 rounded w-1/3" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-96 bg-white/10 rounded-2xl" />
                <div className="space-y-4">
                  <div className="h-6 bg-white/15 rounded w-3/4" />
                  <div className="h-5 bg-white/15 rounded w-1/3" />
                  <div className="h-24 bg-white/10 rounded-2xl" />
                  <div className="h-12 bg-white/15 rounded-2xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen">
        <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
          <div className="max-w-4xl w-full glass-card p-10 text-center">
            <h1 className="font-gp-display text-[clamp(1.6rem,3vw,2.2rem)] font-semibold text-white mb-3">
              Product Not Found
            </h1>
            <p className="font-gp-serif italic text-white/80 mb-6">
              The product you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <Link href="/shop">
              <Button className="rounded-2xl h-11 bg-white/25 hover:bg-white/35 text-white font-gp-sans font-semibold text-[0.8rem] uppercase tracking-[0.12em] border border-white/30">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Shop
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
        <div className="max-w-7xl w-full glass-card p-7 md:p-10">
          <header className="mb-8">
            <div className="flex items-center justify-center gap-4 mb-6 font-gp-sans text-[0.7rem] tracking-[0.3em] uppercase text-white/75">
              <span className="h-px w-14 bg-gradient-to-r from-transparent to-white/55" aria-hidden="true" />
              <span>Shop</span>
              <span className="h-px w-14 bg-gradient-to-r from-white/55 to-transparent" aria-hidden="true" />
            </div>

            <div className="flex justify-start">
              <Link href="/shop">
                <Button
                  variant="outline"
                  className="rounded-2xl border border-white/25 bg-white/10 text-white/90 hover:text-white hover:bg-white/15"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Shop
                </Button>
              </Link>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div className="glass-card overflow-hidden !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <img
                  src={product.coverUrl || product.imageUrl || "/attached_assets/image.png"}
                  alt={product.name}
                  className="w-full h-96 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/attached_assets/image.png";
                  }}
                />
              </div>

              {product.location?.mapUrl && (
                <Card className="glass-card !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <CardContent className="p-5">
                    <h3 className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-white/90 mb-4 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </h3>
                    <Suspense
                      fallback={
                        <div className="w-full h-64 bg-white/10 animate-pulse rounded-2xl flex items-center justify-center">
                          <div className="text-sm text-white/70">Loading map...</div>
                        </div>
                      }
                    >
                      <LazyMap mapUrl={product.location.mapUrl} locationName={product.location.name} />
                    </Suspense>
                    <a
                      href={product.location.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center text-sm text-white/85 hover:text-white underline"
                    >
                      <MapPin className="mr-1 h-4 w-4" />
                      View on map
                    </a>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h1 className="text-[clamp(1.8rem,3vw,2.4rem)] font-gp-display font-semibold text-white leading-tight">
                    {product.name}
                  </h1>
                  {product.category ? (
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-2xl bg-white/20 text-white border border-white/25 uppercase tracking-[0.12em]">
                      {product.category}
                    </span>
                  ) : null}
                </div>

                {!product.details?.noPrice && typeof product.price === "number" && product.price > 0 ? (
                  <div className="flex items-baseline gap-2 mb-5">
                    <span className="text-4xl font-gp-brand font-semibold text-white tracking-[0.04em]">
                      {(product.price / 100).toFixed(2)}
                    </span>
                    <span className="text-sm text-white/75 font-gp-sans tracking-[0.08em] uppercase">
                      {product.currency?.toUpperCase() ?? "AED"}
                    </span>
                  </div>
                ) : null}

                {product.description ? (
                  <p className="text-white/85 text-[1rem] leading-relaxed whitespace-pre-wrap font-gp-serif">
                    {product.description}
                  </p>
                ) : null}
              </div>

              {product.location && (
                <Card className="glass-card !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <CardContent className="p-5">
                    <h3 className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-white/90 mb-4 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location Details
                    </h3>
                    <div className="space-y-2 text-white/85">
                      <div>
                        <span className="font-gp-sans text-xs uppercase tracking-[0.12em] text-white/60">Name:</span>{" "}
                        <span className="font-gp-serif">{product.location.name}</span>
                      </div>
                      <div>
                        <span className="font-gp-sans text-xs uppercase tracking-[0.12em] text-white/60">Address:</span>{" "}
                        <span className="font-gp-serif">{product.location.address}</span>
                      </div>
                      {product.location.city && (
                        <div>
                          <span className="font-gp-sans text-xs uppercase tracking-[0.12em] text-white/60">City:</span>{" "}
                          <span className="font-gp-serif">{product.location.city}</span>
                        </div>
                      )}
                      {product.location.country && (
                        <div>
                          <span className="font-gp-sans text-xs uppercase tracking-[0.12em] text-white/60">Country:</span>{" "}
                          <span className="font-gp-serif">{product.location.country}</span>
                        </div>
                      )}
                      {product.location.rating && (
                        <div className="flex items-center gap-2 text-white">
                          <Star className="h-4 w-4 fill-white" />
                          <span className="font-gp-sans text-xs uppercase tracking-[0.12em]">
                            {product.location.rating}/5 rating
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="pt-4 border-t border-white/20">
                <Button
                  size="lg"
                  onClick={handleBuyNow}
                  className="w-full rounded-2xl h-11 bg-white/25 hover:bg-white/35 text-white font-gp-sans font-semibold text-[0.8rem] uppercase tracking-[0.12em] border border-white/30 transition-colors"
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Buy Now
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-sm text-white/70 mt-4 font-gp-serif italic">
                  Clicking "Buy Now" will take you to the merchant&apos;s website. This is an affiliate link.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
