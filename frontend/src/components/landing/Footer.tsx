export default function Footer() {
  return (
    <footer
      style={{
        padding: "36px 24px",
        borderTop: "1px solid var(--l-border)",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 16,
        fontSize: 13,
        color: "var(--l-text-dim)",
      }}
    >
      <span className="serif">FinSim — open-source financial risk simulator</span>
      <span>Educational use only. Not investment advice.</span>
    </footer>
  );
}
