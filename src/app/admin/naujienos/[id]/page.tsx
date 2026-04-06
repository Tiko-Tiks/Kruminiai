import { getNewsArticleById } from "@/actions/news";
import { NewsForm } from "../NewsForm";
import { notFound } from "next/navigation";

interface Props {
  params: { id: string };
}

export default async function EditNewsPage({ params }: Props) {
  let article;
  try {
    article = await getNewsArticleById(params.id);
  } catch {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Redaguoti naujieną</h1>
        <p className="text-sm text-gray-500 mt-1">{article.title}</p>
      </div>
      <NewsForm article={article} />
    </div>
  );
}
