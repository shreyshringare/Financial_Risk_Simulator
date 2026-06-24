import type { ReportSection } from "@/types/events";
import StockCard from "./cards/StockCard";
import MonteCarloCard from "./cards/MonteCarloCard";
import RiskCard from "./cards/RiskCard";
import VerdictCard from "./cards/VerdictCard";
import CaveatsCard from "./cards/CaveatsCard";
import ProseCard from "./cards/ProseCard";

interface Props {
  sections: ReportSection[];
  error: string | null;
}

export default function ReportArea({ sections, error }: Props) {
  if (error) {
    return (
      <div style={{
        border: "1px solid rgba(255,49,49,0.3)",
        background: "rgba(255,49,49,0.05)",
        padding: 16, fontSize: 12, color: "var(--red)",
        fontFamily: "var(--font-mono)",
      }}>
        ⚠ {error}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: 240,
        color: "var(--text-faint)", fontSize: 11,
        animation: "fade-in 0.4s ease-out forwards",
      }}>
        <div className="font-display" style={{ fontSize: 48, color: "var(--amber-dim)", marginBottom: 12, lineHeight: 1, textShadow: "0 0 30px rgba(255,180,60,0.1)" }}>
          ◆
        </div>
        <p style={{ letterSpacing: 1, textAlign: "center" }}>Enter a query above to begin analysis.</p>
        <p style={{ fontSize: 10, marginTop: 8, color: "var(--text-faint)", opacity: 0.6, textAlign: "center" }}>
          Try: &quot;What is the VaR for AAPL?&quot; or &quot;Analyze portfolio: AAPL, MSFT, TSLA&quot;
        </p>
      </div>
    );
  }

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
