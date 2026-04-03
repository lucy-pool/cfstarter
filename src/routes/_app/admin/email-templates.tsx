import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DataGrid, type ColumnDef } from "@/components/ui/data-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  ArrowLeft,
  Eye,
  Save,
  Copy,
  Trash2,
  Pencil,
  X,
  Variable,
  Code,
  Palette,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface TemplateVariable {
  name: string;
  required: boolean;
  defaultValue?: string;
}

type EditorMode = "visual" | "html";

interface Template {
  _id: Id<"emailTemplates">;
  _creationTime: number;
  name: string;
  label: string;
  subject: string;
  editorMode: EditorMode;
  contentJson: string;
  contentHtml?: string;
  variables: TemplateVariable[];
  createdBy: Id<"users">;
  updatedBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
}

type View =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit"; templateId: Id<"emailTemplates"> };

// ── Default editor content ───────────────────────────────────────────

const DEFAULT_CONTENT_JSON = JSON.stringify({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Start writing your email template..." }],
    },
  ],
});

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Hello {{firstName}}</h1>
  <p>Start writing your email template here.</p>
</body>
</html>`;

// ── Page ─────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_app/admin/email-templates")({
  component: AdminEmailTemplatesPage,
});

function AdminEmailTemplatesPage() {
  const [view, setView] = useState<View>({ mode: "list" });

  return (
    <div className="space-y-6">
      {view.mode === "list" ? (
        <TemplateList onNavigate={setView} />
      ) : (
        <TemplateEditor
          templateId={view.mode === "edit" ? view.templateId : undefined}
          onBack={() => setView({ mode: "list" })}
        />
      )}
    </div>
  );
}

// ── List View ────────────────────────────────────────────────────────

function TemplateList({ onNavigate }: { onNavigate: (view: View) => void }) {
  const templates = useQuery(api.email.templates.list) as
    | Template[]
    | undefined;
  const duplicateTemplate = useMutation(api.email.templates.duplicate);
  const removeTemplate = useMutation(api.email.templates.remove);
  const { toast } = useToast();

  const handleDuplicate = async (templateId: Id<"emailTemplates">) => {
    try {
      await duplicateTemplate({ templateId });
      toast({ title: "Template duplicated" });
    } catch (error) {
      toast({
        title: "Failed to duplicate",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (templateId: Id<"emailTemplates">) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await removeTemplate({ templateId });
      toast({ title: "Template deleted" });
    } catch (error) {
      toast({
        title: "Failed to delete",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const columns = useMemo<ColumnDef<Template>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        width: 180,
        cell: ({ value }) => (
          <code className="text-sm rounded bg-muted px-1.5 py-0.5">
            {String(value)}
          </code>
        ),
      },
      {
        id: "label",
        header: "Label",
        width: 200,
        cell: ({ value }) => (
          <span className="text-sm font-medium">{String(value)}</span>
        ),
      },
      {
        id: "editorMode",
        header: "Mode",
        width: 100,
        cell: ({ value }) => (
          <Badge variant="outline">
            {value === "html" ? "HTML" : "Visual"}
          </Badge>
        ),
      },
      {
        id: "subject",
        header: "Subject",
        width: 220,
        cell: ({ value }) => (
          <span className="text-sm truncate">{String(value)}</span>
        ),
      },
      {
        id: "variables",
        header: "Vars",
        width: 80,
        cell: ({ value }) => {
          const vars = value as TemplateVariable[];
          return (
            <Badge variant="outline" className="tabular-nums">
              {vars.length}
            </Badge>
          );
        },
      },
      {
        id: "updatedAt",
        header: "Updated",
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
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">
            Create and manage custom email templates.
          </p>
        </div>
        <Button onClick={() => onNavigate({ mode: "create" })}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <DataGrid
        data={templates ?? []}
        columns={columns}
        getRowId={(row) => row._id}
        enableGlobalFilter
        defaultPageSize={25}
        rowActions={(row) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                onNavigate({ mode: "edit", templateId: row._id })
              }
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDuplicate(row._id)}
              title="Duplicate"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => handleDelete(row._id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />
    </>
  );
}

// ── Editor View ──────────────────────────────────────────────────────

function TemplateEditor({
  templateId,
  onBack,
}: {
  templateId?: Id<"emailTemplates">;
  onBack: () => void;
}) {
  const existing = useQuery(
    api.email.templates.get,
    templateId ? { templateId } : "skip"
  ) as Template | null | undefined;

  const createTemplate = useMutation(api.email.templates.create);
  const updateTemplate = useMutation(api.email.templates.update);
  const previewTemplate = useAction(
    api.email.templateActions.previewTemplate
  );
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [subject, setSubject] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("html");
  const [htmlContent, setHtmlContent] = useState(DEFAULT_HTML);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [visualEditorLoaded, setVisualEditorLoaded] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const EditorComponent = useRef<any>(null);

  // Lazy-load Maily editor only when visual mode is selected
  const loadVisualEditor = useCallback(async () => {
    if (EditorComponent.current) return;
    const mod = await import("@maily-to/core");
    await import("@maily-to/core/style.css");
    EditorComponent.current = mod.Editor;
    setVisualEditorLoaded(true);
  }, []);

  useEffect(() => {
    if (editorMode === "visual" && !EditorComponent.current) {
      loadVisualEditor();
    }
  }, [editorMode, loadVisualEditor]);

  // Initialize form from existing template
  if (existing && !initialized) {
    setName(existing.name);
    setLabel(existing.label);
    setSubject(existing.subject);
    setEditorMode(existing.editorMode);
    setVariables(existing.variables);
    if (existing.contentHtml) setHtmlContent(existing.contentHtml);
    setInitialized(true);
  }

  const getContentJson = (): string => {
    if (editorRef.current) {
      return JSON.stringify(editorRef.current.getJSON());
    }
    return DEFAULT_CONTENT_JSON;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!label.trim()) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Subject is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const contentJson =
        editorMode === "visual" ? getContentJson() : DEFAULT_CONTENT_JSON;
      const payload = {
        name: name.trim(),
        label: label.trim(),
        subject: subject.trim(),
        editorMode,
        contentJson,
        contentHtml: editorMode === "html" ? htmlContent : undefined,
        variables,
      };

      if (templateId) {
        await updateTemplate({ templateId, ...payload });
        toast({ title: "Template updated" });
      } else {
        await createTemplate(payload);
        toast({ title: "Template created" });
        onBack();
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const contentJson =
        editorMode === "visual" ? getContentJson() : DEFAULT_CONTENT_JSON;
      // Build preview variables from defaults
      const vars: Record<string, string> = {};
      for (const v of variables) {
        vars[v.name] = v.defaultValue || `{{${v.name}}}`;
      }
      const result = await previewTemplate({
        editorMode,
        contentJson,
        contentHtml: editorMode === "html" ? htmlContent : undefined,
        variables: JSON.stringify(vars),
        subject,
      });
      setPreviewHtml(result.html);
    } catch (error) {
      toast({
        title: "Preview failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setPreviewing(false);
    }
  };

  const addVariable = () => {
    setVariables((prev) => [
      ...prev,
      { name: "", required: true, defaultValue: "" },
    ]);
  };

  const updateVariable = (
    index: number,
    field: keyof TemplateVariable,
    value: string | boolean
  ) => {
    setVariables((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const removeVariable = (index: number) => {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  };

  const parsedContentJson = useMemo(() => {
    if (existing?.contentJson) {
      try {
        return JSON.parse(existing.contentJson);
      } catch {
        return JSON.parse(DEFAULT_CONTENT_JSON);
      }
    }
    return JSON.parse(DEFAULT_CONTENT_JSON);
  }, [existing?.contentJson]);

  const MailyEditor = EditorComponent.current;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {templateId ? "Edit Template" : "Create Template"}
            </h1>
            <p className="text-muted-foreground">
              {editorMode === "html"
                ? "Write raw HTML with {{variable}} placeholders."
                : "Design your email with the visual editor."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={previewing}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewing ? "Rendering..." : "Preview"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Template metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name (slug)</Label>
          <Input
            id="name"
            placeholder="monthly-newsletter"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="label">Display Label</Label>
          <Input
            id="label"
            placeholder="Monthly Newsletter"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">
            Subject Line{" "}
            <span className="text-xs text-muted-foreground">
              (supports {"{{variable}}"})
            </span>
          </Label>
          <Input
            id="subject"
            placeholder="Hello {{firstName}}!"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
      </div>

      {/* Editor mode toggle */}
      <div className="flex items-center gap-1 rounded-lg border p-1 w-fit">
        <Button
          variant={editorMode === "html" ? "default" : "ghost"}
          size="sm"
          onClick={() => setEditorMode("html")}
        >
          <Code className="h-4 w-4 mr-1.5" />
          HTML
        </Button>
        <Button
          variant={editorMode === "visual" ? "default" : "ghost"}
          size="sm"
          onClick={() => setEditorMode("visual")}
        >
          <Palette className="h-4 w-4 mr-1.5" />
          Visual
        </Button>
      </div>

      {/* Variables panel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Variable className="h-4 w-4 text-muted-foreground" />
            <Label>Template Variables</Label>
          </div>
          <Button variant="outline" size="sm" onClick={addVariable}>
            <Plus className="h-3 w-3 mr-1" />
            Add Variable
          </Button>
        </div>
        {variables.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No variables defined. Use {"{{variableName}}"} in your{" "}
            {editorMode === "html" ? "HTML" : "template"} and subject line to
            personalize emails.
          </p>
        )}
        {variables.map((variable, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-md border p-3"
          >
            <Input
              placeholder="variableName"
              value={variable.name}
              onChange={(e) => updateVariable(index, "name", e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Default value"
              value={variable.defaultValue ?? ""}
              onChange={(e) =>
                updateVariable(index, "defaultValue", e.target.value)
              }
              className="flex-1"
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={variable.required}
                onCheckedChange={(checked: boolean) =>
                  updateVariable(index, "required", checked)
                }
              />
              <span className="text-xs text-muted-foreground w-16">
                {variable.required ? "Required" : "Optional"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => removeVariable(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Editor area */}
      {editorMode === "html" ? (
        <HtmlEditor value={htmlContent} onChange={setHtmlContent} />
      ) : (
        <div className="rounded-md border min-h-[400px]">
          {MailyEditor ? (
            <MailyEditor
              contentJson={parsedContentJson}
              onCreate={(editor: unknown) => {
                editorRef.current = editor;
              }}
              config={{
                hasMenuBar: true,
                spellCheck: true,
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              {visualEditorLoaded
                ? "Initializing editor..."
                : "Loading visual editor..."}
            </div>
          )}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={previewHtml !== null}
        onOpenChange={() => setPreviewHtml(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          {previewHtml && (
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[60vh] border rounded"
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── HTML Editor with live preview ────────────────────────────────────

function HtmlEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [showPreview, setShowPreview] = useState(true);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>HTML Content</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview((p) => !p)}
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          {showPreview ? "Hide Preview" : "Show Preview"}
        </Button>
      </div>
      <div
        className={
          showPreview ? "grid grid-cols-2 gap-4" : ""
        }
      >
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm min-h-[400px] resize-y"
          placeholder="<html>...</html>"
        />
        {showPreview && (
          <div className="rounded-md border bg-background">
            <iframe
              srcDoc={value}
              className="w-full h-[400px] rounded-md"
              title="HTML Preview"
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
}
