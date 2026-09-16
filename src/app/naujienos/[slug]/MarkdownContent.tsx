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
    <div className="text-gray-700 leading-relaxed break-words">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
          h1: ({ children }) => (
            <h2 className="text-2xl font-bold text-green-800 mt-8 mb-3">{children}</h2>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-green-800 mt-8 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">{children}</h3>
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
              className="text-green-700 font-medium underline underline-offset-2 hover:text-green-800"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-green-200 pl-4 italic text-gray-600 my-4">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-gray-200" />,
          // `next/image` nenaudojam – žr. CLAUDE.md „Nuotraukos (images bucket)"
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={typeof src === "string" ? src : ""}
              alt={alt || ""}
              className="rounded-xl my-4 max-w-full h-auto"
            />
          ),
          // Laužia eilutes: netyčia atitrauktas tekstas lieka skaitomas
          pre: ({ children }) => (
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4 overflow-x-auto whitespace-pre-wrap break-words text-sm">
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 rounded px-1.5 py-0.5 text-sm break-words">
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-3 py-2 align-top">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
