"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { submitDeclaration } from "@/actions/declarations";
import { vocative, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  CheckCircle2,
  Banknote,
  CreditCard,
  UserMinus,
  Calendar,
  MapPin,
  AlertCircle,
  ExternalLink,
  Heart,
} from "lucide-react";

type Intent = "continue_cash" | "continue_transfer" | "withdraw";

interface UnpaidPeriod {
  fee_period_id: string;
  year: number;
  amount_cents: number;
}

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
  debt?: {
    unpaid_periods: UnpaidPeriod[];
    total_cents: number;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BANK_ACCOUNT = "LT167181200000606866";
const BANK_RECIPIENT = "Krūminių kaimo bendruomenė";

export function DeclarationForm({ token, member, existingDeclaration, debt }: Props) {
  const alreadySubmitted = !!existingDeclaration.submitted_at;
  const hasDebt = (debt?.total_cents ?? 0) > 0;
  const hasEmail = !!(member.email && member.email.trim());

  const [intent, setIntent] = useState<Intent | null>(
    (existingDeclaration.intent as Intent) || null
  );
  const [email, setEmail] = useState(member.email || existingDeclaration.email || "");
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
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Ačiū, {vocative(member.first_name)}!
          </h2>
          <p className="text-gray-600">Jūsų atsakymas užregistruotas.</p>
          {(intent === "continue_cash" || intent === "continue_transfer") && hasDebt && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm text-gray-700 mt-5 text-left">
              <p className="font-medium text-green-800 mb-2">
                Mokėjimo rekvizitai (jei mokėsite pavedimu)
              </p>
              <p>
                <strong>Gavėjas:</strong> {BANK_RECIPIENT}
                <br />
                <strong>Sąskaita:</strong> {BANK_ACCOUNT}
                <br />
                <strong>Suma:</strong> {formatCurrency(debt!.total_cents)}
                <br />
                <strong>Paskirtis:</strong> Nario mokestis – {member.first_name} {member.last_name}
              </p>
            </div>
          )}
          {intent === "withdraw" && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-gray-700 mt-5 text-left">
              <p>
                Jūsų pageidavimas užfiksuotas. Pagal įstatus narystė nutraukiama tik visuotiniam
                susirinkimui balsavus dėl išstojimo. Ačiū už buvimą bendruomenėje!
              </p>
            </div>
          )}
        </div>

        {/* Portalo paskelbimas */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Heart className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 mb-1">Naujovė: nario portalas</h3>
              <p className="text-sm text-gray-700 mb-3">
                Sukūrėme jums asmeninį portalą, kuriame galite stebėti savo mokėjimo istoriją,
                balsavimus, susirinkimų protokolus ir bendruomenės dokumentus.
              </p>
              <a
                href="/registracija"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-green-800 hover:text-green-900 underline"
              >
                Sukurkite paskyrą su tuo pačiu el. paštu
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sveikinimas + susirinkimo info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Sveiki, {vocative(member.first_name)} {member.last_name}
        </h2>
        <p className="text-sm text-gray-700">
          Artėja eilinis visuotinis bendruomenės narių susirinkimas. Prieš jį prašome trumpai
          patvirtinti savo duomenis – kad galėtume tinkamai pasiruošti.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 space-y-1 mt-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-green-700" />
            <span className="font-medium">2026 m. gegužės 23 d. (šeštadienį) 18:00</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-700" />
            Beržų g. 8, Krūminių k.
          </div>
        </div>
      </div>

      {/* Skola – jei yra */}
      {hasDebt && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-1">Nesumokėtas nario mokestis</h3>
          <p className="text-sm text-gray-700 mb-3">
            Galbūt pamiršote – pagal mūsų įrašus dar neapmokėti šie laikotarpiai:
          </p>
          <ul className="space-y-1 mb-3">
            {debt!.unpaid_periods.map((p) => (
              <li key={p.fee_period_id} className="flex justify-between text-sm py-1.5 border-b border-amber-100 last:border-0">
                <span className="text-gray-700">{p.year} m. metinis mokestis</span>
                <span className="font-semibold text-amber-800">{formatCurrency(p.amount_cents)}</span>
              </li>
            ))}
            <li className="flex justify-between text-sm pt-2 font-bold">
              <span className="text-gray-900">Iš viso:</span>
              <span className="text-amber-900">{formatCurrency(debt!.total_cents)}</span>
            </li>
          </ul>
          <p className="text-xs text-gray-600">
            Bendruomenės sąskaita: <span className="font-mono">{BANK_ACCOUNT}</span>
          </p>
        </div>
      )}

      {!hasDebt && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900">Ačiū – mokesčiai sumokėti!</h3>
              <p className="text-sm text-gray-700 mt-1">
                Jūsų nario mokestis už visus metus apmokėtas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Intencijos pasirinkimas */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Jūsų sprendimas
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {hasDebt
            ? "Kaip planuojate sumokėti nario mokestį?"
            : "Patvirtinkit, kad tęsite narystę"}
        </p>

        <div className="space-y-2.5">
          <IntentOption
            active={intent === "continue_transfer"}
            onClick={() => setIntent("continue_transfer")}
            icon={<CreditCard className="h-5 w-5" />}
            title={hasDebt ? "Sumokėsiu pavedimu" : "Tęsiu narystę – mokėsiu pavedimu"}
            desc="Bankiniu pavedimu į bendruomenės sąskaitą"
            color="green"
          />
          <IntentOption
            active={intent === "continue_cash"}
            onClick={() => setIntent("continue_cash")}
            icon={<Banknote className="h-5 w-5" />}
            title={hasDebt ? "Sumokėsiu grynais" : "Tęsiu narystę – mokėsiu grynais"}
            desc="Susitarsiu su pirmininku asmeniškai"
            color="green"
          />
          <IntentOption
            active={intent === "withdraw"}
            onClick={() => setIntent("withdraw")}
            icon={<UserMinus className="h-5 w-5" />}
            title="Atsisakau narystės"
            desc="Norėčiau išstoti iš bendruomenės"
            color="red"
          />
        </div>
      </div>

      {/* Email + komentaras */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Jūsų kontaktai</h3>
        <p className="text-sm text-gray-500 mb-4">
          {hasEmail
            ? "Jūsų el. paštas jau yra mūsų sistemoje – patikrinkit ir, jei reikia, atnaujinkit."
            : "Mes neturime jūsų el. pašto – įveskite, kad galėtume išsiųsti patvirtinimą."}
        </p>

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
                Patvirtinimą su rekvizitais atsiųsime į el. paštą.
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
              rows={2}
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
          {intent === "withdraw" ? "Patvirtinti išstojimą" : "Patvirtinti"}
        </Button>

        {hasDebt && (
          <p className="text-xs text-gray-500 mt-3 leading-relaxed">
            <strong>Pastaba:</strong> nepasirinkus jokio varianto ir per <strong>savaitę negavus mokėjimo</strong>, narys
            įtraukiamas į kandidatų pašalinti sąrašą, kuris bus svarstomas visuotiniame susirinkime.
          </p>
        )}
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
