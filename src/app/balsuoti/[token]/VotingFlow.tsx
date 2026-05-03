"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { castVotesByToken, registerLiveIntentByToken } from "@/actions/tokens";
import { VOTE_LABELS } from "@/lib/constants";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  MapPin,
  AlertCircle,
  Users,
  Mail,
} from "lucide-react";
import { formatDateLong, vocative } from "@/lib/utils";
import { toast } from "sonner";

type VoteChoice = "uz" | "pries" | "susilaike";

interface Resolution {
  id: string;
  resolution_number: number;
  title: string;
  description: string | null;
  requires_qualified_majority: boolean;
  is_procedural: boolean;
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
  const [votes, setVotes] = useState<Record<string, VoteChoice>>({});
  const [submitting, setSubmitting] = useState(false);
  const [registeringLive, setRegisteringLive] = useState(false);

  const allVoted = data.resolutions.every((r) => votes[r.id]);
  const emailValid = EMAIL_RE.test(email.trim());

  async function handleSubmit() {
    if (!emailValid) {
      toast.error("El. paštas privalomas balsavimui");
      setStep("contacts");
      return;
    }
    setSubmitting(true);
    const result = await castVotesByToken(
      token,
      data.member.first_name,
      email.trim(),
      phone.trim() || null,
      data.resolutions.map((r) => ({
        resolution_id: r.id,
        resolution_number: r.resolution_number,
        title: r.title,
        vote: votes[r.id],
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
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Ačiū, {vocative(data.member.first_name)}!
        </h2>
        <p className="text-gray-600 mb-2">Jūsų balsas sėkmingai užregistruotas.</p>
        <p className="text-sm text-gray-600 mb-6 inline-flex items-center gap-1.5">
          <Mail className="h-4 w-4" />
          Patvirtinimas su balsų suvestine išsiųstas į <span className="font-medium">{email}</span>
        </p>
        <p className="text-sm text-gray-500">
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
        <p className="text-sm text-gray-500">
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
        />
      )}

      {step === "review" && (
        <ReviewStep
          resolutions={data.resolutions}
          votes={votes}
          email={email}
          onBack={() => setStep("voting")}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
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
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onNext: () => void;
  onLive: () => void;
  registeringLive: boolean;
  alreadyChoseLive: boolean;
}) {
  const showError = email.length > 0 && !emailValid;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        Sveiki, {firstNameVocative} {lastName}
      </h3>
      <p className="text-sm text-gray-600 mb-5">
        Pasirinkite, kaip dalyvausite – galite balsuoti nuotoliu jau dabar arba ateiti į susirinkimą gyvai.
      </p>

      {alreadyChoseLive && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 flex items-start gap-2 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Anksčiau pažymėjote, kad dalyvausite gyvai. Galite balsuoti nuotoliu, jei persigalvojote.
          </span>
        </div>
      )}

      {/* Variantas A: balsuoti nuotoliu (reikalauja email) */}
      <div className="border border-gray-200 rounded-lg p-5 mb-4">
        <h4 className="font-semibold text-gray-900 mb-1">A. Balsuoti nuotoliu</h4>
        <p className="text-xs text-gray-500 mb-4">
          Jūsų balsas bus įskaičiuotas į susirinkimo rezultatus, į el. paštą gausite patvirtinimą su balsų suvestine.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              El. paštas <span className="text-red-600">*</span>
            </label>
            <Input
              type="email"
              placeholder="vardenis@email.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className={showError ? "border-red-300" : ""}
            />
            {showError && (
              <p className="text-xs text-red-600 mt-1">Patikrinkite el. pašto formatą</p>
            )}
            {!showError && (
              <p className="text-xs text-gray-500 mt-1">
                Privalomas – be el. pašto balsuoti nuotoliu negalima
              </p>
            )}
          </div>
          <div>
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
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={onNext} disabled={!emailValid}>
            Tęsti į balsavimą
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Variantas B: dalyvausiu gyvai */}
      <div className="border border-gray-200 rounded-lg p-5">
        <h4 className="font-semibold text-gray-900 mb-1">B. Dalyvausiu gyvai</h4>
        <p className="text-xs text-gray-500 mb-4">
          Atvyksiu į susirinkimą gegužės 23 d. ir balsuosiu vietoje. Jei persigalvosite, galėsite grįžti į šią
          nuorodą ir balsuoti nuotoliu.
        </p>
        <Button variant="outline" onClick={onLive} loading={registeringLive} className="w-full">
          <Users className="h-4 w-4" />
          Pažymėti, kad dalyvausiu gyvai
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
}: {
  resolutions: Resolution[];
  votes: Record<string, VoteChoice>;
  onVote: (id: string, choice: VoteChoice) => void;
  onBack: () => void;
  onNext: () => void;
  allVoted: boolean;
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
                  onClick={() => onVote(r.id, choice)}
                  className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${colors[choice]}`}
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
  email: string;
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
        Patvirtinę balsą, jo pakeisti nebegalėsite. Patvirtinimas su balsų suvestine bus
        atsiųstas į <span className="font-medium text-gray-700">{email}</span>.
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
