import type { AuthResponse, UserPublic } from "@poetry/shared";
import { writable, type Writable } from "svelte/store";
import { apiFetch } from "./client";

type AuthState = {
  accessToken: string | null;
  user: UserPublic | null;
  ready: boolean;
};

export const auth: Writable<AuthState> = writable({
  accessToken: null,
  user: null,
  ready: false
});

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function decodeJwtPayload(token: string): { exp?: number } | null {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/"))) as { exp?: number };
  } catch {
    return null;
  }
}

function scheduleRefresh(token: string): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  const exp = decodeJwtPayload(token)?.exp;
  const refreshInMs = exp ? Math.max(exp * 1_000 - Date.now() - 60_000, 5_000) : 10 * 60_000;
  refreshTimer = setTimeout(() => {
    void refresh();
  }, refreshInMs);
}

export function setAuth(response: AuthResponse): void {
  const next = { accessToken: response.accessToken, user: response.user, ready: true };
  auth.set(next);
  scheduleRefresh(response.accessToken);
}

export function clearAuth(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  const next = { accessToken: null, user: null, ready: true };
  auth.set(next);
}

export function loadStoredAuth(): void {
  if (typeof window === "undefined") {
    auth.set({ accessToken: null, user: null, ready: false });
  } else {
    void refresh();
  }
}

export async function refresh(): Promise<void> {
  try {
    const response = await apiFetch<AuthResponse>("/auth/refresh", { method: "POST" }, null);
    setAuth(response);
  } catch {
    clearAuth();
  }
}

export async function logout(accessToken: string | null): Promise<void> {
  try {
    await apiFetch<{ ok: true }>("/auth/logout", { method: "POST" }, accessToken);
  } finally {
    clearAuth();
  }
}
