"use client";

import { AnimatePresence, motion } from "framer-motion";

interface Step {
  label: string;
  done: boolean;
}

interface Props {
  steps: Step[];
  streaming: boolean;
}

export default function AgentTimeline({ steps, streaming }: Props) {
  if (steps.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 2, color: "var(--l-text-dim)", marginBottom: 10 }}>
        AGENT ACTIVITY
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <AnimatePresence initial={false}>
          {steps.map((step, i) => (
            <motion.div
              key={`${i}-${step.label}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--l-text-dim)" }}
            >
              {step.done ? (
                <span style={{ color: "#1a7f37", fontSize: 12 }}>✓</span>
              ) : (
                <span className="spinner-ring" />
              )}
              <span style={{ color: step.done ? "var(--l-text-dim)" : "var(--l-text)" }}>
                {step.label}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
