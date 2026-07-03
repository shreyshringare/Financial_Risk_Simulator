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
        flex: 1, display: "flex", alignItems: "center",
        border: "1px solid var(--l-border)",
        borderRadius: 10,
        padding: "12px 16px",
        background: "var(--l-surface)",
        transition: "150ms ease-out",
      }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--l-accent)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--l-border)")}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask the desk — e.g. What is the VaR for AAPL?"
          disabled={disabled}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontSize: 14,
            color: "var(--l-text)",
            opacity: disabled ? 0.5 : 1,
          }}
        />
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={disabled}
        style={{
          fontSize: 14,
          fontWeight: 500,
          padding: "10px 22px",
          background: "#003a70",
          border: "none",
          borderRadius: 999,
          color: "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "150ms ease-out",
          whiteSpace: "nowrap",
        }}
      >
        Ask
      </button>
    </form>
  );
}
