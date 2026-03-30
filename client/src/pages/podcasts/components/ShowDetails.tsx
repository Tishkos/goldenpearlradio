import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Clock, Headphones, Radio, MapPin } from "lucide-react";
import { api } from "@/lib/api-client";
import type { Show, Host, RadioStation, Location, ShowItem } from '@/types/api-models';

// Type for Show with nested relations
type ShowWithRelations = Show & {
  host?: Host | null;
  scheduledShows?: Array<{
    id: number;
    radioStationId: number;
    locationId: number | null;
    startTime: Date;
    endTime: Date;
    radioStation?: RadioStation | null;
    location?: Location | null;
  }>;
  showItems?: ShowItem[];
  _count?: {
    showItems: number;
    scheduledShows: number;
  };
}

function ShowDetails({ showId }: { showId: number | null }) {
  const { data: show, isLoading: showLoading } = useQuery<ShowWithRelations | null>({
    queryKey: ['podcast-show-details', showId],
    queryFn: async (): Promise<ShowWithRelations | null> => {
      if (!showId) return null;
      const data = await api.get<Show>(`/shows/${showId}`);
      return data || null;
    },
    enabled: !!showId,
  });

  if (showLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-200 animate-pulse rounded-lg"></div>
        <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2"></div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No show found</p>
      </div>
    );
  }

  const showItems = show.showItems || [];
  const sortedItems = [...showItems].sort((a, b) => (a.position || 0) - (b.position || 0));

  return (
    <div className="pt-0">
      {/* Show Header */}
      <div className="flex items-start gap-4">
        {show.imageUrl && (
          <img 
            src={show.imageUrl} 
            alt={show.title} 
            className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg flex-shrink-0 border-2 border-gray-200"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-2">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">{show.title}</h3>
            {show.featured && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-radio-orange text-white rounded">
                Featured
              </span>
            )}
          </div>

          {/* Host */}
          {show.host && (
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <User className="h-4 w-4 mr-2 text-gray-500" />
              <span className="font-medium">{show.host.name}</span>
            </div>
          )}

          {/* Description */}
          {show.description && (
            <p className="text-sm text-gray-700 leading-relaxed mb-3">{show.description}</p>
          )}

          {/* Host Bio */}
          {show.host?.bio && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-medium text-sm mb-1 text-gray-900">About the Host</h4>
              <p className="text-sm text-gray-600">{show.host.bio}</p>
            </div>
          )}
        </div>
      </div>

      {/* Scheduled Shows */}
      {show.scheduledShows && show.scheduledShows.length > 0 && (
        <div className="mt-6">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <Radio className="h-4 w-4 mr-2 text-radio-orange" />
            Scheduled Times
          </h4>
          <div className="space-y-2">
            {show.scheduledShows.map((scheduled) => (
              <Card key={scheduled.id} className="border-gray-200">
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {scheduled.radioStation && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Radio className="h-4 w-4 mr-2 text-radio-orange" />
                        <span className="font-medium">{scheduled.radioStation.name}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2 text-gray-500" />
                      <span>
                        {new Date(scheduled.startTime).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} - {new Date(scheduled.endTime).toLocaleString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {scheduled.location && (
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                        <span>
                          {scheduled.location.name}
                          {scheduled.location.city && `, ${scheduled.location.city}`}
                          {scheduled.location.country && `, ${scheduled.location.country}`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Show Items */}
      <div className="mt-6">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <Headphones className="h-4 w-4 mr-2 text-radio-orange" />
          <span>Show Episodes</span>
          {sortedItems.length > 0 && (
            <span className="ml-2 text-sm text-gray-500 font-normal">({sortedItems.length} {sortedItems.length === 1 ? 'episode' : 'episodes'})</span>
          )}
        </h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sortedItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
              <Headphones className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No episodes available for this show.</p>
            </div>
          ) : (
            sortedItems.map((item, index) => (
              <Card key={item.id} className="hover:shadow-sm transition-shadow border-gray-200">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-radio-orange text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                          {item.position !== undefined ? item.position + 1 : index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {item.notes || `Episode ${item.position !== undefined ? item.position + 1 : index + 1}`}
                          </div>
                          <div className="text-xs text-gray-500 capitalize mt-0.5">
                            {item.contentType?.replace('_', ' ') || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </div>
                    {item.volume !== 100 && (
                      <span className="text-xs text-gray-500 mr-2">Vol: {item.volume}%</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ShowDetails;