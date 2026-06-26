"use client";

import { useEffect, useState } from "react";

interface Props {
  isStreaming: boolean;
  model: string;
}

export default function StatusBar({ isStreaming, model }: Props) {
  const [time, setTime] = useState(() => utcTime());

  useEffect(() => {
    const id = setInterval(() => setTime(utcTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      height: 28,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      borderTop: "1px solid var(--border)",
      background: "var(--surface)",
      flexShrink: 0,
      fontSize: 10,
      letterSpacing: "0.5px",
      fontFamily: "var(--font-mono)",
      color: "var(--text-faint)",
    }}>
      <span style={{ color: "var(--amber)", letterSpacing: 1 }}>◆ FINSIM ANALYST TERMINAL</span>
      <div style={{ display: "flex", gap: 24 }}>
        <span>
          MODEL: <span style={{ color: "var(--text-dim)" }}>{model || "—"}</span>
        </span>
        <span>
          STATUS:{" "}
          <span
            className={isStreaming ? "streaming-cursor" : undefined}
            style={{ color: isStreaming ? "var(--amber)" : "var(--green)" }}
          >
            {isStreaming ? "PROCESSING" : "READY"}
          </span>
        </span>
        <span style={{ color: "var(--text-faint)" }}>{time} UTC</span>
      </div>
    </div>
  );
}

function utcTime(): string {
  const n = new Date();
  return [
    n.getUTCHours().toString().padStart(2, "0"),
    n.getUTCMinutes().toString().padStart(2, "0"),
    n.getUTCSeconds().toString().padStart(2, "0"),
  ].join(":");
}
