# Frontend Migration Patterns

This document shows how to update remaining frontend components from Supabase to the new API.

## Pattern 1: Authentication

### Before (Supabase):
```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

### After (API):
```typescript
import { authApi } from '@/lib/api-client';

const data = await authApi.signIn(email, password);
```

## Pattern 2: Database Queries

### Before (Supabase):
```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('tracks')
  .select('*')
  .eq('isActive', true);
```

### After (API):
```typescript
import { api } from '@/lib/api-client';

const data = await api.get('/tracks');
```

## Pattern 3: Creating Records

### Before (Supabase):
```typescript
const { data, error } = await supabase
  .from('products')
  .insert({ name, price, ... })
  .select()
  .single();
```

### After (API):
```typescript
const data = await api.post('/products', { name, price, ... });
```

## Pattern 4: Updating Records

### Before (Supabase):
```typescript
const { data, error } = await supabase
  .from('tracks')
  .update({ title: 'New Title' })
  .eq('id', trackId)
  .select()
  .single();
```

### After (API):
```typescript
const data = await api.put(`/tracks/${trackId}`, { title: 'New Title' });
```

## Pattern 5: Deleting Records

### Before (Supabase):
```typescript
const { error } = await supabase
  .from('tracks')
  .delete()
  .eq('id', trackId);
```

### After (API):
```typescript
await api.delete(`/tracks/${trackId}`);
```

## Pattern 6: Complex Queries

### Before (Supabase):
```typescript
const { data } = await supabase
  .from('scheduled_shows')
  .select(`
    *,
    show:shows (
      *,
      host:hosts(*),
      show_items (*)
    )
  `)
  .eq('radioStationId', stationId)
  .lte('startTime', now)
  .gte('endTime', now);
```

### After (API):
```typescript
const data = await api.get(`/scheduled-shows?stationId=${stationId}&startTime=${startTime}&endTime=${endTime}`);
```

The backend handles the joins and returns the full nested structure.

## Pattern 7: Storage Operations

For file uploads, you'll need to add file upload endpoints to the backend. For now, you can:

1. Upload files directly to your storage (Cloudflare R2, S3, etc.)
2. Get the URL
3. Save the URL in the database via API

Or add a file upload endpoint to `server/src/routes/api.ts`:

```typescript
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
  // Handle file upload
  // Upload to storage
  // Return URL
});
```

## Files That Still Need Updates

Based on the codebase search, these files still reference Supabase:

1. `client/src/pages/ResetPassword.tsx` - Already uses authApi, but may have Supabase references
2. `client/src/components/ui/SignInDialog.tsx` - Needs update
3. `client/src/pages/store/index.tsx` - Needs update
4. `client/src/pages/store/ProductPage.tsx` - Needs update
5. `client/src/pages/home/index.tsx` - Needs update
6. `client/src/pages/home/components/*.tsx` - Multiple files need updates
7. `client/src/pages/podcasts/components/*.tsx` - Multiple files need updates
8. `client/src/pages/admin/**/*.tsx` - Many admin files need updates

## Quick Update Script Pattern

For each file:
1. Remove: `import { supabase } from '@/lib/supabase';`
2. Add: `import { api } from '@/lib/api-client';`
3. Replace Supabase queries with API calls
4. Update error handling (API throws errors, no `error` object)

## Testing

After updating each component:
1. Test authentication flow
2. Test data fetching
3. Test CRUD operations
4. Check browser console for errors

