import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Mic, Volume2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Advertisement } from '@/types/api-models';
import AdvertisementForm from './AdvertisementForm';
import AdvertisementList from './AdvertisementList';

// Use Prisma Advertisement type for form data, omitting server-generated fields
type AdvertisementFormData = Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt'>;

export default function AdvertisementsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAdvertisement, setEditingAdvertisement] = useState<Advertisement | null>(null);
  const [selectedHostId, setSelectedHostId] = useState<string>("");
  const [regeneratingAudio, setRegeneratingAudio] = useState<Set<number>>(new Set());
  const [generatingHostAudio, setGeneratingHostAudio] = useState<Set<string>>(new Set()); // Track individual host audio generation
  const queryClient = useQueryClient();

  // Fetch advertisements with product info
  const { data: advertisements = [], isLoading } = useQuery({
    queryKey: ['advertisements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisements')
        .select(`
          *,
          product:products(*)
        `)
        .order('createdAt', { ascending: false });

      if (error) throw error;
      console.log('Fetched advertisements data:', data);
      return data || [];
    },
  });

  // Fetch products for selection
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('isActive', true)
        .order('name');

      if (error) throw new Error('Failed to fetch products');
      return data;
    },
  });

  // Fetch hosts for audio generation
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

  // Fetch host audio data for all advertisements
  const { data: hostAudios = [] } = useQuery({
    queryKey: ['advertisement-host-audios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisement_host_audio')
        .select(`
          id,
          advertisementId,
          hostId,
          audioUrl,
          duration,
          createdAt,
          host:hosts(name)
        `)
        .order('createdAt', { ascending: false });

      if (error) {
        console.error('Error fetching host audio data:', error);
        throw new Error('Failed to fetch host audio data');
      }
      console.log('Fetched host audio data:', data);
      return data || [];
    },
  });

  // Create advertisement mutation
  const createMutation = useMutation({
    mutationFn: async (data: AdvertisementFormData) => {
      const { data: result, error } = await supabase
        .from('advertisements')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      setIsCreateDialogOpen(false);
      toast.success('Advertisement created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create advertisement: ' + error.message);
    },
  });

  // Update advertisement mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AdvertisementFormData }) => {
      const { data: result, error } = await supabase
        .from('advertisements')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: async (updatedAd) => {
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      setEditingAdvertisement(null);

      // Check if important content changed (title or advertiser)
      const originalAd = advertisements.find(a => a.id === updatedAd.id);
      const contentChanged = originalAd &&
        (originalAd.title !== updatedAd.title || originalAd.advertiser !== updatedAd.advertiser);

      if (contentChanged) {
        // Get all existing host audios for this advertisement
        const { data: existingHostAudios, error: fetchError } = await supabase
          .from('advertisement_host_audio')
          .select('hostId, audioUrl')
          .eq('advertisementId', updatedAd.id);

        if (!fetchError && existingHostAudios && existingHostAudios.length > 0) {
          // Set regenerating state
          setRegeneratingAudio(prev => new Set(prev).add(updatedAd.id));

          // Delete old audio files from storage
          const filesToDelete = existingHostAudios
            .map(audio => audio.audioUrl)
            .filter(url => url && url.includes('advertisement_'));

          if (filesToDelete.length > 0) {
            try {
              const { error: storageError } = await supabase.storage
                .from('media')
                .remove(filesToDelete);

              if (storageError) {
                console.warn('Failed to delete old audio files during update:', storageError);
              }
            } catch (storageCleanupError) {
              console.warn('Error during storage cleanup on update:', storageCleanupError);
            }
          }

          // Delete old host audio records
          const { error: deleteError } = await supabase
            .from('advertisement_host_audio')
            .delete()
            .eq('advertisementId', updatedAd.id);

          if (deleteError) {
            console.warn('Failed to delete old host audio records:', deleteError);
          }

          // Regenerate audio for all hosts that had audio before
          const hostIds = existingHostAudios.map(audio => audio.hostId);
          toast.info(`Regenerating audio for ${hostIds.length} host(s) due to content changes...`);

          // Regenerate audio for each host
          const regenerationPromises = hostIds.map(async (hostId) => {
            try {
              await generateHostAudioMutation.mutateAsync({ advertisementId: updatedAd.id, hostId });
            } catch (error) {
              console.error(`Failed to regenerate audio for host ${hostId}:`, error);
              toast.error(`Failed to regenerate audio for host ${hostId}`);
            }
          });

          // Wait for all regenerations to complete
          await Promise.all(regenerationPromises);

          // Clear regenerating state
          setRegeneratingAudio(prev => {
            const newSet = new Set(prev);
            newSet.delete(updatedAd.id);
            return newSet;
          });

          toast.success('Advertisement updated and audio regenerated for all hosts');
        } else {
          toast.success('Advertisement updated successfully');
        }
      } else {
        toast.success('Advertisement updated successfully');
      }
    },
    onError: (error) => {
      toast.error('Failed to update advertisement: ' + error.message);
    },
  });

  // Delete advertisement mutation with cleanup
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      // First, get all host audio files for this advertisement
      const { data: hostAudios, error: fetchError } = await supabase
        .from('advertisement_host_audio')
        .select('audioUrl')
        .eq('advertisementId', id);

      if (fetchError) {
        console.warn('Failed to fetch host audio files for cleanup:', fetchError);
      }

      // Clean up audio files from storage bucket first
      if (hostAudios && hostAudios.length > 0) {
        const filesToDelete = hostAudios
          .map(audio => audio.audioUrl)
          .filter(url => url && url.includes('advertisement_')); // Only delete actual generated files

        if (filesToDelete.length > 0) {
          try {
            const { error: storageError } = await supabase.storage
              .from('media')  // Using the existing media bucket
              .remove(filesToDelete);

            if (storageError) {
              console.warn('Failed to delete audio files from storage:', storageError);
            } else {
              console.log('Successfully deleted audio files from storage:', filesToDelete);
            }
          } catch (storageCleanupError) {
            console.warn('Error during storage cleanup:', storageCleanupError);
          }
        }
      }

      // Delete host audio records first
      const { error: deleteHostAudiosError } = await supabase
        .from('advertisement_host_audio')
        .delete()
        .eq('advertisementId', id);

      if (deleteHostAudiosError) {
        console.warn('Failed to delete host audio records:', deleteHostAudiosError);
      }

      // Then delete the advertisement
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      queryClient.invalidateQueries({ queryKey: ['advertisement-host-audios'] });
      toast.success('Advertisement and associated audio files deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete advertisement: ' + error.message);
    },
  });

  // Delete all host audio for advertisement mutation
  const deleteAllHostAudioMutation = useMutation({
    mutationFn: async (advertisementId: number) => {
      // Get all host audio files for this advertisement
      const { data: hostAudios, error: fetchError } = await supabase
        .from('advertisement_host_audio')
        .select('audioUrl')
        .eq('advertisementId', advertisementId);

      if (fetchError) {
        console.warn('Failed to fetch host audio files for deletion:', fetchError);
      }

      // Clean up audio files from storage bucket
      if (hostAudios && hostAudios.length > 0) {
        const filesToDelete = hostAudios
          .map(audio => audio.audioUrl)
          .filter(url => url && url.includes('advertisement_'));

        if (filesToDelete.length > 0) {
          try {
            const { error: storageError } = await supabase.storage
              .from('media')
              .remove(filesToDelete);

            if (storageError) {
              console.warn('Failed to delete audio files from storage:', storageError);
            } else {
              console.log('Successfully deleted audio files from storage:', filesToDelete);
            }
          } catch (storageCleanupError) {
            console.warn('Error during storage cleanup:', storageCleanupError);
          }
        }
      }

      // Delete all host audio records
      const { error } = await supabase
        .from('advertisement_host_audio')
        .delete()
        .eq('advertisementId', advertisementId);

      if (error) throw error;

      return advertisementId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisement-host-audios'] });
      toast.success('All host audio files deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete host audio files: ' + error.message);
    },
  });

  const handleCreate = (data: AdvertisementFormData) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: AdvertisementFormData) => {
    if (editingAdvertisement) {
      updateMutation.mutate({ id: editingAdvertisement.id, data });
    }
  };

  const handleDelete = (advertisement: Advertisement) => {
    deleteMutation.mutate(advertisement.id);
  };

  // Generate host audio mutation
  const generateHostAudioMutation = useMutation({
    mutationFn: async ({ advertisementId, hostId }: { advertisementId: number; hostId: number }) => {
      const advertisement = advertisements.find(a => a.id === advertisementId);
      const host = hosts.find(h => h.id === hostId);

      if (!advertisement) {
        throw new Error('Advertisement not found');
      }

      if (!host) {
        throw new Error('Host not found');
      }

      // Generate smart advertisement text using the selected product
      let advertisementText = advertisement.title;

      // Get the associated product with full details
      const product = products.find(p => p.id === advertisement.productId);

      if (product) {
        // Create comprehensive advertisement text using all product information
        advertisementText = `Discover ${product.name}`;

        if (product.description && product.description.trim()) {
          advertisementText += ` - ${product.description}`;
        }

        if (product.price && product.currency) {
          advertisementText += `. Available now for just ${product.price} ${product.currency.toUpperCase()}`;
        }

        if (product.category) {
          advertisementText += `. Perfect for ${product.category} enthusiasts`;
        }

        // Add details from JSON field if available
        if (product.details && typeof product.details === 'object') {
          const details = product.details as any;
          if (details.features && Array.isArray(details.features)) {
            advertisementText += `. Features include ${details.features.slice(0, 3).join(', ')}`;
            if (details.features.length > 3) {
              advertisementText += ` and more`;
            }
          }
        }

        // Add tags information
        if (product.tags && Array.isArray(product.tags) && product.tags.length > 0) {
          advertisementText += `. Tagged as ${product.tags.slice(0, 2).join(', ')}`;
        }

        advertisementText += `. Brought to you by ${advertisement.advertiser}. Visit our website or contact us for more information.`;

        // If there's an affiliate URL, mention it
        if (product.affiliateUrl) {
          advertisementText += ` Check it out today!`;
        }
      } else {
        advertisementText = `${advertisement.title} by ${advertisement.advertiser}. Visit our website for more information.`;
      }

      // Call Supabase Edge Function for voice generation
      const { data, error } = await supabase.functions.invoke('advertisement-voice-generation', {
        body: {
          advertisementId,
          hostId,
          text: advertisementText,
          product: product ? {
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            currency: product.currency,
            category: product.category,
            details: product.details,
            tags: product.tags,
            affiliateUrl: product.affiliateUrl,
          } : undefined,
          voiceId: host.aiVoiceId,
          language: host.language,
          aiStyle: host.aiStyle,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return { ...data, advertisement, host, generatedText: advertisementText, advertisementId, hostId } as {
        success: boolean;
        audioData?: string;
        audioUrl?: string;
        storageUrl?: string;
        mimeType?: string;
        error?: string;
        voiceId?: string;
        duration?: number;
        advertisement: Advertisement;
        host: any;
        generatedText: string;
        advertisementId: number;
        hostId: number;
      };
    },
    onMutate: ({ advertisementId, hostId }) => {
      // Set loading state when mutation starts
      const key = `${advertisementId}-${hostId}`;
      setGeneratingHostAudio(prev => new Set(prev).add(key));
    },
    onSuccess: async (result) => {
      console.log('Audio generation result:', result);
      if (result.success && result.audioData) {
        console.log('Audio generated and saved successfully on server-side');

        // Invalidate queries to refresh the data immediately since server saved the record
        console.log('Invalidating queries...');
        queryClient.invalidateQueries({ queryKey: ['advertisement-host-audios'] });
        await queryClient.refetchQueries({ queryKey: ['advertisement-host-audios'] });

        // Audio record is saved on server, user can now play it manually
        const styleText = result.host?.aiStyle ? ` (${result.host.aiStyle} style)` : '';
        const languageText = result.host?.language ? ` in ${result.host.language}` : '';
        toast.success(`Advertisement audio generated and saved${languageText}${styleText}!\nGenerated text: "${result.generatedText.substring(0, 100)}${result.generatedText.length > 100 ? '...' : ''}"`);
      } else {
        console.log('Audio generation failed:', result);
        toast.error('Failed to generate advertisement voice: ' + (result.error || 'Unknown error'));
      }
    },
    onError: (error) => {
      toast.error('Failed to generate advertisement voice: ' + error.message);
    },
    onSettled: (result) => {
      // Clear loading state when mutation completes (success or error)
      if (result && result.advertisementId && result.hostId) {
        const key = `${result.advertisementId}-${result.hostId}`;
        setGeneratingHostAudio(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    },
  });

  const handleGenerateHostAudio = (advertisementId: number, hostId: number) => {
    generateHostAudioMutation.mutate({ advertisementId, hostId });
  };

  // Delete specific host audio mutation
  const deleteHostAudioMutation = useMutation({
    mutationFn: async ({ advertisementId, hostId }: { advertisementId: number; hostId: number }) => {
      // Get the host audio record
      const { data: hostAudio, error: fetchError } = await supabase
        .from('advertisement_host_audio')
        .select('audioUrl')
        .eq('advertisementId', advertisementId)
        .eq('hostId', hostId)
        .single();

      if (fetchError) {
        console.warn('Failed to fetch host audio for deletion:', fetchError);
      }

      // Clean up audio file from storage bucket
      if (hostAudio && hostAudio.audioUrl && hostAudio.audioUrl.includes('advertisement_')) {
        try {
          const { error: storageError } = await supabase.storage
            .from('media')
            .remove([hostAudio.audioUrl]);

          if (storageError) {
            console.warn('Failed to delete audio file from storage:', storageError);
          } else {
            console.log('Successfully deleted audio file from storage:', hostAudio.audioUrl);
          }
        } catch (storageCleanupError) {
          console.warn('Error during storage cleanup:', storageCleanupError);
        }
      }

      // Delete the host audio record
      const { error } = await supabase
        .from('advertisement_host_audio')
        .delete()
        .eq('advertisementId', advertisementId)
        .eq('hostId', hostId);

      if (error) throw error;

      return { advertisementId, hostId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advertisement-host-audios'] });
      toast.success('Host audio deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete host audio: ' + error.message);
    },
  });

  const handleDeleteHostAudio = (advertisementId: number, hostId: number) => {
    deleteHostAudioMutation.mutate({ advertisementId, hostId });
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading advertisements...</div>;
  }

  return (
    <div className="space-y-6 m-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Content Creator</h1>
          <p className="text-sm text-gray-600 mt-1">Create Products, Comments, News, and Advertisements for the radio timeline</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Advertisement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Advertisement</DialogTitle>
            </DialogHeader>
            <AdvertisementForm
              onSubmit={handleCreate}
              onCancel={() => setIsCreateDialogOpen(false)}
              products={products}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search advertisements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      <AdvertisementList
        advertisements={advertisements}
        hosts={hosts}
        hostAudios={hostAudios}
        searchTerm={searchTerm}
        onEdit={setEditingAdvertisement}
        onDelete={handleDelete}
        onGenerateHostAudio={handleGenerateHostAudio}
        onDeleteHostAudio={handleDeleteHostAudio}
        regeneratingAudio={regeneratingAudio}
        generatingHostAudio={generatingHostAudio}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingAdvertisement} onOpenChange={() => setEditingAdvertisement(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Advertisement</DialogTitle>
          </DialogHeader>
          {editingAdvertisement && (
            <AdvertisementForm
              advertisement={editingAdvertisement}
              onSubmit={handleUpdate}
              onCancel={() => setEditingAdvertisement(null)}
              products={products}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}