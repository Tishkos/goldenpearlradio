# Music Manager - Modular Structure

## 📁 File Structure

```
client/src/pages/admin/music-manager/
├── index.tsx                 # Main entry point with tabs navigation
├── TracksManager.tsx         # Tracks listing and management
├── AlbumsManager.tsx         # Albums creation and pricing (TODO)
├── PlaylistsManager.tsx      # Playlists curation and pricing (TODO)
├── AnalyticsView.tsx         # Analytics dashboard (TODO)
├── TrackFormDialog.tsx       # Track add/edit form with file upload (TODO)
└── DeleteTrackDialog.tsx     # Delete confirmation dialog
```

## 🎯 Features

### ✅ Implemented
- **Modular folder structure** with separate components
- **Tabs navigation** (Tracks, Albums, Playlists, Analytics)
- **Tracks listing** with search, sort, and filters
- **Stats dashboard** showing track metrics
- **Audio preview** inline player
- **Delete confirmation** dialog
- **Responsive design** with modern UI

### 🚧 To Be Implemented

#### TracksManager Enhancements
- [ ] Complete TrackFormDialog with:
  - File upload to Supabase Storage
  - Audio duration auto-detection
  - Cover art upload
  - All metadata fields (genre, mood, tempo, year)
  - Album assignment dropdown

#### AlbumsManager
- [ ] Create album form with:
  - Album title, artist, release date
  - Cover art upload
  - Track assignment (multi-select)
  - Pricing fields (price, currency)
  - Stripe integration (productId, priceId)
  - Album of the Week nomination
- [ ] Albums grid view with cards
- [ ] Edit/delete album functionality
- [ ] Track listing within album

#### PlaylistsManager
- [ ] Create playlist form with:
  - Playlist name and description
  - Cover art upload
  - Track assignment (drag-and-drop order)
  - Public/private toggle
  - Pricing fields (price, currency)
  - Stripe integration
  - Playlist of the Week nomination
- [ ] Playlists grid view with beautiful cards
- [ ] Edit/delete playlist functionality
- [ ] Track reordering within playlist

#### AnalyticsView
- [ ] Track play count statistics
- [ ] Most popular tracks chart
- [ ] Genre distribution chart
- [ ] Sales analytics (albums & playlists)
- [ ] Revenue metrics with Stripe data
- [ ] Time-based analytics (daily/weekly/monthly)

## 🔧 Edge Functions

### tracks-api
Located: `supabase/functions/tracks-api/index.ts`

**Endpoints:**
- `POST /tracks-api/upload` - Upload audio/cover files to Supabase Storage
- `GET /tracks-api` - Get all tracks
- `GET /tracks-api/:id` - Get single track
- `POST /tracks-api` - Create new track
- `PUT /tracks-api/:id` - Update track
- `DELETE /tracks-api/:id` - Delete track (also deletes files from storage)

**Storage Buckets:**
- `media/tracks/` - Audio files
- `media/covers/` - Cover art images

## 💾 Prisma Schema

### Track Model
```prisma
model Track {
  id        Int      @id @default(autoincrement())
  albumId   Int?
  title     String
  artist    String
  duration  Int
  url       String
  coverArt  String?
  genre     String?
  mood      String?
  aiTags    Json?
  createdAt DateTime @default(now())
  
  album     Album?      @relation(fields: [albumId], references: [id])
  playlists Playlist[]
  likes     Like[]
}
```

### Album Model
```prisma
model Album {
  id          Int      @id @default(autoincrement())
  title       String
  artist      String
  coverArt    String?
  releaseDate DateTime?
  createdAt   DateTime @default(now())
  price       Int?
  currency    String   @default("aed")
  stripeProductId   String?
  stripePriceId     String?
  nominationWeek DateTime?
  
  tracks      Track[]
  sales       Sale[]
  likes       Like[]
}
```

### Playlist Model
```prisma
model Playlist {
  id                Int      @id @default(autoincrement())
  userId            Int?
  name              String
  description       String?
  coverArt          String?
  isPublic          Boolean  @default(true)
  price             Int?
  currency          String?   @default("aed")
  stripeProductId   String?
  stripePriceId     String?
  createdAt         DateTime @default(now())
  nominationWeek    DateTime?
  
  user              User?           @relation(fields: [userId], references: [id])
  tracks            Track[]
  sales             Sale[]
  likes             Like[]
}
```

## 🚀 Next Steps

1. **Create Supabase Storage Bucket:**
   ```bash
   # In Supabase Dashboard
   # Create bucket named "media"
   # Set to public
   ```

2. **Deploy Edge Function:**
   ```bash
   npx supabase functions deploy tracks-api
   ```

3. **Implement TrackFormDialog:**
   - Add file upload UI with drag-and-drop
   - Integrate with tracks-api/upload endpoint
   - Add all form fields with validation
   - Handle success/error states

4. **Create Albums & Playlists Edge Functions:**
   - Similar pattern to tracks-api
   - Handle CRUD operations
   - Integrate Stripe API for pricing

5. **Build Album & Playlist Managers:**
   - Create forms with all fields
   - Add track assignment UI
   - Implement pricing and Stripe integration
   - Add beautiful card grids

## 📚 Resources

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe API](https://stripe.com/docs/api)
- [Prisma Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
