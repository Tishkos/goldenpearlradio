import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getAuthToken } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Newspaper,
  Plus,
  Search,
  Filter,
  GripVertical,
  ArrowLeft,
  Edit,
  Trash2,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
  Upload,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type NewsItem = {
  id: number;
  sortOrder?: number;
  title: string;
  message?: string | null;
  newsType: string;
  category?: string | null;
  priority?: string;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkBehavior?: "dialog" | "external";
};

type NewsFormState = {
  title: string;
  message: string;
  newsType: string;
  category: string;
  priority: string;
  expiresAt: string;
  isActive: boolean;
  imageUrl: string;
  linkUrl: string;
  linkBehavior: "dialog" | "external";
};

const defaultForm: NewsFormState = {
  title: "",
  message: "",
  newsType: "breaking",
  category: "",
  priority: "normal",
  expiresAt: "",
  isActive: true,
  imageUrl: "",
  linkUrl: "",
  linkBehavior: "dialog",
};

function mapToForm(item: NewsItem): NewsFormState {
  return {
    title: item.title || "",
    message: item.message || "",
    newsType: item.newsType || "breaking",
    category: item.category || "",
    priority: item.priority || "normal",
    expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : "",
    isActive: item.isActive ?? true,
    imageUrl: item.imageUrl || "",
    linkUrl: item.linkUrl || "",
    linkBehavior: item.linkBehavior === "external" ? "external" : "dialog",
  };
}

function toPayload(form: NewsFormState) {
  return {
    title: form.title.trim(),
    message: form.message.trim() || null,
    newsType: form.newsType,
    category: form.category.trim() || null,
    priority: form.priority,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    isActive: form.isActive,
    imageUrl: form.imageUrl.trim() || null,
    linkUrl: form.linkUrl.trim() || null,
    linkBehavior: form.linkBehavior,
  };
}

export default function BreakingNewsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [orderedNews, setOrderedNews] = useState<NewsItem[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<NewsFormState>(defaultForm);
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<NewsItem | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { data: news = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ["news"],
    queryFn: async () => {
      const data = await api.get<NewsItem[]>("/news");
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setOrderedNews(news);
    setHasOrderChanges(false);
  }, [news]);

  const filteredNews = useMemo(() => {
    return orderedNews.filter((item) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        item.title?.toLowerCase().includes(q) ||
        item.message?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.newsType?.toLowerCase().includes(q)
      );
    });
  }, [orderedNews, search]);

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

  const createMutation = useMutation({
    mutationFn: async (payload: any): Promise<NewsItem> => {
      const created = await api.post<NewsItem>("/news", payload);
      return created;
    },
    onSuccess: (created: NewsItem) => {
      queryClient.setQueryData<NewsItem[]>(["news"], (prev) => [created, ...(prev || [])]);
      queryClient.invalidateQueries({ queryKey: ["news"] });
      toast({ title: "News Created", description: "News item published successfully." });
      setIsFormOpen(false);
      setForm(defaultForm);
      setImageFile(null);
      setEditingItem(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to create news", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }): Promise<NewsItem> => {
      const updated = await api.put<NewsItem>(`/news/${id}`, payload);
      return updated;
    },
    onSuccess: (updated: NewsItem) => {
      queryClient.setQueryData<NewsItem[]>(["news"], (prev) =>
        (prev || []).map((item) => (item.id === updated.id ? updated : item)),
      );
      queryClient.invalidateQueries({ queryKey: ["news"] });
      toast({ title: "News Updated", description: "Changes saved in real time." });
      setIsFormOpen(false);
      setForm(defaultForm);
      setImageFile(null);
      setEditingItem(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to update news", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/news/${id}`),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<NewsItem[]>(["news"], (prev) =>
        (prev || []).filter((item) => item.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: ["news"] });
      toast({ title: "News Deleted", description: "News item removed immediately." });
      setDeleteItem(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to delete news", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: NewsItem[]) =>
      api.put("/news/reorder", {
        items: items.map((item, index) => ({ id: item.id, sortOrder: index })),
      }),
    onSuccess: () => {
      queryClient.setQueryData<NewsItem[]>(["news"], orderedNews);
      queryClient.invalidateQueries({ queryKey: ["news"] });
      setHasOrderChanges(false);
      toast({ title: "Order Saved", description: "News ranking updated for homepage." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to save order", variant: "destructive" });
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setImageFile(null);
    setIsFormOpen(true);
  };

  const openEdit = (item: NewsItem) => {
    setEditingItem(item);
    setForm(mapToForm(item));
    setImageFile(null);
    setIsFormOpen(true);
  };

  const moveItem = (items: NewsItem[], fromId: number, toId: number) => {
    const fromIndex = items.findIndex((i) => i.id === fromId);
    const toIndex = items.findIndex((i) => i.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const handleDragStart = (id: number) => setDraggingId(id);

  const handleDrop = (targetId: number) => {
    if (draggingId === null || draggingId === targetId) {
      setDraggingId(null);
      return;
    }
    setOrderedNews((prev) => moveItem(prev, draggingId, targetId));
    setHasOrderChanges(true);
    setDraggingId(null);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title Required", description: "Please enter a title.", variant: "destructive" });
      return;
    }

    let imageUrl = form.imageUrl;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
    }

    const payload = toPayload({ ...form, imageUrl });

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="font-gp-display text-3xl md:text-4xl font-semibold text-[var(--gp-white)] flex items-center gap-3">
              <div className="h-12 w-12 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)] bg-[rgba(6,13,26,0.35)]">
                <Newspaper className="h-6 w-6" />
              </div>
              News Manager
            </h1>
            <p className="font-gp-serif text-[color:var(--gp-white)]/85 mt-2 text-base">
              Manage homepage news cards with optional images and click behavior.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/admin")}
            className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">Total News</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">{news.length}</h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Newspaper className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">Breaking</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">{news.filter((n) => n.newsType === "breaking").length}</h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Filter className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">With Image</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">{news.filter((n) => !!n.imageUrl).length}</h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <ImageIcon className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gp-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.18em] text-[var(--gp-gold-bright)]/95">External Links</p>
                <h3 className="font-gp-brand text-[1.35rem] text-[color:var(--gp-white)] mt-1">{news.filter((n) => n.linkUrl && n.linkBehavior === "external").length}</h3>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <ExternalLink className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="gp-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[color:var(--gp-white)]/55" size={20} />
              <Input
                placeholder="Search by title, message, category, type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => reorderMutation.mutate(orderedNews)}
                disabled={!hasOrderChanges || reorderMutation.isPending}
                className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
              >
                {reorderMutation.isPending ? "Saving..." : "Save Ranking"}
              </Button>
              <Button
                onClick={openCreate}
                className="gap-2 bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
              >
                <Plus className="h-4 w-4" /> Add News
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-[color:var(--gp-white)]/60 font-sans">
            Drag rows to rank which news shows first on the homepage, then click <span className="text-[var(--gp-gold-bright)]">Save Ranking</span>.
          </p>
        </CardContent>
      </Card>

      <Card className="gp-card overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--gp-gold)]" />
              <p className="mt-4 font-gp-serif italic text-[color:var(--gp-muted)]">Loading news...</p>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="text-center py-16">
              <div className="border border-[var(--gp-border-gold)] rounded-full p-6 w-24 h-24 mx-auto flex items-center justify-center bg-[rgba(6,13,26,0.35)]">
                <Newspaper className="h-12 w-12 text-[color:var(--gp-gold)]/90" />
              </div>
              <h3 className="mt-6 font-gp-display text-xl font-semibold text-[color:var(--gp-white)]">No news found</h3>
              <p className="mt-2 text-sm text-[color:var(--gp-white)]/75 max-w-sm mx-auto font-gp-serif italic">
                Create your first news item or change your search term.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[rgba(6,13,26,0.55)] hover:bg-[rgba(6,13,26,0.55)] border-b border-[var(--gp-border-gold)]/40">
                    <TableHead className="w-10"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Move</span></TableHead>
                    <TableHead className="w-14"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">#</span></TableHead>
                    <TableHead><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Preview</span></TableHead>
                    <TableHead><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Title</span></TableHead>
                    <TableHead><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Type</span></TableHead>
                    <TableHead><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Click</span></TableHead>
                    <TableHead><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Status</span></TableHead>
                    <TableHead className="text-right"><span className="text-xs font-gp-sans uppercase tracking-[0.14em] text-[color:var(--gp-white)]/70">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNews.map((item, idx) => (
                    <TableRow
                      key={item.id}
                      draggable
                      onDragStart={() => handleDragStart(item.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(item.id)}
                      className={`hover:bg-white/5 transition-colors border-b border-[var(--gp-border-gold)]/15 ${draggingId === item.id ? "opacity-50" : ""}`}
                    >
                      <TableCell>
                        <div className="flex items-center justify-center cursor-grab active:cursor-grabbing text-[color:var(--gp-white)]/55">
                          <GripVertical className="h-4 w-4" />
                        </div>
                      </TableCell>
                      <TableCell className="font-gp-sans text-[color:var(--gp-white)]/75 text-sm">{idx + 1}</TableCell>
                      <TableCell>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="w-12 h-12 object-cover rounded-[2px] border border-[var(--gp-border-gold)]/35" />
                        ) : (
                          <div className="w-12 h-12 rounded-[2px] border border-[var(--gp-border-gold)]/35 bg-[rgba(6,13,26,0.35)] flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-[color:var(--gp-gold)]/90" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-sans font-semibold text-[color:var(--gp-white)] text-[0.95rem] line-clamp-1">{item.title}</p>
                          {item.message ? (
                            <p className="text-[color:var(--gp-white)]/70 text-xs line-clamp-2 max-w-sm">{item.message}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-[color:var(--gp-white)]/80 text-sm font-sans">{item.newsType || "news"}</TableCell>
                      <TableCell className="text-[color:var(--gp-white)]/80 text-sm font-sans">
                        {item.linkUrl ? (item.linkBehavior === "external" ? "Direct Link" : "Dialog") : "Dialog"}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-gp-sans uppercase tracking-[0.1em] border ${
                          item.isActive
                            ? "border-[var(--gp-border-gold)]/45 bg-[rgba(201,168,76,0.18)] text-[var(--gp-gold-bright)]"
                            : "border-[rgba(239,68,68,0.45)] bg-[rgba(127,29,29,0.35)] text-red-300"
                        }`}>
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(item)}
                            className="h-7 w-7 hover:bg-white/5 hover:text-[var(--gp-gold-bright)] text-[color:var(--gp-white)]/60"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteItem(item)}
                            className="h-7 w-7 hover:bg-[rgba(127,29,29,0.35)] hover:text-red-300 text-[color:var(--gp-white)]/60"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
          <DialogHeader>
            <DialogTitle className="font-gp-display text-2xl md:text-3xl font-semibold text-[color:var(--gp-white)]">
              {editingItem ? "Edit News" : "Add New News"}
            </DialogTitle>
            <DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/90 text-base leading-relaxed">
              Manage title, message, optional image, and click behavior for home page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Card className="gp-card">
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label htmlFor="news-title" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Title *</Label>
                  <Input
                    id="news-title"
                    value={form.title}
                    onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                    className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    placeholder="Headline"
                  />
                </div>

                <div>
                  <Label htmlFor="news-message" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Message</Label>
                  <Textarea
                    id="news-message"
                    value={form.message}
                    onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
                    className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    placeholder="News details"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Type</Label>
                    <Select value={form.newsType} onValueChange={(v) => setForm((s) => ({ ...s, newsType: v }))}>
                      <SelectTrigger className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breaking">Breaking</SelectItem>
                        <SelectItem value="news">News</SelectItem>
                        <SelectItem value="alert">Alert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm((s) => ({ ...s, priority: v }))}>
                      <SelectTrigger className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Category</Label>
                    <Input
                      value={form.category}
                      onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                      className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                      placeholder="Culture, Events..."
                    />
                  </div>
                </div>

                <div>
                  <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Image (Optional)</Label>
                  <Input
                    value={form.imageUrl}
                    onChange={(e) => setForm((s) => ({ ...s, imageUrl: e.target.value }))}
                    className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    placeholder="https://..."
                  />
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-sans file:bg-[rgba(201,168,76,0.2)] file:text-[var(--gp-gold-bright)] hover:file:bg-[rgba(201,168,76,0.32)]"
                    />
                    {imageFile ? (
                      <p className="text-sm text-[var(--gp-gold-bright)] mt-1 font-sans inline-flex items-center gap-1">
                        <Upload className="h-4 w-4" />
                        Selected: {imageFile.name}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">Link (Optional)</Label>
                    <Input
                      value={form.linkUrl}
                      onChange={(e) => setForm((s) => ({ ...s, linkUrl: e.target.value }))}
                      className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label className="font-gp-sans text-[color:var(--gp-white)] text-sm">On Click</Label>
                    <Select value={form.linkBehavior} onValueChange={(v: "dialog" | "external") => setForm((s) => ({ ...s, linkBehavior: v }))}>
                      <SelectTrigger className="mt-2 bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dialog">Open Dialog</SelectItem>
                        <SelectItem value="external">Open New Tab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingItem ? "Update News" : "Create News"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-gp-display text-[color:var(--gp-white)]">Delete News</AlertDialogTitle>
            <AlertDialogDescription className="text-[color:var(--gp-white)]/80 font-gp-serif">
              Are you sure you want to delete "{deleteItem?.title}"? This updates immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              className="bg-red-700 hover:bg-red-600 text-white"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </div>
  );
}
