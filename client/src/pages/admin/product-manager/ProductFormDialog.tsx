import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import type { Product } from "@/types/api-models";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, ShoppingBag, Loader2, Edit, Link as LinkIcon } from "lucide-react";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProduct?: Product | null;
  onSuccess: () => void;
  mode?: "full" | "audio" | "metadata" | "cover";
}

export default function ProductFormDialog({
  open,
  onOpenChange,
  selectedProduct,
  onSuccess,
  mode = "full",
}: ProductFormDialogProps) {
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    affiliateUrl: "",
    category: "",
    price: 0,
    noPrice: false,
    currency: "aed",
    tags: [] as string[],
    isActive: true,
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<{
    audioUrl?: string;
    coverUrl?: string;
  }>({});

  React.useEffect(() => {
    if (open && selectedProduct) {
      setFormData({
        name: selectedProduct.name || "",
        description: selectedProduct.description || "",
        affiliateUrl: selectedProduct.affiliateUrl || "",
        category: selectedProduct.category || "",
        price: selectedProduct.price || 0,
        noPrice: !!selectedProduct.details?.noPrice,
        currency: selectedProduct.currency || "aed",
        tags: Array.isArray(selectedProduct.tags) ? selectedProduct.tags as string[] : [],
        isActive: selectedProduct.isActive ?? true,
      });
      setUploadedUrls({
        audioUrl: selectedProduct.audioUrl || undefined,
        coverUrl: selectedProduct.coverUrl || selectedProduct.imageUrl || undefined,
      });
    } else if (open && !selectedProduct) {
      // Reset for new product
      setFormData({
        name: "",
        description: "",
        affiliateUrl: "",
        category: "",
        price: 0,
        noPrice: false,
        currency: "aed",
        tags: [],
        isActive: true,
      });
      setAudioFile(null);
      setCoverFile(null);
      setUploadedUrls({});
    }
  }, [open, selectedProduct]);

  // Upload cover file mutation
  const uploadCoverMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = getAuthToken();
      const baseApi = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${baseApi}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const data = await response.json();
      return data.absoluteUrl || `${baseApi.replace('/api', '')}${data.url}`;
    },
  });
  
  // Upload audio file mutation
  const uploadAudioMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      const token = getAuthToken();
      const baseApi = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      console.log('Uploading audio file:', file.name, file.size, file.type);
      
      const response = await fetch(`${baseApi}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: uploadFormData,
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Upload failed:', response.status, err);
        throw new Error(err.error || `Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const publicUrl = data.absoluteUrl || `${baseApi.replace('/api', '')}${data.url}`;
      
      console.log('Audio uploaded successfully:', publicUrl);
      
      // Get duration from audio file with timeout
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio(publicUrl);
        let resolved = false;
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.warn('Duration calculation timeout, using default 30 seconds');
            resolve(30); // Default to 30 seconds if can't determine
          }
        }, 5000); // 5 second timeout
        
        audio.addEventListener('loadedmetadata', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            const dur = Math.floor(audio.duration) || 30;
            console.log('Audio duration calculated:', dur);
            resolve(dur);
          }
        });
        
        audio.addEventListener('error', (e) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.warn('Error loading audio metadata, using default 30 seconds:', e);
            resolve(30); // Fallback to 30 seconds if error
          }
        });
        
        // Try to load the audio
        audio.load();
      });
      
      return {
        url: publicUrl,
        duration: duration,
      };
    },
  });

  // Save product mutation
  const saveProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      if (selectedProduct) {
        return await api.put(`/products/${selectedProduct.id}`, productData);
      } else {
        return await api.post('/products', productData);
      }
    },
  });

  const handleFileUpload = async () => {
    if (isUploading) {
      return;
    }

    if (!formData.name || !formData.affiliateUrl) {
      toast({
        title: "Required fields missing",
        description: "Please fill in name and affiliate URL",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      let productResult;
      let audioUrl = selectedProduct?.audioUrl || "";
      let coverUrl = selectedProduct?.coverUrl || selectedProduct?.imageUrl || "";
      let duration = selectedProduct?.duration || 0;

      if (selectedProduct) {
        // For editing existing product
        if (audioFile) {
          try {
            const audioResult = await uploadAudioMutation.mutateAsync(audioFile);
            audioUrl = audioResult.url;
            duration = audioResult.duration;
            
            if (!audioUrl) {
              throw new Error('Audio upload failed: No URL returned');
            }
            
            try {
              const verifyResponse = await fetch(audioUrl, { method: 'HEAD' });
              if (!verifyResponse.ok) {
                throw new Error(`Audio file verification failed: ${verifyResponse.status} ${verifyResponse.statusText}`);
              }
              console.log('Audio file verified and accessible:', audioUrl);
            } catch (verifyError) {
              throw new Error(`Failed to verify uploaded audio file: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
            }
          } catch (uploadError) {
            throw new Error(`Audio upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
          }
        }

        if (coverFile) {
          try {
            coverUrl = await uploadCoverMutation.mutateAsync(coverFile);
            if (coverUrl) {
              try {
                const verifyResponse = await fetch(coverUrl, { method: 'HEAD' });
                if (!verifyResponse.ok) {
                  console.warn('Cover file verification failed, but continuing:', coverUrl);
                } else {
                  console.log('Cover file verified and accessible:', coverUrl);
                }
              } catch (verifyError) {
                console.warn('Failed to verify cover file, but continuing:', verifyError);
              }
            }
          } catch (uploadError) {
            console.warn('Cover upload failed, but continuing (cover is optional):', uploadError);
            coverUrl = selectedProduct?.coverUrl || selectedProduct?.imageUrl || "";
          }
        }

        const productData = {
          name: formData.name,
          description: formData.description || null,
          affiliateUrl: formData.affiliateUrl,
          audioUrl: audioUrl || null,
          coverUrl: coverUrl || null,
          imageUrl: coverUrl || null, // Also set imageUrl for backward compatibility
          category: formData.category || 'GENERAL',
          price: formData.noPrice ? null : (formData.price || 0),
          currency: formData.noPrice ? null : (formData.currency || "aed"),
          duration: duration || null,
          tags: formData.tags,
          isActive: formData.isActive,
          productType: "affiliate",
          details: { ...(selectedProduct?.details || {}), noPrice: formData.noPrice },
        };

        productResult = await saveProductMutation.mutateAsync(productData);
        setUploadedUrls({ audioUrl, coverUrl });
      } else {
        // For creating new product
        // Audio is optional, but if provided, upload and verify
        if (audioFile) {
          console.log('Starting audio upload for new product:', audioFile.name);
          try {
            const audioResult = await uploadAudioMutation.mutateAsync(audioFile);
            console.log('Audio upload result:', audioResult);
            audioUrl = audioResult.url;
            duration = audioResult.duration;
            
            if (!audioUrl) {
              throw new Error('Audio upload failed: No URL returned');
            }
            
            console.log('Verifying uploaded audio file:', audioUrl);
            try {
              const verifyResponse = await fetch(audioUrl, { method: 'HEAD' });
              if (!verifyResponse.ok) {
                throw new Error(`Audio file verification failed: ${verifyResponse.status} ${verifyResponse.statusText}`);
              }
              console.log('Audio file verified and accessible:', audioUrl);
            } catch (verifyError) {
              console.error('Audio verification error:', verifyError);
              throw new Error(`Failed to verify uploaded audio file: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
            }
          } catch (uploadError) {
            console.error('Audio upload error details:', uploadError);
            const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
            throw new Error(`Audio upload failed: ${errorMessage}`);
          }
        } else {
          console.log('No audio file provided for new product (audio is optional)');
        }

        if (coverFile) {
          try {
            coverUrl = await uploadCoverMutation.mutateAsync(coverFile);
            if (coverUrl) {
              try {
                const verifyResponse = await fetch(coverUrl, { method: 'HEAD' });
                if (!verifyResponse.ok) {
                  console.warn('Cover file verification failed, but continuing:', coverUrl);
                } else {
                  console.log('Cover file verified and accessible:', coverUrl);
                }
              } catch (verifyError) {
                console.warn('Failed to verify cover file, but continuing:', verifyError);
              }
            }
          } catch (uploadError) {
            console.warn('Cover upload failed, but continuing (cover is optional):', uploadError);
            coverUrl = "";
          }
        }

        const productData = {
          name: formData.name,
          description: formData.description || null,
          affiliateUrl: formData.affiliateUrl,
          audioUrl: audioUrl || null,
          coverUrl: coverUrl || null,
          imageUrl: coverUrl || null, // Also set imageUrl for backward compatibility
          category: formData.category || 'GENERAL',
          price: formData.noPrice ? null : (formData.price || 0),
          currency: formData.noPrice ? null : (formData.currency || "aed"),
          duration: duration || null,
          tags: formData.tags,
          isActive: formData.isActive,
          productType: "affiliate",
          details: { ...(selectedProduct?.details || {}), noPrice: formData.noPrice },
        };

        productResult = await saveProductMutation.mutateAsync(productData);
        setUploadedUrls({ audioUrl, coverUrl });
      }

      console.log('Product operation completed:', productResult);

      toast({
        title: selectedProduct ? "Product updated successfully" : "Product created successfully",
        description: "Your product has been saved to the library.",
      });

      onSuccess();
      onOpenChange(false);

    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload product",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      return; // New products are created via handleFileUpload
    }

    if (!formData.name || !formData.affiliateUrl) {
      toast({
        title: "Required fields missing",
        description: "Please fill in name and affiliate URL",
        variant: "destructive",
      });
      return;
    }

    try {
      let finalUrls = {
        audioUrl: selectedProduct.audioUrl,
        coverUrl: selectedProduct.coverUrl || selectedProduct.imageUrl,
      };

      let newDuration = selectedProduct.duration;

      if (audioFile) {
        const audioResult = await uploadAudioMutation.mutateAsync(audioFile);
        finalUrls.audioUrl = audioResult.url;
        newDuration = audioResult.duration;
      }

      if (coverFile) {
        finalUrls.coverUrl = await uploadCoverMutation.mutateAsync(coverFile);
      }

      const productData = {
        name: formData.name,
        description: formData.description || null,
        affiliateUrl: formData.affiliateUrl,
        audioUrl: finalUrls.audioUrl || null,
        coverUrl: finalUrls.coverUrl || null,
        imageUrl: finalUrls.coverUrl || null,
        category: formData.category || 'GENERAL',
        price: formData.noPrice ? null : (formData.price || 0),
        currency: formData.noPrice ? null : (formData.currency || "aed"),
        duration: newDuration || null,
        tags: formData.tags,
        isActive: formData.isActive,
        productType: "affiliate",
        details: { ...(selectedProduct?.details || {}), noPrice: formData.noPrice },
      };

      await saveProductMutation.mutateAsync(productData);

      toast({
        title: "Product updated successfully",
        description: "Your product has been updated.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update product",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
        <DialogHeader>
          <DialogTitle className="font-gp-display text-2xl md:text-3xl font-semibold text-[color:var(--gp-white)]">
            {mode === "audio" && "Update Audio File"}
            {mode === "metadata" && "Update Metadata"}
            {mode === "cover" && "Update Cover"}
            {mode === "full" && (selectedProduct ? "Edit Product" : "Add New Product")}
          </DialogTitle>
          <DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/90 text-base leading-relaxed">
            {mode === "audio" && `Update the audio file for "${selectedProduct?.name}".`}
            {mode === "metadata" && `Update metadata for "${selectedProduct?.name}".`}
            {mode === "cover" && `Update the cover image for "${selectedProduct?.name}".`}
            {mode === "full" && (selectedProduct
              ? "Update the product information in your library."
              : "Add a new product to your library with link, cover, and audio support.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload Section - Show for full, audio, or cover modes */}
          {(mode === "full" || mode === "audio" || mode === "cover") && (
            <Card className="gp-card">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Link (Affiliate URL) - Show for full or metadata mode */}
                  {(mode === "full" || mode === "metadata") && (
                    <div>
                      <Label htmlFor="affiliate-url" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Link (Affiliate URL) *</Label>
                      <div className="mt-2">
                        <Input
                          id="affiliate-url"
                          type="url"
                          value={formData.affiliateUrl}
                          onChange={(e) => setFormData({ ...formData, affiliateUrl: e.target.value })}
                          placeholder="https://example.com/product"
                          required
                          className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                        />
                      </div>
                    </div>
                  )}

                  {/* Audio File - Show for full or audio mode */}
                  {(mode === "full" || mode === "audio") && (
                    <div>
                      <Label htmlFor="audio-file" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Audio File {selectedProduct ? "(Optional - leave empty to keep current)" : "(Optional)"}</Label>
                      <div className="mt-2">
                        <Input
                          id="audio-file"
                          type="file"
                          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.mpeg,.mpg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              console.log('Audio file selected:', file.name, file.type, file.size);
                              setAudioFile(file);
                            } else {
                              setAudioFile(null);
                            }
                          }}
                          className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-sans file:bg-[rgba(201,168,76,0.2)] file:text-[var(--gp-gold-bright)] hover:file:bg-[rgba(201,168,76,0.32)]"
                        />
                        {audioFile && (
                          <p className="text-sm text-[var(--gp-gold-bright)] mt-1 font-sans">
                            ✓ Selected: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                        )}
                        {selectedProduct && selectedProduct.audioUrl && !audioFile && (
                          <p className="text-sm text-[color:var(--gp-white)]/70 mt-1 font-sans">Current: {selectedProduct.audioUrl.split('/').pop()}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cover Art - Show for full or cover mode */}
                  {(mode === "full" || mode === "cover") && (
                    <div>
                      <Label htmlFor="cover-file" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Cover Art {mode === "cover" ? "" : "(Optional)"}</Label>
                      <div className="mt-2">
                        <Input
                          id="cover-file"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                          className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-sans file:bg-[rgba(201,168,76,0.2)] file:text-[var(--gp-gold-bright)] hover:file:bg-[rgba(201,168,76,0.32)]"
                        />
                        {(selectedProduct?.coverUrl || selectedProduct?.imageUrl) && (
                          <p className="text-sm text-[color:var(--gp-white)]/70 mt-1 font-sans">Current: {(selectedProduct?.coverUrl || selectedProduct?.imageUrl || '').split('/').pop()}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  {mode === "full" && selectedProduct ? (
                    <Button
                      type="submit"
                      disabled={saveProductMutation.isPending}
                      className="w-full bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
                    >
                      {saveProductMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating Product...
                        </>
                      ) : (
                        <>
                          <Edit className="mr-2 h-4 w-4" />
                          Update Product
                        </>
                      )}
                    </Button>
                  ) : mode === "full" && !selectedProduct ? (
                    <Button
                      type="button"
                      onClick={handleFileUpload}
                      disabled={isUploading || !formData.name || !formData.affiliateUrl}
                      className="w-full bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Product...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Create Product
                        </>
                      )}
                    </Button>
                  ) : (
                    // Individual update modes
                    <Button
                      type="button"
                      onClick={handleFileUpload}
                      disabled={
                        (mode === "audio" && !audioFile) ||
                        (mode === "cover" && !coverFile) ||
                        isUploading
                      }
                      className="w-full bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Update {mode === "audio" ? "Audio" : mode === "cover" ? "Cover" : "Product"}
                        </>
                      )}
                    </Button>
                  )}

                  {uploadedUrls.audioUrl && (mode === "full" || mode === "audio") && (
                    <div className="flex items-center gap-2 text-[var(--gp-gold-bright)] text-sm font-sans">
                      <ShoppingBag className="h-4 w-4" />
                      Audio file uploaded successfully
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product Information - Show for full or metadata mode */}
          {(mode === "full" || mode === "metadata") && (
            <Card className="gp-card">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="name" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Product name"
                      required
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="description" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Product description"
                      rows={3}
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g., FASHION, BOOKS, ELECTRONICS, or any custom category"
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    />
                    <p className="text-xs text-[color:var(--gp-white)]/70 mt-1 font-sans">
                      You can use existing categories (FASHION, BOOKS, BEAUTY, etc.) or create your own custom category
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="price" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Price</Label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, noPrice: !formData.noPrice })}
                        className={`inline-flex items-center px-2.5 py-1 rounded-2xl text-[10px] uppercase tracking-[0.1em] border transition-colors ${
                          formData.noPrice
                            ? "border-white/40 bg-white/20 text-white"
                            : "border-white/25 bg-white/5 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        No price
                      </button>
                    </div>
                    <Input
                      id="price"
                      type="number"
                      value={formData.noPrice ? "" : formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      placeholder={formData.noPrice ? "No price" : "0"}
                      min="0"
                      step="0.01"
                      disabled={formData.noPrice}
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="currency" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                      disabled={formData.noPrice}
                    >
                      <SelectTrigger className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-sans text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aed">AED</SelectItem>
                        <SelectItem value="usd">USD</SelectItem>
                        <SelectItem value="eur">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="tags" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags.join(', ')}
                      onChange={(e) => {
                        const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                        setFormData({ ...formData, tags });
                      }}
                      placeholder="tag1, tag2, tag3"
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-[var(--gp-border-gold)] bg-[rgba(6,13,26,0.55)]"
                    />
                    <Label htmlFor="isActive" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Active</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

