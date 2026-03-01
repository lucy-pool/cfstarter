"use client";

import { UserMenu } from "@/components/auth/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div className="text-sm font-medium text-muted-foreground">
        {/* Breadcrumb or page title can go here */}
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
