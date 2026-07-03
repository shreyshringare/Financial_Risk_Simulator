"use client";

import Reveal from "./Reveal";

const TECH = ["Python", "LangChain", "FastAPI", "Next.js", "Three.js", "Groq · Llama 3.3 70B"];

export default function TechStrip() {
  return (
    <section id="tech" style={{ padding: "72px 24px", borderTop: "1px solid var(--l-border)" }}>
      <Reveal>
        <div
          className="mono"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px 40px",
            fontSize: 14,
            color: "var(--l-text-dim)",
            letterSpacing: 1,
          }}
        >
          {TECH.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
