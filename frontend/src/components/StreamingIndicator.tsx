interface Props {
  lastToken: string;
}

export default function StreamingIndicator({ lastToken }: Props) {
  const label = lastToken
    ? lastToken.slice(0, 40) + (lastToken.length > 40 ? "…" : "")
    : "Processing...";

  return (
    <div style={{ padding: "20px 0" }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)", letterSpacing: 1.5, marginBottom: 14 }}>
        Analyst processing
      </div>

      {/* Progress track */}
      <div style={{
        width: "100%",
        height: 2,
        background: "var(--l-surface-2)",
        position: "relative",
        marginBottom: 10,
        overflow: "hidden",
        borderRadius: 1,
      }}>
        <div style={{
          position: "absolute",
          top: 0, left: 0,
          height: "100%",
          background: "var(--l-accent)",
          animation: "progress-fill 8s ease-out forwards",
        }} />
      </div>

      {/* Last token label */}
      <div className="mono" style={{ fontSize: 11, color: "var(--l-text-dim)" }}>
        {label}
      </div>
    </div>
  );
}
