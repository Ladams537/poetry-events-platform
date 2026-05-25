# Capstone 4: Poetry Events Platform

A pnpm workspace containing:

- `packages/shared`: Zod schemas and inferred TypeScript types.
- `packages/backend`: Hono API with SQLite persistence, JWT access tokens, refresh-token cookies, RSVPs, and recommendations.
- `packages/frontend`: SvelteKit app using TanStack Query for server state.

## Local Development

```sh
pnpm install
pnpm dev
```

Backend defaults to `http://localhost:8787`.
Frontend defaults to `http://localhost:5173`.

## Tests

```sh
pnpm e2e
```

The E2E test starts the backend over HTTP, registers users, logs in, creates events, RSVPs, and verifies recommendations.

## Recommendation Algorithm

`GET /recommendations` uses weighted co-attendance collaborative filtering:

1. Find the current user's RSVPed events.
2. Find adjacent users who RSVPed to those same events.
3. Weight each adjacent user by shared RSVP count.
4. Recommend future events adjacent users have RSVPed to that the current user has not.
5. Rank by summed adjacent-user weights, then by soonest event.

This is a SQL-friendly graph traversal over the bipartite graph of users and events. With indexes on `rsvps.user_id`, `rsvps.event_id`, and `events.starts_at`, it avoids loading the whole graph into application memory and is appropriate for thousands of events and tens of thousands of RSVPs. If the RSVP graph grows much larger, the next hard-signpost step is an incrementally maintained co-attendance table.

## Deployment Notes

Backend on Fly:

```sh
cd packages/backend
fly apps create poetry-events-api
fly volumes create poetry_data --region lhr --size 1
fly secrets set JWT_SECRET="a-long-random-production-secret" FRONTEND_ORIGIN="https://your-frontend.vercel.app"
fly deploy
```

Frontend on Vercel:

```sh
vercel --cwd packages/frontend
vercel env add PUBLIC_API_BASE_URL
vercel --cwd packages/frontend --prod
```

Set `PUBLIC_API_BASE_URL` to the Fly backend URL, then set the backend `FRONTEND_ORIGIN` secret to the final Vercel URL.
