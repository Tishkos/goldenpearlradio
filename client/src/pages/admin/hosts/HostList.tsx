import React, { useMemo } from 'react';
import { Package, Mic, Volume2 } from 'lucide-react';
import type { Host } from '@/types/api-models';
import HostItem from './HostItem';

interface HostListProps {
  hosts: Host[];
  searchTerm: string;
  onEdit: (host: Host) => void;
  onDelete: (host: Host) => void;
  onGenerateVoice: (hostId: number, text: string) => void;
}

const HostList: React.FC<HostListProps> = ({
  hosts,
  searchTerm,
  onEdit,
  onDelete,
  onGenerateVoice
}) => {
  const filteredHosts = useMemo(() => {
    let filtered = hosts;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(host =>
        host.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        host.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        host.language?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [hosts, searchTerm]);

  if (filteredHosts.length === 0) {
    return (
      <div className="text-center py-8">
        <Mic className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">
          {searchTerm ? 'No hosts found matching your search.' : 'No hosts available.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Showing {filteredHosts.length} of {hosts.length} hosts
      </div>
      {filteredHosts.map(host => (
        <HostItem
          key={host.id}
          host={host}
          onEdit={onEdit}
          onDelete={onDelete}
          onGenerateVoice={onGenerateVoice}
        />
      ))}
    </div>
  );
};

export default HostList;