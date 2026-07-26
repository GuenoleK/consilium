import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./RichText.scss";

interface SyntaxNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: SyntaxNode[];
}

const ignoredMentionParents = new Set(["a", "code", "pre"]);
const mentionPattern = /(?<![\p{L}\p{N}._-])(@(?:[\p{L}\p{N}_-]+|\[[^\]\r\n]{1,80}\]))/gu;
const exactMentionPattern = /^@(?:[\p{L}\p{N}_-]+|\[[^\]\r\n]{1,80}\])$/u;

function decorateMentions(node: SyntaxNode) {
  if (!node.children || ignoredMentionParents.has(node.tagName || "")) return;
  const children: SyntaxNode[] = [];

  for (const child of node.children) {
    if (child.type !== "text" || !child.value?.includes("@")) {
      decorateMentions(child);
      children.push(child);
      continue;
    }

    const parts = child.value.split(mentionPattern);
    for (const part of parts) {
      if (!part) continue;
      children.push(exactMentionPattern.test(part)
        ? { type: "element", tagName: "mark", properties: { className: ["rich-text__mention"] }, children: [{ type: "text", value: part }] }
        : { type: "text", value: part });
    }
  }

  node.children = children;
}

function rehypeMentions() {
  return (tree: SyntaxNode) => decorateMentions(tree);
}

export function RichText({ children }: { children: string }) {
  return <div className="rich-text">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeMentions]}
      components={{
        a: ({ children: linkChildren, ...props }) => <a {...props} target="_blank" rel="noreferrer">{linkChildren}</a>,
        img: ({ alt, ...props }) => <img {...props} alt={alt || ""} loading="lazy" referrerPolicy="no-referrer" />,
      }}
    >
      {children}
    </ReactMarkdown>
  </div>;
}
