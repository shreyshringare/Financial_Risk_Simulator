# Plan 2: SaaS Frontend — Landing + Terminal Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-1% SaaS landing page at `/` with an R3F 3D Monte Carlo hero, move the phosphor terminal to `/app`, and upgrade the terminal with welcome modal, command palette, history rail, and skeleton loaders.

**Architecture:** Route split — `src/app/page.tsx` becomes the landing (server component shell + client sections), the existing terminal moves verbatim to `src/app/app/page.tsx`. Landing components live in `src/components/landing/`. Terminal upgrades live in `src/components/` beside existing components. Three.js loads only on `/` via `next/dynamic`.

**Tech Stack:** Next.js 16.2.9, React 19.2.4, Tailwind v4, three + @react-three/fiber@^9 + @react-three/drei@^10, framer-motion@^12 (React 19 compatible).

**Commit policy:** NO AI attribution. Plain conventional commits.

**MANDATORY before writing any code:** `frontend/AGENTS.md` warns this Next.js version has breaking changes vs training data. Read the routing + fonts + dynamic-import guides in `frontend/node_modules/next/dist/docs/` first. If an API in this plan conflicts with those docs, the docs win.

---

### Task 1: Move terminal to /app

**Files:**
- Create: `frontend/src/app/app/page.tsx` (moved content)
- Modify: `frontend/src/app/page.tsx` (temporary redirect until Task 6)
- Modify: `frontend/src/lib/sseClient.ts` (export API_BASE)

- [ ] **Step 1: Export API_BASE from sseClient**

In `frontend/src/lib/sseClient.ts` change line 3 to:

```typescript
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
```

(If Plan 1 Task 3 already made it env-based, just add `export`.)

- [ ] **Step 2: Move the terminal**

`git mv` is not enough because both paths exist in the same tree state; do:

```bash
mkdir frontend/src/app/app
git mv frontend/src/app/page.tsx frontend/src/app/app/page.tsx
```

In the moved file, fix the hardcoded health fetch (old line 145):

```typescript
import { streamChat, API_BASE } from "@/lib/sseClient";
// ...
    fetch(`${API_BASE}/api/health`)
```

- [ ] **Step 3: Temporary root redirect**

Create new `frontend/src/app/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/app");
}
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: builds; `/` redirects to `/app` in dev (`npm run dev`, open localhost:3000)

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(frontend): move terminal to /app, env-based health fetch"
```

---

### Task 2: Landing dependencies + design tokens

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Modify: `frontend/src/app/globals.css` (append landing tokens)
- Modify: `frontend/src/app/layout.tsx` (Inter font for landing)

- [ ] **Step 1: Install**

```bash
cd frontend
npm install three @react-three/fiber @react-three/drei framer-motion
npm install -D @types/three
```

Verify installed fiber major is ≥9 (React 19 requirement): `npm ls @react-three/fiber`

- [ ] **Step 2: Fonts**

Check `node_modules/next/dist/docs/` for the current font API. Expected shape
(`next/font/google`) in `frontend/src/app/layout.tsx`:

```typescript
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
```

Add `inter.variable` to the `<body>` className alongside existing classes.
Do not remove the VT323 / IBM Plex Mono loading — the terminal still uses them.

- [ ] **Step 3: Append landing tokens to `globals.css`**

> **DESIGN PIVOT (2026-07-03, user request):** Landing aesthetic changed from dark
> SaaS to Anthropic-style light minimalism — cream background, serif display
> headlines (Fraunces), near-black text, muted burnt-amber accent, thin borders,
> generous whitespace, NO glow/glassmorphism/neon. Hero 3D becomes subtle: muted
> amber particles on cream, normal blending. Terminal at /app keeps phosphor look.
> Token block below is the CURRENT spec; the dark values first committed in
> 85ee6bb get revised by a follow-up commit.

```css
/* ── Landing design tokens (light minimal) ─────────────── */
:root {
  --l-bg: #faf9f5;
  --l-surface: #ffffff;
  --l-surface-2: #f0efe9;
  --l-border: rgba(20, 20, 19, 0.10);
  --l-text: #141413;
  --l-text-dim: #6e6e69;
  --l-accent: #b45309;
  --l-accent-soft: rgba(180, 83, 9, 0.10);
  --l-ink: #141413;
}

.landing {
  background: var(--l-bg);
  color: var(--l-text);
  font-family: var(--font-inter), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.landing ::selection { background: var(--l-accent-soft); }
.landing .mono { font-family: var(--font-mono), monospace; }

@media (prefers-reduced-motion: reduce) {
  .landing * { animation: none !important; transition: none !important; }
}
```

Important: the global scanline/vignette overlays (`body::before` / `body::after`)
must not cover the landing. Scope them: change their selectors from `body::before`
to `.terminal-shell::before` (etc.) and add `className="terminal-shell"` to the
terminal page's root div in `src/app/app/page.tsx`. Verify terminal still shows
scanlines after this change.

- [ ] **Step 4: Verify build, commit**

```bash
cd frontend && npx tsc --noEmit && npm run build
git add -A frontend
git commit -m "feat(landing): deps (three/r3f/framer-motion), design tokens, scoped CRT overlays"
```

---

### Task 3: 3D hero scene (R3F Monte Carlo particles)

**Files:**
- Create: `frontend/src/components/landing/HeroScene.tsx`

> **PIVOT NOTE:** light-minimal variant — particles use muted burnt amber
> `#b45309` with NORMAL blending (no additive glow), opacity ~0.35, fog colored
> to cream `#faf9f5`, `pointsMaterial size 0.03`. Everything else (GBM logic,
> camera drift, parallax) unchanged.

- [ ] **Step 1: Implement the scene**

Particles simulate GBM paths on the fly: each particle advances along time-axis
x, log-price wanders on y, path lane on z. On reaching max age it respawns at
origin — continuous fan-out. 4000 points, muted amber on cream.

```tsx
"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 4000;
const MAX_AGE = 6; // seconds a particle lives
const DRIFT = 0.02;
const VOL = 0.55;

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function Particles() {
  const points = useRef<THREE.Points>(null!);
  const { positions, ages, prices, lanes } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const ages = new Float32Array(COUNT);
    const prices = new Float32Array(COUNT);
    const lanes = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      ages[i] = Math.random() * MAX_AGE; // stagger
      prices[i] = 0;
      lanes[i] = (Math.random() - 0.5) * 4;
    }
    return { positions, ages, prices, lanes };
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < COUNT; i++) {
      ages[i] += dt;
      if (ages[i] > MAX_AGE) {
        ages[i] = 0;
        prices[i] = 0;
      }
      prices[i] += DRIFT * dt + VOL * Math.sqrt(dt) * gauss();
      const t = ages[i] / MAX_AGE;
      positions[i * 3] = -4 + t * 9;          // x: time
      positions[i * 3 + 1] = prices[i];        // y: log price walk
      positions[i * 3 + 2] = lanes[i] * t;     // z: fan out over time
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    // slow orbit + mouse parallax
    const { x, y } = state.pointer;
    state.camera.position.x = Math.sin(state.clock.elapsedTime * 0.05) * 1.5 + x * 0.6;
    state.camera.position.y = 0.5 + y * 0.4;
    state.camera.lookAt(0.5, 0, 0);
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#ffb43c"
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.5, 6], fov: 55 }}
      gl={{ antialias: false, powerPreference: "low-power" }}
      dpr={[1, 1.5]}
      style={{ position: "absolute", inset: 0 }}
    >
      <Particles />
      <fog attach="fog" args={["#0a0a0b", 6, 12]} />
    </Canvas>
  );
}
```

Note: `<bufferAttribute args={[array, itemSize]}>` is the R3F v9 form. If R3F
docs installed in node_modules disagree, follow them.

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/HeroScene.tsx
git commit -m "feat(landing): 3D Monte Carlo particle hero scene (R3F)"
```

---

### Task 4: Landing section components

> **PIVOT NOTE:** all section code below was written for the dark theme; the
> dispatched implementation uses the light-minimal restyle: cream bg, serif
> (`--font-serif`) display headlines, near-black pill CTAs (`#141413` bg, white
> text, `border-radius: 999px`), thin `--l-border` card borders, NO glow
> shadows, NO backdrop blur except nav (`rgba(250,249,245,0.8)` + blur). Layout,
> structure, motion, and copy stay as specified below.

**Files:**
- Create: `frontend/src/components/landing/Nav.tsx`
- Create: `frontend/src/components/landing/Hero.tsx`
- Create: `frontend/src/components/landing/StatStrip.tsx`
- Create: `frontend/src/components/landing/FeatureGrid.tsx`
- Create: `frontend/src/components/landing/HowItWorks.tsx`
- Create: `frontend/src/components/landing/TechStrip.tsx`
- Create: `frontend/src/components/landing/CTABanner.tsx`
- Create: `frontend/src/components/landing/Footer.tsx`
- Create: `frontend/src/components/landing/Reveal.tsx` (shared scroll-reveal)

All are client components (`"use client"`) using framer-motion. Shared reveal
wrapper to keep motion consistent (fade + 12px rise, once):

- [ ] **Step 1: Reveal.tsx**

```tsx
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Nav.tsx**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", gap: 28,
        padding: "16px 32px",
        background: scrolled ? "rgba(10,10,11,0.72)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid var(--l-border)" : "1px solid transparent",
        transition: "all 200ms ease-out",
      }}
    >
      <span className="mono" style={{ color: "var(--l-accent)", fontWeight: 700, letterSpacing: 1 }}>
        ◆ FINSIM
      </span>
      <div style={{ display: "flex", gap: 20, fontSize: 14, color: "var(--l-text-dim)" }}>
        <a href="#features" style={{ color: "inherit", textDecoration: "none" }}>Features</a>
        <a href="#how" style={{ color: "inherit", textDecoration: "none" }}>How it works</a>
        <a href="#tech" style={{ color: "inherit", textDecoration: "none" }}>Tech</a>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
        <a
          href="https://github.com/shreyshringare/FinancialRiskSimulator"
          style={{ fontSize: 14, color: "var(--l-text-dim)", textDecoration: "none" }}
        >
          GitHub
        </a>
        <Link
          href="/app"
          style={{
            background: "var(--l-accent)", color: "#0a0a0b", fontWeight: 600,
            fontSize: 14, padding: "8px 16px", borderRadius: 8, textDecoration: "none",
          }}
        >
          Launch Terminal
        </Link>
      </div>
    </nav>
  );
}
```

(Confirm the GitHub URL with `git remote get-url origin` and use the real one.)

- [ ] **Step 3: Hero.tsx**

```tsx
"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 50% at 50% 40%, rgba(255,180,60,0.08), transparent)" }} />,
});

export default function Hero() {
  return (
    <section style={{ position: "relative", minHeight: "92vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <HeroScene />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 780, padding: "0 24px" }}>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="mono" style={{ color: "var(--l-accent)", fontSize: 13, letterSpacing: 2, marginBottom: 20 }}
        >
          AGENTIC FINANCIAL RISK PLATFORM
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
          style={{ fontSize: "clamp(40px, 6vw, 68px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}
        >
          Institutional-grade risk analysis.
          <br />
          <span style={{ color: "var(--l-text-dim)" }}>In plain English.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }}
          style={{ fontSize: 18, color: "var(--l-text-dim)", margin: "24px auto 36px", maxWidth: 560, lineHeight: 1.6 }}
        >
          Ask a question. An AI agent runs Monte Carlo simulations, VaR, options
          pricing, and stress tests — then streams back an analyst report.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
          style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}
        >
          <Link
            href="/app"
            style={{
              background: "var(--l-accent)", color: "#0a0a0b", fontWeight: 600,
              padding: "13px 26px", borderRadius: 10, textDecoration: "none", fontSize: 16,
              boxShadow: "0 0 32px rgba(255,180,60,0.25)",
            }}
          >
            Try the demo — no sign-up needed
          </Link>
          <a
            href="https://github.com/shreyshringare/FinancialRiskSimulator"
            style={{
              border: "1px solid var(--l-border)", color: "var(--l-text)",
              padding: "13px 26px", borderRadius: 10, textDecoration: "none", fontSize: 16,
            }}
          >
            View on GitHub
          </a>
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: StatStrip.tsx (animated counters)**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

const STATS = [
  { value: 10000, suffix: "+", label: "Simulated price paths per query" },
  { value: 11, suffix: "", label: "Analysis tools the agent can call" },
  { value: 5, suffix: "", label: "Historical stress scenarios" },
  { value: 1, prefix: "<", suffix: "s", label: "To first streamed token" },
];

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
  return <span ref={ref} className="mono" style={{ fontSize: 36, fontWeight: 700, color: "var(--l-text)" }}>{prefix}{n.toLocaleString()}{suffix}</span>;
}

export default function StatStrip() {
  return (
    <section style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 56, padding: "72px 24px", borderTop: "1px solid var(--l-border)", borderBottom: "1px solid var(--l-border)" }}>
      {STATS.map((s) => (
        <div key={s.label} style={{ textAlign: "center", minWidth: 180 }}>
          <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} />
          <div style={{ fontSize: 13, color: "var(--l-text-dim)", marginTop: 6 }}>{s.label}</div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: FeatureGrid.tsx**

```tsx
"use client";

import Reveal from "./Reveal";

const FEATURES = [
  { icon: "📉", title: "VaR / CVaR", desc: "Historical and GBM simulation-based tail risk, side by side." },
  { icon: "🎲", title: "Monte Carlo", desc: "10,000-path GBM simulation with percentile fan charts." },
  { icon: "🧮", title: "Options / BSM", desc: "Black-Scholes pricing, full Greeks, and IV solving." },
  { icon: "📊", title: "Efficient Frontier", desc: "Markowitz optimization — max-Sharpe and min-variance portfolios." },
  { icon: "⚡", title: "Stress Tests", desc: "2008, COVID, dot-com, and more historical shock scenarios." },
  { icon: "📰", title: "News Sentiment", desc: "Live headlines with keyword sentiment per ticker." },
  { icon: "📁", title: "Excel / PowerBI Export", desc: "Full risk reports exported with numbers that match the screen." },
  { icon: "🤖", title: "AI Agent", desc: "LangChain ReAct agent picks the right tools from plain English." },
];

export default function FeatureGrid() {
  return (
    <section id="features" style={{ padding: "112px 24px", maxWidth: 1080, margin: "0 auto" }}>
      <Reveal>
        <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center", margin: "0 0 12px" }}>
          A full risk desk, one query bar
        </h2>
        <p style={{ textAlign: "center", color: "var(--l-text-dim)", margin: "0 0 56px" }}>
          Every tool the agent can reach for.
        </p>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.05}>
            <div
              className="feature-card"
              style={{
                background: "var(--l-surface)", border: "1px solid var(--l-border)",
                borderRadius: 12, padding: "22px 20px", height: "100%",
                transition: "border-color 200ms ease-out, transform 200ms ease-out",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: "var(--l-text-dim)", lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
```

Add hover rule to `globals.css`:

```css
.landing .feature-card:hover {
  border-color: rgba(255, 180, 60, 0.35);
  transform: translateY(-2px);
}
```

- [ ] **Step 6: HowItWorks.tsx**

```tsx
"use client";

import Reveal from "./Reveal";

const STEPS = [
  { n: "01", title: "Ask in English", desc: "“What is the VaR for AAPL?” — no forms, no config." },
  { n: "02", title: "The agent runs the math", desc: "It picks tools: fetches prices, simulates 10,000 paths, computes VaR, CVaR, Sharpe, drawdown." },
  { n: "03", title: "Report streams in", desc: "Typed SSE events render analyst cards live — data, charts, verdict, caveats." },
];

export default function HowItWorks() {
  return (
    <section id="how" style={{ padding: "112px 24px", maxWidth: 900, margin: "0 auto" }}>
      <Reveal>
        <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center", margin: "0 0 56px" }}>
          How it works
        </h2>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1}>
            <div style={{ padding: 24, borderLeft: "2px solid var(--l-accent)", background: "var(--l-surface)" }}>
              <div className="mono" style={{ color: "var(--l-accent)", fontSize: 13, marginBottom: 10 }}>{s.n}</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 14, color: "var(--l-text-dim)", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: TechStrip.tsx, CTABanner.tsx, Footer.tsx**

```tsx
// TechStrip.tsx
"use client";

import Reveal from "./Reveal";

const TECH = ["Python", "LangChain", "FastAPI", "Next.js", "Three.js", "Groq · Llama 3.3 70B"];

export default function TechStrip() {
  return (
    <section id="tech" style={{ padding: "72px 24px", borderTop: "1px solid var(--l-border)" }}>
      <Reveal>
        <div className="mono" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px 40px", color: "var(--l-text-dim)", fontSize: 14, letterSpacing: 1 }}>
          {TECH.map((t) => <span key={t}>{t}</span>)}
        </div>
      </Reveal>
    </section>
  );
}
```

```tsx
// CTABanner.tsx
"use client";

import Link from "next/link";
import Reveal from "./Reveal";

export default function CTABanner() {
  return (
    <section style={{ padding: "112px 24px", textAlign: "center", background: "radial-gradient(50% 80% at 50% 100%, rgba(255,180,60,0.10), transparent)" }}>
      <Reveal>
        <h2 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 28px" }}>
          Run your first analysis in 10 seconds
        </h2>
        <Link
          href="/app"
          style={{
            display: "inline-block", background: "var(--l-accent)", color: "#0a0a0b",
            fontWeight: 600, padding: "14px 30px", borderRadius: 10, textDecoration: "none", fontSize: 17,
          }}
        >
          Launch Terminal →
        </Link>
      </Reveal>
    </section>
  );
}
```

```tsx
// Footer.tsx
export default function Footer() {
  return (
    <footer style={{ padding: "32px 24px", borderTop: "1px solid var(--l-border)", display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", fontSize: 13, color: "var(--l-text-dim)" }}>
      <span className="mono">◆ FINSIM — open-source financial risk simulator</span>
      <span>Educational use only. Not investment advice.</span>
    </footer>
  );
}
```

- [ ] **Step 8: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/landing frontend/src/app/globals.css
git commit -m "feat(landing): nav, hero, stats, features, how-it-works, tech, CTA, footer"
```

---

### Task 5: Product frame section (terminal screenshot)

**Files:**
- Create: `frontend/src/components/landing/ProductFrame.tsx`
- Create: `frontend/public/screenshot-terminal.png` (captured, not drawn)

- [ ] **Step 1: Capture screenshot**

Run both servers, run a real AAPL query in the terminal, capture a 1440-wide
screenshot of the full report, save as `frontend/public/screenshot-terminal.png`.
(Use the /browse headless browser: `goto localhost:3000/app`, fill query, wait,
`screenshot`.)

- [ ] **Step 2: ProductFrame.tsx**

```tsx
"use client";

import Image from "next/image";
import Reveal from "./Reveal";

export default function ProductFrame() {
  return (
    <section style={{ padding: "48px 24px 112px", maxWidth: 1080, margin: "0 auto" }}>
      <Reveal>
        <div
          style={{
            borderRadius: 14, border: "1px solid var(--l-border)", overflow: "hidden",
            boxShadow: "0 24px 80px rgba(255,180,60,0.10), 0 8px 28px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", gap: 6, padding: "10px 14px", background: "var(--l-surface-2)", borderBottom: "1px solid var(--l-border)" }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.8 }} />
            ))}
          </div>
          <Image
            src="/screenshot-terminal.png"
            alt="FinSim analyst terminal showing a streamed AAPL risk report"
            width={2160}
            height={1350}
            style={{ width: "100%", height: "auto", display: "block" }}
            priority={false}
          />
        </div>
      </Reveal>
    </section>
  );
}
```

(Set `width`/`height` to the actual captured dimensions.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/ProductFrame.tsx frontend/public/screenshot-terminal.png
git commit -m "feat(landing): product frame with real terminal screenshot"
```

---

### Task 6: Assemble landing page

**Files:**
- Modify: `frontend/src/app/page.tsx` (replace redirect)
- Modify: `frontend/src/app/layout.tsx` (metadata)

- [ ] **Step 1: page.tsx**

```tsx
import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import StatStrip from "@/components/landing/StatStrip";
import FeatureGrid from "@/components/landing/FeatureGrid";
import ProductFrame from "@/components/landing/ProductFrame";
import HowItWorks from "@/components/landing/HowItWorks";
import TechStrip from "@/components/landing/TechStrip";
import CTABanner from "@/components/landing/CTABanner";
import Footer from "@/components/landing/Footer";

export default function Landing() {
  return (
    <div className="landing">
      <Nav />
      <Hero />
      <StatStrip />
      <FeatureGrid />
      <ProductFrame />
      <HowItWorks />
      <TechStrip />
      <CTABanner />
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Metadata in layout.tsx**

```typescript
export const metadata: Metadata = {
  title: "FinSim — Agentic Financial Risk Simulator",
  description:
    "AI agent that runs Monte Carlo simulations, VaR/CVaR, options pricing, and stress tests from plain-English questions. Streams back an analyst report.",
  openGraph: {
    title: "FinSim — Agentic Financial Risk Simulator",
    description: "Institutional-grade risk analysis in plain English.",
    images: ["/screenshot-terminal.png"],
  },
};
```

- [ ] **Step 3: Verify full landing**

```bash
cd frontend && npm run build && npm run dev
```

Manual check: scroll whole page, hero particles animate, counters fire,
feature hover works, CTA routes to `/app`, back button returns to `/`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app
git commit -m "feat(landing): assemble landing page, OG metadata"
```

---

### Task 7: Welcome modal in terminal

**Files:**
- Create: `frontend/src/components/WelcomeModal.tsx`
- Modify: `frontend/src/app/app/page.tsx` (mount it)

- [ ] **Step 1: WelcomeModal.tsx**

Phosphor-styled, localStorage-dismissed, sample queries clickable.

```tsx
"use client";

import { useEffect, useState } from "react";

const SAMPLES = [
  "What is the VaR for AAPL?",
  "Analyze a portfolio of AAPL, MSFT, TSLA",
  "Price a $200 call on NVDA expiring in 90 days",
];

export default function WelcomeModal({ onQuery }: { onQuery: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem("finsim-welcomed")) setOpen(true);
  }, []);
  const dismiss = () => {
    localStorage.setItem("finsim-welcomed", "1");
    setOpen(false);
  };
  if (!open) return null;
  return (
    <div
      onClick={dismiss}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, width: "100%", background: "var(--card)", border: "1px solid var(--border)", borderLeft: "3px solid var(--amber)", padding: 28 }}
      >
        <div className="font-display" style={{ fontSize: 24, color: "var(--amber-bright)", marginBottom: 10 }}>
          ◆ WELCOME TO FINSIM
        </div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, margin: "0 0 16px" }}>
          Ask a financial risk question in plain English. An AI agent fetches
          market data, runs Monte Carlo simulations, and streams back an analyst
          report. Try one:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {SAMPLES.map((q) => (
            <button
              key={q}
              onClick={() => { dismiss(); onQuery(q); }}
              style={{
                textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)",
                color: "var(--text)", padding: "9px 12px", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 12,
              }}
            >
              ▸ {q}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "0 0 14px" }}>
          Demo mode: rate-limited, market data via yfinance. First response may
          take ~30s if the backend was asleep.
        </p>
        <button
          onClick={dismiss}
          style={{ background: "var(--amber)", color: "#050505", border: "none", padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-mono)" }}
        >
          GOT IT
        </button>
      </div>
    </div>
  );
}
```

Mount inside the Terminal component's root div (`src/app/app/page.tsx`):

```tsx
<WelcomeModal onQuery={handleQuery} />
```

- [ ] **Step 2: Verify, commit**

Manual: fresh profile (or clear localStorage) → modal shows; sample click runs
query; second visit → no modal.

```bash
git add frontend/src
git commit -m "feat(app): welcome modal with sample queries"
```

---

### Task 8: Command palette (Ctrl+K)

**Files:**
- Create: `frontend/src/components/CommandPalette.tsx`
- Modify: `frontend/src/app/app/page.tsx` (mount + shortcut)

- [ ] **Step 1: CommandPalette.tsx**

No new dependency — a small filtered list. Commands: sample queries + free-text
"run query" + focus query bar.

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

export default function CommandPalette({ onQuery, disabled }: { onQuery: (q: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const f = filter.toLowerCase();
    const hits = COMMANDS.filter((c) => c.toLowerCase().includes(f));
    return filter && !hits.some((h) => h.toLowerCase() === f) ? [...hits, `Ask: ${filter}`] : hits;
  }, [filter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setFilter("");
        setSelected(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const run = (cmd: string) => {
    setOpen(false);
    if (!disabled) onQuery(cmd.startsWith("Ask: ") ? cmd.slice(5) : cmd);
  };

  if (!open) return null;
  return (
    <div
      onClick={() => setOpen(false)}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", paddingTop: "18vh" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: "90vw", height: "fit-content", background: "var(--card)", border: "1px solid var(--amber-dim)", boxShadow: "0 0 40px rgba(255,180,60,0.15)" }}
      >
        <input
          ref={inputRef}
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setSelected(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, matches.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && matches[selected]) run(matches[selected]);
          }}
          placeholder="Type a query or search commands…"
          style={{
            width: "100%", boxSizing: "border-box", background: "var(--surface)", border: "none",
            borderBottom: "1px solid var(--border)", color: "var(--text)", padding: "13px 16px",
            fontFamily: "var(--font-mono)", fontSize: 13, outline: "none",
          }}
        />
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {matches.map((m, i) => (
            <button
              key={m}
              onClick={() => run(m)}
              onMouseEnter={() => setSelected(i)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 16px",
                background: i === selected ? "rgba(255,180,60,0.10)" : "transparent",
                border: "none", borderLeft: i === selected ? "2px solid var(--amber)" : "2px solid transparent",
                color: i === selected ? "var(--amber-bright)" : "var(--text-dim)",
                cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12,
              }}
            >
              ▸ {m}
            </button>
          ))}
          {matches.length === 0 && (
            <div style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
              No matches
            </div>
          )}
        </div>
        <div style={{ padding: "7px 16px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
          ↑↓ navigate · ↵ run · esc close
        </div>
      </div>
    </div>
  );
}
```

Mount in Terminal: `<CommandPalette onQuery={handleQuery} disabled={state.streaming} />`
Add a hint in the header: `<span style={{ fontSize: 10, color: "var(--text-faint)" }}>⌘K</span>`

- [ ] **Step 2: Verify, commit**

Manual: Ctrl+K opens, arrows navigate, Enter runs, free text runs as query.

```bash
git add frontend/src
git commit -m "feat(app): command palette (Ctrl+K) with quick queries"
```

---

### Task 9: History rail

**Files:**
- Modify: `frontend/src/app/app/page.tsx` (history state + restore)
- Modify: `frontend/src/components/Sidebar.tsx` (render history list)

- [ ] **Step 1: Add history to Terminal state**

In `src/app/app/page.tsx`, add beside existing state:

```tsx
type HistoryEntry = { query: string; at: number; sections: ReportSection[] };
const [history, setHistory] = useState<HistoryEntry[]>([]);
```

In `handleQuery`, after the stream loop completes successfully (after the
`for await` block, before catch), snapshot:

```tsx
// capture completed report — use functional dispatch to read final sections
setHistory((h) => [...h.slice(-9), { query: message, at: Date.now(), sections: sectionsRef.current }]);
```

The reducer state isn't directly visible post-loop; add a ref mirror:

```tsx
const sectionsRef = useRef<ReportSection[]>([]);
useEffect(() => { sectionsRef.current = state.sections; }, [state.sections]);
```

Add a `RESTORE` action to the reducer:

```tsx
| { type: "RESTORE"; sections: ReportSection[] }
// in reducer:
case "RESTORE":
  return { ...state, sections: action.sections, streaming: false, error: null };
```

- [ ] **Step 2: Render in Sidebar**

Add props `history: { query: string; at: number }[]` and `onRestore: (i: number) => void`
to `Sidebar.tsx`; render below quick queries:

```tsx
{history.length > 0 && (
  <div style={{ marginTop: 20 }}>
    <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: 2, marginBottom: 8 }}>SESSION HISTORY</div>
    {history.map((h, i) => (
      <button
        key={h.at}
        onClick={() => onRestore(i)}
        style={{
          display: "block", width: "100%", textAlign: "left",
          background: "none", border: "none", borderLeft: "2px solid var(--border)",
          color: "var(--text-dim)", padding: "6px 10px", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 11,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
        title={h.query}
      >
        {new Date(h.at).toLocaleTimeString()} · {h.query}
      </button>
    ))}
  </div>
)}
```

Wire in Terminal:

```tsx
<Sidebar
  onQuery={handleQuery}
  disabled={state.streaming}
  open={sidebarOpen}
  history={history.map(({ query, at }) => ({ query, at }))}
  onRestore={(i) => dispatch({ type: "RESTORE", sections: history[i].sections })}
/>
```

- [ ] **Step 3: Verify, commit**

Manual: run two queries → both listed; click first → report restored instantly.

```bash
git add frontend/src
git commit -m "feat(app): session history rail with instant report restore"
```

---

### Task 10: Skeleton loaders

**Files:**
- Create: `frontend/src/components/cards/SkeletonCard.tsx`
- Modify: `frontend/src/components/ReportArea.tsx`
- Modify: `frontend/src/app/globals.css` (shimmer keyframes)

- [ ] **Step 1: SkeletonCard.tsx**

```tsx
export default function SkeletonCard() {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: "3px solid var(--amber-dim)", padding: 18 }}>
      <div className="skeleton-line" style={{ width: "30%", height: 14, marginBottom: 12 }} />
      <div className="skeleton-line" style={{ width: "85%", height: 10, marginBottom: 8 }} />
      <div className="skeleton-line" style={{ width: "70%", height: 10, marginBottom: 8 }} />
      <div className="skeleton-line" style={{ width: "50%", height: 10 }} />
    </div>
  );
}
```

globals.css:

```css
.skeleton-line {
  background: linear-gradient(90deg, rgba(255,180,60,0.06) 25%, rgba(255,180,60,0.14) 50%, rgba(255,180,60,0.06) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 2: Show in ReportArea while streaming with no trailing card**

In `ReportArea.tsx`, after rendering `sections`, add:

```tsx
{streaming && <SkeletonCard />}
```

Only when the last section isn't an actively-streaming verdict/prose (check:
`!sections.some((s) => (s.kind === "verdict" || s.kind === "prose") && s.streaming)`).

- [ ] **Step 3: Verify, commit**

Manual: submit query → shimmer card until first section prints.

```bash
git add frontend/src
git commit -m "feat(app): skeleton shimmer loaders during tool runs"
```

---

### Task 11: 404 page + responsive pass

**Files:**
- Create: `frontend/src/app/not-found.tsx`
- Modify: landing components (mobile spacing), `frontend/src/app/app/page.tsx`

- [ ] **Step 1: not-found.tsx**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="landing" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <span className="mono" style={{ color: "var(--l-accent)", fontSize: 60, fontWeight: 700 }}>404</span>
      <p style={{ color: "var(--l-text-dim)" }}>This path simulated to zero.</p>
      <Link href="/" style={{ color: "var(--l-accent)" }}>← Back to FinSim</Link>
    </div>
  );
}
```

- [ ] **Step 2: Responsive checks**

Use /browse `responsive` (375/768/1280) on `/` and `/app`. Fix findings:
- Nav: hide pill links below 640px (wrap in a div with `className="nav-links"`,
  add `@media (max-width: 640px) { .landing .nav-links { display: none; } }`)
- Hero headline: `clamp()` already handles size
- Command palette: `maxWidth: "90vw"` already set
- Feature grid: `auto-fit minmax(240px,1fr)` already collapses

- [ ] **Step 3: Full verify + commit**

```bash
cd frontend && npx tsc --noEmit && npm run build
git add frontend/src
git commit -m "feat(frontend): 404 page + responsive fixes"
```

---

## Deferred (explicitly out of this plan)

- Chart hover tooltips on MonteCarloCard (existing SVG charts; do in a polish
  follow-up if time allows — requires reworking chart internals not read yet)
- Page transition animations between / and /app (Next.js view transitions —
  check node_modules docs; only add if trivially supported)
