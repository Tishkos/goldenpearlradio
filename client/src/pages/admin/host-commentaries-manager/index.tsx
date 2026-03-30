import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Mic, Volume2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { HostCommentary } from '@/types/api-models';
import HostCommentaryForm from './HostCommentaryForm';
import HostCommentaryList from './HostCommentaryList';

// Use Prisma HostCommentary type for form data, omitting server-generated fields
type HostCommentaryFormData = Omit<HostCommentary, 'id' | 'createdAt' | 'audioUrl' | 'duration'>;

export default function HostCommentariesManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCommentary, setEditingCommentary] = useState<HostCommentary | null>(null);
  const [selectedHostId, setSelectedHostId] = useState<string>("");
  const [generatingAudio, setGeneratingAudio] = useState<Set<number>>(new Set()); // Track audio generation
  const queryClient = useQueryClient();

  // Fetch host commentaries with host info
  const { data: commentaries = [], isLoading } = useQuery({
    queryKey: ['host-commentaries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('host_commentary')
        .select(`
          *,
          host:hosts(name, aiVoiceId, language, aiStyle)
        `)
        .order('createdAt', { ascending: false });

      if (error) throw error;
      console.log('Fetched host commentaries data:', data);
      return data || [];
    },
  });

  // Fetch hosts for audio generation and selection
  const { data: hosts = [] } = useQuery({
    queryKey: ['hosts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hosts')
        .select('*')
        .eq('isActive', true)
        .order('name');

      if (error) throw new Error('Failed to fetch hosts');
      return data;
    },
  });

  // Create host commentary mutation with automatic audio generation
  const createMutation = useMutation({
    mutationFn: async (data: HostCommentaryFormData) => {
      const { data: result, error } = await supabase
        .from('host_commentary')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: async (createdCommentary) => {
      queryClient.invalidateQueries({ queryKey: ['host-commentaries'] });
      setIsCreateDialogOpen(false);

      // Automatically generate audio if host is assigned
      if (createdCommentary.hostId) {
        try {
          const host = hosts.find(h => h.id === createdCommentary.hostId);
          if (host) {
            toast.info('Host commentary created successfully. Generating audio automatically...');

            // Call the audio generation function
            const { data, error } = await supabase.functions.invoke('voice-generation', {
              body: {
                commentaryId: createdCommentary.id,
                hostId: createdCommentary.hostId,
                text: createdCommentary.script,
                voiceId: host.aiVoiceId,
                language: host.language,
                aiStyle: host.aiStyle,
              },
            });

            if (error) {
              console.error('Failed to generate audio automatically:', error);
              toast.error('Host commentary created but audio generation failed: ' + error.message);
            } else if (data?.success) {
              // Refresh data to show the generated audio
              queryClient.invalidateQueries({ queryKey: ['host-commentaries'] });
              const styleText = host.aiStyle ? ` (${host.aiStyle} style)` : '';
              const languageText = host.language ? ` in ${host.language}` : '';
              toast.success(`Host commentary created and audio generated automatically${languageText}${styleText}!`);
            } else {
              toast.error('Host commentary created but audio generation failed: ' + (data?.error || 'Unknown error'));
            }
          } else {
            toast.success('Host commentary created successfully (no host assigned for audio generation)');
          }
        } catch (audioError) {
          console.error('Error during automatic audio generation:', audioError);
          toast.error('Host commentary created but audio generation failed');
        }
      } else {
        toast.success('Host commentary created successfully (no host assigned for audio generation)');
      }
    },
    onError: (error) => {
      toast.error('Failed to create host commentary: ' + error.message);
    },
  });

  // Update host commentary mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: HostCommentaryFormData }) => {
      const { data: result, error } = await supabase
        .from('host_commentary')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: async (updatedCommentary) => {
      queryClient.invalidateQueries({ queryKey: ['host-commentaries'] });
      setEditingCommentary(null);

      // Check if important content changed (title or script)
      const originalCommentary = commentaries.find(c => c.id === updatedCommentary.id);
      const contentChanged = originalCommentary &&
        (originalCommentary.title !== updatedCommentary.title || originalCommentary.script !== updatedCommentary.script);

      if (contentChanged && updatedCommentary.audioUrl) {
        // Get all existing host audios for this commentary
        // Note: For host commentaries, each commentary has one audio file per host
        // We'll need to regenerate audio for all hosts that have audio for this commentary
        toast.info(`Content changed - audio may need regeneration for associated hosts`);

        // For now, we'll just notify the user that content changed
        // In a more complex implementation, we could track host audio separately
        toast.success('Host commentary updated successfully (audio may need regeneration)');
      } else {
        toast.success('Host commentary updated successfully');
      }
    },
    onError: (error) => {
      toast.error('Failed to update host commentary: ' + error.message);
    },
  });

  // Delete host commentary mutation with cleanup
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const commentary = commentaries.find(c => c.id === id);

      // Clean up audio files from storage bucket first if they exist
      if (commentary?.audioUrl) {
        try {
          const { error: storageError } = await supabase.storage
            .from('media')
            .remove([commentary.audioUrl]);

          if (storageError) {
            console.warn('Failed to delete audio file from storage:', storageError);
          } else {
            console.log('Successfully deleted audio file from storage:', commentary.audioUrl);
          }
        } catch (storageCleanupError) {
          console.warn('Error during storage cleanup:', storageCleanupError);
        }
      }

      // Delete the host commentary
      const { error } = await supabase
        .from('host_commentary')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-commentaries'] });
      toast.success('Host commentary and associated audio file deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete host commentary: ' + error.message);
    },
  });

  // Generate host commentary audio for specific host mutation
  const generateHostAudioMutation = useMutation({
    mutationFn: async ({ commentaryId, hostId }: { commentaryId: number; hostId: number }) => {
      const commentary = commentaries.find(c => c.id === commentaryId);
      const host = hosts.find(h => h.id === hostId);

      if (!commentary) {
        throw new Error('Host commentary not found');
      }

      if (!host) {
        throw new Error('Host not found');
      }

      // Check if audio already exists
      if (commentary.audioUrl) {
        throw new Error('Host commentary audio already exists');
      }

      // Use the script content directly for audio generation
      const textToGenerate = commentary.script;

      // Call Supabase Edge Function for voice generation
      const { data, error } = await supabase.functions.invoke('voice-generation', {
        body: {
          commentaryId,
          hostId,
          text: textToGenerate,
          voiceId: host.aiVoiceId,
          language: host.language,
          aiStyle: host.aiStyle,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return { ...data, commentary, host, generatedText: textToGenerate, commentaryId, hostId } as {
        success: boolean;
        audioData?: string;
        audioUrl?: string;
        mimeType?: string;
        error?: string;
        voiceId?: string;
        duration?: number;
        commentary: HostCommentary;
        host: any;
        generatedText: string;
        commentaryId: number;
        hostId: number;
      };
    },
    onMutate: ({ commentaryId }) => {
      // Set loading state when mutation starts
      setGeneratingAudio(prev => new Set(prev).add(commentaryId));
    },
    onSuccess: async (result) => {
      console.log('Audio generation result:', result);
      if (result.success && result.audioData) {
        console.log('Audio generated and saved successfully on server-side');

        // Invalidate queries to refresh the data immediately since server saved the record
        console.log('Invalidating queries...');
        queryClient.invalidateQueries({ queryKey: ['host-commentaries'] });
        await queryClient.refetchQueries({ queryKey: ['host-commentaries'] });

        // Audio record is saved on server, user can now play it manually
        const styleText = result.host?.aiStyle ? ` (${result.host.aiStyle} style)` : '';
        const languageText = result.host?.language ? ` in ${result.host.language}` : '';
        toast.success(`Host commentary audio generated and saved${languageText}${styleText}!\nGenerated text: "${result.generatedText.substring(0, 100)}${result.generatedText.length > 100 ? '...' : ''}"`);
      } else {
        console.log('Audio generation failed:', result);
        toast.error('Failed to generate host commentary voice: ' + (result.error || 'Unknown error'));
      }
    },
    onError: (error) => {
      toast.error('Failed to generate host commentary voice: ' + error.message);
    },
    onSettled: (result) => {
      // Clear loading state when mutation completes (success or error)
      if (result && result.commentaryId) {
        setGeneratingAudio(prev => {
          const newSet = new Set(prev);
          newSet.delete(result.commentaryId);
          return newSet;
        });
      }
    },
  });

  const handleCreate = (data: HostCommentaryFormData) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: HostCommentaryFormData) => {
    if (editingCommentary) {
      updateMutation.mutate({ id: editingCommentary.id, data });
    }
  };

  const handleDelete = (commentary: HostCommentary) => {
    deleteMutation.mutate(commentary.id);
  };

  const handleGenerateHostAudio = (commentaryId: number, hostId: number) => {
    generateHostAudioMutation.mutate({ commentaryId, hostId });
  };

  // Delete host commentary audio mutation
  const deleteHostAudioMutation = useMutation({
    mutationFn: async (commentaryId: number) => {
      // Get the commentary to find the audio file
      const commentary = commentaries.find(c => c.id === commentaryId);

      if (!commentary || !commentary.audioUrl) {
        throw new Error('Commentary or audio not found');
      }

      // Clean up audio file from storage bucket
      if (commentary.audioUrl && commentary.audioUrl.includes('host_commentary_')) {
        try {
          const { error: storageError } = await supabase.storage
            .from('media')
            .remove([commentary.audioUrl]);

          if (storageError) {
            console.warn('Failed to delete audio file from storage:', storageError);
          } else {
            console.log('Successfully deleted audio file from storage:', commentary.audioUrl);
          }
        } catch (storageCleanupError) {
          console.warn('Error during storage cleanup:', storageCleanupError);
        }
      }

      // Update the commentary to remove audio URL and duration
      const { error } = await supabase
        .from('host_commentary')
        .update({
          audioUrl: null,
          duration: null,
        })
        .eq('id', commentaryId);

      if (error) throw error;

      return commentaryId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['host-commentaries'] });
      toast.success('Host commentary audio deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete host commentary audio: ' + error.message);
    },
  });

  const handleDeleteHostAudio = (commentaryId: number) => {
    deleteHostAudioMutation.mutate(commentaryId);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading host commentaries...</div>;
  }

  return (
    <div className="space-y-6 m-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Host Commentaries Manager</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Host Commentary
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Host Commentary</DialogTitle>
            </DialogHeader>
            <HostCommentaryForm
              onSubmit={handleCreate}
              onCancel={() => setIsCreateDialogOpen(false)}
              hosts={hosts}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search host commentaries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      <HostCommentaryList
        commentaries={commentaries}
        hosts={hosts}
        searchTerm={searchTerm}
        onEdit={setEditingCommentary}
        onDelete={handleDelete}
        onGenerateHostAudio={handleGenerateHostAudio}
        onDeleteHostAudio={handleDeleteHostAudio}
        generatingAudio={generatingAudio}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingCommentary} onOpenChange={() => setEditingCommentary(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Host Commentary</DialogTitle>
          </DialogHeader>
          {editingCommentary && (
            <HostCommentaryForm
              commentary={editingCommentary}
              onSubmit={handleUpdate}
              onCancel={() => setEditingCommentary(null)}
              hosts={hosts}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}