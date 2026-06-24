"use client";
import { FormEvent, useRef } from "react";

interface Props {
  onSubmit: (message: string) => void;
  disabled: boolean;
}

export default function QueryBar({ onSubmit, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (!value || disabled) return;
    onSubmit(value);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10 }}>
      {/* Input wrap */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 8,
        border: "1px solid var(--border)",
        padding: "8px 14px",
        background: "var(--black)",
        transition: "border-color 0.15s",
      }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--amber-dim)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        <span style={{ color: "var(--amber)", fontSize: 14, textShadow: "0 0 8px var(--amber-dim)", flexShrink: 0 }}>▶</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask about any stock or portfolio… (e.g. What is the VaR for AAPL?)"
          disabled={disabled}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontFamily: "var(--font-mono)", fontSize: 12,
            color: "var(--text)", caretColor: "var(--amber)",
            opacity: disabled ? 0.5 : 1,
          }}
        />
      </div>

      {/* Run button */}
      <button
        type="submit"
        disabled={disabled}
        className="font-display"
        style={{
          fontSize: 18, letterSpacing: 2,
          padding: "8px 20px",
          background: "none",
          border: "1px solid var(--amber-dim)",
          color: "var(--amber)",
          cursor: disabled ? "not-allowed" : "pointer",
          textShadow: "0 0 8px var(--amber-dim)",
          opacity: disabled ? 0.5 : 1,
          transition: "all 0.12s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            const el = e.currentTarget;
            el.style.background = "var(--amber-glow)";
            el.style.borderColor = "var(--amber)";
            el.style.boxShadow = "0 0 16px rgba(255,180,60,0.15)";
          }
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.background = "none";
          el.style.borderColor = "var(--amber-dim)";
          el.style.boxShadow = "none";
        }}
      >
        {disabled ? "RUNNING…" : "RUN ▶"}
      </button>
    </form>
  );
}
