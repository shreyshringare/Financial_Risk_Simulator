# FinSim UI Polish Design
**Date:** 2026-06-26  
**Status:** Approved  
**Scope:** Frontend UI — Terminal Chrome · Missing States · Card Density  
**Context:** JPMC internship showcase — interviewers clone and run locally. Goal: immediate "trading terminal" first impression + no rough edges during use.

---

## Overview

Chrome-first polish pass. Three batches delivered in sequence:

1. **Persistent terminal chrome** — status bar + header upgrade (first-glance impression)
2. **Missing states** — boot screen, streaming indicator, error display (removes "demo" feel during use)
3. **Card density** — tighter spacing, more data per card, cleaner badge alignment (information-dense like Bloomberg)

No backend changes. No new dependencies. No SSE or API modifications.

---

## Batch 1 — Persistent Terminal Chrome

### 1.1 Status Bar

**New file:** `frontend/src/components/StatusBar.tsx`

Fixed bottom bar, rendered above `QueryBar` in `page.tsx`. Always visible.

**Layout:**
```
[◆ FINSIM ANALYST TERMINAL]  [MODEL: groq/llama-3.3-70b]  [STATUS: READY]  [14:32:07 UTC]
```

**Spec:**
- Height: 28px, `position: fixed`, `bottom: 0`, full width
- Background: `var(--surface)`, `border-top: 1px solid var(--border)`
- Font: IBM Plex Mono 10px, `var(--text-faint)` default, active fields `var(--amber)`
- `STATUS` field: reflects `isStreaming` prop — `READY` (static) or `PROCESSING...` (blinking cursor class)
- Clock: live UTC time via `useEffect` + `setInterval(1000)`, format `HH:MM:SS UTC`
- Model name: fetched from `GET /api/health` on mount, stored in page state, passed as prop
- QueryBar gets `padding-bottom: 28px` added to page layout to avoid overlap

**Props:** `{ isStreaming: boolean; model: string }`

### 1.2 Header Upgrade

**File:** `frontend/src/app/page.tsx` (header section only)

Current header renders `◆ FINSIM` + tagline as plain text.

After:
- Title: `◆ FINSIM ANALYST TERMINAL  v2.0` — VT323 font, amber glow
- Right side: green pulse dot + `LIVE` label (existing `.pulse-dot` animation class)
- Query counter: `[NN QUERIES]` — increments on each submit, zero-padded to 2 digits
- Counter resets on page reload (client state only)

---

## Batch 2 — Missing States

### 2.1 Boot Screen (Empty State)

**New file:** `frontend/src/components/BootScreen.tsx`

Shown when `sections.length === 0 && !isStreaming`.

**Content** (lines print in with 120ms stagger via `animation-delay`):
```
> INITIALIZING FINSIM ANALYST TERMINAL...
> CONNECTING TO GROQ API................OK
> LOADING KNOWLEDGE BASE................OK
> MONTE CARLO ENGINE....................READY
>
> AWAITING QUERY. TYPE BELOW TO BEGIN ANALYSIS.
```

**Spec:**
- Each line is a `<div>` with `animation: print-in 0.25s forwards` and `animation-delay: N * 120ms`
- Font: IBM Plex Mono 12px, `var(--text-dim)`
- `OK` / `READY` tokens: `var(--green)`
- No API calls — purely presentational, static content
- Disappears immediately when first query is submitted (state transition hides it)

### 2.2 Streaming Indicator

**New file:** `frontend/src/components/StreamingIndicator.tsx`

Shown when `isStreaming === true && sections.length === 0` (agent thinking, no cards yet).

**Content:**
```
◆ ANALYST PROCESSING
████████░░░░░░░░░░░░  FETCHING MARKET DATA...
```

**Spec:**
- Animated amber progress bar: CSS `width` keyframe 0%→75% over 8s ease-out, holds at 75% (never reaches 100% — agent completion triggers card arrival, not bar fill)
- Label below bar: last SSE `token` received, truncated to 40 chars with `…` suffix; falls back to `PROCESSING...` before first token
- Replaces `BootScreen` once streaming starts; replaced by first card once data arrives
- Uses existing `print-in` animation for entry

**State logic in `page.tsx` reducer:**
```
sections.length === 0 && !isStreaming  → <BootScreen>
sections.length === 0 && isStreaming   → <StreamingIndicator>
sections.length > 0                    → <ReportArea> (existing)
```

### 2.3 Error State

**Handled in:** `frontend/src/app/page.tsx` + `frontend/src/components/ReportArea.tsx`

When SSE emits `{type: "error", message: "..."}`, reducer sets `error: string | null` in state.

If `error` is set, render in place of report area:
```
[ERROR] Request failed: <message>
        Submit a new query to retry.
```

**Spec:**
- Card styled with `border: 1px solid var(--red)`, `color: var(--red)`
- Same `print-in` animation as other cards
- Error clears on next query submit (reducer `SUBMIT` action sets `error: null`)
- `message` rendered as plain text (no markdown, no HTML interpolation)

---

## Batch 3 — Card Density

### 3.1 Global Spacing Reduction

**File:** `frontend/src/app/globals.css`

```css
/* Before → After */
.card-phosphor { padding: 16px → 10px }
.card-label-phosphor { margin-bottom: 12px → 8px }
```

**File:** `frontend/src/components/ReportArea.tsx`

Card grid gap: `gap-12` (48px) → `gap-6` (24px).

### 3.2 StockCard: 2×3 Data Grid

**File:** `frontend/src/components/cards/StockCard.tsx`

Current: 3-column stat row (LATEST, MIN, MAX).  
After: 2-row × 3-column grid:

```
LATEST      MIN         MAX
$211.42     $164.08     $237.23

COUNT       FROM        TO
1,258       2020-01-02  2025-06-25
```

All data already in `StockData` payload (`count`, `start`, `end`, `latest_price`, `min_price`, `max_price`). No backend change.

Row 2 formatting: `count` with `toLocaleString()`, `start`/`end` as-is (already `YYYY-MM-DD` strings).

### 3.3 MonteCarloCard: Percentile Range Bar

**File:** `frontend/src/components/cards/MonteCarloCard.tsx`

Add below existing 3-stat row:

```
P5 ──────[═══════════════════]────── P95
$147          $164 → $289            $312
```

**Spec:**
- Outer track: full width, 4px height, `var(--border)` background
- Inner fill: CSS `left` and `width` calculated from `(p5 - min) / range` and `(p95 - p5) / range` where min/max are the track bounds (pad 10% each side of p5/p95)
- Amber fill (`var(--amber)`, 40% opacity), no animation
- Labels: `P5` left-anchored, `P95` right-anchored, VT323 font, `var(--text-dim)`
- Center label: `$mean_final_price` (already in payload as `mean_final_price`)
- Pure CSS, no new dependencies

### 3.4 RiskCard: Badge Column Alignment

**File:** `frontend/src/components/cards/RiskCard.tsx`

Current: `HIST SIM` / `GBM SIM` badge appears inline after label text, disrupting alignment.  
After: method badge moves to a fixed-width left column (48px), label in center, value+risk badge right-aligned.

Layout per row:
```
[HIST SIM]  Value at Risk (95%)    -2.14%  [HIGH]
[HIST SIM]  CVaR / Exp. Shortfall  -3.01%  [HIGH]
[GBM SIM ]  Value at Risk (95%)    -1.87%  [HIGH]
[GBM SIM ]  CVaR / Exp. Shortfall  -2.44%  [HIGH]
[        ]  Sharpe Ratio            0.8821  [MODERATE]
[        ]  Maximum Drawdown       -34.12%  [HIGH]
```

Method badge column: 48px fixed width, `var(--text-faint)` border, 8px font — empty for Sharpe/Drawdown rows.

---

## File Change Summary

| File | Batch | Change |
|------|-------|--------|
| `frontend/src/components/StatusBar.tsx` | 1 | New component — status bar |
| `frontend/src/components/BootScreen.tsx` | 2 | New component — boot sequence |
| `frontend/src/components/StreamingIndicator.tsx` | 2 | New component — processing state |
| `frontend/src/app/page.tsx` | 1, 2 | Header upgrade, state logic, health fetch |
| `frontend/src/app/globals.css` | 3 | Padding reduction |
| `frontend/src/components/ReportArea.tsx` | 2, 3 | Error state, gap reduction |
| `frontend/src/components/cards/StockCard.tsx` | 3 | 2×3 data grid |
| `frontend/src/components/cards/MonteCarloCard.tsx` | 3 | Percentile range bar |
| `frontend/src/components/cards/RiskCard.tsx` | 3 | Badge column alignment |

**Total: 9 files, 3 new components.**

---

## Out of Scope

- Mobile/responsive layout (showcase is desktop-only clone-and-run)
- Real live market ticker tape (would require WebSocket feed)
- Dark/light mode toggle
- Sidebar redesign (already functional, low impact)
- VerdictCard / CaveatsCard / ProseCard changes (text-only, already clean)
