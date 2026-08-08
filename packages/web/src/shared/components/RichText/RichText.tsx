import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TopicReference } from "@consilium/core";
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
const topicReferencePattern = /(?<![\p{L}\p{N}._-])(#[\p{L}\p{N}_-]+)/gu;

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

function decorateTopicReferences(node: SyntaxNode, references: Map<string, TopicReference>) {
  if (!node.children || ignoredMentionParents.has(node.tagName || "")) return;
  const children: SyntaxNode[] = [];

  for (const child of node.children) {
    if (child.type !== "text" || !child.value?.includes("#")) {
      decorateTopicReferences(child, references);
      children.push(child);
      continue;
    }

    const parts = child.value.split(topicReferencePattern);
    for (const part of parts) {
      if (!part) continue;
      const reference = part.startsWith("#") ? references.get(part.slice(1).toLowerCase()) : undefined;
      children.push(reference
        ? { type: "element", tagName: "a", properties: { className: ["rich-text__topic-reference"], href: `#topic-${reference.topicId}`, "data-topic-id": reference.topicId, title: reference.title }, children: [{ type: "text", value: part }] }
        : { type: "text", value: part });
    }
  }

  node.children = children;
}

export function RichText({ children, topicReferences = [], onTopicReference }: { children: string; topicReferences?: TopicReference[]; onTopicReference?: (topicId: string) => void }) {
  const references = new Map(topicReferences.map((reference) => [reference.mentionKey.toLowerCase(), reference]));
  return <div className="rich-text">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeMentions, () => (tree: SyntaxNode) => decorateTopicReferences(tree, references)]}
      components={{
        a: ({ children: linkChildren, href, ...props }) => {
          const topicIdValue = (props as Record<string, unknown>)["data-topic-id"];
          const topicId = typeof topicIdValue === "string" ? topicIdValue : undefined;
          return <a
            {...props}
            href={href}
            target={topicId ? undefined : "_blank"}
            rel={topicId ? undefined : "noreferrer"}
            onClick={(event) => {
              if (!topicId || !onTopicReference) return;
              event.preventDefault();
              onTopicReference(topicId);
            }}
          >{linkChildren}</a>;
        },
        img: ({ alt, ...props }) => <img {...props} alt={alt || ""} loading="lazy" referrerPolicy="no-referrer" />,
      }}
    >
      {children}
    </ReactMarkdown>
  </div>;
}
