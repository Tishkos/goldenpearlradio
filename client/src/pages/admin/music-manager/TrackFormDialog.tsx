import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api, getAuthToken } from "@/lib/api-client";
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
import { Upload, Music, Image, Loader2, Edit } from "lucide-react";

interface TrackFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTrack: any | null;
  onSuccess: () => void;
  mode?: "full" | "cover" | "audio" | "metadata";
}

export default function TrackFormDialog({
  open,
  onOpenChange,
  selectedTrack,
  onSuccess,
  mode = "full",
}: TrackFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';
  const apiOrigin = apiBaseUrl.replace(/\/api$/, '');
  const normalizeLocalUrl = (url?: string | null) => {
    if (!url) return url ?? "";
    return url.replace(/^http:\/\/localhost:3001/i, apiOrigin);
  };
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    genre: "",
    mood: "",
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<{
    audioUrl?: string;
    coverUrl?: string;
  }>({});
  React.useEffect(() => {
    if (open && selectedTrack) {
      setFormData({
        title: selectedTrack.title || "",
        artist: selectedTrack.artist || "",
        genre: selectedTrack.genre || "",
        mood: selectedTrack.mood || "",
      });
      setUploadedUrls({
        audioUrl: selectedTrack.url,
        coverUrl: selectedTrack.coverArt,
      });
    } else if (open && !selectedTrack) {
      // Reset for new track
      setFormData({
        title: "",
        artist: "",
        genre: "",
        mood: "",
      });
      setAudioFile(null);
      setCoverFile(null);
      setUploadedUrls({});
    }
  }, [open, selectedTrack]);

  // Upload audio file mutation
  const uploadAudioMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      const response = await fetch(`${apiBaseUrl}/upload`, {
        method: 'POST',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : undefined,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      // Use absolute URL - this is critical for audio playback
      const publicUrl = normalizeLocalUrl(data.absoluteUrl || `${apiOrigin}${data.url}`);
      
      console.log('Audio uploaded:', {
        originalName: data.originalName,
        url: publicUrl,
        mimetype: data.mimetype
      });

      // Calculate duration using HTML5 Audio API with timeout
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio(publicUrl);
        let resolved = false;
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.warn('Duration calculation timeout for:', publicUrl);
            // Try to get duration from file size estimate (rough approximation)
            // Average bitrate: 128kbps = 16KB per second
            const estimatedDuration = Math.floor((data.size / 1024) / 16);
            resolve(estimatedDuration > 0 ? estimatedDuration : 0);
          }
        }, 15000); // 15 second timeout

        audio.addEventListener('loadedmetadata', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            const dur = Math.floor(audio.duration);
            console.log('Duration calculated:', dur, 'seconds for', publicUrl);
            resolve(dur);
          }
        });
        
        audio.addEventListener('error', (e) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.warn('Error loading audio metadata:', e, 'URL:', publicUrl);
            // Fallback: estimate from file size
            const estimatedDuration = Math.floor((data.size / 1024) / 16);
            resolve(estimatedDuration > 0 ? estimatedDuration : 0);
          }
        });

        // Try to load the audio
        audio.load();
      });

      return { url: publicUrl, duration };
    },
  });

  // Upload cover file mutation
  const uploadCoverMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      const response = await fetch(`${apiBaseUrl}/upload`, {
        method: 'POST',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : undefined,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      // Use absolute URL if provided, otherwise construct from relative URL
      return normalizeLocalUrl(data.absoluteUrl || `${apiOrigin}${data.url}`);
    },
  });

  // Create/Update track mutation
  const saveTrackMutation = useMutation({
    mutationFn: async (trackData: any) => {
      if (selectedTrack) {
        // Update existing track
        return api.put(`/tracks/${selectedTrack.id}`, {
          ...trackData,
          url: normalizeLocalUrl(trackData.url),
          coverArt: normalizeLocalUrl(trackData.coverArt),
        });
      } else {
        // Create new track
        return api.post('/tracks', {
          ...trackData,
          url: normalizeLocalUrl(trackData.url),
          coverArt: normalizeLocalUrl(trackData.coverArt),
        });
      }
    },
    onSuccess: (data) => {
      toast({
        title: selectedTrack ? "Track updated" : "Track created",
        description: `Track "${formData.title}" has been ${selectedTrack ? 'updated' : 'created'} successfully.`,
      });
      // Update react-query cache for tracks so only changed item updates in UI
      try {
        const existing = queryClient.getQueryData<any[]>(['tracks']) || [];
        if (selectedTrack) {
          // replace existing track using returned data
          const updated = existing.map((t) => (t.id === selectedTrack.id ? data : t));
          queryClient.setQueryData(['tracks'], updated);
        } else {
          // add new track to front using returned data
          const created = queryClient.getQueryData<any[]>(['tracks']) || [];
          queryClient.setQueryData(['tracks'], [data, ...created]);
        }
      } catch (e) {
        // fallback to invalidation
        queryClient.invalidateQueries({ queryKey: ['tracks'] });
      }

      handleClose();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save track",
        description: error.message || "An error occurred while saving the track",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setFormData({
      title: "",
      artist: "",
      genre: "",
      mood: "",
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

    // Only require an audio file when updating audio specifically or when creating a new track
    if ((mode === 'audio' && !audioFile) || (mode === 'full' && !selectedTrack && !audioFile)) {
      toast({
        title: "Audio file required",
        description: "Please select an audio file to upload",
        variant: "destructive",
      });
      return;
    }

    // Check if we have minimum required fields for track creation
    if (!formData.title || !formData.artist) {
      toast({
        title: "Required fields missing",
        description: "Please fill in title and artist before uploading",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      let trackResult;
      let audioUrl = selectedTrack?.url || "";
      let coverUrl = selectedTrack?.coverArt || null;
      let duration = selectedTrack?.duration || 0;

      if (selectedTrack) {
        // For editing existing track
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
            coverUrl = selectedTrack?.coverArt || null;
          }
        }

        // Prepare deletion of old files if new ones were uploaded
        const filesToDelete: string[] = [];

        if (audioFile && selectedTrack.url && selectedTrack.url !== audioUrl) {
          if (selectedTrack.url.includes("/storage/v1/object/public/media/tracks/")) {
            const urlParts = selectedTrack.url.split("/tracks/");
            if (urlParts[1]) filesToDelete.push(`tracks/${urlParts[1].split('?')[0]}`);
          }
        }

        if (coverFile && selectedTrack.coverArt && selectedTrack.coverArt !== coverUrl) {
          if (selectedTrack.coverArt.includes("/storage/v1/object/public/media/tracks/")) {
            const urlParts = selectedTrack.coverArt.split("/tracks/");
            if (urlParts[1]) filesToDelete.push(`tracks/${urlParts[1].split('?')[0]}`);
          }
        }

        // Then update the track metadata
        const trackData = {
          title: formData.title,
          artist: formData.artist,
          duration: duration,
          url: audioUrl,
          coverArt: coverUrl,
          genre: formData.genre || null,
          mood: formData.mood || null,
        };

        trackResult = await saveTrackMutation.mutateAsync(trackData);

        // File cleanup is handled by backend if needed

        // update uploaded urls state for UI feedback
        setUploadedUrls({ audioUrl, coverUrl });
      } else {
        // For creating new track
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
          throw new Error('Audio file is required for new tracks');
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
            coverUrl = null;
          }
        }

        // Only create the track after successful uploads
        if (!audioUrl) {
          throw new Error('Cannot create track: Audio file upload failed');
        }

        const trackData = {
          title: formData.title,
          artist: formData.artist,
          duration: duration,
          url: audioUrl,
          coverArt: coverUrl,
          genre: formData.genre || null,
          mood: formData.mood || null,
        };

        trackResult = await saveTrackMutation.mutateAsync(trackData);

        // update uploaded urls state for UI feedback
        setUploadedUrls({ audioUrl, coverUrl });
      }

      console.log('Track operation completed:', trackResult);

      // Success - close dialog and refresh
      toast({
        title: selectedTrack ? "Track updated successfully" : "Track created successfully",
        description: "Your track has been saved to the library.",
      });

      onSuccess();
      onOpenChange(false);

    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload track",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTrack) {
      return; // New tracks are created via handleFileUpload
    }

    if (!formData.title || !formData.artist) {
      toast({
        title: "Required fields missing",
        description: "Please fill in title and artist",
        variant: "destructive",
      });
      return;
    }

    try {
      let finalUrls = {
        audioUrl: selectedTrack.url,
        coverUrl: selectedTrack.coverArt,
      };

      let newDuration = selectedTrack.duration;

      // Upload new files if provided and verify they're successful
      if (audioFile) {
        try {
          const audioResult = await uploadAudioMutation.mutateAsync(audioFile);
          finalUrls.audioUrl = audioResult.url;
          newDuration = audioResult.duration;
          
          // Verify the uploaded file is accessible
          if (!finalUrls.audioUrl) {
            throw new Error('Audio upload failed: No URL returned');
          }
          
          // Verify file is accessible
          try {
            const verifyResponse = await fetch(finalUrls.audioUrl, { method: 'HEAD' });
            if (!verifyResponse.ok) {
              throw new Error(`Audio file verification failed: ${verifyResponse.status} ${verifyResponse.statusText}`);
            }
            console.log('Audio file verified and accessible:', finalUrls.audioUrl);
          } catch (verifyError) {
            throw new Error(`Failed to verify uploaded audio file: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
          }
        } catch (uploadError) {
          throw new Error(`Audio upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
        }
      }

      if (coverFile) {
        try {
          finalUrls.coverUrl = await uploadCoverMutation.mutateAsync(coverFile);
          
          // Verify the uploaded cover is accessible
          if (finalUrls.coverUrl) {
            try {
              const verifyResponse = await fetch(finalUrls.coverUrl, { method: 'HEAD' });
              if (!verifyResponse.ok) {
                console.warn('Cover file verification failed, but continuing:', finalUrls.coverUrl);
              } else {
                console.log('Cover file verified and accessible:', finalUrls.coverUrl);
              }
            } catch (verifyError) {
              console.warn('Failed to verify cover file, but continuing:', verifyError);
            }
          }
        } catch (uploadError) {
          console.warn('Cover upload failed, but continuing (cover is optional):', uploadError);
          // Keep existing cover if upload fails
          finalUrls.coverUrl = selectedTrack?.coverArt || null;
        }
      }

      // Delete old files if new ones were uploaded
      const filesToDelete: string[] = [];

      if (audioFile && selectedTrack.url !== finalUrls.audioUrl) {
        // New audio file uploaded, delete old one
        if (selectedTrack.url && selectedTrack.url.includes("/storage/v1/object/public/media/tracks/")) {
          const urlParts = selectedTrack.url.split("/tracks/");
          if (urlParts[1]) {
            filesToDelete.push(`tracks/${urlParts[1].split('?')[0]}`);
          }
        }
      }

      if (coverFile && selectedTrack.coverArt !== finalUrls.coverUrl) {
        // New cover uploaded, delete old one
        if (selectedTrack.coverArt && selectedTrack.coverArt.includes("/storage/v1/object/public/media/tracks/")) {
          const urlParts = selectedTrack.coverArt.split("/tracks/");
          if (urlParts[1]) {
            filesToDelete.push(`tracks/${urlParts[1].split('?')[0]}`);
          }
        }
      }

      // File cleanup is handled by backend if needed

      // Duration is handled by client during upload
      // No server-side calculation needed

      const trackData = {
        title: formData.title,
        artist: formData.artist,
        duration: newDuration,
        url: finalUrls.audioUrl,
        coverArt: finalUrls.coverUrl,
        genre: formData.genre || null,
        mood: formData.mood || null,
      };

      console.log('Updating track with data:', trackData);

      await saveTrackMutation.mutateAsync(trackData);

      toast({
        title: "Track updated successfully",
        description: "Your track has been updated.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update track",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[rgba(4,10,20,0.98)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)]">
        <DialogHeader>
          <DialogTitle className="font-gp-display text-2xl md:text-3xl font-semibold text-[color:var(--gp-white)]">
            {mode === "cover" && "Update Cover Art"}
            {mode === "audio" && "Update Audio File"}
            {mode === "metadata" && "Update Metadata"}
            {mode === "full" && (selectedTrack ? "Edit Track" : "Add New Track")}
          </DialogTitle>
          <DialogDescription className="font-gp-serif text-[color:var(--gp-white)]/90 text-base leading-relaxed">
            {mode === "cover" && `Update the cover art for "${selectedTrack?.title}" by ${selectedTrack?.artist}.`}
            {mode === "audio" && `Update the audio file for "${selectedTrack?.title}" by ${selectedTrack?.artist}.`}
            {mode === "metadata" && `Update metadata for "${selectedTrack?.title}" by ${selectedTrack?.artist}.`}
            {mode === "full" && (selectedTrack
              ? "Update the track information in your music library."
              : "Add a new track to your music library with file upload support.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload Section - Show for full, cover, or audio modes */}
          {(mode === "full" || mode === "cover" || mode === "audio") && (
            <Card className="gp-card">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Audio File - Show for full or audio mode */}
                  {(mode === "full" || mode === "audio") && (
                    <div>
                      <Label htmlFor="audio-file" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Audio File {selectedTrack ? "(Optional - leave empty to keep current)" : "*"}</Label>
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
                            }
                          }}
                          className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-sans file:bg-[rgba(201,168,76,0.2)] file:text-[var(--gp-gold-bright)] hover:file:bg-[rgba(201,168,76,0.32)]"
                        />
                        {audioFile && (
                          <p className="text-sm text-[var(--gp-gold-bright)] mt-1 font-sans">
                            Selected: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                        )}
                        {selectedTrack && (
                          <p className="text-sm text-[color:var(--gp-white)]/70 mt-1 font-sans">Current: {selectedTrack.url.split('/').pop()}</p>
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
                          accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              console.log('Cover file selected:', file.name, file.type);
                              setCoverFile(file);
                            }
                          }}
                          className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/45 text-[color:var(--gp-white)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-sans file:bg-[rgba(201,168,76,0.2)] file:text-[var(--gp-gold-bright)] hover:file:bg-[rgba(201,168,76,0.32)]"
                        />
                        {coverFile && (
                          <p className="text-sm text-[var(--gp-gold-bright)] mt-1 font-sans">
                            Selected: {coverFile.name}
                          </p>
                        )}
                        {selectedTrack?.coverArt && (
                          <p className="text-sm text-[color:var(--gp-white)]/70 mt-1 font-sans">Current: {selectedTrack.coverArt.split('/').pop()}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  {mode === "full" && selectedTrack ? (
                    <Button
                      type="submit"
                      disabled={saveTrackMutation.isPending}
                      className="w-full bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
                    >
                      {saveTrackMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating Track...
                        </>
                      ) : (
                        <>
                          <Edit className="mr-2 h-4 w-4" />
                          Update Track
                        </>
                      )}
                    </Button>
                  ) : mode === "full" && !selectedTrack ? (
                    <Button
                      type="button"
                      onClick={handleFileUpload}
                      disabled={(!audioFile && !coverFile) || isUploading || !formData.title || !formData.artist}
                      className="w-full bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Track...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Create Track
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
                          Update {mode === "audio" ? "Audio" : "Cover"}
                        </>
                      )}
                    </Button>
                  )}

                  {uploadedUrls.audioUrl && (mode === "full" || mode === "audio") && (
                    <div className="flex items-center gap-2 text-[var(--gp-gold-bright)] text-sm font-sans">
                      <Music className="h-4 w-4" />
                      Audio file uploaded successfully
                    </div>
                  )}

                  {uploadedUrls.coverUrl && (mode === "full" || mode === "cover") && (
                    <div className="flex items-center gap-2 text-[var(--gp-gold-bright)] text-sm font-sans">
                      <Image className="h-4 w-4" />
                      Cover art uploaded successfully
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Track Information - Show for full or metadata mode */}
          {(mode === "full" || mode === "metadata") && (
            <Card className="gp-card">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Track title"
                      required
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="artist" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Artist *</Label>
                    <Input
                      id="artist"
                      value={formData.artist}
                      onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                      placeholder="Artist name"
                      required
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="genre" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Genre</Label>
                    <Input
                      id="genre"
                      value={formData.genre}
                      onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                      placeholder="e.g., Pop, Rock, Jazz"
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="mood" className="font-gp-sans text-[color:var(--gp-white)] text-sm">Mood</Label>
                    <Input
                      id="mood"
                      value={formData.mood}
                      onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                      placeholder="e.g., Happy, Relaxed, Energetic"
                      className="bg-[rgba(6,13,26,0.55)] border-[var(--gp-border-gold)]/50 text-[color:var(--gp-white)] placeholder:text-[color:var(--gp-white)]/45 focus-visible:ring-[var(--gp-gold)] focus-visible:border-[var(--gp-gold)] font-sans text-base"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose} className="border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal">
              Cancel
            </Button>
            {mode === "metadata" && (
              <Button
                type="submit"
                disabled={saveTrackMutation.isPending}
                className="bg-[var(--gp-gold)] hover:bg-[var(--gp-gold-bright)] text-[var(--gp-navy-deep)] font-sans text-sm font-semibold tracking-normal"
              >
                {saveTrackMutation.isPending ? (
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

