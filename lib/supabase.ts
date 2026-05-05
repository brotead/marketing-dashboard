import { createClient } from '@supabase/supabase-js'

// Fallbacks prevent module-level throw at build time when env vars aren't set yet.
// At runtime in Netlify Functions the real values are always present.
const url = process.env.SUPABASE_URL ?? 'https://placeholder.supabase.co'
const key = process.env.SUPABASE_SERVICE_KEY ?? 'placeholder-service-key'

export const supabase = createClient(url, key)
