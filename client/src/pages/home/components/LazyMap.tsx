import React from 'react';

interface LazyMapProps {
  mapUrl: string;
  locationName: string;
}

export default function LazyMap({ mapUrl, locationName }: LazyMapProps) {
  if (mapUrl.includes('google.com/maps')) {
    return (
      <iframe
        src={mapUrl.replace('https://www.google.com/maps', 'https://www.google.com/maps/embed')}
        width="100%"
        height="150"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="rounded-lg"
        title={`Map for ${locationName}`}
      />
    );
  }

  if (mapUrl.includes('bing.com/maps')) {
    return (
      <iframe
        src={mapUrl}
        width="100%"
        height="150"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        className="rounded-lg"
        title={`Map for ${locationName}`}
      />
    );
  }

  if (mapUrl.includes('openstreetmap.org')) {
    return (
      <iframe
        src={mapUrl.replace('/#map=', '/export/embed?')}
        width="100%"
        height="150"
        style={{ border: 0 }}
        className="rounded-lg"
        title={`Map for ${locationName}`}
      />
    );
  }

  return (
    <div className="text-xs text-gray-600">
      Map not available for embedding
    </div>
  );
}