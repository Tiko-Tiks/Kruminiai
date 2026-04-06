"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDocument } from "@/actions/documents";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export default function NewDocumentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createDocument(formData);
    setLoading(false);

    if (result.error) {
      toast.error(typeof result.error === "string" ? result.error : "Nepavyko įkelti");
      return;
    }

    toast.success("Dokumentas įkeltas");
    router.push("/admin/dokumentai");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Įkelti dokumentą</h1>
        <p className="text-sm text-gray-500 mt-1">Įkelkite naują dokumentą į archyvą</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Dokumento informacija</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <Input id="title" name="title" label="Pavadinimas *" required />
            <Textarea id="description" name="description" label="Aprašymas" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                id="category"
                name="category"
                label="Kategorija"
                options={[
                  { value: "protokolai", label: "Protokolai" },
                  { value: "ataskaitos", label: "Ataskaitos" },
                  { value: "istatai", label: "Įstatai" },
                  { value: "sutartys", label: "Sutartys" },
                  { value: "kita", label: "Kita" },
                ]}
              />
              <Select
                id="is_public"
                name="is_public"
                label="Matomumas"
                options={[
                  { value: "true", label: "Viešas" },
                  { value: "false", label: "Tik administracijai" },
                ]}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Failas *</label>
              <label className="flex items-center justify-center gap-2 w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                <Upload className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {fileName || "Pasirinkite failą..."}
                </span>
                <input
                  type="file"
                  name="file"
                  className="hidden"
                  required
                  onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
                />
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" loading={loading}>
                Įkelti
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Atšaukti
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
