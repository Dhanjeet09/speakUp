const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { createBrowserClient } = await import("@supabase/ssr");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return null;
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const token = await getAccessToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_URL}${endpoint}`;
    const res = await fetch(url, {
      credentials: "include",
      headers,
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeoutId);

    const json = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: json.error || `Request failed with status ${res.status}`,
      };
    }

    return json as ApiResponse<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, error: "Request timed out" };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function get<T>(endpoint: string) {
  return request<T>(endpoint, { method: "GET" });
}

export function post<T>(endpoint: string, body?: unknown) {
  return request<T>(endpoint, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function put<T>(endpoint: string, body?: unknown) {
  return request<T>(endpoint, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}
