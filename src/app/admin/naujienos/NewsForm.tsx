"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createNews, updateNews } from "@/actions/news";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { X } from "lucide-react";
import { getImagePublicUrl } from "@/lib/utils";
import { compressImage } from "@/lib/image-compress";
import type { NewsArticle } from "@/lib/types";

interface Props {
  article?: NewsArticle;
}

export function NewsForm({ article }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const isEdit = !!article;

  // Viršelio nuotrauka: naujai pasirinktas failas (suspaustas naršyklėje),
  // peržiūros URL ir žyma, kad esamas viršelis šalinamas
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [preparingCover, setPreparingCover] = useState(false);

  // Atlaisvinam object URL, kad neliktų atminties nutekėjimo
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const existingCover =
    article?.cover_image_path && !removeCover
      ? getImagePublicUrl(article.cover_image_path)
      : null;
  const shownCover = previewUrl || existingCover;

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pasirinkite nuotraukos failą");
      e.target.value = "";
      return;
    }

    setPreparingCover(true);
    try {
      const compressed = await compressImage(file);
      setCoverFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setRemoveCover(false);
    } finally {
      setPreparingCover(false);
    }
  };

  // „X" ant naujai pasirinktos nuotraukos atšaukia pasirinkimą,
  // ant esamo viršelio – pažymi jį šalinimui (įsigalioja išsaugojus)
  const handleCoverRemove = () => {
    if (previewUrl) {
      setPreviewUrl(null);
      setCoverFile(null);
      if (coverInputRef.current) coverInputRef.current.value = "";
      return;
    }
    setRemoveCover(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    // Vietoj originalo siunčiam suspaustą variantą
    formData.delete("cover");
    if (coverFile) formData.append("cover", coverFile);
    else if (removeCover) formData.append("remove_cover", "true");

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
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Kategorija *
            </label>
            <select
              id="category"
              name="category"
              defaultValue={article?.category || "bendra"}
              required
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="bendra">Bendra naujiena</option>
              <option value="projektas">Projektas (aukų rinkimas, iniciatyva)</option>
              <option value="susirinkimas">Susirinkimas (pranešimas, rezultatai)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Kategorija nustato, kuriame Skaidrumo puslapio tab&apos;e naujiena rodoma.
            </p>
            {errors.category && (
              <p className="text-xs text-red-600 mt-1">{errors.category[0]}</p>
            )}
          </div>
          <Textarea
            id="excerpt"
            name="excerpt"
            label="Trumpa santrauka"
            defaultValue={article?.excerpt || ""}
            className="min-h-[60px]"
            placeholder="Trumpas aprašymas, rodomas naujienų sąraše..."
          />
          <div>
            <label
              htmlFor="cover"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Viršelio nuotrauka
            </label>

            {shownCover && (
              <div className="relative inline-block mb-2">
                <img
                  src={shownCover}
                  alt="Viršelio peržiūra"
                  className="h-40 w-auto max-w-full rounded-lg border border-gray-200 object-cover"
                />
                <button
                  type="button"
                  onClick={handleCoverRemove}
                  title="Pašalinti viršelį"
                  className="absolute -top-2 -right-2 p-1 bg-white border border-gray-300 rounded-full text-gray-500 hover:text-red-600 hover:border-red-300 shadow-sm transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {removeCover && !previewUrl && (
              <div className="flex items-center gap-2 mb-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                Viršelis bus pašalintas išsaugojus.
                <button
                  type="button"
                  onClick={() => setRemoveCover(false)}
                  className="underline hover:no-underline"
                >
                  Atšaukti
                </button>
              </div>
            )}

            <input
              ref={coverInputRef}
              id="cover"
              name="cover"
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-1">
              {preparingCover
                ? "Ruošiama nuotrauka..."
                : "Rodoma naujienų sąraše ir straipsnio viršuje. Nuotrauka automatiškai sumažinama iki 1600 px."}
            </p>
          </div>

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
            <Button type="submit" loading={loading} disabled={preparingCover}>
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
