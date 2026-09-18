"use client";

import ReactMarkdown from "react-markdown";

/**
 * Naujienos turinio atvaizdavimas iš markdown.
 *
 * KODĖL stiliai surašyti ranka, o ne per `prose`: `@tailwindcss/typography`
 * plugin'o projekte nėra (`tailwind.config.ts` → `plugins: []`), todėl
 * `prose prose-gray` klasės negeneruodavo JOKIO CSS – straipsniai buvo
 * atvaizduojami naršyklės numatytaisiais stiliais (pastraipos be tarpų,
 * sąrašai be ženkliukų). Atrodė „beveik gerai", todėl ilgai liko nepastebėta.
 *
 * SVARBU `pre`/`code`: 4 tarpais atitrauktos eilutės markdown'e virsta kodo
 * bloku. Redaktoriui tai lengva padaryti netyčia (kopijuojant iš Word'o ar
 * el. laiško), todėl kodo blokas privalo LAUŽTI eilutes – kitaip tekstas
 * išbėga už ekrano ribų ir tampa neperskaitomas. Taip atsitiko su
 * „Gintauto Kairio šaknys Krūminiuose" straipsniu.
 */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-prose text-ink-muted break-words">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-5 text-pretty">{children}</p>,
          h1: ({ children }) => (
            <h2 className="font-display text-2xl font-semibold text-ink mt-10 mb-3 text-balance">{children}</h2>
          ),
          h2: ({ children }) => (
            <h2 className="font-display text-xl font-semibold text-ink mt-10 mb-3 text-balance">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-display text-lg font-semibold text-ink mt-8 mb-2">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-brand font-medium underline underline-offset-2 hover:text-brand-strong"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-brand-line pl-5 italic text-ink-muted my-6">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-10 border-line" />,
          // `next/image` nenaudojam – žr. CLAUDE.md „Nuotraukos (images bucket)"
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={typeof src === "string" ? src : ""}
              alt={alt || ""}
              className="rounded-xl my-6 max-w-full h-auto"
            />
          ),
          // Laužia eilutes: netyčia atitrauktas tekstas lieka skaitomas
          pre: ({ children }) => (
            <pre className="bg-surface-muted border border-line rounded-lg p-4 my-5 overflow-x-auto whitespace-pre-wrap break-words text-sm">
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code className="bg-surface-muted border border-line rounded px-1.5 py-0.5 text-sm break-words">
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-line bg-surface-muted px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-line px-3 py-2 align-top">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
