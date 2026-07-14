"use client";
import { useRef, useState } from "react";
import { API_BASE } from "@/lib/sseClient";

interface UploadedFile {
  filename: string;
  chunks: number;
}

interface Props {
  sessionId: string;
  disabled?: boolean;
}

export default function DocumentUpload({ sessionId, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file) return;
    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("session_id", sessionId);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        setError(err.detail ?? "Upload failed.");
        return;
      }
      const data = await res.json();
      setUploaded((prev) => {
        const existing = prev.findIndex((f) => f.filename === data.filename);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = { filename: data.filename, chunks: data.chunks };
          return next;
        }
        return [...prev, { filename: data.filename, chunks: data.chunks }];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Drop zone / trigger */}
      <div
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: "1px dashed var(--l-border)",
          borderRadius: 8,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: disabled || uploading ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          background: "var(--l-surface)",
          transition: "150ms ease-out",
          minHeight: 36,
        }}
        onMouseEnter={(e) => {
          if (!disabled && !uploading) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--l-accent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--l-border)";
        }}
      >
        <span style={{ fontSize: 13, color: "var(--l-text-dim)" }}>
          {uploading ? "Uploading…" : "↑ Attach document (PDF, DOCX, TXT, CSV)"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.csv"
          style={{ display: "none" }}
          onChange={handleChange}
          disabled={disabled || uploading}
        />
      </div>

      {/* Uploaded files list */}
      {uploaded.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {uploaded.map((f) => (
            <span
              key={f.filename}
              className="mono"
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 4,
                background: "var(--l-surface-2)",
                border: "1px solid var(--l-border)",
                color: "var(--l-text-dim)",
              }}
              title={`${f.chunks} chunks indexed`}
            >
              {f.filename} · {f.chunks}c
            </span>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop: 4, fontSize: 12, color: "#b91c1c" }}>{error}</div>
      )}
    </div>
  );
}
