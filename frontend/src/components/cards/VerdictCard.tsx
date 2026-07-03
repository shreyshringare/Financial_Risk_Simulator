import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
  streaming: boolean;
}

export default function VerdictCard({ content }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface-2)", borderRadius: 10, padding: 24 }}
    >
      <div className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--l-text-dim)", marginBottom: 6 }}>
        ASSESSMENT
      </div>
      <div className="analyst-prose">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </motion.section>
  );
}
