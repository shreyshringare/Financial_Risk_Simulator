import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
  streaming: boolean;
}

export default function VerdictCard({ content, streaming }: Props) {
  return (
    <div className="card-phosphor">
      <div className="card-label-phosphor">Analyst Verdict</div>
      <div className={`analyst-prose${streaming ? " streaming-cursor" : ""}`}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
