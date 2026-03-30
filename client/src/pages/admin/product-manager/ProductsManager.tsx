import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import type { Product } from "@/types/api-models";
import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShoppingBag, Plus, Search, Filter, Clock, Play, Edit, Trash2, ArrowUpDown, Globe, Tag, Image, Link as LinkIcon
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import ProductFormDialog from "./ProductFormDialog";

import { usePlayer } from "@/components/player/PlayerProvider";

export default function ProductsManager() {
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productFormMode, setProductFormMode] = useState<"full" | "audio" | "metadata" | "cover">("full");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Product | "";
    direction: "ascending" | "descending";
  }>({ key: "", direction: "ascending" });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const player = usePlayer();

  // Fetch products - get all including inactive for admin
  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const data = await api.get<Product[]>("/products");
      return data || [];
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (product: Product) => {
      await api.delete(`/products/${product.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Product Deleted",
        description: "The product has been successfully removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete product: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Format seconds as MM:SS
  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Filter products based on search query
  const filteredProducts = products?.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (product.affiliateUrl && product.affiliateUrl.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort products
  const sortedProducts =
    filteredProducts && sortConfig.key
      ? [...filteredProducts].sort((a, b) => {
          const aValue = a[sortConfig.key as keyof Product];
          const bValue = b[sortConfig.key as keyof Product];

          if (aValue === null || aValue === undefined)
            return sortConfig.direction === "ascending" ? -1 : 1;
          if (bValue === null || bValue === undefined)
            return sortConfig.direction === "ascending" ? 1 : -1;

          if (typeof aValue === "string" && typeof bValue === "string") {
            return sortConfig.direction === "ascending"
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          }

          return sortConfig.direction === "ascending"
            ? aValue < bValue
              ? -1
              : 1
            : aValue > bValue
            ? -1
            : 1;
        })
      : filteredProducts;

  const handleSort = (key: keyof Product) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "ascending"
          ? "descending"
          : "ascending",
    });
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductFormMode("full");
    setIsProductFormOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedProduct) {
      deleteProductMutation.mutate(selectedProduct);
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
    }
  };

  const handleChangeAudio = (product: Product) => {
    setSelectedProduct(product);
    setProductFormMode("audio");
    setIsProductFormOpen(true);
  };

  const handleChangeCover = (product: Product) => {
    setSelectedProduct(product);
    setProductFormMode("cover");
    setIsProductFormOpen(true);
  };

  const handleChangeMetadata = (product: Product) => {
    setSelectedProduct(product);
    setProductFormMode("metadata");
    setIsProductFormOpen(true);
  };

  const handlePlayPause = (productId: number, productUrl: string) => {
    const product = products?.find((p) => p.id === productId);
    if (!product || !product.audioUrl) return;

    // Adapt product to track format for PlayerProvider
    const adaptedProduct = {
      ...product,
      url: product.audioUrl,
      title: product.name,
      artist: product.category || 'Product',
      coverArt: product.coverUrl || product.imageUrl,
    };

    // Use PlayerProvider for main playback
    player.playTrack(adaptedProduct as any);

    toast({
      title: "Now Playing",
      description: `${product.name}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">Total Products</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">{products?.length || 0}</h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <ShoppingBag className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">Active Products</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">
                  {products?.filter(p => p.isActive).length || 0}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Tag className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">Categories</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">
                  {products ? new Set(products.map((p) => p.category).filter(Boolean)).size : 0}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Tag className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">With Audio</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">
                  {products?.filter(p => p.audioUrl).length || 0}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Play className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card className="gp-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--gp-white)]/55" size={20} />
              <Input
                placeholder="Search by name, description, category, or link..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <Button
                onClick={() => {
                  setSelectedProduct(null);
                  setProductFormMode("full");
                  setIsProductFormOpen(true);
                }}
                className="gap-2 bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
              >
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="gp-card overflow-hidden">
        <CardContent className="p-0">
          {isLoadingProducts ? (
            <div className="flex flex-col justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--gp-gold)]"></div>
              <p className="mt-4 font-gp-serif italic text-[color:var(--gp-muted)]">Loading products...</p>
            </div>
          ) : sortedProducts?.length === 0 ? (
            <div className="text-center py-16">
              <div className="border border-[var(--gp-border-gold)] rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center bg-[rgba(6,13,26,0.35)]">
                <ShoppingBag className="h-12 w-12 text-[color:var(--gp-gold)]/90" />
              </div>
              <h3 className="mt-6 font-gp-display text-xl font-semibold text-[color:var(--gp-white)]">No products found</h3>
              <p className="mt-2 text-sm text-[color:var(--gp-white)]/75 max-w-sm mx-auto font-gp-serif italic">
                {searchQuery
                  ? "No products match your search criteria. Try a different search term."
                  : "Get started by adding your first product to the library."}
              </p>
              <div className="mt-8">
                <Button
                  onClick={() => {
                    setSelectedProduct(null);
                    setIsProductFormOpen(true);
                  }}
                  className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] gap-2 font-sans text-sm font-semibold tracking-normal"
                  size="lg"
                >
                  <Plus className="h-5 w-5" /> Add Your First Product
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[rgba(6,13,26,0.55)] hover:bg-[rgba(6,13,26,0.55)] border-b border-[var(--gp-border-gold)]/40">
                    <TableHead className="w-14"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">#</span></TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-16"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Cover</span></TableHead>
                    <TableHead className="cursor-pointer hover:bg-white/5" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-1 font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">
                        Name
                        <ArrowUpDown
                          className={`ml-1 h-4 w-4 ${
                            sortConfig.key === "name" ? "text-[var(--gp-gold-bright)]" : "text-[color:var(--gp-white)]/35"
                          }`}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Link</TableHead>
                    <TableHead className="cursor-pointer hover:bg-white/5" onClick={() => handleSort("category")}>
                      <div className="flex items-center gap-1 font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">
                        Category
                        <ArrowUpDown
                          className={`ml-1 h-4 w-4 ${
                            sortConfig.key === "category" ? "text-[var(--gp-gold-bright)]" : "text-[color:var(--gp-white)]/35"
                          }`}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-white/5" onClick={() => handleSort("duration")}>
                      <div className="flex items-center gap-1 font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">
                        Duration
                        <ArrowUpDown
                          className={`ml-1 h-4 w-4 ${
                            sortConfig.key === "duration" ? "text-[var(--gp-gold-bright)]" : "text-[color:var(--gp-white)]/35"
                          }`}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Status</TableHead>
                    <TableHead className="text-right font-gp-sans text-xs uppercase tracking-[0.14em] text-[color:var(--gp-white)]/75">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProducts?.map((product, index) => (
                    <TableRow key={product.id} className="hover:bg-white/5 transition-colors border-b border-[var(--gp-border-gold)]/15">
                      <TableCell className="font-gp-sans text-[color:var(--gp-white)]/75 text-sm">{index + 1}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/70"
                          onClick={() => product.audioUrl && handlePlayPause(product.id, product.audioUrl)}
                          disabled={!product.audioUrl}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        {(product.coverUrl || product.imageUrl) ? (
                          <img
                            src={product.coverUrl || product.imageUrl || ''}
                            alt={`${product.name} cover`}
                            className="w-10 h-10 object-cover rounded-[2px] border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-[2px] border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)] flex items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-[color:var(--gp-gold)]/90" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-semibold text-[color:var(--gp-white)] text-[0.95rem]">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.affiliateUrl ? (
                          <a
                            href={product.affiliateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--gp-gold-bright)] hover:text-[var(--gp-gold)] flex items-center gap-1 text-sm font-sans"
                          >
                            <LinkIcon className="h-3 w-3" />
                            View Link
                          </a>
                        ) : (
                          <span className="text-[color:var(--gp-white)]/35">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.category ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border border-[var(--gp-border-gold)]/40 bg-[rgba(6,13,26,0.4)] text-[color:var(--gp-white)]/80">
                            {product.category}
                          </span>
                        ) : (
                          <span className="text-[color:var(--gp-white)]/35">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[color:var(--gp-white)]/80 font-sans text-sm">{formatDuration(product.duration)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border ${
                          product.isActive
                            ? 'border-[var(--gp-border-gold)]/45 bg-[rgba(201,168,76,0.18)] text-[var(--gp-gold-bright)]'
                            : 'border-[rgba(239,68,68,0.45)] bg-[rgba(127,29,29,0.35)] text-red-300'
                        }`}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="flex flex-col gap-1">
                            {/* Row 1: Audio, Cover, Metadata */}
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleChangeAudio(product)}
                                className="h-6 w-6 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/60"
                                title="Change audio"
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleChangeCover(product)}
                                className="h-6 w-6 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/60"
                                title="Change cover"
                              >
                                <Image className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleChangeMetadata(product)}
                                className="h-6 w-6 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/60"
                                title="Edit metadata"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                            {/* Row 2: Delete */}
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(product)}
                                className="h-6 w-6 hover:bg-[rgba(127,29,29,0.35)] hover:text-red-300 text-[color:var(--gp-white)]/60"
                                title="Delete product"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={isProductFormOpen}
        onOpenChange={setIsProductFormOpen}
        selectedProduct={selectedProduct}
        mode={productFormMode}
        onSuccess={() => {
          // Refresh products data
          queryClient.invalidateQueries({ queryKey: ['products'] });
          setIsProductFormOpen(false);
          setSelectedProduct(null);
          setProductFormMode("full");
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-gp-display text-[color:var(--gp-white)]">Delete Product</AlertDialogTitle>
            <AlertDialogDescription className="text-[color:var(--gp-white)]/80 font-gp-serif">
              Are you sure you want to delete "{selectedProduct?.name}"?
              This action cannot be undone and will permanently remove the product from the library.
              {selectedProduct?.audioUrl && (
                <span className="block mt-2 text-amber-300 font-gp-sans">
                  Note: Associated audio files will be removed from storage.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-700 hover:bg-red-600 text-white"
            >
              {deleteProductMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
