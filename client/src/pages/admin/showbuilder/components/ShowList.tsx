import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Radio, User, Search } from "lucide-react";
import type { Show, Host, ShowItem } from "@/types/api-models";

type ShowWithRelations = Show & { host?: Host | null; showItems: ShowItem[] };

interface ShowListProps {
  shows: ShowWithRelations[];
  selectedShow: ShowWithRelations | null;
  onShowSelect: (show: ShowWithRelations) => void;
}

export default function ShowList({ shows, selectedShow, onShowSelect }: ShowListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter shows based on search query
  const filteredShows = shows.filter((show) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const matchesTitle = show.title.toLowerCase().includes(query);
    const matchesDescription = show.description?.toLowerCase().includes(query);
    const matchesHost = show.host?.name.toLowerCase().includes(query);

    return matchesTitle || matchesDescription || matchesHost;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" />
          Shows
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search shows by title, description, or host..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        {filteredShows.length > 0 && (
          <div className="space-y-2">
            {filteredShows.map((show) => (
              <div
                key={show.id}
                className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                  selectedShow?.id === show.id ? "bg-purple-50 border-purple-200" : "hover:bg-gray-50"
                }`}
                onClick={() => onShowSelect(show)}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{show.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mt-1">
                      <span>{show.showItems.length} items</span>
                      {show.host && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 truncate">
                            <User className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{show.host.name}</span>
                          </span>
                        </>
                      )}
                    </div>
                    {show.host?.bio && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {show.host.bio}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-row sm:flex-col items-start sm:items-end gap-1 flex-shrink-0">
                    {show.featured && <Badge variant="secondary" className="text-xs">Featured</Badge>}
                    {show.host?.aiStyle && (
                      <Badge variant="outline" className="text-xs">
                        {show.host.aiStyle}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredShows.length === 0 && searchQuery && (
          <div className="text-center py-8 mt-4">
            <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No shows found matching "{searchQuery}"</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-1 h-auto p-0 text-xs"
            >
              Clear search
            </Button>
          </div>
        )}

        {filteredShows.length === 0 && !searchQuery && shows.length === 0 && (
          <div className="text-center py-8 mt-4">
            <Radio className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No shows available</p>
            <p className="text-xs text-gray-400 mt-1">Create shows on the Shows page</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}