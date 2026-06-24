import type { MonteCarloData } from "@/types/events";
import { formatPrice } from "@/lib/riskUtils";

export default function MonteCarloCard({ data }: { data: MonteCarloData }) {
  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Monte Carlo Simulation</div>
      <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 14, letterSpacing: "0.5px" }}>
        {data.simulations.toLocaleString()} paths · {data.days} days · GBM
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        <SimStat label="Mean Final Price"     value={formatPrice(data.mean_final_price)} color="var(--amber-bright)" />
        <SimStat label="5th Percentile (Bear)" value={formatPrice(data.percentile_5)}    color="var(--red)" />
        <SimStat label="95th Percentile (Bull)" value={formatPrice(data.percentile_95)}  color="var(--green)" />
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-faint)" }}>
        Std Dev of terminal prices: {formatPrice(data.std_final_price)}
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
