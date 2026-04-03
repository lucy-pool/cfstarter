# SPA Migration: TanStack Start SSR to Client-Only

**Date:** 2026-04-03
**Status:** Approved
**Goal:** Switch from SSR to SPA mode for static deployment on Cloudflare Pages, with a same-origin edge proxy for auth.

## Motivation

The app uses Convex for all backend logic (DB, auth, real-time, actions). The only server-side code is an auth proxy and SSR token fetch. SSR adds deployment complexity on Cloudflare (Workers runtime limits, `process.env` incompatibility, cold starts) with no meaningful benefit since Convex handles everything reactively on the client.

Going SPA means:
- Static files on Cloudflare Pages (free tier, no Workers needed for the app itself)
- No `process.env` issues, no Node.js compat worries, no cold starts
- Simpler build and deployment pipeline

## Approach: SPA + Same-Origin Edge Proxy (Option B)

Auth cookies stay on the same origin via a Cloudflare Pages Function that proxies `/api/auth/*` to the Convex HTTP backend. This avoids cross-origin cookie issues (Safari third-party cookie blocking) and keeps the Convex URL unexposed to the client.

## Architecture Changes

### 1. Build & Config

- **`vite.config.ts`**: Set TanStack Start to SPA mode (`ssr: false` or equivalent). Remove `ssr.noExternal` config. Add a Vite dev proxy for `/api/auth` pointing to `VITE_CONVEX_SITE_URL` so local dev mirrors production.
- **`package.json`**: Update or remove the `"start"` script (no Node.js server needed). Output is a static `dist/` folder.

### 2. Remove Server-Side Code

| Action | File | Reason |
|--------|------|--------|
| Delete | `src/routes/api/auth/$.ts` | Replaced by Cloudflare edge function |
| Delete | `src/lib/auth-server.ts` | `handler`, `getToken`, `fetchAuthQuery` — all SSR-only |
| Modify | `src/routes/__root.tsx` | Remove `createServerFn`, `getToken` import, `beforeLoad` SSR auth check |

The `ConvexBetterAuthProvider` already handles client-side auth via session cookies. The `_app.tsx` layout handles loading states and redirects. No replacement logic needed.

### 3. Cloudflare Pages Edge Proxy

Create `functions/api/auth/[[path]].ts` (Cloudflare Pages Functions catch-all convention):

```ts
export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, env.CONVEX_SITE_URL);

  const res = await fetch(target.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== "GET" ? request.body : undefined,
  });

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
};
```

- `CONVEX_SITE_URL` set as a Cloudflare Pages environment variable
- Same-origin cookies, no CORS config needed
- For local dev, Vite proxy achieves the same effect

### 4. Auth Client

`src/lib/auth-client.ts` needs no changes. Better Auth defaults to the current origin, which is correct since the edge proxy sits at `/api/auth/*` on the same origin in both dev (Vite proxy) and production (Cloudflare Pages Function).

## Files Summary

| Action | File |
|--------|------|
| Modify | `vite.config.ts` — SPA mode, add `/api/auth` dev proxy |
| Modify | `src/routes/__root.tsx` — remove server fn, SSR auth |
| Modify | `package.json` — update start script |
| Delete | `src/routes/api/auth/$.ts` |
| Delete | `src/lib/auth-server.ts` |
| Create | `functions/api/auth/[[path]].ts` — Cloudflare edge proxy |

## Greybox Checklist

- **Deep?** The edge proxy is intentionally shallow (thin pass-through). All auth logic stays in Convex (deep module).
- **Opaque?** Swapping the proxy implementation (different edge platform) doesn't touch any other file.
- **Outcome-focused?** Tests hit the auth flow end-to-end, not proxy internals.

## Testing Strategy

- **Existing backend tests**: Unchanged — they don't touch SSR.
- **Manual verification**: Sign in, sign up, sign out, protected route redirects, file upload.
- **Local dev parity**: Vite proxy mimics the Cloudflare edge proxy so the auth flow is identical locally and in production.

## Out of Scope

- Cloudflare Pages project setup / wrangler config
- R2 environment variable setup
- Production deployment pipeline
