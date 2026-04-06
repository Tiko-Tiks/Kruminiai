import { getNewsArticles } from "@/actions/news";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { Plus, Pin } from "lucide-react";
import Link from "next/link";
import { DeleteNewsButton } from "./DeleteNewsButton";

export default async function AdminNewsPage() {
  const articles = await getNewsArticles();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Naujienos</h1>
          <p className="text-sm text-gray-500 mt-1">{articles.length} naujienų</p>
        </div>
        <Link href="/admin/naujienos/nauja">
          <Button>
            <Plus className="h-4 w-4" /> Nauja naujiena
          </Button>
        </Link>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Antraštė</th>
                <th className="px-6 py-3 font-medium">Būsena</th>
                <th className="px-6 py-3 font-medium">Data</th>
                <th className="px-6 py-3 font-medium">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {articles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    Dar nėra naujienų
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr key={article.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {article.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                        <Link
                          href={`/admin/naujienos/${article.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {article.title}
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <Badge variant={article.is_published ? "success" : "warning"}>
                        {article.is_published ? "Paskelbta" : "Juodraštis"}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {formatDate(article.published_at || article.created_at)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/naujienos/${article.id}`}
                          className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          Redaguoti
                        </Link>
                        <DeleteNewsButton id={article.id} title={article.title} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
