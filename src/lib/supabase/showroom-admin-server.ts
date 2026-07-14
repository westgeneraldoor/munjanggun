import 'server-only'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let showroomAdminClient: SupabaseClient<Database, 'showroom'> | null = null

// Server-only helper. Never import this from Client Components.
export function createShowroomAdminClient(): SupabaseClient<Database, 'showroom'> {
  if (!showroomAdminClient) {
    showroomAdminClient = createSupabaseClient<Database, 'showroom'>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: 'showroom' } },
    )
  }

  return showroomAdminClient
}
