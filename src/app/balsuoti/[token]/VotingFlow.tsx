"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { castVotesByToken, registerLiveIntentByToken } from "@/actions/tokens";
import { VOTE_LABELS } from "@/lib/constants";

// PDF Viewer įkraunamas tik kliente (react-pdf reikalauja browser API)
const PdfViewer = dynamic(() => import("@/components/PdfViewer").then((m) => m.PdfViewer), {
  ssr: false,
});
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  MapPin,
  AlertCircle,
  Users,
  Mail,
  FileText,
  X,
  Download,
} from "lucide-react";
import {
  formatDateLong,
  formatFileSize,
  getDocumentPublicUrl,
  isServerGeneratedDoc,
  vocative,
} from "@/lib/utils";
import { toast } from "sonner";

type VoteChoice = "uz" | "pries" | "susilaike";

interface ResolutionDocument {
  id: string;
  title: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  category: string;
}

interface Resolution {
  id: string;
  resolution_number: number;
  title: string;
  description: string | null;
  requires_qualified_majority: boolean;
  is_procedural: boolean;
  documents: ResolutionDocument[];
}

interface Props {
  token: string;
  data: {
    meeting: {
      id: string;
      title: string;
      description: string | null;
      meeting_date: string;
      location: string;
    };
    member: {
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
    };
    resolutions: Resolution[];
    expires_at: string;
    live_intent_at?: string | null;
  };
}

type Step = "contacts" | "voting" | "review" | "done_voted" | "done_live";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function VotingFlow({ token, data }: Props) {
  const [step, setStep] = useState<Step>("contacts");
  const [email, setEmail] = useState(data.member.email || "");
  const [phone, setPhone] = useState(data.member.phone || "");
  // Pradinė reikšmė visiems klausimams – „susilaikau" (numatytasis pasirinkimas)
  const [votes, setVotes] = useState<Record<string, VoteChoice>>(() =>
    data.resolutions.reduce((acc, r) => {
      acc[r.id] = "susilaike";
      return acc;
    }, {} as Record<string, VoteChoice>)
  );
  const [submitting, setSubmitting] = useState(false);
  const [registeringLive, setRegisteringLive] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ResolutionDocument | null>(null);

  // Slinkti į viršų atidarius puslapį ir pakeitus žingsnį
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [step]);

  // Užrakinti body scroll kai modalas atviras
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = previewDoc ? "hidden" : "";
    }
    return () => {
      if (typeof document !== "undefined") document.body.style.overflow = "";
    };
  }, [previewDoc]);

  const allVoted = data.resolutions.every((r) => votes[r.id]);
  const emailValid = EMAIL_RE.test(email.trim());

  async function handleSubmit() {
    // El. paštas neprivalomas, bet jei įvestas – turi būti tinkamo formato
    const trimmedEmail = email.trim();
    if (trimmedEmail.length > 0 && !emailValid) {
      toast.error("Patikrinkite el. pašto formatą arba palikite tuščią");
      setStep("contacts");
      return;
    }
    setSubmitting(true);
    const result = await castVotesByToken(
      token,
      data.member.first_name,
      trimmedEmail || null,
      phone.trim() || null,
      data.resolutions.map((r) => ({
        resolution_id: r.id,
        resolution_number: r.resolution_number,
        title: r.title,
        vote: votes[r.id],
        documents: r.documents?.map((d) => ({
          id: d.id,
          title: d.title,
          file_path: d.file_path,
        })),
      }))
    );
    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error || "Klaida fiksuojant balsą");
      return;
    }
    setStep("done_voted");
  }

  async function handleRegisterLive() {
    setRegisteringLive(true);
    const result = await registerLiveIntentByToken(token);
    setRegisteringLive(false);

    if ("error" in result) {
      toast.error(result.error || "Klaida");
      return;
    }
    setStep("done_live");
  }

  if (step === "done_voted") {
    const finalEmail = data.member.email || email.trim();
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Ačiū, {vocative(data.member.first_name)}!
        </h2>
        <p className="text-gray-600 mb-2">Jūsų balsas sėkmingai užregistruotas.</p>
        {finalEmail ? (
          <p className="text-sm text-gray-600 mb-6 inline-flex items-center gap-1.5">
            <Mail className="h-4 w-4" />
            Patvirtinimas su balsų suvestine išsiųstas į{" "}
            <span className="font-medium">{finalEmail}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-600 mb-6">
            El. pašto nepateikėte – balsavimo suvestinės nesiunčiame.
          </p>
        )}
        <a
          href={`/susirinkimai/${data.meeting.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 hover:underline mb-3"
        >
          <FileText className="h-4 w-4" />
          Visi susirinkimo dokumentai ir rezultatai
        </a>
        <p className="text-xs text-gray-400">
          Šią nuorodą galite uždaryti – pakartotinai balsuoti nebegalėsite.
        </p>
      </div>
    );
  }

  if (step === "done_live") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <Users className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Lauksime jūsų, {vocative(data.member.first_name)}!
        </h2>
        <p className="text-gray-700 mb-2">
          Pažymėjote, kad dalyvausite susirinkime <strong>gyvai</strong>.
        </p>
        <div className="bg-green-50 border border-green-100 rounded-lg p-4 my-5 text-sm text-gray-700">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Calendar className="h-4 w-4 text-green-700" />
            <span className="font-medium">
              {formatDateLong(data.meeting.meeting_date)}{" "}
              {new Date(data.meeting.meeting_date).toLocaleTimeString("lt-LT", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <MapPin className="h-4 w-4 text-green-700" />
            {data.meeting.location}
          </div>
        </div>
        <a
          href={`/susirinkimai/${data.meeting.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 hover:underline mb-3"
        >
          <FileText className="h-4 w-4" />
          Visi susirinkimo dokumentai
        </a>
        <p className="text-xs text-gray-400 mt-2">
          Jei persigalvosite – galite grįžti per tą pačią SMS nuorodą ir balsuoti nuotoliu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProgressIndicator step={step} />

      <MeetingHeader meeting={data.meeting} resolutions={data.resolutions} />

      {step === "contacts" && (
        <ContactsStep
          firstNameVocative={vocative(data.member.first_name)}
          lastName={data.member.last_name}
          email={email}
          phone={phone}
          emailValid={emailValid}
          hasExistingEmail={!!data.member.email}
          existingEmail={data.member.email}
          onEmailChange={setEmail}
          onPhoneChange={setPhone}
          onNext={() => setStep("voting")}
          onLive={handleRegisterLive}
          registeringLive={registeringLive}
          alreadyChoseLive={!!data.live_intent_at}
        />
      )}

      {step === "voting" && (
        <VotingStep
          resolutions={data.resolutions}
          votes={votes}
          onVote={(id, choice) => setVotes((prev) => ({ ...prev, [id]: choice }))}
          onBack={() => setStep("contacts")}
          onNext={() => setStep("review")}
          allVoted={allVoted}
          onPreviewDoc={setPreviewDoc}
        />
      )}

      {step === "review" && (
        <ReviewStep
          resolutions={data.resolutions}
          votes={votes}
          email={(data.member.email || email.trim()) || null}
          onBack={() => setStep("voting")}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}

      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

function DocPreviewModal({
  doc,
  onClose,
}: {
  doc: ResolutionDocument;
  onClose: () => void;
}) {
  const url = getDocumentPublicUrl(doc.file_path);
  const isHtml = isServerGeneratedDoc(doc.file_path);
  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/85 flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 truncate">{doc.title}</span>
        </div>
        {!isHtml && (
          <a
            href={url}
            download={doc.file_name}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
            title="Atsisiųsti"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Atsisiųsti</span>
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
          Uždaryti
        </button>
      </div>
      <div className="flex-1 bg-gray-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {isHtml ? (
          <iframe
            src={url}
            className="w-full h-full bg-white"
            title={doc.title}
          />
        ) : (
          <PdfViewer url={url} />
        )}
      </div>
    </div>
  );
}

function ProgressIndicator({ step }: { step: Step }) {
  const steps = [
    { key: "contacts", label: "Duomenys" },
    { key: "voting", label: "Balsavimas" },
    { key: "review", label: "Patvirtinimas" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ${
              i <= currentIdx ? "bg-green-700 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`ml-2 text-sm ${
              i <= currentIdx ? "text-gray-900 font-medium" : "text-gray-400"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-3 ${i < currentIdx ? "bg-green-700" : "bg-gray-200"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function MeetingHeader({
  meeting,
  resolutions,
}: {
  meeting: Props["data"]["meeting"];
  resolutions: Resolution[];
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{meeting.title}</h2>
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

      {resolutions.length > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Darbotvarkė</h3>
          <ol className="space-y-1.5">
            {resolutions.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center mt-0.5">
                  {r.resolution_number}
                </span>
                <span className="flex-1">{r.title}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ContactsStep({
  firstNameVocative,
  lastName,
  email,
  phone,
  emailValid,
  hasExistingEmail,
  existingEmail,
  onEmailChange,
  onPhoneChange,
  onNext,
  onLive,
  registeringLive,
  alreadyChoseLive,
}: {
  firstNameVocative: string;
  lastName: string;
  email: string;
  phone: string;
  emailValid: boolean;
  hasExistingEmail: boolean;
  existingEmail: string | null;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onNext: () => void;
  onLive: () => void;
  registeringLive: boolean;
  alreadyChoseLive: boolean;
}) {
  const showError = email.length > 0 && !emailValid;
  // Mygtukas blokuojamas tik tada, kai įvestas blogo formato email (tuščias = OK)
  const canVote = email.trim().length === 0 || emailValid;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        Sveiki, {firstNameVocative} {lastName}
      </h3>
      <p className="text-sm text-gray-600 mb-5">
        Pasirinkite, kaip dalyvausite – galite ateiti į susirinkimą gyvai arba balsuoti nuotoliu jau dabar.
      </p>

      {alreadyChoseLive && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 flex items-start gap-2 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Anksčiau pažymėjote, kad dalyvausite gyvai. Galite balsuoti nuotoliu, jei persigalvojote.
          </span>
        </div>
      )}

      {/* Variantas A: dalyvausiu gyvai */}
      <div className="border border-gray-200 rounded-lg p-5 mb-4">
        <h4 className="font-semibold text-gray-900 mb-1">A. Dalyvausiu gyvai</h4>
        <p className="text-xs text-gray-500 mb-4">
          Atvyksiu į susirinkimą gegužės 23 d. ir balsuosiu vietoje. Jei persigalvosite, galėsite grįžti į šią
          nuorodą ir balsuoti nuotoliu.
        </p>
        <Button variant="outline" onClick={onLive} loading={registeringLive} className="w-full">
          <Users className="h-4 w-4" />
          Dalyvausiu gyvai
        </Button>
      </div>

      {/* Variantas B: balsuoti nuotoliu */}
      <div className="border border-gray-200 rounded-lg p-5">
        <h4 className="font-semibold text-gray-900 mb-1">B. Balsuoti nuotoliu</h4>
        <p className="text-xs text-gray-500 mb-4">
          Jūsų balsas bus įskaičiuotas į susirinkimo rezultatus, o jūs gausite balsų suvestinę el. paštu.
        </p>

        {hasExistingEmail ? (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 flex items-start gap-2 text-sm text-blue-900">
            <Mail className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Pilną balsavimo ataskaitą atsiųsime į{" "}
              <strong className="font-semibold">{existingEmail}</strong>
            </span>
          </div>
        ) : (
          <div className="space-y-1 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              El. paštas <span className="text-gray-400 text-xs">(neprivalomas)</span>
            </label>
            <Input
              type="email"
              placeholder="vardenis@email.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className={showError ? "border-red-300" : ""}
            />
            {showError ? (
              <p className="text-xs text-red-600 mt-1">Patikrinkite el. pašto formatą</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Įveskite, jei norite gauti pilną balsavimo ataskaitą į el. paštą. Balsuoti galima ir be jo.
              </p>
            )}
          </div>
        )}

        {!hasExistingEmail && (
          <div className="space-y-1 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Telefonas <span className="text-gray-400 text-xs">(neprivalomas)</span>
            </label>
            <Input
              type="tel"
              placeholder="+370 6XX XXXXX"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
          </div>
        )}

        <Button onClick={onNext} disabled={!canVote} className="w-full">
          <ChevronRight className="h-4 w-4" />
          Balsuoti
        </Button>
      </div>
    </div>
  );
}

function VotingStep({
  resolutions,
  votes,
  onVote,
  onBack,
  onNext,
  allVoted,
  onPreviewDoc,
}: {
  resolutions: Resolution[];
  votes: Record<string, VoteChoice>;
  onVote: (id: string, choice: VoteChoice) => void;
  onBack: () => void;
  onNext: () => void;
  allVoted: boolean;
  onPreviewDoc: (doc: ResolutionDocument) => void;
}) {
  return (
    <div className="space-y-4">
      {resolutions.map((r) => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
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

          {r.documents && r.documents.length > 0 && (
            <div className="mb-4 bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Susipažinkite prieš balsuojant
              </p>
              <ul className="space-y-1.5">
                {r.documents.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => onPreviewDoc(doc)}
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
              // Visada matomos spalvos (švelnios), pasirinkimas – sodri spalva
              const colors = {
                uz: selected
                  ? "bg-green-700 text-white border-green-800 shadow-md"
                  : "bg-green-100 text-green-800 border-green-300 hover:bg-green-200 hover:border-green-400",
                pries: selected
                  ? "bg-red-700 text-white border-red-800 shadow-md"
                  : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200 hover:border-red-400",
                susilaike: selected
                  ? "bg-yellow-500 text-white border-yellow-600 shadow-md"
                  : "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200 hover:border-yellow-400",
              };
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => onVote(r.id, choice)}
                  className={`px-4 py-3 rounded-lg border-2 font-semibold text-sm transition-all ${colors[choice]}`}
                >
                  {VOTE_LABELS[choice]}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          Atgal
        </Button>
        <Button onClick={onNext} disabled={!allVoted}>
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
  );
}

function ReviewStep({
  resolutions,
  votes,
  email,
  onBack,
  onSubmit,
  submitting,
}: {
  resolutions: Resolution[];
  votes: Record<string, VoteChoice>;
  email: string | null;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const colors = {
    uz: "text-green-700 bg-green-50",
    pries: "text-red-700 bg-red-50",
    susilaike: "text-gray-700 bg-gray-100",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Peržiūrėkite ir patvirtinkite</h3>
      <p className="text-sm text-gray-500 mb-5">
        Patvirtinę balsą, jo pakeisti nebegalėsite.
        {email
          ? <> Balsavimo suvestinė bus atsiųsta į <span className="font-medium text-gray-700">{email}</span>.</>
          : " El. pašto nepateikėte – suvestinė nebus siunčiama."}
      </p>

      <div className="space-y-3 mb-6">
        {resolutions.map((r) => (
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
        ))}
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          <ChevronLeft className="h-4 w-4" />
          Keisti
        </Button>
        <Button variant="success" onClick={onSubmit} loading={submitting}>
          <CheckCircle2 className="h-4 w-4" />
          Patvirtinti balsavimą
        </Button>
      </div>
    </div>
  );
}
