import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/api-client";
import { api } from "@/lib/api-client";
import type { Talk } from "@/types/api-models";
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
import { Upload, Mic, Loader2, Edit, Globe } from "lucide-react";

interface TalkFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTalk: Talk | null;
  onSuccess: () => void;
  mode?: "full" | "audio" | "metadata" | "cover";
}

export default function TalkFormDialog({
  open,
  onOpenChange,
  selectedTalk,
  onSuccess,
  mode = "full",
}: TalkFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    speaker: "",
    summary: "",
    talkType: "",
    language: "en",
    isActive: true,
    tags: [] as string[],
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<{
    audioUrl?: string;
    coverUrl?: string;
  }>({});

  React.useEffect(() => {
    if (open && selectedTalk) {
      setFormData({
        title: selectedTalk.title || "",
        speaker: selectedTalk.speaker || "",
        summary: selectedTalk.summary || "",
        talkType: selectedTalk.talkType || "",
        language: selectedTalk.language || "en",
        isActive: selectedTalk.isActive,
        tags: Array.isArray(selectedTalk.tags) ? selectedTalk.tags as string[] : [],
      });
      setUploadedUrls({
        audioUrl: selectedTalk.audioUrl || undefined,
        coverUrl: selectedTalk.coverUrl || undefined,
      });
    } else if (open && !selectedTalk) {
      // Reset for new talk
      setFormData({
        title: "",
        speaker: "",
        summary: "",
        talkType: "",
        language: "en",
        isActive: true,
        tags: [],
      });
      setAudioFile(null);
      setCoverFile(null);
      setUploadedUrls({});
    }
  }, [open, selectedTalk]);

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
  const uploadAudioMutation = useMutation({
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
      const uploaded = await response.json();
      const publicUrl = uploaded.absoluteUrl || `${baseApi.replace('/api', '')}${uploaded.url}`;

      // Calculate duration using HTML5 Audio API
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio(publicUrl);
        audio.addEventListener('loadedmetadata', () => {
          resolve(Math.floor(audio.duration));
        });
        audio.addEventListener('error', () => {
          resolve(0); // Fallback to 0 if duration can't be determined
        });
      });

      return { url: publicUrl, duration };
    },
  });

  // Create/Update talk mutation
  const saveTalkMutation = useMutation({
    mutationFn: async (talkData: any) => {
      if (selectedTalk) {
        return api.put(`/talks/${selectedTalk.id}`, talkData);
      } else {
        return api.post("/talks", talkData);
      }
    },
    onSuccess: (data) => {
      toast({
        title: selectedTalk ? "Talk updated" : "Talk created",
        description: `Talk "${formData.title}" has been ${selectedTalk ? 'updated' : 'created'} successfully.`,
      });
      // Update react-query cache for talks so only changed item updates in UI
      try {
        const existing = queryClient.getQueryData<any[]>(['talks']) || [];
        if (selectedTalk) {
          // replace existing talk using returned data
          const updated = existing.map((t) => (t.id === selectedTalk.id ? data : t));
          queryClient.setQueryData(['talks'], updated);
        } else {
          // add new talk to front using returned data
          const created = queryClient.getQueryData<any[]>(['talks']) || [];
          queryClient.setQueryData(['talks'], [data, ...created]);
        }
      } catch (e) {
        // fallback to invalidation
        queryClient.invalidateQueries({ queryKey: ['talks'] });
      }

      handleClose();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save talk",
        description: error.message || "An error occurred while saving the talk",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setFormData({
      title: "",
      speaker: "",
      summary: "",
      talkType: "",
      language: "en",
      isActive: true,
      tags: [],
    });
    setAudioFile(null);
    setCoverFile(null);
    setUploadedUrls({});
    setIsUploading(false);
    onOpenChange(false);
  };

  const handleFileUpload = async () => {
    // Prevent multiple simultaneous uploads
    if (isUploading) {
      console.warn('Upload already in progress, ignoring duplicate request');
      return;
    }

    // Only require an audio file when updating audio specifically or when creating a new talk
    if ((mode === 'audio' && !audioFile) || (mode === 'full' && !selectedTalk && !audioFile)) {
      toast({
        title: "Audio file required",
        description: "Please select an audio file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      let talkResult;
      let audioUrl = selectedTalk?.audioUrl || "";
      let coverUrl = selectedTalk?.coverUrl || "";
      let duration = selectedTalk?.duration || 0;

      if (selectedTalk) {
        // For editing existing talk
        // Upload files first if provided and verify they're successful
        if (audioFile) {
          try {
            const audioResult = await uploadAudioMutation.mutateAsync(audioFile);
            audioUrl = audioResult.url;
            duration = audioResult.duration;
            
            // Verify the uploaded file is accessible
            if (!audioUrl) {
              throw new Error('Audio upload failed: No URL returned');
            }
            
            // Verify file is accessible
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
            
            // Verify the uploaded cover is accessible
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
            // Keep existing cover if upload fails
            coverUrl = selectedTalk?.coverUrl || "";
          }
        }

        // Prepare deletion of old files if new ones were uploaded
        const filesToDelete: string[] = [];

        if (audioFile && selectedTalk.audioUrl && selectedTalk.audioUrl !== audioUrl) {
          if (selectedTalk.audioUrl.includes("/storage/v1/object/public/media/talks/")) {
            const urlParts = selectedTalk.audioUrl.split("/talks/");
            if (urlParts[1]) filesToDelete.push(`talks/${urlParts[1].split('?')[0]}`);
          }
        }

        if (coverFile && selectedTalk.coverUrl && selectedTalk.coverUrl !== coverUrl) {
          if (selectedTalk.coverUrl.includes("/storage/v1/object/public/media/talks/")) {
            const urlParts = selectedTalk.coverUrl.split("/talks/");
            if (urlParts[1]) filesToDelete.push(`talks/${urlParts[1].split('?')[0]}`);
          }
        }

        // Then update the talk metadata
        const talkData = {
          title: formData.title,
          speaker: formData.speaker || null,
          summary: formData.summary || null,
          duration: duration,
          audioUrl: audioUrl,
          coverUrl: coverUrl || selectedTalk.coverUrl,
          talkType: formData.talkType || null,
          language: formData.language || "en",
          tags: formData.tags,
          isActive: formData.isActive,
        };

        talkResult = await saveTalkMutation.mutateAsync(talkData);

        // File cleanup handled by backend (if implemented). We don't delete files client-side anymore.

        // update uploaded urls state for UI feedback
        setUploadedUrls({ audioUrl, coverUrl });
      } else {
        // For creating new talk
        // Upload files first and verify they're successful before saving
        if (audioFile) {
          try {
            const audioResult = await uploadAudioMutation.mutateAsync(audioFile);
            audioUrl = audioResult.url;
            duration = audioResult.duration;
            
            // Verify the uploaded file is accessible
            if (!audioUrl) {
              throw new Error('Audio upload failed: No URL returned');
            }
            
            // Verify file is accessible by making a HEAD request
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
        } else {
          throw new Error('Audio file is required for new talks');
        }

        if (coverFile) {
          try {
            coverUrl = await uploadCoverMutation.mutateAsync(coverFile);
            
            // Verify the uploaded cover is accessible
            if (coverUrl) {
              try {
                const verifyResponse = await fetch(coverUrl, { method: 'HEAD' });
                if (!verifyResponse.ok) {
                  console.warn('Cover file verification failed, but continuing:', coverUrl);
                  // Cover is optional, so we continue even if verification fails
                } else {
                  console.log('Cover file verified and accessible:', coverUrl);
                }
              } catch (verifyError) {
                console.warn('Failed to verify cover file, but continuing:', verifyError);
                // Cover is optional, so we continue
              }
            }
          } catch (uploadError) {
            console.warn('Cover upload failed, but continuing (cover is optional):', uploadError);
            // Cover is optional, so we continue without it
            coverUrl = "";
          }
        }

        // Only create the talk after successful uploads
        if (!audioUrl) {
          throw new Error('Cannot create talk: Audio file upload failed');
        }

        const talkData = {
          title: formData.title,
          speaker: formData.speaker || null,
          summary: formData.summary || null,
          duration: duration,
          audioUrl: audioUrl,
          coverUrl: coverUrl,
          talkType: formData.talkType || null,
          language: formData.language || "en",
          tags: formData.tags,
          isActive: formData.isActive,
        };

        talkResult = await saveTalkMutation.mutateAsync(talkData);

        // update uploaded urls state for UI feedback
        setUploadedUrls({ audioUrl, coverUrl });
      }

      console.log('Talk operation completed:', talkResult);

      // Success - close dialog and refresh
      toast({
        title: selectedTalk ? "Talk updated successfully" : "Talk created successfully",
        description: "Your talk has been saved to the library.",
      });

      onSuccess();
      onOpenChange(false);

    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload talk",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTalk) {
      return; // New talks are created via handleFileUpload
    }

    if (!formData.title) {
      toast({
        title: "Required fields missing",
        description: "Please fill in title",
        variant: "destructive",
      });
      return;
    }

    try {
      let finalUrls = {
        audioUrl: selectedTalk.audioUrl,
        coverUrl: selectedTalk.coverUrl,
      };

      let newDuration = selectedTalk.duration;

      // Upload new files if provided
      if (audioFile) {
        const audioResult = await uploadAudioMutation.mutateAsync(audioFile);
        finalUrls.audioUrl = audioResult.url;
        newDuration = audioResult.duration;
      }

      if (coverFile) {
        finalUrls.coverUrl = await uploadCoverMutation.mutateAsync(coverFile);
      }

      // Delete old files if new ones were uploaded
      const filesToDelete: string[] = [];

      if (audioFile && selectedTalk.audioUrl !== finalUrls.audioUrl) {
        // New audio file uploaded, delete old one
        if (selectedTalk.audioUrl && selectedTalk.audioUrl.includes("/storage/v1/object/public/media/talks/")) {
          const urlParts = selectedTalk.audioUrl.split("/talks/");
          if (urlParts[1]) {
            filesToDelete.push(`talks/${urlParts[1].split('?')[0]}`);
          }
        }
      }

      if (coverFile && selectedTalk.coverUrl !== finalUrls.coverUrl) {
        // New cover uploaded, delete old one
        if (selectedTalk.coverUrl && selectedTalk.coverUrl.includes("/storage/v1/object/public/media/talks/")) {
          const urlParts = selectedTalk.coverUrl.split("/talks/");
          if (urlParts[1]) {
            filesToDelete.push(`talks/${urlParts[1].split('?')[0]}`);
          }
        }
      }

      // File cleanup handled by backend (if implemented). We don't delete files client-side anymore.

      const talkData = {
        title: formData.title,
        speaker: formData.speaker || null,
        summary: formData.summary || null,
        duration: newDuration,
        audioUrl: finalUrls.audioUrl,
        coverUrl: finalUrls.coverUrl,
        talkType: formData.talkType || null,
        language: formData.language || "en",
        tags: formData.tags,
        isActive: formData.isActive,
      };

      console.log('Updating talk with data:', talkData);

      await saveTalkMutation.mutateAsync(talkData);

      toast({
        title: "Talk updated successfully",
        description: "Your talk has been updated.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update talk",
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
            {mode === "full" && (selectedTalk ? "Edit Talk" : "Add New Talk")}
          </DialogTitle>
          <DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/90 text-base leading-relaxed">
            {mode === "audio" && `Update the audio file for "${selectedTalk?.title}".`}
            {mode === "metadata" && `Update metadata for "${selectedTalk?.title}".`}
            {mode === "full" && (selectedTalk
              ? "Update the talk information in your library."
              : "Add a new talk to your library with file upload support.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload Section - Show for full, audio, or cover modes */}
          {(mode === "full" || mode === "audio" || mode === "cover") && (
            <Card className="gp-card">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Audio File - Show for full or audio mode */}
                  {(mode === "full" || mode === "audio") && (
                    <div>
                      <Label htmlFor="audio-file" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Audio File {selectedTalk ? "(Optional - leave empty to keep current)" : "*"}</Label>
                      <div className="mt-2">
                        <Input
                          id="audio-file"
                          type="file"
                          accept="audio/*"
                          onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                          className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-gp-sans file:bg-[rgba(201,168,76,0.2)] file:text-[var(--gp-gold-bright)] hover:file:bg-[rgba(201,168,76,0.32)]"
                        />
                        {selectedTalk && (
                          <p className="text-sm text-[color:var(--gp-white)]/70 mt-1 font-gp-sans">Current: {selectedTalk.audioUrl?.split('/').pop()}</p>
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
                          className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-gp-sans file:bg-[rgba(201,168,76,0.2)] file:text-[var(--gp-gold-bright)] hover:file:bg-[rgba(201,168,76,0.32)]"
                        />
                        {selectedTalk?.coverUrl && (
                          <p className="text-sm text-[color:var(--gp-white)]/70 mt-1 font-gp-sans">Current: {selectedTalk.coverUrl.split('/').pop()}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  {mode === "full" && selectedTalk ? (
                    <Button
                      type="submit"
                      disabled={saveTalkMutation.isPending}
                      className="w-full bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-gp-sans"
                    >
                      {saveTalkMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating Talk...
                        </>
                      ) : (
                        <>
                          <Edit className="mr-2 h-4 w-4" />
                          Update Talk
                        </>
                      )}
                    </Button>
                  ) : mode === "full" && !selectedTalk ? (
                    <Button
                      type="button"
                      onClick={handleFileUpload}
                      disabled={(!audioFile && !coverFile) || isUploading || !formData.title}
                      className="w-full bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-gp-sans"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Talk...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Create Talk
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
                      className="w-full bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-gp-sans"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Update {mode === "audio" ? "Audio" : mode === "cover" ? "Cover" : "Talk"}
                        </>
                      )}
                    </Button>
                  )}

                  {uploadedUrls.audioUrl && (mode === "full" || mode === "audio") && (
                    <div className="flex items-center gap-2 text-[var(--gp-gold-bright)] text-sm font-gp-sans">
                      <Mic className="h-4 w-4" />
                      Audio file uploaded successfully
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Talk Information - Show for full or metadata mode */}
          {(mode === "full" || mode === "metadata") && (
            <Card className="gp-card">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="title" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Talk title"
                      required
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-gp-sans text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="speaker" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Speaker</Label>
                    <Input
                      id="speaker"
                      value={formData.speaker}
                      onChange={(e) => setFormData({ ...formData, speaker: e.target.value })}
                      placeholder="Speaker name"
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-gp-sans text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="talkType" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Talk Type</Label>
                    <Select value={formData.talkType} onValueChange={(value) => setFormData({ ...formData, talkType: value })}>
                      <SelectTrigger className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-gp-sans text-base">
                        <SelectValue placeholder="Select talk type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lecture">Lecture</SelectItem>
                        <SelectItem value="interview">Interview</SelectItem>
                        <SelectItem value="discussion">Discussion</SelectItem>
                        <SelectItem value="speech">Speech</SelectItem>
                        <SelectItem value="workshop">Workshop</SelectItem>
                        <SelectItem value="panel">Panel</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="language" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Language</Label>
                    <Select value={formData.language} onValueChange={(value) => setFormData({ ...formData, language: value })}>
                      <SelectTrigger className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-gp-sans text-base">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="it">Italian</SelectItem>
                        <SelectItem value="pt">Portuguese</SelectItem>
                        <SelectItem value="ar">Arabic</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                        <SelectItem value="ko">Korean</SelectItem>
                        <SelectItem value="ru">Russian</SelectItem>
                        <SelectItem value="hi">Hindi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="isActive" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Status</Label>
                    <Select value={formData.isActive.toString()} onValueChange={(value) => setFormData({ ...formData, isActive: value === "true" })}>
                      <SelectTrigger className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] font-gp-sans text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="summary" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Summary</Label>
                    <Textarea
                      id="summary"
                      value={formData.summary}
                      onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                      placeholder="Brief summary of the talk..."
                      rows={3}
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-gp-sans text-base"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="tags" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags.join(', ')}
                      onChange={(e) => setFormData({
                        ...formData,
                        tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                      })}
                      placeholder="education, technology, motivation..."
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-gp-sans text-base"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose} className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5">
              Cancel
            </Button>
            {mode === "metadata" && (
              <Button
                type="submit"
                disabled={saveTalkMutation.isPending}
                className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-gp-sans"
              >
                {saveTalkMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Metadata"
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
