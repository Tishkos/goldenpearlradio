// Frontend-only API models.
// This file intentionally avoids importing anything from the backend (e.g. Prisma types).

export type ContentType = 'TRACK' | 'ADVERTISEMENT' | 'NEWS' | 'TALK' | 'HOST_COMMENTARY' | 'COMMENTARY';

export type Track = {
  id: number;
  title: string;
  artist: string;
  duration: number;
  url: string;
  coverArt?: string | null;
  genre?: string | null;
  mood?: string | null;
  createdAt?: string | Date;
};

export type Host = {
  id: number;
  name: string;
  bio?: string | null;
  imageUrl?: string | null;
  aiStyle?: string | null;
  aiVoiceId?: string | null;
  language?: string | null;
  isActive?: boolean;
  createdAt?: string | Date;
};

export type Location = {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  mapUrl?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  tags?: string[] | null;
  createdAt?: string | Date;
};

export type RadioStation = {
  id: number;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  streamUrl?: string | null;
  timezone?: string | null;
  locationId?: number | null;
  location?: Location | null;
  hosts?: Host[];
  isActive?: boolean;
  createdAt?: string | Date;
  _count?: { scheduledShows: number };
};

export type ShowItem = {
  id: number;
  showId: number;
  position: number;
  startTimeOffset?: number;
  contentType: ContentType;
  contentId: number;
  notes?: string | null;
  volume?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  playbackStartTime?: number;
  playbackEndTime?: number | null;
  mixMode?: string | null;
  parentItemId?: number | null;
  startTimeInParent?: number | null;
  duckingVolume?: number | null;
};

export type Show = {
  id: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  hostId: number;
  featured?: boolean;
  isActive?: boolean;
  createdAt?: string | Date;
  host?: Host | null;
  showItems?: ShowItem[];
};

export type ScheduledShow = {
  id: number;
  showId: number;
  radioStationId: number;
  locationId?: number | null;
  startTime: string | Date;
  endTime: string | Date;
  createdAt?: string | Date;
  show?: Show;
  radioStation?: RadioStation;
  location?: Location | null;
};

/**
 * Product Model
 * Products can be marked as advertisable. If advertisable, admins can create
 * custom advertisements for them to be used in radio shows.
 */
export type Product = {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  coverUrl?: string | null; // Cover image URL (optional)
  audioUrl?: string | null; // Audio content URL (optional)
  affiliateUrl?: string | null; // Link to product (required)
  category?: string | null;
  price?: number | null;
  currency?: string | null;
  productType?: string | null;
  duration?: number | null; // Duration in seconds if audio is present
  tags?: string[] | null;
  isActive?: boolean;
  isAdvertisable?: boolean; // Can this product be advertised on radio?
  createdAt?: string | Date;
  locationId?: number | null;
  location?: Location | null;
  userId?: number | null;
  details?: Record<string, any> | null;
};

export type Promotion = {
  id: number;
  title: string;
  message?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkBehavior?: 'dialog' | 'external';
  category?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string | Date;
  productId?: number | null;
  locationId?: number | null;
  product?: Product | null;
  location?: Location | null;
};

/**
 * Advertisement Model
 * Advertisements can be:
 * 1. Linked to a product (productId set) - when product is marked as advertisable
 * 2. Standalone (productId null) - custom advertisement not tied to any product
 * 
 * This allows flexibility: advertise products OR create custom ads for services,
 * events, announcements, etc.
 */
export type Advertisement = {
  id: number;
  title: string;
  advertiser: string;
  productId?: number | null; // Optional: can be standalone ad or linked to product
  customContent?: string | null; // Custom advertisement content/script
  audioUrl?: string | null; // Pre-recorded ad audio
  duration?: number | null;
  isActive?: boolean;
  createdAt?: string | Date;
  product?: Product | null; // Relation to product if productId is set
};

/**
 * Unified Commentary Model
 * Replaces separate News and HostCommentary types with a single flexible type.
 * 
 * Types:
 * - BREAKING_NEWS: Urgent news announcements
 * - HOST_COMMENTARY: Host's personal commentary/opinion
 * - PRODUCT_COMMENTARY: Commentary about a specific product
 * - GENERAL_COMMENTARY: General commentary/opinion pieces
 * - NEWS: Regular news items
 * 
 * This unified approach allows:
 * - Users to comment on products, news, or anything
 * - Breaking news to be a type of voice/commentary
 * - Hosts to provide commentary on various topics
 * - All commentary types to be managed in one place
 */
export type Commentary = {
  id: number;
  title: string;
  content: string; // Script/message content
  type: 'BREAKING_NEWS' | 'HOST_COMMENTARY' | 'PRODUCT_COMMENTARY' | 'GENERAL_COMMENTARY' | 'NEWS';
  // Relations (optional - depends on type)
  productId?: number | null; // If type is PRODUCT_COMMENTARY
  hostId?: number | null; // If type is HOST_COMMENTARY
  locationId?: number | null; // For location-specific news/commentary
  // Metadata
  priority?: 'low' | 'normal' | 'high' | 'urgent'; // For breaking news
  sortOrder?: number;
  category?: string | null; // News category, product category, etc.
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkBehavior?: 'dialog' | 'external';
  expiresAt?: string | Date | null; // For time-sensitive news
  // Audio
  audioUrl?: string | null; // Generated or uploaded audio
  duration?: number | null;
  // Status
  isActive?: boolean;
  createdAt?: string | Date;
  // Relations
  product?: Product | null;
  host?: Host | null;
  location?: Location | null;
};

// Legacy type aliases for backward compatibility
export type News = Commentary; // Breaking news is a type of commentary
export type HostCommentary = Commentary; // Host commentary is a type of commentary

export type Talk = {
  id: number;
  title: string;
  description?: string | null;
  audioUrl?: string | null;
  duration?: number | null;
  isActive?: boolean;
  createdAt?: string | Date;
};

export type TimelinePreset = {
  id: number;
  name: string;
  date: string; // YYYY-MM-DD format
  items: ShowItem[];
  createdAt: string | Date;
};
