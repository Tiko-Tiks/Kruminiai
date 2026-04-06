"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNews, updateNews } from "@/actions/news";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import type { NewsArticle } from "@/lib/types";

interface Props {
  article?: NewsArticle;
}

export function NewsForm({ article }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const isEdit = !!article;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateNews(article.id, formData)
      : await createNews(formData);

    setLoading(false);

    if (result.error) {
      if (typeof result.error === "object") {
        setErrors(result.error as Record<string, string[]>);
      }
      toast.error("Nepavyko išsaugoti");
      return;
    }

    toast.success(isEdit ? "Naujiena atnaujinta" : "Naujiena sukurta");
    router.push("/admin/naujienos");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-900">
          {isEdit ? "Redaguoti naujieną" : "Nauja naujiena"}
        </h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
          <Input
            id="title"
            name="title"
            label="Antraštė *"
            defaultValue={article?.title}
            error={errors.title?.[0]}
            required
          />
          <Textarea
            id="excerpt"
            name="excerpt"
            label="Trumpa santrauka"
            defaultValue={article?.excerpt || ""}
            className="min-h-[60px]"
            placeholder="Trumpas aprašymas, rodomas naujienų sąraše..."
          />
          <Textarea
            id="content"
            name="content"
            label="Turinys *"
            defaultValue={article?.content}
            error={errors.content?.[0]}
            className="min-h-[300px]"
            placeholder="Naujienos tekstas..."
            required
          />

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_published"
                value="true"
                defaultChecked={article?.is_published ?? false}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Paskelbti
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_pinned"
                value="true"
                defaultChecked={article?.is_pinned ?? false}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              Prisegti viršuje
            </label>
          </div>

          {errors._form && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
              {errors._form[0]}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={loading}>
              {isEdit ? "Išsaugoti" : "Sukurti"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Atšaukti
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
