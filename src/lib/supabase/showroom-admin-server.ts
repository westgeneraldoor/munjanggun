import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let showroomAdminClient: ReturnType<typeof createSupabaseClient> | null = null

// Server-only helper. Never import this from Client Components.
export function createShowroomAdminClient() {
  if (!showroomAdminClient) {
    showroomAdminClient = createSupabaseClient<Database, 'showroom'>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: 'showroom' } },
    ) as unknown as ReturnType<typeof createSupabaseClient>
  }

  return showroomAdminClient
}
