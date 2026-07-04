"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const COMMANDS = [
  "What is the VaR for AAPL?",
  "Run a Monte Carlo simulation for TSLA",
  "Analyze a portfolio of AAPL, MSFT, GOOGL",
  "Stress test NVDA against the 2008 financial crisis",
  "Compute the efficient frontier for AAPL, MSFT, TSLA",
  "Price a $200 call on NVDA expiring in 90 days",
  "Get the latest news for MSFT",
  "Export a risk report for AAPL to Excel",
];

interface Props {
  onQuery: (q: string) => void;
  disabled: boolean;
}

export default function CommandPalette({ onQuery, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const q = query.trim();
    const filtered = q
      ? COMMANDS.filter((c) => c.toLowerCase().includes(q.toLowerCase()))
      : COMMANDS;
    const hasExact = filtered.some((c) => c.toLowerCase() === q.toLowerCase());
    const list = [...filtered];
    if (q && !hasExact) list.push(`Ask: ${q}`);
    return list;
  }, [query]);

  // Global Ctrl/Cmd+K toggle
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const isK = e.key === "k" || e.key === "K";
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Focus after mount animation starts
      const id = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  function runRow(index: number) {
    if (disabled) return;
    const row = rows[index];
    if (!row) return;
    const value = row.startsWith("Ask: ") ? row.slice(5) : row;
    setOpen(false);
    onQuery(value);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!disabled) runRow(selected);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16,24,32,0.4)",
            zIndex: 1000,
          }}
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "18vh",
              left: "50%",
              transform: "translateX(-50%)",
              width: 560,
              maxWidth: "90vw",
              background: "#ffffff",
              border: "1px solid var(--l-border)",
              borderRadius: 12,
              boxShadow: "0 12px 40px rgba(16,24,32,0.12)",
              overflow: "hidden",
            }}
          >
            <div style={{ borderBottom: "1px solid var(--l-border)" }}>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a query or search commands…"
                style={{
                  width: "100%",
                  fontSize: 14,
                  fontFamily: "var(--font-inter), system-ui, sans-serif",
                  padding: "14px 16px",
                  border: "none",
                  outline: "none",
                  color: "var(--l-text)",
                  background: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {rows.map((row, i) => {
                const isSelected = i === selected;
                return (
                  <div
                    key={row + i}
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => runRow(i)}
                    style={{
                      fontSize: 13,
                      padding: "10px 16px",
                      cursor: disabled ? "not-allowed" : "pointer",
                      color: "var(--l-text)",
                      background: isSelected ? "var(--l-accent-soft)" : "none",
                      borderLeft: isSelected ? "2px solid var(--l-accent)" : "2px solid transparent",
                      opacity: disabled ? 0.5 : 1,
                      transition: "background 100ms ease-out",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row}
                  </div>
                );
              })}
              {rows.length === 0 && (
                <div style={{ fontSize: 13, padding: "10px 16px", color: "var(--l-text-dim)" }}>
                  No matches
                </div>
              )}
            </div>

            <div
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--l-text-dim)",
                padding: "8px 16px",
                borderTop: "1px solid var(--l-border)",
                background: "var(--l-surface-2)",
              }}
            >
              ↑↓ navigate · ↵ run · esc close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
