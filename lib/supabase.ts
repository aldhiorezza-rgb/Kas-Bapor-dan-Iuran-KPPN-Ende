import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lkxlhsbsktpsnhljodvz.supabase.co';

// Dummy valid JWT format agar validator createClient tidak melempar exception saat build time
const fallbackKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ae751POo9-W6b_jL2n164n79i0000000000000000';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);