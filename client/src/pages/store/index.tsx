import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, ExternalLink, MapPin, Star, Search, X, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api-client";
import type { Product } from "@/types/api-models";

export default function StorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 20;
  // Fetch all active products
  const { data: products, isLoading, error } = useQuery<
    (Product & {
      location?: {
        name: string;
        address: string;
        city?: string;
        country?: string;
        rating?: number;
        mapUrl?: string;
      };
    })[]
  >({
    queryKey: ["store-products"],
    queryFn: async () => {
      const data = await api.get("/products");
      return data || [];
    },
  });

  // Get unique categories
  const categories = useMemo(() => {
    if (!products) return [];
    const uniqueCategories = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(uniqueCategories).sort();
  }, [products]);

  // Get unique locations (prioritize city, fallback to name)
  const locations = useMemo(() => {
    if (!products) return [];
    const locationSet = new Set<string>();
    products.forEach((product) => {
      if (product.location) {
        const locationKey = product.location.city || product.location.name;
        if (locationKey) {
          locationSet.add(locationKey);
        }
      }
    });
    return Array.from(locationSet).sort();
  }, [products]);

  // Filter products based on search query and filters
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    let filtered = products;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((product) => {
        const nameMatch = product.name?.toLowerCase().includes(query);
        const descriptionMatch = product.description?.toLowerCase().includes(query);
        const categoryMatch = product.category?.toLowerCase().includes(query);
        const locationMatch = product.location?.name?.toLowerCase().includes(query) ||
                             product.location?.city?.toLowerCase().includes(query);
        
        return nameMatch || descriptionMatch || categoryMatch || locationMatch;
      });
    }

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((product) => product.category === selectedCategory);
    }

    // Location filter
    if (selectedLocation !== "all") {
      filtered = filtered.filter((product) => {
        if (!product.location) return false;
        const locationKey = product.location.city || product.location.name;
        return locationKey === selectedLocation;
      });
    }

    return filtered;
  }, [products, searchQuery, selectedCategory, selectedLocation]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedLocation]);

  // Handle affiliate link click tracking
  const handleBuyNow = async (product: Product) => {
    try {
      // Increment click count via API
      await api.post(`/products/${product.id}/click`);
      // Open affiliate link in new tab
      window.open(product.affiliateUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error tracking affiliate click:", error);
      // Still open the link even if tracking fails
      window.open(product.affiliateUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-center px-4 sm:px-6 pt-12 md:pt-16 pb-20">
        <div className="max-w-7xl w-full glass-card p-7 md:p-10">
          <header className="text-center mb-10">
            <div className="flex items-center justify-center gap-4 mb-6 font-gp-sans text-[0.7rem] tracking-[0.3em] uppercase text-white/75">
              <span className="h-px w-14 bg-gradient-to-r from-transparent to-white/55" aria-hidden="true" />
              <span>Shop</span>
              <span className="h-px w-14 bg-gradient-to-r from-white/55 to-transparent" aria-hidden="true" />
            </div>

            <h1 className="font-gp-display font-bold leading-[1.15] tracking-[-0.01em] text-[clamp(2rem,4vw,3rem)] text-white">
              Discover <span className="text-white italic">partner offers</span>
            </h1>
            <p className="mt-4 mx-auto max-w-2xl font-gp-serif text-[1.1rem] italic tracking-[0.04em] text-white/85">
              Curated products and experiences — click-through links open the merchant site.
            </p>
          </header>
          
          {/* Search and Filters - Contact-style tabs/bar */}
          <section className="mb-8">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 pl-4 pr-11 text-base text-white placeholder:text-white/60 bg-white/10 border border-white/25 rounded-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0 focus-visible:border-white/40 backdrop-blur-md"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-[2px] text-[color:var(--gp-white)]/80 hover:text-[color:var(--gp-white)] hover:bg-white/5 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="h-12 px-5 rounded-2xl border border-white/25 bg-white/10 text-white/90 transition-all font-gp-sans text-[0.72rem] uppercase tracking-[0.12em] hover:!bg-white/25 hover:!border-white/40 hover:!text-white backdrop-blur-md"
              >
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>

            {showFilters && (
              <div className="mt-4 p-5 rounded-2xl bg-white/10 border border-white/25 backdrop-blur-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-white/90 mb-2 block">Category</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="h-10 bg-white/10 border border-white/25 text-white rounded-2xl hover:border-white/35 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0 focus-visible:border-white/40">
                        <SelectValue placeholder="All Categories" className="text-white" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/10 border border-white/25 text-white backdrop-blur-xl">
                        <SelectItem value="all" className="focus:bg-white/5 data-[highlighted]:bg-white/5 text-[color:var(--gp-white)]">All Categories</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat} className="focus:bg-white/5 data-[highlighted]:bg-white/5 text-[color:var(--gp-white)]">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-white/90 mb-2 block">Location</label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger className="h-10 bg-white/10 border border-white/25 text-white rounded-2xl hover:border-white/35 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0 focus-visible:border-white/40">
                        <SelectValue placeholder="All Locations" className="text-white" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/10 border border-white/25 text-white backdrop-blur-xl">
                        <SelectItem value="all" className="focus:bg-white/5 data-[highlighted]:bg-white/5 text-[color:var(--gp-white)]">All Locations</SelectItem>
                        {locations.map((location) => (
                          <SelectItem key={location} value={location} className="focus:bg-white/5 data-[highlighted]:bg-white/5 text-[color:var(--gp-white)]">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-[color:var(--gp-gold-dim)]" />
                              {location}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCategory("all");
                        setSelectedLocation("all");
                      }}
                      className="text-white/85 hover:text-white hover:bg-white/10 rounded-2xl font-gp-sans text-[0.72rem] uppercase tracking-[0.12em]"
                    >
                      Clear filters
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm text-white/80 mt-3">
              {filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}
              {(searchQuery || selectedCategory !== "all" || selectedLocation !== "all") && " (filtered)"}
              {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
            </p>
          </section>
          
          {/* Products Grid */}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
          {Array(8)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="glass-card overflow-hidden !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <div className="h-52 bg-white/10 animate-pulse" />
                <CardContent className="p-5">
                  <div className="h-5 w-3/4 bg-white/15 animate-pulse rounded mb-3" />
                  <div className="h-4 w-1/2 bg-white/15 animate-pulse rounded mb-4" />
                  <div className="h-11 w-full bg-white/15 animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
        </div>
      ) : error ? (
        <div className="glass-card text-center py-16">
          <p className="font-gp-display text-[1.05rem] italic text-white mb-5">Failed to load products</p>
          <Button onClick={() => window.location.reload()} className="rounded-2xl bg-white/25 hover:bg-white/35 text-white font-gp-sans font-semibold text-[0.85rem] uppercase tracking-[0.12em] border border-white/30 backdrop-blur-sm">
            Retry
          </Button>
        </div>
      ) : !products || products.length === 0 ? (
        <div className="glass-card text-center py-16">
          <ShoppingBag className="h-14 w-14 mx-auto text-white/60 mb-4" />
          <p className="font-gp-display text-[1.05rem] italic text-white mb-1">No products available</p>
          <p className="font-gp-sans text-[0.7rem] uppercase tracking-[0.12em] text-white/70">Check back later</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="glass-card text-center py-16">
          <Search className="h-14 w-14 mx-auto text-white/60 mb-4" />
          <p className="font-gp-display text-[1.05rem] italic text-white mb-1">No products found</p>
          <p className="font-gp-serif italic text-white/70 mb-6">Try adjusting your search or filters</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="rounded-2xl border border-white/25 bg-white/10 text-white/90 hover:text-white hover:bg-white/15"
          >
            Clear search
          </Button>
        </div>
      ) : (
        <>
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6 ${totalPages > 1 ? "mb-0" : "mb-16 md:mb-20"}`}>
          {paginatedProducts.map((product) => (
            <Link key={product.id} href={`/shop/product/${product.id}`}>
              <Card className="glass-card overflow-hidden h-full flex flex-col group cursor-pointer hover:border-white/35 transition-colors !border-white/25 !bg-white/10 !shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <div className="w-full h-44 sm:h-48 bg-[rgba(6,13,26,0.5)] overflow-hidden relative flex-shrink-0">
                  <img
                    src={product.coverUrl || product.imageUrl || "/attached_assets/image.png"}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/attached_assets/image.png";
                    }}
                  />
                  {product.category && (
                    <span className="absolute top-2 right-2 text-[10px] font-medium px-2.5 py-1 rounded-2xl bg-white/20 text-white border border-white/25">
                      {product.category}
                    </span>
                  )}
                </div>

                <CardContent className="p-4 sm:p-5 flex-1 flex flex-col min-h-0">
                  <h3 className="font-gp-sans font-medium text-base sm:text-lg text-white mb-2 line-clamp-2 leading-snug">
                    {product.name}
                  </h3>

                  {!product.details?.noPrice && typeof product.price === "number" && product.price > 0 ? (
                    <div className="flex items-baseline gap-1.5 mb-3">
                      <span className="text-xl font-semibold text-white font-gp-brand tracking-[0.04em]">
                        {(product.price / 100).toFixed(2)}
                      </span>
                      <span className="text-sm text-white/75 font-gp-sans tracking-[0.08em] uppercase">
                        {product.currency?.toUpperCase() ?? "AED"}
                      </span>
                    </div>
                  ) : null}

                  {product.description && (
                    <p className="text-sm text-white/80 line-clamp-2 mb-4 flex-1 leading-relaxed">
                      {product.description}
                    </p>
                  )}

                  <p className="text-[11px] text-white/60 mb-4 leading-snug font-gp-sans tracking-[0.08em] uppercase">
                    Affiliate link · opens merchant site
                  </p>

                  <Button
                    size="lg"
                    className="w-full rounded-2xl h-11 bg-white/25 hover:bg-white/35 text-white font-gp-sans font-semibold text-[0.8rem] uppercase tracking-[0.12em] border border-white/30 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleBuyNow(product);
                    }}
                  >
                    Buy Now
                    <ExternalLink className="h-4 w-4 opacity-90" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-8 mb-16 md:mb-20 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="h-10 px-4 rounded-2xl border border-white/25 bg-white/10 text-white/90 hover:text-white hover:bg-white/15 disabled:opacity-50 disabled:pointer-events-none"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 2 && page <= currentPage + 2)
                ) {
                  return (
                    <Button
                      key={page}
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={`h-10 w-10 rounded-[2px] ${
                        currentPage === page
                          ? "bg-white/25 border-white/40 text-white hover:bg-white/35"
                          : "border border-white/25 bg-white/10 text-white/90 hover:text-white hover:bg-white/15"
                      }`}
                    >
                      {page}
                    </Button>
                  );
                } else if (page === currentPage - 3 || page === currentPage + 3) {
                  return <span key={page} className="px-1 text-white/60">…</span>;
                }
                return null;
              })}
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="h-10 px-4 rounded-2xl border border-white/25 bg-white/10 text-white/90 hover:text-white hover:bg-white/15 disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </Button>
          </nav>
        )}
        </>
      )}
        </div>
      </div>
    </div>
  );
}
