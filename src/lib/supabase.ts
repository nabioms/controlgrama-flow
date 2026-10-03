import { createClient } from "@supabase/supabase-js";

// ControlGrama sempre usa o projeto Supabase oficial do aplicativo.
// Não deixar variáveis VITE_SUPABASE_* do ambiente de build do APK substituírem
// o projeto correto, pois isso pode gerar um APK que abre normalmente, mas fica
// sem os dados reais de trabalhadores/diárias.
const SUPABASE_URL = "https://acifxltguiwkqygbghxf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_b8oYNEkgwhNWI0atxu24Bg_9AszPIRF";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "controlgrama-auth",
  },
});
