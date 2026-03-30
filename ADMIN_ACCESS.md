# Admin Access Guide

## ✅ Admin User Verified

The admin user **admin@radio.com** has been verified and has full admin privileges.

### Login Credentials

```
Email:    admin@radio.com
Username: admin
Password: admin123
```

## Admin Access Points

### Frontend Routes
- ✅ `/admin` - Admin Dashboard
- ✅ `/admin/*` - All admin sub-routes
- ✅ Protected by `ProtectedRoute` component
- ✅ Checks `user.isAdmin` flag

### Backend API Routes
All admin routes are protected by:
1. **Authentication Middleware** (`authenticateToken`) - Requires valid JWT token
2. **Admin Middleware** (`requireAdmin`) - Requires `isAdmin: true`

### Admin-Only API Endpoints

**Tracks:**
- `POST /api/tracks` - Create track
- `PUT /api/tracks/:id` - Update track
- `DELETE /api/tracks/:id` - Delete track

**Shows:**
- `POST /api/shows` - Create show
- `PUT /api/shows/:id` - Update show
- `DELETE /api/shows/:id` - Delete show

**Products:**
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

**Scheduled Shows:**
- `POST /api/scheduled-shows` - Create scheduled show
- `DELETE /api/scheduled-shows/:id` - Delete scheduled show

**News:**
- `POST /api/news` - Create news
- `PUT /api/news/:id` - Update news
- `DELETE /api/news/:id` - Delete news

**Hosts:**
- `POST /api/hosts` - Create host
- `PUT /api/hosts/:id` - Update host
- `DELETE /api/hosts/:id` - Delete host

**Locations:**
- `POST /api/locations` - Create location

## How Admin Access Works

### 1. Frontend Protection
```typescript
// In App.tsx
<ProtectedRoute path="/admin" component={AdminDashboard} requireAdmin={true} />

// Checks:
// - User is authenticated (has token)
// - user.isAdmin === true
// - Redirects to /login if not authenticated
// - Redirects to / if not admin
```

### 2. Backend Protection
```typescript
// In server/src/routes/api.ts
router.post('/tracks', requireAdmin, async (req, res) => {
  // Only admins can access this
});

// Middleware checks:
// - Valid JWT token
// - User exists in database
// - user.isAdmin === true
```

## Verify Admin Status

Run this command to verify admin user:
```bash
npm run db:verify-admin
```

## Grant Admin to Other Users

To grant admin privileges to another user, you can:

1. **Via Database:**
```sql
UPDATE users SET "isAdmin" = true WHERE email = 'user@example.com';
```

2. **Via Script:** (Create a new script similar to create-admin-user.ts)

3. **Via API:** (Would need to add an admin endpoint for this)

## Security Notes

- ✅ Admin routes require authentication (JWT token)
- ✅ Admin routes check `isAdmin` flag from database (not just token)
- ✅ Frontend and backend both verify admin status
- ✅ Non-admin users get 403 Forbidden on admin API endpoints
- ✅ Non-admin users are redirected from `/admin` routes

## Testing Admin Access

1. **Login as admin:**
   - Email: `admin@radio.com`
   - Password: `admin123`

2. **Access admin dashboard:**
   - Navigate to `/admin`
   - Should see admin dashboard

3. **Test API:**
   ```bash
   # Get token from login response
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@radio.com","password":"admin123"}'
   
   # Use token to access admin endpoint
   curl -X POST http://localhost:3001/api/tracks \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -d '{"title":"Test Track","artist":"Test Artist",...}'
   ```

