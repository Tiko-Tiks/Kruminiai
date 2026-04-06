"use client";

import { useState } from "react";
import { Coins, FileText, FolderOpen, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentRow {
  id: string;
  title: string;
  file_path: string;
  file_name: string;
  category: string;
  published_at: string | null;
  file_size: number | null;
}

interface NewsRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
}

interface Props {
  ataskaitos: DocumentRow[];
  protokolai: DocumentRow[];
  istatai: DocumentRow[];
  news: NewsRow[];
}

const tabs = [
  { id: "finansai", label: "Finansai", icon: Coins },
  { id: "nutarimai", label: "Nutarimai", icon: FileText },
  { id: "projektai", label: "Projektai", icon: FolderOpen },
  { id: "susirinkimai", label: "Susirinkimai", icon: CalendarDays },
] as const;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getDocumentUrl(filePath: string) {
  if (filePath.startsWith('__api__/')) return `/api/dokumentai/${filePath.replace('__api__/', '')}`;
  if (filePath.startsWith('__public__/')) return `/${filePath.replace('__public__/', '')}`;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${filePath}`;
}

function EmptyState() {
  return (
    <p className="text-center text-gray-400 py-8">
      Duomenų nėra arba jie nėra vieši.
    </p>
  );
}

function DocumentTable({ documents, categoryLabel }: { documents: DocumentRow[]; categoryLabel: string }) {
  if (documents.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
              Data
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
              {categoryLabel}
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
              Failas
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50/50">
              <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                {formatDate(doc.published_at)}
              </td>
              <td className="py-3 px-4 text-gray-900">{doc.title}</td>
              <td className="py-3 px-4 text-right">
                <a
                  href={getDocumentUrl(doc.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 hover:text-green-800 font-medium text-xs"
                >
                  Atsisiųsti
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkaidrumasTabs({ ataskaitos, protokolai, istatai, news }: Props) {
  const [activeTab, setActiveTab] = useState<string>("finansai");

  return (
    <>
      {/* Tabs */}
      <div className="bg-gray-100 rounded-xl p-1 grid grid-cols-2 sm:grid-cols-4 gap-1 mb-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-green-800 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Finansai */}
      {activeTab === "finansai" && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 inline-block">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Visos lėšos
            </p>
            <p className="text-3xl font-bold text-green-800">0.00 &euro;</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Data
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Krepšelis
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                    Suma
                  </th>
                </tr>
              </thead>
              <tbody>
                {ataskaitos.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <EmptyState />
                    </td>
                  </tr>
                ) : (
                  ataskaitos.map((doc) => (
                    <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        {formatDate(doc.published_at)}
                      </td>
                      <td className="py-3 px-4 text-gray-900">{doc.title}</td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={getDocumentUrl(doc.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 hover:text-green-800 font-medium text-xs"
                        >
                          Atsisiųsti
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Nutarimai */}
      {activeTab === "nutarimai" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <DocumentTable documents={[...protokolai, ...istatai]} categoryLabel="Dokumentas" />
        </div>
      )}

      {/* Projektai */}
      {activeTab === "projektai" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {news.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-gray-100">
              {news.map((article) => (
                <a
                  key={article.id}
                  href={`/naujienos/${article.slug}`}
                  className="block px-6 py-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{article.title}</p>
                      {article.excerpt && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.excerpt}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {formatDate(article.published_at)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Susirinkimai */}
      {activeTab === "susirinkimai" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <DocumentTable documents={protokolai} categoryLabel="Susirinkimas" />
        </div>
      )}
    </>
  );
}
