"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Suggestion } from "@/lib/suggestions";

const STORAGE_KEY = "finsim-welcomed";

const SAMPLE_QUERIES = [
  "What is the VaR for AAPL?",
  "Analyze a portfolio of AAPL, MSFT, TSLA",
  "Price a $200 call on NVDA expiring in 90 days",
];

interface Props {
  onQuery: (q: string) => void;
  suggestions?: Suggestion[];
}

export default function WelcomeModal({ onQuery, suggestions }: Props) {
  const [open, setOpen] = useState(false);
  const sampleQueries = suggestions && suggestions.length > 0
    ? suggestions.slice(0, 3).map((s) => s.query)
    : SAMPLE_QUERIES;

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable — skip welcome modal
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  function handleChipClick(q: string) {
    dismiss();
    onQuery(q);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={dismiss}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16,24,32,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
              background: "#ffffff",
              border: "1px solid var(--l-border)",
              borderRadius: 12,
              padding: 32,
              maxWidth: 520,
              width: "90vw",
              boxShadow: "0 12px 40px rgba(16,24,32,0.12)",
            }}
          >
            <div
              className="mono"
              style={{ fontSize: 11, letterSpacing: 2, color: "var(--l-accent)", marginBottom: 12 }}
            >
              FINSIM RESEARCH DESK
            </div>
            <h2
              className="serif"
              style={{ fontSize: 24, fontWeight: 600, color: "var(--l-text)", margin: "0 0 12px" }}
            >
              Welcome to the desk
            </h2>
            <p style={{ fontSize: 14, color: "var(--l-text-dim)", lineHeight: 1.6, margin: "0 0 24px" }}>
              Ask a financial risk question in plain English. An AI agent gathers market data, runs
              quantitative models, and composes an analyst research note in front of you.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {sampleQueries.map((q) => (
                <button
                  key={q}
                  onClick={() => handleChipClick(q)}
                  style={{
                    border: "1px solid var(--l-border)",
                    borderRadius: 999,
                    padding: "8px 16px",
                    fontSize: 13,
                    background: "none",
                    color: "var(--l-text)",
                    cursor: "pointer",
                    transition: "150ms ease-out",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--l-surface-2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  {q}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ fontSize: 12, color: "var(--l-text-dim)", lineHeight: 1.5 }}>
                Market data via yfinance. Rate-limited demo. Educational use only.
              </div>
              <button
                onClick={dismiss}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "10px 22px",
                  background: "var(--l-accent)",
                  border: "none",
                  borderRadius: 999,
                  color: "#fff",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Begin
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
