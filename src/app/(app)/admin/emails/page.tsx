"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { DataGrid, type ColumnDef } from "@/components/ui/data-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, CheckCircle2, AlertTriangle, Mail, Server } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface EmailLog {
  _id: Id<"emailLogs">;
  _creationTime: number;
  to: string;
  subject: string;
  template: string;
  templateData: string;
  status: "queued" | "sent" | "failed" | "bounced";
  provider?: string;
  providerMessageId?: string;
  error?: string;
  sentAt?: number;
  sentBy?: Id<"users">;
  createdAt: number;
}

const statusStyles: Record<string, string> = {
  queued: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  sent: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  bounced: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

interface EmailConfig {
  activeProvider: "resend" | "smtp" | "none";
  from: string;
  resend: { configured: boolean };
  smtp: {
    configured: boolean;
    host?: string;
    port: string;
    secure: boolean;
    hasAuth: boolean;
  };
}

function EmailConfigBanner({ config }: { config: EmailConfig }) {
  if (config.activeProvider === "none") {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">No email provider configured</p>
            <p className="text-sm text-muted-foreground">
              Set <code className="rounded bg-muted px-1 py-0.5 text-xs">RESEND_API_KEY</code> or{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">SMTP_HOST</code> in the Convex
              dashboard to enable email sending.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardContent className="flex items-start gap-3 py-4">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            {config.activeProvider === "resend" ? (
              <Mail className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Server className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {config.activeProvider === "resend" ? "Resend" : "SMTP"}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            From: <code className="rounded bg-muted px-1 py-0.5 text-xs">{config.from}</code>
          </span>
          {config.activeProvider === "smtp" && config.smtp.host && (
            <span className="text-sm text-muted-foreground">
              Host: <code className="rounded bg-muted px-1 py-0.5 text-xs">{config.smtp.host}:{config.smtp.port}</code>
              {config.smtp.secure && (
                <Badge variant="outline" className="ml-1.5 text-xs py-0">TLS</Badge>
              )}
              {!config.smtp.hasAuth && (
                <Badge variant="outline" className="ml-1.5 text-xs py-0 border-amber-500/30 text-amber-600">No Auth</Badge>
              )}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const templateStyles: Record<string, string> = {
  welcome: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  "password-reset": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "email-verification": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  "magic-link": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "team-invite": "bg-pink-500/10 text-pink-600 border-pink-500/20",
  notification: "bg-secondary text-muted-foreground",
  "account-deletion": "bg-red-500/10 text-red-600 border-red-500/20",
  custom: "bg-teal-500/10 text-teal-600 border-teal-500/20",
};

export default function AdminEmailsPage() {
  const logs = useQuery(api.emails.listEmailLogs) as EmailLog[] | undefined;
  const resend = useMutation(api.emails.resendEmail);
  const getEmailConfig = useAction(api.emailActions.getEmailConfig);
  const { toast } = useToast();
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const config = await getEmailConfig();
      setEmailConfig(config);
    } catch {
      // Silently fail — banner just won't show
    }
  }, [getEmailConfig]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleResend = async (logId: Id<"emailLogs">) => {
    try {
      await resend({ logId });
      toast({ title: "Email re-queued", description: "The email has been queued for re-delivery." });
    } catch (error) {
      toast({
        title: "Resend failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const columns = useMemo<ColumnDef<EmailLog>[]>(
    () => [
      {
        id: "status",
        header: "Status",
        width: 110,
        filterable: true,
        filterType: "enum",
        filterOptions: ["queued", "sent", "failed", "bounced"],
        cell: ({ value }) => {
          const status = String(value);
          return (
            <Badge variant="outline" className={statusStyles[status] ?? ""}>
              {status}
            </Badge>
          );
        },
      },
      {
        id: "to",
        header: "To",
        width: 220,
        cell: ({ value }) => (
          <span className="text-sm truncate">{String(value)}</span>
        ),
      },
      {
        id: "template",
        header: "Template",
        width: 160,
        filterable: true,
        filterType: "enum",
        filterOptions: [
          "welcome",
          "password-reset",
          "email-verification",
          "magic-link",
          "team-invite",
          "notification",
          "account-deletion",
          "custom",
        ],
        cell: ({ value }) => {
          const template = String(value);
          return (
            <Badge variant="outline" className={templateStyles[template] ?? ""}>
              {template}
            </Badge>
          );
        },
      },
      {
        id: "subject",
        header: "Subject",
        width: 250,
        cell: ({ value }) => (
          <span className="text-sm truncate">{String(value) || "—"}</span>
        ),
      },
      {
        id: "provider",
        header: "Provider",
        width: 100,
        cell: ({ value }) => (
          <span className="text-sm text-muted-foreground">
            {String(value ?? "—")}
          </span>
        ),
      },
      {
        id: "sentAt",
        header: "Sent At",
        width: 170,
        cell: ({ value }) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {value
              ? new Date(Number(value)).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        width: 170,
        cell: ({ value }) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {new Date(Number(value)).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Logs</h1>
        <p className="text-muted-foreground">
          View and manage sent emails. Failed emails can be resent.
        </p>
      </div>

      {emailConfig && <EmailConfigBanner config={emailConfig} />}

      <DataGrid
        data={logs ?? []}
        columns={columns}
        getRowId={(row) => row._id}
        enableGlobalFilter
        enableColumnFilters
        enableColumnVisibility
        defaultPageSize={25}
        rowActions={(row) =>
          row.status === "failed" ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleResend(row._id)}
              title="Resend email"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          ) : null
        }
      />
    </div>
  );
}
