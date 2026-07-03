import type { ReportSection } from "@/types/events";
import StockCard from "./cards/StockCard";
import MonteCarloCard from "./cards/MonteCarloCard";
import RiskCard from "./cards/RiskCard";
import OptionsCard from "./cards/OptionsCard";
import VerdictCard from "./cards/VerdictCard";
import CaveatsCard from "./cards/CaveatsCard";
import ProseCard from "./cards/ProseCard";
import StreamingIndicator from "./StreamingIndicator";
import PortfolioCard  from "./cards/PortfolioCard";
import StressTestCard from "./cards/StressTestCard";
import FrontierCard   from "./cards/FrontierCard";
import NewsCard       from "./cards/NewsCard";
import TitleBlock     from "./report/TitleBlock";

const SAMPLE_QUERIES = [
  "What is the VaR for AAPL?",
  "Price a $200 call on NVDA expiring in 90 days",
  "Stress test AAPL against covid 2020",
];

interface Props {
  sections: ReportSection[];
  error: string | null;
  streaming: boolean;
  lastToken: string;
  onQuery?: (q: string) => void;
}

// Derive the report ticker + subject from the first analytic section available.
function deriveTitle(sections: ReportSection[]): { ticker: string; subject: string } {
  for (const section of sections) {
    switch (section.kind) {
      case "stock":       return { ticker: section.data.ticker, subject: "Risk Assessment" };
      case "monte_carlo": return { ticker: section.data.ticker, subject: "Risk Assessment" };
      case "options":     return { ticker: section.data.ticker, subject: "Options Analysis" };
      case "news":        return { ticker: section.data.ticker, subject: "Risk Assessment" };
      case "portfolio":   return { ticker: section.data.tickers.join(", "), subject: "Portfolio Analysis" };
      case "frontier":    return { ticker: section.data.tickers.join(", "), subject: "Portfolio Analysis" };
      default: continue;
    }
  }
  return { ticker: "", subject: "Risk Assessment" };
}

export default function ReportArea({ sections, error, streaming, lastToken, onQuery }: Props) {
  // Error state — shown regardless of sections
  if (error) {
    return (
      <div style={{
        border: "1px solid rgba(159,18,57,0.4)",
        background: "#fdf0f3",
        borderRadius: 10,
        padding: "16px 20px",
      }}>
        <div className="mono" style={{ fontSize: 11, color: "#9f1239", letterSpacing: 1, marginBottom: 6 }}>
          ERROR
        </div>
        <div style={{ fontSize: 13, color: "#9f1239", lineHeight: 1.6 }}>
          {error}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", marginTop: 8 }}>
          Submit a new query to retry.
        </div>
      </div>
    );
  }

  // Empty state — no query submitted yet
  if (sections.length === 0 && !streaming) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", padding: "64px 24px",
      }}>
        <div className="serif" style={{ fontSize: 20, color: "var(--l-text)", marginBottom: 8 }}>
          Ask the desk
        </div>
        <div style={{ fontSize: 13, color: "var(--l-text-dim)", marginBottom: 24 }}>
          Monte Carlo · VaR · Options · Stress tests — in plain English
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
          {SAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => onQuery?.(q)}
              style={{
                border: "1px solid var(--l-border)",
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 13,
                background: "none",
                color: "var(--l-text)",
                cursor: "pointer",
                transition: "150ms ease-out",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--l-surface-2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Streaming indicator — query in flight, no cards yet
  if (sections.length === 0 && streaming) {
    return <StreamingIndicator lastToken={lastToken} />;
  }

  // Normal: render cards
  const { ticker, subject } = deriveTitle(sections);
  return (
    <article style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sections.length > 0 && <TitleBlock ticker={ticker} subject={subject} />}
      {sections.map((section, i) => (
        <SectionRenderer key={i} section={section} />
      ))}
    </article>
  );
}

function SectionRenderer({ section }: { section: ReportSection }) {
  switch (section.kind) {
    case "stock":       return <StockCard data={section.data} />;
    case "monte_carlo": return <MonteCarloCard data={section.data} />;
    case "risk":        return <RiskCard data={section.data} />;
    case "options":     return <OptionsCard data={section.data} />;
    case "verdict":     return <VerdictCard content={section.content} streaming={section.streaming} />;
    case "caveats":     return <CaveatsCard />;
    case "prose":       return <ProseCard content={section.content} streaming={section.streaming} />;
    case "portfolio":   return <PortfolioCard  data={section.data} />;
    case "stress_test": return <StressTestCard data={section.data} />;
    case "frontier":    return <FrontierCard   data={section.data} />;
    case "news":        return <NewsCard       data={section.data} />;
  }
}
