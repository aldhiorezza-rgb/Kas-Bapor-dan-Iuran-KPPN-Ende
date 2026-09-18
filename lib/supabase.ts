import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lkxlhsbsktpsnhljodvz.supabase.co';

const fallbackKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae751POo9-W6b_jL2n164n79i0000000000000000';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackKey;

let client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
};

// Proxy agar sintaks import supabase tetap kompatibel tanpa mengubah banyak baris
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop: keyof SupabaseClient) => {
    const instance = getSupabase();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});