# Login Credentials

## Admin Account

**Email:** `admin@radio.com`  
**Username:** `admin`  
**Password:** `admin123`

⚠️ **Important:** Please change the password after first login!

## Database

**Type:** PostgreSQL (Docker)  
**Host:** `localhost`  
**Port:** `5432`  
**Database:** `radio_db`  
**User:** `radio_user`  
**Password:** `radio_password`

## API Endpoints

**Base URL:** `http://localhost:3001/api`

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (requires auth token)
- `POST /api/auth/reset-password` - Request password reset
- `POST /api/auth/update-password` - Update password (requires auth token)

### Data Endpoints
- `GET /api/tracks` - Get all tracks
- `GET /api/products` - Get all products
- `GET /api/shows` - Get all shows
- `GET /api/radio-stations` - Get all radio stations
- And more... (see server/src/routes/api.ts)

## Verification: No Supabase

✅ **Backend:** 100% PostgreSQL via Prisma  
✅ **Database:** Docker PostgreSQL (no Supabase)  
✅ **Authentication:** JWT tokens (no Supabase Auth)  
✅ **API:** REST endpoints (no Supabase client)

All Supabase dependencies have been removed from the backend!

