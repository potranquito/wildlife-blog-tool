import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Markdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => <a {...props} rel="noreferrer" target="_blank" />,
        pre: ({ node, ...props }) => <pre {...props} />,
        code: ({ node, ...props }) => <code {...props} />
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

