const LINES: { text: string; ok?: string }[] = [
  { text: "> INITIALIZING FINSIM ANALYST TERMINAL..." },
  { text: "> CONNECTING TO GROQ API................", ok: "OK" },
  { text: "> LOADING KNOWLEDGE BASE................", ok: "OK" },
  { text: "> MONTE CARLO ENGINE.....................", ok: "READY" },
  { text: ">" },
  { text: "> AWAITING QUERY. TYPE BELOW TO BEGIN ANALYSIS." },
];

export default function BootScreen() {
  return (
    <div style={{ padding: "20px 0", fontFamily: "var(--font-mono)", fontSize: 12 }}>
      {LINES.map((line, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 6,
            color: "var(--text-dim)",
            opacity: 0,
            animation: "print-in 0.25s ease-out forwards",
            animationDelay: `${i * 120}ms`,
            lineHeight: 2,
          }}
        >
          <span>{line.text}</span>
          {line.ok && (
            <span style={{
              color: line.ok === "READY" ? "var(--amber)" : "var(--green)",
              textShadow: line.ok === "READY"
                ? "0 0 6px rgba(255,180,60,0.5)"
                : "0 0 6px rgba(57,255,20,0.5)",
            }}>
              {line.ok}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
