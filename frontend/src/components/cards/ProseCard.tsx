import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
  streaming: boolean;
}

export default function ProseCard({ content, streaming }: Props) {
  return (
    <div className="card-phosphor">
      <div className={`analyst-prose${streaming ? " streaming-cursor" : ""}`}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
