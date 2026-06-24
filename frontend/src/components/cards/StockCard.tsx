import type { StockData } from "@/types/events";
import { formatPrice } from "@/lib/riskUtils";

export default function StockCard({ data }: { data: StockData }) {
  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Stock Overview</div>
      <div
        className="font-display"
        style={{ fontSize: 48, color: "var(--amber-bright)", textShadow: "0 0 20px var(--amber-dim)", lineHeight: 1, letterSpacing: 2, marginBottom: 12 }}
      >
        {formatPrice(data.latest_price)}
      </div>
      <div style={{ color: "var(--text-faint)", fontSize: 10, letterSpacing: 1, marginBottom: 14 }}>
        {data.ticker}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <Stat label="Period"       value={`${data.start} – ${data.end}`} />
        <Stat label="Trading Days" value={data.count.toLocaleString()} />
        <Stat label="52W Range"    value={`${formatPrice(data.min_price)} – ${formatPrice(data.max_price)}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}
