import { motion } from "framer-motion";
import type { NewsData } from "@/types/events";

export default function NewsCard({ data }: { data: NewsData }) {
  const s = data.sentiment;
  const sentColor = s.sentiment === "bullish" ? "#3f6212" : s.sentiment === "bearish" ? "#9f1239" : "#92400e";
  const sentBorder = s.sentiment === "bullish" ? "rgba(63,98,18,0.25)" : s.sentiment === "bearish" ? "rgba(159,18,57,0.25)" : "rgba(146,64,14,0.25)";
  const sentBg = s.sentiment === "bullish" ? "#f3f8e8" : s.sentiment === "bearish" ? "#fdf0f3" : "#fdf3e3";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)", borderRadius: 10, padding: 24 }}
    >
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 6 }}>
        NEWS & SENTIMENT
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <span className="serif" style={{ fontSize: 22, color: "var(--l-text)" }}>
          {data.ticker}
        </span>
        <span className="mono" style={{ fontSize: 11, letterSpacing: 1, padding: "3px 10px", borderRadius: 6, border: `1px solid ${sentBorder}`, color: sentColor, background: sentBg }}>
          {s.sentiment.toUpperCase()}
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)" }}>
          +{s.positive_count} / -{s.negative_count}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.articles.map((article, i) => (
          <div
            key={i}
            style={{
              borderLeft: "1px solid var(--l-border)",
              padding: "10px 12px",
              transition: "background 150ms ease-out",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--l-surface-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ fontSize: 13, color: "var(--l-text)", lineHeight: 1.4, marginBottom: 4 }}>
              {article.title}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", marginBottom: 4 }}>
              {article.published}
            </div>
            {article.summary && (
              <div style={{ fontSize: 12, color: "var(--l-text-dim)", lineHeight: 1.5 }}>
                {article.summary.slice(0, 180)}{article.summary.length > 180 ? "…" : ""}
              </div>
            )}
          </div>
        ))}
      </div>

      {(s.positive_hits.length > 0 || s.negative_hits.length > 0) && (
        <div className="mono" style={{ marginTop: 14, borderTop: "1px solid var(--l-border)", paddingTop: 10, fontSize: 11 }}>
          {s.positive_hits.length > 0 && (
            <div style={{ color: "#3f6212", marginBottom: 4 }}>▲ {s.positive_hits.join(", ")}</div>
          )}
          {s.negative_hits.length > 0 && (
            <div style={{ color: "#9f1239" }}>▼ {s.negative_hits.join(", ")}</div>
          )}
        </div>
      )}
    </motion.section>
  );
}
