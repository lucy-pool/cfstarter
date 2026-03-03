# Authentication Flow

## Sign-In Sequence

```mermaid
sequenceDiagram
    participant B as Browser
    participant CA as Convex Auth
    participant M as Edge Proxy (proxy.ts)
    participant A as (app)/layout.tsx
    participant X as Convex

    B->>CA: User signs in at /signin (Password, GitHub, or Google)
    CA->>CA: Validate credentials, create session
    CA->>X: afterUserCreatedOrUpdated callback
    alt New user
        X->>X: Schedule welcome email (internal.emails.createEmailLog)
    end
    CA->>B: Session token, redirect to /dashboard
    B->>M: Request /dashboard
    M->>M: convexAuthNextjsMiddleware checks auth (proxy.ts)
    M->>B: Route allowed (authenticated)
    B->>A: Render (app)/layout.tsx
    A->>X: useConvexAuth() — check isAuthenticated
    alt Not authenticated
        A->>B: Redirect to /signin
    else Authenticated
        A->>X: useQuery(getCurrentUser)
        X->>A: User record
        A->>B: Render AppShell + dashboard
    end
```

## Route Protection

```mermaid
graph TD
    request[Incoming Request] --> proxy["proxy.ts (convexAuthNextjsMiddleware)"]
    proxy --> isPublic{Is public route?}

    isPublic -->|"/ or /signin or /signup or /api/auth(.*)"| allow[Allow through]
    isPublic -->|Any other route| protect[Check authentication]

    protect --> hasSession{Has valid session?}
    hasSession -->|Yes| appLayout["(app)/layout.tsx"]
    hasSession -->|No| redirect[Redirect to /signin]

    appLayout --> checkAuth["useConvexAuth()"]
    checkAuth --> authenticated{isAuthenticated?}
    authenticated -->|No| redirectAgain[Redirect to /signin]
    authenticated -->|Yes| queryUser["useQuery(getCurrentUser)"]
    queryUser --> ready{user !== null?}
    ready -->|No| spinner[Show loading spinner]
    ready -->|Yes| render[Render AppShell + children]
```

## JWT Flow

```mermaid
graph LR
    ConvexAuth["Convex Auth"] -->|"Issues self-signed JWT"| Browser
    Browser -->|"JWT in session"| Convex
    Convex -->|"auth.config.ts validates self-issued token"| Identity["ctx.auth.getUserIdentity()"]
    Identity -->|"identity.subject = userId"| Lookup["users table"]
```

## Backend Auth Layers

```mermaid
graph TD
    subgraph "Function Builders (functions.ts)"
        userQuery["userQuery / userMutation"]
        adminQuery["adminQuery / adminMutation"]
        rawQuery["Raw query/mutation (public)"]
    end

    userQuery -->|"getCurrentUser(ctx)"| authHelpers["authHelpers.ts"]
    adminQuery -->|"getCurrentUser(ctx) + role check"| authHelpers
    rawQuery -->|"No auth check"| handler["Handler runs directly"]

    authHelpers -->|"ctx.user injected"| handler2["Handler gets ctx.user"]
```

## Key Files

| File | Role |
|------|------|
| `convex/auth.config.ts` | Self-issued JWT config |
| `convex/auth.ts` | Convex Auth providers (Password, GitHub, Google) + afterUserCreated callback |
| `convex/authHelpers.ts` | Auth guards (getCurrentUser, requireAuth, requireAdmin, hasRole) |
| `convex/functions.ts` | Custom function builders (userQuery, userMutation, adminQuery, adminMutation) |
| `convex/users.ts` | User CRUD (getCurrentUser soft-fail, updateProfile, admin operations) |
| `src/proxy.ts` | Edge proxy — route protection (public vs protected) |
| `src/components/providers.tsx` | ConvexAuthProvider wiring |
| `src/app/(app)/layout.tsx` | Auth gate + user query on mount |
| `src/app/signin/page.tsx` | Sign-in (Password + OAuth) |
| `src/app/signup/page.tsx` | Sign-up (Password + OAuth) |
