"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LayoutDashboard, StickyNote, Upload, Bot, Table2, Mail, Users, FileText } from "lucide-react";
import { cn, APP_NAME } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  demo?: boolean;
  admin?: boolean;
}

// ── Navigation ──────────────────────────────────────────────────────
// Add your own routes here as you build features.
const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: "Notes",
    href: "/notes",
    icon: <StickyNote className="h-5 w-5" />,
    demo: true,
  },
  {
    label: "Files",
    href: "/files",
    icon: <Upload className="h-5 w-5" />,
    demo: true,
  },
  {
    label: "AI Chat",
    href: "/ai-chat",
    icon: <Bot className="h-5 w-5" />,
    demo: true,
  },
  {
    label: "DataGrid",
    href: "/data-grid-demo",
    icon: <Table2 className="h-5 w-5" />,
    demo: true,
  },
];

const adminItems: NavItem[] = [
  {
    label: "Users",
    href: "/admin/users",
    icon: <Users className="h-5 w-5" />,
    admin: true,
  },
  {
    label: "Email Logs",
    href: "/admin/emails",
    icon: <Mail className="h-5 w-5" />,
    admin: true,
  },
  {
    label: "Email Templates",
    href: "/admin/email-templates",
    icon: <FileText className="h-5 w-5" />,
    admin: true,
  },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-bg-hover text-sidebar-active"
          : "text-sidebar-text-muted hover:bg-sidebar-bg-hover hover:text-sidebar-text"
      )}
    >
      {item.icon}
      {item.label}
      {item.demo && (
        <span className="text-xs text-muted-foreground">(demo)</span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const user = useQuery(api.users.getCurrentUser);
  const isAdmin = (user?.roles ?? []).includes("admin");

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar-bg text-sidebar-text border-r border-sidebar-border">
      {/* Logo / App Name */}
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="text-lg font-bold">
          {APP_NAME}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {isAdmin && adminItems.length > 0 && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-text-muted">
                Admin
              </span>
            </div>
            {adminItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
