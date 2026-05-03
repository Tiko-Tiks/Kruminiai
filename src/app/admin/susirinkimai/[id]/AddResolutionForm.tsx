"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createResolution } from "@/actions/voting";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { Plus, Paperclip, X, FileText, Upload } from "lucide-react";
import { Document } from "@/lib/types";
import { formatFileSize } from "@/lib/utils";

interface NewFileItem {
  file: File;
  title: string;
}

export function AddResolutionForm({
  meetingId,
  allDocuments,
}: {
  meetingId: string;
  allDocuments: Document[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [newFiles, setNewFiles] = useState<NewFileItem[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  function reset() {
    setSelectedDocIds(new Set());
    setNewFiles([]);
    setShowLibrary(false);
    setOpen(false);
  }

  function toggleDoc(id: string) {
    const next = new Set(selectedDocIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDocIds(next);
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    const items: NewFileItem[] = Array.from(files).map((f) => ({
      file: f,
      title: f.name.replace(/\.[^.]+$/, ""),
    }));
    setNewFiles((prev) => [...prev, ...items]);
  }

  function updateNewFileTitle(idx: number, title: string) {
    setNewFiles((prev) => prev.map((it, i) => (i === idx ? { ...it, title } : it)));
  }

  function removeNewFile(idx: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    // Pridėti pasirinktus esamus dokumentus
    selectedDocIds.forEach((id) => formData.append("existing_document_ids", id));
    // Pridėti naujus failus su pavadinimais
    newFiles.forEach((item) => {
      formData.append("new_files", item.file);
      formData.append("new_file_titles", item.title);
    });

    const result = await createResolution(meetingId, formData);

    if (result.error) {
      toast.error("Klaida kuriant nutarimą");
    } else {
      const docCount = selectedDocIds.size + newFiles.length;
      toast.success(
        docCount > 0
          ? `Klausimas pridėtas su ${docCount} dokumentu(-ais)`
          : "Klausimas pridėtas"
      );
      reset();
      router.refresh();
    }
    setLoading(false);
  };

  const availableDocs = allDocuments.filter((d) => !selectedDocIds.has(d.id));
  const selectedDocs = allDocuments.filter((d) => selectedDocIds.has(d.id));
  const totalAttached = selectedDocIds.size + newFiles.length;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Pridėti darbotvarkės klausimą
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white"
    >
      <input
        name="title"
        placeholder="Klausimo pavadinimas (pvz.: Dėl metinės ataskaitos tvirtinimo)"
        required
        className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <textarea
        name="description"
        placeholder="Aprašymas (neprivaloma)"
        rows={2}
        className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            name="requires_qualified_majority"
            className="rounded border-gray-300"
          />
          Reikalinga 2/3 dauguma (įstatų keitimas, likvidavimas)
        </label>
      </div>

      {/* Dokumentų sekcija */}
      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" />
            Dokumentai {totalAttached > 0 && `(${totalAttached})`}
          </span>
        </div>

        {/* Pasirinkti esami dokumentai */}
        {selectedDocs.length > 0 && (
          <ul className="space-y-1 mb-2">
            {selectedDocs.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-100 px-2 py-1.5 rounded"
              >
                <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <span className="flex-1 truncate text-gray-800">{d.title}</span>
                {d.file_size && (
                  <span className="text-xs text-gray-500">{formatFileSize(d.file_size)}</span>
                )}
                <button
                  type="button"
                  onClick={() => toggleDoc(d.id)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Nauji failai (dar neįkelti) */}
        {newFiles.length > 0 && (
          <ul className="space-y-1 mb-2">
            {newFiles.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-100 px-2 py-1.5 rounded"
              >
                <Upload className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateNewFileTitle(idx, e.target.value)}
                  placeholder={item.file.name}
                  className="flex-1 bg-transparent border-0 p-0 text-sm focus:outline-none focus:ring-0 text-gray-800"
                />
                <span className="text-xs text-gray-500">{formatFileSize(item.file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeNewFile(idx)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Veiksmai: pridėti */}
        <div className="flex flex-wrap gap-2">
          {availableDocs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowLibrary(!showLibrary)}
              className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 flex items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              {showLibrary ? "Slėpti biblioteką" : "Pasirinkti iš bibliotekos"}
            </button>
          )}
          <label className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 flex items-center gap-1 cursor-pointer">
            <Upload className="h-3 w-3" />
            Įkelti naują failą
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </label>
        </div>

        {/* Bibliotekos sąrašas */}
        {showLibrary && availableDocs.length > 0 && (
          <ul className="mt-2 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-1 bg-gray-50">
            {availableDocs.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => toggleDoc(d.id)}
                  className="w-full flex items-center gap-2 text-sm text-left text-gray-700 hover:bg-white px-2 py-1.5 rounded"
                >
                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{d.title}</span>
                  {d.file_size && (
                    <span className="text-xs text-gray-400">{formatFileSize(d.file_size)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {availableDocs.length === 0 && allDocuments.length === 0 && newFiles.length === 0 && (
          <p className="text-xs text-gray-400 italic mt-1">
            Bibliotekoje dar nėra dokumentų. Įkelkite naują failą tiesiog čia.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <Button type="submit" size="sm" loading={loading}>
          Pridėti
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={reset}>
          Atšaukti
        </Button>
      </div>
    </form>
  );
}
