import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User, Radio, Music, DollarSign, Newspaper, MessageSquare, Mic, Settings } from "lucide-react";
import type { Advertisement, Product, Track, News, Talk, HostCommentary, Show, ShowItem, Host } from "@/types/api-models";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import ShowItemBuilder from "./ShowItemBuilder";

type ContentType = "TRACK" | "ADVERTISEMENT" | "NEWS" | "TALK" | "HOST_COMMENTARY";

const getContentIcon = (type: ContentType) => {
  switch (type) {
    case "TRACK": return <Music className="h-4 w-4" />;
    case "ADVERTISEMENT": return <DollarSign className="h-4 w-4" />;
    case "NEWS": return <Newspaper className="h-4 w-4" />;
    case "TALK": return <MessageSquare className="h-4 w-4" />;
    case "HOST_COMMENTARY": return <Mic className="h-4 w-4" />;
    default: return <Radio className="h-4 w-4" />;
  }
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

type ShowWithRelations = Show & { host?: Host | null; showItems: ShowItem[] };

interface ShowDetailsProps {
  selectedShow: ShowWithRelations | null;
  onAdvertisementSelect: (advertisement: Advertisement, products: Product[]) => void;
  showId?: number;
  onItemAdded?: () => void;
}

export default function ShowDetails({
  selectedShow,
  onAdvertisementSelect,
  showId,
  onItemAdded
}: ShowDetailsProps) {
  // Fetch content data for show items
  const { data: tracks = [] } = useQuery({
    queryKey: ['tracks'],
    queryFn: async () => {
      const data = await api.get<Track[]>('/tracks');
      return data || [];
    },
  });

  const { data: advertisements = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: async () => {
      const data = await api.get<Advertisement[]>('/advertisements');
      return data || [];
    },
  });

  const { data: news = [] } = useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      const data = await api.get<News[]>('/news');
      return data || [];
    },
  });

  const { data: talks = [] } = useQuery({
    queryKey: ['talks'],
    queryFn: async () => {
      const data = await api.get<Talk[]>('/talks');
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const data = await api.get<Product[]>('/products');
      return (data || []).filter((p: Product) => p.isActive);
    },
  });

  const { data: hostCommentaries = [] } = useQuery({
    queryKey: ['host-commentaries'],
    queryFn: async () => {
      const data = await api.get<HostCommentary[]>('/host-commentaries');
      return data || [];
    },
  });

  const getContentByType = (type: ContentType, id: number) => {
    switch (type) {
      case "TRACK": return tracks.find(t => t.id === id);
      case "ADVERTISEMENT":
        return advertisements.find(a => a.id === id) || products.find((p: Product) => p.id === id) || null;
      case "NEWS": return news.find(n => n.id === id);
      case "TALK": return talks.find(t => t.id === id);
      case "HOST_COMMENTARY": return hostCommentaries.find(h => h.id === id);
      default: return null;
    }
  };

  // Get display name for an item - checks if ADVERTISEMENT is a product first
  const getItemDisplayName = (item: ShowItem, content: any): string => {
    if (item.contentType === "ADVERTISEMENT") {
      // Product-backed advertisement entries should still show product names
      // even before audio is attached.
      const product = products.find((p: Product) => p.id === item.contentId);
      if (product) {
        return product.name || "Unknown Product";
      }
      // Fall back to regular advertisement
      if (content && content.title) {
        return content.title;
      }
      return "Unknown Advertisement";
    }
    // For other content types, use the content title
    if (content && content.title) {
      return content.title;
    }
    return `Item ${item.id}`;
  };
  
  if (!selectedShow) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Radio className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Show</h3>
          <p className="text-gray-500">Choose a show from the list to view details and build content</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Show Overview */}
      <Card>
        <CardHeader>
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 truncate">
              <Radio className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{selectedShow.title}</span>
            </CardTitle>
            <p className="text-gray-600 mt-1 text-sm">{selectedShow.description}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Show Item Builder - Always visible when show is selected */}
            {showId && onItemAdded && (
              <ShowItemBuilder
                showId={showId}
                onItemAdded={onItemAdded}
              />
            )}

              {/* Show Items Timeline */}
              {selectedShow.showItems.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Show Timeline</h3>
                  <div className="space-y-2">
                    {selectedShow.showItems
                      .sort((a, b) => a.position - b.position)
                      .map((item) => {
                        const content = getContentByType(item.contentType, item.contentId);
                        return (
                          <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-2">
                              {getContentIcon(item.contentType)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{getItemDisplayName(item, content)}</div>
                              <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">{item.contentType}</Badge>
                                <span>Start: {formatTime(item.startTimeOffset || 0)}</span>
                                <span>•</span>
                                <span>Volume: {item.volume}%</span>
                                {item.mixMode && item.mixMode !== 'sequential' && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-xs">{item.mixMode}</Badge>
                                  </>
                                )}
                              </div>
                              {item.notes && (
                                <div className="text-xs text-gray-500 mt-1 italic truncate">
                                  Note: {item.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {item.fadeInDuration > 0 && (
                                <Badge variant="secondary" className="text-xs">↗{item.fadeInDuration}s</Badge>
                              )}
                              {item.fadeOutDuration > 0 && (
                                <Badge variant="secondary" className="text-xs">↘{item.fadeOutDuration}s</Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}            {selectedShow.showItems.length === 0 && (
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No Content Yet</h4>
                <p className="text-gray-500 mb-4">Start building your show by adding tracks, ads, news, talks, or host commentary</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
