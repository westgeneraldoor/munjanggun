import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Note: This client uses the SERVICE ROLE KEY. 
// It bypasses RLS and should ONLY be used in secure server environments.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'showroom' }
    }
  )
}
