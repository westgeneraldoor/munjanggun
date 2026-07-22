import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { SupabaseClient, createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export async function createPlatformClient(): Promise<SupabaseClient<Database, "platform">> {
  const cookieStore = await cookies()

  return createServerClient<Database, "platform">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'platform' },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Service Role Client to bypass RLS in secure server environments
export function createPlatformAdminClient(): SupabaseClient<Database, "platform"> {
  return createSupabaseClient<Database, "platform">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'platform' }
    }
  )
}
