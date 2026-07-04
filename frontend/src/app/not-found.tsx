import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="landing"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div className="serif" style={{ fontSize: 56, fontWeight: 600, color: "var(--l-text)", lineHeight: 1 }}>
        404
      </div>
      <div style={{ fontSize: 14, color: "var(--l-text-dim)", marginTop: 12, marginBottom: 24 }}>
        This path simulated to zero.
      </div>
      <Link
        href="/"
        style={{
          fontSize: 14,
          color: "var(--l-accent)",
          textDecoration: "none",
        }}
      >
        ← Back to FinSim
      </Link>
    </div>
  );
}
