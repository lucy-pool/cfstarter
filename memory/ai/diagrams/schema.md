# Database Schema

```mermaid
erDiagram
    users {
        string name "Optional display name"
        string email "Email address"
        string avatarUrl "Optional profile image URL"
        array roles "user | admin"
        number createdAt "Unix timestamp ms"
        number updatedAt "Unix timestamp ms"
    }

    fileMetadata {
        string fileName "Original file name"
        string storageKey "S3 object key"
        string mimeType "MIME type"
        number size "Size in bytes"
        string fileType "audio | document | image"
        id createdBy "FK → users._id"
        number createdAt "Unix timestamp ms"
    }

    aiMessages {
        id userId "FK → users._id"
        string role "user | assistant"
        string content "Message text"
        string model "Optional model name"
        number createdAt "Unix timestamp ms"
    }

    notes {
        string title "Note title"
        string body "Note content"
        id authorId "FK → users._id"
        boolean isPublic "Visible to all users"
        number createdAt "Unix timestamp ms"
        number updatedAt "Unix timestamp ms"
    }

    emailLogs {
        string to "Recipient email"
        string subject "Rendered subject line"
        string template "welcome | password-reset | email-verification | magic-link | team-invite | notification | account-deletion | custom"
        string templateData "JSON string of template props"
        string status "queued | sent | failed | bounced"
        string provider "Optional: resend | smtp"
        string providerMessageId "Optional: provider ref"
        string error "Optional: error message"
        number sentAt "Optional: Unix timestamp ms"
        id sentBy "Optional FK → users._id"
        id customTemplateId "Optional FK → emailTemplates._id"
        number createdAt "Unix timestamp ms"
    }

    emailTemplates {
        string name "Unique slug"
        string label "Display name"
        string subject "Subject line template"
        string editorMode "visual | html"
        string contentJson "Maily Tiptap JSON (visual mode)"
        string contentHtml "Optional raw HTML (html mode)"
        array variables "name, required, defaultValue"
        id createdBy "FK → users._id"
        id updatedBy "FK → users._id"
        number createdAt "Unix timestamp ms"
        number updatedAt "Unix timestamp ms"
    }

    users ||--o{ notes : "authorId"
    users ||--o{ fileMetadata : "createdBy"
    users ||--o{ aiMessages : "userId"
    users ||--o{ emailLogs : "sentBy"
    users ||--o{ emailTemplates : "createdBy"
    emailTemplates ||--o{ emailLogs : "customTemplateId"
```

## Indexes

| Table | Index | Fields | Purpose |
|-------|-------|--------|---------|
| users | by_email | email | Email lookup |
| fileMetadata | by_created_by | createdBy | User's files |
| fileMetadata | by_file_type | fileType | Filter by type |
| aiMessages | by_user | userId | User's chat history |
| notes | by_author | authorId | User's own notes |
| notes | by_public | isPublic | Public notes feed |
| emailLogs | by_status | status | Filter by send status |
| emailLogs | by_template | template | Filter by template type |
| emailLogs | by_to | to | Lookup by recipient |
| emailLogs | by_created_at | createdAt | Chronological listing |
| emailTemplates | by_name | name | Unique name lookup |
| emailTemplates | by_created_at | createdAt | Chronological listing |

## Roles

| Role | Description |
|------|-------------|
| user | Default role for all new users |
| admin | Full access, can manage user roles |

## Validators (exported from schema.ts)

| Validator | Values |
|-----------|--------|
| `roleValidator` | `"user"` \| `"admin"` |
| `fileTypeValidator` | `"audio"` \| `"document"` \| `"image"` |
| `messageRoleValidator` | `"user"` \| `"assistant"` |
| `emailStatusValidator` | `"queued"` \| `"sent"` \| `"failed"` \| `"bounced"` |
| `emailTemplateValidator` | `"welcome"` \| `"password-reset"` \| `"email-verification"` \| `"magic-link"` \| `"team-invite"` \| `"notification"` \| `"account-deletion"` \| `"custom"` |
