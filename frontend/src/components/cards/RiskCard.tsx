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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <RiskRow label="Value at Risk (95%)"        value={formatPct(data.var_hist)}        level={riskLevel(data.var_hist)}  method="HIST SIM" />
          <RiskRow label="CVaR / Expected Shortfall"  value={formatPct(data.cvar_hist)}       level={riskLevel(data.cvar_hist)} method="HIST SIM" />
          <RiskRow label="Value at Risk (95%)"        value={formatPct(data.var_sim)}         level={riskLevel(data.var_sim)}   method="GBM SIM" />
          <RiskRow label="CVaR / Expected Shortfall"  value={formatPct(data.cvar_sim)}        level={riskLevel(data.cvar_sim)}  method="GBM SIM" />
          <RiskRow label="Sharpe Ratio"               value={data.sharpe.toFixed(4)}          level={sharpeLevel} />
          <RiskRow label="Maximum Drawdown"           value={formatPct(data.max_drawdown)}    level={riskLevel(data.max_drawdown)} />
        </div>
        <OverallRating level={overall} />
      </div>
    </div>
  );
}

function RiskRow({ label, value, level, method }: { label: string; value: string; level: RiskLevel; method?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-dim)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.5px" }}>{label}</span>
        {method && (
          <span style={{ fontSize: 8, color: "var(--text-faint)", border: "1px solid var(--border-dim)", padding: "1px 4px", letterSpacing: "0.5px" }}>
            {method}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="font-display" style={{ fontSize: 20, color: "var(--text)", letterSpacing: 1 }}>{value}</span>
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
