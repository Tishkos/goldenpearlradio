import { Show } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { PlayCircle, Clock } from 'lucide-react';

interface ProgramCardProps {
  show: Show;
  onClick: (show: Show) => void;
}

export function ProgramCard({ show, onClick }: ProgramCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <img 
        src={show.coverImage || "https://images.unsplash.com/photo-1574236170880-75e99465a27b?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80"} 
        alt={show.title}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <div className="flex items-center mb-2">
          {show.isFeatured && (
            <span className="bg-radio-orange text-white text-xs px-2 py-1 rounded-full mr-2">
              FEATURED
            </span>
          )}
          <h3 className="font-poppins font-medium text-lg">{show.title}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {show.description}
        </p>
        <div className="flex justify-between items-center">
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="mr-1 h-4 w-4" />
            <span>{show.scheduleTime || 'On demand'}</span>
          </div>
          <Button
            variant="default"
            size="sm"
            className="bg-radio-orange text-white hover:bg-radio-orange/90 rounded-full"
            onClick={() => onClick(show)}
          >
            <PlayCircle className="mr-1 h-4 w-4" />
            Play
          </Button>
        </div>
      </div>
    </div>
  );
}