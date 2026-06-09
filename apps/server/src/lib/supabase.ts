import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logInfo, logError } from "./logger";

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function createSupabaseClient(): SupabaseClient {
  if (!adminClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl) {
      throw new Error(
        "SUPABASE_URL is not configured in environment"
      );
    }
    if (!supabaseServiceKey) {
      throw new Error(
        "SUPABASE_SERVICE_KEY is not configured in environment"
      );
    }

    logInfo("Supabase", "Creating admin client", { url: supabaseUrl });
    adminClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return adminClient;
}

export function createAnonSupabaseClient(): SupabaseClient {
  if (!anonClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not configured in environment");
    }
    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY is not configured in environment");
    }

    logInfo("Supabase", "Creating anon client", { url: supabaseUrl });
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return anonClient;
}

export function destroySupabaseClient() {
  logInfo("Supabase", "Destroying admin client");
  adminClient = null;
  anonClient = null;
}
