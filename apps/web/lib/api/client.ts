import { getSupabase } from "../supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

let refreshing: Promise<boolean> | null = null;

async function handleUnauthorized(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.refreshSession();
        return !!data.session;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const token = await getAccessToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
      credentials: "include",
      headers,
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeoutId);

    if (res.status === 401) {
      const refreshed = await handleUnauthorized();
      if (refreshed) {
        const newToken = await getAccessToken();
        if (newToken) {
          headers["Authorization"] = `Bearer ${newToken}`;
        }
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 10000);
        const retryRes = await fetch(`${API_URL}${endpoint}`, {
          credentials: "include",
          headers,
          signal: retryController.signal,
          ...options,
        });
        clearTimeout(retryTimeoutId);
        if (!retryRes.ok) {
          const body = await retryRes.json().catch(() => ({}));
          throw new ApiError(retryRes.status, body.error || `Request failed with status ${retryRes.status}`);
        }
        return retryRes.json() as Promise<T>;
      }
      window.location.href = "/login";
      throw new ApiError(401, "Session expired");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.error || `Request failed with status ${res.status}`);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(408, "Request timed out");
    }
    throw new ApiError(0, err instanceof Error ? err.message : "Network error");
  }
}

async function callApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await apiCall<ApiResponse<T>>(endpoint, options);
  if (!res.success) throw new ApiError(0, res.error || "Request failed");
  return res.data as T;
}

export function get<T>(endpoint: string) {
  return callApi<T>(endpoint, { method: "GET" });
}

export function post<T>(endpoint: string, body?: unknown) {
  return callApi<T>(endpoint, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function put<T>(endpoint: string, body?: unknown) {
  return callApi<T>(endpoint, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function patch<T>(endpoint: string, body?: unknown) {
  return callApi<T>(endpoint, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function del<T>(endpoint: string) {
  return callApi<T>(endpoint, { method: "DELETE" });
}
