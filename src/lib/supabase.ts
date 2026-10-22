import { createClient } from '@supabase/supabase-js'
import { hasSupabaseConfig, supabaseConfig } from './env'

export const supabase = hasSupabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
    })
  : null
