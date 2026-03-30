# Golden Pearl Radio Dubai

## Overview

Golden Pearl Radio Dubai is an AI-powered online radio platform that delivers a culturally-rich music experience for Dubai. The platform combines automated content curation, real-time streaming, and comprehensive admin management tools. It features a public-facing radio interface with live streaming, podcast archives, a shopping integration, and an interactive Dubai guide. The admin system provides complete control over music libraries, program scheduling, content management, and AI-assisted playlist generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React 18 + TypeScript + Vite with Shadcn/UI components and Tailwind CSS

The frontend is organized into three main areas:

1. **Public Pages** - User-facing content delivery
   - Live radio streaming with real-time track information
   - Podcast and show archives
   - Product store with affiliate tracking
   - Interactive Dubai guide with hotspot mapping
   - Pitch/partnership submission forms

2. **Admin Dashboard** - Comprehensive management interface
   - Music Manager: Upload and tag audio files with AI-assisted metadata
   - Content Manager: Shows, episodes, and podcast planning
   - Program Scheduler: Visual weekly planning with block-based scheduling
   - Breaking News: Real-time message injection with TTS
   - DJ Panel: Long-form mix upload and scheduling
   - Speakers: Voice management and TTS integration
   - Weekly Albums: Featured content curation

3. **Audio Engine** - Built on Howler.js
   - Multi-format support (MP3, WAV, OGG)
   - Advanced error handling and retry logic
   - Crossfade and transition capabilities
   - Volume and playback controls

**Design Pattern**: Component-based architecture with shared UI components from Shadcn/UI. State management uses React Query for server state and local React hooks for UI state.

### Backend Architecture

**Technology Stack**: Node.js + Express.js + TypeScript

The backend follows a RESTful API design with 45+ routes organized by resource:

1. **API Layer**
   - Authentication & session management using express-session
   - File upload processing with Multer (memory storage)
   - RESTful endpoints for all data operations
   - AI integration services (OpenAI GPT-4)

2. **Business Logic**
   - AI-powered music tagging and classification
   - Auto-DJ playlist generation with mood/tempo compatibility scoring
   - Smart scheduling algorithms for program blocks
   - Content recommendation engine

3. **File Processing**
   - Audio file upload to Cloudflare R2
   - Metadata extraction and AI analysis
   - Signed URL generation for secure access
   - Multi-format support with validation

**Design Pattern**: Layered architecture separating routes, storage layer, and business logic. Services are modular and can be extended independently.

### Data Layer

**Database**: PostgreSQL with Drizzle ORM

**Schema Design**:
- **Content Tables**: tracks, shows, episodes, playlists
- **Scheduling Tables**: scheduleItems, programBlocks, programFormats
- **Management Tables**: moderators, speakers, events, weeklyAlbums
- **Commerce Tables**: products, locations, dubaiHotspots
- **System Tables**: users, aiSuggestions, partnerAgreements

**Storage Strategy**:
- Structured metadata stored in PostgreSQL
- Audio files and media stored in Cloudflare R2
- Session data managed via connect-pg-simple

**Key Design Decisions**:
- JSONB fields for flexible AI-generated tags and metadata
- Separate playlist-track relationship for ordering flexibility
- Time-based scheduling using day-of-week and hour fields
- Impression/click tracking for analytics

### AI Integration Architecture

**Service**: OpenAI GPT-4 integration

**Use Cases**:
1. **Dialog Generation** - Creates contextual moderator dialogue for events
2. **Music Tagging** - Auto-classifies tracks with mood, energy, time-of-day fit
3. **Format Planning** - Suggests intro/outro ideas for shows
4. **Content Recommendations** - AI-powered playlist optimization

**Implementation Pattern**: Service layer functions that construct prompts, manage API calls, and parse structured responses. Results cached in database to minimize API costs.

## External Dependencies

### Cloud Storage
- **Cloudflare R2**: Primary audio and media storage
  - S3-compatible API via AWS SDK
  - Signed URL generation for secure streaming
  - Public bucket access for audio playback
  - Account-scoped endpoint configuration

### AI Services
- **OpenAI API**: GPT-4 for content generation and analysis
  - Dialog suggestion generation
  - Music classification and tagging
  - Format planning assistance
  - Temperature-controlled outputs for creativity vs consistency

### Audio Processing
- **Howler.js**: Client-side audio engine
  - Cross-browser compatibility
  - Format detection and fallback
  - Advanced playback controls
  - Error recovery mechanisms

### UI Framework
- **Shadcn/UI + Radix UI**: Component library
  - Accessible components
  - Customizable with Tailwind CSS
  - Dialog, form, and layout primitives

### Data Management
- **@tanstack/react-query**: Server state management
  - Automatic caching and refetching
  - Optimistic updates
  - Background synchronization

### Potential Integrations
- **Apple Music API**: Music discovery (mentioned in specs, not fully implemented)
- **TTS Services**: Text-to-speech for breaking news (planned feature)
- **Affiliate Networks**: Product tracking and conversion (infrastructure present)