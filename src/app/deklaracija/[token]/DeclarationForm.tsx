"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { submitDeclaration } from "@/actions/declarations";
import { vocative } from "@/lib/utils";
import { toast } from "sonner";
import {
  CheckCircle2,
  Banknote,
  CreditCard,
  UserMinus,
  Calendar,
  MapPin,
  AlertCircle,
} from "lucide-react";

type Intent = "continue_cash" | "continue_transfer" | "withdraw";

interface Props {
  token: string;
  member: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
  existingDeclaration: {
    submitted_at: string | null;
    intent: string | null;
    email: string | null;
    notes: string | null;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DeclarationForm({ token, member, existingDeclaration }: Props) {
  const alreadySubmitted = !!existingDeclaration.submitted_at;

  const [intent, setIntent] = useState<Intent | null>(
    (existingDeclaration.intent as Intent) || null
  );
  const [email, setEmail] = useState(
    existingDeclaration.email || member.email || ""
  );
  const [notes, setNotes] = useState(existingDeclaration.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(alreadySubmitted);

  const requiresEmail = intent === "continue_cash" || intent === "continue_transfer";
  const emailValid = !requiresEmail || EMAIL_RE.test(email.trim());
  const canSubmit = intent !== null && emailValid;

  async function handleSubmit() {
    if (!intent) {
      toast.error("Pasirinkite vieną iš variantų");
      return;
    }
    if (requiresEmail && !emailValid) {
      toast.error("Įveskite galiojantį el. paštą");
      return;
    }

    setSubmitting(true);
    const result = await submitDeclaration(token, intent, email.trim(), notes.trim());
    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error || "Klaida");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Ačiū, {vocative(member.first_name)}!
        </h2>
        <p className="text-gray-600 mb-3">Jūsų atsakymas užregistruotas.</p>
        {(intent === "continue_cash" || intent === "continue_transfer") && (
          <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm text-gray-700 my-5">
            <p className="font-medium text-green-800 mb-1">Tęsiate narystę</p>
            <p>
              {intent === "continue_cash"
                ? "Susitarkite asmeniškai su pirmininku dėl mokėjimo grynais."
                : "Mokėjimo rekvizitus rasite el. pašte arba bendruomenės svetainėje."}
            </p>
          </div>
        )}
        {intent === "withdraw" && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-gray-700 my-5">
            <p className="font-medium text-amber-800 mb-1">Atsisakote narystės</p>
            <p>
              Jūsų sprendimas užfiksuotas. Susirinkimo metu valdyba oficialiai patvirtins
              išstojimą.
            </p>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-4">Šią nuorodą galite uždaryti.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Susirinkimo info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Sveiki, {vocative(member.first_name)} {member.last_name}
        </h2>
        <p className="text-sm text-gray-700 mb-4">
          Artėja eilinis visuotinis bendruomenės narių susirinkimas:
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-700" />
            <span className="font-medium">2026 m. gegužės 23 d. (šeštadienį) 18:00</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-700" />
            Beržų g. 8, Krūminių k.
          </div>
        </div>
        <p className="text-sm text-gray-700 mt-4">
          Prieš susirinkimą prašome <strong>patvirtinti</strong>, ar tęsiate narystę bendruomenėje.
          Tai padės valdybai pasiruošti narių sąrašo atnaujinimui.
        </p>
      </div>

      {/* Intencijos pasirinkimas */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Jūsų sprendimas</h3>
        <p className="text-sm text-gray-500 mb-4">Pasirinkite vieną variantą</p>

        <div className="space-y-2.5">
          <IntentOption
            active={intent === "continue_cash"}
            onClick={() => setIntent("continue_cash")}
            icon={<Banknote className="h-5 w-5" />}
            title="Tęsiu narystę – sumokėsiu grynais"
            desc="Atsiskaitysiu pirmininkui asmeniškai susitarus"
            color="green"
          />
          <IntentOption
            active={intent === "continue_transfer"}
            onClick={() => setIntent("continue_transfer")}
            icon={<CreditCard className="h-5 w-5" />}
            title="Tęsiu narystę – padarysiu pavedimą"
            desc="Bankiniu pavedimu į bendruomenės sąskaitą"
            color="green"
          />
          <IntentOption
            active={intent === "withdraw"}
            onClick={() => setIntent("withdraw")}
            icon={<UserMinus className="h-5 w-5" />}
            title="Atsisakau narystės"
            desc="Pageidauju išstoti iš bendruomenės"
            color="red"
          />
        </div>
      </div>

      {/* Email + papildomi duomenys */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Kontaktai</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              El. paštas{" "}
              {requiresEmail && <span className="text-red-600">*</span>}
              {!requiresEmail && (
                <span className="text-gray-400 text-xs">(neprivalomas)</span>
              )}
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vardenis@email.com"
              className={
                email.length > 0 && !emailValid && requiresEmail ? "border-red-300" : ""
              }
            />
            {requiresEmail && (
              <p className="text-xs text-gray-500 mt-1">
                Į el. paštą gausit mokėjimo rekvizitus ir patvirtinimą.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Komentaras <span className="text-gray-400 text-xs">(neprivalomas)</span>
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={
                intent === "withdraw"
                  ? "Galite nurodyti priežastį (neprivaloma)"
                  : "Pastabos pirmininkui"
              }
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {!intent && (
          <div className="flex items-center gap-2 text-sm text-amber-700 mb-3">
            <AlertCircle className="h-4 w-4" />
            Pasirinkite vieną iš trijų variantų aukščiau
          </div>
        )}
        <Button
          variant={intent === "withdraw" ? "danger" : "success"}
          onClick={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
          className="w-full"
          size="lg"
        >
          {intent === "withdraw" ? "Patvirtinti išstojimą" : "Patvirtinti narystę"}
        </Button>
      </div>
    </div>
  );
}

function IntentOption({
  active,
  onClick,
  icon,
  title,
  desc,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: "green" | "red";
}) {
  const activeClass =
    color === "green"
      ? "border-green-600 bg-green-50"
      : "border-red-500 bg-red-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-start gap-3 ${
        active ? activeClass : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div
        className={`flex-shrink-0 mt-0.5 ${
          active ? (color === "green" ? "text-green-700" : "text-red-600") : "text-gray-500"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      {active && (
        <CheckCircle2
          className={`h-5 w-5 flex-shrink-0 ${
            color === "green" ? "text-green-600" : "text-red-500"
          }`}
        />
      )}
    </button>
  );
}
