"use client";

import { useReducer, useCallback } from "react";
import type { ReportSection, SSEEvent } from "@/types/events";
import { streamChat } from "@/lib/sseClient";
import QueryBar from "@/components/QueryBar";
import ReportArea from "@/components/ReportArea";
import Sidebar from "@/components/Sidebar";

// ── State ─────────────────────────────────────────────────────────────────────

type State = {
  sections: ReportSection[];
  streaming: boolean;
  error: string | null;
  hasAnalysisSections: boolean;
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

const initial: State = { sections: [], streaming: false, error: null, hasAnalysisSections: false };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START":
      return { sections: [], streaming: true, error: null, hasAnalysisSections: false };

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
        return { ...state, sections };
      }
      const card = sections[idx] as Extract<ReportSection, { kind: "verdict" | "prose" }>;
      sections[idx] = { ...card, content: card.content + action.token };
      return { ...state, sections };
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

  const handleQuery = useCallback(async (message: string) => {
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
            ◆ FINSIM
          </span>
          <span style={{ color: "var(--text-faint)" }}>·</span>
          <span style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.5px" }}>
            Quantitative Risk Terminal · Monte Carlo · VaR · GBM · RAG
          </span>
          {state.streaming && (
            <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--green)", textShadow: "0 0 8px rgba(57,255,20,0.6)", letterSpacing: 2, display: "flex", alignItems: "center", gap: 5, animation: "pulse-glow 1.4s ease-in-out infinite" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 6px var(--green)", display: "inline-block", animation: "pulse-dot 1.4s ease-in-out infinite" }} />
              LIVE
            </div>
          )}
        </header>

        {/* Query bar */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
          <QueryBar onSubmit={handleQuery} disabled={state.streaming} />
        </div>

        {/* Report area */}
        <main style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <ReportArea sections={state.sections} error={state.error} />
        </main>
      </div>
    </div>
  );
}
