"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

function Counter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 900, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value]);
  return (
    <span ref={ref} className="serif" style={{ fontSize: 40, fontWeight: 600, color: "var(--l-text)" }}>
      {prefix}
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

const STATS: Array<{ value: number; prefix?: string; suffix?: string; label: string }> = [
  { value: 10000, suffix: "+", label: "Simulated price paths per query" },
  { value: 12, label: "Analysis tools the agent can call" },
  { value: 5, label: "Historical stress scenarios" },
  { value: 1, prefix: "<", suffix: "s", label: "To first streamed token" },
];

export default function StatStrip() {
  return (
    <section
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: 56,
        padding: "72px 24px",
        borderTop: "1px solid var(--l-border)",
        borderBottom: "1px solid var(--l-border)",
      }}
    >
      {STATS.map((s) => (
        <div key={s.label} style={{ textAlign: "center" }}>
          <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} />
          <div style={{ fontSize: 13, color: "var(--l-text-dim)", marginTop: 6 }}>{s.label}</div>
        </div>
      ))}
    </section>
  );
}
