import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export function createClient(): SupabaseClient<Database, "colorbook"> {
  return createBrowserClient<Database, "colorbook">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'colorbook' }
    }
  )
}

export function createShowroomClient() {
  return createBrowserClient<Database, "showroom">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'showroom' }
    }
  )
}
