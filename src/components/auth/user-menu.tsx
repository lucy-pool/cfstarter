"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LogOut, User } from "lucide-react";

export function UserMenu() {
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.getCurrentUser);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
          {user?.name
            ? user.name.charAt(0).toUpperCase()
            : user?.email
              ? user.email.charAt(0).toUpperCase()
              : <User className="h-4 w-4" />}
        </div>
        <span className="hidden sm:inline text-muted-foreground">
          {user?.name || user?.email || "User"}
        </span>
      </div>
      <button
        onClick={() => void signOut()}
        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
