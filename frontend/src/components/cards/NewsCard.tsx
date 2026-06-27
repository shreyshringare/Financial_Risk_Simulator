import type { NewsData } from "@/types/events";

export default function NewsCard({ data }: { data: NewsData }) {
  const s = data.sentiment;
  const sentColor = s.sentiment === "bullish" ? "var(--green)" : s.sentiment === "bearish" ? "var(--red)" : "var(--amber)";
  const sentBorder = s.sentiment === "bullish" ? "rgba(57,255,20,0.3)" : s.sentiment === "bearish" ? "rgba(255,49,49,0.3)" : "rgba(255,180,60,0.3)";
  const sentBg = s.sentiment === "bullish" ? "rgba(57,255,20,0.05)" : s.sentiment === "bearish" ? "rgba(255,49,49,0.05)" : "rgba(255,180,60,0.05)";

  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">News & Sentiment</div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="font-display" style={{ fontSize: 22, color: "var(--amber-bright)", letterSpacing: 1 }}>
          {data.ticker}
        </span>
        <span style={{ fontSize: 9, letterSpacing: 2, padding: "2px 8px", border: `1px solid ${sentBorder}`, color: sentColor, background: sentBg }}>
          {s.sentiment.toUpperCase()}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
          +{s.positive_count} / -{s.negative_count}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.articles.map((article, i) => (
          <div key={i} style={{ borderLeft: "2px solid var(--border)", paddingLeft: 10 }}>
            <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.4, marginBottom: 3 }}>
              {article.title}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginBottom: 3 }}>
              {article.published}
            </div>
            {article.summary && (
              <div style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.5 }}>
                {article.summary.slice(0, 180)}{article.summary.length > 180 ? "…" : ""}
              </div>
            )}
          </div>
        ))}
      </div>

      {(s.positive_hits.length > 0 || s.negative_hits.length > 0) && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border-dim)", paddingTop: 8, fontSize: 9, fontFamily: "var(--font-mono)" }}>
          {s.positive_hits.length > 0 && (
            <div style={{ color: "var(--green)", marginBottom: 3 }}>▲ {s.positive_hits.join(", ")}</div>
          )}
          {s.negative_hits.length > 0 && (
            <div style={{ color: "var(--red)" }}>▼ {s.negative_hits.join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}
