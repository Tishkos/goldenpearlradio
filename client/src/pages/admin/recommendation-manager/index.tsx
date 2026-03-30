import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getAuthToken } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  Megaphone,
  Plus,
  Search,
  ArrowLeft,
  Edit,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Upload,
  GripVertical,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Product = { id: number; name: string; description?: string | null; imageUrl?: string | null; coverUrl?: string | null; affiliateUrl?: string | null; category?: string | null; locationId?: number | null; isActive?: boolean; };
type Location = { id: number; name: string };

type Promotion = {
  id: number;
  sortOrder?: number;
  title: string;
  message?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkBehavior?: "dialog" | "external";
  isActive: boolean;
  createdAt: string;
  productId?: number | null;
  locationId?: number | null;
  product?: Product | null;
  location?: Location | null;
};

type PromotionFormState = {
  productId: string;
  title: string;
  message: string;
  category: string;
  imageUrl: string;
  linkUrl: string;
  linkBehavior: "dialog" | "external";
  locationId: string;
  locationName: string;
  isActive: boolean;
};

const defaultForm: PromotionFormState = {
  productId: "none",
  title: "",
  message: "",
  category: "",
  imageUrl: "",
  linkUrl: "",
  linkBehavior: "dialog",
  locationId: "none",
  locationName: "",
  isActive: true,
};

function mapToForm(item: Promotion): PromotionFormState {
  return {
    productId: item.productId ? String(item.productId) : "none",
    title: item.title || "",
    message: item.message || "",
    category: item.category || "",
    imageUrl: item.imageUrl || "",
    linkUrl: item.linkUrl || "",
    linkBehavior: item.linkBehavior === "external" ? "external" : "dialog",
    locationId: item.locationId ? String(item.locationId) : "none",
    locationName: item.location?.name || "",
    isActive: item.isActive ?? true,
  };
}

export default function PromotionManagerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [orderedPromotions, setOrderedPromotions] = useState<Promotion[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<PromotionFormState>(defaultForm);
  const [editingItem, setEditingItem] = useState<Promotion | null>(null);
  const [deleteItem, setDeleteItem] = useState<Promotion | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ["promotions"],
    queryFn: async () => {
      const data = await api.get<Promotion[]>("/promotions");
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const data = await api.get<Product[]>("/products");
      return (Array.isArray(data) ? data : []).filter((p) => p.isActive !== false);
    },
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      const data = await api.get<Location[]>("/locations");
      return Array.isArray(data) ? data : [];
    },
  });

  useEffect(() => {
    setOrderedPromotions(promotions);
    setHasOrderChanges(false);
  }, [promotions]);

  const filteredPromotions = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return orderedPromotions;
    return orderedPromotions.filter((item) =>
      item.title?.toLowerCase().includes(q) ||
      item.message?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      item.product?.name?.toLowerCase().includes(q) ||
      item.location?.name?.toLowerCase().includes(q)
    );
  }, [orderedPromotions, search]);

  const uploadImage = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const token = getAuthToken();
    const baseApi = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    const response = await fetch(`${baseApi}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Image upload failed");
    }
    const data = await response.json();
    return data.absoluteUrl || `${baseApi.replace("/api", "")}${data.url}`;
  };

  const toPayload = (f: PromotionFormState, resolvedLocationId: number | null) => ({
    productId: f.productId !== "none" ? Number(f.productId) : null,
    title: f.title.trim(),
    message: f.message.trim() || null,
    category: f.category.trim() || null,
    imageUrl: f.imageUrl.trim() || null,
    linkUrl: f.linkUrl.trim() || null,
    linkBehavior: f.linkBehavior,
    locationId: resolvedLocationId,
    isActive: f.isActive,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any): Promise<Promotion> => api.post<Promotion>("/promotions", payload),
    onSuccess: (created) => {
      queryClient.setQueryData<Promotion[]>(["promotions"], (prev) => [created, ...(prev || [])]);
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      setIsFormOpen(false);
      setForm(defaultForm);
      setImageFile(null);
      setEditingItem(null);
      toast({ title: "Promotion Created", description: "Promotion published successfully." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }): Promise<Promotion> => api.put<Promotion>(`/promotions/${id}`, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<Promotion[]>(["promotions"], (prev) => (prev || []).map((item) => (item.id === updated.id ? updated : item)));
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      setIsFormOpen(false);
      setForm(defaultForm);
      setImageFile(null);
      setEditingItem(null);
      toast({ title: "Promotion Updated", description: "Changes saved in real time." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/promotions/${id}`),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<Promotion[]>(["promotions"], (prev) => (prev || []).filter((item) => item.id !== id));
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      setDeleteItem(null);
      toast({ title: "Promotion Deleted", description: "Promotion removed immediately." });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: Promotion[]) => api.put("/promotions/reorder", { items: items.map((item, index) => ({ id: item.id, sortOrder: index })) }),
    onSuccess: () => {
      queryClient.setQueryData<Promotion[]>(["promotions"], orderedPromotions);
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      setHasOrderChanges(false);
      toast({ title: "Order Saved", description: "Promotion ranking updated for homepage." });
    },
  });

  const moveItem = (items: Promotion[], fromId: number, toId: number) => {
    const fromIndex = items.findIndex((i) => i.id === fromId);
    const toIndex = items.findIndex((i) => i.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const applyProductPreset = (productId: string) => {
    if (productId === "none") return;
    const product = products.find((p) => p.id === Number(productId));
    if (!product) return;
    setForm((prev) => ({
      ...prev,
      productId,
      title: prev.title || product.name || "",
      message: prev.message || product.description || "",
      category: prev.category || product.category || "",
      imageUrl: prev.imageUrl || product.coverUrl || product.imageUrl || "",
      linkUrl: prev.linkUrl || product.affiliateUrl || "",
      locationName: "",
      locationId: prev.locationId !== "none" ? prev.locationId : (product.locationId ? String(product.locationId) : "none"),
      linkBehavior: prev.linkBehavior || "external",
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title Required", description: "Please enter a promotion title.", variant: "destructive" });
      return;
    }
    const hasProductSelected = form.productId !== "none";
    if (!hasProductSelected && form.linkBehavior === "external" && !form.linkUrl.trim()) {
      toast({ title: "Link Required", description: "Direct link is required when click behavior is direct page.", variant: "destructive" });
      return;
    }
    const resolveLocationId = async (): Promise<number | null> => {
      const typedName = form.locationName.trim();
      if (!typedName) return form.locationId !== "none" ? Number(form.locationId) : null;

      const existing = locations.find((loc) => loc.name.toLowerCase() === typedName.toLowerCase());
      if (existing) return existing.id;

      const created = await api.post<Location>("/locations", { name: typedName, address: "" });
      await queryClient.invalidateQueries({ queryKey: ["locations"] });
      return created.id;
    };

    let imageUrl = form.imageUrl;
    if (imageFile) imageUrl = await uploadImage(imageFile);
    const resolvedLocationId = await resolveLocationId();
    const payloadForm = hasProductSelected
      ? {
          ...form,
          imageUrl,
          linkBehavior: "external" as const,
          linkUrl: `/store/product/${form.productId}`,
        }
      : { ...form, imageUrl };
    const payload = toPayload(payloadForm, resolvedLocationId);
    if (editingItem) updateMutation.mutate({ id: editingItem.id, payload });
    else createMutation.mutate(payload);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="font-gp-display text-3xl md:text-4xl font-semibold text-[var(--gp-white)] flex items-center gap-3">
              <div className="h-12 w-12 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)] bg-[rgba(6,13,26,0.35)]"><Megaphone className="h-6 w-6" /></div>
              Promotion Manager
            </h1>
            <p className="font-gp-serif text-[color:var(--gp-white)]/85 mt-2 text-base">Create promotions, link existing products, and control homepage ranking.</p>
          </div>
          <Button variant="outline" onClick={() => (window.location.href = "/admin")} className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="gp-card"><CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--gp-white)]/55" size={20} />
              <Input placeholder="Search by title, product, category, location..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-sm" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => reorderMutation.mutate(orderedPromotions)} disabled={!hasOrderChanges || reorderMutation.isPending} className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal">{reorderMutation.isPending ? "Saving..." : "Save Ranking"}</Button>
              <Button onClick={() => { setEditingItem(null); setForm(defaultForm); setImageFile(null); setIsFormOpen(true); }} className="gap-2 bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"><Plus className="h-4 w-4" /> Add Promotion</Button>
            </div>
          </div>
        </CardContent></Card>

        <Card className="gp-card overflow-hidden"><CardContent className="p-0">
          {isLoading ? <div className="flex flex-col justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--gp-gold)]" /><p className="mt-4 font-gp-serif italic text-[color:var(--gp-muted)]">Loading promotions...</p></div> : (
            <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[rgba(6,13,26,0.55)] hover:bg-[rgba(6,13,26,0.55)] border-b border-[var(--gp-border-gold)]/40">
              <TableHead className="w-10"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Move</span></TableHead>
              <TableHead className="w-14"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">#</span></TableHead>
              <TableHead><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Preview</span></TableHead>
              <TableHead><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Title</span></TableHead>
              <TableHead><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Product</span></TableHead>
              <TableHead><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Click</span></TableHead>
              <TableHead><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Actions</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{filteredPromotions.map((item, idx) => (
              <TableRow key={item.id} draggable onDragStart={() => setDraggingId(item.id)} onDragEnd={() => setDraggingId(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (draggingId && draggingId !== item.id) { setOrderedPromotions((prev) => moveItem(prev, draggingId, item.id)); setHasOrderChanges(true); } setDraggingId(null); }} className={`hover:bg-white/5 transition-colors border-b border-[var(--gp-border-gold)]/15 ${draggingId === item.id ? "opacity-50" : ""}`}>
                <TableCell><GripVertical className="h-4 w-4 text-[color:var(--gp-white)]/55" /></TableCell>
                <TableCell className="font-gp-sans text-[color:var(--gp-white)]/75 text-sm">{idx + 1}</TableCell>
                <TableCell>{item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="w-12 h-12 object-cover rounded-[2px] border border-[var(--gp-border-gold)]/35" /> : <div className="w-12 h-12 rounded-[2px] border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)] flex items-center justify-center"><ImageIcon className="h-5 w-5 text-[color:var(--gp-gold)]/90" /></div>}</TableCell>
                <TableCell><p className="font-sans font-semibold text-[color:var(--gp-white)] text-[0.95rem] line-clamp-1">{item.title}</p><p className="text-[color:var(--gp-white)]/70 text-xs line-clamp-2 max-w-sm">{item.message}</p></TableCell>
                <TableCell className="text-[color:var(--gp-white)]/80 text-sm font-sans">{item.product?.name || "-"}</TableCell>
                <TableCell className="text-[color:var(--gp-white)]/80 text-sm font-sans">{item.productId ? "Store Page" : item.linkUrl ? (item.linkBehavior === "external" ? "Direct Link" : "Dialog") : "Dialog"}</TableCell>
                <TableCell className="text-right"><div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setForm(mapToForm(item)); setImageFile(null); setIsFormOpen(true); }} className="h-7 w-7 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/60"><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteItem(item)} className="h-7 w-7 hover:bg-[rgba(127,29,29,0.35)] hover:text-red-300 text-[color:var(--gp-white)]/60"><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>
              </TableRow>
            ))}</TableBody></Table></div>
          )}
        </CardContent></Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}><DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]"><DialogHeader><DialogTitle className="font-gp-display text-2xl md:text-3xl font-semibold text-[color:var(--gp-white)]">{editingItem ? "Edit Promotion" : "Add New Promotion"}</DialogTitle><DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/90 text-base leading-relaxed">Create standalone promotions or start from an existing product.</DialogDescription></DialogHeader>
          <div className="space-y-6"><Card className="gp-card"><CardContent className="p-6 space-y-4">
            <div><Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Existing Product (Optional)</Label><Select value={form.productId} onValueChange={(v) => { setForm((s) => ({ ...s, productId: v })); applyProductPreset(v); }}><SelectTrigger className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base"><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent><SelectItem value="none">No Product (Standalone Promotion)</SelectItem>{products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Title *</Label><Input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base" /></div>
            <div><Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Message</Label><Textarea value={form.message} onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))} className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base" rows={4} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Category</Label><Input value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base" /></div>
            <div><Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Location (Optional)</Label><Select value={form.locationId} onValueChange={(v) => setForm((s) => ({ ...s, locationId: v, locationName: v === "none" ? s.locationName : "" }))}><SelectTrigger className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base"><SelectValue placeholder="Select location" /></SelectTrigger><SelectContent><SelectItem value="none">No Location</SelectItem>{locations.map((loc) => <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>)}</SelectContent></Select><Input value={form.locationName} onChange={(e) => setForm((s) => ({ ...s, locationName: e.target.value, locationId: e.target.value.trim() ? "none" : s.locationId }))} placeholder="Or type a new location name..." className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base" /></div></div>
            <div><Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Image (Optional)</Label><Input value={form.imageUrl} onChange={(e) => setForm((s) => ({ ...s, imageUrl: e.target.value }))} className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base" /><div className="mt-2"><Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-sans file:bg-[rgba(201,168,76,0.2)] file:text-[var(--gp-gold-bright)] hover:file:bg-[rgba(201,168,76,0.32)]" /></div></div>
            {form.productId !== "none" ? (
              <div className="rounded-[2px] border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)] p-3">
                <p className="font-gp-sans text-sm text-[color:var(--gp-white)]/90">
                  This promotion is linked to an existing product and will open directly at
                  <span className="text-[var(--gp-gold-bright)]"> /store/product/{form.productId}</span>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Link {form.linkBehavior === "external" ? "*" : "(Optional)"}</Label><Input value={form.linkUrl} onChange={(e) => setForm((s) => ({ ...s, linkUrl: e.target.value }))} placeholder={form.linkBehavior === "external" ? "Required for direct page" : "Optional link"} className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base" /></div>
              <div><Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">On Click</Label><Select value={form.linkBehavior} onValueChange={(v: "dialog" | "external") => setForm((s) => ({ ...s, linkBehavior: v }))}><SelectTrigger className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dialog">Open Dialog</SelectItem><SelectItem value="external">Direct Page</SelectItem></SelectContent></Select></div></div>
            )}
          </CardContent></Card>
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal">Cancel</Button><Button type="button" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal">{(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editingItem ? "Update Promotion" : "Create Promotion"}</Button></div>
          </div>
        </DialogContent></Dialog>

        <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
          <AlertDialogContent className="bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
            <AlertDialogHeader><AlertDialogTitle className="font-gp-display text-[color:var(--gp-white)]">Delete Promotion</AlertDialogTitle><AlertDialogDescription className="text-[color:var(--gp-white)]/80 font-gp-serif">Are you sure you want to delete \"{deleteItem?.title}\"?</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)} className="bg-red-700 hover:bg-red-600 text-white">{deleteMutation.isPending ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
