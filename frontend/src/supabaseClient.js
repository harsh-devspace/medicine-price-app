import { createClient } from '@supabase/supabase-js';

// Supabase URL & Public Publishable Key for Frontend
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://sgsdtklsztjpqhrgrugb.supabase.co';

const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_l_xsU9XR5AQTbv7mfNsvtw_3_qqMeSY';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
