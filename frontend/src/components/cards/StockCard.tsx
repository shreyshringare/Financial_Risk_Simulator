import { motion } from "framer-motion";
import type { StockData } from "@/types/events";
import { formatPrice } from "@/lib/riskUtils";

export default function StockCard({ data }: { data: StockData }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)", borderRadius: 10, padding: 24 }}
    >
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 6 }}>
        MARKET DATA
      </div>
      <div
        className="serif"
        style={{ fontSize: 28, color: "var(--l-text)", lineHeight: 1.1, marginBottom: 10 }}
      >
        {formatPrice(data.latest_price)}
      </div>
      <div className="mono" style={{ color: "var(--l-text-dim)", fontSize: 12, letterSpacing: 1, marginBottom: 16 }}>
        {data.ticker}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px 16px" }}>
        <Stat label="Latest"        value={formatPrice(data.latest_price)} />
        <Stat label="Min"           value={formatPrice(data.min_price)} />
        <Stat label="Max"           value={formatPrice(data.max_price)} />
        <Stat label="Trading Days"  value={data.count.toLocaleString()} />
        <Stat label="From"          value={data.start} />
        <Stat label="To"            value={data.end} />
      </div>
    </motion.section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--l-text-dim)", marginBottom: 3 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 13, color: "var(--l-text)", textAlign: "right" }}>{value}</div>
    </div>
  );
}
