import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env['VITE_SUPABASE_URL'] || "https://acifxltguiwkqygbghxf.supabase.co";
const supabasePublishableKey =
  import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
  "sb_publishable_b8oYNEkgwhNWI0atxu24Bg_9AszPIRF";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
