require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.warn(
    '⚠️ Warning: SUPABASE_URL or SUPABASE_SECRET_KEY is missing from environment variables.'
  );
}

// Server-side Supabase client with elevated secret key capabilities for auth verification & admin tasks
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseSecretKey || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

module.exports = { supabase, supabaseUrl, supabaseSecretKey };
