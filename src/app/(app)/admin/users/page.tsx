"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { DataGrid, type ColumnDef } from "@/components/ui/data-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, ShieldCheck, ShieldOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Role = "user" | "admin";

interface User {
  _id: Id<"users">;
  _creationTime: number;
  name?: string;
  email?: string;
  roles?: Role[];
}

export default function AdminUsersPage() {
  const users = useQuery(api.users.getAllUsers) as User[] | undefined;
  const updateUser = useMutation(api.users.adminUpdateUser);
  const updateRoles = useMutation(api.users.updateUserRoles);
  const { toast } = useToast();

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editRoles, setEditRoles] = useState<Role[]>([]);

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditName(user.name ?? "");
    setEditRoles(user.roles ?? []);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      const nameChanged = editName !== (editingUser.name ?? "");
      const rolesChanged =
        JSON.stringify([...editRoles].sort()) !==
        JSON.stringify([...(editingUser.roles ?? [])].sort());

      if (nameChanged) {
        await updateUser({ userId: editingUser._id, name: editName });
      }
      if (rolesChanged) {
        await updateRoles({ userId: editingUser._id, roles: editRoles });
      }

      toast({ title: "User updated" });
      setEditingUser(null);
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const toggleAdmin = async (user: User) => {
    const currentRoles = user.roles ?? [];
    const isAdmin = currentRoles.includes("admin");
    const newRoles: Role[] = isAdmin
      ? currentRoles.filter((r) => r !== "admin")
      : [...currentRoles, "admin"];
    try {
      await updateRoles({ userId: user._id, roles: newRoles });
      toast({
        title: isAdmin ? "Admin role removed" : "Admin role granted",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const toggleRole = (role: Role) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        width: 220,
        cell: ({ row }) => {
          const name = row.name ?? "Unnamed";
          const initial = name[0]?.toUpperCase() ?? "?";
          return (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {initial}
              </div>
              <span className="text-sm truncate">{name}</span>
            </div>
          );
        },
      },
      {
        id: "email",
        header: "Email",
        width: 250,
        cell: ({ value }) => (
          <span className="text-sm truncate">{String(value ?? "—")}</span>
        ),
      },
      {
        id: "roles",
        header: "Roles",
        width: 180,
        filterable: true,
        filterType: "enum",
        filterOptions: ["user", "admin"],
        accessorFn: (row) => (row.roles ?? []).join(", "),
        cell: ({ row }) => {
          const roles = row.roles ?? [];
          if (roles.length === 0) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <div className="flex gap-1">
              {roles.map((role) => (
                <Badge
                  key={role}
                  variant="outline"
                  className={
                    role === "admin"
                      ? "bg-violet-500/10 text-violet-600 border-violet-500/20"
                      : "bg-secondary text-muted-foreground"
                  }
                >
                  {role}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "_creationTime",
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
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          View and manage all users. Edit names and assign roles.
        </p>
      </div>

      <DataGrid
        data={users ?? []}
        columns={columns}
        getRowId={(row) => row._id}
        loading={users === undefined}
        enableGlobalFilter
        enableColumnFilters
        enableColumnVisibility
        defaultPageSize={25}
        rowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEditDialog(row)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit User
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleAdmin(row)}>
                {(row.roles ?? []).includes("admin") ? (
                  <>
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Remove Admin
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Make Admin
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {/* Edit User Dialog */}
      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="User name"
              />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="flex flex-col gap-2">
                {(["user", "admin"] as Role[]).map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={editRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <span className="capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
