import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import type { Advertisement, Product } from "@/types/api-models";
import { api } from "@/lib/api-client";
import { ExternalLink, ShoppingBag, Newspaper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIntro } from "@/contexts/IntroContext";
import { usePublicRadio } from "@/contexts/PublicRadioContext";
import RecommendedProducts from "./components/RecommendedProducts";
import NewsSidebar from "./components/NewsSidebar";
import SongOfTheWeek from "./components/SongOfTheWeek";
import TopicOfTheWeek from "./components/TopicOfTheWeek";
import {
  RadioHeader,
  CurrentSongDisplay,
  VolumeControl,
  PowerControl,
  ListenerCount,
  WhatsappContactButton,
} from "./components";

export default function Home() {
  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    currentListeners,
    hasPlayableContent,
    setVolume,
    setIsMuted,
    togglePlayPause,
  } = usePublicRadio();
  const { introActive } = useIntro();
  const silentScheduledAdvertisement = Boolean(
    currentSong?.scheduledCurrent?.contentType === "ADVERTISEMENT" &&
    !currentSong?.scheduledCurrent?.hasAudio
  );
  const displaySongTitle = currentSong?.current?.title || (silentScheduledAdvertisement ? "Reklam" : "");
  const displayIsLive = Boolean(currentSong?.playing && currentSong?.current) || silentScheduledAdvertisement;
  const scheduledAdContext =
    currentSong?.scheduledCurrent?.contentType === "ADVERTISEMENT"
      ? {
          productId: currentSong.scheduledCurrent.productId ?? null,
          advertisementId: currentSong.scheduledCurrent.contentId ?? null,
        }
      : null;
  const currentAdContext =
    currentSong?.current?.contentType === "ADVERTISEMENT"
      ? {
          productId: currentSong.current.productId ?? null,
          advertisementId: currentSong.current.contentId ?? null,
        }
      : scheduledAdContext;
  const overlayAdContext =
    currentSong?.overlay?.contentType === "ADVERTISEMENT"
      ? {
          productId: currentSong.overlay.productId ?? null,
          advertisementId: currentSong.overlay.contentId ?? null,
        }
      : null;

  const heroOrnament = "Est. Dubai, UAE";
  const heroSubtitle = "The Media Network for Music News and Entertainment.";
  return (
    <div className={["min-h-screen", introActive ? "invisible pointer-events-none" : ""].join(" ")}>
      <div className="px-4 pt-10 md:pt-12">
        <section className="text-center px-2">
          <div className="flex items-center justify-center gap-4 mb-6 font-gp-sans text-[0.7rem] tracking-[0.3em] uppercase text-white/75">
            <span className="h-px w-14 bg-gradient-to-r from-transparent to-white/55" aria-hidden="true" />
            <span>{heroOrnament}</span>
            <span className="h-px w-14 bg-gradient-to-r from-white/55 to-transparent" aria-hidden="true" />
          </div>

          <h1 className="font-gp-display font-bold leading-[1.15] tracking-[-0.01em] text-[clamp(2.4rem,5vw,3.8rem)] text-white">
            Golden Pearl Radio <span className="text-red-500">Dubai</span>
          </h1>

          <p className="mt-4 mx-auto max-w-[560px] font-gp-sans text-[1.15rem] tracking-[0.02em] text-white/85">
            {heroSubtitle}
          </p>
        </section>

        <div className="max-w-[1280px] mx-auto pt-12 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start lg:items-stretch">
          <section className="relative z-20 lg:col-span-4 order-2 lg:order-1">
            <div className="font-gp-sans text-[0.65rem] font-medium tracking-[0.2em] uppercase text-white/90 mb-4 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Promotion
            </div>
            <RecommendedProducts variant="blocks" limit={3} />
          </section>

          <section className="relative z-10 lg:col-span-4 order-1 lg:order-2 flex items-start justify-center h-auto lg:min-h-[42rem]">
            <div className="w-full h-auto lg:h-full">
              <div className="glass-card public-home-player h-auto min-h-[42rem] lg:h-full flex flex-col">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 border border-white/25 rounded-[1.5rem]"
                />
                <div className="px-7 py-6">
                  <div className="flex items-center gap-6">
                    <VolumeControl
                      volume={volume}
                      isMuted={isMuted}
                      onVolumeChange={setVolume}
                      onMuteToggle={() => setIsMuted(!isMuted)}
                    />

                    <PowerControl
                      isPlaying={isPlaying}
                      isStreaming={currentSong?.playing ?? false}
                      hasPlayableContent={hasPlayableContent}
                      onTogglePlayPause={togglePlayPause}
                    />

                    <ListenerCount count={currentListeners} />
                  </div>
                </div>
                <RadioHeader currentTime={currentTime} />
                <div className="px-7 pt-2 pb-4">
                  <div className="rounded-2xl border border-white/25 bg-white/10 px-5 py-4 backdrop-blur-md">
                    <TopicOfTheWeek />
                  </div>
                </div>
                <CurrentSongDisplay
                  title={displaySongTitle}
                  isLive={displayIsLive}
                  label="Now Playing"
                />

                <div className="mt-auto shrink-0 px-7 pb-6 pt-4 border-t border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.12))]">
                  <WhatsappContactButton />
                </div>
              </div>
            </div>
          </section>

          <section className="relative z-20 lg:col-span-4 order-3">
            <div className="font-gp-sans text-[0.65rem] font-medium tracking-[0.2em] uppercase text-white/90 mb-4 flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              News
            </div>
            <NewsSidebar variant="blocks" limit={3} />
          </section>
        </div>

        {(currentAdContext || overlayAdContext) && (
          <div className="max-w-[1280px] mx-auto -mt-4 pb-10 px-4 grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-4" />
            <div className="lg:col-span-4 space-y-4">
              {currentAdContext && (
                <CurrentlyPlayingProduct
                  productId={currentAdContext.productId}
                  advertisementId={currentAdContext.advertisementId}
                  isSilent={!currentSong?.current?.url}
                />
              )}
              {overlayAdContext &&
                (overlayAdContext.productId !== currentAdContext?.productId ||
                  overlayAdContext.advertisementId !== currentAdContext?.advertisementId) && (
                <CurrentlyPlayingProduct
                  productId={overlayAdContext.productId}
                  advertisementId={overlayAdContext.advertisementId}
                />
              )}
            </div>
            <div className="lg:col-span-4" />
          </div>
        )}

        <div className="max-w-[1280px] mx-auto pb-10 px-4">
          <div className="glass-card p-6">
            <SongOfTheWeek />
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentlyPlayingProduct({
  productId,
  advertisementId,
  isSilent = false,
}: {
  productId?: number | null;
  advertisementId?: number | null;
  isSilent?: boolean;
}) {
  const [, setLocation] = useLocation();
  const { data: product, isLoading } = useQuery<Product | null>({
    queryKey: ["radio-product-spotlight", productId, advertisementId],
    queryFn: async (): Promise<Product | null> => {
      if (productId) {
        return await api.get<Product>(`/products/${productId}`);
      }

      if (advertisementId) {
        try {
          const ad = await api.get<Advertisement>(`/advertisements/${advertisementId}`);
          const resolvedProductId = ad.product?.id ?? ad.productId ?? null;
          if (resolvedProductId) {
            return await api.get<Product>(`/products/${resolvedProductId}`);
          }
        } catch {
          // Fall through to direct product lookup below.
        }

        // Some timeline entries store the product id directly as contentId.
        try {
          return await api.get<Product>(`/products/${advertisementId}`);
        } catch {
          return null;
        }
      }

      return null;
    },
    enabled: Boolean(productId || advertisementId),
    staleTime: 30 * 1000,
    retry: false,
  });

  const handleOpenProduct = async () => {
    if (!product) return;
    try {
      await api.post(`/products/${product.id}/click`);
      setLocation(`/shop/product/${product.id}`);
    } catch (error) {
      console.error("Error tracking product click:", error);
      setLocation(`/shop/product/${product.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <Card className="border-white/25 bg-white/5 shadow-none">
          <CardContent className="p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-[rgba(201,168,76,0.22)] rounded w-1/3"></div>
              <div className="h-6 bg-[rgba(201,168,76,0.18)] rounded w-2/3"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="glass-card p-6">
      <Card className="border-white/25 bg-white/5 shadow-none hover:border-white/35 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className={["w-2 h-2 rounded-full", isSilent ? "bg-white/70" : "bg-[var(--gp-gold-bright)] animate-pulse"].join(" ")} />
            <span className="text-[0.68rem] font-gp-sans font-semibold text-white uppercase tracking-[0.16em]">
              {isSilent ? "Reklam" : "Now Playing"}
            </span>
            <span className="ml-auto text-[0.62rem] font-gp-sans uppercase tracking-[0.14em] text-white/65">
              Product Spotlight
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <Link href={`/shop/product/${product.id}`}>
                <div className="w-full h-32 bg-white/10 border border-white/25 rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                  <img
                    src={product.coverUrl || product.imageUrl || "/attached_assets/image.png"}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/attached_assets/image.png";
                    }}
                  />
                </div>
              </Link>
            </div>

            <div className="md:col-span-2 flex flex-col justify-between">
              <div>
                <Link href={`/shop/product/${product.id}`}>
                  <h3 className="text-xl font-gp-display font-semibold text-white mb-2 hover:text-white/90 transition-colors cursor-pointer">
                    {product.name}
                  </h3>
                </Link>
                {product.category && (
                  <span className="inline-block text-[0.72rem] font-gp-sans text-white/90 tracking-[0.12em] uppercase mb-2 bg-white/15 border border-white/25 px-2 py-1 rounded-2xl">
                    {product.category}
                  </span>
                )}
                {product.description && (
                  <p className="text-sm text-white/80 line-clamp-2 mb-3 font-gp-serif">
                    {product.description}
                  </p>
                )}
                {!product.details?.noPrice && typeof product.price === "number" && product.price > 0 ? (
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-2xl font-gp-display font-bold text-white">
                      {(product.price / 100).toFixed(2)}
                    </span>
                    <span className="text-sm font-gp-sans tracking-[0.12em] uppercase text-white/70">
                      {product.currency?.toUpperCase() ?? "AED"}
                    </span>
                  </div>
                ) : null}
              </div>

              <Button
                size="lg"
                className="w-full md:w-auto border border-white/25 bg-white/20 text-white hover:bg-white/30 hover:border-white/35 font-gp-sans font-semibold tracking-[0.12em] uppercase shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 rounded-2xl backdrop-blur-sm"
                onClick={handleOpenProduct}
              >
                <ShoppingBag className="h-4 w-4" />
                View Product
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
