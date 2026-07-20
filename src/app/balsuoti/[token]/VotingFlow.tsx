"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { castVotesByToken, registerLiveIntentByToken } from "@/actions/tokens";
import { VOTE_LABELS } from "@/lib/constants";
import { useLocale } from "@/components/i18n/LocaleProvider";

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
  const locale = useLocale();
  const [step, setStep] = useState<Step>("contacts");
  const [email, setEmail] = useState(data.member.email || "");
  const [phone, setPhone] = useState(data.member.phone || "");
  // Pradinė reikšmė – jokio pasirinkimo. Narys turi sąmoningai paspausti
  // vieną iš trijų mygtukų (UŽ / PRIEŠ / SUSILAIKAU) kiekvienam klausimui.
  // Anksčiau buvo „susilaikau" by default, bet tai klaidino narius – atrodė,
  // kad „susilaikau" yra fiksuotas / neaktyvus, nes visada būdavo geltonas.
  const [votes, setVotes] = useState<Record<string, VoteChoice | undefined>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
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
    // Safety net – allVoted button guard turėjo užkirsti kelią, bet
    // jei kažkas pro jį pralenda, neleidžiam siųsti su nepasirinktais.
    if (!allVoted) {
      toast.error("Pasirinkite atsakymą visiems klausimams prieš pateikiant balsą");
      setStep("voting");
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
        vote: votes[r.id]!,
        comment: (comments[r.id] || "").trim() || null,
        documents: r.documents?.map((d) => ({
          id: d.id,
          title: d.title,
          file_path: d.file_path,
        })),
      })),
      locale
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
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Ačiū, {vocative(data.member.first_name)}!
        </h2>
        <p className="text-lg text-gray-700 mb-3">Jūsų balsas sėkmingai užregistruotas.</p>
        {finalEmail ? (
          <p className="text-base text-gray-700 mb-6 inline-flex items-center gap-1.5">
            <Mail className="h-5 w-5" />
            Patvirtinimas su balsų suvestine išsiųstas į{" "}
            <span className="font-semibold">{finalEmail}</span>
          </p>
        ) : (
          <p className="text-base text-gray-700 mb-6">
            El. pašto nepateikėte – balsavimo suvestinės nesiunčiame.
          </p>
        )}
        <a
          href={`/susirinkimai/${data.meeting.id}`}
          className="inline-flex items-center gap-1.5 text-base text-green-700 hover:text-green-800 hover:underline mb-3 font-medium"
        >
          <FileText className="h-5 w-5" />
          Visi susirinkimo dokumentai ir rezultatai
        </a>
        <p className="text-sm text-gray-500 mt-2">
          Šią nuorodą galite uždaryti – pakartotinai balsuoti nebegalėsite.
        </p>
      </div>
    );
  }

  if (step === "done_live") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <Users className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Lauksime jūsų, {vocative(data.member.first_name)}!
        </h2>
        <p className="text-lg text-gray-700 mb-3">
          Pažymėjote, kad dalyvausite susirinkime <strong>gyvai</strong>.
        </p>
        <div className="bg-green-50 border border-green-100 rounded-lg p-4 my-5 text-base text-gray-800">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Calendar className="h-5 w-5 text-green-700" />
            <span className="font-semibold">
              {formatDateLong(data.meeting.meeting_date)}{" "}
              {new Date(data.meeting.meeting_date).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius" })}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <MapPin className="h-5 w-5 text-green-700" />
            {data.meeting.location}
          </div>
        </div>
        <a
          href={`/susirinkimai/${data.meeting.id}`}
          className="inline-flex items-center gap-1.5 text-base text-green-700 hover:text-green-800 hover:underline mb-3 font-medium"
        >
          <FileText className="h-5 w-5" />
          Visi susirinkimo dokumentai
        </a>
        <p className="text-sm text-gray-500 mt-2">
          Jei persigalvosite – galite grįžti per tą pačią SMS nuorodą ir balsuoti nuotoliu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProgressIndicator step={step} />

      {step === "contacts" && (
        <>
          {/* Pirmiausia – susirinkimas + darbotvarkė, kad narys žinotų dėl ko sprendžia */}
          <MeetingHeader meeting={data.meeting} resolutions={data.resolutions} />
          {/* Tada – pasirinkimas: gyvai ar nuotoliu */}
          <ContactsStep
            firstNameVocative={vocative(data.member.first_name)}
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
        </>
      )}

      {step === "voting" && (
        <VotingStep
          resolutions={data.resolutions}
          votes={votes}
          comments={comments}
          onVote={(id, choice) => setVotes((prev) => ({ ...prev, [id]: choice }))}
          onComment={(id, text) => setComments((prev) => ({ ...prev, [id]: text }))}
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
          comments={comments}
          email={(data.member.email || email.trim()) || null}
          onBack={() => setStep("voting")}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}

      {previewDoc && (
        <DocPreviewModal doc={previewDoc} token={token} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  );
}

function DocPreviewModal({
  doc,
  token,
  onClose,
}: {
  doc: ResolutionDocument;
  token: string;
  onClose: () => void;
}) {
  const baseUrl = getDocumentPublicUrl(doc.file_path);
  const isHtml = isServerGeneratedDoc(doc.file_path);
  // Server-generuoti (__api__) dokumentai (šalinami/planai/rinkimai) yra
  // token-gated (žr. canViewMeetingDoc) – anon balsuotojas perduoda savo tokeną.
  const url =
    isHtml && token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
  return (
    <div
      // fullscreen overlay. 100dvh = dynamic viewport height – atsižvelgia
      // į mobiliuose įrenginiuose besislepiančią adresų juostą; flex col +
      // min-h-0 vidiniam fragmentui užtikrina, kad iframe niekada
      // neperauga viewport'o ir neišstumia apatinės juostos žemyn.
      className="fixed inset-0 z-50 bg-white flex flex-col h-[100dvh]"
    >
      {/* Antraštė: visada matomas didelis „Grįžti atgal" mygtukas */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-green-700 text-white shadow-md flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="h-5 w-5 flex-shrink-0" />
          <span className="text-base font-semibold truncate">{doc.title}</span>
        </div>
        {!isHtml && (
          <a
            href={url}
            download={doc.file_name}
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10"
            title="Atsisiųsti"
          >
            <Download className="h-4 w-4" />
            Atsisiųsti
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-base font-bold bg-white text-green-800 hover:bg-gray-100 px-4 py-2.5 rounded-lg shadow-sm flex-shrink-0"
        >
          <X className="h-5 w-5" />
          Grįžti atgal
        </button>
      </div>

      {/* Pats dokumentas – visas likęs aukštis. min-h-0 yra KRITIŠKAS:
          be jo flex-1 vaikas leistų iframe'ui auginti aukštį iki content
          dydžio ir tada apatinė juosta pasislinktų už ekrano ribų. */}
      <div className="flex-1 min-h-0 bg-gray-100 overflow-hidden">
        {isHtml ? (
          <iframe
            src={url}
            className="block w-full h-full bg-white"
            title={doc.title}
          />
        ) : (
          <PdfViewer url={url} />
        )}
      </div>

      {/* Apatinė juostelė – dar vienas didelis mygtukas grįžti į balsavimą.
          Su pb-[env(safe-area-inset-bottom)] kad iOS „home indicator" zonoje
          mygtukas neliktų po sistemos juosta. */}
      <div
        className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3 shadow-[0_-2px_6px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white text-base font-bold py-3 rounded-lg shadow-sm"
        >
          <ChevronLeft className="h-5 w-5" />
          Grįžti į balsavimą
        </button>
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
            className={`flex items-center justify-center w-10 h-10 rounded-full text-base font-bold ${
              i <= currentIdx ? "bg-green-700 text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`ml-2 text-base ${
              i <= currentIdx ? "text-gray-900 font-semibold" : "text-gray-400"
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
      <h2 className="text-2xl font-bold text-gray-900 mb-3">{meeting.title}</h2>
      <div className="flex flex-wrap gap-4 text-base text-gray-700">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-5 w-5" />
          {formatDateLong(meeting.meeting_date)}{" "}
          {new Date(meeting.meeting_date).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius" })}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-5 w-5" />
          {meeting.location}
        </span>
      </div>
      {meeting.description && (
        <p className="mt-4 text-base text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-4">
          {meeting.description}
        </p>
      )}

      {resolutions.length > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Darbotvarkė</h3>
          <ol className="space-y-2.5">
            {resolutions.map((r) => (
              <li key={r.id} className="flex items-start gap-3 text-base text-gray-800">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-800 text-sm font-bold flex items-center justify-center mt-0.5">
                  {r.resolution_number}
                </span>
                <span className="flex-1 leading-relaxed">{r.title}</span>
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
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        Sveiki, {firstNameVocative}!
      </h3>
      <p className="text-base text-gray-700 mb-6 leading-relaxed">
        Susipažinote su darbotvarke aukščiau. Dabar pasirinkite, kaip dalyvausite susirinkime –
        atvyksite gyvai ar balsuosite nuotoliu jau dabar.
      </p>

      {alreadyChoseLive && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5 flex items-start gap-2 text-base text-amber-900">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>
            Anksčiau pažymėjote, kad dalyvausite gyvai. Galite balsuoti nuotoliu, jei persigalvojote.
          </span>
        </div>
      )}

      {/* Variantas A: dalyvausiu gyvai */}
      <div className="border-2 border-gray-200 rounded-xl p-5 mb-4">
        <h4 className="text-xl font-bold text-gray-900 mb-2">A. Dalyvausiu gyvai</h4>
        <p className="text-base text-gray-700 mb-4 leading-relaxed">
          Atvyksiu į susirinkimą gegužės 23 d. ir balsuosiu vietoje. Jei persigalvosite, galėsite grįžti į šią
          nuorodą ir balsuoti nuotoliu.
        </p>
        <Button
          variant="outline"
          onClick={onLive}
          loading={registeringLive}
          className="w-full text-lg py-3"
        >
          <Users className="h-5 w-5" />
          Dalyvausiu gyvai
        </Button>
      </div>

      {/* Variantas B: balsuoti nuotoliu */}
      <div className="border-2 border-gray-200 rounded-xl p-5">
        <h4 className="text-xl font-bold text-gray-900 mb-2">B. Balsuoti nuotoliu</h4>
        <p className="text-base text-gray-700 mb-4 leading-relaxed">
          Jūsų balsas bus įskaičiuotas į susirinkimo rezultatus, o jūs gausite balsų suvestinę el. paštu.
        </p>

        {hasExistingEmail ? (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 flex items-start gap-2 text-base text-blue-900">
            <Mail className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>
              Pilną balsavimo ataskaitą atsiųsime į{" "}
              <strong className="font-semibold">{existingEmail}</strong>
            </span>
          </div>
        ) : (
          <div className="space-y-1 mb-4">
            <label className="block text-base font-semibold text-gray-800 mb-2">
              El. paštas <span className="text-gray-500 text-sm font-normal">(neprivalomas)</span>
            </label>
            <Input
              type="email"
              placeholder="vardenis@email.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className={`text-base ${showError ? "border-red-300" : ""}`}
            />
            {showError ? (
              <p className="text-sm text-red-600 mt-1.5">Patikrinkite el. pašto formatą</p>
            ) : (
              <p className="text-sm text-gray-600 mt-1.5">
                Įveskite, jei norite gauti pilną balsavimo ataskaitą į el. paštą. Balsuoti galima ir be jo.
              </p>
            )}
          </div>
        )}

        {!hasExistingEmail && (
          <div className="space-y-1 mb-4">
            <label className="block text-base font-semibold text-gray-800 mb-2">
              Telefonas <span className="text-gray-500 text-sm font-normal">(neprivalomas)</span>
            </label>
            <Input
              type="tel"
              placeholder="+370 6XX XXXXX"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className="text-base"
            />
          </div>
        )}

        <Button onClick={onNext} disabled={!canVote} className="w-full text-lg py-3">
          <ChevronRight className="h-5 w-5" />
          Balsuoti
        </Button>
      </div>
    </div>
  );
}

function VotingStep({
  resolutions,
  votes,
  comments,
  onVote,
  onComment,
  onBack,
  onNext,
  allVoted,
  onPreviewDoc,
}: {
  resolutions: Resolution[];
  votes: Record<string, VoteChoice | undefined>;
  comments: Record<string, string>;
  onVote: (id: string, choice: VoteChoice) => void;
  onComment: (id: string, text: string) => void;
  onBack: () => void;
  onNext: () => void;
  allVoted: boolean;
  onPreviewDoc: (doc: ResolutionDocument) => void;
}) {
  return (
    <div className="space-y-4">
      {resolutions.map((r) => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="flex-shrink-0 w-9 h-9 rounded-full bg-green-100 text-green-800 text-base font-bold flex items-center justify-center">
              {r.resolution_number}
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 leading-snug">{r.title}</h3>
              {r.description && (
                <p className="text-base text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">{r.description}</p>
              )}
              {r.requires_qualified_majority && (
                <p className="text-sm text-amber-700 mt-2 flex items-center gap-1.5 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Reikia 2/3 balsų daugumos
                </p>
              )}
            </div>
          </div>

          {r.documents && r.documents.length > 0 && (
            <div className="mb-5 bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-sm font-bold text-blue-900 uppercase tracking-wide mb-2">
                Susipažinkite prieš balsuojant
              </p>
              <ul className="space-y-2">
                {r.documents.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => onPreviewDoc(doc)}
                      className="w-full flex items-center gap-2 text-base text-blue-800 hover:text-blue-900 hover:underline text-left font-medium"
                    >
                      <FileText className="h-5 w-5 flex-shrink-0" />
                      <span className="flex-1">{doc.title}</span>
                      {doc.file_size && (
                        <span className="text-sm text-gray-500">{formatFileSize(doc.file_size)}</span>
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
              // Visi trys mygtukai – vienodai prominentiški pasirinkti
              // (sodri spalva + varnelė). Nepasirinkti – švelnios spalvos.
              const colors = {
                uz: selected
                  ? "bg-green-700 text-white border-green-800 shadow-md ring-2 ring-green-300"
                  : "bg-green-50 text-green-800 border-green-300 hover:bg-green-100 hover:border-green-400",
                pries: selected
                  ? "bg-red-700 text-white border-red-800 shadow-md ring-2 ring-red-300"
                  : "bg-red-50 text-red-800 border-red-300 hover:bg-red-100 hover:border-red-400",
                susilaike: selected
                  ? "bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-300"
                  : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400",
              };
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => onVote(r.id, choice)}
                  className={`px-4 py-4 rounded-lg border-2 font-bold text-base transition-all flex items-center justify-center gap-1.5 ${colors[choice]}`}
                >
                  {selected && <CheckCircle2 className="h-5 w-5 flex-shrink-0" />}
                  {VOTE_LABELS[choice]}
                </button>
              );
            })}
          </div>
          {!votes[r.id] && (
            <p className="mt-2 text-sm text-amber-700 font-medium flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Pasirinkite vieną variantą
            </p>
          )}

          {/* Komentaras / pasisakymas prie balso (neprivalomas) */}
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Komentaras / pasisakymas <span className="text-gray-500 font-normal">(neprivaloma)</span>
            </label>
            <Textarea
              rows={2}
              placeholder="Pridėkite trumpą nuomonę, jei norite, kad ji būtų užfiksuota protokole..."
              value={comments[r.id] || ""}
              onChange={(e) => onComment(r.id, e.target.value)}
              className="text-base"
            />
          </div>
        </div>
      ))}

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack} className="text-base py-3">
          <ChevronLeft className="h-5 w-5" />
          Atgal
        </Button>
        <Button onClick={onNext} disabled={!allVoted} className="text-base py-3">
          Peržiūrėti
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      {!allVoted && (
        <p className="text-base text-amber-700 text-right font-medium">
          Pasirinkite po atsakymą kiekvienam klausimui
        </p>
      )}
    </div>
  );
}

function ReviewStep({
  resolutions,
  votes,
  comments,
  email,
  onBack,
  onSubmit,
  submitting,
}: {
  resolutions: Resolution[];
  votes: Record<string, VoteChoice | undefined>;
  comments: Record<string, string>;
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
      <h3 className="text-2xl font-bold text-gray-900 mb-2">Peržiūrėkite ir patvirtinkite</h3>
      <p className="text-base text-gray-700 mb-6 leading-relaxed">
        Patvirtinę balsą, jo pakeisti nebegalėsite.
        {email
          ? <> Balsavimo suvestinė bus atsiųsta į <span className="font-semibold text-gray-900">{email}</span>.</>
          : " El. pašto nepateikėte – suvestinė nebus siunčiama."}
      </p>

      <div className="space-y-3 mb-6">
        {resolutions.map((r) => {
          const comment = (comments[r.id] || "").trim();
          return (
            <div key={r.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-700 text-sm font-bold flex items-center justify-center">
                  {r.resolution_number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base text-gray-900 font-semibold leading-snug">{r.title}</p>
                </div>
                {votes[r.id] && (
                  <span
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold ${
                      colors[votes[r.id]!]
                    }`}
                  >
                    {VOTE_LABELS[votes[r.id]!]}
                  </span>
                )}
              </div>
              {comment && (
                <div className="mt-3 ml-11 text-sm text-gray-700 italic bg-gray-50 px-3 py-2 rounded border-l-2 border-gray-300">
                  &bdquo;{comment}&ldquo;
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack} disabled={submitting} className="text-base py-3">
          <ChevronLeft className="h-5 w-5" />
          Keisti
        </Button>
        <Button variant="success" onClick={onSubmit} loading={submitting} className="text-base py-3">
          <CheckCircle2 className="h-5 w-5" />
          Patvirtinti balsavimą
        </Button>
      </div>
    </div>
  );
}
