import { createClient } from '@supabase/supabase-js'

function parseArgs(argv) {
  const values = {}
  const booleanFlags = new Set(['apply', 'help'])
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
    const key = token.slice(2)
    if (booleanFlags.has(key)) {
      values[key] = true
      continue
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}.`)
    values[key] = value
    index += 1
  }
  for (const key of Object.keys(values)) {
    if (!['apply', 'help', 'post-id', 'actor-id', 'reason'].includes(key)) {
      throw new Error(`Unknown argument: --${key}.`)
    }
  }
  return values
}

function usage() {
  return `Usage:
  node --env-file=.env.local scripts/reconcile-blog-editor-save-lease.mjs \\
    --post-id <uuid> --actor-id <administrator-uuid> --reason <10-500 chars> [--apply]

Default mode is validation-only. --apply releases a lease at least 15 minutes old
through the audited service-role-only reconciliation RPC.`
}

function createServerClient(url, key, schema) {
  return createClient(url, key, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    return
  }
  for (const key of ['post-id', 'actor-id', 'reason']) {
    if (!String(args[key] || '').trim()) throw new Error(`--${key} is required.`)
  }
  const reason = args.reason.trim()
  if (reason.length < 10 || reason.length > 500) {
    throw new Error('--reason must be between 10 and 500 characters.')
  }
  if (!process.env.CODEX_AUDIT_ACTOR_ID || process.env.CODEX_AUDIT_ACTOR_ID !== args['actor-id']) {
    throw new Error('--actor-id must exactly match CODEX_AUDIT_ACTOR_ID.')
  }

  const plan = {
    mode: args.apply ? 'apply' : 'validate',
    postId: args['post-id'],
    actorId: args['actor-id'],
    reason,
    minimumLeaseAgeMinutes: 15,
  }
  if (!args.apply) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serverKey) {
    throw new Error('Supabase server URL and secret/service-role key are required.')
  }
  const platform = createServerClient(supabaseUrl, serverKey, 'platform')
  const showroom = createServerClient(supabaseUrl, serverKey, 'showroom')
  const { data: actor, error: actorError } = await platform
    .from('profiles')
    .select('id')
    .eq('id', args['actor-id'])
    .eq('role', 'administrator')
    .single()
  if (actorError || !actor) throw new Error('The supplied actor is not an administrator.')

  const { data, error } = await showroom.rpc('reconcile_blog_editor_save_lease', {
    p_post_id: args['post-id'],
    p_actor_id: args['actor-id'],
    p_reason: reason,
  })
  if (error) throw new Error(`Lease reconciliation failed: ${error.message}`)
  console.log(JSON.stringify({ ...plan, result: data }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
