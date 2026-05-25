import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Db, UserRow } from "./db.js";
import { newId } from "./db.js";

const refreshCookieName = "poetry_refresh";
const accessTokenTtlSeconds = 15 * 60;
const refreshTokenTtlSeconds = 30 * 24 * 60 * 60;

export type TokenUser = {
  id: string;
  email: string;
  name: string;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function jwtSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createAccessToken(user: TokenUser, secret: string): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${accessTokenTtlSeconds}s`)
    .sign(jwtSecretKey(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<TokenUser | null> {
  try {
    const verified = await jwtVerify(token, jwtSecretKey(secret));
    const email = verified.payload.email;
    const name = verified.payload.name;

    if (typeof verified.payload.sub !== "string" || typeof email !== "string" || typeof name !== "string") {
      return null;
    }

    return { id: verified.payload.sub, email, name };
  } catch {
    return null;
  }
}

export function createRefreshToken(db: Db, userId: string): string {
  const token = randomBytes(48).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + refreshTokenTtlSeconds * 1_000);

  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(newId(), userId, hashToken(token), expiresAt.toISOString(), now.toISOString());

  return token;
}

export function setRefreshCookie(c: Context, token: string, secure: boolean): void {
  setCookie(c, refreshCookieName, token, {
    httpOnly: true,
    secure,
    sameSite: secure ? "None" : "Lax",
    path: "/",
    maxAge: refreshTokenTtlSeconds
  });
}

export function clearRefreshCookie(c: Context, secure: boolean): void {
  deleteCookie(c, refreshCookieName, {
    secure,
    sameSite: secure ? "None" : "Lax",
    path: "/"
  });
}

export function readRefreshCookie(c: Context): string | undefined {
  return getCookie(c, refreshCookieName);
}

export function bearerToken(c: Context): string | null {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
}

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  name: string;
  email: string;
  created_at: string;
  password_hash: string;
};

export function consumeRefreshToken(db: Db, token: string): UserRow | null {
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `
      SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.expires_at, refresh_tokens.revoked_at,
             users.name, users.email, users.created_at, users.password_hash
      FROM refresh_tokens
      JOIN users ON users.id = refresh_tokens.user_id
      WHERE refresh_tokens.token_hash = ?
    `
    )
    .get(tokenHash) as RefreshTokenRow | undefined;

  if (!row || row.revoked_at || Date.parse(row.expires_at) <= Date.now()) {
    return null;
  }

  db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);

  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    created_at: row.created_at
  };
}

export function revokeRefreshToken(db: Db, token: string): void {
  db.prepare(`
    UPDATE refresh_tokens
    SET revoked_at = COALESCE(revoked_at, ?)
    WHERE token_hash = ?
  `).run(new Date().toISOString(), hashToken(token));
}
