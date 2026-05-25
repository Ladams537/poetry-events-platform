import {
  authLoginBodySchema,
  authRegisterBodySchema,
  eventCreateBodySchema,
  eventUpdateBodySchema,
  type Event,
  type EventCreateBody,
  type UserPublic
} from "@poetry/shared";
import bcrypt from "bcryptjs";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type { ZodError, ZodType } from "zod";
import {
  bearerToken,
  clearRefreshCookie,
  consumeRefreshToken,
  createAccessToken,
  createRefreshToken,
  readRefreshCookie,
  revokeRefreshToken,
  setRefreshCookie,
  verifyAccessToken
} from "./auth.js";
import { type AppConfig } from "./config.js";
import { type AttendeeRow, type Db, type EventRow, newId } from "./db.js";

type AppBindings = {
  Variables: {
    user: UserPublic;
  };
};

type CreateAppOptions = {
  db: Db;
  config: AppConfig;
};

type RecommendationRow = EventRow & {
  score: number;
  shared_event_count: number;
  adjacent_user_count: number;
};

function validationIssues(error: ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`);
}

async function readJson<T>(c: Context, schema: ZodType<T>): Promise<{ data: T } | { response: Response }> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { response: c.json({ error: "Expected JSON request body" }, 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { response: c.json({ error: "Validation failed", issues: validationIssues(parsed.error) }, 400) };
  }

  return { data: parsed.data };
}

function toPublicUser(row: { id: string; name: string; email: string; created_at: string }): UserPublic {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at
  };
}

function toEvent(row: EventRow): Event {
  const event: Event = {
    id: row.id,
    title: row.title,
    description: row.description,
    venue: row.venue,
    startsAt: row.starts_at,
    capacity: row.capacity,
    host: {
      id: row.host_user_id,
      name: row.host_name,
      email: row.host_email,
      createdAt: row.host_created_at
    },
    attendeeCount: row.attendee_count,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at
  };

  if (row.current_user_rsvped !== undefined) {
    event.currentUserRsvped = row.current_user_rsvped === 1;
  }

  return event;
}

function eventSelect(currentUserId: string | null): string {
  const rsvpSelect =
    currentUserId === null
      ? "0 AS current_user_rsvped"
      : "EXISTS(SELECT 1 FROM rsvps mine WHERE mine.event_id = events.id AND mine.user_id = @currentUserId) AS current_user_rsvped";

  return `
    events.id, events.title, events.description, events.venue, events.starts_at, events.capacity,
    events.host_user_id, events.created_at, events.cancelled_at,
    users.name AS host_name, users.email AS host_email, users.created_at AS host_created_at,
    COUNT(rsvps.user_id) AS attendee_count,
    ${rsvpSelect}
  `;
}

function findEvent(db: Db, id: string, currentUserId: string | null): EventRow | undefined {
  return db
    .prepare(
      `
      SELECT ${eventSelect(currentUserId)}
      FROM events
      JOIN users ON users.id = events.host_user_id
      LEFT JOIN rsvps ON rsvps.event_id = events.id
      WHERE events.id = @id
      GROUP BY events.id
    `
    )
    .get({ id, currentUserId }) as EventRow | undefined;
}

async function optionalUser(c: Context<AppBindings>, db: Db, secret: string): Promise<UserPublic | null> {
  const token = bearerToken(c);
  if (!token) {
    return null;
  }

  const tokenUser = await verifyAccessToken(token, secret);
  if (!tokenUser) {
    return null;
  }

  const row = db.prepare("SELECT id, name, email, created_at FROM users WHERE id = ?").get(tokenUser.id) as
    | { id: string; name: string; email: string; created_at: string }
    | undefined;

  return row ? toPublicUser(row) : null;
}

async function requireUser(c: Context<AppBindings>, db: Db, secret: string): Promise<{ user: UserPublic } | { response: Response }> {
  const user = await optionalUser(c, db, secret);
  if (!user) {
    return { response: c.json({ error: "Authentication required" }, 401) };
  }

  c.set("user", user);
  return { user };
}

function createEvent(db: Db, user: UserPublic, body: EventCreateBody): EventRow {
  const id = newId();
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO events (id, title, description, venue, starts_at, capacity, host_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(id, body.title, body.description, body.venue, body.startsAt, body.capacity ?? null, user.id, now);

  return findEvent(db, id, user.id) as EventRow;
}

export function createApp({ db, config }: CreateAppOptions): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  const secureCookies = config.nodeEnv === "production";

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) {
          return config.frontendOrigin;
        }
        if (config.nodeEnv !== "production" && origin.startsWith("http://localhost:")) {
          return origin;
        }
        return origin === config.frontendOrigin ? origin : null;
      },
      credentials: true,
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    })
  );

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/auth/register", async (c) => {
    const parsed = await readJson(c, authRegisterBodySchema);
    if ("response" in parsed) {
      return parsed.response;
    }

    const now = new Date().toISOString();
    const id = newId();
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    try {
      db.prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
        id,
        parsed.data.name,
        parsed.data.email,
        passwordHash,
        now
      );
    } catch {
      return c.json({ error: "Email is already registered" }, 409);
    }

    const user = { id, name: parsed.data.name, email: parsed.data.email, createdAt: now };
    const accessToken = await createAccessToken(user, config.jwtSecret);
    setRefreshCookie(c, createRefreshToken(db, user.id), secureCookies);

    return c.json({ accessToken, user }, 201);
  });

  app.post("/auth/login", async (c) => {
    const parsed = await readJson(c, authLoginBodySchema);
    if ("response" in parsed) {
      return parsed.response;
    }

    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(parsed.data.email) as
      | { id: string; name: string; email: string; password_hash: string; created_at: string }
      | undefined;
    if (!row || !(await bcrypt.compare(parsed.data.password, row.password_hash))) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const user = toPublicUser(row);
    const accessToken = await createAccessToken(user, config.jwtSecret);
    setRefreshCookie(c, createRefreshToken(db, user.id), secureCookies);

    return c.json({ accessToken, user });
  });

  app.post("/auth/refresh", async (c) => {
    const token = readRefreshCookie(c);
    if (!token) {
      return c.json({ error: "Refresh token missing" }, 401);
    }

    const row = consumeRefreshToken(db, token);
    if (!row) {
      clearRefreshCookie(c, secureCookies);
      return c.json({ error: "Refresh token invalid or expired" }, 401);
    }

    const user = toPublicUser(row);
    const accessToken = await createAccessToken(user, config.jwtSecret);
    setRefreshCookie(c, createRefreshToken(db, user.id), secureCookies);

    return c.json({ accessToken, user });
  });

  app.post("/auth/logout", (c) => {
    const token = readRefreshCookie(c);
    if (token) {
      revokeRefreshToken(db, token);
    }
    clearRefreshCookie(c, secureCookies);
    return c.json({ ok: true });
  });

  app.get("/me", async (c) => {
    const auth = await requireUser(c, db, config.jwtSecret);
    if ("response" in auth) {
      return auth.response;
    }
    return c.json({ user: auth.user });
  });

  app.get("/events", async (c) => {
    const user = await optionalUser(c, db, config.jwtSecret);
    const rows = db
      .prepare(
        `
        SELECT ${eventSelect(user?.id ?? null)}
        FROM events
        JOIN users ON users.id = events.host_user_id
        LEFT JOIN rsvps ON rsvps.event_id = events.id
        WHERE events.cancelled_at IS NULL AND events.starts_at >= @now
        GROUP BY events.id
        ORDER BY events.starts_at ASC
      `
      )
      .all({ now: new Date().toISOString(), currentUserId: user?.id ?? null }) as EventRow[];

    return c.json({ events: rows.map(toEvent) });
  });

  app.post("/events", async (c) => {
    const auth = await requireUser(c, db, config.jwtSecret);
    if ("response" in auth) {
      return auth.response;
    }

    const parsed = await readJson(c, eventCreateBodySchema);
    if ("response" in parsed) {
      return parsed.response;
    }

    const event = toEvent(createEvent(db, auth.user, parsed.data));
    return c.json({ event }, 201);
  });

  app.get("/events/:id", async (c) => {
    const user = await optionalUser(c, db, config.jwtSecret);
    const row = findEvent(db, c.req.param("id"), user?.id ?? null);
    if (!row) {
      return c.json({ error: "Event not found" }, 404);
    }

    const attendees = db
      .prepare(
        `
        SELECT users.id, users.name, rsvps.created_at AS rsvped_at
        FROM rsvps
        JOIN users ON users.id = rsvps.user_id
        WHERE rsvps.event_id = ?
        ORDER BY rsvps.created_at ASC
      `
      )
      .all(row.id) as AttendeeRow[];

    return c.json({
      event: {
        ...toEvent(row),
        attendees: attendees.map((attendee) => ({
          id: attendee.id,
          name: attendee.name,
          rsvpedAt: attendee.rsvped_at
        }))
      }
    });
  });

  app.patch("/events/:id", async (c) => {
    const auth = await requireUser(c, db, config.jwtSecret);
    if ("response" in auth) {
      return auth.response;
    }
    const parsed = await readJson(c, eventUpdateBodySchema);
    if ("response" in parsed) {
      return parsed.response;
    }

    const event = findEvent(db, c.req.param("id"), auth.user.id);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }
    if (event.host_user_id !== auth.user.id) {
      return c.json({ error: "Only the host can edit this event" }, 403);
    }

    const next = {
      title: parsed.data.title ?? event.title,
      description: parsed.data.description ?? event.description,
      venue: parsed.data.venue ?? event.venue,
      startsAt: parsed.data.startsAt ?? event.starts_at,
      capacity: parsed.data.capacity ?? event.capacity
    };

    db.prepare(
      `
      UPDATE events
      SET title = ?, description = ?, venue = ?, starts_at = ?, capacity = ?
      WHERE id = ?
    `
    ).run(next.title, next.description, next.venue, next.startsAt, next.capacity, event.id);

    return c.json({ event: toEvent(findEvent(db, event.id, auth.user.id) as EventRow) });
  });

  app.delete("/events/:id", async (c) => {
    const auth = await requireUser(c, db, config.jwtSecret);
    if ("response" in auth) {
      return auth.response;
    }
    const event = findEvent(db, c.req.param("id"), auth.user.id);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }
    if (event.host_user_id !== auth.user.id) {
      return c.json({ error: "Only the host can cancel this event" }, 403);
    }

    db.prepare("UPDATE events SET cancelled_at = ? WHERE id = ?").run(new Date().toISOString(), event.id);
    return c.json({ event: toEvent(findEvent(db, event.id, auth.user.id) as EventRow) });
  });

  app.post("/events/:id/rsvp", async (c) => {
    const auth = await requireUser(c, db, config.jwtSecret);
    if ("response" in auth) {
      return auth.response;
    }
    const event = findEvent(db, c.req.param("id"), auth.user.id);
    if (!event || event.cancelled_at) {
      return c.json({ error: "Event not found" }, 404);
    }
    if (event.capacity !== null && event.attendee_count >= event.capacity && event.current_user_rsvped !== 1) {
      return c.json({ error: "Event is at capacity" }, 409);
    }

    db.prepare("INSERT OR IGNORE INTO rsvps (user_id, event_id, created_at) VALUES (?, ?, ?)").run(
      auth.user.id,
      event.id,
      new Date().toISOString()
    );

    return c.json({ event: toEvent(findEvent(db, event.id, auth.user.id) as EventRow) });
  });

  app.delete("/events/:id/rsvp", async (c) => {
    const auth = await requireUser(c, db, config.jwtSecret);
    if ("response" in auth) {
      return auth.response;
    }
    db.prepare("DELETE FROM rsvps WHERE user_id = ? AND event_id = ?").run(auth.user.id, c.req.param("id"));
    const event = findEvent(db, c.req.param("id"), auth.user.id);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }
    return c.json({ event: toEvent(event) });
  });

  app.get("/dashboard/events", async (c) => {
    const auth = await requireUser(c, db, config.jwtSecret);
    if ("response" in auth) {
      return auth.response;
    }

    const rows = db
      .prepare(
        `
        SELECT ${eventSelect(auth.user.id)}
        FROM events
        JOIN users ON users.id = events.host_user_id
        LEFT JOIN rsvps ON rsvps.event_id = events.id
        WHERE events.host_user_id = @hostUserId
        GROUP BY events.id
        ORDER BY events.starts_at ASC
      `
      )
      .all({ hostUserId: auth.user.id, currentUserId: auth.user.id }) as EventRow[];

    return c.json({ events: rows.map(toEvent) });
  });

  app.get("/recommendations", async (c) => {
    const auth = await requireUser(c, db, config.jwtSecret);
    if ("response" in auth) {
      return auth.response;
    }

    const rows = db
      .prepare(
        `
        WITH my_events AS (
          SELECT event_id FROM rsvps WHERE user_id = @userId
        ),
        adjacent_users AS (
          SELECT r2.user_id, COUNT(*) AS shared_count
          FROM my_events
          JOIN rsvps r2 ON r2.event_id = my_events.event_id
          WHERE r2.user_id != @userId
          GROUP BY r2.user_id
        ),
        candidate_scores AS (
          SELECT r.event_id,
                 SUM(adjacent_users.shared_count) AS score,
                 MAX(adjacent_users.shared_count) AS shared_event_count,
                 COUNT(DISTINCT adjacent_users.user_id) AS adjacent_user_count
          FROM adjacent_users
          JOIN rsvps r ON r.user_id = adjacent_users.user_id
          LEFT JOIN my_events ON my_events.event_id = r.event_id
          WHERE my_events.event_id IS NULL
          GROUP BY r.event_id
        )
        SELECT ${eventSelect(auth.user.id)},
               candidate_scores.score,
               candidate_scores.shared_event_count,
               candidate_scores.adjacent_user_count
        FROM candidate_scores
        JOIN events ON events.id = candidate_scores.event_id
        JOIN users ON users.id = events.host_user_id
        LEFT JOIN rsvps ON rsvps.event_id = events.id
        WHERE events.cancelled_at IS NULL AND events.starts_at >= @now
        GROUP BY events.id
        ORDER BY candidate_scores.score DESC, events.starts_at ASC
        LIMIT 20
      `
      )
      .all({ userId: auth.user.id, currentUserId: auth.user.id, now: new Date().toISOString() }) as RecommendationRow[];

    return c.json({
      algorithm: "weighted-co-attendance",
      recommendations: rows.map((row) => ({
        event: toEvent(row),
        score: row.score,
        sharedEventCount: row.shared_event_count,
        adjacentUserCount: row.adjacent_user_count
      }))
    });
  });

  return app;
}
