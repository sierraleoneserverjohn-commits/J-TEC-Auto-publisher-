import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfigStatus {
  configured: boolean;
  missingKeys: string[];
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missingKeys: string[] = [];
  if (!process.env.SUPABASE_URL) missingKeys.push('SUPABASE_URL');
  if (!process.env.SUPABASE_ANON_KEY) missingKeys.push('SUPABASE_ANON_KEY');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');

  return {
    configured: missingKeys.length === 0,
    missingKeys,
  };
}

let cachedClient: SupabaseClient | null = null;
let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedClient;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedAdminClient;
}

export async function verifyAuthToken(token: string) {
  const supabase = getSupabaseClient() || getSupabaseAdminClient();
  if (!supabase) {
    throw new Error('Supabase is not configured on the server');
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Invalid or expired authentication session');
  }

  return data.user;
}
