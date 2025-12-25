// =============================================================================
// SUPABASE CLIENT CONFIGURATION
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
    return !!(supabaseUrl && supabaseAnonKey);
};

// Create Supabase client - ALWAYS non-null for TypeScript
// If env vars are missing, we create a dummy client that will fail at runtime
// but allows TypeScript to compile
let supabaseInstance: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    });
} else {
    console.warn('⚠️ Supabase credentials not found. Running in demo mode.');
    // Create a placeholder client with dummy values (will fail at runtime if used)
    supabaseInstance = createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// Export as non-null SupabaseClient
export const supabase: SupabaseClient = supabaseInstance;
