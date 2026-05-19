import { createClient } from '@supabase/supabase-js';

const getSupabaseConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return { url, key };
};

const config = getSupabaseConfig();
export const isSupabaseConfigured = !!(config.url && config.key && config.url !== 'https://placeholder.supabase.co');

if (!isSupabaseConfigured) {
  console.warn('Supabase credentials missing. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Secrets.');
}

// We wrap the client to handle potential initialization errors if URL is empty
export const supabase = createClient(
  config.url || 'https://placeholder.supabase.co', 
  config.key || 'placeholder'
);
