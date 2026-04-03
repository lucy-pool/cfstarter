import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { DataGrid, type ColumnDef } from "@/components/ui/data-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, MoreHorizontal } from "lucide-react";

// ── Sample data ──────────────────────────────────────────────────────

interface Invoice {
  id: string;
  customer: string;
  email: string;
  status: "Paid" | "Pending" | "Overdue" | "Refunded";
  method: string;
  amount: number;
  date: string;
  priority: "Low" | "Medium" | "High" | "Critical";
}

const CUSTOMERS = [
  "Elena Marchetti",
  "Tomas Herrera",
  "Ingrid Solberg",
  "Kwame Asante",
  "Sakura Tanaka",
  "Dimitri Volkov",
  "Amara Okafor",
  "Liam Chen",
  "Priya Sharma",
  "Bjorn Lindqvist",
  "Chloe Dubois",
  "Rafael Santos",
];

const EMAILS = [
  "elena@studio.it",
  "tomas@herrera.mx",
  "ingrid@solberg.no",
  "kwame@asante.gh",
  "sakura@tanaka.jp",
  "dimitri@volkov.ru",
  "amara@okafor.ng",
  "liam@chen.au",
  "priya@sharma.in",
  "bjorn@lindqvist.se",
  "chloe@dubois.fr",
  "rafael@santos.br",
];

const STATUSES: Invoice["status"][] = [
  "Paid",
  "Pending",
  "Overdue",
  "Refunded",
  "Paid",
  "Pending",
];
const METHODS = ["Credit Card", "Bank Transfer", "PayPal", "Crypto", "Wire"];
const PRIORITIES: Invoice["priority"][] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const SAMPLE_DATA: Invoice[] = Array.from({ length: 87 }, (_, i) => ({
  id: `INV-${String(i + 1001).padStart(4, "0")}`,
  customer: CUSTOMERS[i % 12],
  email: EMAILS[i % 12],
  status: STATUSES[i % 6],
  method: METHODS[i % 5],
  amount: Math.round((((i * 7919) % 4500) + 50) * 100) / 100,
  date: new Date(2025, i % 12, (i % 28) + 1).toISOString().split("T")[0],
  priority: PRIORITIES[i % 4],
}));

// ── Badge renderers ──────────────────────────────────────────────────

const statusStyles: Record<Invoice["status"], string> = {
  Paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Overdue: "bg-red-500/10 text-red-600 border-red-500/20",
  Refunded: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

const priorityStyles: Record<Invoice["priority"], string> = {
  Critical: "bg-red-500/10 text-red-600 border-red-500/20",
  High: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  Medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  Low: "bg-secondary text-muted-foreground",
};

// ── Page ─────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_app/data-grid-demo")({
  component: DataGridDemoPage,
});

function DataGridDemoPage() {
  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        id: "id",
        header: "Invoice",
        width: 120,
        cell: ({ value }) => (
          <span className="font-mono text-xs tracking-wide">
            {String(value)}
          </span>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        width: 180,
        cell: ({ value }) => {
          const name = String(value);
          const initials = name
            .split(" ")
            .map((n) => n[0])
            .join("");
          return (
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                {initials}
              </div>
              <span className="font-medium truncate">{name}</span>
            </div>
          );
        },
      },
      {
        id: "email",
        header: "Email",
        width: 200,
        cell: ({ value }) => (
          <span className="text-muted-foreground truncate text-sm">
            {String(value)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: 130,
        filterable: true,
        filterType: "enum",
        filterOptions: ["Paid", "Pending", "Overdue", "Refunded"],
        cell: ({ value }) => {
          const status = value as Invoice["status"];
          return (
            <Badge variant="outline" className={statusStyles[status]}>
              {status}
            </Badge>
          );
        },
      },
      {
        id: "method",
        header: "Method",
        width: 150,
        filterable: true,
        filterType: "enum",
        filterOptions: METHODS,
        cell: ({ value }) => (
          <span className="text-sm">{String(value)}</span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        width: 130,
        align: "right",
        filterable: true,
        filterType: "number",
        cell: ({ value }) => (
          <span className="font-mono text-sm tabular-nums">
            ${Number(value).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        id: "date",
        header: "Date",
        width: 130,
        cell: ({ value }) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {new Date(String(value)).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ),
      },
      {
        id: "priority",
        header: "Priority",
        width: 110,
        filterable: true,
        filterType: "enum",
        filterOptions: ["Low", "Medium", "High", "Critical"],
        cell: ({ value }) => {
          const priority = value as Invoice["priority"];
          return (
            <Badge variant="outline" className={priorityStyles[priority]}>
              {priority}
            </Badge>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">DataGrid</h1>
        <p className="text-muted-foreground">
          Demo page — generic DataGrid component with sorting, filtering,
          pagination, row selection, and column controls.
        </p>
      </div>

      <DataGrid
        data={SAMPLE_DATA}
        columns={columns}
        getRowId={(row) => row.id}
        enableSelection
        enableGlobalFilter
        enableColumnFilters
        enableColumnVisibility
        enableColumnResize
        defaultPageSize={10}
        rowActions={(_row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View details</DropdownMenuItem>
              <DropdownMenuItem>Edit invoice</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        toolbarActions={
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        }
      />
    </div>
  );
}
