const SHOWROOM_STORAGE_HOST = 'cebafroyvmllbyivevjd.supabase.co'
const SHOWROOM_STORAGE_PATH_PREFIX = '/storage/v1/object/public/'

export function shouldBypassNextImageOptimization(src?: string | null) {
  if (!src) return false

  try {
    const url = new URL(src)
    return url.hostname === SHOWROOM_STORAGE_HOST && url.pathname.startsWith(SHOWROOM_STORAGE_PATH_PREFIX)
  } catch {
    return false
  }
}
