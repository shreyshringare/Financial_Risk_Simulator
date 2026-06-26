import type { StockData } from "@/types/events";
import { formatPrice } from "@/lib/riskUtils";

export default function StockCard({ data }: { data: StockData }) {
  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Stock Overview</div>
      <div
        className="font-display"
        style={{ fontSize: 48, color: "var(--amber-bright)", textShadow: "0 0 20px var(--amber-dim)", lineHeight: 1, letterSpacing: 2, marginBottom: 10 }}
      >
        {formatPrice(data.latest_price)}
      </div>
      <div style={{ color: "var(--text-faint)", fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>
        {data.ticker}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px 16px" }}>
        <Stat label="Latest"        value={formatPrice(data.latest_price)} />
        <Stat label="Min"           value={formatPrice(data.min_price)} />
        <Stat label="Max"           value={formatPrice(data.max_price)} />
        <Stat label="Trading Days"  value={data.count.toLocaleString()} />
        <Stat label="From"          value={data.start} />
        <Stat label="To"            value={data.end} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}
