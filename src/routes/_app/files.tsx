import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useUploadFile } from "@convex-dev/r2/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Upload, Download, FileIcon } from "lucide-react";
import { formatBytes, getFileType } from "@/lib/utils";

// ── Demo page — shows the R2 upload pattern ──────────────────────────
// Flow: createPendingFile → PUT to R2 → confirmUpload

export const Route = createFileRoute("/_app/files")({
  component: FilesPage,
});

function FilesPage() {
  const files = useQuery(api.storage.files.getMyFiles);
  const uploadFile = useUploadFile(api.storage.r2);
  const generateDownloadUrl = useAction(api.storage.downloads.generateDownloadUrl);
  const createPendingFile = useMutation(api.storage.files.createPendingFile);
  const confirmUpload = useMutation(api.storage.files.confirmUpload);
  const deleteFileMutation = useMutation(api.storage.files.deleteFile);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      // 1. Create pending record in DB
      const fileId = await createPendingFile({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        fileType: getFileType(file.type),
      });

      // 2. Upload to R2 (returns storageKey)
      const storageKey = await uploadFile(file, {
        onProgress: ({ loaded, total }) => {
          setProgress(Math.round((loaded / total) * 100));
        },
      });

      // 3. Confirm upload (attach storageKey, flip pending → complete)
      await confirmUpload({ fileId, storageKey });
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [uploadFile, createPendingFile, confirmUpload]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !uploading) handleUpload(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleDownload(storageKey: string, fileName: string) {
    const url = await generateDownloadUrl({ storageKey });
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Files</h1>
        <p className="text-muted-foreground">
          Upload files via drag & drop or click to browse.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-lg border-2 border-dashed p-8
          transition-colors duration-200 text-center
          ${dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleInputChange}
          disabled={uploading}
        />
        <div className="flex flex-col items-center gap-2">
          <div className={`rounded-full p-3 ${dragOver ? "bg-primary/10" : "bg-muted"}`}>
            <Upload className={`h-6 w-6 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          {uploading ? (
            <>
              <p className="text-sm font-medium">Uploading... {progress}%</p>
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">
                {dragOver ? "Drop file here" : "Drag & drop a file here"}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse
              </p>
            </>
          )}
        </div>
      </div>

      {/* File list */}
      {files === undefined ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No files yet. Upload one above!
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <Card key={file._id} className="animate-fade-in">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{file.fileName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatBytes(file.size)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {file.fileType}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {file.storageKey && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(file.storageKey!, file.fileName)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFileMutation({ fileId: file._id })}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
