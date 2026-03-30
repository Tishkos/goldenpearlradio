import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Host } from '@/types/api-models';
import { Edit, Trash2, Mic, Volume2, Play } from 'lucide-react';

interface HostItemProps {
  host: Host;
  onEdit: (host: Host) => void;
  onDelete: (host: Host) => void;
  onGenerateVoice: (hostId: number, text: string) => void;
}

const HostItem: React.FC<HostItemProps> = ({ host, onEdit, onDelete, onGenerateVoice }) => {
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [voiceText, setVoiceText] = useState('');

  const handleGenerateVoice = () => {
    if (voiceText.trim()) {
      onGenerateVoice(host.id, voiceText);
      setVoiceText('');
      setIsVoiceDialogOpen(false);
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          {/* Host Image */}
          <div className="flex-shrink-0">
            {host.imageUrl ? (
              <img
                src={host.imageUrl}
                alt={host.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling!.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center ${host.imageUrl ? 'hidden' : ''}`}>
              <Mic className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          {/* Host Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {host.name}
                </h3>
                <Badge className="bg-purple-100 text-purple-800">
                  AI Host
                </Badge>
                {!host.isActive && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Test Voice Button */}
                {host.aiVoiceId && (
                  <Dialog open={isVoiceDialogOpen} onOpenChange={setIsVoiceDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Volume2 className="w-4 h-4 mr-1" />
                        Test Voice
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Test Voice for {host.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="voiceText">Text to convert to speech</Label>
                          <Textarea
                            id="voiceText"
                            value={voiceText}
                            onChange={(e) => setVoiceText(e.target.value)}
                            placeholder="Enter the text you want to convert to speech..."
                            rows={4}
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" onClick={() => setIsVoiceDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleGenerateVoice} disabled={!voiceText.trim()}>
                            <Play className="w-4 h-4 mr-1" />
                            Test Voice
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <Button variant="outline" size="sm" onClick={() => onEdit(host)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => onDelete(host)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Bio */}
            {host.bio && (
              <p className="text-gray-600 mt-2 line-clamp-2">
                {host.bio}
              </p>
            )}

            {/* AI Configuration */}
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4 text-sm">
                {host.language && (
                  <div>
                    <span className="font-medium text-gray-700">Language:</span>
                    <span className="ml-1 text-gray-600">{host.language}</span>
                  </div>
                )}
                {host.aiStyle && (
                  <div>
                    <span className="font-medium text-gray-700">Style:</span>
                    <span className="ml-1 text-gray-600 capitalize">{host.aiStyle}</span>
                  </div>
                )}
                {host.aiVoiceId && (
                  <div>
                    <span className="font-medium text-gray-700">Voice ID:</span>
                    <span className="ml-1 text-gray-600 font-mono text-xs">{host.aiVoiceId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HostItem;