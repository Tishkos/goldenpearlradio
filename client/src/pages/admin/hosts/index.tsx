import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Mic, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import type { Host } from '@/types/api-models';
import HostForm from './HostForm';
import HostList from './HostList';

// Helper function to create WAV file from PCM data (24kHz, 16-bit, mono)
const createWavBlob = (pcmData: string) => {
  // Decode base64 to Uint8Array (raw PCM data)
  const binaryString = atob(pcmData);
  const pcmArray = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcmArray[i] = binaryString.charCodeAt(i);
  }

  // WAV file header (44 bytes) for 24kHz, 16-bit, mono PCM
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF chunk descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmArray.length, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // Format chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Chunk size
  view.setUint16(20, 1, true); // Audio format (PCM)
  view.setUint16(22, 1, true); // Number of channels (mono)
  view.setUint32(24, 24000, true); // Sample rate (24kHz)
  view.setUint32(28, 24000 * 1 * 2, true); // Byte rate (sampleRate * channels * bitsPerSample/8)
  view.setUint16(32, 1 * 2, true); // Block align (channels * bitsPerSample/8)
  view.setUint16(34, 16, true); // Bits per sample

  // Data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmArray.length, true); // Data size

  // Combine header and PCM data
  const wavBuffer = new Uint8Array(header.byteLength + pcmArray.length);
  wavBuffer.set(new Uint8Array(header), 0);
  wavBuffer.set(pcmArray, header.byteLength);

  return new Blob([wavBuffer], { type: 'audio/wav' });
};

// Helper function to play base64 PCM audio data as WAV
const playAudioData = async (audioData: string) => {
  const wavBlob = createWavBlob(audioData);
  const audioUrl = URL.createObjectURL(wavBlob);
  const audio = new Audio(audioUrl);

  return new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error('Failed to play audio'));
    };
    audio.play().catch((error) => {
      URL.revokeObjectURL(audioUrl);
      reject(error);
    });
  });
};

// Use Prisma Host type for form data, omitting server-generated fields
type HostFormData = Omit<Host, 'id' | 'createdAt'>;

export default function HostsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const queryClient = useQueryClient();

  // Fetch hosts
  const { data: hosts = [], isLoading } = useQuery({
    queryKey: ['hosts'],
    queryFn: async () => {
      const data = await api.get<Host[]>('/hosts');
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (faster navigation)
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

  // Create host mutation
  const createMutation = useMutation({
    mutationFn: async (data: HostFormData) => {
      return api.post<Host>('/hosts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] });
      setIsCreateDialogOpen(false);
      toast.success('Host created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create host: ' + error.message);
    },
  });

  // Update host mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: HostFormData }) => {
      return api.put<Host>(`/hosts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] });
      setEditingHost(null);
      toast.success('Host updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update host: ' + error.message);
    },
  });

  // Delete host mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/hosts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] });
      toast.success('Host deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete host: ' + error.message);
    },
  });

  // Generate voice mutation (Supabase Edge Function removed)
  const generateVoiceMutation = useMutation({
    mutationFn: async ({ hostId, text }: { hostId: number; text: string }) => {
      throw new Error(
        'Voice generation is not available right now (Supabase Edge Functions removed). ' +
        'We can add a new backend endpoint (e.g. POST /api/voice-generation) later.'
      );
    },
    onSuccess: async (result) => {
      if (result.success && result.audioData) {
        try {
          await playAudioData(result.audioData);
          const styleText = result.host?.aiStyle ? ` (${result.host.aiStyle} style)` : '';
          const languageText = result.host?.language ? ` in ${result.host.language}` : '';
          toast.success(`Voice generated and playing${languageText}${styleText}...`);
        } catch (error) {
          toast.error('Voice generated but failed to play: ' + (error as Error).message);
        }
      } else {
        toast.error('Failed to generate voice: ' + (result.error || 'Unknown error'));
      }
    },
    onError: (error) => {
      toast.error('Failed to generate voice: ' + error.message);
    },
  });

  const handleCreate = (data: HostFormData) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: HostFormData) => {
    if (editingHost) {
      updateMutation.mutate({ id: editingHost.id, data });
    }
  };

  const handleDelete = (host: Host) => {
    deleteMutation.mutate(host.id);
  };

  const handleGenerateVoice = (hostId: number, text: string) => {
    generateVoiceMutation.mutate({ hostId, text });
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading hosts...</div>;
  }

  return (
    <div className="space-y-6 m-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Host Manager</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Host
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Host</DialogTitle>
            </DialogHeader>
            <HostForm
              onSubmit={handleCreate}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search hosts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      <HostList
        hosts={hosts}
        searchTerm={searchTerm}
        onEdit={setEditingHost}
        onDelete={handleDelete}
        onGenerateVoice={handleGenerateVoice}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingHost} onOpenChange={() => setEditingHost(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Host</DialogTitle>
          </DialogHeader>
          {editingHost && (
            <HostForm
              host={editingHost}
              onSubmit={handleUpdate}
              onCancel={() => setEditingHost(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}