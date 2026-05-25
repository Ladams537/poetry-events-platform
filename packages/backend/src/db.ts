import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export type Db = Database.Database;

export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type EventRow = {
  id: string;
  title: string;
  description: string;
  venue: string;
  starts_at: string;
  capacity: number | null;
  host_user_id: string;
  created_at: string;
  cancelled_at: string | null;
  host_name: string;
  host_email: string;
  host_created_at: string;
  attendee_count: number;
  current_user_rsvped?: 0 | 1;
};

export type AttendeeRow = {
  id: string;
  name: string;
  rsvped_at: string;
};

export function openDatabase(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      venue TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      capacity INTEGER,
      host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      cancelled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rsvps (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, event_id)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
    CREATE INDEX IF NOT EXISTS idx_events_host_user_id ON events(host_user_id);
    CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON rsvps(event_id);
    CREATE INDEX IF NOT EXISTS idx_rsvps_user_id ON rsvps(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  `);
}

export function resetDatabase(db: Db): void {
  db.exec(`
    DELETE FROM refresh_tokens;
    DELETE FROM rsvps;
    DELETE FROM events;
    DELETE FROM users;
  `);
}

export function newId(): string {
  return randomUUID();
}
