import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HostCommentary, Host } from "@/types/api-models";

interface HostCommentaryFormProps {
  commentary?: HostCommentary & { host?: Host };
  hosts: Host[];
  onSubmit: (data: Omit<HostCommentary, 'id' | 'createdAt' | 'audioUrl' | 'duration'>) => void;
  onCancel: () => void;
}

export default function HostCommentaryForm({ commentary, hosts, onSubmit, onCancel }: HostCommentaryFormProps) {
  const [formData, setFormData] = useState({
    title: commentary?.title || "",
    script: commentary?.script || "",
    hostId: commentary?.hostId || null,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.script.trim()) {
      return;
    }

    onSubmit({
      title: formData.title,
      script: formData.script,
      hostId: formData.hostId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Commentary Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Enter commentary title"
          required
        />
      </div>

      <div>
        <Label htmlFor="hostId">Host (Optional)</Label>
        <Select
          value={formData.hostId?.toString() || "none"}
          onValueChange={(value) => setFormData({ ...formData, hostId: value === "none" ? null : value ? parseInt(value) : null })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a host for this commentary (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No specific host</SelectItem>
            {hosts.map((host) => (
              <SelectItem key={host.id} value={host.id.toString()}>
                {host.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="script">Script Content *</Label>
        <Textarea
          id="script"
          value={formData.script}
          onChange={(e) => setFormData({ ...formData, script: e.target.value })}
          placeholder="Enter the commentary script that will be converted to speech"
          rows={6}
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          This script will be used to generate audio using AI voice synthesis.
        </p>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {commentary ? "Update" : "Create"} Host Commentary
        </Button>
      </div>
    </form>
  );
}