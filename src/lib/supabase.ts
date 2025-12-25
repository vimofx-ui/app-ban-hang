// =============================================================================
// SUPABASE CLIENT CONFIGURATION
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '⚠️ Supabase credentials not found. Running in demo mode with mock data.'
    );
}

// Create Supabase client (or null if not configured)
// Using 'any' for database schema to simplify typing until full schema is generated
export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    })
    : null;

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
    return supabase !== null;
};
