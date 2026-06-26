# FinSim UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the phosphor terminal UI to read like professional trading software — persistent chrome, missing states, and information-dense cards.

**Architecture:** Chrome-first: add persistent StatusBar + upgrade header (Batch 1), then implement BootScreen/StreamingIndicator/error states (Batch 2), then tighten card spacing and add data to StockCard/MonteCarloCard/RiskCard (Batch 3). All changes are frontend-only. No backend, no new dependencies, no SSE modifications.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, IBM Plex Mono + VT323 fonts, CSS custom properties, existing `.card-phosphor` / `print-in` animation system.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/StatusBar.tsx` | **Create** | Fixed bottom bar: model, status, UTC clock |
| `frontend/src/components/BootScreen.tsx` | **Create** | Animated boot sequence — shown before first query |
| `frontend/src/components/StreamingIndicator.tsx` | **Create** | Progress bar + last token — shown while agent thinks |
| `frontend/src/app/page.tsx` | **Modify** | Health fetch, queryCount state, header upgrade, lastToken in reducer, StatusBar + missing state wiring |
| `frontend/src/components/ReportArea.tsx` | **Modify** | Add streaming/lastToken props, replace empty/error states, use new components |
| `frontend/src/app/globals.css` | **Modify** | Add `progress-fill` keyframe, tighten card padding/label margin |
| `frontend/src/components/cards/StockCard.tsx` | **Modify** | 2×3 data grid |
| `frontend/src/components/cards/MonteCarloCard.tsx` | **Modify** | Percentile range bar |
| `frontend/src/components/cards/RiskCard.tsx` | **Modify** | Method badge left-column alignment |

---

## Task 1: StatusBar Component

**Files:**
- Create: `frontend/src/components/StatusBar.tsx`

- [ ] **Step 1: Create StatusBar**

```tsx
"use client";

import { useEffect, useState } from "react";

interface Props {
  isStreaming: boolean;
  model: string;
}

export default function StatusBar({ isStreaming, model }: Props) {
  const [time, setTime] = useState(() => utcTime());

  useEffect(() => {
    const id = setInterval(() => setTime(utcTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      height: 28,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      borderTop: "1px solid var(--border)",
      background: "var(--surface)",
      flexShrink: 0,
      fontSize: 10,
      letterSpacing: "0.5px",
      fontFamily: "var(--font-mono)",
      color: "var(--text-faint)",
    }}>
      <span style={{ color: "var(--amber)", letterSpacing: 1 }}>◆ FINSIM ANALYST TERMINAL</span>
      <div style={{ display: "flex", gap: 24 }}>
        <span>
          MODEL: <span style={{ color: "var(--text-dim)" }}>{model || "—"}</span>
        </span>
        <span>
          STATUS:{" "}
          <span
            className={isStreaming ? "streaming-cursor" : undefined}
            style={{ color: isStreaming ? "var(--amber)" : "var(--green)" }}
          >
            {isStreaming ? "PROCESSING" : "READY"}
          </span>
        </span>
        <span style={{ color: "var(--text-faint)" }}>{time} UTC</span>
      </div>
    </div>
  );
}

function utcTime(): string {
  const n = new Date();
  return [
    n.getUTCHours().toString().padStart(2, "0"),
    n.getUTCMinutes().toString().padStart(2, "0"),
    n.getUTCSeconds().toString().padStart(2, "0"),
  ].join(":");
}
```

- [ ] **Step 2: Type-check**

```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "D:/SDE Projects/FinancialSim" && git add frontend/src/components/StatusBar.tsx && git commit -m "feat(ui): add StatusBar component — model, status, UTC clock"
```

---

## Task 2: Header Upgrade + Health Fetch + StatusBar Integration

**Files:**
- Modify: `frontend/src/app/page.tsx`

This task wires StatusBar into the page, upgrades the header to show `v2.0` + always-on LIVE indicator + query counter, and fetches the model name from `/api/health` on mount.

- [ ] **Step 1: Replace `page.tsx` with the upgraded version**

The full updated file:

```tsx
"use client";

import { useReducer, useCallback, useState, useEffect } from "react";
import type { ReportSection, SSEEvent } from "@/types/events";
import { streamChat } from "@/lib/sseClient";
import QueryBar from "@/components/QueryBar";
import ReportArea from "@/components/ReportArea";
import Sidebar from "@/components/Sidebar";
import StatusBar from "@/components/StatusBar";

// ── State ─────────────────────────────────────────────────────────────────────

type State = {
  sections: ReportSection[];
  streaming: boolean;
  error: string | null;
  hasAnalysisSections: boolean;
  lastToken: string;
};

type Action =
  | { type: "START" }
  | { type: "ADD_STOCK";       data: Extract<SSEEvent, { section: "stock" }>["data"] }
  | { type: "ADD_MONTE_CARLO"; data: Extract<SSEEvent, { section: "monte_carlo" }>["data"] }
  | { type: "ADD_RISK";        data: Extract<SSEEvent, { section: "risk" }>["data"] }
  | { type: "ADD_CAVEATS" }
  | { type: "APPEND_TOKEN";    token: string }
  | { type: "DONE" }
  | { type: "ERROR"; message: string };

const initial: State = {
  sections: [],
  streaming: false,
  error: null,
  hasAnalysisSections: false,
  lastToken: "",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START":
      return { sections: [], streaming: true, error: null, hasAnalysisSections: false, lastToken: "" };

    case "ADD_STOCK":
      return { ...state, hasAnalysisSections: true, sections: [...state.sections, { kind: "stock", data: action.data }] };

    case "ADD_MONTE_CARLO":
      return { ...state, sections: [...state.sections, { kind: "monte_carlo", data: action.data }] };

    case "ADD_RISK":
      return {
        ...state,
        sections: [
          ...state.sections,
          { kind: "risk", data: action.data },
          { kind: "verdict", content: "", streaming: true },
        ],
      };

    case "APPEND_TOKEN": {
      const sections = [...state.sections];
      const idx = sections.findLastIndex(
        (s) => (s.kind === "verdict" || s.kind === "prose") && s.streaming
      );
      if (idx === -1) {
        if (!state.hasAnalysisSections) {
          const last = sections[sections.length - 1];
          if (last?.kind === "prose" && last.streaming) {
            sections[sections.length - 1] = { ...last, content: last.content + action.token };
          } else {
            sections.push({ kind: "prose", content: action.token, streaming: true });
          }
        }
        return { ...state, sections, lastToken: action.token };
      }
      const card = sections[idx] as Extract<ReportSection, { kind: "verdict" | "prose" }>;
      sections[idx] = { ...card, content: card.content + action.token };
      return { ...state, sections, lastToken: action.token };
    }

    case "ADD_CAVEATS":
      return { ...state, sections: [...state.sections, { kind: "caveats" }] };

    case "DONE": {
      const sections = state.sections.map((s) =>
        (s.kind === "verdict" || s.kind === "prose") && s.streaming
          ? { ...s, streaming: false }
          : s
      );
      return { ...state, streaming: false, sections };
    }

    case "ERROR":
      return { ...state, streaming: false, error: action.message };

    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Terminal() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [queryCount, setQueryCount] = useState(0);
  const [model, setModel] = useState("groq/llama-3.3-70b");

  // Fetch model name from health endpoint on mount
  useEffect(() => {
    fetch("http://localhost:8000/api/health")
      .then((r) => r.json())
      .then((d) => { if (d.model) setModel(d.model); })
      .catch(() => {}); // keep default on failure
  }, []);

  const handleQuery = useCallback(async (message: string) => {
    setQueryCount((c) => c + 1);
    dispatch({ type: "START" });
    try {
      for await (const event of streamChat(message)) {
        switch (event.type) {
          case "section":
            if      (event.section === "stock")       dispatch({ type: "ADD_STOCK",       data: event.data });
            else if (event.section === "monte_carlo") dispatch({ type: "ADD_MONTE_CARLO", data: event.data });
            else if (event.section === "risk")        dispatch({ type: "ADD_RISK",        data: event.data });
            else if (event.section === "caveats")     dispatch({ type: "ADD_CAVEATS" });
            break;
          case "token":  dispatch({ type: "APPEND_TOKEN", token: event.token }); break;
          case "done":   dispatch({ type: "DONE" }); break;
          case "error":  dispatch({ type: "ERROR", message: event.message }); break;
        }
      }
    } catch (err) {
      dispatch({ type: "ERROR", message: err instanceof Error ? err.message : "Network error" });
    }
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <Sidebar onQuery={handleQuery} disabled={state.streaming} />

      {/* Main panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <header style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 20px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          background: "var(--surface)",
        }}>
          <span className="font-display" style={{ fontSize: 22, color: "var(--amber-bright)", textShadow: "0 0 12px var(--amber-dim)", letterSpacing: 1 }}>
            ◆ FINSIM ANALYST TERMINAL
          </span>
          <span style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.5px" }}>
            v2.0
          </span>
          <span style={{ color: "var(--text-faint)" }}>·</span>
          <span style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.5px" }}>
            Monte Carlo · VaR · GBM · RAG
          </span>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
            {/* Query counter */}
            {queryCount > 0 && (
              <span style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 1, fontFamily: "var(--font-mono)" }}>
                [{String(queryCount).padStart(2, "0")} QUERIES]
              </span>
            )}
            {/* Always-on LIVE indicator */}
            <div style={{ fontSize: 10, color: "var(--green)", textShadow: "0 0 8px rgba(57,255,20,0.6)", letterSpacing: 2, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--green)",
                boxShadow: "0 0 6px var(--green)",
                display: "inline-block",
                animation: "pulse-dot 1.4s ease-in-out infinite",
              }} />
              LIVE
            </div>
          </div>
        </header>

        {/* Query bar */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
          <QueryBar onSubmit={handleQuery} disabled={state.streaming} />
        </div>

        {/* Report area */}
        <main style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 40 }}>
          <ReportArea
            sections={state.sections}
            error={state.error}
            streaming={state.streaming}
            lastToken={state.lastToken}
          />
        </main>

        {/* Status bar */}
        <StatusBar isStreaming={state.streaming} model={model} />
      </div>
    </div>
  );
}
```

Note: `paddingBottom: 40` on `main` gives breathing room above the fixed StatusBar (28px).

- [ ] **Step 2: Type-check (will fail — ReportArea props not updated yet)**

```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npx tsc --noEmit 2>&1 | head -20
```

Expected: TypeScript errors about `streaming` and `lastToken` not existing on ReportArea props. This is expected — Task 5 fixes ReportArea. The errors confirm the wiring is in place.

- [ ] **Step 3: Commit**

```bash
cd "D:/SDE Projects/FinancialSim" && git add frontend/src/app/page.tsx && git commit -m "feat(ui): terminal chrome — header v2, query counter, LIVE indicator, status bar wiring"
```

---

## Task 3: BootScreen Component

**Files:**
- Create: `frontend/src/components/BootScreen.tsx`

- [ ] **Step 1: Create BootScreen**

```tsx
const LINES: { text: string; ok?: string }[] = [
  { text: "> INITIALIZING FINSIM ANALYST TERMINAL..." },
  { text: "> CONNECTING TO GROQ API................", ok: "OK" },
  { text: "> LOADING KNOWLEDGE BASE................", ok: "OK" },
  { text: "> MONTE CARLO ENGINE.....................", ok: "READY" },
  { text: ">" },
  { text: "> AWAITING QUERY. TYPE BELOW TO BEGIN ANALYSIS." },
];

export default function BootScreen() {
  return (
    <div style={{ padding: "20px 0", fontFamily: "var(--font-mono)", fontSize: 12 }}>
      {LINES.map((line, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 6,
            color: "var(--text-dim)",
            opacity: 0,
            animation: "print-in 0.25s ease-out forwards",
            animationDelay: `${i * 120}ms`,
            lineHeight: 2,
          }}
        >
          <span>{line.text}</span>
          {line.ok && (
            <span style={{
              color: line.ok === "READY" ? "var(--amber)" : "var(--green)",
              textShadow: line.ok === "READY"
                ? "0 0 6px rgba(255,180,60,0.5)"
                : "0 0 6px rgba(57,255,20,0.5)",
            }}>
              {line.ok}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npx tsc --noEmit 2>&1 | grep BootScreen
```

Expected: no errors mentioning BootScreen.

- [ ] **Step 3: Commit**

```bash
cd "D:/SDE Projects/FinancialSim" && git add frontend/src/components/BootScreen.tsx && git commit -m "feat(ui): add BootScreen boot sequence component"
```

---

## Task 4: StreamingIndicator Component + progress-fill keyframe

**Files:**
- Create: `frontend/src/components/StreamingIndicator.tsx`
- Modify: `frontend/src/app/globals.css` (add `progress-fill` keyframe only)

- [ ] **Step 1: Add `progress-fill` keyframe to `globals.css`**

Append after the `@keyframes pulse-dot` block (after line 68):

```css
@keyframes progress-fill {
  0%   { width: 0%; }
  100% { width: 75%; }
}
```

- [ ] **Step 2: Create StreamingIndicator**

```tsx
interface Props {
  lastToken: string;
}

export default function StreamingIndicator({ lastToken }: Props) {
  const label = lastToken
    ? lastToken.slice(0, 40) + (lastToken.length > 40 ? "…" : "")
    : "PROCESSING...";

  return (
    <div style={{
      padding: "20px 0",
      fontFamily: "var(--font-mono)",
      opacity: 0,
      animation: "print-in 0.25s ease-out forwards",
    }}>
      <div style={{ fontSize: 11, color: "var(--amber)", letterSpacing: 2, marginBottom: 14 }}>
        ◆ ANALYST PROCESSING
      </div>

      {/* Progress track */}
      <div style={{
        width: "100%",
        height: 4,
        background: "var(--border)",
        position: "relative",
        marginBottom: 10,
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          top: 0, left: 0,
          height: "100%",
          background: "rgba(255,180,60,0.4)",
          animation: "progress-fill 8s ease-out forwards",
        }} />
      </div>

      {/* Last token label */}
      <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.5px" }}>
        {label}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npx tsc --noEmit 2>&1 | grep StreamingIndicator
```

Expected: no errors mentioning StreamingIndicator.

- [ ] **Step 4: Commit**

```bash
cd "D:/SDE Projects/FinancialSim" && git add frontend/src/components/StreamingIndicator.tsx frontend/src/app/globals.css && git commit -m "feat(ui): add StreamingIndicator processing state + progress-fill keyframe"
```

---

## Task 5: Wire Missing States into ReportArea

**Files:**
- Modify: `frontend/src/components/ReportArea.tsx`

Add `streaming` and `lastToken` props, replace empty/error states with new components, show BootScreen/StreamingIndicator based on state.

- [ ] **Step 1: Replace `ReportArea.tsx` with the updated version**

```tsx
import type { ReportSection } from "@/types/events";
import StockCard from "./cards/StockCard";
import MonteCarloCard from "./cards/MonteCarloCard";
import RiskCard from "./cards/RiskCard";
import VerdictCard from "./cards/VerdictCard";
import CaveatsCard from "./cards/CaveatsCard";
import ProseCard from "./cards/ProseCard";
import BootScreen from "./BootScreen";
import StreamingIndicator from "./StreamingIndicator";

interface Props {
  sections: ReportSection[];
  error: string | null;
  streaming: boolean;
  lastToken: string;
}

export default function ReportArea({ sections, error, streaming, lastToken }: Props) {
  // Error state — shown regardless of sections
  if (error) {
    return (
      <div style={{
        border: "1px solid rgba(255,49,49,0.4)",
        background: "rgba(255,49,49,0.04)",
        padding: "12px 16px",
        fontFamily: "var(--font-mono)",
        animation: "print-in 0.25s ease-out forwards",
        opacity: 0,
      }}>
        <div style={{ fontSize: 10, color: "var(--red)", letterSpacing: 1, marginBottom: 6 }}>
          [ERROR]
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,49,49,0.7)", lineHeight: 1.6 }}>
          {error}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 8 }}>
          Submit a new query to retry.
        </div>
      </div>
    );
  }

  // Boot screen — no query submitted yet
  if (sections.length === 0 && !streaming) {
    return <BootScreen />;
  }

  // Streaming indicator — query in flight, no cards yet
  if (sections.length === 0 && streaming) {
    return <StreamingIndicator lastToken={lastToken} />;
  }

  // Normal: render cards
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sections.map((section, i) => (
        <SectionRenderer key={i} section={section} />
      ))}
    </div>
  );
}

function SectionRenderer({ section }: { section: ReportSection }) {
  switch (section.kind) {
    case "stock":       return <StockCard data={section.data} />;
    case "monte_carlo": return <MonteCarloCard data={section.data} />;
    case "risk":        return <RiskCard data={section.data} />;
    case "verdict":     return <VerdictCard content={section.content} streaming={section.streaming} />;
    case "caveats":     return <CaveatsCard />;
    case "prose":       return <ProseCard content={section.content} streaming={section.streaming} />;
  }
}
```

- [ ] **Step 2: Type-check — should now be clean**

```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npx tsc --noEmit
```

Expected: no errors (Task 2 added the props, this task makes ReportArea accept them).

- [ ] **Step 3: Commit**

```bash
cd "D:/SDE Projects/FinancialSim" && git add frontend/src/components/ReportArea.tsx && git commit -m "feat(ui): wire BootScreen, StreamingIndicator, and error state into ReportArea"
```

---

## Task 6: Global Density — Card Padding + Label Margin

**Files:**
- Modify: `frontend/src/app/globals.css`

Two changes only: tighten `.card-phosphor` padding and `.card-label-phosphor` margin-bottom.

- [ ] **Step 1: Update `.card-phosphor` padding**

In `globals.css`, find `.card-phosphor` (line ~115):

```css
/* Before: */
.card-phosphor {
  border: 1px solid var(--border);
  background: var(--card);
  padding: 16px 18px;
  ...
}

/* After: */
.card-phosphor {
  border: 1px solid var(--border);
  background: var(--card);
  padding: 10px 14px;
  ...
}
```

- [ ] **Step 2: Update `.card-label-phosphor` margin-bottom**

In `globals.css`, find `.card-label-phosphor` (line ~132):

```css
/* Before: */
.card-label-phosphor {
  ...
  margin-bottom: 14px;
  ...
}

/* After: */
.card-label-phosphor {
  ...
  margin-bottom: 8px;
  ...
}
```

- [ ] **Step 3: Type-check**

```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npx tsc --noEmit
```

Expected: no errors (CSS-only change).

- [ ] **Step 4: Commit**

```bash
cd "D:/SDE Projects/FinancialSim" && git add frontend/src/app/globals.css && git commit -m "feat(ui): tighten card padding (16→10px) and label margin (14→8px)"
```

---

## Task 7: StockCard 2×3 Data Grid

**Files:**
- Modify: `frontend/src/components/cards/StockCard.tsx`

Replace the current 3-stat row (Period, Trading Days, 52W Range) with a 2-row × 3-column grid showing all 6 data points individually.

- [ ] **Step 1: Replace `StockCard.tsx`**

```tsx
import type { StockData } from "@/types/events";
import { formatPrice } from "@/lib/riskUtils";

export default function StockCard({ data }: { data: StockData }) {
  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Stock Overview</div>
      <div
        className="font-display"
        style={{ fontSize: 48, color: "var(--amber-bright)", textShadow: "0 0 20px var(--amber-dim)", lineHeight: 1, letterSpacing: 2, marginBottom: 10 }}
      >
        {formatPrice(data.latest_price)}
      </div>
      <div style={{ color: "var(--text-faint)", fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>
        {data.ticker}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px 16px" }}>
        <Stat label="Latest"        value={formatPrice(data.latest_price)} />
        <Stat label="Min"           value={formatPrice(data.min_price)} />
        <Stat label="Max"           value={formatPrice(data.max_price)} />
        <Stat label="Trading Days"  value={data.count.toLocaleString()} />
        <Stat label="From"          value={data.start} />
        <Stat label="To"            value={data.end} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "D:/SDE Projects/FinancialSim" && git add frontend/src/components/cards/StockCard.tsx && git commit -m "feat(ui): StockCard 2x3 data grid — all 6 fields individually"
```

---

## Task 8: MonteCarloCard Percentile Range Bar

**Files:**
- Modify: `frontend/src/components/cards/MonteCarloCard.tsx`

Add a visual range bar below the 3-stat row showing P5 → P95 distribution band.

- [ ] **Step 1: Replace `MonteCarloCard.tsx`**

```tsx
import type { MonteCarloData } from "@/types/events";
import { formatPrice } from "@/lib/riskUtils";

export default function MonteCarloCard({ data }: { data: MonteCarloData }) {
  // Range bar math: pad 10% either side of the p5–p95 band
  const spread = data.percentile_95 - data.percentile_5;
  const trackMin = data.percentile_5 - spread * 0.1;
  const trackMax = data.percentile_95 + spread * 0.1;
  const trackRange = trackMax - trackMin;
  const barLeft = ((data.percentile_5 - trackMin) / trackRange) * 100;
  const barWidth = (spread / trackRange) * 100;

  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Monte Carlo Simulation</div>
      <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 12, letterSpacing: "0.5px" }}>
        {data.simulations.toLocaleString()} paths · {data.days} days · GBM
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
        <SimStat label="Mean Final Price"      value={formatPrice(data.mean_final_price)} color="var(--amber-bright)" />
        <SimStat label="5th Pct (Bear)"        value={formatPrice(data.percentile_5)}     color="var(--red)" />
        <SimStat label="95th Pct (Bull)"       value={formatPrice(data.percentile_95)}    color="var(--green)" />
      </div>

      {/* Percentile range bar */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 9, letterSpacing: 1, color: "var(--text-faint)" }}>
          <span>P5</span>
          <span style={{ color: "var(--text-dim)" }}>{formatPrice(data.mean_final_price)} mean</span>
          <span>P95</span>
        </div>
        {/* Track */}
        <div style={{ width: "100%", height: 4, background: "var(--border)", position: "relative", overflow: "hidden" }}>
          {/* Fill */}
          <div style={{
            position: "absolute",
            top: 0,
            left: `${barLeft}%`,
            width: `${barWidth}%`,
            height: "100%",
            background: "rgba(255,180,60,0.35)",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "var(--text-faint)" }}>
          <span>{formatPrice(data.percentile_5)}</span>
          <span>{formatPrice(data.percentile_95)}</span>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-faint)" }}>
        Std dev of terminal prices: {formatPrice(data.std_final_price)}
      </div>
    </div>
  );
}

function SimStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 4 }}>
        {label}
      </div>
      <div className="font-display" style={{ fontSize: 28, color, letterSpacing: 1, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "D:/SDE Projects/FinancialSim" && git add frontend/src/components/cards/MonteCarloCard.tsx && git commit -m "feat(ui): MonteCarloCard P5–P95 percentile range bar"
```

---

## Task 9: RiskCard Badge Column Alignment

**Files:**
- Modify: `frontend/src/components/cards/RiskCard.tsx`

Move the HIST SIM / GBM SIM badges from inline-after-label to a fixed-width left column so all values and risk badges form clean vertical alignment.

- [ ] **Step 1: Replace `RiskCard.tsx`**

```tsx
import type { RiskData } from "@/types/events";
import {
  riskLevel, riskBadgeClass, riskOverallClass, overallRisk,
  formatPct, type RiskLevel,
} from "@/lib/riskUtils";

export default function RiskCard({ data }: { data: RiskData }) {
  const overall = overallRisk(data.var, data.sharpe, data.max_drawdown);
  const sharpeLevel: RiskLevel = data.sharpe > 1 ? "LOW" : data.sharpe > 0.5 ? "MODERATE" : "HIGH";

  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Risk Metrics</div>
      <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
          <RiskRow label="Value at Risk (95%)"       value={formatPct(data.var_hist)}        level={riskLevel(data.var_hist)}  method="HIST SIM" />
          <RiskRow label="CVaR / Expected Shortfall" value={formatPct(data.cvar_hist)}       level={riskLevel(data.cvar_hist)} method="HIST SIM" />
          <RiskRow label="Value at Risk (95%)"       value={formatPct(data.var_sim)}         level={riskLevel(data.var_sim)}   method="GBM SIM" />
          <RiskRow label="CVaR / Expected Shortfall" value={formatPct(data.cvar_sim)}        level={riskLevel(data.cvar_sim)}  method="GBM SIM" />
          <RiskRow label="Sharpe Ratio"              value={data.sharpe.toFixed(4)}          level={sharpeLevel} />
          <RiskRow label="Maximum Drawdown"          value={formatPct(data.max_drawdown)}    level={riskLevel(data.max_drawdown)} />
        </div>
        <OverallRating level={overall} />
      </div>
    </div>
  );
}

function RiskRow({ label, value, level, method }: { label: string; value: string; level: RiskLevel; method?: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "4px 0",
      borderBottom: "1px solid var(--border-dim)",
      gap: 8,
    }}>
      {/* Fixed-width method badge column */}
      <div style={{ width: 52, flexShrink: 0 }}>
        {method && (
          <span style={{
            fontSize: 8,
            color: "var(--text-faint)",
            border: "1px solid var(--border-dim)",
            padding: "1px 4px",
            letterSpacing: "0.5px",
            display: "inline-block",
            fontFamily: "var(--font-mono)",
          }}>
            {method}
          </span>
        )}
      </div>
      {/* Label */}
      <span style={{ flex: 1, fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.5px" }}>
        {label}
      </span>
      {/* Value + risk badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="font-display" style={{ fontSize: 20, color: "var(--text)", letterSpacing: 1 }}>
          {value}
        </span>
        <span className={riskBadgeClass(level)}>{level}</span>
      </div>
    </div>
  );
}

function OverallRating({ level }: { level: RiskLevel }) {
  const label = level === "MODERATE" ? "MOD" : level;
  return (
    <div style={{
      width: 100, flexShrink: 0,
      border: "1px solid var(--border)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 6, padding: 12,
      background: "rgba(255,180,60,0.02)",
    }}>
      <div style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-faint)" }}>
        Risk Rating
      </div>
      <div className={riskOverallClass(level)}>{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check — full clean check**

```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "D:/SDE Projects/FinancialSim" && git add frontend/src/components/cards/RiskCard.tsx && git commit -m "feat(ui): RiskCard method badge left-column alignment"
```

---

## Final Verification

After all 9 tasks:

- [ ] **Run TypeScript check**

```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npx tsc --noEmit
```

Expected: clean (0 errors).

- [ ] **Start dev servers and verify visually**

Terminal 1 (backend):
```bash
cd "D:/SDE Projects/FinancialSim" && uvicorn api.main:app --reload --port 8000
```

Terminal 2 (frontend):
```bash
cd "D:/SDE Projects/FinancialSim/frontend" && npm run dev
```

Open `http://localhost:3000` and verify:
- [ ] Status bar visible at bottom with clock ticking, "READY" in green
- [ ] Header shows "◆ FINSIM ANALYST TERMINAL  v2.0" + LIVE dot
- [ ] Boot sequence prints line-by-line on first load
- [ ] Query counter increments after submit (e.g. "[01 QUERIES]")
- [ ] While agent processes, StreamingIndicator shows progress bar + last token text; STATUS shows "PROCESSING" with blinking cursor
- [ ] Once cards arrive, BootScreen/StreamingIndicator gone, cards render normally
- [ ] StockCard shows 2×3 grid (6 cells)
- [ ] MonteCarloCard shows P5–P95 range bar
- [ ] RiskCard method badges are left-column aligned

- [ ] **Run Python tests to confirm no backend regression**

```bash
cd "D:/SDE Projects/FinancialSim" && python -m pytest tests/ -v --tb=no -q
```

Expected: 15 pass, 1 pre-existing fail (test_health — Python 3.14 pydantic incompatibility, unrelated).
