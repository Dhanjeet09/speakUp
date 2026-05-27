import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logInfo, logError } from "./logger";

let client: SupabaseClient | null = null;

export function createSupabaseClient(): SupabaseClient {
  if (!client) {
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
    client = createClient(supabaseUrl, supabaseServiceKey);
  }
  return client;
}

export function destroySupabaseClient() {
  logInfo("Supabase", "Destroying admin client");
  client = null;
}
