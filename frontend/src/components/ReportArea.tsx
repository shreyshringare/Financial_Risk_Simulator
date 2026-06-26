import type { ReportSection } from "@/types/events";
import StockCard from "./cards/StockCard";
import MonteCarloCard from "./cards/MonteCarloCard";
import RiskCard from "./cards/RiskCard";
import OptionsCard from "./cards/OptionsCard";
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
    case "options":     return <OptionsCard data={section.data} />;
    case "verdict":     return <VerdictCard content={section.content} streaming={section.streaming} />;
    case "caveats":     return <CaveatsCard />;
    case "prose":       return <ProseCard content={section.content} streaming={section.streaming} />;
  }
}
