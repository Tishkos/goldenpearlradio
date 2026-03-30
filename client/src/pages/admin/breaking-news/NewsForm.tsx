import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import LocationCreator from "@/components/LocationCreator";
import type { News, Host, Location } from "@/types/api-models";

// News type with relations
interface NewsWithRelations extends News {
  location?: Location;
  newsHostAudio?: Array<{
    id: number;
    audioUrl: string;
    host: Host;
  }>;
}

interface NewsFormProps {
  editingNews: News | null;
  newMessage: string;
  setNewMessage: (value: string) => void;
  newsType: string;
  setNewsType: (value: string) => void;
  priority: string;
  setPriority: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  isActive: boolean;
  setIsActive: (value: boolean) => void;
  selectedLocation: string;
  setSelectedLocation: (value: string) => void;
  expiresAt: string;
  setExpiresAt: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isPending: boolean;
}

export default function NewsForm({
  editingNews,
  newMessage,
  setNewMessage,
  newsType,
  setNewsType,
  priority,
  setPriority,
  title,
  setTitle,
  category,
  setCategory,
  isActive,
  setIsActive,
  selectedLocation,
  setSelectedLocation,
  expiresAt,
  setExpiresAt,
  onSubmit,
  onCancel,
  isPending
}: NewsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingNews ? 'Edit News' : 'Create News'}</CardTitle>
        <CardDescription>
          {editingNews
            ? 'Update the news item details. Changing the message will delete associated audio files.'
            : 'Create complete news items with all database fields. Audio files can be added separately.'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title (Optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="News title..."
              />
            </div>

            <div>
              <Label htmlFor="category">Category (Optional)</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., sports, politics..."
              />
            </div>
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Enter your news message here..."
              className="min-h-[100px]"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>News Type</Label>
              <Select value={newsType} onValueChange={setNewsType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breaking">Breaking News</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      Normal
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      Urgent
                    </div>
                  </SelectItem>
                  <SelectItem value="critical">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      Critical
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Location (Optional)</Label>
              <LocationCreator
                value={selectedLocation}
                onChange={setSelectedLocation}
              />
            </div>

            <div>
              <Label htmlFor="expiresAt">Expires At (Optional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {editingNews && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700"
              disabled={isPending || !newMessage.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingNews ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {editingNews ? 'Update News' : 'Create News'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}