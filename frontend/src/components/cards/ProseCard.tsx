import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
  streaming: boolean;
}

export default function ProseCard({ content }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ background: "var(--l-surface)", border: "1px solid var(--l-border)", borderRadius: 10, padding: 24 }}
    >
      <div className="analyst-prose">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </motion.section>
  );
}
