import type { MonteCarloData } from "@/types/events";
import { formatPrice } from "@/lib/riskUtils";

export default function MonteCarloCard({ data }: { data: MonteCarloData }) {
  // Range bar math: pad 10% either side of the p5–p95 band
  const spread = data.percentile_95 - data.percentile_5;
  const trackMin = data.percentile_5 - spread * 0.1;
  const trackMax = data.percentile_95 + spread * 0.1;
  const trackRange = trackMax - trackMin;
  const barLeft = ((data.percentile_5 - trackMin) / trackRange) * 100;
  const barWidth = (spread / trackRange) * 100;

  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Monte Carlo Simulation</div>
      <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 12, letterSpacing: "0.5px" }}>
        {data.simulations.toLocaleString()} paths · {data.days} days · GBM
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }}>
        <SimStat label="Mean Final Price"      value={formatPrice(data.mean_final_price)} color="var(--amber-bright)" />
        <SimStat label="5th Pct (Bear)"        value={formatPrice(data.percentile_5)}     color="var(--red)" />
        <SimStat label="95th Pct (Bull)"       value={formatPrice(data.percentile_95)}    color="var(--green)" />
      </div>

      {/* Percentile range bar */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 9, letterSpacing: 1, color: "var(--text-faint)" }}>
          <span>P5</span>
          <span style={{ color: "var(--text-dim)" }}>{formatPrice(data.mean_final_price)} mean</span>
          <span>P95</span>
        </div>
        {/* Track */}
        <div style={{ width: "100%", height: 4, background: "var(--border)", position: "relative", overflow: "hidden" }}>
          {/* Fill */}
          <div style={{
            position: "absolute",
            top: 0,
            left: `${barLeft}%`,
            width: `${barWidth}%`,
            height: "100%",
            background: "rgba(255,180,60,0.35)",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "var(--text-faint)" }}>
          <span>{formatPrice(data.percentile_5)}</span>
          <span>{formatPrice(data.percentile_95)}</span>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-faint)" }}>
        Std dev of terminal prices: {formatPrice(data.std_final_price)}
      </div>
    </div>
  );
}

function SimStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 4 }}>
        {label}
      </div>
      <div className="font-display" style={{ fontSize: 28, color, letterSpacing: 1, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}
