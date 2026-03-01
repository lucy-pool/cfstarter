"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function DashboardPage() {
  const user = useQuery(api.users.getCurrentUser);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome{user.name ? `, ${user.name}` : ""}!
        </h1>
        <p className="text-muted-foreground">
          This is your starter template. Everything here is a demo you can
          replace.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Profile card */}
        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>Account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Email:</span>{" "}
              {user.email}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Roles:</span>
              {(user.roles ?? []).map((role: string) => (
                <Badge key={role} variant="secondary">
                  {role}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Demo: Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Demo: Notes</CardTitle>
            <CardDescription>Convex CRUD pattern</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Queries, mutations, real-time updates, auth guards, ownership.
            </p>
            <Link
              href="/notes"
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              Open Notes &rarr;
            </Link>
          </CardContent>
        </Card>

        {/* Demo: Files */}
        <Card>
          <CardHeader>
            <CardTitle>Demo: File Upload</CardTitle>
            <CardDescription>S3 presigned URL pattern</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Presigned URLs, direct-to-S3 upload, progress tracking, metadata
              storage.
            </p>
            <Link
              href="/files"
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              Open Files &rarr;
            </Link>
          </CardContent>
        </Card>

        {/* Demo: AI Chat */}
        <Card>
          <CardHeader>
            <CardTitle>Demo: AI Chat</CardTitle>
            <CardDescription>OpenRouter integration pattern</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Actions calling external APIs, message history, streaming-ready
              pattern.
            </p>
            <Link
              href="/ai-chat"
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              Open AI Chat &rarr;
            </Link>
          </CardContent>
        </Card>

        {/* Getting started */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Build Your App</CardTitle>
            <CardDescription>Replace the demos</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>
                Edit roles in{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  convex/schema.ts
                </code>
              </li>
              <li>Add your own tables to the schema</li>
              <li>
                Create backend functions in{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  convex/
                </code>
              </li>
              <li>
                Add pages under{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  src/app/(app)/
                </code>
              </li>
              <li>Update the sidebar nav</li>
              <li>Delete the demo pages (notes, files, ai-chat)</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
