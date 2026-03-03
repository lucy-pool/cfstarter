# Data Flow

## Client → Convex Reactive Loop

```mermaid
graph TD
    subgraph Browser
        Page["Page Component"]
        useQuery["useQuery(api.X.fn)"]
        useMutation["useMutation(api.X.fn)"]
        useAction["useAction(api.X.fn)"]
    end

    subgraph Convex
        Query["query handler"]
        Mutation["mutation handler"]
        Action["action handler"]
        DB[(Database)]
    end

    subgraph External
        R2["Cloudflare R2"]
        AI["OpenRouter API"]
        Email["Resend / SMTP"]
    end

    Page -->|subscribes| useQuery
    useQuery -->|"WebSocket subscription"| Query
    Query -->|reads| DB
    DB -->|"real-time push on change"| Query
    Query -->|"auto re-renders"| useQuery
    useQuery -->|data| Page

    Page -->|user action| useMutation
    useMutation -->|"RPC call"| Mutation
    Mutation -->|reads/writes| DB
    DB -->|"triggers re-run"| Query

    Page -->|side effect| useAction
    useAction -->|"RPC call"| Action
    Action -->|"presigned URLs"| R2
    Action -->|"chat completions"| AI
    Action -->|"send emails"| Email
```

## R2 File Upload Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as r2.ts (clientApi)
    participant R as Cloudflare R2
    participant M as Convex Mutation

    B->>C: generateUploadUrl()
    C->>C: checkUpload → getCurrentUser(ctx)
    C->>R: presigned PUT URL
    C->>B: { url, storageKey }

    B->>R: PUT file (direct upload)
    R->>B: 200 OK

    B->>M: storeFileMetadata(fileName, storageKey, ...)
    M->>M: userMutation auth + insert fileMetadata
    M->>B: fileId
```

## AI Chat Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant M as Convex Mutation
    participant A as Convex Action
    participant O as OpenRouter

    B->>M: saveMessage(role: "user", content)
    M->>M: insert into aiMessages

    B->>A: chat(messages[], systemPrompt?)
    A->>O: POST /api/v1/chat/completions
    O->>A: { choices: [{ message: { content } }] }
    A->>B: { content, model, usage }

    B->>M: saveMessage(role: "assistant", content, model)
    M->>M: insert into aiMessages
```

## Email Send Flow

```mermaid
sequenceDiagram
    participant Caller as Caller (User / System)
    participant M as emails.ts (Mutation)
    participant S as Scheduler
    participant A as emailActions.ts (Action)
    participant T as Template Renderer
    participant P as Email Provider (Resend/SMTP)

    Caller->>M: sendEmail() / createEmailLog()
    M->>M: Insert emailLogs (status: queued)
    M->>S: scheduler.runAfter(0, processEmail)

    S->>A: processEmail(logId)
    A->>M: getEmailLogInternal(logId)
    M->>A: Email log record

    alt Custom template
        A->>A: Fetch template from customTemplates.getInternal
        A->>T: renderCustomTemplate(editorMode, content, data)
    else Hardcoded template
        A->>T: renderTemplate(templateName, data)
    end
    T->>A: { html, subject }

    A->>P: provider.send({ from, to, subject, html })
    P->>A: { provider, messageId }

    A->>M: updateEmailLog(status: sent, provider, messageId)
```

## Welcome Email Flow (Auth Callback)

```mermaid
sequenceDiagram
    participant U as New User
    participant CA as Convex Auth
    participant CB as auth.ts callback
    participant S as Scheduler
    participant E as emails.ts

    U->>CA: Sign up (Password / GitHub / Google)
    CA->>CA: Create user in DB
    CA->>CB: afterUserCreatedOrUpdated(userId, existingUserId=null)
    CB->>CB: existingUserId is null → new user
    CB->>S: scheduler.runAfter(0, internal.emails.createEmailLog)
    S->>E: createEmailLog(to, template: "welcome", templateData)
    Note over E: Inserts log + schedules processEmail
```

## User Provisioning Flow

```mermaid
graph TD
    SignIn[User signs in via Convex Auth] --> Layout["(app)/layout.tsx mounts"]
    Layout --> CheckAuth{isAuthenticated?}
    CheckAuth -->|No| Redirect[Redirect to /signin]
    CheckAuth -->|Yes| QueryUser["useQuery(getCurrentUser)"]
    QueryUser --> Ready{user !== null?}
    Ready -->|No| Spinner[Show loading spinner]
    Ready -->|Yes| Render[Render AppShell + children]
```

## Admin Sidebar Flow

```mermaid
graph TD
    Sidebar["Sidebar Component"] --> QueryUser["useQuery(getCurrentUser)"]
    QueryUser --> CheckRole{user.roles includes 'admin'?}
    CheckRole -->|No| NavItems["Show standard nav items only"]
    CheckRole -->|Yes| AdminNav["Show standard nav + Admin section"]
    AdminNav --> Users["/admin/users"]
    AdminNav --> EmailLogs["/admin/emails"]
    AdminNav --> EmailTemplates["/admin/email-templates"]
```

## Key Patterns

| Pattern | Where | How |
|---------|-------|-----|
| Reactive queries | All pages | `useQuery()` auto-updates when data changes |
| Custom function builders | functions.ts | `userQuery`/`userMutation` inject `ctx.user` automatically |
| Admin builders | functions.ts | `adminQuery`/`adminMutation` check admin role + inject `ctx.user` |
| Owner-only writes | notes, files | Check `record.authorId === ctx.user._id` |
| `"use node"` split | r2Actions, aiActions, emailActions | Node packages in separate action-only files |
| Internal functions | emails, customTemplates | `internalMutation`/`internalQuery` for system-triggered operations |
| Scheduler pattern | emails, auth callback | `ctx.scheduler.runAfter(0, ...)` for async processing |
| Presigned URLs | r2.ts (clientApi) | Browser uploads directly to R2, Convex stores metadata |
| External API calls | aiActions, emailActions | Actions can fetch(), queries/mutations cannot |
| Role-based sidebar | sidebar.tsx | `useQuery(getCurrentUser)` → show admin nav items if admin role |
