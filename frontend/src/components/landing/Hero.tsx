"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const GITHUB_URL = "https://github.com/shreyshringare/Financial_Risk_Simulator";

const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => <div style={{ position: "absolute", inset: 0 }} />,
});

export default function Hero() {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "92vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <HeroScene />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 800, padding: "0 24px" }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="mono"
          style={{ fontSize: 13, letterSpacing: 2, color: "var(--l-accent)", marginBottom: 20 }}
        >
          AGENTIC FINANCIAL RISK ANALYSIS
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="serif"
          style={{
            fontSize: "clamp(42px, 6vw, 72px)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            lineHeight: 1.08,
            color: "var(--l-text)",
            margin: 0,
          }}
        >
          Institutional-grade risk analysis.{" "}
          <span style={{ color: "var(--l-text-dim)" }}>In plain English.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
          style={{
            fontSize: 18,
            color: "var(--l-text-dim)",
            maxWidth: 560,
            lineHeight: 1.6,
            margin: "24px auto 0",
          }}
        >
          Ask a question. An AI agent runs Monte Carlo simulations, VaR, options pricing, and stress
          tests — then composes an analyst research note in front of you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 36, flexWrap: "wrap" }}
        >
          <Link
            href="/app"
            style={{
              background: "#141413",
              color: "#faf9f5",
              borderRadius: 999,
              padding: "14px 28px",
              fontSize: 16,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Try the demo — no sign-up needed
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              border: "1px solid var(--l-border)",
              color: "var(--l-text)",
              borderRadius: 999,
              padding: "14px 28px",
              fontSize: 16,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            View on GitHub
          </a>
        </motion.div>
      </div>
    </section>
  );
}
