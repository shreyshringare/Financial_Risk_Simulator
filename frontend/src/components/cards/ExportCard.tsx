"use client";

import type { ExportData } from "@/types/events";
import { API_BASE } from "@/lib/sseClient";
import path from "path";

function filename(filepath: string): string {
  return filepath.split(/[\\/]/).pop() ?? filepath;
}

function downloadUrl(filepath: string): string {
  return `${API_BASE}/api/download/${encodeURIComponent(filename(filepath))}`;
}

export default function ExportCard({ data }: { data: ExportData }) {
  if (data.format === "excel" && data.file) {
    const name = filename(data.file);
    return (
      <div style={{
        border: "1px solid var(--l-border)",
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "var(--l-surface)",
      }}>
        <span style={{ fontSize: 20 }}>📊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--l-text)" }}>Excel Report Ready</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", marginTop: 2 }}>{name}</div>
        </div>
        <a
          href={downloadUrl(data.file)}
          download={name}
          style={{
            background: "#101820",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Download .xlsx
        </a>
      </div>
    );
  }

  if (data.format === "powerbi" && data.files) {
    const entries = Object.entries(data.files);
    return (
      <div style={{
        border: "1px solid var(--l-border)",
        borderRadius: 10,
        padding: "16px 20px",
        background: "var(--l-surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 20 }}>📈</span>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--l-text)" }}>PowerBI Export Ready</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map(([label, filepath]) => {
            const name = filename(filepath);
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", flex: 1 }}>{label}</span>
                <a
                  href={downloadUrl(filepath)}
                  download={name}
                  style={{
                    background: "#101820",
                    color: "#fff",
                    padding: "6px 12px",
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                >
                  {name}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
