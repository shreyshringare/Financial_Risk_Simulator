# Plan 2b: Research Note App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Replace the phosphor-terminal concept at `/app` with the "Research Note" concept: each query produces a typeset institutional analyst note on a cream canvas, with a live agent-reasoning timeline. One design language across landing and app.

**Supersedes:** Plan 2 Tasks 7–10 (welcome modal, command palette, history rail, skeletons — all still built, but in Research Note styling, not phosphor). Plan 2 Tasks 3/4/5/6/11 (landing) remain as amended by pivot notes.

**Commit policy:** NO AI attribution.

## Design language (shared with landing)

Tokens (already in globals.css): `--l-bg #faf9f5`, `--l-surface #ffffff`, `--l-surface-2 #f0efe9`, `--l-border rgba(20,20,19,0.10)`, `--l-text #141413`, `--l-text-dim #6e6e69`, `--l-accent #b45309`, `--l-accent-soft`.
Fonts: `--font-serif` (Fraunces) display + report headings, `--font-inter` body/UI, `--font-mono` (IBM Plex Mono) numbers/tables/tickers.
Risk badges (muted): LOW `#3f6212` on `#f3f8e8`; MODERATE `#92400e` on `#fdf3e3`; HIGH `#9f1239` on `#fdf0f3`. Rounded 6px, 11px caps mono.
Cards: white surface, 1px `--l-border`, border-radius 10px, NO glow/scanline/neon anywhere.

---

### Task 1: Backend status events (agent reasoning feed)

**Files:**
- Modify: `api/callback_handler.py`
- Modify: `frontend/src/types/events.ts`
- Test: `tests/test_api.py` (append unit test for handler emit)

`AnalystCallbackHandler` already implements LangChain callbacks. Add tool-start
reporting: in `on_tool_start`, emit `{"type": "status", "tool": <tool_name>,
"label": <human label>}` onto the same SSE queue. Human labels map:

```python
_TOOL_LABELS = {
    "fetch_stock_data": "Fetching market data",
    "run_monte_carlo_simulation": "Running 10,000-path Monte Carlo simulation",
    "calculate_risk_metrics": "Computing VaR, CVaR, Sharpe, drawdown",
    "explain_risk": "Interpreting risk profile",
    "rag_financial_query": "Consulting knowledge base",
    "analyze_portfolio": "Analyzing portfolio correlation",
    "run_stress_test_tool": "Stress testing against historical crisis",
    "export_analysis_report": "Exporting report",
    "get_financial_news": "Scanning news and sentiment",
    "compute_efficient_frontier_tool": "Optimizing efficient frontier",
    "get_market_movers": "Fetching market movers",
    "analyze_option": "Pricing option (Black-Scholes)",
}
```
Fallback label: tool name with underscores → spaces, capitalized.
Frontend `SSEEvent` union gains `| { type: "status"; tool: string; label: string }`.
Test: instantiate handler, call `on_tool_start({"name": "fetch_stock_data"}, "AAPL")` (match real signature — read the class first), assert queued event JSON.

Commit: `feat(api): status SSE events on tool start for agent timeline`

### Task 2: App shell — Research Note layout

**Files:**
- Modify: `frontend/src/app/app/page.tsx` (shell restyle; reducer gains STATUS action)
- Modify: `frontend/src/components/QueryBar.tsx`, `StatusBar.tsx`, `Sidebar.tsx` (light restyle)
- Delete usage: `BootScreen.tsx` (remove from tree), CRT overlay classes

Shell: cream `--l-bg` full page (reuse `.landing` base class or a `.desk` class);
top bar — serif wordmark "FinSim" + thin border + model status right (mono, dim);
main — centered column `max-width: 760px`, report renders inside; bottom —
"Ask the desk…" input bar, white surface, thin border, rounded 12px, amber send
button. Sidebar becomes collapsible "Report shelf" (light): session history list
(dated entries, serif titles) + quick-query chips. Remove `terminal-shell` class,
scanline/vignette CSS rules, BootScreen import/render, blinking cursor classes,
`◆ FINSIM ANALYST TERMINAL` header block.
Reducer: add `| { type: "STATUS"; tool: string; label: string }` action appending
to a `steps: {label: string; done: boolean}[]` state slice; a `section` event
marks the latest step done.

Commit: `feat(app): research note shell — cream canvas, ask bar, report shelf`

### Task 3: Agent timeline component

**Files:**
- Create: `frontend/src/components/AgentTimeline.tsx`

Renders `steps` during streaming above the growing report: each step a row —
14px spinner ring (CSS) or check ✓ (accent), label in `--l-text-dim` 13px Inter.
Completed steps compact to single line "n steps · 12.4s" after `done` event
(collapsible). Fade/slide via framer-motion, respects reduced motion.

Commit: `feat(app): live agent reasoning timeline`

### Task 4: Report typesetting — title block + card restyle

**Files:**
- Create: `frontend/src/components/report/TitleBlock.tsx`
- Modify: all of `frontend/src/components/cards/*.tsx` + `ReportArea.tsx` + `lib/riskUtils.ts` (badge colors)

TitleBlock (renders when first section of a report arrives): serif 28px title
"AAPL — Risk Assessment", 13px mono meta line "03 Jul 2026 · Prepared by FinSim
Agent · 10,000-path GBM". ReportArea wraps sections in `<article>` with
generous spacing (32px between sections).

Card restyle guide (apply to every card):
- Container: white card, `1px solid var(--l-border)`, radius 10, padding 24, no left amber bar, no print-in clip animation — subtle fade+rise via framer-motion
- Section heading: serif 18px `--l-text` with 12px mono overline label in `--l-text-dim` (e.g. "MONTE CARLO — FIG. 1")
- Numbers/tables: mono 13px, right-aligned numerics, thin row separators `--l-border`
- Charts (inline SVGs in MonteCarloCard/OptionsCard/FrontierCard): ink `#141413` lines, `--l-accent` highlight series, gridlines `rgba(20,20,19,0.06)`, cream background, caption line under figure: 12px `--l-text-dim` italic "Fig. n — description"
- Risk badges: muted palette from design language section (riskUtils.ts mapping)
- VerdictCard → "Assessment" callout: `--l-surface-2` background, serif heading, no cursor blink
- CaveatsCard → footnote block: 12px, `--l-text-dim`, top border, "Methodology & caveats" overline

Worked example — StockCard.tsx restyled (pattern for the rest):

```tsx
export default function StockCard({ data }: { data: StockData }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)",
               borderRadius: 10, padding: 24 }}
    >
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 6 }}>
        MARKET DATA
      </div>
      <h3 className="serif" style={{ fontSize: 18, margin: "0 0 16px" }}>
        {data.ticker} — {data.latest_price != null ? `$${data.latest_price}` : "Price unavailable"}
      </h3>
      {/* stat row: mono numbers, thin separators */}
    </motion.section>
  );
}
```

Commit series (one per coherent chunk): `feat(app): typeset title block`,
`feat(app): restyle report cards to research-note style`, `feat(app): muted
risk badges + figure captions`

### Task 5: Welcome modal + command palette (light)

**Files:**
- Create: `frontend/src/components/WelcomeModal.tsx`
- Create: `frontend/src/components/CommandPalette.tsx`
- Modify: `frontend/src/app/app/page.tsx` (mount both)

Same behavior as Plan 2 Tasks 7–8 (localStorage dismiss, sample queries,
Ctrl+K, arrows/enter, free-text fallback) but Research Note styling: white
panel, thin border, radius 12, serif heading "Welcome to the desk", sample
queries as bordered chips, footer hint bar mono 11px. No phosphor styles.

Commit: `feat(app): welcome modal + command palette`

### Task 6: History shelf + skeletons + cleanup

**Files:**
- Modify: `frontend/src/app/app/page.tsx` (history state as Plan 2 Task 9: sectionsRef + RESTORE)
- Modify: `frontend/src/components/Sidebar.tsx` (shelf list)
- Create: `frontend/src/components/report/SkeletonNote.tsx` (light shimmer lines)
- Modify: `frontend/src/app/globals.css` (delete unused phosphor classes: scanline overlays, print-in, blink-cursor, streaming-cursor; keep only what's referenced — grep before deleting)

Commit: `feat(app): report shelf history + skeleton, remove phosphor leftovers`

### Task 7: Verify E2E styling pass

Run backend + frontend; run an AAPL query; verify: timeline steps appear and
check off, title block renders, all cards restyled (no amber/black remnants),
badges muted, `/` landing and `/app` share design language. Screenshot for
Plan 3 product frame. Fix and commit anything broken.

Commit: `test: research note E2E styling pass` (allow-empty if no fixes)
