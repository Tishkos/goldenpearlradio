/**
 * ⚠️ DEPRECATED: This file has been removed.
 * 
 * Please update your imports to use the new API client:
 * 
 * OLD: import { supabase } from '@/lib/supabase';
 * NEW: import { api } from '@/lib/api-client';
 * 
 * For authentication:
 * NEW: import { authApi } from '@/lib/api-client';
 * 
 * Migration guide: See MIGRATION_GUIDE.md
 */

// Temporary stub that throws errors when used
export const supabase = {
  from: () => {
    throw new Error('Supabase has been removed. Use api.get() from "@/lib/api-client" instead.');
  },
  auth: {
    getSession: () => {
      throw new Error('Supabase auth has been removed. Use authApi from "@/lib/api-client" instead.');
    },
    signInWithPassword: () => {
      throw new Error('Supabase auth has been removed. Use authApi.signIn() from "@/lib/api-client" instead.');
    },
  },
} as any;

