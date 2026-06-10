import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { logInfo, logError } from "./logger";

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function createSupabaseClient(): SupabaseClient {
  if (!adminClient) {
    logInfo("Supabase", "Creating admin client", { url: env.SUPABASE_URL });
    adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  }
  return adminClient;
}

export function createAnonSupabaseClient(): SupabaseClient {
  if (!anonClient) {
    logInfo("Supabase", "Creating anon client", { url: env.SUPABASE_URL });
    anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }
  return anonClient;
}

export function destroySupabaseClient() {
  logInfo("Supabase", "Destroying admin client");
  adminClient = null;
  anonClient = null;
}
