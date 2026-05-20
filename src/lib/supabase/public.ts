import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export function createPublicShowroomClient() {
  return createSupabaseClient<Database, 'showroom'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
