"use client";

import ReactMarkdown from "react-markdown";

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
