"use client";

import Reveal from "./Reveal";

const STEPS = [
  {
    title: "Ask in English",
    desc: "“What is the VaR for AAPL?” — no forms, no config.",
  },
  {
    title: "The agent runs the math",
    desc: "It picks tools: fetches prices, simulates 10,000 paths, computes VaR, CVaR, Sharpe, drawdown.",
  },
  {
    title: "A research note composes itself",
    desc: "Typed events stream in live — data, figures, assessment, caveats.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" style={{ padding: "112px 24px", maxWidth: 900, margin: "0 auto" }}>
      <Reveal>
        <h2
          className="serif"
          style={{
            fontSize: 38,
            fontWeight: 600,
            textAlign: "center",
            color: "var(--l-text)",
            margin: "0 0 56px",
          }}
        >
          How it works
        </h2>
      </Reveal>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.1}>
            <div
              style={{
                background: "var(--l-surface)",
                border: "1px solid var(--l-border)",
                borderLeft: "2px solid var(--l-accent)",
                padding: 24,
                borderRadius: "0 10px 10px 0",
                height: "100%",
              }}
            >
              <div className="mono" style={{ fontSize: 13, color: "var(--l-accent)", marginBottom: 10 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--l-text)", marginBottom: 8 }}>
                {s.title}
              </div>
              <div style={{ fontSize: 14, color: "var(--l-text-dim)", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
