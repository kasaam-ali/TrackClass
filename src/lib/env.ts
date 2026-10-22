const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const supabaseConfig = { url, anonKey }
export const hasSupabaseConfig = Boolean(url && anonKey)

export const missingConfigKeys = [
  !url ? 'VITE_SUPABASE_URL' : null,
  !anonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter((key): key is string => Boolean(key))
