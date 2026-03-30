# Migration from Supabase to PostgreSQL + Docker

This guide explains the migration from Supabase to a PostgreSQL database running in Docker with a separated backend API.

## Architecture Changes

- **Before**: Frontend directly connected to Supabase
- **After**: Frontend → Backend API → PostgreSQL (Docker)

## Setup Instructions

### 1. Start PostgreSQL with Docker

```bash
docker-compose up -d
```

This will start PostgreSQL on port 5432 with:
- Database: `radio_db`
- User: `radio_user`
- Password: `radio_password`

### 2. Set up Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://radio_user:radio_password@localhost:5432/radio_db?schema=public"
DIRECT_URL="postgresql://radio_user:radio_password@localhost:5432/radio_db?schema=public"

# Server
PORT=3001
CORS_ORIGIN=*

# JWT Secret for authentication
JWT_SECRET=your-secret-key-change-this-in-production

# Node Environment
NODE_ENV=development

# Frontend API URL (for client)
VITE_API_URL=http://localhost:3001/api
```

### 3. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations
npm run db:migrate
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

**Development (both frontend and backend):**
```bash
npm run dev:all
```

**Or separately:**
```bash
# Backend only
npm run dev:server

# Frontend only (in another terminal)
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Sign up
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user
- `POST /api/auth/reset-password` - Request password reset
- `POST /api/auth/update-password` - Update password

### Data Endpoints
- `GET /api/tracks` - Get all tracks
- `GET /api/tracks/:id` - Get single track
- `POST /api/tracks` - Create track (admin)
- `PUT /api/tracks/:id` - Update track (admin)
- `DELETE /api/tracks/:id` - Delete track (admin)

Similar endpoints exist for:
- `/api/shows`
- `/api/products`
- `/api/radio-stations`
- `/api/scheduled-shows`
- `/api/news`
- `/api/hosts`
- `/api/locations`

### Streaming
- `GET /stream?station={stationId}` - Audio stream endpoint

## Frontend Changes

The frontend now uses:
- `client/src/lib/api-client.ts` - API client with authentication
- `client/src/contexts/AuthContext.tsx` - Updated to use new API

All Supabase imports have been replaced with API calls.

## Next Steps

1. **Update remaining components**: Some components may still reference Supabase directly. Update them to use the `api` client from `@/lib/api-client`.

2. **Add more API endpoints**: As needed, add more endpoints in `server/src/routes/api.ts`.

3. **Production setup**: 
   - Change JWT_SECRET to a secure random string
   - Update CORS_ORIGIN to your production domain
   - Use environment-specific database URLs

## Flutter Integration

The backend API is now ready for Flutter integration. All endpoints are RESTful and use JWT authentication. The Flutter app can:
- Use the same authentication endpoints
- Call all data endpoints with JWT tokens
- Connect to the streaming endpoint for audio playback

