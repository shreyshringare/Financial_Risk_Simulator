import { motion } from "framer-motion";
import type { RiskData } from "@/types/events";
import {
  riskLevel, riskBadgeClass, riskOverallClass, overallRisk,
  formatPct, type RiskLevel,
} from "@/lib/riskUtils";

export default function RiskCard({ data }: { data: RiskData }) {
  const overall = overallRisk(data.var_hist ?? data.var, data.sharpe, data.max_drawdown);
  const sharpeLevel: RiskLevel = data.sharpe > 1 ? "LOW" : data.sharpe > 0.5 ? "MODERATE" : "HIGH";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)", borderRadius: 10, padding: 24 }}
    >
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 6 }}>
        RISK METRICS
      </div>
      <div style={{ display: "flex", gap: 20, alignItems: "stretch", marginTop: 12 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
          <RiskRow label="95% 1-day VaR (historical)"  value={formatPct(data.var_hist)}        level={riskLevel(data.var_hist)} />
          <RiskRow label="95% CVaR / expected shortfall (historical)" value={formatPct(data.cvar_hist)} level={riskLevel(data.cvar_hist)} />
          <RiskRow label="95% VaR (GBM simulation)"    value={formatPct(data.var_sim)}         level={riskLevel(data.var_sim)} />
          <RiskRow label="95% CVaR (GBM simulation)"   value={formatPct(data.cvar_sim)}         level={riskLevel(data.cvar_sim)} />
          <RiskRow label="Annualized Sharpe (rf=0)"    value={data.sharpe.toFixed(4)}           level={sharpeLevel} />
          <RiskRow label="Maximum drawdown"            value={formatPct(data.max_drawdown)}     level={riskLevel(data.max_drawdown)} />
          {data.var_99 !== undefined && (
            <RiskRow label="99% 1-day VaR (historical)" value={formatPct(data.var_99)} level={riskLevel(data.var_99)} />
          )}
          {data.cvar_99 !== undefined && (
            <RiskRow label="99% CVaR / expected shortfall" value={formatPct(data.cvar_99)} level={riskLevel(data.cvar_99)} />
          )}
          {data.volatility_annualized !== undefined && (
            <PlainRow label="Volatility (σ, annualized)" value={formatPct(data.volatility_annualized)} />
          )}
          {data.beta_spy !== undefined && data.beta_spy !== null && (
            <PlainRow label="Beta vs SPY (5y daily)" value={data.beta_spy.toFixed(2)} />
          )}
        </div>
        <OverallRating level={overall} />
      </div>
    </motion.section>
  );
}

function RiskRow({ label, value, level }: { label: string; value: string; level: RiskLevel }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "8px 0",
      borderBottom: "1px solid var(--l-border)",
      gap: 8,
    }}>
      {/* Label */}
      <span style={{ flex: 1, fontSize: 13, color: "var(--l-text-dim)" }}>
        {label}
      </span>
      {/* Value + risk badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="mono" style={{ fontSize: 13, color: "var(--l-text)", textAlign: "right" }}>
          {value}
        </span>
        <span className={riskBadgeClass(level)}>{level}</span>
      </div>
    </div>
  );
}

function PlainRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "8px 0",
      borderBottom: "1px solid var(--l-border)",
      gap: 8,
    }}>
      <span style={{ flex: 1, fontSize: 13, color: "var(--l-text-dim)" }}>
        {label}
      </span>
      <span className="mono" style={{ fontSize: 13, color: "var(--l-text)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function OverallRating({ level }: { level: RiskLevel }) {
  const label = level === "MODERATE" ? "MODERATE" : level;
  return (
    <div style={{
      width: 120, flexShrink: 0,
      border: "1px solid var(--l-border)",
      borderRadius: 8,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 8, padding: 16,
      background: "var(--l-surface-2)",
    }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--l-text-dim)" }}>
        Risk Rating
      </div>
      <div className={`serif ${riskOverallClass(level)}`} style={{ fontSize: 20 }}>{label}</div>
    </div>
  );
}
