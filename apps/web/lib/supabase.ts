import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
      );
    }

    client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

export async function getSession() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return { session: data.session, user: data.session?.user ?? null };
}
