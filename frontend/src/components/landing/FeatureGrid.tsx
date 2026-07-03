"use client";

import Reveal from "./Reveal";

const FEATURES = [
  { title: "VaR / CVaR", desc: "Historical and simulation-based tail risk, side by side." },
  { title: "Monte Carlo", desc: "10,000-path GBM simulation with percentile distributions." },
  { title: "Options / BSM", desc: "Black-Scholes pricing, full Greeks, and IV solving." },
  { title: "Efficient Frontier", desc: "Markowitz optimization — max-Sharpe and min-variance." },
  { title: "Stress Tests", desc: "2008, COVID, dot-com, and more historical shocks." },
  { title: "News Sentiment", desc: "Live headlines with keyword sentiment per ticker." },
  { title: "Excel / PowerBI Export", desc: "Reports whose numbers match the screen." },
  { title: "AI Agent", desc: "A ReAct agent picks the right tools from plain English." },
];

export default function FeatureGrid() {
  return (
    <section id="features" style={{ padding: "112px 24px", maxWidth: 1080, margin: "0 auto" }}>
      <Reveal>
        <h2
          className="serif"
          style={{
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            textAlign: "center",
            color: "var(--l-text)",
            margin: "0 0 12px",
          }}
        >
          A full risk desk, one question away
        </h2>
        <p style={{ textAlign: "center", color: "var(--l-text-dim)", marginBottom: 56 }}>
          Every tool the agent can reach for.
        </p>
      </Reveal>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.05}>
            <div
              className="feature-card"
              style={{
                background: "var(--l-surface)",
                border: "1px solid var(--l-border)",
                borderRadius: 12,
                padding: "24px 22px",
                height: "100%",
              }}
            >
              <div className="mono" style={{ fontSize: 12, color: "var(--l-accent)", marginBottom: 12 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--l-text)", marginBottom: 6 }}>
                {f.title}
              </div>
              <div style={{ fontSize: 14, color: "var(--l-text-dim)", lineHeight: 1.55 }}>{f.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
