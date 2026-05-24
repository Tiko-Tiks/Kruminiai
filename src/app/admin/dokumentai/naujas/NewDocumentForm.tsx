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

interface MeetingOption {
  id: string;
  title: string;
  meeting_date: string;
}

interface Props {
  meetings: MeetingOption[];
}

export function NewDocumentForm({ meetings }: Props) {
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
                { value: "true", label: "Matomas nariams" },
                { value: "false", label: "Tik administracijai" },
              ]}
            />
          </div>

          {/* Priskyrimas susirinkimui – kad dokumentas atsidurtų konkretaus
              susirinkimo „papkėje" tiek /dokumentai, tiek /susirinkimai/[id]
              puslapiuose. Neprivaloma (įstatai, sutartys gali neturėti). */}
          <div>
            <label
              htmlFor="meeting_id"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Susirinkimas (neprivaloma)
            </label>
            <select
              id="meeting_id"
              name="meeting_id"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">— Nepriskirta —</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {new Date(m.meeting_date).toLocaleDateString("lt-LT")} – {m.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Priskyrus susirinkimui, dokumentas atsiras to susirinkimo
              dokumentų aplankalyje (pvz., metinė ataskaita, protokolas,
              dalyvių sąrašas).
            </p>
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
  );
}
