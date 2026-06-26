interface Props {
  lastToken: string;
}

export default function StreamingIndicator({ lastToken }: Props) {
  const label = lastToken
    ? lastToken.slice(0, 40) + (lastToken.length > 40 ? "…" : "")
    : "PROCESSING...";

  return (
    <div style={{
      padding: "20px 0",
      fontFamily: "var(--font-mono)",
      opacity: 0,
      animation: "print-in 0.25s ease-out forwards",
    }}>
      <div style={{ fontSize: 11, color: "var(--amber)", letterSpacing: 2, marginBottom: 14 }}>
        ◆ ANALYST PROCESSING
      </div>

      {/* Progress track */}
      <div style={{
        width: "100%",
        height: 4,
        background: "var(--border)",
        position: "relative",
        marginBottom: 10,
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          top: 0, left: 0,
          height: "100%",
          background: "rgba(255,180,60,0.4)",
          animation: "progress-fill 8s ease-out forwards",
        }} />
      </div>

      {/* Last token label */}
      <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.5px" }}>
        {label}
      </div>
    </div>
  );
}
