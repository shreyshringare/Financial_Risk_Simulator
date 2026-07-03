import { motion } from "framer-motion";
import type { MonteCarloData } from "@/types/events";
import { formatPrice } from "@/lib/riskUtils";

export default function MonteCarloCard({ data }: { data: MonteCarloData }) {
  // Range bar math: pad 10% either side of the p5–p95 band
  const spread = data.percentile_95 - data.percentile_5;
  const trackMin = data.percentile_5 - spread * 0.1;
  const trackMax = data.percentile_95 + spread * 0.1;
  const trackRange = trackMax - trackMin;
  const barLeft = trackRange > 0 ? ((data.percentile_5 - trackMin) / trackRange) * 100 : 0;
  const barWidth = trackRange > 0 ? (spread / trackRange) * 100 : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)", borderRadius: 10, padding: 24 }}
    >
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 6 }}>
        MONTE CARLO — FIG. 1
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginTop: 12, marginBottom: 16 }}>
        <SimStat label="Mean final price" value={formatPrice(data.mean_final_price)} />
        <SimStat label="P5 (bear)"        value={formatPrice(data.percentile_5)} />
        <SimStat label="P95 (bull)"       value={formatPrice(data.percentile_95)} />
      </div>

      {/* Percentile range bar */}
      <div style={{ marginBottom: 4 }}>
        <div className="mono" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, letterSpacing: 0.5, color: "var(--l-text-dim)" }}>
          <span>P5</span>
          <span>{formatPrice(data.mean_final_price)} mean</span>
          <span>P95</span>
        </div>
        {/* Track */}
        <div style={{ width: "100%", height: 6, background: "var(--l-surface-2)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
          {/* Fill */}
          <div style={{
            position: "absolute",
            top: 0,
            left: `${barLeft}%`,
            width: `${barWidth}%`,
            height: "100%",
            background: "var(--l-accent-soft)",
            borderLeft: "2px solid var(--l-accent)",
            borderRight: "2px solid var(--l-accent)",
            boxSizing: "border-box",
          }} />
        </div>
        <div className="mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--l-text-dim)" }}>
          <span>{formatPrice(data.percentile_5)}</span>
          <span>{formatPrice(data.percentile_95)}</span>
        </div>
      </div>

      <div className="mono" style={{ marginTop: 8, fontSize: 11, color: "var(--l-text-dim)" }}>
        Std dev of terminal prices: {formatPrice(data.std_final_price)}
      </div>

      <div style={{ fontSize: 12, color: "var(--l-text-dim)", fontStyle: "italic", marginTop: 12 }}>
        Fig. 1 — GBM Monte Carlo, {data.simulations.toLocaleString()} paths, {data.days}-day horizon, seed 42
      </div>
    </motion.section>
  );
}

function SimStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--l-text-dim)", marginBottom: 4 }}>
        {label}
      </div>
      <div className="serif" style={{ fontSize: 26, color: "var(--l-text)", lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}
