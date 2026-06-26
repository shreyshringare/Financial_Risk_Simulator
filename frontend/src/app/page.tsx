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

  useEffect(() => {
    fetch("http://localhost:8000/api/health")
      .then((r) => r.json())
      .then((d) => { if (d.model) setModel(d.model); })
      .catch(() => {});
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
      <Sidebar onQuery={handleQuery} disabled={state.streaming} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

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
            {queryCount > 0 && (
              <span style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: 1, fontFamily: "var(--font-mono)" }}>
                [{String(queryCount).padStart(2, "0")} QUERIES]
              </span>
            )}
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

        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
          <QueryBar onSubmit={handleQuery} disabled={state.streaming} />
        </div>

        <main style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 40 }}>
          <ReportArea
            sections={state.sections}
            error={state.error}
            streaming={state.streaming}
            lastToken={state.lastToken}
          />
        </main>

        <StatusBar isStreaming={state.streaming} model={model} />
      </div>
    </div>
  );
}
