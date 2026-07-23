// Google-вхід через Supabase Auth (D-036/D-041).
// Вмикається автоматично, щойно на Vercel зʼявиться NEXT_PUBLIC_SUPABASE_ANON_KEY
// (публічний ключ) і в Supabase увімкнено провайдера Google.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const GOOGLE_AUTH_ENABLED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Браузерний клієнт (anon key — публічний, RLS все одно закритий). */
export function supaBrowser(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

/** Старт входу через Google; повернемось на redirectTo з сесією в URL. */
export function signInWithGoogle(redirectTo: string) {
  return supaBrowser().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
}
