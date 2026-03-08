# Security Architect Memory — Z-CMS

## Project Profile

- Stack: React 19 + Vite (frontend), Express 4.x (backend, `server/`)
- Auth model: No user-facing auth — internal B2B tool. All API endpoints are unauthenticated.
- Secrets storage: `server/.env` (gitignored at root level, NOT inside `server/`)
- Credentials dir: `server/credentials/` — only `service-account.json` is gitignored; the Google SA key file with a different name was committed.

## Critical Findings (confirmed 2026-02-17)

### CRITICAL
1. **Google SA private key committed to git** — `server/credentials/z-cms-486204-5d17d0bbb6af.json` contains a live RSA private key. Must be rotated immediately.
2. **Supabase service_role key in .env** — `SUPABASE_KEY` is `service_role`, not `anon`. Bypasses all RLS. Exposed if `.env` leaks.
3. **Real secrets in server/.env** — ECOUNT API key, Gemini API key, Supabase service key are all live values committed to the working tree (git status shows `M server/.env`).

### HIGH
4. **Zero authentication on all API endpoints** — no middleware guards `/api/sync`, `/api/ecount`, `/api/debates`, etc.
5. **SSE wildcard CORS** — `sse.routes.ts` line 22 sets `Access-Control-Allow-Origin: *`, overriding the main CORS policy.
6. **ECOUNT credentials updatable via unauthenticated POST** — `/api/ecount/config` allows runtime credential replacement.
7. **No security headers** — helmet not installed; no CSP, HSTS, X-Frame-Options, X-Content-Type-Options.
8. **`server/.env` gitignore path mismatch** — `.gitignore` ignores `.env` at root; `server/.env` is a subdirectory file and may not be correctly ignored depending on git context.

### MEDIUM
9. **No input validation on query params** — date params passed directly to ECOUNT API without format checks.
10. **Error messages leak internal detail** — `error.message` returned directly in 500 responses.
11. **`Math.random()` in profitability calculation** — non-deterministic, not security-critical but indicates mock data leaking to prod responses.
12. **No request body size limit** — `express.json()` with no `limit` option.

### LOW
13. **No rate limit on agent/debate/governance routes** — heavy AI endpoints lack specific limiters.
14. **No CSRF protection** — acceptable for API-only backend, but SSE wildcard CORS weakens defense-in-depth.

## Key File Paths

- Express setup: `server/src/index.ts`
- CORS / rate limit config: `server/src/index.ts` lines 50-97
- SSE wildcard: `server/src/routes/sse.routes.ts` line 22
- ECOUNT config endpoint: `server/src/routes/ecount.routes.ts` lines 15-29
- Frontend Supabase client: `src/services/supabaseClient.ts`
- Committed credentials: `server/credentials/z-cms-486204-5d17d0bbb6af.json`

## Patterns to Remember

- `.gitignore` at repo root uses `server/credentials/service-account.json` (exact filename). Files named differently in that directory are NOT excluded.
- All routes registered under `/api` receive the `globalLimiter` (100 req/15min) but no auth check.
- `server/.env` must be added explicitly to `.gitignore` as `server/.env` or `**/.env`.
