import { motion } from "framer-motion";
import type { StressTestData } from "@/types/events";

export default function StressTestCard({ data }: { data: StressTestData }) {
  const scenarioLabel = data.scenario_name.replace(/_/g, " ").toUpperCase();
  const shockPct = (Math.abs(data.shock_applied) * 100).toFixed(0);
  const baseVarPct = (Math.abs(data.baseline_var_95) * 100).toFixed(2);
  const stressVarPct = (Math.abs(data.stressed_var_95) * 100).toFixed(2);
  const worstPct = (Math.abs(data.worst_case_loss) * 100).toFixed(1);

  const baseWidth = Math.min(100, (Math.abs(data.baseline_var_95) / Math.abs(data.stressed_var_95)) * 100);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)", borderRadius: 10, padding: 24 }}
    >
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 6 }}>
        STRESS TEST — {scenarioLabel}
      </div>

      <div style={{ marginTop: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--l-text-dim)", lineHeight: 1.6 }}>
          {data.description}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: 1, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(159,18,57,0.25)", color: "#9f1239", background: "#fdf0f3" }}>
          Shock applied: -{shockPct}%
        </span>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 1, marginBottom: 10 }}>95% VaR COMPARISON</div>

        <div style={{ marginBottom: 10 }}>
          <div className="mono" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
            <span style={{ color: "var(--l-text-dim)" }}>95% VaR (baseline)</span>
            <span style={{ color: "var(--l-text)" }}>{baseVarPct}%</span>
          </div>
          <div style={{ height: 6, background: "var(--l-surface-2)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${baseWidth}%`, background: "var(--l-accent)", transition: "width 0.5s ease" }} />
          </div>
        </div>

        <div>
          <div className="mono" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
            <span style={{ color: "var(--l-text-dim)" }}>95% VaR (stressed)</span>
            <span style={{ color: "#9f1239" }}>{stressVarPct}%</span>
          </div>
          <div style={{ height: 6, background: "var(--l-surface-2)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "100%", background: "#9f1239", opacity: 0.8 }} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <MiniStat label="Worst case loss"      value={`-${worstPct}%`} />
        <MiniStat label="Baseline mean return" value={`${(data.baseline_mean_return * 100).toFixed(1)}%`} />
        <MiniStat label="Stressed mean return" value={`${(data.stressed_mean_return * 100).toFixed(1)}%`} />
      </div>
    </motion.section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--l-border)", borderRadius: 6, padding: "6px 10px" }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 14, color: "var(--l-text)" }}>{value}</div>
    </div>
  );
}
