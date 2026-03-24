import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  PasswordInput,
  isPasswordValid,
} from "@/components/auth/password-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) ?? "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid(newPassword)) return;
    setError("");
    setLoading(true);
    try {
      await authClient.resetPassword({ token, newPassword });
      navigate({ to: "/signin" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reset password"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">Invalid or missing reset token.</p>
            <Link
              to="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Request a new reset link
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Set New Password
          </CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <PasswordInput
                id="password"
                value={newPassword}
                onChange={setNewPassword}
                showRequirements
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !isPasswordValid(newPassword)}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
