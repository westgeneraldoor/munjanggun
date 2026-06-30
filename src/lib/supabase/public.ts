import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export function hasPublicShowroomEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function createPublicShowroomClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Public Supabase environment variables are required.')
  }

  return createSupabaseClient<Database, 'showroom'>(
    supabaseUrl,
    supabaseAnonKey,
    {
      db: { schema: 'showroom' },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
