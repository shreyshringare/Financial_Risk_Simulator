"use client";

import { useReducer, useCallback, useState, useEffect, useRef } from "react";
import type { ReportSection, SSEEvent } from "@/types/events";
import { streamChat, API_BASE } from "@/lib/sseClient";
import { fetchSuggestions, type Suggestion } from "@/lib/suggestions";
import { getSessionId } from "@/lib/session";
import QueryBar from "@/components/QueryBar";
import ReportArea from "@/components/ReportArea";
import Sidebar from "@/components/Sidebar";
import AgentTimeline from "@/components/AgentTimeline";
import WelcomeModal from "@/components/WelcomeModal";
import CommandPalette from "@/components/CommandPalette";
import DocumentUpload from "@/components/DocumentUpload";

// ── State ─────────────────────────────────────────────────────────────────────

type Step = { label: string; done: boolean };

type State = {
  sections: ReportSection[];
  streaming: boolean;
  error: string | null;
  hasAnalysisSections: boolean;
  lastToken: string;
  steps: Step[];
};

type Action =
  | { type: "START" }
  | { type: "ADD_STOCK";       data: Extract<SSEEvent, { section: "stock" }>["data"] }
  | { type: "ADD_MONTE_CARLO"; data: Extract<SSEEvent, { section: "monte_carlo" }>["data"] }
  | { type: "ADD_RISK";        data: Extract<SSEEvent, { section: "risk" }>["data"] }
  | { type: "ADD_OPTIONS";     data: Extract<SSEEvent, { section: "options" }>["data"] }
  | { type: "ADD_PORTFOLIO";   data: Extract<SSEEvent, { section: "portfolio" }>["data"] }
  | { type: "ADD_STRESS_TEST"; data: Extract<SSEEvent, { section: "stress_test" }>["data"] }
  | { type: "ADD_FRONTIER";    data: Extract<SSEEvent, { section: "frontier" }>["data"] }
  | { type: "ADD_NEWS";        data: Extract<SSEEvent, { section: "news" }>["data"] }
  | { type: "ADD_EXPORT";      data: Extract<SSEEvent, { section: "export" }>["data"] }
  | { type: "ADD_CAVEATS" }
  | { type: "APPEND_TOKEN";    token: string }
  | { type: "STATUS"; tool: string; label: string }
  | { type: "DONE" }
  | { type: "ERROR"; message: string }
  | { type: "RESTORE"; sections: ReportSection[] };

const initial: State = {
  sections: [],
  streaming: false,
  error: null,
  hasAnalysisSections: false,
  lastToken: "",
  steps: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START":
      return { sections: [], streaming: true, error: null, hasAnalysisSections: false, lastToken: "", steps: [] };

    case "ADD_STOCK":
      return {
        ...state,
        hasAnalysisSections: true,
        sections: [...state.sections, { kind: "stock", data: action.data }],
        steps: state.steps.map((s) => ({ ...s, done: true })),
      };

    case "ADD_MONTE_CARLO":
      return {
        ...state,
        sections: [...state.sections, { kind: "monte_carlo", data: action.data }],
        steps: state.steps.map((s) => ({ ...s, done: true })),
      };

    case "ADD_RISK":
      return {
        ...state,
        sections: [
          ...state.sections,
          { kind: "risk", data: action.data },
          { kind: "verdict", content: "", streaming: true },
        ],
        steps: state.steps.map((s) => ({ ...s, done: true })),
      };

    case "ADD_OPTIONS":
      return {
        ...state,
        hasAnalysisSections: true,
        // Strip any prose that streamed before the card arrived (ReAct chain-of-thought)
        sections: [
          ...state.sections.filter((s) => s.kind !== "prose"),
          { kind: "options", data: action.data },
        ],
        steps: state.steps.map((s) => ({ ...s, done: true })),
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
      // Don't append to prose sections once a structured card is present
      if (card.kind === "prose" && state.hasAnalysisSections) {
        return { ...state, lastToken: action.token };
      }
      sections[idx] = { ...card, content: card.content + action.token };
      return { ...state, sections, lastToken: action.token };
    }

    case "ADD_PORTFOLIO":
      return {
        ...state,
        hasAnalysisSections: true,
        sections: [...state.sections, { kind: "portfolio", data: action.data }],
        steps: state.steps.map((s) => ({ ...s, done: true })),
      };

    case "ADD_STRESS_TEST":
      return {
        ...state,
        hasAnalysisSections: true,
        sections: [...state.sections, { kind: "stress_test", data: action.data }],
        steps: state.steps.map((s) => ({ ...s, done: true })),
      };

    case "ADD_FRONTIER":
      return {
        ...state,
        hasAnalysisSections: true,
        sections: [...state.sections, { kind: "frontier", data: action.data }],
        steps: state.steps.map((s) => ({ ...s, done: true })),
      };

    case "ADD_EXPORT":
      return { ...state, sections: [...state.sections, { kind: "export", data: action.data }] };

    case "ADD_NEWS":
      return {
        ...state,
        hasAnalysisSections: true,
        sections: [...state.sections, { kind: "news", data: action.data }],
        steps: state.steps.map((s) => ({ ...s, done: true })),
      };

    case "ADD_CAVEATS":
      return { ...state, sections: [...state.sections, { kind: "caveats" }] };

    case "STATUS": {
      const steps = [...state.steps.map((s) => ({ ...s, done: true })), { label: action.label, done: false }];
      return { ...state, steps };
    }

    case "DONE": {
      const sections = state.sections.map((s) =>
        (s.kind === "verdict" || s.kind === "prose") && s.streaming
          ? { ...s, streaming: false }
          : s
      );
      const steps = state.steps.map((s) => ({ ...s, done: true }));
      return { ...state, streaming: false, sections, steps };
    }

    case "ERROR":
      return { ...state, streaming: false, error: action.message };

    case "RESTORE":
      return { ...state, sections: action.sections, streaming: false, error: null, steps: [] };

    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

type HistoryEntry = { query: string; at: number; sections: ReportSection[] };

export default function Terminal() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [queryCount, setQueryCount] = useState(0);
  const [model, setModel] = useState("groq/llama-3.3-70b");
  const [connected, setConnected] = useState(false);
  const [warming, setWarming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sessionId] = useState(() => getSessionId());
  const sectionsRef = useRef<ReportSection[]>([]);
  const turnsRef = useRef<Array<{ role: string; content: string }>>([]);

  useEffect(() => {
    sectionsRef.current = state.sections;
  }, [state.sections]);

  useEffect(() => {
    setSidebarOpen(window.innerWidth > 768);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const MAX = 20; // ~60s total

    async function ping() {
      if (cancelled) return;
      try {
        const r = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(8000) });
        const d = await r.json();
        if (!cancelled) {
          if (d.model) setModel(d.model);
          setConnected(true);
          setWarming(false);
        }
      } catch {
        if (cancelled) return;
        attempts++;
        if (attempts === 1) setWarming(true);
        if (attempts < MAX) setTimeout(ping, 3000);
      }
    }

    ping();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetchSuggestions().then(setSuggestions);
  }, []);

  const handleQuery = useCallback(async (message: string) => {
    setQueryCount((c) => c + 1);
    dispatch({ type: "START" });
    try {
      for await (const event of streamChat(message, turnsRef.current, sessionId)) {
        switch (event.type) {
          case "section":
            if      (event.section === "stock")       dispatch({ type: "ADD_STOCK",       data: event.data });
            else if (event.section === "monte_carlo") dispatch({ type: "ADD_MONTE_CARLO", data: event.data });
            else if (event.section === "risk")        dispatch({ type: "ADD_RISK",        data: event.data });
            else if (event.section === "options")     dispatch({ type: "ADD_OPTIONS",     data: event.data });
            else if (event.section === "portfolio")   dispatch({ type: "ADD_PORTFOLIO",   data: event.data });
            else if (event.section === "stress_test") dispatch({ type: "ADD_STRESS_TEST", data: event.data });
            else if (event.section === "frontier")    dispatch({ type: "ADD_FRONTIER",    data: event.data });
            else if (event.section === "news")        dispatch({ type: "ADD_NEWS",        data: event.data });
            else if (event.section === "export")      dispatch({ type: "ADD_EXPORT",      data: event.data });
            else if (event.section === "caveats")     dispatch({ type: "ADD_CAVEATS" });
            break;
          case "token":  dispatch({ type: "APPEND_TOKEN", token: event.token }); break;
          case "status": dispatch({ type: "STATUS", tool: event.tool, label: event.label }); break;
          case "done":   dispatch({ type: "DONE" }); break;
          case "error":  dispatch({ type: "ERROR", message: event.message }); break;
        }
      }
      // Build assistant summary from last verdict or prose section
      const lastSection = sectionsRef.current.findLast(
        (s) => s.kind === "verdict" || s.kind === "prose"
      );
      const assistantContent = lastSection && "content" in lastSection
        ? lastSection.content.slice(0, 400)
        : "Analysis complete.";
      turnsRef.current = [
        ...turnsRef.current.slice(-9),
        { role: "user", content: message },
        { role: "assistant", content: assistantContent },
      ];
      setHistory((h) => [...h.slice(-9), { query: message, at: Date.now(), sections: sectionsRef.current }]);
    } catch (err) {
      dispatch({ type: "ERROR", message: err instanceof Error ? err.message : "Network error" });
    }
  }, []);

  const handleRestore = useCallback((i: number) => {
    setHistory((h) => {
      const entry = h[i];
      if (entry) dispatch({ type: "RESTORE", sections: entry.sections });
      return h;
    });
  }, []);

  return (
    <div className="landing" style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <WelcomeModal onQuery={handleQuery} suggestions={suggestions} />
      <CommandPalette onQuery={handleQuery} disabled={state.streaming} suggestions={suggestions} />
      <Sidebar
        onQuery={handleQuery}
        disabled={state.streaming}
        open={sidebarOpen}
        history={history.map(({ query, at }) => ({ query, at }))}
        onRestore={handleRestore}
        suggestions={suggestions}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <header style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 24px",
          borderBottom: "1px solid var(--l-border)",
          flexShrink: 0,
        }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              background: "none", border: "1px solid var(--l-border)",
              borderRadius: 6,
              color: "var(--l-text-dim)", cursor: "pointer",
              padding: "3px 7px", fontSize: 16,
              flexShrink: 0,
              transition: "150ms ease-out",
            }}
            title="Toggle sidebar"
          >
            ☰
          </button>
          <span className="serif" style={{ fontSize: 19, fontWeight: 600, color: "var(--l-text)" }}>
            FinSim
          </span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: 2, color: "var(--l-text-dim)" }}>
            RISK RESEARCH DESK
          </span>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--l-text-dim)" }}>
              ⌘K
            </span>
            {queryCount > 0 && (
              <span className="mono" style={{ fontSize: 10, color: "var(--l-text-dim)" }}>
                {String(queryCount).padStart(2, "0")} queries
              </span>
            )}
            <span className="mono" style={{ fontSize: 10, color: "var(--l-text-dim)" }}>
              {model}
            </span>
            <span style={{ fontSize: 11, color: connected ? "#1a7f37" : warming ? "#b45309" : "var(--l-text-dim)" }}>
              {connected ? "● connected" : warming ? "○ warming up…" : "○ offline"}
            </span>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", background: "var(--l-bg)" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 120px" }}>
            <AgentTimeline steps={state.steps} streaming={state.streaming} />
            <ReportArea
              sections={state.sections}
              error={state.error}
              streaming={state.streaming}
              lastToken={state.lastToken}
              onQuery={handleQuery}
              suggestions={suggestions}
            />
          </div>
        </main>

        <div style={{ borderTop: "1px solid var(--l-border)", padding: "14px 24px", flexShrink: 0 }}>
          <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <DocumentUpload sessionId={sessionId} disabled={state.streaming} />
            <QueryBar onSubmit={handleQuery} disabled={state.streaming} />
          </div>
        </div>
      </div>
    </div>
  );
}
