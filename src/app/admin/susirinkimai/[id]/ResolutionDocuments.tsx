"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  attachDocumentToResolution,
  detachDocumentFromResolution,
  uploadAndAttachDocument,
} from "@/actions/voting";
import { FileText, Plus, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/utils";
import { Document } from "@/lib/types";

interface AttachedDoc {
  id: string;
  sort_order: number;
  document: Document | null;
}

interface Props {
  resolutionId: string;
  meetingId: string;
  attached: AttachedDoc[];
  allDocuments: Document[];
  canModify: boolean;
}

export function ResolutionDocuments({
  resolutionId,
  meetingId,
  attached,
  allDocuments,
  canModify,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const attachedIds = new Set(
    attached.filter((a) => a.document).map((a) => a.document!.id)
  );
  const available = allDocuments.filter((d) => !attachedIds.has(d.id));

  async function handleAttach(documentId: string) {
    setBusy(documentId);
    const result = await attachDocumentToResolution(resolutionId, documentId, meetingId);
    setBusy(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Dokumentas prikabintas");
      setAdding(false);
      router.refresh();
    }
  }

  async function handleDetach(documentId: string) {
    if (!confirm("Atjungti dokumentą nuo šio nutarimo?")) return;
    setBusy(documentId);
    const result = await detachDocumentFromResolution(resolutionId, documentId, meetingId);
    setBusy(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Dokumentas atjungtas");
      router.refresh();
    }
  }

  async function handleFileUpload(file: File) {
    if (!file) return;
    setUploading(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", file.name.replace(/\.[^.]+$/, ""));

    const result = await uploadAndAttachDocument(resolutionId, meetingId, fd);
    setUploading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Failas įkeltas ir prikabintas");
      setAdding(false);
      router.refresh();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (attached.length === 0 && !canModify) return null;

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Susiję dokumentai ({attached.length})
        </h4>
        {canModify && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs text-green-700 hover:text-green-800 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Pridėti
          </button>
        )}
      </div>

      {attached.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Nėra prikabintų dokumentų</p>
      ) : (
        <ul className="space-y-1">
          {attached.map((a) =>
            a.document ? (
              <li
                key={a.id}
                className="flex items-center gap-2 text-sm text-gray-700 bg-white px-2 py-1.5 rounded border border-gray-100"
              >
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 truncate">{a.document.title}</span>
                {a.document.file_size && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatFileSize(a.document.file_size)}
                  </span>
                )}
                {canModify && (
                  <button
                    type="button"
                    onClick={() => handleDetach(a.document!.id)}
                    disabled={busy === a.document.id}
                    className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title="Atjungti"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ) : null
          )}
        </ul>
      )}

      {adding && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-3">
          {/* Naujo failo įkėlimas */}
          <div>
            <p className="text-xs text-gray-600 mb-1.5">Įkelti naują failą:</p>
            <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition-colors text-sm text-gray-600">
              <Upload className="h-4 w-4" />
              {uploading ? "Įkeliama..." : "Pasirinkite failą iš kompiuterio"}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>
          </div>

          {/* Iš bibliotekos */}
          {available.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-1.5">Arba iš bibliotekos:</p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {available.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => handleAttach(d.id)}
                      disabled={busy === d.id}
                      className="w-full flex items-center gap-2 text-sm text-left text-gray-700 hover:bg-white px-2 py-1.5 rounded border border-transparent hover:border-gray-200 disabled:opacity-50"
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
            </div>
          )}

          <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
            Uždaryti
          </Button>
        </div>
      )}
    </div>
  );
}
