"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { castVotesAsMember } from "@/actions/portal";
import { VOTE_LABELS } from "@/lib/constants";
import { formatDateLong, formatFileSize, getDocumentPublicUrl } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  MapPin,
  AlertCircle,
  FileText,
  X,
  Download,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

const PdfViewer = dynamic(() => import("@/components/PdfViewer").then((m) => m.PdfViewer), {
  ssr: false,
});

type VoteChoice = "uz" | "pries" | "susilaike";

interface Doc {
  id: string;
  title: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
}

interface Resolution {
  id: string;
  resolution_number: number;
  title: string;
  description: string | null;
  requires_qualified_majority: boolean;
  is_procedural: boolean;
  documents: Doc[];
}

interface Props {
  meetingId: string;
  meeting: {
    title: string;
    meeting_date: string;
    location: string;
    description: string | null;
  };
  resolutions: Resolution[];
}

type Step = "voting" | "review" | "done";

export function PortalVotingFlow({ meetingId, meeting, resolutions }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("voting");
  const [votes, setVotes] = useState<Record<string, VoteChoice>>({});
  const [submitting, setSubmitting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = previewDoc ? "hidden" : "";
    }
    return () => {
      if (typeof document !== "undefined") document.body.style.overflow = "";
    };
  }, [previewDoc]);

  const allVoted = resolutions.every((r) => votes[r.id]);

  async function handleSubmit() {
    setSubmitting(true);
    const result = await castVotesAsMember(
      meetingId,
      resolutions.map((r) => ({ resolution_id: r.id, vote: votes[r.id] }))
    );
    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error || "Klaida fiksuojant balsą");
      return;
    }
    setStep("done");
    router.refresh();
  }

  if (step === "done") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Ačiū!</h2>
        <p className="text-gray-600 mb-6">Jūsų balsas sėkmingai užregistruotas.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/portalas/balsavimai"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Atgal į balsavimus
          </Link>
          <Link
            href={`/susirinkimai/${meetingId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            Susirinkimo dokumentai
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/portalas/balsavimai"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Visi balsavimai
      </Link>

      {/* Susirinkimo info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-3">{meeting.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDateLong(meeting.meeting_date)}{" "}
            {new Date(meeting.meeting_date).toLocaleTimeString("lt-LT", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {meeting.location}
          </span>
        </div>
        {meeting.description && (
          <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-4">
            {meeting.description}
          </p>
        )}
      </div>

      {step === "voting" && (
        <div className="space-y-4">
          {resolutions.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start gap-3 mb-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 text-sm font-semibold flex items-center justify-center">
                  {r.resolution_number}
                </span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{r.title}</h3>
                  {r.description && (
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{r.description}</p>
                  )}
                  {r.requires_qualified_majority && (
                    <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Reikia 2/3 balsų daugumos
                    </p>
                  )}
                </div>
              </div>

              {r.documents.length > 0 && (
                <div className="mb-4 bg-gray-50 border border-gray-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Susipažinkite prieš balsuojant
                  </p>
                  <ul className="space-y-1.5">
                    {r.documents.map((doc) => (
                      <li key={doc.id}>
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="w-full flex items-center gap-2 text-sm text-green-700 hover:text-green-800 hover:underline text-left"
                        >
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="flex-1">{doc.title}</span>
                          {doc.file_size && (
                            <span className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {(["uz", "pries", "susilaike"] as VoteChoice[]).map((choice) => {
                  const selected = votes[r.id] === choice;
                  const colors = {
                    uz: selected
                      ? "bg-green-600 text-white border-green-600"
                      : "border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-300",
                    pries: selected
                      ? "bg-red-600 text-white border-red-600"
                      : "border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300",
                    susilaike: selected
                      ? "bg-gray-600 text-white border-gray-600"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50",
                  };
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setVotes((prev) => ({ ...prev, [r.id]: choice }))}
                      className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${colors[choice]}`}
                    >
                      {VOTE_LABELS[choice]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep("review")} disabled={!allVoted}>
              Peržiūrėti
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {!allVoted && (
            <p className="text-sm text-amber-700 text-right">
              Pasirinkite po atsakymą kiekvienam klausimui
            </p>
          )}
        </div>
      )}

      {step === "review" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Peržiūrėkite ir patvirtinkite</h3>
          <p className="text-sm text-gray-500 mb-5">Patvirtinę balsą, jo pakeisti nebegalėsite.</p>
          <div className="space-y-3 mb-6">
            {resolutions.map((r) => {
              const colors = {
                uz: "text-green-700 bg-green-50",
                pries: "text-red-700 bg-red-50",
                susilaike: "text-gray-700 bg-gray-100",
              };
              return (
                <div key={r.id} className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold flex items-center justify-center">
                    {r.resolution_number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium">{r.title}</p>
                  </div>
                  <span
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                      colors[votes[r.id]]
                    }`}
                  >
                    {VOTE_LABELS[votes[r.id]]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => setStep("voting")} disabled={submitting}>
              <ChevronLeft className="h-4 w-4" />
              Keisti
            </Button>
            <Button variant="success" onClick={handleSubmit} loading={submitting}>
              <CheckCircle2 className="h-4 w-4" />
              Patvirtinti balsavimą
            </Button>
          </div>
        </div>
      )}

      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-gray-900/85 flex flex-col"
          onClick={() => setPreviewDoc(null)}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-900 truncate">{previewDoc.title}</span>
            </div>
            <a
              href={getDocumentPublicUrl(previewDoc.file_path)}
              download={previewDoc.file_name}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Atsisiųsti</span>
            </a>
            <button
              type="button"
              onClick={() => setPreviewDoc(null)}
              className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
              Uždaryti
            </button>
          </div>
          <div className="flex-1 bg-gray-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <PdfViewer url={getDocumentPublicUrl(previewDoc.file_path)} />
          </div>
        </div>
      )}
    </div>
  );
}
