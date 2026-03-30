import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Search } from "lucide-react";
import NewsItem from "./NewsItem";
import type { News, Host, Location } from "@/types/api-models";

// News type with relations
interface NewsWithRelations extends News {
  location?: Location;
  newsHostAudio?: Array<{
    id: number;
    audioUrl: string;
    duration?: number;
    host: Host;
  }>;
}

interface NewsListProps {
  newsList: News[];
  totalCount: number;
  searchTerm: string;
  onEdit: (news: News) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  isUpdating: boolean;
  hosts?: any[];
  hostAudios?: any[];
  onGenerateHostAudio?: (newsId: number, hostId: number) => void;
  onDeleteHostAudio?: (newsId: number, hostId: number) => void;
  generatingHostAudio?: Set<string>;
}

export default function NewsList({ 
  newsList, 
  totalCount, 
  searchTerm, 
  onEdit, 
  onDelete, 
  isDeleting, 
  isUpdating,
  hosts = [],
  hostAudios = [],
  onGenerateHostAudio,
  onDeleteHostAudio,
  generatingHostAudio = new Set()
}: NewsListProps) {
  if (newsList.length === 0) {
    if (searchTerm.trim()) {
      return (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
            <p className="text-gray-500">No news items match your search "{searchTerm}". Try a different search term.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No News</h3>
          <p className="text-gray-500">Create your first news item above.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {newsList.map((news: News) => (
        <NewsItem
          key={news.id}
          news={news}
          onEdit={onEdit}
          onDelete={onDelete}
          isDeleting={isDeleting}
          isUpdating={isUpdating}
          hosts={hosts}
          hostAudios={hostAudios}
          onGenerateHostAudio={onGenerateHostAudio}
          onDeleteHostAudio={onDeleteHostAudio}
          generatingHostAudio={generatingHostAudio}
        />
      ))}
    </div>
  );
}