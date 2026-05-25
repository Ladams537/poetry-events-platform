import { env } from "$env/dynamic/public";
import type {
  AuthLoginBody,
  AuthRegisterBody,
  AuthResponse,
  EventCreateBody,
  EventResponse,
  EventsListResponse,
  RecommendationsResponse
} from "@poetry/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, accessToken: string | null): Promise<T> {
  const apiBaseUrl = env.PUBLIC_API_BASE_URL ?? "http://localhost:8787";
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const error = body as { error?: string };
    throw new ApiError(error.error ?? "Request failed", response.status);
  }

  return body as T;
}

export function listEvents(accessToken: string | null): Promise<EventsListResponse> {
  return apiFetch<EventsListResponse>("/events", {}, accessToken);
}

export function getEvent(id: string, accessToken: string | null): Promise<EventResponse> {
  return apiFetch<EventResponse>(`/events/${id}`, {}, accessToken);
}

export function createEvent(body: EventCreateBody, accessToken: string | null): Promise<EventResponse> {
  return apiFetch<EventResponse>("/events", { method: "POST", body: JSON.stringify(body) }, accessToken);
}

export function rsvpEvent(id: string, accessToken: string | null): Promise<EventResponse> {
  return apiFetch<EventResponse>(`/events/${id}/rsvp`, { method: "POST", body: "{}" }, accessToken);
}

export function cancelRsvp(id: string, accessToken: string | null): Promise<EventResponse> {
  return apiFetch<EventResponse>(`/events/${id}/rsvp`, { method: "DELETE" }, accessToken);
}

export function recommendations(accessToken: string | null): Promise<RecommendationsResponse> {
  return apiFetch<RecommendationsResponse>("/recommendations", {}, accessToken);
}

export function hostedEvents(accessToken: string | null): Promise<EventsListResponse> {
  return apiFetch<EventsListResponse>("/dashboard/events", {}, accessToken);
}

export function login(body: AuthLoginBody): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }, null);
}

export function register(body: AuthRegisterBody): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }, null);
}
