import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Podcast, Plus, Trash2, Pencil, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAuthToken } from "@/lib/api-client";
import {
  createScheduleItem,
  deleteScheduleItem,
  fetchScheduleItems,
  type ScheduleItem,
  type ScheduleKind,
  updateScheduleItem,
} from "@/lib/schedule-api";

type ScheduleManagerProps = {
  kind: ScheduleKind;
};

function toInputDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromInputDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read image file"));
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

async function fileToCompressedDataUrl(file: File, maxSize = 1280, quality = 0.82) {
  const original = await fileToDataUrl(file);
  if (typeof window === "undefined") return original;

  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        resolve(original);
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => resolve(original);
    image.src = original;
  });
}

export default function ScheduleManager({ kind }: ScheduleManagerProps) {
  const isPodcast = kind === "podcast";
  const title = isPodcast ? "Podcast Manager" : "Programme Manager";
  const Icon = isPodcast ? Podcast : CalendarDays;

  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery<ScheduleItem[]>({
    queryKey: ["schedule-items", kind],
    queryFn: () => fetchScheduleItems(kind),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startAt: "",
    imageUrl: "",
  });
  const [fileInputKey, setFileInputKey] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["schedule-items", kind] });

  const upcomingYear = useMemo(() => {
    const now = Date.now();
    const year = now + 365 * 24 * 60 * 60 * 1000;
    return items.filter((item) => {
      const time = new Date(item.startAt).getTime();
      return time >= now && time <= year;
    });
  }, [items]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ title: "", description: "", startAt: "", imageUrl: "" });
    setFileInputKey((prev) => prev + 1);
    setImageFile(null);
    setUploadError(null);
    setActionError(null);
  };

  const uploadImage = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const token = getAuthToken();
    const baseApi = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    try {
      const response = await fetch(`${baseApi}/upload?folder=own`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message = String(err.error || `HTTP error! status: ${response.status}`);
        if (
          message.toLowerCase().includes("404") ||
          message.toLowerCase().includes("not found") ||
          message.toLowerCase().includes("failed to fetch") ||
          message.toLowerCase().includes("backend server is not running") ||
          message.toLowerCase().includes("no token provided") ||
          message.toLowerCase().includes("authentication failed") ||
          message.toLowerCase().includes("forbidden")
        ) {
          return fileToCompressedDataUrl(file);
        }
        throw new Error(message || "Image upload failed");
      }
      const data = await response.json();
      return data.absoluteUrl || `${baseApi.replace("/api", "")}${data.url}`;
    } catch (error: any) {
      const message = String(error?.message || "");
      if (
        message.toLowerCase().includes("404") ||
        message.toLowerCase().includes("not found") ||
        message.toLowerCase().includes("failed to fetch") ||
        message.toLowerCase().includes("backend server is not running") ||
        message.toLowerCase().includes("no token provided") ||
        message.toLowerCase().includes("authentication failed") ||
        message.toLowerCase().includes("forbidden")
      ) {
        return fileToCompressedDataUrl(file);
      }
      throw error;
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      if (!form.title.trim() || !form.startAt) return;

      let finalImageUrl = form.imageUrl.trim() || null;
      try {
        setUploadError(null);
        setActionError(null);
        if (imageFile) {
          setIsUploadingImage(true);
          finalImageUrl = await uploadImage(imageFile);
          if (finalImageUrl.startsWith("data:")) {
            setUploadError("Upload server unavailable. Image saved locally for this item on this device.");
          }
        }
      } catch (error: any) {
        setUploadError(error?.message || "Failed to upload image");
        setIsUploadingImage(false);
        return;
      } finally {
        setIsUploadingImage(false);
      }

      if (editingId) {
        try {
          await updateScheduleItem(editingId, {
            kind,
            title: form.title.trim(),
            description: form.description.trim(),
            imageUrl: finalImageUrl,
            startAt: fromInputDateTime(form.startAt),
          });
        } catch (error: any) {
          setActionError(error?.message || "Failed to update item");
          return;
        }
      } else {
        try {
          await createScheduleItem({
            kind,
            title: form.title.trim(),
            description: form.description.trim(),
            imageUrl: finalImageUrl,
            startAt: fromInputDateTime(form.startAt),
          });
        } catch (error: any) {
          setActionError(error?.message || "Failed to create item");
          return;
        }
      }
      refresh();
      resetForm();
    })();
  };

  const onEdit = (item: ScheduleItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      startAt: toInputDateTime(item.startAt),
      imageUrl: item.imageUrl || "",
    });
    setFileInputKey((prev) => prev + 1);
  };

  const onImageFileChange = (file?: File | null) => {
    if (!file) {
      setImageFile(null);
      return;
    }
    setUploadError(null);
    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, imageUrl: previewUrl }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 text-[color:var(--gp-white)]">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-gp-display text-3xl font-semibold text-[var(--gp-white)]">{title}</h1>
          <p className="font-gp-serif italic text-[color:var(--gp-muted)] mt-1">
            Manage timeline items with start time, image, and details.
          </p>
        </div>
        <div className="h-12 w-12 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 gp-card p-6">
          <h2 className="font-gp-sans text-[0.7rem] uppercase tracking-[0.16em] text-[var(--gp-gold-bright)] mb-4">
            {editingId ? "Edit Item" : "Add New Item"}
          </h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="font-gp-sans text-[0.65rem] uppercase tracking-[0.12em] text-white/80">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
                className="mt-1 bg-white/10 border-white/25 text-white"
                placeholder={isPodcast ? "Podcast episode title" : "Programme title"}
              />
            </div>
            <div>
              <label className="font-gp-sans text-[0.65rem] uppercase tracking-[0.12em] text-white/80">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="mt-1 bg-white/10 border-white/25 text-white"
                placeholder="Short description..."
              />
            </div>
            <div>
              <label className="font-gp-sans text-[0.65rem] uppercase tracking-[0.12em] text-white/80">Start Timeline</label>
              <Input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((prev) => ({ ...prev, startAt: e.target.value }))}
                required
                className="mt-1 bg-white/10 border-white/25 text-white"
              />
            </div>
            <div>
              <label className="font-gp-sans text-[0.65rem] uppercase tracking-[0.12em] text-white/80">Attach Image</label>
              <Input
                key={fileInputKey}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  onImageFileChange(e.target.files?.[0] ?? null);
                }}
                className="mt-1 bg-white/10 border-white/25 text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-1.5 file:text-xs file:text-white"
              />
              <p className="mt-1 text-[11px] text-white/65">You can upload a photo or use a URL below.</p>
              {uploadError ? <p className="mt-1 text-[11px] text-red-300">{uploadError}</p> : null}
              {isUploadingImage ? <p className="mt-1 text-[11px] text-white/70">Uploading image...</p> : null}
            </div>
            <div>
              <label className="font-gp-sans text-[0.65rem] uppercase tracking-[0.12em] text-white/80">Image URL (Optional)</label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                className="mt-1 bg-white/10 border-white/25 text-white"
                placeholder="https://..."
              />
            </div>
            {form.imageUrl ? (
              <div className="rounded-xl border border-white/20 bg-white/5 p-2">
                <img src={form.imageUrl} alt="Preview" className="h-28 w-full object-cover rounded-lg" />
              </div>
            ) : null}
            {actionError ? <p className="text-[11px] text-red-300">{actionError}</p> : null}
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={isUploadingImage}
                className="bg-[var(--gp-gold)] text-[var(--gp-navy-deep)] hover:bg-[var(--gp-gold-bright)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                {editingId ? "Update" : "Create"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm} className="border-white/25 text-white">
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 gp-card p-6">
          <h2 className="font-gp-sans text-[0.7rem] uppercase tracking-[0.16em] text-[var(--gp-gold-bright)] mb-4">
            All Items
          </h2>
          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-white/20 bg-white/5 p-6 text-center text-white/70">
                No items yet. Add your first one.
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-gp-sans text-white font-semibold line-clamp-1">{item.title}</p>
                      <p className="font-gp-sans text-xs text-white/75 mt-1 line-clamp-2">{item.description || "No description"}</p>
                      <p className="mt-2 inline-flex items-center gap-1 text-[10px] tracking-[0.1em] uppercase text-white/65">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(item.startAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)} className="border-white/25 text-white">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void (async () => {
                            try {
                              setActionError(null);
                              await deleteScheduleItem(item.id);
                              refresh();
                              if (editingId === item.id) resetForm();
                            } catch (error: any) {
                              setActionError(error?.message || "Failed to delete item");
                            }
                          })();
                        }}
                        className="border-white/25 text-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mt-6">
        <div className="gp-card p-6">
          <h3 className="font-gp-sans text-[0.7rem] uppercase tracking-[0.16em] text-[var(--gp-gold-bright)] mb-3">
            Upcoming This Year
          </h3>
          <p className="font-gp-brand text-3xl text-[var(--gp-gold-bright)]">{upcomingYear.length}</p>
        </div>
      </div>
    </div>
  );
}
