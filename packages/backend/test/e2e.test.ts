import { serve, type ServerType } from "@hono/node-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { openDatabase, resetDatabase } from "../src/db.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AuthResponse, EventResponse, RecommendationsResponse } from "@poetry/shared";

type ClientSession = {
  accessToken: string;
  cookie: string;
};

let server: ServerType;
let baseUrl: string;

async function request<T>(
  path: string,
  options: RequestInit & { session?: ClientSession } = {}
): Promise<{ body: T; headers: Headers; status: number }> {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (options.session) {
    headers.set("authorization", `Bearer ${options.session.accessToken}`);
    headers.set("cookie", options.session.cookie);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });
  const body = (await response.json()) as T;

  return { body, headers: response.headers, status: response.status };
}

function cookieFrom(headers: Headers): string {
  const setCookie = headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Expected refresh cookie");
  }
  return setCookie.split(";")[0] ?? setCookie;
}

async function register(name: string, email: string): Promise<ClientSession> {
  const { body, headers, status } = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password: "correct-horse-battery-staple"
    })
  });
  expect(status).toBe(201);
  return { accessToken: body.accessToken, cookie: cookieFrom(headers) };
}

async function createEvent(session: ClientSession, title: string, daysFromNow: number): Promise<string> {
  const startsAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1_000).toISOString();
  const { body, status } = await request<EventResponse>("/events", {
    method: "POST",
    session,
    body: JSON.stringify({
      title,
      description: `${title} with new poems, readings, and conversation.`,
      venue: "The Small Press Room",
      startsAt,
      capacity: 80
    })
  });
  expect(status).toBe(201);
  return body.event.id;
}

beforeAll(async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "poetry-e2e-")), "test.db");
  const db = openDatabase(dbPath);
  resetDatabase(db);
  const app = createApp({
    db,
    config: readConfig({
      databasePath: dbPath,
      jwtSecret: "test-secret-test-secret-test-secret-test-secret",
      frontendOrigin: "http://localhost:5173",
      nodeEnv: "production"
    })
  });

  server = serve({ fetch: app.fetch, port: 0 });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Could not resolve test server address");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
});

test("registers, logs in, creates events, RSVPs, and recommends adjacent-user events", async () => {
  const alice = await register("Alice Verse", "alice@example.com");
  const bob = await register("Bob Stanza", "bob@example.com");

  const sharedEventId = await createEvent(alice, "Shared Open Mic", 7);
  const recommendedEventId = await createEvent(bob, "Bob's Line Break Salon", 14);

  expect(
    (
      await request<EventResponse>(`/events/${sharedEventId}/rsvp`, {
        method: "POST",
        session: alice,
        body: "{}"
      })
    ).status
  ).toBe(200);
  expect(
    (
      await request<EventResponse>(`/events/${sharedEventId}/rsvp`, {
        method: "POST",
        session: bob,
        body: "{}"
      })
    ).status
  ).toBe(200);
  expect(
    (
      await request<EventResponse>(`/events/${recommendedEventId}/rsvp`, {
        method: "POST",
        session: bob,
        body: "{}"
      })
    ).status
  ).toBe(200);

  const recommendations = await request<RecommendationsResponse>("/recommendations", {
    method: "GET",
    session: alice
  });

  expect(recommendations.status).toBe(200);
  expect(recommendations.body.algorithm).toBe("weighted-co-attendance");
  expect(recommendations.body.recommendations[0]?.event.id).toBe(recommendedEventId);
  expect(recommendations.body.recommendations[0]?.score).toBeGreaterThan(0);
});

test("sets production-safe refresh cookies and rotates them on use", async () => {
  const original = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "Refresh Reader",
      email: "refresh@example.com",
      password: "correct-horse-battery-staple"
    })
  });
  expect(original.status).toBe(201);

  const originalSetCookie = original.headers.get("set-cookie") ?? "";
  expect(originalSetCookie).toContain("HttpOnly");
  expect(originalSetCookie).toContain("Secure");
  expect(originalSetCookie).toContain("SameSite=None");

  const firstCookie = cookieFrom(original.headers);
  const refreshed = await request<AuthResponse>("/auth/refresh", {
    method: "POST",
    headers: { cookie: firstCookie }
  });

  expect(refreshed.status).toBe(200);
  expect(refreshed.body.accessToken).not.toBe(original.body.accessToken);

  const rotatedCookie = cookieFrom(refreshed.headers);
  expect(rotatedCookie).not.toBe(firstCookie);

  const replay = await request<{ error: string }>("/auth/refresh", {
    method: "POST",
    headers: { cookie: firstCookie }
  });
  expect(replay.status).toBe(401);

  const me = await request<{ user: { email: string } }>("/me", {
    method: "GET",
    session: {
      accessToken: refreshed.body.accessToken,
      cookie: rotatedCookie
    }
  });
  expect(me.status).toBe(200);
  expect(me.body.user.email).toBe("refresh@example.com");
});
